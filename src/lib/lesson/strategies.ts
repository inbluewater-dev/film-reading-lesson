// 독서전략 추천 (가이드 §8.4) — 규칙 기반 점수화. AI는 추천 이유 문장만 다듬는다.
import type { Catalog, ReadingPhase } from '../catalog/catalog';
import type { FunctionSource } from '../ttl/compile';
import type { StandardNode } from '../validation/schemas';
import { strategyWindow } from './timing';

export interface StandardFunctions {
  standard: StandardNode;
  functionIds: string[];
  source: FunctionSource;
}

export interface StrategyCandidate {
  id: string;
  label: string;
  score: number;
  /** 점수 근거 (화면 표시용) */
  matched: string[];
  functionIds: string[];
  phases: ReadingPhase[];
  reviewStatus: 'draft' | 'reviewed';
}

export interface RecommendInput {
  standards: StandardNode[];
  /** 교사가 직접 고른 독서 기능 */
  chosenFunctionIds: string[];
  textTypeIds: string[];
  minutes: 50 | 100;
}

export interface Recommendation {
  perStandard: StandardFunctions[];
  /** 추천에 쓰인 독서 기능 (성취기준에서 온 것 + 교사가 고른 것) */
  targetFunctionIds: string[];
  /** 성취기준에서 기능을 하나도 얻지 못해 교사의 선택이 필요한가 */
  needsTeacherChoice: boolean;
  candidates: StrategyCandidate[];
}

export const SCORE = { function: 3, textType: 2, time: 1, reviewed: 1 } as const;

export function recommendStrategies(catalog: Catalog, input: RecommendInput, limit = 5): Recommendation {
  const perStandard = input.standards.map((standard) => ({ standard, ...catalog.functionsFor(standard) }));
  const fromStandards = perStandard.flatMap((p) => p.functionIds);
  const targetFunctionIds = [...new Set([...fromStandards, ...input.chosenFunctionIds])];
  const window = strategyWindow(input.minutes);

  // 같은 점수일 때의 순서: 대상 기능이 readstrategy.ttl에서 나열한 순서
  const rankInFunctions = new Map<string, number>();
  targetFunctionIds.forEach((fid, fi) =>
    (catalog.reading.functions.find((f) => f.id === fid)?.strategyIds ?? []).forEach((sid, si) => {
      const r = fi * 1000 + si;
      if (!rankInFunctions.has(sid) || r < rankInFunctions.get(sid)!) rankInFunctions.set(sid, r);
    }),
  );
  const scored: { c: StrategyCandidate; hits: number; order: number }[] = [];
  catalog.reading.strategies.forEach((s, i) => {
    const order = rankInFunctions.get(s.id) ?? 1_000_000 + i;
    const fnHit = s.functionIds.filter((f) => targetFunctionIds.includes(f));
    const textHit = s.suitableTextTypeIds.filter((t) => input.textTypeIds.includes(t));
    if (fnHit.length === 0 && textHit.length === 0) return; // 후보 = 기능 일치 ∪ 텍스트 유형 일치
    const matched: string[] = [];
    let score = 0;
    if (fnHit.length) {
      score += SCORE.function;
      matched.push(`독서 기능 ${fnHit.map((f) => catalog.functionLabel(f)).join('·')}`);
    }
    if (textHit.length) {
      score += SCORE.textType;
      matched.push(`텍스트 유형 ${textHit.map((t) => catalog.textTypes.types.find((x) => x.id === t)?.label ?? t).join('·')}`);
    }
    if (s.minutes !== null && s.minutes <= window) {
      score += SCORE.time;
      matched.push(`소요 ${s.minutes}분`);
    }
    if (s.reviewStatus === 'reviewed') {
      score += SCORE.reviewed;
      matched.push('검수 완료');
    }
    const c: StrategyCandidate = {
      id: s.id,
      label: s.label,
      score,
      matched,
      functionIds: s.functionIds,
      phases: knownPhases(s.functionIds.map((f) => catalog.readingPhaseOf(f))),
      reviewStatus: s.reviewStatus,
    };
    scored.push({ c, hits: fnHit.length, order });
  });
  // 점수 → 겹치는 기능 수 → 기능별 나열 순서
  const ranked = scored.sort((a, b) => b.c.score - a.c.score || b.hits - a.hits || a.order - b.order).map((x) => x.c);
  return { perStandard, targetFunctionIds, needsTeacherChoice: fromStandards.length === 0, candidates: ranked.slice(0, limit) };
}

/** 읽기 단계 목록 — 정해진 단계가 하나라도 있으면 ‘미분류’는 뺀다 */
function knownPhases(ps: ReadingPhase[]): ReadingPhase[] {
  const u = [...new Set(ps)];
  const known = u.filter((p) => p !== 'unset');
  return known.length ? known : u;
}
