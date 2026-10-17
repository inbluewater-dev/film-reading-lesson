import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { compileCurriculum, compileGagne, compileReading, compileText, resolveFunctions } from '../../src/lib/ttl/compile';
import { Graph, shortId } from '../../src/lib/ttl/rdf';
import { SOURCE_FILES } from '../../src/lib/ttl/sources';
import * as S from '../../src/lib/validation/schemas';

const load = (f: string) => Graph.fromTurtle(readFileSync(join(__dirname, '../../data/ttl/original', f), 'utf-8'));
const cur = compileCurriculum(load(SOURCE_FILES.curriculum));
const reading = compileReading(load(SOURCE_FILES.reading));
const gagne = compileGagne(load(SOURCE_FILES.gagne));
const text = compileText(load(SOURCE_FILES.text));
const nodes = (t: string) => cur.nodes.filter((n) => n.type === t);
const standards = cur.nodes.filter((n): n is S.StandardNode => n.type === 'standard');

describe('스키마 검증', () => {
  it('4개 컴파일 결과가 모두 스키마를 통과한다', () => {
    expect(S.CurriculumData.safeParse(cur).success).toBe(true);
    expect(S.ReadingData.safeParse(reading).success).toBe(true);
    expect(S.GagneData.safeParse(gagne).success).toBe(true);
    expect(S.TextData.safeParse(text).success).toBe(true);
  });
  it('같은 입력이면 항상 같은 결과(결정적)', () => {
    expect(compileCurriculum(load(SOURCE_FILES.curriculum))).toEqual(cur);
  });
});

describe('영화과.ttl → 교육과정', () => {
  it('교과 3, 영역 8, 핵심 아이디어 17, 내용 요소 82, 성취기준 32, 역량 7', () => {
    expect(cur.subjects.map((s) => s.label)).toEqual(['영화의 이해', '영화 감상과 비평', '영화와 삶']);
    expect(nodes('area')).toHaveLength(8);
    expect(nodes('coreIdea')).toHaveLength(17);
    expect(nodes('element')).toHaveLength(82);
    expect(standards).toHaveLength(32);
    expect(cur.competencies).toHaveLength(7);
  });
  it('과목별 성취기준 수: 15 / 9 / 8', () => {
    const count = (label: string) => standards.filter((s) => s.subjectId === cur.subjects.find((x) => x.label === label)!.id).length;
    expect([count('영화의 이해'), count('영화 감상과 비평'), count('영화와 삶')]).toEqual([15, 9, 8]);
  });
  it('영역 순서가 원문 순서를 따른다', () => {
    const areas = nodes('area') as Extract<S.CurriculumNode, { type: 'area' }>[];
    expect(areas.filter((a) => a.subjectId === 'cur:FilmUnderstanding').map((a) => a.label)).toEqual(['영화의 특성', '영화의 구성 요소', '영화의 역사']);
    expect(areas.every((a) => a.applicationNotes.length > 0)).toBe(true);
  });
  it('성취기준: 코드·원문·해설·끝 동사가 있고, 독서 기능·내용 요소 연결은 비어 있다', () => {
    for (const s of standards) {
      expect(s.standardCode).toMatch(/^\[12영(이|감|삶)\d{2}-\d{2}\]$/);
      expect(s.standardExplanations.length).toBeGreaterThan(0);
      expect(s.targetFunctionIds).toEqual([]);
      expect(s.coversElementIds).toEqual([]);
    }
    const first = standards.find((s) => s.standardCode === '[12영이01-01]')!;
    expect(first.standardText).toBe('다양한 측면에서 영화를 탐구하고 정의함으로써 영화의 의미를 탐색한다.');
    expect(first.targetVerb).toBe('탐색하다');
  });
  it('여러 성취기준을 함께 설명한 해설은 각 성취기준에 모두 연결된다', () => {
    const a = standards.find((s) => s.standardCode === '[12영이01-01]')!;
    const b = standards.find((s) => s.standardCode === '[12영이01-02]')!;
    expect(a.standardExplanations[0]).toBe(b.standardExplanations[0]);
  });
});

