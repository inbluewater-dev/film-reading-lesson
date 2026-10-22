// 관리자 TTL 관리: 브라우저 컴파일·검증, 변경 비교, TTL 내보내기 왕복
import { describe, expect, it } from 'vitest';
import sourcesJson from '../../data/compiled/sources.json';
import { BUNDLED_SOURCE } from '../../src/lib/catalog/bundled';
import { Catalog, EMPTY_OVERRIDES, type CatalogOverrides } from '../../src/lib/catalog/catalog';
import { compileSources } from '../../src/lib/ontology/compileAll';
import { diffSources, orphanedOverrides } from '../../src/lib/ontology/diff';
import { exportOverridesJson, exportTtl, parseOverridesJson, toIri } from '../../src/lib/ontology/exportTtl';
import { Graph } from '../../src/lib/ttl/rdf';
import type { SourceFiles } from '../../src/lib/ttl/sourceFiles';

const files = sourcesJson as SourceFiles;
const base = new Catalog(BUNDLED_SOURCE, EMPTY_OVERRIDES);
const std = base.standards().find((s) => s.standardCode === '[12영감01-01]')!; // 탐구한다 → 미지정
const strat = base.reading.strategies.find((s) => s.label === '오류 찾기')!;

describe('브라우저 컴파일', () => {
  it('번들 TTL을 다시 컴파일하면 빌드 결과와 같고 버전 해시도 같다', async () => {
    const { source, report } = await compileSources(files);
    expect(report.ok).toBe(true);
    expect(report.stats).toMatchObject({ subjects: 3, standards: 32, gagneEvents: 9 });
    expect(source!.curriculum).toEqual(BUNDLED_SOURCE.curriculum);
    expect(source!.reading).toEqual(BUNDLED_SOURCE.reading);
    expect(source!.manifest.ontologyVersion).toBe(BUNDLED_SOURCE.manifest.ontologyVersion);
  });
  it('문법 오류는 파일과 줄 번호를 알려 준다', async () => {
    const { source, report } = await compileSources({ ...files, text: files.text + '\nex:broken ex:p .\n@@@' });
    expect(source).toBeNull();
    const t = report.files.find((f) => f.key === 'text')!;
    expect(t.error).toMatch(/문법 오류/);
    expect(t.error).toMatch(/line \d+/);
  });
  it('필수 값이 빠지면 어느 항목인지 알려 준다', async () => {
    const broken = files.curriculum.replace(/ex:standardText\s+"[^"]*"@ko\s*;/, "");
    const { report } = await compileSources({ ...files, curriculum: broken });
    expect(report.ok).toBe(false);
    expect(report.files.find((f) => f.key === 'curriculum')!.error).toMatch(/필수 값이 없음/);
  });
});

describe('변경 비교', () => {
  it('성취기준 원문 수정·추가·삭제를 찾아낸다', async () => {
    const edited = files.curriculum.replace(std.standardText, std.standardText.replace('탐구한다', '탐구하고 설명한다'));
    const { source } = await compileSources({ ...files, curriculum: edited });
    const changes = diffSources(BUNDLED_SOURCE, source!);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ group: '교육과정 항목', id: std.id, kind: 'changed' });
    expect(changes[0].fields[0]).toMatchObject({ field: '성취기준 원문' });
  });
  it('사라진 항목을 가리키는 관리자 입력을 경고한다', () => {
    const o: CatalogOverrides = { ...EMPTY_OVERRIDES, standardFunctions: { 'cur:Nope': ['rs:Func_Understanding'] }, verbMappings: { 탐구하다: ['rs:Func_Missing'] } };
    expect(orphanedOverrides(BUNDLED_SOURCE, o)).toHaveLength(2);
  });
});

describe('TTL 내보내기 왕복 (TTL → JSON → TTL)', () => {
  it('관리자 입력이 없으면 triple 수가 그대로다', () => {
    for (const key of ['curriculum', 'reading', 'gagne', 'text'] as const) {
      const out = exportTtl(key, files[key], EMPTY_OVERRIDES, base.gagne.events);
      expect(Graph.fromTurtle(out).size).toBe(Graph.fromTurtle(files[key]).size);
    }
  });
  it('연결 정보·전략 보완을 넣어 내보낸 TTL을 다시 컴파일하면 같은 카탈로그가 된다', async () => {
    const element = base.childrenOf(base.areaOf(std)!.id, 'element')[0];
    const o: CatalogOverrides = {
      ...EMPTY_OVERRIDES,
      standardFunctions: { [std.id]: ['rs:Func_Exploration', 'rs:Func_Evaluation'] },
      standardElements: { [std.id]: [element.id] },
      strategies: { [strat.id]: { procedure: ['오류가 있는 글을 읽는다', '오류를 찾아 표시한다', '바르게 고친다'], suitableTextTypeIds: [base.textTypes.types[0].id], recommendedEvents: [5, 6], minutes: 15, reviewStatus: 'reviewed', worksheetHint: '표' } },
    };
    const expected = new Catalog(BUNDLED_SOURCE, o);
    const out = { ...files, curriculum: exportTtl('curriculum', files.curriculum, o, base.gagne.events), reading: exportTtl('reading', files.reading, o, base.gagne.events) };
    expect(Graph.fromTurtle(out.curriculum).size).toBe(Graph.fromTurtle(files.curriculum).size + 3);
    expect(Graph.fromTurtle(out.reading).size).toBe(Graph.fromTurtle(files.reading).size + 3 + 1 + 2 + 1 + 1 + 1);
    const { source } = await compileSources(out);
    const round = new Catalog(source!, EMPTY_OVERRIDES);
    expect(round.node(std.id)).toEqual(expected.node(std.id));
    expect(round.strategy(strat.id)).toEqual(expected.strategy(strat.id));
    // 원문은 그대로
    expect(round.standards().map((s) => s.standardText)).toEqual(base.standards().map((s) => s.standardText));
  });
  it('관리자 입력이 기존 TTL 값을 대체한다(합치지 않음)', async () => {
    const o1: CatalogOverrides = { ...EMPTY_OVERRIDES, standardFunctions: { [std.id]: ['rs:Func_Exploration'] } };
    const once = exportTtl('curriculum', files.curriculum, o1, base.gagne.events);
    const o2: CatalogOverrides = { ...EMPTY_OVERRIDES, standardFunctions: { [std.id]: ['rs:Func_Inference'] } };
    const twice = exportTtl('curriculum', once, o2, base.gagne.events);
    const g = Graph.fromTurtle(twice);
    expect(g.iris(toIri(std.id), 'https://example.org/curriculum/film#targetFunction')).toEqual(['http://example.org/reading#Func_Inference']);
  });
  it('관리자 설정 JSON 백업·복원', () => {
    const o = { ...EMPTY_OVERRIDES, verbMappings: { 탐구하다: ['rs:Func_Exploration'] } };
    expect(parseOverridesJson(exportOverridesJson(o, 'abc'))).toEqual(o);
    expect(() => parseOverridesJson('{"a":1}')).toThrow('이 앱에서 내보낸');
  });
});
