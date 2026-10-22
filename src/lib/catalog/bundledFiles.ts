// 앱에 함께 묶인 원문 TTL (관리자 TTL 비교·내보내기용). 필요할 때만 불러온다.
import type { SourceFiles } from '../ttl/sourceFiles';

export async function bundledFiles(): Promise<SourceFiles> {
  const m = await import('../../../data/compiled/sources.json');
  return (m.default ?? m) as SourceFiles;
}
