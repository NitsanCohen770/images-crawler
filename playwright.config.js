import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './src/__tests__',
  timeout: 30000,
  retries: 2,
  use: {
    headless: false,
    viewport: { width: 1280, height: 720 },
    actionTimeout: 10000,
  },
});
