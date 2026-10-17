// 실행 모드 설정 — .env.local 의 값으로 전환 (README 참고)
export type DataMode = 'local' | 'firebase';
export type AiMode = 'mock' | 'gemini';

function pick<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly string[]).includes(value ?? '') ? (value as T) : fallback;
}

export const config = {
  dataMode: pick<DataMode>(import.meta.env.VITE_DATA_MODE, ['local', 'firebase'], 'local'),
  aiMode: pick<AiMode>(import.meta.env.VITE_AI_MODE, ['mock', 'gemini'], 'mock'),
} as const;
