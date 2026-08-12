import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: globalThis.process?.env?.CI ? 2 : 1,
  retries: globalThis.process?.env?.CI ? 2 : 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: globalThis.process?.env?.CI ? 'retain-on-failure' : 'off',
  },
  projects: [
    { name: 'desktop-chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome' } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'], channel: 'chrome' } },
  ],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1',
    env: { VITE_REALTIME_ENABLED: 'false' },
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !globalThis.process?.env?.CI,
    timeout: 120000,
  },
});
