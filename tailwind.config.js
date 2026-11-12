import plugin from 'tailwindcss/plugin'
import { toolkitTheme, touchVariant } from './src/tailwind-theme.mjs'

/** @type {import('tailwindcss').Config} */
export default {
  important: '.geo-toolkit',
  corePlugins: { preflight: false },
  darkMode: ['variant', '@scope (.geo-toolkit.dark, .geo-toolkit[data-theme="dark"]) to (.geo-toolkit) { & }'],
  content: ['./src/**/*.{js,ts,jsx,tsx,mjs}'],
  // Token names live in src/tailwind-theme.mjs, which hosts extend too.
  theme: { extend: toolkitTheme },
  plugins: [
    touchVariant,
    plugin(({ addVariant }) => {
      // Stop at nested workspaces so each embed can choose its own layout.
      for (const mode of ['mobile', 'desktop', 'wide', 'sm', 'max-sm', 'large']) {
        addVariant(`workspace-${mode}`, `@scope (.geo-toolkit[data-workspace-${mode}="true"]) to (.geo-toolkit) { & }`)
      }
    }),
  ],
}
