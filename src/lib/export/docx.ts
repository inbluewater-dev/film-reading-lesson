// DOCX 내보내기 — docx 라이브러리로 브라우저에서 바로 만든다 (서버 없음)
import { AlignmentType, BorderStyle, Document, HeadingLevel, Packer, PageBreak, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, VerticalAlign, WidthType } from 'docx';
import { layoutRows, type Block, type Cell, type ExportDoc } from './model';

const FONT = { ascii: 'Malgun Gothic', hAnsi: 'Malgun Gothic', eastAsia: '맑은 고딕', cs: 'Malgun Gothic' };
/** A4(11906×16838 twip), 여백 15mm */
const MARGIN = 850;
const CONTENT_WIDTH = 11906 - MARGIN * 2;
const BORDER = { style: BorderStyle.SINGLE, size: 4, color: '000000' };

/** 줄바꿈을 TextRun break로 바꾼다 */
function runs(text: string, opts: { bold?: boolean; size?: number } = {}): TextRun[] {
  return text.split('\n').map((line, i) => new TextRun({ text: line, break: i > 0 ? 1 : undefined, bold: opts.bold, size: opts.size, font: FONT }));
}

function cell(c: Cell, widthTwip: number): TableCell {
  return new TableCell({
    children: [new Paragraph({ children: runs(c.text, { bold: c.header, size: 18 }), alignment: c.align === 'center' ? AlignmentType.CENTER : AlignmentType.LEFT })],
    rowSpan: c.rowSpan,
    columnSpan: c.colSpan,
    width: { size: widthTwip, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    shading: c.header ? { type: ShadingType.CLEAR, color: 'auto', fill: 'EEEEEE' } : undefined,
    margins: { top: 60, bottom: 60, left: 90, right: 90 },
    borders: { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER },
  });
}

function table(b: Extract<Block, { kind: 'table' }>): (Table | Paragraph)[] {
  const colW = b.widths.map((w) => Math.round((CONTENT_WIDTH * w) / 100));
  const laid = layoutRows(b.rows, b.widths.length);
  const t = new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: colW,
    rows: laid.map((row) => new TableRow({ children: row.map(({ cell: c, col, span }) => cell(c, colW.slice(col, col + span).reduce((a, x) => a + x, 0))) })),
  });
  const out: (Table | Paragraph)[] = [];
  if (b.caption) out.push(new Paragraph({ children: runs(b.caption, { bold: true, size: 18 }), spacing: { before: 120, after: 60 } }));
  out.push(t, new Paragraph({ children: [], spacing: { after: 120 } }));
  return out;
}

function block(b: Block): (Table | Paragraph)[] {
  switch (b.kind) {
    case 'title':
      return [new Paragraph({ heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, children: runs(b.text, { bold: true, size: 32 }), spacing: { after: 240 } })];
    case 'heading':
      return [new Paragraph({ heading: HeadingLevel.HEADING_2, children: runs(b.text, { bold: true, size: 24 }), spacing: { before: 240, after: 100 } })];
    case 'paragraph':
      return [new Paragraph({ children: runs(b.text, { size: b.small ? 16 : 20 }), spacing: { after: 120, line: 320 } })];
    case 'list':
      return b.items.map((it, i) => new Paragraph({ children: runs(`${b.ordered ? `${i + 1}. ` : '• '}${it}`, { size: 20 }), indent: { left: 280, hanging: 280 }, spacing: { after: 60, line: 300 } }));
    case 'table':
      return table(b);
    case 'pageBreak':
      return [new Paragraph({ children: [new PageBreak()] })];
  }
}

export async function toDocx(doc: ExportDoc): Promise<Blob> {
  const d = new Document({
    creator: '영화 수업 설계 도우미',
    title: doc.title,
    styles: {
      default: { document: { run: { font: FONT, size: 20 } } },
      paragraphStyles: [
        { id: 'Title', name: 'Title', run: { font: FONT, color: '000000' } },
        { id: 'Heading2', name: 'Heading 2', run: { font: FONT, color: '000000' } },
      ],
    },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } } }, children: doc.blocks.flatMap(block) }],
  });
  return Packer.toBlob(d);
}
