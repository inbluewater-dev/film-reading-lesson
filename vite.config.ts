import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // 체험판: 로컬 모드 + AI 샘플 모드, HTML 파일 하나로 묶어 어디서나 열 수 있게 한다
  if (mode === 'demo') {
    return {
      plugins: [react(), viteSingleFile()],
      base: './',
      define: {
        'import.meta.env.VITE_DATA_MODE': JSON.stringify('local'),
        'import.meta.env.VITE_AI_MODE': JSON.stringify('mock'),
        'import.meta.env.VITE_DEMO': JSON.stringify('true'),
        'import.meta.env.VITE_ROUTER': JSON.stringify(process.env.DEMO_ROUTER ?? 'memory'),
      },
      resolve: {
        alias: [{ find: /^\.\/firebase\/firebaseBackend$/, replacement: fileURLToPath(new URL('./src/lib/data/firebase/firebaseStub.ts', import.meta.url)) }],
      },
      build: { outDir: 'dist-demo' },
    };
  }
  return {
    plugins: [react()],
    // GitHub Pages는 /저장소이름/ 아래에서 서비스됨 (개발 서버에서는 '/')
    base: mode === 'production' ? env.VITE_BASE || '/film-reading-lesson/' : '/',
  };
});
