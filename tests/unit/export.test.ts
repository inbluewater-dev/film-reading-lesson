// 내보내기: 공통 모델 → DOCX·HWPX. 결과 파일은 test-output/export/에 남겨 워드·한글·LibreOffice로 직접 열어 볼 수 있다
import { mkdirSync, writeFileSync } from 'node:fs';
import { strFromU8, unzipSync } from 'fflate';
import { beforeAll, describe, expect, it } from 'vitest';
import { fillPlan } from '../../src/features/lessonplan/generate';
import { MockProvider } from '../../src/lib/ai/mockProvider';
import { BUNDLED_SOURCE } from '../../src/lib/catalog/bundled';
import { Catalog, EMPTY_OVERRIDES } from '../../src/lib/catalog/catalog';
import { toDocx } from '../../src/lib/export/docx';
import { buildHeader, buildSection, toHwpx } from '../../src/lib/export/hwpx';
import { buildExportDoc, layoutRows, safeFileName, type ExportDoc } from '../../src/lib/export/model';
import type { LessonPlanRecord, MaterialRecord } from '../../src/lib/library/types';
import { buildContext, DEFAULT_PARAMS } from '../../src/lib/lesson/context';
import { toObjective } from '../../src/lib/lesson/objectives';

const cat = new Catalog(BUNDLED_SOURCE, EMPTY_OVERRIDES);
const std = cat.standards().find((s) => s.standardCode === '[12영이01-03]')!;
const OUT = 'test-output/export';
let doc: ExportDoc;
let plan: LessonPlanRecord;
let material: MaterialRecord;

const owned = { id: 'x', ownerUid: 'u', ownerDisplayName: '김영화', visibility: 'private' as const, createdAt: '', updatedAt: '', ontologyVersion: 'v' };

beforeAll(async () => {
  const ctx = buildContext(cat, [std.id], std.subjectId);
  const m = await new MockProvider().generateMaterial({ context: ctx, params: DEFAULT_PARAMS, textTypeLabels: { source: '', structure: '', format: '', content: '' } });
  material = { ...owned, subjectId: std.subjectId, nodeIds: [std.id], params: DEFAULT_PARAMS, title: m.title, blocks: m.blocks, glossary: m.glossary, questions: m.comprehensionQuestions, sourceNote: m.sourceNote, standardCodes: [std.standardCode], reviewedByTeacher: true, model: 'mock', promptVersion: 'v1' };
  const objectives = [toObjective(std.standardText)];
  const strategyIds = [cat.reading.strategies.find((s) => s.label === '단어의 나무')!.id];
  const filled = await fillPlan(new MockProvider(), cat, ctx, { materialTitle: m.title, materialSummary: '', minutes: 50, strategyIds, objectives });
  // 특수 문자·줄바꿈이 깨지지 않는지 함께 본다
  filled.events[0].teacherActivity = '질문 <A> & "B"\n두 번째 줄';
  plan = { ...owned, subjectId: std.subjectId, nodeIds: [std.id], standardCodes: [std.standardCode], materialId: 'm', materialTitle: m.title, strategyIds, lessonMinutes: 50, grade: 2, title: '영화의 특성 수업지도안', objectives, ...filled, reviewedByTeacher: true, model: 'mock' };
  doc = buildExportDoc(cat, plan, material, { includeMaterial: true, includeWorksheet: true });
  mkdirSync(OUT, { recursive: true });
});

