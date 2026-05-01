import type { Anim, LoadedFolder } from './types';

const LAST_FOLDER_KEY = 'anim-lab.lastHandle';

// IndexedDB stash for FileSystemDirectoryHandle (handles aren't structured-cloneable to localStorage but are to IDB)
const DB_NAME = 'anim-lab';
const STORE = 'handles';

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function stashHandle(handle: FileSystemDirectoryHandle) {
  try {
    const db = await idb();
    await new Promise<void>((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(handle, LAST_FOLDER_KEY);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    localStorage.setItem(LAST_FOLDER_KEY, handle.name);
  } catch { /* noop */ }
}

export async function readStashedHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await idb();
    return await new Promise<FileSystemDirectoryHandle | null>((res, rej) => {
      const tx = db.transaction(STORE, 'readonly');
      const r = tx.objectStore(STORE).get(LAST_FOLDER_KEY);
      r.onsuccess = () => res((r.result as FileSystemDirectoryHandle) ?? null);
      r.onerror = () => rej(r.error);
    });
  } catch { return null; }
}

export function lastFolderName(): string | null {
  return localStorage.getItem(LAST_FOLDER_KEY);
}

function validateAnim(o: any): asserts o is Anim {
  if (!o || typeof o !== 'object') throw new Error('anim.json: not an object');
  if (typeof o.name !== 'string') throw new Error('anim.json: name missing');
  if (typeof o.fps !== 'number' || o.fps <= 0) throw new Error('anim.json: fps must be > 0');
  if (typeof o.loop !== 'boolean') throw new Error('anim.json: loop must be boolean');
  if (!o.anchor || typeof o.anchor.x !== 'number' || typeof o.anchor.y !== 'number')
    throw new Error('anim.json: anchor.x/y missing');
  if (!Array.isArray(o.frames) || o.frames.length === 0) throw new Error('anim.json: frames empty');
  for (const f of o.frames) {
    if (typeof f.src !== 'string') throw new Error('frame.src missing');
    if (typeof f.duration !== 'number' || f.duration <= 0) throw new Error(`frame ${f.src}: duration > 0`);
    if (typeof f.phase !== 'string') throw new Error(`frame ${f.src}: phase missing`);
  }
  if (!o.events) o.events = {};
}

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image load fail'));
    img.src = url;
  });
}

// File System Access API path
export async function loadFromDirHandle(handle: FileSystemDirectoryHandle): Promise<LoadedFolder> {
  let jsonHandle: FileSystemFileHandle | null = null;
  const fileEntries: Record<string, FileSystemFileHandle> = {};

  for await (const [name, h] of (handle as any).entries() as AsyncIterable<[string, FileSystemHandle]>) {
    if (h.kind === 'file') {
      const fh = h as FileSystemFileHandle;
      if (name === 'anim.json') jsonHandle = fh;
      else if (name.toLowerCase().endsWith('.png')) fileEntries[name] = fh;
    }
  }
  if (!jsonHandle) throw new Error('anim.json not found in folder');

  const jsonFile = await jsonHandle.getFile();
  const anim = JSON.parse(await jsonFile.text());
  validateAnim(anim);

  const images: Record<string, HTMLImageElement> = {};
  for (const f of anim.frames) {
    const fh = fileEntries[f.src];
    if (!fh) throw new Error(`PNG not found: ${f.src}`);
    images[f.src] = await loadImage(await fh.getFile());
  }

  return { name: handle.name, anim, images, dirHandle: handle, jsonHandle };
}

