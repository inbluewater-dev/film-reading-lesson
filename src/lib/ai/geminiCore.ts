// Gemini 공급자의 핵심 로직 (SDK와 분리해 단위 테스트할 수 있게): 프롬프트 채우기 → JSON 스키마 강제 생성 → zod 검증 → 1회 재시도 → 안전 보정
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { ZodType } from 'zod';
import { AppError, type PromptKind } from '../data/types';
import { DEFAULT_PROMPTS, renderPrompt } from './prompts';
import { filmVars, lessonPlanVars, materialVars, strategyVars } from './promptVars';
import {
  FilmSuggestionResult,
  LessonPlanResult,
  MaterialResult,
  StrategyReasonResult,
  type AiProvider,
  type CurriculumContext,
  type LessonPlanRequest,
  type MaterialRequest,
  type StrategyReasonRequest,
} from './types';

/** 모델 한 번 호출: 프롬프트와 JSON 스키마를 받아 응답 텍스트를 돌려준다 */
export type GenerateFn = (input: { model: string; prompt: string; jsonSchema: Record<string, unknown> }) => Promise<string>;

export interface GeminiDeps {
  generate: GenerateFn;
  /** 관리자 설정의 모델 이름 */
  model: () => Promise<string>;
  /** 관리자가 고친 프롬프트 템플릿 (없으면 기본값) */
  template: (kind: PromptKind) => Promise<string>;
}

export const DEFAULT_MODEL = 'gemini-3.8-flash';
export const AI_NOTE = 'AI 생성 자료입니다. 사용 전 교사가 사실·범위·표현을 검토하세요.';
const FILM_CAUTION = '제목·감독·연도 등 사실 정보를 반드시 확인한 뒤 쓰세요.';

/** zod 스키마 → Gemini responseJsonSchema ($schema 등 메타 키 제거) */
export function jsonSchemaOf(schema: ZodType): Record<string, unknown> {
  const s = zodToJsonSchema(schema, { $refStrategy: 'none', target: 'jsonSchema7' }) as Record<string, unknown>;
  delete s.$schema;
  delete s.definitions;
  return s;
}

const SCHEMAS = {
  material: jsonSchemaOf(MaterialResult),
  films: jsonSchemaOf(FilmSuggestionResult),
  strategies: jsonSchemaOf(StrategyReasonResult),
  lessonPlan: jsonSchemaOf(LessonPlanResult),
} as const;

/** 오류를 화면용 한국어 메시지로 */
export function aiError(e: unknown): AppError {
  if (e instanceof AppError) return e;
  const msg = String((e as { message?: string })?.message ?? e);
  if (/429|quota|RESOURCE_EXHAUSTED|rate/i.test(msg)) return new AppError('unavailable', 'AI 무료 사용량이 잠시 다 찼습니다. 1~2분 뒤 다시 시도하세요. 계속되면 관리자에게 알려 주세요.');
  if (/app.?check|403|PERMISSION_DENIED|API key/i.test(msg)) return new AppError('unavailable', 'AI 서비스 연결이 허용되지 않았습니다. 관리자에게 Firebase AI Logic·App Check 설정을 확인해 달라고 하세요.');
  if (/SAFETY|blocked/i.test(msg)) return new AppError('unavailable', 'AI가 안전 기준 때문에 답하지 않았습니다. 추가 요청이나 영화를 바꿔 다시 시도하세요.');
  if (/network|fetch|offline/i.test(msg)) return new AppError('unavailable', '인터넷 연결을 확인한 뒤 다시 시도하세요.');
  return new AppError('unavailable', 'AI가 응답하지 못했습니다. 잠시 뒤 다시 시도하세요.');
}

export class GeminiCore implements AiProvider {
  /** 기록용 모델 이름 (첫 호출 전에는 기본값) */
  model = DEFAULT_MODEL;

  constructor(private deps: GeminiDeps) {}

  /** 생성 → 파싱·검증, 형식이 틀리면 한 번 더 (가이드 §8.2) */
  private async run<T>(kind: PromptKind, vars: Record<string, string | number | null | undefined>, schema: ZodType<T>): Promise<T> {
    this.model = await this.deps.model();
    const body = (await this.deps.template(kind).catch(() => DEFAULT_PROMPTS[kind])) || DEFAULT_PROMPTS[kind];
    const prompt = renderPrompt(body, vars);
    let lastIssue = '';
    for (let attempt = 0; attempt < 2; attempt++) {
      let text: string;
      try {
        text = await this.deps.generate({ model: this.model, prompt: attempt === 0 ? prompt : `${prompt}\n\n[주의] 이전 응답이 JSON 스키마에 맞지 않았습니다(${lastIssue}). 스키마에 맞는 JSON만 출력하세요.`, jsonSchema: SCHEMAS[kind] });
      } catch (e) {
        throw aiError(e);
      }
      try {
        const parsed = schema.safeParse(JSON.parse(stripFence(text)));
        if (parsed.success) return parsed.data;
        lastIssue = parsed.error.issues.slice(0, 3).map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      } catch {
        lastIssue = 'JSON이 아님';
      }
    }
    throw new AppError('unavailable', 'AI 응답 형식이 맞지 않아 두 번 시도했지만 실패했습니다. 다시 눌러 주세요.');
  }

  async generateMaterial(input: MaterialRequest) {
    const r = await this.run('material', materialVars(input), MaterialResult);
    // 정렬 정보는 AI 말을 믿지 않고 고른 교육과정으로 채운다, 검토 안내는 항상 붙인다
    return { ...r, alignment: { nodeIds: input.context.nodeIds, standardCodes: input.context.standards.map((s) => s.code) }, sourceNote: r.sourceNote.includes('검토') ? r.sourceNote : `${r.sourceNote ? r.sourceNote + ' ' : ''}${AI_NOTE}` };
  }

  async suggestFilms(input: { context: CurriculumContext; count: number }) {
    const r = await this.run('films', filmVars(input), FilmSuggestionResult);
    return { suggestions: r.suggestions.slice(0, input.count).map((s) => ({ ...s, caution: s.caution.includes('확인') ? s.caution : `${s.caution} ${FILM_CAUTION}`.trim() })) };
  }

  async explainStrategies(input: StrategyReasonRequest) {
    const r = await this.run('strategies', strategyVars(input), StrategyReasonResult);
    // 후보에 없는 전략 ID는 버린다
    const ids = new Set(input.candidates.map((c) => c.id));
    return { reasons: Object.fromEntries(Object.entries(r.reasons).filter(([id]) => ids.has(id))) };
  }

  async generateLessonPlan(input: LessonPlanRequest) {
    const r = await this.run('lessonPlan', lessonPlanVars(input), LessonPlanResult);
    // 사태 순서는 뼈대 기준으로 맞춘다 (AI가 순서를 바꿔도 칸이 섞이지 않게)
    const events = input.events.map((e) => r.events.find((x) => x.seq === e.seq) ?? { seq: e.seq, teacherActivity: '', studentActivity: '', material: '', assessment: '' });
    return { ...r, events };
  }
}

function stripFence(t: string): string {
  return t.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
}
