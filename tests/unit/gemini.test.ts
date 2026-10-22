// Gemini 공급자 핵심 로직: 프롬프트 채우기·JSON 스키마·검증·재시도·안전 보정·오류 안내 (실제 호출 대신 가짜 generate)
import { describe, expect, it } from 'vitest';
import { BUNDLED_SOURCE } from '../../src/lib/catalog/bundled';
import { Catalog, EMPTY_OVERRIDES } from '../../src/lib/catalog/catalog';
import { aiError, AI_NOTE, DEFAULT_MODEL, GeminiCore, jsonSchemaOf, type GenerateFn } from '../../src/lib/ai/geminiCore';
import { MockProvider } from '../../src/lib/ai/mockProvider';
import { MaterialResult, StrategyReasonResult } from '../../src/lib/ai/types';
import { buildContext, DEFAULT_PARAMS } from '../../src/lib/lesson/context';
import { buildSkeleton } from '../../src/lib/lesson/plan';

const cat = new Catalog(BUNDLED_SOURCE, EMPTY_OVERRIDES);
const std = cat.standards().find((s) => s.standardCode === '[12영이01-03]')!;
const ctx = buildContext(cat, [std.id], std.subjectId);
const labels = { source: '단일', structure: '고정', format: '연속', content: '설명' };
const mock = new MockProvider();

function core(responses: (string | Error)[], opts: { model?: string; template?: string } = {}) {
  const calls: Parameters<GenerateFn>[0][] = [];
  const c = new GeminiCore({
    model: async () => opts.model ?? DEFAULT_MODEL,
    template: async () => opts.template ?? '',
    sleep: async () => undefined,
    generate: async (i) => {
      calls.push(i);
      const r = responses.shift();
      if (r instanceof Error) throw r;
      return r ?? '';
    },
  });
  return { c, calls };
}

describe('JSON 스키마', () => {
  it('zod 스키마에서 메타 키 없는 JSON 스키마를 만든다', () => {
    const s = jsonSchemaOf(MaterialResult);
    expect(s.$schema).toBeUndefined();
    expect(s.type).toBe('object');
    expect((s.required as string[]).sort()).toEqual(['alignment', 'blocks', 'comprehensionQuestions', 'glossary', 'sourceNote', 'title']);
    expect(jsonSchemaOf(StrategyReasonResult).properties).toHaveProperty('reasons');
  });
});