// Fallback: <input webkitdirectory> or DataTransfer items
export async function loadFromFileList(files: File[]): Promise<LoadedFolder> {
  // strip leading folder name if present (from webkitRelativePath)
  const byName: Record<string, File> = {};
  let folderName = 'folder';
  let jsonFile: File | null = null;
  for (const f of files) {
    const rel = (f as any).webkitRelativePath || f.name;
    const parts = rel.split('/');
    const base = parts[parts.length - 1];
    if (parts.length > 1) folderName = parts[0];
    if (base === 'anim.json') jsonFile = f;
    else if (base.toLowerCase().endsWith('.png')) byName[base] = f;
  }
  if (!jsonFile) throw new Error('anim.json not found');

  const anim = JSON.parse(await jsonFile.text());
  validateAnim(anim);
  const images: Record<string, HTMLImageElement> = {};
  for (const f of anim.frames) {
    if (!byName[f.src]) throw new Error(`PNG not found: ${f.src}`);
    images[f.src] = await loadImage(byName[f.src]);
  }
  return { name: folderName, anim, images };
}

// DataTransferItemList (drag/drop) — use FSA if possible, else walk entries
export async function loadFromDrop(dt: DataTransfer): Promise<LoadedFolder> {
  // try FSA
  if ('getAsFileSystemHandle' in DataTransferItem.prototype) {
    for (const item of Array.from(dt.items)) {
      if (item.kind !== 'file') continue;
      // @ts-expect-error: Chromium API
      const handle = await item.getAsFileSystemHandle?.();
      if (handle && handle.kind === 'directory') {
        try {
          // ask for read explicitly later when needed; entries() works without prompt
          await stashHandle(handle as FileSystemDirectoryHandle);
        } catch { /* noop */ }
        return loadFromDirHandle(handle as FileSystemDirectoryHandle);
      }
    }
  }
  // fallback: walk webkitGetAsEntry
  const files: File[] = [];
  const walks: Promise<void>[] = [];
  for (const item of Array.from(dt.items)) {
    const entry = (item as any).webkitGetAsEntry?.();
    if (entry) walks.push(walkEntry(entry, files));
  }
  await Promise.all(walks);
  if (files.length) return loadFromFileList(files);

  // single-file fallback
  return loadFromFileList(Array.from(dt.files));
}

function walkEntry(entry: any, out: File[]): Promise<void> {
  return new Promise((resolve) => {
    if (entry.isFile) {
      entry.file((f: File) => {
        Object.defineProperty(f, 'webkitRelativePath', { value: entry.fullPath.replace(/^\//, '') });
        out.push(f);
        resolve();
      });
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      reader.readEntries(async (entries: any[]) => {
        await Promise.all(entries.map((e) => walkEntry(e, out)));
        resolve();
      });
    } else resolve();
  });
}

export async function pickFolder(): Promise<LoadedFolder> {
  // @ts-expect-error: showDirectoryPicker exists where available
  if (window.showDirectoryPicker) {
    // @ts-expect-error
    const handle = await window.showDirectoryPicker();
    await stashHandle(handle);
    return loadFromDirHandle(handle);
  }
  // input fallback
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    (input as any).webkitdirectory = true;
    input.multiple = true;
    input.onchange = async () => {
      try { resolve(await loadFromFileList(Array.from(input.files ?? []))); }
      catch (e) { reject(e); }
    };
    input.click();
  });
}

export async function ensurePermission(handle: FileSystemDirectoryHandle, mode: 'read' | 'readwrite'): Promise<boolean> {
  // @ts-expect-error
  const q = await handle.queryPermission?.({ mode });
  if (q === 'granted') return true;
  // @ts-expect-error
  const r = await handle.requestPermission?.({ mode });
  return r === 'granted';
}

export async function saveAnimJson(loaded: LoadedFolder): Promise<void> {
  if (!loaded.dirHandle) throw new Error('No folder handle (load via FSA to enable save)');
  const ok = await ensurePermission(loaded.dirHandle, 'readwrite');
  if (!ok) throw new Error('Write permission denied');
  const jsonHandle = loaded.jsonHandle ?? await loaded.dirHandle.getFileHandle('anim.json', { create: true });
  const writable = await jsonHandle.createWritable();
  await writable.write(JSON.stringify(loaded.anim, null, 2));
  await writable.close();
}
