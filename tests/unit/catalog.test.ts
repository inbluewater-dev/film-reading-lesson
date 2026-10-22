import { describe, expect, it } from 'vitest';
import { BUNDLED_SOURCE } from '../../src/lib/catalog/bundled';
import { Catalog, EMPTY_OVERRIDES } from '../../src/lib/catalog/catalog';
import { LocalBackend } from '../../src/lib/data/local/localBackend';
import { MemoryStorage } from '../../src/lib/data/local/storage';
import type { StandardNode } from '../../src/lib/validation/schemas';

const cat = new Catalog(BUNDLED_SOURCE, EMPTY_OVERRIDES);
const std = (code: string) => cat.standards().find((s) => s.standardCode === code) as StandardNode;

describe('카탈로그 조회', () => {
  it('과목별 영역이 원문 순서대로 나온다', () => {
    expect(cat.areasOf('cur:FilmAndLife').map((a) => a.label)).toEqual(['영화로 표현하기', '영화로 세상읽기', '영화로 탐색하기']);
  });
  it('영역의 핵심 아이디어·내용 요소·성취기준', () => {
    expect(cat.childrenOf('cur:FilmCharacteristics', 'standard').map((s) => s.standardCode)).toEqual(['[12영이01-01]', '[12영이01-02]', '[12영이01-03]', '[12영이01-04]', '[12영이01-05]']);
    expect(cat.childrenOf('cur:FilmCharacteristics', 'coreIdea')).toHaveLength(2);
    expect(cat.childrenOf('cur:FilmCharacteristics', 'element')).toHaveLength(10);
  });
  it('검색: 성취기준 코드(공백·대소문자 무시)와 낱말', () => {
    expect(cat.search('12영이02', 'cur:FilmUnderstanding').filter((n) => n.type === 'standard')).toHaveLength(6);
    expect(cat.search('몽타주').some((n) => n.type === 'standard' && n.standardCode === '[12영이02-03]')).toBe(true);
    expect(cat.search('   ')).toEqual([]);
  });
  it('읽기 전·중·후 기본값은 가이드에 적힌 7개 기능만, 나머지는 미분류', () => {
    expect(cat.readingPhaseOf('rs:Func_Exploration')).toBe('before');
    expect(cat.readingPhaseOf('rs:Func_Understanding')).toBe('during');
    expect(cat.readingPhaseOf('rs:Func_Evaluation')).toBe('after');
    expect(cat.readingPhaseOf('rs:Func_Expression')).toBe('unset');
  });
});

describe('관리자 입력(오버라이드)', () => {
  it('동사 매핑을 넣으면 ‘탐구하다’ 성취기준도 독서 기능이 정해진다', () => {
    const s = std('[12영감01-01]');
    expect(cat.functionsFor(s).source).toBe('none');
    const c2 = new Catalog(BUNDLED_SOURCE, { ...EMPTY_OVERRIDES, verbMappings: { 탐구하다: ['rs:Func_Exploration'] } });
    expect(c2.functionsFor(c2.node(s.id) as StandardNode)).toEqual({ functionIds: ['rs:Func_Exploration'], source: 'mapping' });
  });
  it('성취기준별 지정이 동사 일치보다 우선하고, 원문은 바뀌지 않는다', () => {
    const s = std('[12영이01-03]'); // 이해하다
    const c2 = new Catalog(BUNDLED_SOURCE, { ...EMPTY_OVERRIDES, standardFunctions: { [s.id]: ['rs:Func_Analysis'] } });
    const s2 = c2.node(s.id) as StandardNode;
    expect(c2.functionsFor(s2)).toEqual({ functionIds: ['rs:Func_Analysis'], source: 'admin' });
    expect(s2.standardText).toBe(s.standardText);
    expect(cat.functionsFor(s).source).toBe('verb'); // 원래 카탈로그는 그대로
  });
  it('전략 보완 정보가 합쳐진다', () => {
    const c2 = new Catalog(BUNDLED_SOURCE, { ...EMPTY_OVERRIDES, strategies: { 'rs:Strat_KWL': { procedure: ['알고 있는 것 쓰기'], reviewStatus: 'reviewed' } } });
    expect(c2.strategy('rs:Strat_KWL')).toMatchObject({ label: 'KWL', procedure: ['알고 있는 것 쓰기'], reviewStatus: 'reviewed' });
  });
});

describe('로컬 카탈로그 권한', () => {
  it('승인된 교사는 읽기만, 관리자는 저장 가능, 저장값은 다시 열어도 남는다', async () => {
    const storage = new MemoryStorage();
    const b = new LocalBackend({ storage });
    await b.whenReady();
    await expect(b.catalog.load()).rejects.toThrow(); // 비로그인
    await b.auth.signIn('teacher01', 'teacher1234');
    expect((await b.catalog.load()).subjects).toHaveLength(3);
    await expect(b.catalog.saveOverrides({ verbMappings: { 탐구하다: ['rs:Func_Exploration'] } })).rejects.toThrow('관리자');
    await b.auth.signIn('admin01', 'admin1234');
    await b.catalog.saveOverrides({ verbMappings: { 탐구하다: ['rs:Func_Exploration'] } });
    const b2 = new LocalBackend({ storage });
    await b2.whenReady();
    expect((await b2.catalog.load()).overrides.verbMappings).toEqual({ 탐구하다: ['rs:Func_Exploration'] });
    await b2.catalog.saveOverrides({ verbMappings: { 탐구하다: [] } }); // 빈 배열 = 해제
    expect((await b2.catalog.load()).overrides.verbMappings).toEqual({});
  });
});
