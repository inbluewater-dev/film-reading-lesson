// Gemini 공급자 — Firebase AI Logic(Gemini Developer API, 무료 등급으로 시작). 키를 앱에 넣지 않는다 (가이드 §8.1 ①)
// ⚠ 실제 Firebase 프로젝트로 시험해야 한다 (docs/SETUP_Firebase.md)
import type { FirebaseApp } from 'firebase/app';
import { getAI, getGenerativeModel, GoogleAIBackend } from 'firebase/ai';
import type { PromptKind, PromptService, AiSettings } from '../data/types';
import { DEFAULT_MODEL, GeminiCore } from './geminiCore';

export function createGeminiProvider(app: FirebaseApp, settings: () => Promise<AiSettings>, prompts: PromptService): GeminiCore {
  const ai = getAI(app, { backend: new GoogleAIBackend() });
  let templates: Promise<Map<PromptKind, string>> | null = null;
  return new GeminiCore({
    model: async () => (await settings().catch(() => null))?.model || DEFAULT_MODEL,
    template: async (kind) => {
      // 세션당 한 번 읽는다 (관리자가 바꾸면 새로 고침 후 반영)
      templates ??= prompts.list().then((l) => new Map(l.map((t) => [t.kind, t.body])));
      return (await templates).get(kind) ?? '';
    },
    generate: async ({ model, prompt, jsonSchema }) => {
      const m = getGenerativeModel(ai, { model, generationConfig: { responseMimeType: 'application/json', responseJsonSchema: jsonSchema, temperature: 0.7 } });
      const res = await m.generateContent(prompt);
      return res.response.text();
    },
  });
}
