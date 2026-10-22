// 실행 모드 설정 — .env.local 의 값으로 전환 (README 참고)
export type DataMode = 'local' | 'firebase';
export type AiMode = 'mock' | 'gemini';

function pick<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly string[]).includes(value ?? '') ? (value as T) : fallback;
}

export const config = {
  dataMode: pick<DataMode>(import.meta.env.VITE_DATA_MODE, ['local', 'firebase'], 'local'),
  aiMode: pick<AiMode>(import.meta.env.VITE_AI_MODE, ['mock', 'gemini'], 'mock'),
  /** 체험판 빌드(npm run build:demo) — 로그인 화면에 체험용 계정을 보여준다 */
  demo: import.meta.env.VITE_DEMO === 'true' || import.meta.env.DEV,
  /** 체험판 페이지는 주소(#/경로)를 쓰지 않는다 */
  memoryRouter: import.meta.env.VITE_ROUTER === 'memory',
} as const;
