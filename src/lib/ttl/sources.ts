// TTL 파일 경로 (Node 전용). data/ttl/working에 같은 이름의 작업본이 있으면 그것을 우선 사용한다 (원본은 data/ttl/original에 보존).
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export { SOURCE_FILES, type SourceKey } from './sourceFiles';

/** 컴파일에 쓸 파일 경로 (작업본 우선) */
export function resolveSource(root: string, file: string): { path: string; origin: 'working' | 'original' } {
  const working = join(root, 'data/ttl/working', file);
  if (existsSync(working)) return { path: working, origin: 'working' };
  return { path: join(root, 'data/ttl/original', file), origin: 'original' };
}
