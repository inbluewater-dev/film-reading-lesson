// 체험판(demo) 빌드용 자리표시자 — 체험판은 로컬 모드만 쓰므로 Firebase SDK를 넣지 않는다.
import type { Services } from '../types';
export function createFirebaseServices(): Services {
  throw new Error('체험판에서는 Firebase 모드를 사용할 수 없습니다.');
}
