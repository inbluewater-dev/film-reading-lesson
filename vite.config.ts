import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    // GitHub Pages는 /저장소이름/ 아래에서 서비스됨 (개발 서버에서는 '/')
    base: mode === 'production' ? env.VITE_BASE || '/film-reading-lesson/' : '/',
  };
});
