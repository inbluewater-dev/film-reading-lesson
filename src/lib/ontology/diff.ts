// 두 버전의 컴파일 결과 비교 (가이드 §4: 변경 미리보기 — 추가/수정/삭제)
import type { CatalogOverrides, CatalogSource } from '../catalog/catalog';

export type ChangeKind = 'added' | 'removed' | 'changed';
export interface Change {
  group: string;
  id: string;
  label: string;
  kind: ChangeKind;
  fields: { field: string; before: string; after: string }[];
}

const FIELD_LABEL: Record<string, string> = {
  label: '이름',
  description: '설명',
  standardCode: '성취기준 코드',
  standardText: '성취기준 원문',
  standardExplanations: '성취기준 해설',
  applicationNotes: '적용 시 고려 사항',
  targetVerb: '끝 동사',
  targetFunctionIds: '독서 기능 연결',
  coversElementIds: '내용 요소 연결',
  parentIds: '상위 항목',
  gradeBand: '학년군',
  elementKind: '범주',
  order: '순서',
  courseCategory: '과목 구분',
  areaIds: '영역',
  competencyIds: '교과 역량',
  verbIds: '동사',
  strategyIds: '전략',
  functionIds: '독서 기능',
  procedure: '실행 절차',
  suitableTextTypeIds: '적합 텍스트 유형',
  recommendedEvents: '권장 사태',
  minutes: '권장 시간',
  reviewStatus: '검수 상태',
  worksheetHint: '활동지 형태',
  seq: '순서',
  phase: '단계',
  defaultStrategies: '기본 전략',
  reference: '참고 사례',
  categoryId: '분류 기준',
  attributeIds: '속성',
  labelSource: '이름 출처',
  nextEventId: '다음 사태',
};

const show = (v: unknown): string => (v === null || v === undefined ? '—' : typeof v === 'string' ? v : Array.isArray(v) && v.every((x) => typeof x === 'string') ? v.join(', ') : JSON.stringify(v));

function compare<T extends { id: string }>(group: string, before: T[], after: T[], labelOf: (x: T) => string): Change[] {
  const out: Change[] = [];
  const a = new Map(before.map((x) => [x.id, x]));
  const b = new Map(after.map((x) => [x.id, x]));
  for (const [id, x] of b) {
    const old = a.get(id);
    if (!old) {
      out.push({ group, id, label: labelOf(x), kind: 'added', fields: [] });
      continue;
    }
    const fields: Change['fields'] = [];
    for (const k of new Set([...Object.keys(old), ...Object.keys(x)])) {
      if (k === 'id') continue;
      const ov = (old as Record<string, unknown>)[k];
      const nv = (x as Record<string, unknown>)[k];
      if (JSON.stringify(ov) !== JSON.stringify(nv)) fields.push({ field: FIELD_LABEL[k] ?? k, before: show(ov), after: show(nv) });
    }
    if (fields.length) out.push({ group, id, label: labelOf(x), kind: 'changed', fields });
  }
  for (const [id, x] of a) if (!b.has(id)) out.push({ group, id, label: labelOf(x), kind: 'removed', fields: [] });
  return out;
}

export function diffSources(before: CatalogSource, after: CatalogSource): Change[] {
  const nodeLabel = (n: CatalogSource['curriculum']['nodes'][number]) =>
    n.type === 'standard' ? `${n.standardCode} ${n.standardText}` : n.type === 'coreIdea' ? n.description : n.label;
  return [
    ...compare('과목', before.curriculum.subjects, after.curriculum.subjects, (s) => s.label),
    ...compare('교육과정 항목', before.curriculum.nodes, after.curriculum.nodes, nodeLabel),
    ...compare('교과 역량', before.curriculum.competencies, after.curriculum.competencies, (c) => c.label),
    ...compare('독서 기능', before.reading.functions, after.reading.functions, (f) => f.label),
    ...compare('동사', before.reading.verbs, after.reading.verbs, (v) => v.label),
    ...compare('독서전략', before.reading.strategies, after.reading.strategies, (s) => s.label),
    ...compare('가네 사태', before.gagne.events, after.gagne.events, (e) => `${e.seq}. ${e.label}`),
    ...compare('텍스트 유형', before.textTypes.types, after.textTypes.types, (t) => t.label),
  ];
}

/** 새 버전에서 사라진 항목을 가리키는 관리자 입력(연결 정보) — 게시 전에 경고한다 */
export function orphanedOverrides(next: CatalogSource, o: CatalogOverrides): string[] {
  const nodes = new Set(next.curriculum.nodes.map((n) => n.id));
  const funcs = new Set(next.reading.functions.map((f) => f.id));
  const strategies = new Set(next.reading.strategies.map((s) => s.id));
  const out: string[] = [];
  for (const [id, fs] of Object.entries(o.standardFunctions)) {
    if (!nodes.has(id)) out.push(`독서 기능 연결: 성취기준 ${id}이(가) 새 버전에 없습니다.`);
    for (const f of fs) if (!funcs.has(f)) out.push(`독서 기능 연결: ${id} → ${f} 기능이 새 버전에 없습니다.`);
  }
  for (const [id, es] of Object.entries(o.standardElements)) {
    if (!nodes.has(id)) out.push(`내용 요소 연결: 성취기준 ${id}이(가) 새 버전에 없습니다.`);
    for (const e of es) if (!nodes.has(e)) out.push(`내용 요소 연결: ${id} → ${e} 내용 요소가 새 버전에 없습니다.`);
  }
  for (const [verb, fs] of Object.entries(o.verbMappings)) for (const f of fs) if (!funcs.has(f)) out.push(`동사 매핑: “${verb}” → ${f} 기능이 새 버전에 없습니다.`);
  for (const id of Object.keys(o.strategies)) if (!strategies.has(id)) out.push(`전략 보완: ${id} 전략이 새 버전에 없습니다.`);
  for (const id of Object.keys(o.readingPhases)) if (!funcs.has(id)) out.push(`읽기 단계: ${id} 기능이 새 버전에 없습니다.`);
  return out;
}
