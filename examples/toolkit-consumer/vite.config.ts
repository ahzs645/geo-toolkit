import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Ordinary package resolution: no PG Maps source aliases or data preparation.
// The one alias is what any Vite app on MapLibre 6 needs: it locates MapLibre's
// worker (see src/maplibre-gl-entry.ts). Keep it exact so `maplibre-gl/dist/...`
// still reaches the package.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^maplibre-gl$/, replacement: fileURLToPath(new URL('./src/maplibre-gl-entry.ts', import.meta.url)) },
    ],
  },
  css: { postcss: { plugins: [] } },
  build: { outDir: 'dist' },
})
