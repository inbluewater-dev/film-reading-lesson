// TTL 파일 목록 (브라우저·Node 공용). 경로 결정은 Node 전용 sources.ts에서 한다.
export const SOURCE_FILES = {
  curriculum: '영화과.ttl',
  reading: 'readstrategy.ttl',
  gagne: '가네.ttl',
  text: 'text.ttl',
} as const;
export type SourceKey = keyof typeof SOURCE_FILES;
export const SOURCE_KEYS = Object.keys(SOURCE_FILES) as SourceKey[];
export const SOURCE_LABEL: Record<SourceKey, string> = {
  curriculum: '교육과정 (영화과.ttl)',
  reading: '독서전략 (readstrategy.ttl)',
  gagne: '가네 9사태 (가네.ttl)',
  text: '텍스트 유형 (text.ttl)',
};
export type SourceFiles = Record<SourceKey, string>;
