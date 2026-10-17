import { defineConfig } from 'vitest/config';
// Firestore 보안 규칙 테스트 — Firebase 에뮬레이터가 필요 (npm run test:rules)
export default defineConfig({
  test: { include: ['tests/rules/**/*.test.ts'], environment: 'node', testTimeout: 20000, fileParallelism: false },
});
