// AI 진입점 — VITE_AI_MODE=mock(기본)은 고정 샘플, gemini는 Firebase 모드가 등록한 Gemini 공급자
import { config } from '../config';
import { MockProvider } from './mockProvider';
import type { AiProvider } from './types';

let provider: AiProvider | null = null;

/** Firebase 모드 백엔드가 Gemini 공급자를 등록한다 */
export function registerAi(p: AiProvider) {
  provider = p;
}

export function getAi(): AiProvider {
  if (provider) return provider;
  if (config.aiMode === 'gemini') throw new Error('실제 AI(Gemini)는 Firebase 모드(VITE_DATA_MODE=firebase)에서만 쓸 수 있습니다. 설정을 확인하세요.');
  provider = new MockProvider();
  return provider;
}
