import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: 'test-results',
  use: { baseURL: 'http://localhost:5173', locale: 'ko-KR', viewport: { width: 1280, height: 800 },
    // 로캘이 없는 리눅스 컨테이너에서도 한글 파일 이름으로 내려받기되게
    launchOptions: { env: { ...process.env, LANG: process.env.LANG || 'C.UTF-8' } },
  },
  webServer: { command: 'npm run dev -- --port 5173 --strictPort', port: 5173, reuseExistingServer: true },
});
