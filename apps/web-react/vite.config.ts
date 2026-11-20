import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync } from 'node:fs';
import { localData } from './vite-plugin-local-data';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig({
  // Shown in the footer.
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  // LOCAL_DATA_DIR lets tests use a throwaway folder instead of ./local-data.
  plugins: [react(), tailwindcss(), localData({ dir: process.env.LOCAL_DATA_DIR })],
  server: {
    host: "0.0.0.0",
    port: 9009,
    // Saving a snapshot must not trigger a page reload.
    watch: { ignored: ['**/local-data/**', '**/mockups/**'] },
  },
});
