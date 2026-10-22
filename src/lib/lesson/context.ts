// 고른 교육과정 노드 → AI에 넘길 맥락(CurriculumContext). 수업은 한 과목 기준으로 만든다.
import type { CurriculumContext, MaterialParams } from '../ai/types';
import type { Catalog } from '../catalog/catalog';
import type { CurriculumNode, StandardNode } from '../validation/schemas';

/** 고른 노드가 속한 과목들 (성취기준이 있는 과목을 앞에) */
export function subjectsOf(catalog: Catalog, nodeIds: string[]): string[] {
  const nodes = nodeIds.map((id) => catalog.node(id)).filter((n): n is CurriculumNode => !!n);
  const order = [...nodes.filter((n) => n.type === 'standard'), ...nodes].map((n) => n.subjectId);
  return [...new Set(order)];
}

export function buildContext(catalog: Catalog, nodeIds: string[], subjectId: string): CurriculumContext {
  const subject = catalog.subject(subjectId)!;
  const nodes = nodeIds.map((id) => catalog.node(id)).filter((n): n is CurriculumNode => !!n && n.subjectId === subjectId);
  const areas = [...new Map(nodes.map((n) => catalog.areaOf(n)).filter((a) => !!a).map((a) => [a!.id, a!])).values()];
  const standards = nodes.filter((n): n is StandardNode => n.type === 'standard');
  return {
    subjectLabel: subject.label,
    courseCategory: subject.courseCategory,
    areas: areas.map((a) => ({ label: a.label, description: a.description, applicationNotes: a.applicationNotes })),
    // 핵심 아이디어를 직접 고르지 않았으면 해당 영역의 핵심 아이디어를 쓴다
    coreIdeas: (nodes.some((n) => n.type === 'coreIdea')
      ? nodes.filter((n) => n.type === 'coreIdea')
      : areas.flatMap((a) => catalog.childrenOf(a.id, 'coreIdea'))
    ).map((n) => (n.type === 'coreIdea' ? n.description : '')),
    standards: standards.map((s) => ({ id: s.id, code: s.standardCode, text: s.standardText, explanations: s.standardExplanations, targetVerb: s.targetVerb })),
    elements: nodes.flatMap((n) => (n.type === 'element' ? [{ label: n.label, kind: n.elementKind }] : [])),
    nodeIds: nodes.map((n) => n.id),
  };
}

export const DEFAULT_PARAMS: MaterialParams = {
  grade: null,
  length: 600,
  level: '보통',
  textType: { source: 'tx:SingleText', structure: 'tx:StaticText', format: 'tx:ContinuousText', content: 'tx:Exposition' },
  minutes: 50,
  films: [],
  extra: '',
};

/** AI 추천 영화 중 교사가 확인하지 않은 것이 있으면 생성할 수 없다 (가이드 §8.3) */
export function unconfirmedFilms(params: MaterialParams) {
  return params.films.filter((f) => f.source === 'ai' && !f.confirmed);
}
