import { describe, expect, it } from 'vitest';
import { MockProvider } from '../../src/lib/ai/mockProvider';
import { LessonPlanResult, MaterialResult } from '../../src/lib/ai/types';
import { BUNDLED_SOURCE } from '../../src/lib/catalog/bundled';
import { Catalog, EMPTY_OVERRIDES } from '../../src/lib/catalog/catalog';
import { buildContext, DEFAULT_PARAMS, subjectsOf, unconfirmedFilms } from '../../src/lib/lesson/context';
import { toObjective } from '../../src/lib/lesson/objectives';

const cat = new Catalog(BUNDLED_SOURCE, EMPTY_OVERRIDES);
const idOf = (code: string) => cat.standards().find((s) => s.standardCode === code)!.id;

describe('학습목표 (성취기준 → ~할 수 있다)', () => {
  it.each([
    ['영화 감상과 비평의 목적에 관해 탐구한다.', '영화 감상과 비평의 목적에 관해 탐구할 수 있다.'],
    ['영화 제작 과정과 영화를 만드는 사람들의 역할에 대해 살펴본다.', '영화 제작 과정과 영화를 만드는 사람들의 역할에 대해 살펴볼 수 있다.'],
    ['영화의 장면과 인물의 상황을 통해 자신의 삶을 성찰한다.', '영화의 장면과 인물의 상황을 통해 자신의 삶을 성찰할 수 있다.'],
    ['영화를 감상한 후 감상문 작성, 토론의 과정을 통해 영화를 더욱 깊이 향유하고 사유를 확장한다.', '영화를 감상한 후 감상문 작성, 토론의 과정을 통해 영화를 더욱 깊이 향유하고 사유를 확장할 수 있다.'],
  ])('%s', (input, expected) => expect(toObjective(input)).toBe(expected));
  it('32개 성취기준 모두 “~할 수 있다.”로 끝난다', () => {
    for (const s of cat.standards()) expect(toObjective(s.standardText)).toMatch(/[가-힣] 수 있다\.$/);
  });
});

describe('교육과정 맥락', () => {
  const ids = [idOf('[12영이01-01]'), 'cur:ConceptOfFilm', idOf('[12영감02-01]')];
  it('여러 과목을 고르면 성취기준이 있는 과목 순으로 나온다', () => {
    expect(subjectsOf(cat, ids)).toEqual(['cur:FilmUnderstanding', 'cur:FilmAppreciationCriticism']);
  });
  it('한 과목의 노드만 담고, 핵심 아이디어를 안 골랐으면 영역의 핵심 아이디어를 쓴다', () => {
    const ctx = buildContext(cat, ids, 'cur:FilmUnderstanding');
    expect(ctx.standards.map((s) => s.code)).toEqual(['[12영이01-01]']);
    expect(ctx.elements).toEqual([{ label: '영화의 개념', kind: 'knowledge' }]);
    expect(ctx.coreIdeas).toHaveLength(2);
    expect(ctx.areas.map((a) => a.label)).toEqual(['영화의 특성']);
  });
  it('AI 추천 영화는 확인 전이면 생성을 막는다', () => {
    expect(unconfirmedFilms({ ...DEFAULT_PARAMS, films: [{ title: 'A', source: 'ai', confirmed: false }, { title: 'B', source: 'teacher', confirmed: true }] })).toHaveLength(1);
  });
});

describe('MockProvider', () => {
  const ai = new MockProvider();
  const ctx = buildContext(cat, [idOf('[12영이02-03]'), 'cur:FilmLanguageImage'], 'cur:FilmUnderstanding');
  const labels = { source: '단일 텍스트', structure: '정적', format: '혼합적', content: '설명' };
  it('읽기자료가 스키마를 통과하고, 혼합적 체재면 표가 들어가며, 확인한 영화만 쓴다', async () => {
    const r = await ai.generateMaterial({
      context: ctx,
      params: { ...DEFAULT_PARAMS, textType: { ...DEFAULT_PARAMS.textType, format: 'tx:MixedText' }, films: [{ title: '확인함', source: 'teacher', confirmed: true }, { title: '미확인', source: 'ai', confirmed: false }] },
      textTypeLabels: labels,
    });
    expect(MaterialResult.safeParse(r).success).toBe(true);
    expect(r.blocks.some((b) => b.kind === 'table')).toBe(true);
    const all = JSON.stringify(r);
    expect(all).toContain('확인함');
    expect(all).not.toContain('미확인');
    expect(r.alignment.standardCodes).toEqual(['[12영이02-03]']);
    expect(r.title).toContain('샘플');
  });
  it('영화 추천은 실제 영화가 아님을 표시한다', async () => {
    const r = await ai.suggestFilms({ context: ctx, count: 3 });
    expect(r.suggestions).toHaveLength(3);
    expect(r.suggestions.every((s) => s.title.startsWith('(샘플)') && s.caution.includes('실제 영화가 아닙니다'))).toBe(true);
  });
  it('지도안 9사태와 평가 준거가 스키마를 통과한다', async () => {
    const events = cat.gagne.events.map((e) => ({ seq: e.seq, label: e.label, phase: e.phase, minutes: 5, strategyLabels: [], referenceStrategies: [] }));
    const r = await ai.generateLessonPlan({ context: ctx, materialTitle: '자료', materialSummary: '', minutes: 50, objectives: ['목표'], strategies: [], events });
    expect(LessonPlanResult.safeParse(r).success).toBe(true);
    expect(r.rubric[0].criterion).toContain('[12영이02-03]');
  });
});
