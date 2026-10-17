// 원본 TTL 파일 목록 (data/ttl/original)
export const SOURCE_FILES = {
  curriculum: '영화과.ttl',
  reading: 'readstrategy.ttl',
  gagne: '가네.ttl',
  text: 'text.ttl',
} as const;
export type SourceKey = keyof typeof SOURCE_FILES;
