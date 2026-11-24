import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  // Keep interactive diagram tests responsive while running both viewport projects.
  workers: 4,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4173/HUS_learning_HUB/', trace: 'retain-on-failure' },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: {
          cookies: [],
          origins: [
            {
              origin: 'http://127.0.0.1:4173',
              localStorage: [
                { name: 'hus-learning-hub:webmcp-notice-ack:v1', value: '1' },
                { name: 'hus-learning-hub:ai-onboarding-ack:v1', value: '1' },
              ],
            },
          ],
        },
      },
    },
    {
      name: 'mobile',
      use: {
        ...devices['iPhone 13'],
        defaultBrowserType: 'chromium',
        storageState: {
          cookies: [],
          origins: [
            {
              origin: 'http://127.0.0.1:4173',
              localStorage: [
                { name: 'hus-learning-hub:small-screen-ack:v1', value: '1' },
                { name: 'hus-learning-hub:webmcp-notice-ack:v1', value: '1' },
                { name: 'hus-learning-hub:ai-onboarding-ack:v1', value: '1' },
              ],
            },
          ],
        },
      },
    },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --base=/HUS_learning_HUB/ --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173/HUS_learning_HUB/',
    reuseExistingServer: false,
    timeout: 120000,
  },
});
