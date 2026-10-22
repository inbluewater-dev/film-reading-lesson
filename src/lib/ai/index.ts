// AI 진입점 — VITE_AI_MODE에 따라 Mock 또는 Gemini(Phase 9)를 돌려준다
import { config } from '../config';
import { MockProvider } from './mockProvider';
import type { AiProvider } from './types';

let provider: AiProvider | null = null;
export function getAi(): AiProvider {
  if (!provider) {
    if (config.aiMode === 'gemini') throw new Error('Gemini 연결은 Phase 9에서 준비됩니다. 지금은 VITE_AI_MODE=mock 으로 사용하세요.');
    provider = new MockProvider();
  }
  return provider;
}
