import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Served at https://<user>.github.io/anim-lab/ — set base so asset URLs resolve.
  base: process.env.GITHUB_ACTIONS ? '/anim-lab/' : '/',
});
