import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  globalSetup: './global-setup.ts',
  testDir: './tests',
  timeout: 30_000,
  retries: 0,
  workers: 1,
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    video: 'on-first-retry',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },

  /* Visual comparison settings for screenshot-based tests.
   *
   * threshold: Pixel-level colour tolerance expressed as a ratio (0 = exact,
   *   1 = anything passes). 0.2 means individual pixel colours may differ by
   *   up to 20 %, which absorbs anti-aliasing and sub-pixel rendering
   *   differences across platforms without hiding real regressions.
   *
   * maxDiffPixels: Maximum number of pixels that may differ before the
   *   comparison fails. 100 px is generous enough for font hinting / OS
   *   rendering variance while still catching layout shifts and missing
   *   elements.
   */
  expect: {
    toHaveScreenshot: {
      threshold: 0.2,
      maxDiffPixels: 100,
    },
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
})
