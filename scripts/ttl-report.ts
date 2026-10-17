// TTL 점검 리포트 (가이드 §3.3의 8개 항목 + 파일별 무결성 점검) → docs/reports/ttl-analysis.md
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { compileCurriculum, compileReading, resolveFunctions } from '../src/lib/ttl/compile';
import { Graph, NS, RDF_TYPE, RDFS_LABEL, localName } from '../src/lib/ttl/rdf';
import { SOURCE_FILES, type SourceKey } from '../src/lib/ttl/sources';
import type { StandardNode } from '../src/lib/validation/schemas';

const ROOT = join(import.meta.dirname, '..');
const NS_OF: Record<SourceKey, string> = { curriculum: NS.film, reading: NS.reading, gagne: NS.gagne, text: NS.text };
const SCHEMA_NS = [NS.rdf, NS.rdfs, NS.owl, 'http://www.w3.org/2001/XMLSchema#', 'http://purl.org/dc/elements/1.1/'];
// 파일별 최상위(다른 노드가 가리키지 않는 것이 정상인) 클래스
const ROOT_TYPES: Record<SourceKey, string[]> = {
  curriculum: [NS.film + 'Subject'],
  reading: [NS.reading + 'ReadingFunction'],
  gagne: [NS.gagne + 'InformationLiteracyLesson'],
  text: [NS.text + 'TextTypeAttribute', NS.text + 'TextExample'],
};
const OWL_META = ['Class', 'ObjectProperty', 'DatatypeProperty', 'TransitiveProperty', 'Ontology', 'Restriction'].map((n) => NS.owl + n);

const graphs = Object.fromEntries(
  Object.entries(SOURCE_FILES).map(([k, f]) => [k, Graph.fromTurtle(readFileSync(join(ROOT, 'data/ttl/original', f), 'utf-8'))]),
) as Record<SourceKey, Graph>;

const L: string[] = [];
const w = (s = '') => L.push(s);
const table = (head: string[], rows: (string | number)[][]) => {
  w(`| ${head.join(' | ')} |`);
  w(`|${head.map(() => '---').join('|')}|`);
  for (const r of rows) w(`| ${r.join(' | ')} |`);
  w();
};

w('# TTL 분석 리포트 (Phase 1)');
w();
w(`- 생성: ${new Date().toISOString().slice(0, 10)} · 대상: \`data/ttl/original\`의 4개 파일`);
w('- 생성 명령: `npm run report:ttl` (내용은 TTL을 실제로 파싱해 계산한 값)');
w();

// ------------------------------------------------------------ 1. 파일별 개요·무결성
w('## 1. 파일별 개요와 무결성 점검');
w();
const integrity: Record<string, { noLabel: string[]; undefinedRefs: string[]; unreferenced: string[]; dupLabels: string[] }> = {};
const overviewRows: (string | number)[][] = [];
for (const [key, file] of Object.entries(SOURCE_FILES) as [SourceKey, string][]) {
  const g = graphs[key];
  const ns = NS_OF[key];
  const inNs = (iri: string) => iri.startsWith(ns);
  const defined = g.definedSubjects();
  // 클래스·속성 선언이 아닌 '인스턴스'
  const instances = [...defined].filter((s) => inNs(s) && g.iris(s, RDF_TYPE).some((t) => !OWL_META.includes(t) && !SCHEMA_NS.some((n) => t.startsWith(n))));
  const classCounts = new Map<string, number>();
  for (const s of instances) for (const t of g.iris(s, RDF_TYPE)) if (inNs(t)) classCounts.set(localName(t), (classCounts.get(localName(t)) ?? 0) + 1);

  const props = new Set(g.quads(null, RDF_TYPE).filter((q) => [NS.owl + 'ObjectProperty', NS.owl + 'DatatypeProperty'].includes(q.object.value)).map((q) => q.subject.value));
  const referenced = new Set(
    g.all.filter((q) => q.predicate.value !== RDF_TYPE && q.object.termType === 'NamedNode' && inNs(q.object.value) && !props.has(q.object.value)).map((q) => q.object.value),
  );
  const noLabel = instances.filter((s) => !g.label(s) && !g.literal(s, ns + 'description') && !g.literal(s, ns + 'standardCode'));
  const undefinedRefs = [...referenced].filter((o) => !defined.has(o));
  const ontologyIris = new Set(g.instancesOf(NS.owl + 'Ontology'));
  const unreferenced = instances.filter((s) => !referenced.has(s) && !ontologyIris.has(s) && !g.iris(s, RDF_TYPE).some((t) => ROOT_TYPES[key].includes(t)));
  const labelMap = new Map<string, string[]>();
  for (const s of instances) {
    const l = g.label(s);
    if (l) labelMap.set(l, [...(labelMap.get(l) ?? []), localName(s)]);
  }
  const dupLabels = [...labelMap].filter(([, v]) => v.length > 1).map(([l, v]) => `“${l}” (${v.join(', ')})`);
  integrity[file] = { noLabel: noLabel.map(localName), undefinedRefs: undefinedRefs.map(localName), unreferenced: unreferenced.map(localName), dupLabels };
  const langTagged = g.quads(null, RDFS_LABEL).filter((q) => (q.object as { language?: string }).language === 'ko').length;
  overviewRows.push([
    `\`${file}\``,
    `\`${ns}\``,
    g.size,
    [...classCounts].map(([c, n]) => `${c} ${n}`).join(', '),
    `${langTagged}/${g.quads(null, RDFS_LABEL).length}`,
  ]);
}
table(['파일', '네임스페이스(ex:)', 'triple', '클래스별 인스턴스 수', '@ko 라벨'], overviewRows);

