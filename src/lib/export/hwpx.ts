// HWPX(한글) 내보내기 (가이드 §12 Phase 7): 한글 2014 이후가 여는 공개 XML 형식(OWPML)을 브라우저에서 만든다.
// 빈 문서 뼈대(hwpx-template, NOTICE.md 참고)에 글자·문단 모양과 테두리를 덧붙이고 본문을 새로 쓴다. 구형 .hwp는 만들지 않는다.
import { strToU8, zipSync } from 'fflate';
import { layoutRows } from './docx';
import type { Block, Cell, ExportDoc } from './model';
import headerXml from './hwpx-template/header.xml?raw';
import sectionXml from './hwpx-template/section0.xml?raw';
import contentHpf from './hwpx-template/content.hpf?raw';
import containerXml from './hwpx-template/container.xml?raw';
import containerRdf from './hwpx-template/container.rdf?raw';
import manifestXml from './hwpx-template/manifest.xml?raw';
import versionXml from './hwpx-template/version.xml?raw';
import settingsXml from './hwpx-template/settings.xml?raw';

// 단위: HWPUNIT (1pt = 100, 1mm ≈ 283.46). A4 210×297mm, 여백 15mm
const PAGE_W = 59528;
const MARGIN = 4252;
export const CONTENT_W = PAGE_W - MARGIN * 2;

/** 덧붙이는 글자 모양 id */
export const CHAR = { normal: 0, title: 7, heading: 8, small: 9, cell: 10, cellBold: 11 } as const;
const CHAR_DEFS: { id: number; height: number; bold: boolean }[] = [
  { id: CHAR.title, height: 1600, bold: true },
  { id: CHAR.heading, height: 1200, bold: true },
  { id: CHAR.small, height: 800, bold: false },
  { id: CHAR.cell, height: 900, bold: false },
  { id: CHAR.cellBold, height: 900, bold: true },
];
/** 덧붙이는 문단 모양 id (뼈대에는 0~19가 있다) */
export const PARA = { body: 0, center: 20, cell: 21, cellCenter: 22, heading: 23 } as const;
const PARA_DEFS: { id: number; align: 'LEFT' | 'CENTER' | 'JUSTIFY'; line: number; prev: number; next: number }[] = [
  { id: PARA.center, align: 'CENTER', line: 160, prev: 0, next: 1000 },
  { id: PARA.cell, align: 'LEFT', line: 130, prev: 0, next: 0 },
  { id: PARA.cellCenter, align: 'CENTER', line: 130, prev: 0, next: 0 },
  { id: PARA.heading, align: 'LEFT', line: 160, prev: 1400, next: 300 },
];
/** 덧붙이는 테두리 id: 3 = 실선, 4 = 실선 + 옅은 회색 바탕 */
export const BORDER = { cell: 3, headerCell: 4 } as const;

const esc = (s: string) =>
  s
    // XML 1.0에서 쓸 수 없는 제어 문자 제거
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function borderFill(id: number, fill: string | null) {
  const line = (side: string) => `<hh:${side} type="SOLID" width="0.12 mm" color="#000000"/>`;
  return (
    `<hh:borderFill id="${id}" threeD="0" shadow="0" centerLine="NONE" breakCellSeparateLine="0"><hh:slash type="NONE" Crooked="0" isCounter="0"/><hh:backSlash type="NONE" Crooked="0" isCounter="0"/>` +
    `${line('leftBorder')}${line('rightBorder')}${line('topBorder')}${line('bottomBorder')}<hh:diagonal type="NONE" width="0.12 mm" color="#000000"/>` +
    (fill ? `<hc:fillBrush><hc:winBrush faceColor="${fill}" hatchColor="#FF000000" alpha="0"/></hc:fillBrush>` : '') +
    `</hh:borderFill>`
  );
}

function bumpCount(xml: string, tag: string, add: number) {
  return xml.replace(new RegExp(`<hh:${tag} itemCnt="(\\d+)">`), (_, n) => `<hh:${tag} itemCnt="${Number(n) + add}">`);
}

