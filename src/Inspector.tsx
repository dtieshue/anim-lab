import { useStore } from './store';
import { PHASE_COLORS, PHASES, type Phase } from './types';
import { saveAnimJson } from './loader';
import { useState } from 'react';

export default function Inspector() {
  const loaded = useStore((s) => s.loaded);
  const selectedFrame = useStore((s) => s.selectedFrame);
  const updateAnim = useStore((s) => s.updateAnim);
  const updateFrame = useStore((s) => s.updateFrame);
  const updateEvent = useStore((s) => s.updateEvent);
  const removeFrame = useStore((s) => s.removeFrame);

  const [saveMsg, setSaveMsg] = useState<string>('');

  if (!loaded) return (
    <aside className="w-80 shrink-0 border-l border-neutral-800 bg-neutral-950 p-4 text-sm text-neutral-500">
      Drop a folder to begin.
    </aside>
  );

  const a = loaded.anim;
  const frame = a.frames[selectedFrame];

  const onSave = async () => {
    try {
      await saveAnimJson(loaded);
      setSaveMsg('Saved ✓');
    } catch (e: any) {
      setSaveMsg(`Save failed: ${e.message ?? e}`);
    }
    setTimeout(() => setSaveMsg(''), 2500);
  };

  const onCopy = async () => {
    await navigator.clipboard.writeText(JSON.stringify(a, null, 2));
    setSaveMsg('Copied ✓');
    setTimeout(() => setSaveMsg(''), 2000);
  };

  const eventName = frame.event;
  const ev = eventName ? a.events[eventName] : undefined;

  return (
    <aside className="w-80 shrink-0 border-l border-neutral-800 bg-neutral-950 overflow-y-auto">
      <Section title="Animation">
        <Row label="Name"><span className="text-neutral-200 truncate">{a.name}</span></Row>
        <NumberField label="FPS" value={a.fps} min={1} max={120} step={1}
          onChange={(v) => updateAnim({ fps: v })} />
        <Row label="Loop">
          <Switch value={a.loop} onChange={(b) => updateAnim({ loop: b })} />
        </Row>
        <NumberField label="Anchor X" value={a.anchor.x} min={0} max={1} step={0.01}
          onChange={(v) => updateAnim({ anchor: { ...a.anchor, x: v } })} />
        <NumberField label="Anchor Y" value={a.anchor.y} min={0} max={1} step={0.01}
          onChange={(v) => updateAnim({ anchor: { ...a.anchor, y: v } })} />
      </Section>

      <Section title={`Frame ${selectedFrame}`} accent={PHASE_COLORS[frame.phase]}>
        <Row label="Source">
          <div className="flex items-center gap-2">
            <span className="text-neutral-400 truncate text-xs">{frame.src}</span>
            {a.frames.length > 1 && (
              <button
                onClick={() => removeFrame(selectedFrame)}
                title="Remove this frame from the animation (image stays in staging)"
                className="text-[10px] text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-1.5 py-0.5 rounded transition-colors"
              >
                Remove
              </button>
            )}
          </div>
        </Row>
        <Row label="Phase">
          <select
            value={frame.phase}
            onChange={(e) => updateFrame(selectedFrame, { phase: e.target.value as Phase })}
            className="bg-neutral-900 ring-1 ring-neutral-800 rounded px-1.5 py-1 text-xs hover:ring-neutral-700 focus:ring-violet-500 focus:outline-none"
          >
            {PHASES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </Row>
        <NumberField label="Duration" suffix="frames" value={frame.duration} min={1} max={120} step={1}
          onChange={(v) => updateFrame(selectedFrame, { duration: v })} />
        <Row label="Event">
          <input
            type="text"
            value={frame.event ?? ''}
            placeholder="(none)"
            onChange={(e) => updateFrame(selectedFrame, { event: e.target.value || undefined })}
            className="bg-neutral-900 ring-1 ring-neutral-800 rounded px-1.5 py-1 text-xs w-32 hover:ring-neutral-700 focus:ring-violet-500 focus:outline-none"
          />
        </Row>
        <Row label="Hitbox">
          {frame.hitbox ? (
            <div className="flex items-center gap-2">
              <span className="text-neutral-400 text-xs tabular-nums">
                {frame.hitbox.x},{frame.hitbox.y} · {frame.hitbox.w}×{frame.hitbox.h}
              </span>
              <button
                onClick={() => updateFrame(selectedFrame, { hitbox: undefined })}
                className="text-[10px] text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-1.5 py-0.5 rounded transition-colors"
              >
                Clear
              </button>
            </div>
          ) : (
            <span className="text-neutral-600 text-xs">drag on canvas</span>
          )}
        </Row>
      </Section>

      {eventName && (
        <Section title={`Polish — "${eventName}"`} accent="#fbbf24">
          <Slider label="Hitstop" suffix="frames" value={ev?.hitstop ?? 0} min={0} max={20} step={1}
            onChange={(v) => updateEvent(eventName, { hitstop: v })} />
          <Slider label="Shake" suffix="frames / mag" value={ev?.shake ?? 0} min={0} max={20} step={1}
            onChange={(v) => updateEvent(eventName, { shake: v })} />
          <Row label="Flash">
            <Switch value={!!ev?.flash} onChange={(b) => updateEvent(eventName, { flash: b })} />
          </Row>
        </Section>
      )}

      {loaded.generated && (
        <Section title="No anim.json found">
          <p className="text-[11px] text-amber-300/90 leading-snug">
            Frames were sorted alphabetically and assigned default timing. Set phases and durations, then <strong>Save anim.json</strong> to write it into the folder.
          </p>
        </Section>
      )}

      <Section title="Export">
        <div className="flex gap-2">
          <button onClick={onSave} className="flex-1 bg-violet-500 hover:bg-violet-400 active:bg-violet-600 transition-colors rounded px-2 py-1.5 text-xs font-medium text-white">Save anim.json</button>
          <button onClick={onCopy} className="flex-1 bg-neutral-900 ring-1 ring-neutral-800 hover:ring-neutral-700 transition rounded px-2 py-1.5 text-xs">Copy JSON</button>
        </div>
        {saveMsg && <div className="text-xs text-neutral-400 mt-2">{saveMsg}</div>}
        {!loaded.dirHandle && <div className="text-[11px] text-amber-400/90 mt-2 leading-snug">Loaded via fallback — Save unavailable. Use Copy JSON.</div>}
      </Section>
    </aside>
  );
}

function Section({ title, children, accent }: { title: string; children: React.ReactNode; accent?: string }) {
  return (
    <div className="border-b border-neutral-800/80 p-3.5">
      <div className="flex items-center gap-2 mb-2.5">
        {accent && <span className="w-1.5 h-1.5 rounded-full" style={{ background: accent }} />}
        <div className="text-[10px] uppercase tracking-wider text-neutral-500">{title}</div>
      </div>
      <div className="flex flex-col gap-2 text-sm">{children}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 min-h-[26px]">
      <span className="text-neutral-500 text-xs">{label}</span>
      <div className="min-w-0 flex items-center">{children}</div>
    </div>
  );
}

function NumberField({ label, value, min, max, step, suffix, onChange }:
  { label: string; value: number; min: number; max: number; step: number; suffix?: string; onChange: (v: number) => void }) {
  return (
    <Row label={label}>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          value={value}
          min={min} max={max} step={step}
          onChange={(e) => onChange(Number(e.target.value))}
          className="bg-neutral-900 ring-1 ring-neutral-800 rounded px-1.5 py-1 w-20 tabular-nums text-xs hover:ring-neutral-700 focus:ring-violet-500 focus:outline-none"
        />
        {suffix && <span className="text-[10px] text-neutral-500">{suffix}</span>}
      </div>
    </Row>
  );
}

function Slider({ label, value, min, max, step, suffix, onChange }:
  { label: string; value: number; min: number; max: number; step: number; suffix?: string; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-neutral-500 mb-1">
        <span>{label}{suffix && <span className="ml-1 text-neutral-600">({suffix})</span>}</span>
        <span className="tabular-nums text-neutral-200">{value}</span>
      </div>
      <input type="range" value={value} min={min} max={max} step={step}
        onChange={(e) => onChange(Number(e.target.value))} className="w-full" />
    </div>
  );
}

function Switch({ value, onChange }: { value: boolean; onChange: (b: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`relative w-9 h-5 rounded-full transition-colors ${value ? 'bg-violet-500' : 'bg-neutral-800'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-4' : ''}`} />
    </button>
  );
}
