// TTL → 앱용 JSON 컴파일러. 원본 문구는 가공하지 않고 그대로 옮긴다.
import type { CurriculumData, CurriculumNode, GagneData, ReadingData, TextData } from '../validation/schemas';
import { Graph, NS, RDF_TYPE, localName, shortId } from './rdf';

const F = (n: string) => NS.film + n;
const R = (n: string) => NS.reading + n;
const G = (n: string) => NS.gagne + n;
const T = (n: string) => NS.text + n;

// ---------------------------------------------------------------- 교육과정
export function compileCurriculum(g: Graph): CurriculumData {
  const competencies = g.instancesOf(F('Competency')).map((c) => ({ id: shortId(c), label: req(g.label(c), c) }));
  const nodes: CurriculumNode[] = [];
  const subjects = g.instancesOf(F('Subject')).map((s) => {
    const areaIris = g.iris(s, F('hasArea'));
    areaIris.forEach((a, i) => {
      const areaId = shortId(a);
      nodes.push({
        id: areaId,
        type: 'area',
        subjectId: shortId(s),
        parentIds: [shortId(s)],
        label: req(g.label(a), a),
        order: i + 1,
        description: g.literal(a, F('description')) ?? null,
        applicationNotes: g.literals(a, F('applicationNote')),
      });
      for (const c of g.iris(a, F('hasCoreIdea'))) {
        nodes.push({ id: shortId(c), type: 'coreIdea', subjectId: shortId(s), parentIds: [areaId], description: req(g.literal(c, F('description')), c) });
      }
      for (const e of g.iris(a, F('hasContentElement'))) {
        const types = g.iris(e, RDF_TYPE);
        const kind = types.includes(F('KnowledgeUnderstanding'))
          ? 'knowledge'
          : types.includes(F('ProcessSkill'))
            ? 'process'
            : types.includes(F('ValueAttitude'))
              ? 'value'
              : fail(`내용 요소 범주를 알 수 없음: ${e}`);
        nodes.push({
          id: shortId(e),
          type: 'element',
          subjectId: shortId(s),
          parentIds: [areaId],
          elementKind: kind,
          label: req(g.label(e), e),
          gradeBand: req(g.literal(e, F('gradeBand')), e),
        });
      }
      for (const st of g.iris(a, F('hasStandard'))) {
        nodes.push({
          id: shortId(st),
          type: 'standard',
          subjectId: shortId(s),
          parentIds: [areaId],
          standardCode: req(g.literal(st, F('standardCode')), st),
          standardText: req(g.literal(st, F('standardText')), st),
          standardExplanations: g.literals(st, F('standardExplanation')),
          targetVerb: req(g.literal(st, F('targetVerb')), st),
          targetFunctionIds: g.iris(st, F('targetFunction')).map(shortId),
          coversElementIds: g.iris(st, F('coversElement')).map(shortId),
        });
      }
    });
    return {
      id: shortId(s),
      label: req(g.label(s), s),
      courseCategory: req(g.literal(s, F('courseCategory')), s),
      description: req(g.literal(s, F('description')), s),
      areaIds: areaIris.map(shortId),
      competencyIds: g.iris(s, F('developsCompetency')).map(shortId),
    };
  });
  return { subjects, competencies, nodes };
}

// ---------------------------------------------------------------- 독서 기능·동사·전략
export function compileReading(g: Graph): ReadingData {
  const funcIris = g.instancesOf(R('ReadingFunction'));
  const functions = funcIris.map((f) => ({
    id: shortId(f),
    label: req(g.label(f), f),
    verbIds: g.iris(f, R('hasVerb')).map(shortId),
    strategyIds: g.iris(f, R('hasStrategy')).map(shortId),
  }));

  // 동사: 정의된 것 + 기능에서 참조만 되고 정의가 없는 것(IRI 이름으로 라벨 생성, 리포트에 표시)
  const verbIris = uniq([...g.instancesOf(R('ReadingVerb')), ...funcIris.flatMap((f) => g.iris(f, R('hasVerb')))]);
  const verbs = verbIris.map((v) => {
    const ttlLabel = g.label(v);
    return {
      id: shortId(v),
      label: ttlLabel ?? localName(v).replace(/^Verb_/, '').replace(/_/g, ' '),
      functionIds: funcIris.filter((f) => g.iris(f, R('hasVerb')).includes(v)).map(shortId),
      labelSource: (ttlLabel ? 'ttl' : 'iri') as 'ttl' | 'iri',
    };
  });

  const stratIris = uniq([...g.instancesOf(R('ReadingStrategy')), ...funcIris.flatMap((f) => g.iris(f, R('hasStrategy')))]);
  const strategies = stratIris.map((s) => ({
    id: shortId(s),
    label: g.label(s) ?? localName(s).replace(/^Strat_/, '').replace(/_/g, ' '),
    functionIds: funcIris.filter((f) => g.iris(f, R('hasStrategy')).includes(s)).map(shortId),
    procedure: [],
    suitableTextTypeIds: [],
    recommendedEvents: [],
    minutes: null,
    reviewStatus: 'draft' as const,
  }));
  return { functions, verbs, strategies };
}