describe('readstrategy.ttl → 독서 기능·동사·전략', () => {
  it('기능 15, 동사 72(정의 71 + 정의 누락 1), 전략 54', () => {
    expect(reading.functions).toHaveLength(15);
    expect(reading.verbs).toHaveLength(72);
    expect(reading.strategies).toHaveLength(54);
  });
  it('정의가 빠진 동사(적용하다)는 IRI 이름에서 라벨을 만들고 표시한다', () => {
    const v = reading.verbs.find((x) => x.id === 'rs:Verb_적용하다')!;
    expect(v).toMatchObject({ label: '적용하다', labelSource: 'iri', functionIds: ['rs:Func_Application'] });
    expect(reading.verbs.filter((x) => x.labelSource === 'iri')).toHaveLength(1);
  });
  it('작업본(data/ttl/working)에서는 적용하다가 정의되어 있고, 원본과의 차이는 그 한 줄뿐이다', () => {
    const working = compileReading(Graph.fromTurtle(readFileSync(join(__dirname, '../../data/ttl/working/readstrategy.ttl'), 'utf-8')));
    expect(working.verbs.find((x) => x.id === 'rs:Verb_적용하다')).toMatchObject({ label: '적용하다', labelSource: 'ttl' });
    expect(working.verbs.filter((x) => x.labelSource === 'iri')).toHaveLength(0);
    const norm = (r: typeof reading) => ({ ...r, verbs: r.verbs.map((v) => ({ ...v, labelSource: 'ttl' })).sort((x, y) => x.id.localeCompare(y.id)) });
    expect(norm(working)).toEqual(norm(reading));
  });
  it('여러 기능에 속한 동사: 예상하다(탐색·예측), 연결하다(비교·관계화)', () => {
    expect(reading.verbs.find((v) => v.label === '예상하다')!.functionIds).toEqual(['rs:Func_Exploration', 'rs:Func_Prediction']);
    expect(reading.verbs.find((v) => v.label === '연결하다')!.functionIds).toEqual(['rs:Func_Comparison', 'rs:Func_Relation']);
  });
  it('전략 확장 속성은 비어 있고 검수 전(draft) 상태', () => {
    expect(reading.strategies.every((s) => s.procedure.length === 0 && s.minutes === null && s.reviewStatus === 'draft')).toBe(true);
  });
});

describe('독서 기능 매칭 (가이드 §5.2)', () => {
  const std = (verb: string, fns: string[] = []) => ({ targetVerb: verb, targetFunctionIds: fns });
  it('1단계: 관리자가 지정한 기능이 가장 우선', () => {
    expect(resolveFunctions(std('이해하다', ['rs:Func_Analysis']), reading)).toEqual({ functionIds: ['rs:Func_Analysis'], source: 'admin' });
  });
  it('2단계: 끝 동사가 읽기 동사와 정확히 일치', () => {
    expect(resolveFunctions(std('이해하다'), reading)).toEqual({ functionIds: ['rs:Func_Understanding'], source: 'verb' });
    expect(resolveFunctions(std('성찰하다'), reading)).toEqual({ functionIds: ['rs:Func_Regulation'], source: 'verb' });
  });
  it('3단계: 동사 매핑 사전 (관리자 입력값)', () => {
    expect(resolveFunctions(std('탐구하다'), reading, { 탐구하다: ['rs:Func_Exploration'] })).toEqual({ functionIds: ['rs:Func_Exploration'], source: 'mapping' });
  });
  it('4단계: 아무것도 없으면 교사가 직접 선택(none)', () => {
    expect(resolveFunctions(std('탐구하다'), reading)).toEqual({ functionIds: [], source: 'none' });
  });
  it('현재 데이터: 32개 중 10개만 자동 연결, 22개는 매핑 필요', () => {
    const r = standards.map((s) => resolveFunctions(s, reading).source);
    expect(r.filter((x) => x === 'verb')).toHaveLength(10);
    expect(r.filter((x) => x === 'none')).toHaveLength(22);
  });
});

describe('가네.ttl → 9사태', () => {
  it('1~9 순서, 도입/전개/정리 구분, nextEvent 연결', () => {
    expect(gagne.events.map((e) => e.seq)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(gagne.events.map((e) => e.phase)).toEqual(['도입', '도입', '도입', '전개', '전개', '전개', '전개', '전개', '정리']);
    gagne.events.slice(0, 8).forEach((e, i) => expect(e.nextEventId).toBe(gagne.events[i + 1].id));
    expect(gagne.events[8].nextEventId).toBeNull();
  });
  it('사설 수업 사례는 참고 예시(reference)로만 분리된다', () => {
    expect(gagne.lessonLabel).toBe('신문 사설의 주장 분석 및 정보 탐색 수업');
    expect(gagne.events.every((e) => e.reference.exampleDescription)).toBe(true);
  });
});

describe('text.ttl → 텍스트 유형', () => {
  it('분류 기준 4, 속성 13, 사례 3', () => {
    expect(text.categories.map((c) => c.label)).toEqual(['자료', '조직과 탐색', '체재', '유형(내용)']);
    expect(text.types).toHaveLength(13);
    expect(text.examples).toHaveLength(3);
    expect(text.examples[0].attributeIds).toEqual(['tx:SingleText', 'tx:StaticText', 'tx:ContinuousText', 'tx:Exposition']);
  });
});

describe('네임스페이스 정규화 (가이드 §3.3-4)', () => {
  it('파일마다 다른 ex: 를 cur:/rs:/gagne:/tx: 로 구분한다', () => {
    expect(shortId('https://example.org/curriculum/film#FilmHistory')).toBe('cur:FilmHistory');
    expect(shortId('http://example.org/reading#hasStrategy')).toBe('rs:hasStrategy');
    expect(shortId('http://example.org/il-lesson/hasStrategy')).toBe('gagne:hasStrategy');
    expect(shortId('http://example.org/pisa#Narration')).toBe('tx:Narration');
  });
});
