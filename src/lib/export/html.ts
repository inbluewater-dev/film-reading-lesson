// 인쇄(PDF)용 HTML: A4 인쇄 CSS. 미리보기(iframe)·인쇄·HTML 파일 저장에 같은 결과를 쓴다
import { layoutRows } from './docx';
import type { Block, ExportDoc } from './model';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const br = (s: string) => esc(s).replace(/\n/g, '<br>');

export const PRINT_CSS = `
@page { size: A4; margin: 15mm; }
* { box-sizing: border-box; }
html { background: #fff; color: #000; }
body { margin: 0; padding: 12mm; font-family: "Malgun Gothic", "맑은 고딕", "Apple SD Gothic Neo", "Noto Sans KR", "Noto Sans CJK KR", sans-serif; font-size: 10pt; line-height: 1.6; }
@media print { body { padding: 0; } }
h1 { font-size: 16pt; text-align: center; margin: 0 0 10pt; text-wrap: balance; }
h2 { font-size: 12pt; margin: 14pt 0 4pt; break-after: avoid; }
p { margin: 0 0 6pt; }
p.small { font-size: 8pt; color: #333; }
ol, ul { margin: 0 0 6pt; padding-left: 18pt; }
li { margin: 0 0 2pt; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; margin: 0 0 8pt; font-size: 9pt; line-height: 1.35; }
th, td { border: 0.5pt solid #000; padding: 3pt 4pt; vertical-align: middle; text-align: left; overflow-wrap: anywhere; }
th { background: #eee; font-weight: 700; }
.c { text-align: center; }
thead { display: table-header-group; }
tr { break-inside: avoid; }
caption { text-align: left; font-weight: 700; padding-bottom: 3pt; }
.pb { break-before: page; }
@media screen { .pb { border-top: 1px dashed #999; margin: 18pt 0; } }
`;

function table(b: Extract<Block, { kind: 'table' }>): string {
  const laid = layoutRows(b.rows, b.widths.length);
  const head = b.rows.length > 1 && b.rows[0].every((c) => c.header);
  const tr = (row: (typeof laid)[number]) =>
    `<tr>${row
      .map(({ cell: c, span }) => {
        const tag = c.header ? 'th' : 'td';
        const attrs = `${span > 1 ? ` colspan="${span}"` : ''}${(c.rowSpan ?? 1) > 1 ? ` rowspan="${c.rowSpan}"` : ''}${c.align === 'center' ? ' class="c"' : ''}`;
        return `<${tag}${attrs}>${br(c.text)}</${tag}>`;
      })
      .join('')}</tr>`;
  return (
    `<table>${b.caption ? `<caption>${esc(b.caption)}</caption>` : ''}<colgroup>${b.widths.map((w) => `<col style="width:${w}%">`).join('')}</colgroup>` +
    (head ? `<thead>${tr(laid[0])}</thead><tbody>${laid.slice(1).map(tr).join('')}</tbody>` : `<tbody>${laid.map(tr).join('')}</tbody>`) +
    `</table>`
  );
}

export function docBody(doc: ExportDoc): string {
  let pb = false;
  const out: string[] = [];
  const cls = (extra = '') => {
    const c = [extra, pb ? 'pb' : ''].filter(Boolean).join(' ');
    pb = false;
    return c ? ` class="${c}"` : '';
  };
  for (const b of doc.blocks) {
    if (b.kind === 'pageBreak') pb = true;
    else if (b.kind === 'title') out.push(`<h1${cls()}>${br(b.text)}</h1>`);
    else if (b.kind === 'heading') out.push(`<h2${cls()}>${br(b.text)}</h2>`);
    else if (b.kind === 'paragraph') out.push(`<p${cls(b.small ? 'small' : '')}>${br(b.text)}</p>`);
    else if (b.kind === 'list') out.push(`<${b.ordered ? 'ol' : 'ul'}${cls()}>${b.items.map((i) => `<li>${br(i)}</li>`).join('')}</${b.ordered ? 'ol' : 'ul'}>`);
    else out.push(pb ? `<div${cls()}>${table(b)}</div>` : table(b));
  }
  return out.join('\n');
}

export function toHtml(doc: ExportDoc): string {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${esc(doc.title)}</title><style>${PRINT_CSS}</style></head><body>${docBody(doc)}</body></html>`;
}
