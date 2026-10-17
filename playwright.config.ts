import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: 'test-results',
  use: { baseURL: 'http://localhost:5173', locale: 'ko-KR', viewport: { width: 1280, height: 800 } },
  webServer: { command: 'npm run dev -- --port 5173 --strictPort', port: 5173, reuseExistingServer: true },
});
