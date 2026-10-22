import { describe, expect, it } from 'vitest';
import { BUNDLED_SOURCE } from '../../src/lib/catalog/bundled';
import { Catalog, EMPTY_OVERRIDES } from '../../src/lib/catalog/catalog';
import { recommendStrategies, SCORE } from '../../src/lib/lesson/strategies';
import { DEFAULT_MINUTES, strategyWindow, sum } from '../../src/lib/lesson/timing';
import type { StandardNode } from '../../src/lib/validation/schemas';

const cat = new Catalog(BUNDLED_SOURCE, EMPTY_OVERRIDES);
const std = (c: Catalog, code: string) => c.standards().find((s) => s.standardCode === code) as StandardNode;
const base = { chosenFunctionIds: [] as string[], textTypeIds: ['tx:SingleText', 'tx:StaticText', 'tx:ContinuousText', 'tx:Exposition'], minutes: 50 as const };

describe('기본 시간 배분', () => {
  it('50분·100분 합계가 수업 시간과 같다', () => {
    expect(sum(DEFAULT_MINUTES[50])).toBe(50);
    expect(sum(DEFAULT_MINUTES[100])).toBe(100);
    expect(strategyWindow(50)).toBe(29);
  });
});

describe('독서전략 추천 (§8.4)', () => {
  it('‘이해하다’ 성취기준 → 이해 기능 전략이 기능 일치 점수(3)로 추천된다', () => {
    const r = recommendStrategies(cat, { ...base, standards: [std(cat, '[12영이01-03]')] });
    expect(r.targetFunctionIds).toEqual(['rs:Func_Understanding']);
    expect(r.needsTeacherChoice).toBe(false);
    expect(r.candidates).toHaveLength(5);
    expect(r.candidates.every((c) => c.score === SCORE.function && c.functionIds.includes('rs:Func_Understanding'))).toBe(true);
    expect(r.candidates[0].label).toBe('단어의 나무'); // 같은 점수면 원래 순서
  });
  it('‘탐구하다’만 고르면 교사가 기능을 골라야 하고, 고르면 그 기능 전략이 나온다', () => {
    const s = std(cat, '[12영감01-01]');
    const r = recommendStrategies(cat, { ...base, standards: [s] });
    expect(r.needsTeacherChoice).toBe(true);
    expect(r.candidates).toEqual([]);
    const r2 = recommendStrategies(cat, { ...base, standards: [s], chosenFunctionIds: ['rs:Func_Evaluation'] });
    expect(r2.candidates.map((c) => c.label)).toEqual(['오류 찾기', '참/거짓 가리기', '대립 척도표', '상호텍스트 전략', '복식 기재 일지']);
    expect(r2.candidates[0].phases).toEqual(['after']);
  });
  it('두 기능에 걸친 전략이 같은 점수에서 앞선다', () => {
    const r = recommendStrategies(cat, { ...base, standards: [], chosenFunctionIds: ['rs:Func_Exploration', 'rs:Func_Prediction'] });
    expect(r.candidates.slice(0, 2).map((c) => c.label).sort()).toEqual(['KWL', '미리보기']);
  });
  it('관리자가 넣은 텍스트 유형·시간·검수 정보로 점수가 오른다', () => {
    const c2 = new Catalog(BUNDLED_SOURCE, {
      ...EMPTY_OVERRIDES,
      strategies: { 'rs:Strat_빈칸_메우기': { suitableTextTypeIds: ['tx:Exposition'], minutes: 15, reviewStatus: 'reviewed' } },
    });
    const r = recommendStrategies(c2, { ...base, standards: [std(c2, '[12영이01-03]')] });
    expect(r.candidates[0]).toMatchObject({ label: '빈칸 메우기', score: SCORE.function + SCORE.textType + SCORE.time + SCORE.reviewed });
    expect(r.candidates[0].matched).toEqual(['독서 기능 이해', '텍스트 유형 설명', '소요 15분', '검수 완료']);
  });
  it('기능은 안 맞아도 텍스트 유형이 맞으면 후보가 된다', () => {
    const c2 = new Catalog(BUNDLED_SOURCE, { ...EMPTY_OVERRIDES, strategies: { 'rs:Strat_RAFT': { suitableTextTypeIds: ['tx:Exposition'] } } });
    const r = recommendStrategies(c2, { ...base, standards: [std(c2, '[12영감01-01]')] });
    expect(r.candidates.map((c) => c.label)).toEqual(['RAFT']);
  });
});