/** 뼈대 header.xml에 글자 모양·문단 모양·테두리를 덧붙인다 */
export function buildHeader(base = headerXml): string {
  const char0 = base.match(/<hh:charPr id="0"[\s\S]*?<\/hh:charPr>/)?.[0];
  const para0 = base.match(/<hh:paraPr id="0"[\s\S]*?<\/hh:paraPr>/)?.[0];
  if (!char0 || !para0) throw new Error('HWPX 템플릿 header.xml 형식이 예상과 다릅니다.');
  const chars = CHAR_DEFS.map((d) => {
    let x = char0.replace('id="0"', `id="${d.id}"`).replace(/height="\d+"/, `height="${d.height}"`);
    if (d.bold) x = x.replace('<hh:underline', '<hh:bold/><hh:underline');
    return x;
  }).join('');
  const paras = PARA_DEFS.map((d) =>
    para0
      .replace('id="0"', `id="${d.id}"`)
      .replace(/<hh:align horizontal="\w+"/, `<hh:align horizontal="${d.align}"`)
      .replace(/<hh:lineSpacing type="PERCENT" value="\d+"/g, `<hh:lineSpacing type="PERCENT" value="${d.line}"`)
      .replace(/<hc:prev value="\d+"/g, `<hc:prev value="${d.prev}"`)
      .replace(/<hc:next value="\d+"/g, `<hc:next value="${d.next}"`),
  ).join('');
  let x = base;
  x = x.replace('</hh:borderFills>', `${borderFill(BORDER.cell, null)}${borderFill(BORDER.headerCell, '#EEEEEE')}</hh:borderFills>`);
  x = x.replace('</hh:charProperties>', `${chars}</hh:charProperties>`);
  x = x.replace('</hh:paraProperties>', `${paras}</hh:paraProperties>`);
  x = bumpCount(x, 'borderFills', 2);
  x = bumpCount(x, 'charProperties', CHAR_DEFS.length);
  x = bumpCount(x, 'paraProperties', PARA_DEFS.length);
  return x;
}

class SectionWriter {
  private id = 1;
  private nextPageBreak = false;
  out: string[] = [];

  para(text: string, paraPr: number, charPr: number) {
    const lines = text.split('\n');
    for (const line of lines) {
      const pb = this.nextPageBreak ? 1 : 0;
      this.nextPageBreak = false;
      this.out.push(`<hp:p id="${this.id++}" paraPrIDRef="${paraPr}" styleIDRef="0" pageBreak="${pb}" columnBreak="0" merged="0"><hp:run charPrIDRef="${charPr}">${line ? `<hp:t>${esc(line)}</hp:t>` : '<hp:t/>'}</hp:run></hp:p>`);
    }
  }
  pageBreak() {
    this.nextPageBreak = true;
  }
  private cellParas(c: Cell) {
    const paraPr = c.align === 'center' ? PARA.cellCenter : PARA.cell;
    const charPr = c.header ? CHAR.cellBold : CHAR.cell;
    return c.text
      .split('\n')
      .map((line) => `<hp:p id="${this.id++}" paraPrIDRef="${paraPr}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="${charPr}">${line ? `<hp:t>${esc(line)}</hp:t>` : '<hp:t/>'}</hp:run></hp:p>`)
      .join('');
  }
  table(b: Extract<Block, { kind: 'table' }>) {
    if (b.caption) this.para(b.caption, PARA.body, CHAR.cellBold);
    const cols = b.widths.length;
    const colW = b.widths.map((w) => Math.floor((CONTENT_W * w) / 100));
    colW[cols - 1] += CONTENT_W - colW.reduce((a, x) => a + x, 0);
    const ROW_H = 1000;
    const laid = layoutRows(b.rows, cols);
    const headerRow = b.rows[0]?.every((c) => c.header) && b.rows.length > 1;
    const rowsXml = laid
      .map((row, r) => {
        const tcs = row
          .map(({ cell: c, col, span }) => {
            const w = colW.slice(col, col + span).reduce((a, x) => a + x, 0);
            const rs = c.rowSpan ?? 1;
            return (
              `<hp:tc name="" header="${headerRow && r === 0 ? 1 : 0}" hasMargin="0" protect="0" editable="0" dirty="1" borderFillIDRef="${c.header ? BORDER.headerCell : BORDER.cell}">` +
              `<hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="CENTER" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">${this.cellParas(c)}</hp:subList>` +
              `<hp:cellAddr colAddr="${col}" rowAddr="${r}"/><hp:cellSpan colSpan="${span}" rowSpan="${rs}"/><hp:cellSz width="${w}" height="${ROW_H * rs}"/><hp:cellMargin left="425" right="425" top="141" bottom="141"/></hp:tc>`
            );
          })
          .join('');
        return `<hp:tr>${tcs}</hp:tr>`;
      })
      .join('');
    const pb = this.nextPageBreak ? 1 : 0;
    this.nextPageBreak = false;
    this.out.push(
      `<hp:p id="${this.id++}" paraPrIDRef="${PARA.body}" styleIDRef="0" pageBreak="${pb}" columnBreak="0" merged="0"><hp:run charPrIDRef="0">` +
        `<hp:tbl id="${this.id++}" zOrder="0" numberingType="TABLE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" pageBreak="CELL" repeatHeader="${headerRow ? 1 : 0}" rowCnt="${b.rows.length}" colCnt="${cols}" cellSpacing="0" borderFillIDRef="${BORDER.cell}" noAdjust="0">` +
        `<hp:sz width="${CONTENT_W}" widthRelTo="ABSOLUTE" height="${ROW_H * b.rows.length}" heightRelTo="ABSOLUTE" protect="0"/>` +
        `<hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="COLUMN" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/>` +
        `<hp:outMargin left="0" right="0" top="0" bottom="0"/><hp:inMargin left="425" right="425" top="141" bottom="141"/>${rowsXml}</hp:tbl></hp:run></hp:p>`,
    );
    this.para('', PARA.body, CHAR.small);
  }
}

