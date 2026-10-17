// TTL 파일 목록. data/ttl/working에 같은 이름의 작업본이 있으면 그것을 우선 사용한다 (원본은 data/ttl/original에 보존).
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export const SOURCE_FILES = {
  curriculum: '영화과.ttl',
  reading: 'readstrategy.ttl',
  gagne: '가네.ttl',
  text: 'text.ttl',
} as const;
export type SourceKey = keyof typeof SOURCE_FILES;

/** 컴파일에 쓸 파일 경로 (작업본 우선) */
export function resolveSource(root: string, file: string): { path: string; origin: 'working' | 'original' } {
  const working = join(root, 'data/ttl/working', file);
  if (existsSync(working)) return { path: working, origin: 'working' };
  return { path: join(root, 'data/ttl/original', file), origin: 'original' };
}