// ---------------------------------------------------------------- 가네 9사태
export function compileGagne(g: Graph): GagneData {
  const lesson = g.instancesOf(G('InformationLiteracyLesson'))[0] ?? fail('가네.ttl에 수업 인스턴스가 없음');
  const labels = (s: string, p: string) => g.iris(s, p).map((o) => req(g.label(o), o));
  const events = g
    .iris(lesson, G('hasEvent'))
    .map((e) => {
      const seq = Number(req(g.literal(e, G('sequenceNumber')), e));
      const next = g.iris(e, G('nextEvent'))[0];
      return {
        id: shortId(e),
        seq,
        label: req(g.label(e), e),
        // 도입(1~3) / 전개(4~8) / 정리(9) — 가이드 §8.5
        phase: (seq <= 3 ? '도입' : seq <= 8 ? '전개' : '정리') as '도입' | '전개' | '정리',
        nextEventId: next ? shortId(next) : null,
        defaultStrategies: labels(e, G('hasStrategy')),
        reference: {
          resources: labels(e, G('usesResource')),
          activities: labels(e, G('hasActivity')),
          assessments: labels(e, G('hasAssessment')),
          exampleDescription: g.literal(e, G('exampleDescription')) ?? null,
        },
      };
    })
    .sort((a, b) => a.seq - b.seq);
  return { lessonLabel: req(g.label(lesson), lesson), events };
}

// ---------------------------------------------------------------- 텍스트 유형
export function compileText(g: Graph): TextData {
  const categories = g.instancesOf(T('TextClassificationCategory')).map((c) => ({ id: shortId(c), label: req(g.label(c), c) }));
  const types = g.instancesOf(T('TextTypeAttribute')).map((t) => ({
    id: shortId(t),
    categoryId: shortId(g.iris(t, T('hasCategory'))[0] ?? fail(`분류 기준 없음: ${t}`)),
    label: req(g.label(t), t),
    description: req(g.literal(t, T('contentDescription')), t),
  }));
  const attrProps = ['hasSourceMaterialType', 'hasStructureAndNavigation', 'hasFormat', 'hasContentType'].map(T);
  const examples = g.instancesOf(T('TextExample')).map((x) => ({
    id: shortId(x),
    label: req(g.label(x), x),
    attributeIds: attrProps.flatMap((p) => g.iris(x, p)).map(shortId),
    description: req(g.literal(x, T('contentDescription')), x),
  }));
  return { categories, types, examples };
}

// ---------------------------------------------------------------- 독서 기능 매칭 (가이드 §5.2)
export type FunctionSource = 'admin' | 'verb' | 'mapping' | 'none';

/**
 * 성취기준의 독서 기능 후보를 정한다.
 * 1) 관리자가 지정한 targetFunction → 2) targetVerb와 읽기 동사 정확 일치 → 3) 동사 매핑 사전 → 4) 없음(교사가 직접 선택)
 */
export function resolveFunctions(
  standard: { targetVerb: string; targetFunctionIds: string[] },
  reading: ReadingData,
  verbMappings: Record<string, string[]> = {},
): { functionIds: string[]; source: FunctionSource } {
  if (standard.targetFunctionIds.length) return { functionIds: standard.targetFunctionIds, source: 'admin' };
  const verb = reading.verbs.find((v) => v.label === standard.targetVerb);
  if (verb && verb.functionIds.length) return { functionIds: verb.functionIds, source: 'verb' };
  const mapped = verbMappings[standard.targetVerb];
  if (mapped && mapped.length) return { functionIds: mapped, source: 'mapping' };
  return { functionIds: [], source: 'none' };
}

// ---------------------------------------------------------------- 공통
function req(v: string | undefined, where: string): string {
  if (v === undefined || v === '') fail(`필수 값이 없음: ${where}`);
  return v as string;
}
function fail(msg: string): never {
  throw new Error(msg);
}
function uniq<T>(xs: T[]): T[] {
  return [...new Set(xs)];
}