describe('공통 문서 모델', () => {
  it('지도안 → 읽기자료 → 활동지 순서, 9사태 표와 시간 합계', () => {
    const titles = doc.blocks.filter((b) => b.kind === 'title').map((b) => (b as { text: string }).text);
    expect(titles[0]).toBe('영화의 특성 수업지도안');
    expect(titles).toContain(material.title);
    expect(titles.some((t) => t.startsWith('활동지'))).toBe(true);
    const table = doc.blocks.find((b) => b.kind === 'table' && b.rows[0][0].text === '단계') as Extract<ExportDoc['blocks'][number], { kind: 'table' }>;
    expect(table.rows).toHaveLength(1 + 9 + 1);
    expect(table.rows[1][0]).toMatchObject({ text: '도입', rowSpan: 3 });
    expect(table.rows.at(-1)!.map((c) => c.text)).toContain('50');
    // 성취기준 원문은 TTL 값 그대로
    expect(JSON.stringify(doc)).toContain(std.standardText);
  });
  it('읽기자료·활동지를 빼면 지도안만', () => {
    const d = buildExportDoc(cat, plan, material, { includeMaterial: false, includeWorksheet: false });
    expect(d.blocks.filter((b) => b.kind === 'pageBreak')).toHaveLength(0);
  });
  it('병합 칸의 열 위치 계산', () => {
    const laid = layoutRows([[{ text: 'a', rowSpan: 2 }, { text: 'b' }], [{ text: 'c' }], [{ text: 'd', colSpan: 2 }]], 2);
    expect(laid.map((r) => r.map((x) => x.col))).toEqual([[0, 1], [1], [0]]);
  });
  it('파일 이름 정리', () => expect(safeFileName('a/b:c*?  d')).toBe('a b c d'));
});

describe('DOCX', () => {
  it('맑은 고딕, 한국어 본문, 세로 병합, 특수 문자 이스케이프', async () => {
    const blob = await toDocx(doc);
    const buf = new Uint8Array(await blob.arrayBuffer());
    writeFileSync(`${OUT}/지도안.docx`, buf);
    const files = unzipSync(buf);
    const xml = strFromU8(files['word/document.xml']);
    expect(xml).toContain('맑은 고딕');
    expect(xml).toContain('주의집중');
    expect(xml).toContain('w:vMerge');
    expect(xml).toContain('질문 &lt;A&gt; &amp; &quot;B&quot;');
  });
});

describe('HWPX', () => {
  it('mimetype이 맨 앞·무압축, 필수 파일 포함', () => {
    const bytes = toHwpx(doc, new Date('2026-10-22T00:00:00Z'));
    writeFileSync(`${OUT}/지도안.hwpx`, bytes);
    // 첫 로컬 파일 헤더: 이름 mimetype, 압축 방식 0(저장)
    const view = new DataView(bytes.buffer, bytes.byteOffset);
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    expect(view.getUint16(8, true)).toBe(0);
    const nameLen = view.getUint16(26, true);
    expect(strFromU8(bytes.slice(30, 30 + nameLen))).toBe('mimetype');
    const files = unzipSync(bytes);
    expect(strFromU8(files.mimetype)).toBe('application/hwp+zip');
    for (const f of ['version.xml', 'Contents/header.xml', 'Contents/section0.xml', 'Contents/content.hpf', 'META-INF/container.xml']) expect(files[f]).toBeDefined();
    expect(strFromU8(files['Contents/content.hpf'])).toContain('<opf:title>영화의 특성 수업지도안</opf:title>');
  });
  it('header: 덧붙인 글자·문단 모양과 테두리 수가 itemCnt와 맞다', () => {
    const h = buildHeader();
    for (const [tag, item] of [['charProperties', 'charPr'], ['paraProperties', 'paraPr'], ['borderFills', 'borderFill']]) {
      const cnt = Number(h.match(new RegExp(`<hh:${tag} itemCnt="(\\d+)"`))![1]);
      expect(h.match(new RegExp(`<hh:${item} `, 'g'))!.length).toBe(cnt);
    }
  });
  it('section: 표 행·열 수, 병합, 이스케이프', () => {
    const s = buildSection(doc);
    expect(s).toContain('rowCnt="11" colCnt="7"');
    expect(s).toContain('<hp:cellSpan colSpan="1" rowSpan="5"/>'); // 전개 4~8
    expect(s).toContain('<hp:t>질문 &lt;A&gt; &amp; &quot;B&quot;</hp:t>');
    expect(s).toContain('<hp:t>두 번째 줄</hp:t>');
    expect(s.match(/pageBreak="1"/g)!.length).toBe(2);
  });
});
