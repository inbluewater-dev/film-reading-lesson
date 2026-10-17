// N3.js 기반 TTL 파싱과 조회 도우미
import { Parser, type Quad, type Term } from 'n3';

export const NS = {
  rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
  owl: 'http://www.w3.org/2002/07/owl#',
  film: 'https://example.org/curriculum/film#',
  reading: 'http://example.org/reading#',
  gagne: 'http://example.org/il-lesson/',
  text: 'http://example.org/pisa#',
} as const;

export const RDF_TYPE = NS.rdf + 'type';
export const RDFS_LABEL = NS.rdfs + 'label';

/**
 * 파일별 네임스페이스를 앱 내부 접두사로 정규화한다 (가이드 §3.3-4).
 * 네 파일 모두 `ex:`를 쓰지만 가리키는 IRI가 달라 그대로 합치면 충돌한다.
 */
export const PREFIX_OF: Record<string, string> = {
  [NS.film]: 'cur',
  [NS.reading]: 'rs',
  [NS.gagne]: 'gagne',
  [NS.text]: 'tx',
};

export function shortId(iri: string): string {
  for (const [ns, prefix] of Object.entries(PREFIX_OF)) {
    if (iri.startsWith(ns)) return `${prefix}:${iri.slice(ns.length)}`;
  }
  return iri;
}

export function localName(iri: string): string {
  const i = Math.max(iri.lastIndexOf('#'), iri.lastIndexOf('/'));
  return iri.slice(i + 1);
}

/** TTL을 파싱해 파일에 적힌 순서 그대로의 triple 배열을 돌려준다 (중복 triple 제거) */
export function parseTurtle(text: string, baseIRI?: string): Quad[] {
  const seen = new Set<string>();
  const out: Quad[] = [];
  for (const q of new Parser({ baseIRI }).parse(text)) {
    const key = `${q.subject.termType}|${q.subject.value}|${q.predicate.value}|${q.object.termType}|${q.object.value}|${q.object.termType === 'Literal' ? (q.object as { language?: string }).language ?? '' : ''}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(q);
    }
  }
  return out;
}

/** 작은 그래프(수천 triple)용 조회 도우미 — 결과는 항상 파일 순서 */
export class Graph {
  constructor(readonly all: Quad[]) {}

  static fromTurtle(text: string): Graph {
    return new Graph(parseTurtle(text));
  }

  get size(): number {
    return this.all.length;
  }

  quads(s?: string | null, p?: string | null, o?: string | null): Quad[] {
    return this.all.filter(
      (q) => (s == null || q.subject.value === s) && (p == null || q.predicate.value === p) && (o == null || q.object.value === o),
    );
  }

  /** 주어(s)의 술어(p) 값 중 IRI 목록 */
  iris(s: string, p: string): string[] {
    return this.quads(s, p).filter((q) => q.object.termType === 'NamedNode').map((q) => q.object.value);
  }

  /** 주어(s)의 술어(p) 값 중 리터럴 문자열 목록 (파일에 적힌 순서) */
  literals(s: string, p: string): string[] {
    return this.quads(s, p).filter((q) => q.object.termType === 'Literal').map((q) => q.object.value);
  }

  literal(s: string, p: string): string | undefined {
    return this.literals(s, p)[0];
  }

  label(s: string): string | undefined {
    return this.literal(s, RDFS_LABEL);
  }

  /** 클래스 c의 인스턴스 (파일에 처음 등장한 순서) */
  instancesOf(c: string): string[] {
    return this.quads(null, RDF_TYPE, c).map((q) => q.subject.value);
  }

  /** 주어로 한 번이라도 등장하는(정의된) IRI */
  definedSubjects(): Set<string> {
    const out = new Set<string>();
    for (const q of this.quads()) if (q.subject.termType === 'NamedNode') out.add(q.subject.value);
    return out;
  }

  isNamed(t: Term): boolean {
    return t.termType === 'NamedNode';
  }
}
