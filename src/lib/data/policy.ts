// 권한 정책 — firebase/firestore.rules 와 같은 규칙을 코드로 표현한 것.
// 로컬 어댑터는 모든 읽기·쓰기 전에 이 함수로 검사한다. Rules를 바꾸면 이 파일도 같이 바꾸고 테스트를 돌릴 것.
import type { UserProfile } from './types';

export type Actor = Pick<UserProfile, 'uid' | 'role' | 'active'> | null;

export const isSignedIn = (a: Actor): a is NonNullable<Actor> => a !== null;
export const isActive = (a: Actor) => isSignedIn(a) && a.active === true;
export const isAdmin = (a: Actor) => isActive(a) && a!.role === 'admin';

// ---------------------------------------------------------------- users/{uid}
export function canReadUser(a: Actor, uid: string): boolean {
  return isSignedIn(a) && (a.uid === uid || isAdmin(a));
}

/** 가입 신청: 본인 문서를, 교사·비활성으로만, 가입 코드가 일치할 때만 (관리자는 언제나 생성 가능) */
export function canCreateUser(
  a: Actor,
  uid: string,
  data: Pick<UserProfile, 'role' | 'active' | 'status'> & { inviteCode?: string },
  storedInviteCode: string,
): boolean {
  if (isAdmin(a)) return true;
  return (
    isSignedIn(a) &&
    a.uid === uid &&
    data.role === 'teacher' &&
    data.active === false &&
    data.status === 'pending' &&
    data.inviteCode === storedInviteCode
  );
}

/** 수정: 관리자는 모두, 본인은 role·active·status를 바꾸지 않는 경우만 */
export function canUpdateUser(a: Actor, before: UserProfile, after: UserProfile): boolean {
  if (isAdmin(a)) return true;
  return (
    isSignedIn(a) &&
    a.uid === before.uid &&
    after.role === before.role &&
    after.active === before.active &&
    after.status === before.status &&
    after.uid === before.uid &&
    after.loginId === before.loginId
  );
}

export function canDeleteUser(a: Actor): boolean {
  return isAdmin(a);
}

// ---------------------------------------------------------------- 교육과정·전략 등 공통 데이터
// promptTemplates: 실제 AI 호출(Phase 9)은 교사 브라우저에서 이루어지므로 활성 사용자가 읽을 수 있어야 한다
export const READABLE_COLLECTIONS = ['subjects', 'curriculumNodes', 'readingFunctions', 'readingStrategies', 'textTypes', 'gagneEvents', 'ontologyVersions', 'ontologyFiles', 'ontologyState', 'verbMappings', 'promptTemplates'] as const;
export const ADMIN_WRITABLE_COLLECTIONS = [...READABLE_COLLECTIONS, 'appConfig'] as const;

/** 읽기: 활성 사용자는 공통 데이터, 관리자는 appConfig·promptTemplates까지 */
export function canReadShared(a: Actor, collection: string): boolean {
  if (isAdmin(a) && (ADMIN_WRITABLE_COLLECTIONS as readonly string[]).includes(collection)) return true;
  return isActive(a) && (READABLE_COLLECTIONS as readonly string[]).includes(collection);
}
export function canWriteShared(a: Actor, collection: string): boolean {
  return isAdmin(a) && (ADMIN_WRITABLE_COLLECTIONS as readonly string[]).includes(collection);
}

/** appConfig/ai(하루 한도 등)는 활성 사용자도 읽는다 — 가입 코드(appConfig/signup)는 여전히 관리자만 */
export function canReadAiSettings(a: Actor): boolean {
  return isActive(a);
}

// ---------------------------------------------------------------- usage/{uid}_{날짜} (AI 사용 횟수)
export function canReadUsage(a: Actor, ownerUid: string): boolean {
  return isAdmin(a) || (isActive(a) && a!.uid === ownerUid);
}
/** 본인 기록만, 횟수는 늘리기만 */
export function canWriteUsage(a: Actor, ownerUid: string, before: number, after: number): boolean {
  return isActive(a) && a!.uid === ownerUid && after >= before;
}

// ---------------------------------------------------------------- materials / lessonPlans (교사 산출물)
export interface OwnedDoc {
  ownerUid: string;
  visibility: 'private' | 'shared';
}

/** 읽기: 활성 사용자는 자기 것 또는 공유된 것, 관리자는 모두 */
export function canReadOwned(a: Actor, doc: OwnedDoc): boolean {
  if (isAdmin(a)) return true;
  return isActive(a) && (doc.ownerUid === a!.uid || doc.visibility === 'shared');
}
export function canCreateOwned(a: Actor, doc: OwnedDoc): boolean {
  return isActive(a) && doc.ownerUid === a!.uid;
}
/** 수정: 소유자만, 소유자를 바꿀 수 없음 */
export function canUpdateOwned(a: Actor, before: OwnedDoc, after: OwnedDoc): boolean {
  return isActive(a) && before.ownerUid === a!.uid && after.ownerUid === before.ownerUid;
}
export function canDeleteOwned(a: Actor, doc: OwnedDoc): boolean {
  return isActive(a) && doc.ownerUid === a!.uid;
}
