// 카탈로그 — 컴파일된 교육과정·독서전략·가네·텍스트 유형 데이터에 관리자 수정분(오버라이드)을 합친 읽기 전용 보기.
// 원문(성취기준·해설·고려 사항)은 절대 바꾸지 않고, 관리자가 입력하는 연결 정보만 덧붙인다.
import { resolveFunctions, type FunctionSource } from '../ttl/compile';
import type { CurriculumData, CurriculumNode, GagneData, Manifest, ReadingData, StandardNode, TextData } from '../validation/schemas';

export type AreaNode = Extract<CurriculumNode, { type: 'area' }>;
export type CoreIdeaNode = Extract<CurriculumNode, { type: 'coreIdea' }>;
export type ElementNode = Extract<CurriculumNode, { type: 'element' }>;
export type ReadingPhase = 'before' | 'during' | 'after' | 'unset';

export const READING_PHASE_LABEL: Record<ReadingPhase, string> = { before: '읽기 전', during: '읽기 중', after: '읽기 후', unset: '미분류' };

export interface CatalogSource {
  manifest: Manifest;
  curriculum: CurriculumData;
  reading: ReadingData;
  gagne: GagneData;
  textTypes: TextData;
}

/** 관리자가 입력하는 값 (TTL 원문이 아닌 연결·보완 정보) */
export interface CatalogOverrides {
  /** 성취기준 ID → 독서 기능 ID (targetFunction) */
  standardFunctions: Record<string, string[]>;
  /** 성취기준 ID → 내용 요소 ID (coversElement) */
  standardElements: Record<string, string[]>;
  /** 동사(기본형) → 독서 기능 ID (§5.2 3단계 매핑 사전) */
  verbMappings: Record<string, string[]>;
  /** 전략 ID → 확장 속성 (§5.3) */
  strategies: Record<string, Partial<StrategyExtension>>;
  /** 독서 기능 ID → 읽기 전·중·후 (§8.4-5, 관리자 편집 데이터) */
  readingPhases: Record<string, ReadingPhase>;
}

export interface StrategyExtension {
  procedure: string[];
  suitableTextTypeIds: string[];
  recommendedEvents: number[];
  minutes: number | null;
  reviewStatus: 'draft' | 'reviewed';
  worksheetHint: string;
}

export const EMPTY_OVERRIDES: CatalogOverrides = { standardFunctions: {}, standardElements: {}, verbMappings: {}, strategies: {}, readingPhases: {} };

/**
 * 읽기 전·중·후 기본값 — 가이드 §8.4-5에 적힌 예시만 넣는다(“탐색·예측은 읽기 전, 이해·추론은 읽기 중, 비교·분류·평가는 읽기 후”).
 * 나머지 기능은 ‘미분류’로 두고 관리자가 정한다.
 */
export const DEFAULT_READING_PHASES: Record<string, ReadingPhase> = {
  'rs:Func_Exploration': 'before',
  'rs:Func_Prediction': 'before',
  'rs:Func_Understanding': 'during',
  'rs:Func_Inference': 'during',
  'rs:Func_Comparison': 'after',
  'rs:Func_Classification': 'after',
  'rs:Func_Evaluation': 'after',
};

export class Catalog {
  readonly subjects: CurriculumData['subjects'];
  readonly nodes: CurriculumNode[];
  readonly reading: ReadingData;
  private byId = new Map<string, CurriculumNode>();

  constructor(
    readonly source: CatalogSource,
    readonly overrides: CatalogOverrides,
  ) {
    this.subjects = source.curriculum.subjects;
    // 관리자 입력(연결 정보)을 성취기준에 합친다
    this.nodes = source.curriculum.nodes.map((n) =>
      n.type === 'standard'
        ? {
            ...n,
            targetFunctionIds: overrides.standardFunctions[n.id] ?? n.targetFunctionIds,
            coversElementIds: overrides.standardElements[n.id] ?? n.coversElementIds,
          }
        : n,
    );
    for (const n of this.nodes) this.byId.set(n.id, n);
    this.reading = {
      ...source.reading,
      strategies: source.reading.strategies.map((s) => ({ ...s, ...(overrides.strategies[s.id] ?? {}) })),
    };
  }

  get ontologyVersion(): string {
    return this.source.manifest.ontologyVersion;
  }
  get gagne(): GagneData {
    return this.source.gagne;
  }
  get textTypes(): TextData {
    return this.source.textTypes;
  }
  get competencies() {
    return this.source.curriculum.competencies;
  }

  node(id: string): CurriculumNode | undefined {
    return this.byId.get(id);
  }
  subject(id: string) {
    return this.subjects.find((s) => s.id === id);
  }
  areasOf(subjectId: string): AreaNode[] {
    return this.nodes.filter((n): n is AreaNode => n.type === 'area' && n.subjectId === subjectId).sort((a, b) => a.order - b.order);
  }
  childrenOf<T extends CurriculumNode['type']>(areaId: string, type: T): Extract<CurriculumNode, { type: T }>[] {
    return this.nodes.filter((n) => n.type === type && n.parentIds.includes(areaId)) as Extract<CurriculumNode, { type: T }>[];
  }
  standards(): StandardNode[] {
    return this.nodes.filter((n): n is StandardNode => n.type === 'standard');
  }
  /** 노드가 속한 영역 */
  areaOf(node: CurriculumNode): AreaNode | undefined {
    if (node.type === 'area') return node;
    return this.byId.get(node.parentIds[0]) as AreaNode | undefined;
  }

  functionLabel(id: string): string {
    return this.reading.functions.find((f) => f.id === id)?.label ?? id;
  }
  strategy(id: string) {
    return this.reading.strategies.find((s) => s.id === id);
  }
  readingPhaseOf(functionId: string): ReadingPhase {
    return this.overrides.readingPhases[functionId] ?? DEFAULT_READING_PHASES[functionId] ?? 'unset';
  }

  /** 성취기준의 독서 기능 후보와 그 출처 (§5.2) */
  functionsFor(standard: StandardNode): { functionIds: string[]; source: FunctionSource } {
    return resolveFunctions(standard, this.reading, this.overrides.verbMappings);
  }

  /** 키워드 검색 — 라벨·원문·코드·해설에서 찾는다 (공백 무시) */
  search(query: string, subjectId?: string): CurriculumNode[] {
    const q = normalize(query);
    if (!q) return [];
    return this.nodes.filter((n) => (!subjectId || n.subjectId === subjectId) && normalize(searchText(n)).includes(q));
  }
}

export function nodeTitle(n: CurriculumNode): string {
  switch (n.type) {
    case 'area':
    case 'element':
      return n.label;
    case 'coreIdea':
      return n.description;
    case 'standard':
      return `${n.standardCode} ${n.standardText}`;
  }
}

function searchText(n: CurriculumNode): string {
  switch (n.type) {
    case 'area':
      return [n.label, n.description ?? '', ...n.applicationNotes].join(' ');
    case 'coreIdea':
      return n.description;
    case 'element':
      return n.label;
    case 'standard':
      return [n.standardCode, n.standardText, ...n.standardExplanations].join(' ');
  }
}

const normalize = (s: string) => s.replace(/\s+/g, '').toLowerCase();

export const ELEMENT_KIND_LABEL = { knowledge: '지식·이해', process: '과정·기능', value: '가치·태도' } as const;
