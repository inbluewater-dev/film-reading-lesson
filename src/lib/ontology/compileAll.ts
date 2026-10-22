// 브라우저에서 TTL 네 파일을 컴파일·검증한다 (관리자 TTL 업로드, 게시된 버전 불러오기)
import type { CatalogSource } from '../catalog/catalog';
import { compileCurriculum, compileGagne, compileReading, compileText } from '../ttl/compile';
import { Graph } from '../ttl/rdf';
import { SOURCE_FILES, SOURCE_KEYS, type SourceFiles, type SourceKey } from '../ttl/sourceFiles';
import { ontologyVersionOf, sha256Hex } from '../util/hash';
import * as S from '../validation/schemas';

export interface FileReport {
  key: SourceKey;
  file: string;
  triples: number;
  /** 문법 오류(줄 번호 포함) 또는 필수 값 누락 */
  error?: string;
}
export interface CompileReport {
  ok: boolean;
  files: FileReport[];
  /** 스키마 검증 문제 (경로: 메시지) */
  issues: string[];
  stats: { subjects: number; standards: number; areas: number; elements: number; functions: number; verbs: number; strategies: number; gagneEvents: number; textTypes: number } | null;
  /** 정의되지 않은 동사처럼 컴파일은 되지만 확인이 필요한 점 */
  warnings: string[];
}

export async function compileSources(files: SourceFiles, compiledAt = new Date().toISOString()): Promise<{ source: CatalogSource | null; report: CompileReport }> {
  const graphs: Partial<Record<SourceKey, Graph>> = {};
  const fileReports: FileReport[] = [];
  for (const key of SOURCE_KEYS) {
    try {
      graphs[key] = Graph.fromTurtle(files[key]);
      fileReports.push({ key, file: SOURCE_FILES[key], triples: graphs[key]!.size });
    } catch (e) {
      fileReports.push({ key, file: SOURCE_FILES[key], triples: 0, error: `문법 오류: ${(e as Error).message}` });
    }
  }
  const report: CompileReport = { ok: false, files: fileReports, issues: [], stats: null, warnings: [] };
  if (fileReports.some((f) => f.error)) return { source: null, report };

  const step = <T,>(key: SourceKey, fn: () => T): T | null => {
    try {
      return fn();
    } catch (e) {
      fileReports.find((f) => f.key === key)!.error = (e as Error).message;
      return null;
    }
  };
  const gagne = step('gagne', () => compileGagne(graphs.gagne!));
  const curriculum = step('curriculum', () => compileCurriculum(graphs.curriculum!));
  const reading = step('reading', () => compileReading(graphs.reading!, gagne?.events ?? []));
  const textTypes = step('text', () => compileText(graphs.text!));
  if (!gagne || !curriculum || !reading || !textTypes) return { source: null, report };

  const checks: [string, { safeParse(v: unknown): { success: boolean; error?: { issues: { path: (string | number)[]; message: string }[] } } }, unknown][] = [
    ['교육과정', S.CurriculumData, curriculum],
    ['독서전략', S.ReadingData, reading],
    ['가네 9사태', S.GagneData, gagne],
    ['텍스트 유형', S.TextData, textTypes],
  ];
  for (const [label, schema, data] of checks) {
    const r = schema.safeParse(data);
    if (!r.success) for (const i of r.error!.issues.slice(0, 20)) report.issues.push(`${label} › ${i.path.join('.')}: ${i.message}`);
  }
  if (report.issues.length) return { source: null, report };

  for (const v of reading.verbs) if (v.labelSource === 'iri') report.warnings.push(`동사 ${v.id}에 rdfs:label 정의가 없어 IRI 이름(“${v.label}”)을 씁니다.`);
  if (curriculum.subjects.length === 0) report.warnings.push('과목이 하나도 없습니다.');

  const hashes = await Promise.all(SOURCE_KEYS.map((k) => sha256Hex(files[k])));
  const manifest = {
    ontologyVersion: await ontologyVersionOf(hashes),
    compiledAt,
    sources: SOURCE_KEYS.map((k, i) => ({ file: SOURCE_FILES[k], origin: 'original' as const, sha256: hashes[i], triples: graphs[k]!.size })),
  };
  const nodes = curriculum.nodes;
  report.stats = {
    subjects: curriculum.subjects.length,
    areas: nodes.filter((n) => n.type === 'area').length,
    elements: nodes.filter((n) => n.type === 'element').length,
    standards: nodes.filter((n) => n.type === 'standard').length,
    functions: reading.functions.length,
    verbs: reading.verbs.length,
    strategies: reading.strategies.length,
    gagneEvents: gagne.events.length,
    textTypes: textTypes.types.length,
  };
  report.ok = true;
  return { source: { manifest, curriculum, reading, gagne, textTypes }, report };
}