export function buildSection(doc: ExportDoc, base = sectionXml): string {
  const w = new SectionWriter();
  for (const b of doc.blocks) {
    if (b.kind === 'title') w.para(b.text, PARA.center, CHAR.title);
    else if (b.kind === 'heading') w.para(b.text, PARA.heading, CHAR.heading);
    else if (b.kind === 'paragraph') w.para(b.text, PARA.body, b.small ? CHAR.small : CHAR.normal);
    else if (b.kind === 'list') b.items.forEach((it, i) => w.para(`${b.ordered ? `${i + 1}. ` : '• '}${it}`, PARA.body, CHAR.normal));
    else if (b.kind === 'table') w.table(b);
    else w.pageBreak();
  }
  // 첫 문단(구역 설정)은 그대로 두고 여백만 15mm로 바꾼 뒤 본문을 붙인다
  const head = base
    .replace(/<hp:margin [^>]*\/>/, `<hp:margin header="0" footer="0" gutter="0" left="${MARGIN}" right="${MARGIN}" top="${MARGIN}" bottom="${MARGIN}"/>`)
    .replace(/horzsize="\d+"/, `horzsize="${CONTENT_W}"`);
  if (!head.includes('</hs:sec>')) throw new Error('HWPX 템플릿 section0.xml 형식이 예상과 다릅니다.');
  return head.replace('</hs:sec>', `${w.out.join('')}</hs:sec>`);
}

function previewText(doc: ExportDoc) {
  return doc.blocks
    .flatMap((b) => (b.kind === 'title' || b.kind === 'heading' || b.kind === 'paragraph' ? [b.text] : b.kind === 'list' ? b.items : []))
    .join('\r\n')
    .slice(0, 1000);
}

export function toHwpx(doc: ExportDoc, now = new Date()): Uint8Array {
  const iso = now.toISOString().replace(/\.\d+Z$/, 'Z');
  const hpf = contentHpf
    .replace('<opf:title/>', `<opf:title>${esc(doc.title)}</opf:title>`)
    .replace(/synthetic-fixture-author/g, '영화 수업 설계 도우미')
    .replace(/(name="CreatedDate" content="text">)[^<]*/, `$1${iso}`)
    .replace(/(name="ModifiedDate" content="text">)[^<]*/, `$1${iso}`)
    .replace(/(name="date" content="text">)[^<]*/, `$1${iso}`);
  const files: Record<string, [Uint8Array, { level: 0 | 6 }]> = {
    // mimetype은 맨 앞, 압축하지 않고 저장해야 한다
    mimetype: [strToU8('application/hwp+zip'), { level: 0 }],
    'version.xml': [strToU8(versionXml), { level: 6 }],
    'Contents/header.xml': [strToU8(buildHeader()), { level: 6 }],
    'Contents/section0.xml': [strToU8(buildSection(doc)), { level: 6 }],
    'Preview/PrvText.txt': [strToU8(previewText(doc)), { level: 6 }],
    'settings.xml': [strToU8(settingsXml), { level: 6 }],
    'META-INF/container.rdf': [strToU8(containerRdf), { level: 6 }],
    'Contents/content.hpf': [strToU8(hpf), { level: 6 }],
    'META-INF/container.xml': [strToU8(containerXml), { level: 6 }],
    'META-INF/manifest.xml': [strToU8(manifestXml), { level: 6 }],
  };
  return zipSync(files, { mtime: now });
}
