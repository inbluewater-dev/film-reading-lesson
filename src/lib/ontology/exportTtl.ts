// TTL 내보내기 (가이드 §4): 게시된 TTL + 관리자가 앱에서 입력한 연결 정보(§5.1 targetFunction·coversElement, §5.3 전략 확장 속성)를
// 하나의 TTL로 다시 쓴다. 다시 업로드하면 같은 결과가 나와야 한다(왕복 테스트).
// 동사 매핑 사전·읽기 전/중/후 분류는 가이드에 TTL 속성이 정해져 있지 않아 ‘관리자 설정 JSON’으로 따로 내보낸다.
import { DataFactory, Parser, Writer, type Quad } from 'n3';
import type { CatalogOverrides, StrategyExtension } from '../catalog/catalog';
import { NS, PREFIX_OF } from '../ttl/rdf';
import type { SourceKey } from '../ttl/sourceFiles';

const { namedNode, literal, quad } = DataFactory;
const XSD_INTEGER = 'http://www.w3.org/2001/XMLSchema#integer';

/** 앱 내부 ID(cur:..., rs:...) → 원래 IRI */
export function toIri(shortId: string): string {
  const i = shortId.indexOf(':');
  const prefix = shortId.slice(0, i);
  const ns = Object.entries(PREFIX_OF).find(([, p]) => p === prefix)?.[0];
  return ns ? ns + shortId.slice(i + 1) : shortId;
}

function parseWithPrefixes(text: string): { quads: Quad[]; prefixes: Record<string, string> } {
  const prefixes: Record<string, string> = {};
  const quads = new Parser().parse(text, null as never, (p: string, iri: { value: string }) => {
    prefixes[p] = iri.value;
  }) as unknown as Quad[];
  return { quads, prefixes };
}

function write(quads: Quad[], prefixes: Record<string, string>): string {
  const w = new Writer({ prefixes });
  w.addQuads(quads);
  let out = '';
  w.end((err, result) => {
    if (err) throw err;
    out = result;
  });
  return out;
}

const STRATEGY_PROPS: { key: keyof StrategyExtension; pred: string }[] = [
  { key: 'procedure', pred: NS.reading + 'procedure' },
  { key: 'suitableTextTypeIds', pred: NS.reading + 'suitableTextType' },
  { key: 'recommendedEvents', pred: NS.reading + 'recommendedEvent' },
  { key: 'minutes', pred: NS.reading + 'minutes' },
  { key: 'reviewStatus', pred: NS.reading + 'reviewStatus' },
  { key: 'worksheetHint', pred: NS.reading + 'worksheetHint' },
];

/**
 * @param gagneEvents 권장 사태 번호 → 가네 사태 IRI 변환용
 */
export function exportTtl(key: SourceKey, text: string, o: CatalogOverrides, gagneEvents: { id: string; seq: number }[]): string {
  const { quads, prefixes } = parseWithPrefixes(text);
  const replace = new Map<string, Quad[]>(); // "주어|술어" → 새 값들
  const set = (s: string, p: string, objs: Quad['object'][]) => replace.set(`${s}|${p}`, objs.map((obj) => quad(namedNode(s), namedNode(p), obj)));

  if (key === 'curriculum') {
    for (const [id, fs] of Object.entries(o.standardFunctions)) set(toIri(id), NS.film + 'targetFunction', fs.map((f) => namedNode(toIri(f))));
    for (const [id, es] of Object.entries(o.standardElements)) set(toIri(id), NS.film + 'coversElement', es.map((e) => namedNode(toIri(e))));
  }
  if (key === 'reading') {
    for (const [id, ext] of Object.entries(o.strategies)) {
      const s = toIri(id);
      for (const { key: k, pred } of STRATEGY_PROPS) {
        if (!(k in ext)) continue;
        const v = ext[k];
        if (k === 'procedure') set(s, pred, (v as string[]).map((x) => literal(x)));
        else if (k === 'suitableTextTypeIds') set(s, pred, (v as string[]).map((x) => namedNode(toIri(x))));
        else if (k === 'recommendedEvents')
          set(s, pred, (v as number[]).flatMap((n) => {
            const e = gagneEvents.find((x) => x.seq === n);
            return e ? [namedNode(toIri(e.id))] : [];
          }));
        else if (k === 'minutes') set(s, pred, v === null || v === undefined ? [] : [literal(String(v), namedNode(XSD_INTEGER))]);
        else set(s, pred, v ? [literal(String(v))] : []);
      }
    }
  }
  if (replace.size === 0) return write(quads, prefixes);

  // 같은 주어·술어의 기존 값은 빼고, 새 값은 그 주어의 triple 묶음 끝에 넣는다 (원래 주어 순서 유지)
  const pendingBySubject = new Map<string, string[]>();
  for (const k of replace.keys()) {
    const s = k.slice(0, k.indexOf('|'));
    pendingBySubject.set(s, [...(pendingBySubject.get(s) ?? []), k]);
  }
  const out = quads.filter((q) => !replace.has(`${q.subject.value}|${q.predicate.value}`));
  const placed = new Set<string>();
  const order: string[] = [];
  const bySubject = new Map<string, Quad[]>();
  for (const q of out) {
    const s = q.subject.value;
    if (!bySubject.has(s)) {
      bySubject.set(s, []);
      order.push(s);
    }
    bySubject.get(s)!.push(q);
  }
  const final: Quad[] = [];
  for (const s of order) {
    final.push(...bySubject.get(s)!);
    for (const k of pendingBySubject.get(s) ?? []) {
      final.push(...replace.get(k)!);
      placed.add(k);
    }
  }
  // 원본에 없던 주어(드묾)는 끝에 붙인다
  for (const [k, qs] of replace) if (!placed.has(k)) final.push(...qs);
  return write(final, prefixes);
}

/** 동사 매핑 사전·읽기 단계 등 관리자 입력 전체를 JSON으로 (백업·복원용) */
export function exportOverridesJson(o: CatalogOverrides, ontologyVersion: string): string {
  return JSON.stringify({ kind: 'film-reading-lesson/overrides', version: 1, ontologyVersion, exportedAt: new Date().toISOString(), overrides: o }, null, 2);
}

export function parseOverridesJson(text: string): CatalogOverrides {
  const v = JSON.parse(text) as { kind?: string; overrides?: CatalogOverrides };
  if (v.kind !== 'film-reading-lesson/overrides' || !v.overrides) throw new Error('이 앱에서 내보낸 관리자 설정 파일이 아닙니다.');
  const o = v.overrides;
  for (const k of ['standardFunctions', 'standardElements', 'verbMappings', 'strategies', 'readingPhases'] as const) if (typeof o[k] !== 'object' || o[k] === null) throw new Error(`설정 파일에 ${k} 항목이 없습니다.`);
  return o;
}
