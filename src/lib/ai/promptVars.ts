// 요청 → 프롬프트 자리 값 (관리자 화면 미리보기, Phase 9 Gemini 호출에서 함께 쓴다)
import type { PromptKind } from '../data/types';
import type { CurriculumContext, LessonPlanRequest, MaterialRequest, StrategyReasonRequest } from './types';

const join = (xs: string[], sep = ' / ') => xs.filter(Boolean).join(sep);
const standards = (c: CurriculumContext) => join(c.standards.map((s) => `${s.code} ${s.text}`));
const notes = (c: CurriculumContext) => join(c.areas.flatMap((a) => a.applicationNotes), ' ');

/** 출력 형식 안내 (응답 검증은 zod 스키마가 한다) */
export const SCHEMA_HINT: Record<PromptKind, string> = {
  material: '{"title":"","blocks":[{"kind":"paragraph","text":""}|{"kind":"table","caption":"","columns":[""],"rows":[[""]]}],"glossary":[{"term":"","meaning":""}],"comprehensionQuestions":[{"level":"기본|중간|심화","question":""}],"sourceNote":"","alignment":{"nodeIds":[""],"standardCodes":[""]}}',
  films: '{"suggestions":[{"title":"","reason":"","caution":""}]}',
  strategies: '{"reasons":{"전략ID":"이유 한 문장"}}',
  lessonPlan: '{"overview":"","events":[{"seq":1,"teacherActivity":"","studentActivity":"","material":"","assessment":""}],"rubric":[{"criterion":"","high":"","mid":"","low":""}],"worksheet":[""]}',
};

export function materialVars(r: MaterialRequest) {
  const c = r.context;
  const p = r.params;
  return {
    과목: c.subjectLabel,
    과목구분: c.courseCategory,
    영역: join(c.areas.map((a) => a.label)),
    핵심아이디어: join(c.coreIdeas, ' '),
    성취기준: standards(c),
    성취기준해설: join(c.standards.flatMap((s) => s.explanations), ' '),
    고려사항: notes(c),
    내용요소: join(c.elements.map((e) => e.label), ', '),
    영화: join(p.films.filter((f) => f.confirmed).map((f) => f.title), ', '),
    텍스트유형: join([r.textTypeLabels.source, r.textTypeLabels.structure, r.textTypeLabels.format, r.textTypeLabels.content]),
    분량: p.length,
    수준: p.level,
    학년: p.grade ? `${p.grade}학년` : null,
    추가요청: p.extra,
    스키마: SCHEMA_HINT.material,
  };
}

export function filmVars(r: { context: CurriculumContext; count: number }) {
  return { 과목: r.context.subjectLabel, 성취기준: standards(r.context), 고려사항: notes(r.context), 개수: r.count, 스키마: SCHEMA_HINT.films };
}

export function strategyVars(r: StrategyReasonRequest) {
  return {
    읽기자료: r.materialTitle,
    성취기준: standards(r.context),
    후보: join(r.candidates.map((c) => `${c.id} ${c.label}(기능: ${c.functionLabels.join(', ')}; 근거: ${c.matched.join(', ')})`), '\n'),
    스키마: SCHEMA_HINT.strategies,
  };
}

export function lessonPlanVars(r: LessonPlanRequest) {
  return {
    과목: r.context.subjectLabel,
    성취기준: standards(r.context),
    학습목표: join(r.objectives),
    읽기자료: `${r.materialTitle} — ${r.materialSummary}`,
    수업시간: r.minutes,
    전략: join(r.strategies.map((s) => `${s.label}(${s.phase})${s.procedure.length ? ': ' + s.procedure.join(' → ') : ''}`)),
    사태: join(r.events.map((e) => `${e.seq}.${e.label}[${e.phase}, ${e.minutes}분${e.strategyLabels.length ? ', 전략: ' + e.strategyLabels.join(', ') : ''}]`), '\n'),
    고려사항: notes(r.context),
    스키마: SCHEMA_HINT.lessonPlan,
  };
}
