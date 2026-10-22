// AI 어댑터 인터페이스 (가이드 §8.2). 화면은 이 인터페이스만 쓰고, Mock(오프라인)과 Gemini(실서비스)가 같은 형태로 응답한다.
import { z } from 'zod';

// ---------------------------------------------------------------- 공통 입력: 고른 교육과정 맥락
export interface CurriculumContext {
  subjectLabel: string;
  courseCategory: string;
  areas: { label: string; description: string | null; applicationNotes: string[] }[];
  coreIdeas: string[];
  standards: { id: string; code: string; text: string; explanations: string[]; targetVerb: string }[];
  elements: { label: string; kind: 'knowledge' | 'process' | 'value' }[];
  nodeIds: string[];
}

export interface FilmChoice {
  title: string;
  /** teacher = 교사가 입력, ai = AI 추천 */
  source: 'teacher' | 'ai';
  /** AI 추천은 교사가 사실 확인 후 true로 바꿔야 쓸 수 있다 (가이드 §8.3) */
  confirmed: boolean;
  reason?: string;
}

export interface MaterialParams {
  grade: 1 | 2 | 3 | null;
  length: 400 | 600 | 800;
  level: '쉬움' | '보통' | '도전';
  /** text.ttl 속성 ID: 자료·조직과 탐색·체재·유형 각 1개 */
  textType: { source: string; structure: string; format: string; content: string };
  minutes: 50 | 100;
  films: FilmChoice[];
  extra: string;
}

export interface MaterialRequest {
  context: CurriculumContext;
  params: MaterialParams;
  /** 화면에 보여줄 텍스트 유형 라벨 (프롬프트에 사용) */
  textTypeLabels: { source: string; structure: string; format: string; content: string };
}

// ---------------------------------------------------------------- 출력 스키마 (가이드 §8.3: JSON 스키마 강제 + zod 검증)
export const MaterialBlock = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('paragraph'), text: z.string().min(1) }),
  z.object({
    kind: z.literal('table'),
    caption: z.string(),
    columns: z.array(z.string()).min(1),
    rows: z.array(z.array(z.string())),
  }),
]);
export const MaterialResult = z.object({
  title: z.string().min(1),
  blocks: z.array(MaterialBlock).min(1),
  glossary: z.array(z.object({ term: z.string().min(1), meaning: z.string() })),
  comprehensionQuestions: z.array(z.object({ level: z.enum(['기본', '중간', '심화']), question: z.string().min(1) })).min(3).max(5),
  sourceNote: z.string(),
  alignment: z.object({ nodeIds: z.array(z.string()), standardCodes: z.array(z.string()) }),
});
export type MaterialBlock = z.infer<typeof MaterialBlock>;
export type MaterialResult = z.infer<typeof MaterialResult>;

export const FilmSuggestion = z.object({ title: z.string().min(1), reason: z.string(), caution: z.string() });
export const FilmSuggestionResult = z.object({ suggestions: z.array(FilmSuggestion).min(1).max(6) });
export type FilmSuggestionResult = z.infer<typeof FilmSuggestionResult>;

// ---------------------------------------------------------------- 독서전략 추천 이유 (가이드 §8.4 — 점수화는 규칙 기반, AI는 이유 문장만)
export interface StrategyReasonRequest {
  context: CurriculumContext;
  materialTitle: string;
  candidates: { id: string; label: string; functionLabels: string[]; matched: string[] }[];
}
export const StrategyReasonResult = z.object({ reasons: z.record(z.string(), z.string()) });
export type StrategyReasonResult = z.infer<typeof StrategyReasonResult>;

// ---------------------------------------------------------------- 수업지도안 (가이드 §8.5 — 뼈대는 규칙 기반, AI는 활동 문장·발문·준거만)
export interface LessonPlanRequest {
  context: CurriculumContext;
  materialTitle: string;
  materialSummary: string;
  minutes: 50 | 100;
  objectives: string[];
  strategies: { id: string; label: string; procedure: string[]; phase: string }[];
  events: { seq: number; label: string; phase: '도입' | '전개' | '정리'; minutes: number; strategyLabels: string[]; referenceStrategies: string[] }[];
}
export const LessonEventFill = z.object({
  seq: z.number().int().min(1).max(9),
  teacherActivity: z.string(),
  studentActivity: z.string(),
  material: z.string(),
  assessment: z.string(),
});
export const LessonPlanResult = z.object({
  overview: z.string(),
  events: z.array(LessonEventFill).length(9),
  rubric: z.array(z.object({ criterion: z.string().min(1), high: z.string(), mid: z.string(), low: z.string() })).min(1),
  worksheet: z.array(z.string()),
});
export type LessonPlanResult = z.infer<typeof LessonPlanResult>;

export interface AiProvider {
  readonly model: string;
  generateMaterial(input: MaterialRequest): Promise<MaterialResult>;
  suggestFilms(input: { context: CurriculumContext; count: number }): Promise<FilmSuggestionResult>;
  explainStrategies(input: StrategyReasonRequest): Promise<StrategyReasonResult>;
  generateLessonPlan(input: LessonPlanRequest): Promise<LessonPlanResult>;
}
