// 내보내기 공통 문서 모델 (가이드 §12 Phase 7): 지도안·읽기자료·활동지를 한 번 정리해 두고
// 인쇄(PDF)·DOCX·HWPX가 같은 내용을 같은 순서로 쓴다
import type { Catalog } from '../catalog/catalog';
import { READING_PHASE_LABEL } from '../catalog/catalog';
import type { LessonPlanRecord, MaterialRecord } from '../library/types';

export interface Cell {
  text: string;
  header?: boolean;
  rowSpan?: number;
  colSpan?: number;
  align?: 'left' | 'center';
}
export type Block =
  | { kind: 'title'; text: string }
  | { kind: 'heading'; text: string }
  | { kind: 'paragraph'; text: string; small?: boolean }
  | { kind: 'list'; items: string[]; ordered?: boolean }
  /** widths: 열 너비 비율(합 100). rows: 병합으로 가려지는 칸은 빼고 적는다 */
  | { kind: 'table'; widths: number[]; rows: Cell[][]; caption?: string }
  | { kind: 'pageBreak' };

export interface ExportDoc {
  /** 파일 이름에 쓰는 제목 */
  title: string;
  blocks: Block[];
}

export interface ExportOptions {
  includeMaterial: boolean;
  includeWorksheet: boolean;
}

export const AI_NOTICE = 'AI 생성물 — 사용 전 교사 검토. 교육과정 문구는 2022 개정 교육과정 원문입니다.';

const h = (text: string, extra: Partial<Cell> = {}): Cell => ({ text, header: true, align: 'center', ...extra });
const c = (text: string, extra: Partial<Cell> = {}): Cell => ({ text, ...extra });

export function planBlocks(catalog: Catalog, p: LessonPlanRecord, opts: Pick<ExportOptions, 'includeWorksheet'>): Block[] {
  const subject = catalog.subject(p.subjectId);
  const areas = [...new Set(p.nodeIds.map((id) => catalog.node(id)).map((n) => (n ? catalog.areaOf(n)?.id : undefined)).filter((x): x is string => !!x))].map((id) => catalog.node(id)!);
  const standards = p.standardCodes.map((code) => {
    const n = catalog.standards().find((x) => x.standardCode === code);
    return n ? `${code} ${n.standardText}` : code;
  });
  const blocks: Block[] = [
    { kind: 'title', text: p.title },
    {
      kind: 'table',
      widths: [18, 32, 18, 32],
      rows: [
        [h('과목'), c(subject ? `${subject.label} (${subject.courseCategory})` : ''), h('대상·시간'), c(`${p.grade ? `${p.grade}학년 · ` : ''}${p.lessonMinutes === 100 ? '블록 100분' : '50분'}`)],
        [h('영역'), c(areas.map((a) => (a.type === 'area' ? a.label : '')).join(', '), { colSpan: 3 })],
        [h('성취기준'), c(standards.join('\n') || '—', { colSpan: 3 })],
        [h('읽기자료'), c(p.materialTitle, { colSpan: 3 })],
      ],
    },
    { kind: 'heading', text: '학습목표' },
    { kind: 'list', items: p.objectives.filter((o) => o.trim()), ordered: true },
    { kind: 'heading', text: '차시 개관' },
    { kind: 'paragraph', text: p.overview },
    { kind: 'heading', text: '독서전략' },
    {
      kind: 'list',
      items: p.strategyIds.flatMap((id) => {
        const s = catalog.strategy(id);
        if (!s) return [];
        const fn = s.functionIds.map((f) => `${catalog.functionLabel(f)}·${READING_PHASE_LABEL[catalog.readingPhaseOf(f)]}`).join(', ');
        const at = p.events.filter((r) => r.strategyIds.includes(id)).map((r) => r.seq).join('·');
        return [`${s.label} (${fn})${at ? ` — 사태 ${at}` : ''}${s.procedure.length ? `\n절차: ${s.procedure.join(' → ')}` : ''}`];
      }),
    },
    { kind: 'heading', text: '교수·학습 과정 (가네 9사태)' },
  ];
  const rows: Cell[][] = [[h('단계'), h('수업사태'), h('교사 활동'), h('학생 활동'), h('시간(분)'), h('자료·유의점'), h('평가')]];
  for (const phase of ['도입', '전개', '정리'] as const) {
    const evs = p.events.filter((r) => r.phase === phase);
    evs.forEach((r, i) => {
      const strategies = r.strategyIds.map((id) => catalog.strategy(id)?.label).filter(Boolean);
      const row: Cell[] = [];
      if (i === 0) row.push(h(phase, { rowSpan: evs.length }));
      row.push(c(`${r.seq}. ${r.label}${strategies.length ? `\n[${strategies.join(', ')}]` : ''}`), c(r.teacherActivity), c(r.studentActivity), c(String(r.minutes), { align: 'center' }), c(r.material), c(r.assessment));
      rows.push(row);
    });
  }
  const total = p.events.reduce((a, r) => a + r.minutes, 0);
  rows.push([h('합계', { colSpan: 4 }), c(String(total), { align: 'center', header: true }), c('', { colSpan: 2 })]);
  blocks.push({ kind: 'table', widths: [7, 13, 22, 22, 7, 15, 14], rows });
  if (p.rubric.length) {
    blocks.push({ kind: 'heading', text: '평가 계획 (평가 준거)' });
    blocks.push({ kind: 'table', widths: [22, 26, 26, 26], rows: [[h('평가 요소'), h('상'), h('중'), h('하')], ...p.rubric.map((r) => [c(r.criterion), c(r.high), c(r.mid), c(r.low)])] });
  }
  const notes = areas.flatMap((a) => (a.type === 'area' ? a.applicationNotes : []));
  if (notes.length) {
    blocks.push({ kind: 'heading', text: '참고: 성취기준 적용 시 고려 사항 (교육과정 원문)' });
    blocks.push({ kind: 'list', items: notes });
  }
  if (opts.includeWorksheet && p.worksheet.some((w) => w.trim())) {
    blocks.push({ kind: 'pageBreak' }, { kind: 'title', text: `활동지 — ${p.title.replace(/ ?수업지도안$/, '')}` }, { kind: 'paragraph', text: '학번:            이름:' });
    p.worksheet.filter((w) => w.trim()).forEach((q, i) => {
      blocks.push({ kind: 'table', widths: [100], rows: [[c(`${i + 1}. ${q}`, { header: true })], [c('\n\n\n')]] });
    });
  }
  return blocks;
}

