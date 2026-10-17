// 컴파일된 JSON의 스키마 (가이드 §7 데이터 모델). TTL → JSON 변환 결과는 반드시 이 스키마를 통과해야 한다.
import { z } from 'zod';

const id = z.string().regex(/^(cur|rs|gagne|tx):[^\s]+$/, '정규화된 ID(cur:/rs:/gagne:/tx:)여야 합니다');
const text = z.string().min(1);

// ---------- 교육과정 (영화과.ttl) ----------
export const Competency = z.object({ id, label: text });

export const Subject = z.object({
  id,
  label: text,
  courseCategory: text,
  description: text,
  areaIds: z.array(id).min(1),
  competencyIds: z.array(id),
});

const NodeBase = z.object({ id, subjectId: id, parentIds: z.array(id).min(1) });

export const AreaNode = NodeBase.extend({
  type: z.literal('area'),
  label: text,
  order: z.number().int().positive(),
  description: z.string().nullable(),
  applicationNotes: z.array(text),
});
export const CoreIdeaNode = NodeBase.extend({ type: z.literal('coreIdea'), description: text });
export const ElementNode = NodeBase.extend({
  type: z.literal('element'),
  elementKind: z.enum(['knowledge', 'process', 'value']),
  label: text,
  gradeBand: text,
});
export const StandardNode = NodeBase.extend({
  type: z.literal('standard'),
  standardCode: z.string().regex(/^\[12[가-힣]+\d{2}-\d{2}\]$/),
  standardText: text,
  standardExplanations: z.array(text).min(1),
  targetVerb: z.string().regex(/다$/),
  targetFunctionIds: z.array(id),
  coversElementIds: z.array(id),
});
export const CurriculumNode = z.discriminatedUnion('type', [AreaNode, CoreIdeaNode, ElementNode, StandardNode]);

export const CurriculumData = z.object({
  subjects: z.array(Subject),
  competencies: z.array(Competency),
  nodes: z.array(CurriculumNode),
});

// ---------- 독서 기능·동사·전략 (readstrategy.ttl) ----------
export const ReadingFunction = z.object({ id, label: text, verbIds: z.array(id), strategyIds: z.array(id) });
export const ReadingVerb = z.object({
  id,
  label: text,
  functionIds: z.array(id),
  /** 'ttl' = rdfs:label에서 가져옴, 'iri' = 정의가 없어 IRI 이름에서 만든 값(리포트 참고) */
  labelSource: z.enum(['ttl', 'iri']),
});
export const ReadingStrategy = z.object({
  id,
  label: text,
  functionIds: z.array(id),
  // 가이드 §5.3 확장 속성 — TTL에 없으므로 비어 있음(관리자가 채움)
  procedure: z.array(text),
  suitableTextTypeIds: z.array(id),
  recommendedEvents: z.array(z.number().int().min(1).max(9)),
  minutes: z.number().int().positive().nullable(),
  reviewStatus: z.enum(['draft', 'reviewed']),
});
export const ReadingData = z.object({
  functions: z.array(ReadingFunction),
  verbs: z.array(ReadingVerb),
  strategies: z.array(ReadingStrategy),
});

// ---------- 가네 9사태 (가네.ttl) ----------
export const GagneEvent = z.object({
  id,
  seq: z.number().int().min(1).max(9),
  label: text,
  phase: z.enum(['도입', '전개', '정리']),
  nextEventId: id.nullable(),
  defaultStrategies: z.array(text),
  /** 가네.ttl은 정보활용교육 사설 수업 사례 — '참고 예시'로만 사용 (가이드 §3.3-5) */
  reference: z.object({
    resources: z.array(text),
    activities: z.array(text),
    assessments: z.array(text),
    exampleDescription: z.string().nullable(),
  }),
});
export const GagneData = z.object({
  lessonLabel: text,
  events: z.array(GagneEvent).length(9),
});

// ---------- 텍스트 유형 (text.ttl) ----------
export const TextCategory = z.object({ id, label: text });
export const TextType = z.object({ id, categoryId: id, label: text, description: text });
export const TextExample = z.object({ id, label: text, attributeIds: z.array(id), description: text });
export const TextData = z.object({
  categories: z.array(TextCategory),
  types: z.array(TextType),
  examples: z.array(TextExample),
});

// ---------- 묶음 ----------
export const Manifest = z.object({
  ontologyVersion: z.string().regex(/^[0-9a-f]{12}$/),
  compiledAt: z.string(),
  sources: z.array(z.object({ file: text, origin: z.enum(['working', 'original']), sha256: z.string(), triples: z.number().int() })),
});

export type CurriculumData = z.infer<typeof CurriculumData>;
export type CurriculumNode = z.infer<typeof CurriculumNode>;
export type StandardNode = z.infer<typeof StandardNode>;
export type ReadingData = z.infer<typeof ReadingData>;
export type GagneData = z.infer<typeof GagneData>;
export type TextData = z.infer<typeof TextData>;
export type Manifest = z.infer<typeof Manifest>;
