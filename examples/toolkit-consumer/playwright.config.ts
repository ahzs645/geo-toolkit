import { defineConfig } from '@playwright/test'

const externalBaseURL = process.env.PGMAPS_E2E_BASE_URL

export default defineConfig({
  testDir: './tests',
  workers: 1,
  reporter: 'list',
  expect: { timeout: 15_000 },
  use: {
    baseURL: externalBaseURL ?? 'http://127.0.0.1:42174',
    launchOptions: {
      ...(process.env.PGMAPS_PLAYWRIGHT_EXECUTABLE_PATH
        ? { executablePath: process.env.PGMAPS_PLAYWRIGHT_EXECUTABLE_PATH }
        : {}),
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-sandbox'],
    },
  },
  webServer: externalBaseURL
    ? undefined
    : {
        command: 'npm run dev -- --port 42174 --strictPort',
        url: 'http://127.0.0.1:42174',
        reuseExistingServer: false,
        timeout: 60_000,
      },
})