export function materialBlocks(m: MaterialRecord): Block[] {
  const blocks: Block[] = [{ kind: 'title', text: m.title }];
  for (const b of m.blocks) {
    if (b.kind === 'paragraph') blocks.push({ kind: 'paragraph', text: b.text });
    else {
      const n = b.columns.length;
      blocks.push({ kind: 'table', caption: b.caption, widths: b.columns.map(() => 100 / n), rows: [b.columns.map((x) => h(x)), ...b.rows.map((r) => b.columns.map((_, i) => c(r[i] ?? '')))] });
    }
  }
  if (m.glossary.length) {
    blocks.push({ kind: 'heading', text: '낱말 풀이' });
    blocks.push({ kind: 'table', widths: [25, 75], rows: m.glossary.map((g) => [h(g.term), c(g.meaning)]) });
  }
  if (m.questions.length) {
    blocks.push({ kind: 'heading', text: '이해 확인 질문' });
    blocks.push({ kind: 'list', ordered: true, items: m.questions.map((q) => `[${q.level}] ${q.question}`) });
  }
  if (m.sourceNote) blocks.push({ kind: 'paragraph', text: m.sourceNote, small: true });
  return blocks;
}

export function buildExportDoc(catalog: Catalog, plan: LessonPlanRecord, material: MaterialRecord | null, opts: ExportOptions): ExportDoc {
  const blocks = planBlocks(catalog, plan, opts);
  if (opts.includeMaterial && material) blocks.push({ kind: 'pageBreak' }, ...materialBlocks(material));
  blocks.push({ kind: 'paragraph', text: AI_NOTICE, small: true });
  return { title: plan.title, blocks };
}

/** 파일 이름에 쓸 수 없는 글자를 뺀다 */
export function safeFileName(s: string): string {
  return s.replace(/[\\/:*?"<>|\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || '수업지도안';
}