table(
  ['파일', '라벨 없는 인스턴스', '참조되지만 정의 없음', '고아 노드(최상위 제외, 아무도 참조 안 함)', '중복 라벨'],
  Object.entries(integrity).map(([f, r]) => [
    `\`${f}\``,
    r.noLabel.length ? r.noLabel.join(', ') : '없음',
    r.undefinedRefs.length ? `**${r.undefinedRefs.join(', ')}**` : '없음',
    r.unreferenced.length ? r.unreferenced.join(', ') : '없음',
    r.dupLabels.length ? r.dupLabels.join('; ') : '없음',
  ]),
);

// ------------------------------------------------------------ 2. §3.3 8개 항목
const cur = compileCurriculum(graphs.curriculum);
const reading = compileReading(graphs.reading);
const standards = cur.nodes.filter((n): n is StandardNode => n.type === 'standard');
const subjectLabel = (id: string) => cur.subjects.find((s) => s.id === id)!.label;
const resolved = standards.map((s) => ({ s, r: resolveFunctions(s, reading) }));
const verbStats = new Map<string, { n: number; fn: string[] }>();
for (const { s, r } of resolved) {
  const v = verbStats.get(s.targetVerb) ?? { n: 0, fn: r.functionIds.map((f) => reading.functions.find((x) => x.id === f)!.label) };
  v.n++;
  verbStats.set(s.targetVerb, v);
}
const matched = resolved.filter((x) => x.r.source === 'verb').length;

const g = graphs;
const gagneLesson = g.gagne.instancesOf(NS.gagne + 'InformationLiteracyLesson')[0];
const hasStrategyGagne = NS.gagne + 'hasStrategy';
const hasStrategyReading = NS.reading + 'hasStrategy';
const rangeOf = (gr: Graph, p: string) => gr.iris(p, NS.rdfs + 'range').map(localName).join(', ');
const domainOf = (gr: Graph, p: string) => gr.iris(p, NS.rdfs + 'domain').map(localName).join(', ');
const textLabels = g.text.instancesOf(NS.text + 'TextTypeAttribute').map((t) => g.text.label(t) ?? '');
const videoLike = textLabels.filter((l) => /영상|동영상|멀티|영화/.test(l));
const stratProps = ['procedure', 'suitableTextType', 'recommendedEvent', 'minutes'].filter((p) => g.reading.quads(null, NS.reading + p).length > 0);

w('## 2. 가이드 §3.3 점검 항목');
w();
table(
  ['#', '항목', '점검 결과', '판정'],
  [
    [1, '단원·성취기준', `성취기준 ${standards.length}개(${cur.subjects.map((s) => `${s.label} ${standards.filter((x) => x.subjectId === s.id).length}`).join(', ')}). 모든 성취기준에 해설 ${standards.every((s) => s.standardExplanations.length > 0) ? '있음' : '누락 있음'}. Unit 클래스 ${g.curriculum.quads(NS.film + 'Unit').length ? '있음' : '없음'}(국가 교육과정에 단원 없음)`, '해결 — 탐색 경로는 영역 → 성취기준'],
    [2, '수록 과목', cur.subjects.map((s) => `${s.label}(${s.courseCategory})`).join(', '), '의도적 범위 — 실습 3과목은 Phase 11'],
    [3, '독서 기능 연결', `targetFunction 지정 ${standards.filter((s) => s.targetFunctionIds.length).length}/${standards.length}. 끝 동사가 읽기 동사와 정확히 일치 ${matched}/${standards.length}`, '관리자 화면에서 매핑 필요(아래 표)'],
    [4, '네임스페이스·속성 충돌', `4개 파일 모두 접두사 \`ex:\`이나 IRI가 서로 다름(영화과만 \`https://\`, 나머지 3개는 \`http://\`). \`hasStrategy\`: 가네(${domainOf(g.gagne, hasStrategyGagne)} → ${rangeOf(g.gagne, hasStrategyGagne)}) / 독서전략(${domainOf(g.reading, hasStrategyReading)} → ${rangeOf(g.reading, hasStrategyReading)})`, '컴파일 시 cur:/rs:/gagne:/tx: 로 분리 완료'],
    [5, '가네.ttl 성격', `수업 인스턴스 1개 “${g.gagne.label(gagneLesson)}”. 9개 사태의 전략·자료·활동·평가·예시가 모두 이 사설 수업 기준`, '사태 순서·이름만 템플릿으로 쓰고, 전략·예시는 “참고 예시”로 분리 저장'],
    [6, '독서전략 정보', `전략 ${reading.strategies.length}개 모두 이름만 있음. 확장 속성(procedure·suitableTextType·recommendedEvent·minutes) ${stratProps.length ? stratProps.join(', ') : '없음'}`, '컴파일 JSON에 빈 필드로 준비, reviewStatus=draft'],
    [7, '영상 텍스트 유형', `텍스트 속성 ${textLabels.length}개(${textLabels.join(', ')}). 영상 관련 속성 ${videoLike.length ? videoLike.join(', ') : '없음'}`, '§15-10 결정 필요'],
    [8, '성취기준 ↔ 내용 요소', `coversElement 지정 ${standards.filter((s) => s.coversElementIds.length).length}/${standards.length}`, '관리자 편집기에서 선택 입력'],
  ],
);

