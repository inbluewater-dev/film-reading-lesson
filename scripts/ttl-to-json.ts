// TTL(원본 4개) → JSON 컴파일 + 스키마 검증. 실패하면 오류 위치를 출력하고 종료 코드 1.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ZodTypeAny } from 'zod';
import { compileCurriculum, compileGagne, compileReading, compileText } from '../src/lib/ttl/compile';
import { Graph } from '../src/lib/ttl/rdf';
import { SOURCE_FILES, type SourceKey } from '../src/lib/ttl/sources';
import * as S from '../src/lib/validation/schemas';

const ROOT = join(import.meta.dirname, '..');
const SRC = join(ROOT, 'data/ttl/original');
const OUT = join(ROOT, 'data/compiled');

const sources = Object.entries(SOURCE_FILES).map(([key, file]) => {
  const text = readFileSync(join(SRC, file), 'utf-8');
  return { key: key as SourceKey, file, text, sha256: createHash('sha256').update(text).digest('hex'), graph: Graph.fromTurtle(text) };
});
const graph = (k: SourceKey) => sources.find((s) => s.key === k)!.graph;

const outputs: [string, ZodTypeAny, unknown][] = [
  ['curriculum.json', S.CurriculumData, compileCurriculum(graph('curriculum'))],
  ['reading.json', S.ReadingData, compileReading(graph('reading'))],
  ['gagne.json', S.GagneData, compileGagne(graph('gagne'))],
  ['textTypes.json', S.TextData, compileText(graph('text'))],
];

let failed = false;
for (const [file, schema, data] of outputs) {
  const r = schema.safeParse(data);
  if (!r.success) {
    failed = true;
    console.error(`✗ ${file} 스키마 검증 실패`);
    for (const issue of r.error.issues.slice(0, 20)) console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
}
if (failed) process.exit(1);

const ontologyVersion = createHash('sha256').update(sources.map((s) => s.sha256).join('')).digest('hex').slice(0, 12);
const manifest = S.Manifest.parse({
  ontologyVersion,
  compiledAt: new Date().toISOString(),
  sources: sources.map((s) => ({ file: s.file, sha256: s.sha256, triples: s.graph.size })),
});

mkdirSync(OUT, { recursive: true });
for (const [file, , data] of outputs) writeFileSync(join(OUT, file), JSON.stringify(data, null, 2) + '\n');
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`✓ 컴파일 완료 (ontologyVersion ${ontologyVersion})`);
for (const s of sources) console.log(`  ${s.file}: ${s.graph.size} triples`);
