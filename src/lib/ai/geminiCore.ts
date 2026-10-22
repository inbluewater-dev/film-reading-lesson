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
  /** 기다리기 (테스트에서 바꿔 끼움) */
  sleep?: (ms: number) => Promise<void>;
}

/** 고른 모델이 붐비거나 잠시 안 될 때 차례로 써 볼 모델 (2026-10 무료 등급 안정 모델) */
export const FALLBACK_MODELS = ['gemini-3.6-flash', 'gemini-3.5-flash-lite'];

/** 잠시 뒤 다시 하면 될 수 있는 오류 (서버 과부하·일시 장애) */
export function isTransient(e: unknown): boolean {
  const msg = String((e as { message?: string })?.message ?? e);
  return /\b(500|502|503|504)\b|UNAVAILABLE|overloaded|high demand|INTERNAL|DEADLINE_EXCEEDED/i.test(msg);
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

/** 오류를 화면용 한국어 메시지로 — 원인을 찾을 수 있게 원래 오류 내용을 짧게 붙인다 */
export function aiError(e: unknown): AppError {
  if (e instanceof AppError) return e;
  const msg = String((e as { message?: string })?.message ?? e);
  console.error('[AI 오류]', e);
  const detail = ` (오류 내용: ${msg.replace(/\s+/g, ' ').slice(0, 220)})`;
  const err = (text: string) => new AppError('unavailable', text + detail);
  if (/\b429\b|RESOURCE_EXHAUSTED|quota exceeded|exceeded your current quota|rate.?limit/i.test(msg)) return err('AI 무료 사용량이 잠시 다 찼습니다. 1~2분 뒤 다시 시도하세요. 계속되면 관리자에게 알려 주세요.');
  if (/\b404\b|NOT_FOUND|not found for API version|is not supported for generateContent/i.test(msg)) return err('AI 모델을 찾을 수 없습니다. 관리자 › 사용 현황에서 다른 모델을 골라 보세요.');
  if (/app.?check|\b403\b|PERMISSION_DENIED|API key|api-not-enabled|has not been used|is disabled|SERVICE_DISABLED/i.test(msg)) return err('AI 서비스 연결이 허용되지 않았습니다. Firebase 콘솔에서 AI Logic(Gemini Developer API)이 켜져 있는지, App Check 설정을 확인하세요.');
  if (isTransient(e)) return err('AI 서버가 지금 붐빕니다. 잠시 뒤 다시 시도하세요. 계속되면 관리자 › 사용 현황에서 다른 모델을 골라 보세요.');
  if (/SAFETY|blocked/i.test(msg)) return err('AI가 안전 기준 때문에 답하지 않았습니다. 추가 요청이나 영화를 바꿔 다시 시도하세요.');
  if (/network|failed to fetch|offline/i.test(msg)) return err('인터넷 연결을 확인한 뒤 다시 시도하세요.');
  return err('AI가 응답하지 못했습니다. 잠시 뒤 다시 시도하세요.');
}

export class GeminiCore implements AiProvider {
  /** 기록용 모델 이름 (첫 호출 전에는 기본값) */
  model = DEFAULT_MODEL;

  constructor(private deps: GeminiDeps) {}

  /** 붐빔·일시 장애면 같은 모델로 한 번 더, 그래도 안 되면 다음 모델로 (모델을 바꿔 성공하면 this.model에 기록) */
  private async callWithFallback(prompt: string, jsonSchema: Record<string, unknown>): Promise<string> {
    const sleep = this.deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
    const chosen = this.model;
    const models = [chosen, ...FALLBACK_MODELS.filter((m) => m !== chosen)];
    let last: unknown;
    for (const model of models) {
      for (let tryNo = 0; tryNo < 2; tryNo++) {
        try {
          const text = await this.deps.generate({ model, prompt, jsonSchema });
          this.model = model;
          return text;
        } catch (e) {
          last = e;
          if (!isTransient(e)) throw aiError(e);
          if (tryNo === 0) await sleep(1500);
        }
      }
    }
    throw aiError(last);
  }

  /** 생성 → 파싱·검증, 형식이 틀리면 한 번 더 (가이드 §8.2) */
  private async run<T>(kind: PromptKind, vars: Record<string, string | number | null | undefined>, schema: ZodType<T>): Promise<T> {
    this.model = await this.deps.model();
    const body = (await this.deps.template(kind).catch(() => DEFAULT_PROMPTS[kind])) || DEFAULT_PROMPTS[kind];
    const prompt = renderPrompt(body, vars);
    let lastIssue = '';
    for (let attempt = 0; attempt < 2; attempt++) {
      const text = await this.callWithFallback(attempt === 0 ? prompt : `${prompt}\n\n[주의] 이전 응답이 JSON 스키마에 맞지 않았습니다(${lastIssue}). 스키마에 맞는 JSON만 출력하세요.`, SCHEMAS[kind]);
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