w('### 2-1. 성취기준 끝 동사와 읽기 동사 대응 (항목 3 상세)');
w();
table(
  ['끝 동사(targetVerb)', '성취기준 수', 'readstrategy.ttl 대응 기능'],
  [...verbStats].sort((a, b) => b[1].n - a[1].n).map(([v, x]) => [v, x.n, x.fn.length ? x.fn.join(', ') : '**없음 — 매핑 필요**']),
);
w('과목별로 보면:');
w();
table(
  ['과목', '자동 연결 가능', '매핑 필요'],
  cur.subjects.map((s) => {
    const rs = resolved.filter((x) => x.s.subjectId === s.id);
    return [subjectLabel(s.id), rs.filter((x) => x.r.source === 'verb').length, rs.filter((x) => x.r.source === 'none').length];
  }),
);

// ------------------------------------------------------------ 3. 그 밖의 발견 사항
const sharedVerbs = reading.verbs.filter((v) => v.functionIds.length > 1);
const sharedStrats = reading.strategies.filter((s) => s.functionIds.length > 1);
const guideNames = ['주의 획득', '학습목표 제시', '선수학습 재생', '학습자료 제시', '학습 지침 제공', '수행 요구', '피드백 제공', '수행 평가', '파지와 전이'];
const gagneNames = g.gagne.iris(gagneLesson, NS.gagne + 'hasEvent').map((e) => g.gagne.label(e) ?? '');
const nameDiff = gagneNames.map((n, i) => (n !== guideNames[i] ? `${i + 1}. ${guideNames[i]} → TTL “${n}”` : null)).filter(Boolean);

w('## 3. 그 밖의 발견 사항');
w();
w(`- **readstrategy.ttl에 정의가 빠진 동사**: ${integrity['readstrategy.ttl'].undefinedRefs.join(', ') || '없음'} — ‘적용’ 기능이 참조하지만 \`a ex:ReadingVerb ; rdfs:label\` 정의 줄이 없음. 컴파일 시 IRI 이름에서 라벨 “적용하다”를 만들고 \`labelSource: "iri"\`로 표시함. → **결정: 작업본 \`data/ttl/working/readstrategy.ttl\`에 정의 한 줄 추가**(원본은 보존). 컴파일은 작업본을 우선 사용.`);
w(`- **여러 기능에 속한 동사** ${sharedVerbs.length}개: ${sharedVerbs.map((v) => `${v.label}(${v.functionIds.map((f) => reading.functions.find((x) => x.id === f)!.label).join('·')})`).join(', ')} — 추천 시 두 기능 모두 후보가 됨.`);
w(`- **여러 기능에 속한 전략** ${sharedStrats.length}개 (예: ${sharedStrats.slice(0, 5).map((s) => s.label).join(', ')} …) — 정상(가이드 §3.2).`);
w(`- **가네 사태 이름이 가이드 표기와 다름** ${nameDiff.length}곳: ${nameDiff.join(' / ')}. 앱 화면에는 TTL 표기를 사용함.`);
w(`- **text.ttl 라벨에 언어 태그(@ko)가 없음** — 다른 파일과 달리 일반 문자열. 파싱에는 문제없음.`);
w(`- **영화과.ttl**: 내용 요소 ${cur.nodes.filter((n) => n.type === 'element').length}개 모두 gradeBand “고등학교”, 영역 ${cur.nodes.filter((n) => n.type === 'area').length}개 중 description 있는 영역 ${cur.nodes.filter((n) => n.type === 'area' && n.description).length}개(<영화와 삶> 3개 영역은 원문에 영역별 설명 문장이 없어 비어 있음).`);
w();
w('## 4. 컴파일 결과');
w();
w('`npm run compile:data` → `data/compiled/` (curriculum.json, reading.json, gagne.json, textTypes.json, manifest.json). 모든 파일이 `src/lib/validation/schemas.ts` 스키마를 통과해야 생성됨.');

mkdirSync(join(ROOT, 'docs/reports'), { recursive: true });
writeFileSync(join(ROOT, 'docs/reports/ttl-analysis.md'), L.join('\n') + '\n');
console.log('✓ docs/reports/ttl-analysis.md');