describe('생성·검증', () => {
  it('기본 프롬프트를 채워 보내고, 정렬 정보는 고른 교육과정으로 덮고 검토 안내를 붙인다', async () => {
    const sample = await mock.generateMaterial({ context: ctx, params: DEFAULT_PARAMS, textTypeLabels: labels });
    const { c, calls } = core([JSON.stringify({ ...sample, sourceNote: '', alignment: { nodeIds: ['가짜'], standardCodes: ['[가짜]'] } })]);
    const r = await c.generateMaterial({ context: ctx, params: DEFAULT_PARAMS, textTypeLabels: labels });
    expect(calls[0].model).toBe(DEFAULT_MODEL);
    expect(calls[0].prompt).toContain(std.standardText);
    expect(calls[0].prompt).toContain('600자');
    expect(calls[0].prompt).not.toMatch(/\{성취기준\}/);
    expect(calls[0].jsonSchema.type).toBe('object');
    expect(r.alignment).toEqual({ nodeIds: [std.id], standardCodes: ['[12영이01-03]'] });
    expect(r.sourceNote).toBe(AI_NOTE);
  });
  it('관리자가 고친 템플릿·모델을 쓴다', async () => {
    const { c, calls } = core([JSON.stringify({ suggestions: [{ title: 'A', reason: 'r', caution: '' }] })], { model: 'gemini-3.5-flash-lite', template: '{과목} 영화 {개수}편 {스키마}' });
    const r = await c.suggestFilms({ context: ctx, count: 3 });
    expect(calls[0].model).toBe('gemini-3.5-flash-lite');
    expect(calls[0].prompt.startsWith('영화의 이해 영화 3편 {"suggestions"')).toBe(true);
    expect(r.suggestions[0].caution).toContain('확인');
    expect(c.model).toBe('gemini-3.5-flash-lite');
  });
  it('형식이 틀리면 이유를 알려 주며 한 번 더 부르고, 두 번 다 틀리면 안내한다', async () => {
    const ok = JSON.stringify({ reasons: { 'rs:A': '이유', 'rs:지어냄': 'x' } });
    const req = { context: ctx, materialTitle: 't', candidates: [{ id: 'rs:A', label: 'A', functionLabels: [], matched: [] }] };
    const one = core(['이건 JSON 아님', '```json\n' + ok + '\n```']);
    expect(await one.c.explainStrategies(req)).toEqual({ reasons: { 'rs:A': '이유' } }); // 후보에 없는 ID는 버림, 코드 울타리 제거
    expect(one.calls[1].prompt).toContain('JSON이 아님');
    const two = core(['{}', '{"reasons": 3}']);
    await expect(two.c.explainStrategies(req)).rejects.toThrow('두 번 시도했지만');
  });
  it('지도안 사태 순서는 뼈대 기준으로 맞춘다', async () => {
    const rows = buildSkeleton(cat, 50, []);
    const events = rows.map((r) => ({ seq: r.seq, label: r.label, phase: r.phase, minutes: r.minutes, strategyLabels: [], referenceStrategies: [] }));
    const sample = await mock.generateLessonPlan({ context: ctx, materialTitle: 't', materialSummary: '', minutes: 50, objectives: [], strategies: [], events });
    const { c } = core([JSON.stringify({ ...sample, events: [...sample.events].reverse() })]);
    const r = await c.generateLessonPlan({ context: ctx, materialTitle: 't', materialSummary: '', minutes: 50, objectives: [], strategies: [], events });
    expect(r.events.map((e) => e.seq)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
});

describe('붐빔·일시 장애', () => {
  const busy = () => new Error('[500 ] This model is currently experiencing high demand. Spikes in demand are usually temporary.');
  const ok = JSON.stringify({ suggestions: [{ title: 'A', reason: 'r', caution: '확인 필요' }] });
  it('같은 모델로 한 번 더 시도한다', async () => {
    const { c, calls } = core([busy(), ok]);
    await c.suggestFilms({ context: ctx, count: 3 });
    expect(calls.map((x) => x.model)).toEqual([DEFAULT_MODEL, DEFAULT_MODEL]);
    expect(c.model).toBe(DEFAULT_MODEL);
  });
  it('계속 붐비면 다음 모델로 넘어가고, 쓴 모델을 기록한다', async () => {
    const { c, calls } = core([busy(), busy(), ok]);
    await c.suggestFilms({ context: ctx, count: 3 });
    expect(calls.map((x) => x.model)).toEqual([DEFAULT_MODEL, DEFAULT_MODEL, 'gemini-3.6-flash']);
    expect(c.model).toBe('gemini-3.6-flash');
  });
  it('모든 모델이 붐비면 붐빔 안내', async () => {
    const { c, calls } = core(Array.from({ length: 8 }, busy));
    await expect(c.suggestFilms({ context: ctx, count: 3 })).rejects.toThrow('AI 서버가 지금 붐빕니다');
    expect(calls).toHaveLength(8);
  });
  it('한도(429)가 찬 모델은 다시 부르지 않고 바로 다음 모델로', async () => {
    const quota = () => new Error('[429 ] You exceeded your current quota, please check your plan and billing details');
    const { c, calls } = core([quota(), quota(), ok], { model: 'gemini-3.6-flash' });
    await c.suggestFilms({ context: ctx, count: 3 });
    expect(calls.map((x) => x.model)).toEqual(['gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite']);
    expect(c.model).toBe('gemini-3.1-flash-lite');
  });
});

describe('오류 안내', () => {
  it.each([
    ['[429 Too Many Requests] RESOURCE_EXHAUSTED', '무료 사용량'],
    ['Firebase App Check token is invalid', 'App Check'],
    ['Candidate was blocked due to SAFETY', '안전 기준'],
    ['Failed to fetch', '인터넷'],
    ['[404] models/gemini-x is not found for API version v1beta', '모델을 찾을 수 없습니다'],
    ['Firebase AI Logic API has not been used in project 123 before or it is disabled', 'AI Logic'],
    ['무언가', '응답하지 못했습니다'],
  ])('%s', (m, expected) => {
    const r = aiError(new Error(m)).message;
    expect(r).toContain(expected);
    expect(r).toContain('(오류 내용:');
  });
  it('“generateContent”라는 말만으로 사용량 초과로 오인하지 않는다', () => {
    expect(aiError(new Error('models/gemini-3.8-flash:generateContent: [400] Bad Request')).message).toContain('응답하지 못했습니다');
  });
  it('모든 모델의 한도가 차면 사용량 안내', async () => {
    const { c, calls } = core(Array.from({ length: 4 }, () => new Error('429 quota')));
    await expect(c.suggestFilms({ context: ctx, count: 3 })).rejects.toThrow('무료 사용량');
    expect(calls).toHaveLength(4);
  });
  it('권한 오류는 재시도하지 않고 바로 안내한다', async () => {
    const { c, calls } = core([new Error('[401] Firebase App Check token is invalid')]);
    await expect(c.suggestFilms({ context: ctx, count: 3 })).rejects.toThrow('App Check');
    expect(calls).toHaveLength(1);
  });
});
