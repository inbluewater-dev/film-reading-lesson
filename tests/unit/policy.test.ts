// 권한 정책 시나리오 — firebase/firestore.rules와 같은 규칙 (tests/rules/는 같은 시나리오를 에뮬레이터에서 검사)
import { describe, expect, it } from 'vitest';
import * as P from '../../src/lib/data/policy';
import type { UserProfile } from '../../src/lib/data/types';

const admin: P.Actor = { uid: 'a1', role: 'admin', active: true };
const teacher: P.Actor = { uid: 't1', role: 'teacher', active: true };
const other: P.Actor = { uid: 't2', role: 'teacher', active: true };
const pending: P.Actor = { uid: 'p1', role: 'teacher', active: false };
const inactiveAdmin: P.Actor = { uid: 'a2', role: 'admin', active: false };
const anon: P.Actor = null;

const profile = (uid: string, over: Partial<UserProfile> = {}): UserProfile => ({
  uid,
  loginId: uid + 'id',
  displayName: uid,
  role: 'teacher',
  active: true,
  status: 'approved',
  createdAt: '2026-10-17T00:00:00Z',
  ...over,
});
const CODE = 'film2026';

describe('users: 읽기', () => {
  it('1. 본인 프로필은 읽을 수 있다(승인 대기 중이어도)', () => expect(P.canReadUser(pending, 'p1')).toBe(true));
  it('2. 교사는 다른 사람 프로필을 읽을 수 없다', () => expect(P.canReadUser(teacher, 't2')).toBe(false));
  it('3. 관리자는 모든 프로필을 읽는다', () => expect(P.canReadUser(admin, 't2')).toBe(true));
  it('4. 비로그인은 읽을 수 없다', () => expect(P.canReadUser(anon, 't1')).toBe(false));
  it('5. 비활성 관리자는 관리자 권한이 없다', () => expect(P.canReadUser(inactiveAdmin, 't1')).toBe(false));
});

describe('users: 가입 신청(B안)', () => {
  const req = { role: 'teacher' as const, active: false, status: 'pending' as const, inviteCode: CODE };
  it('6. 가입 코드가 맞으면 본인 문서를 교사·비활성·대기로 만들 수 있다', () => expect(P.canCreateUser(pending, 'p1', req, CODE)).toBe(true));
  it('7. 가입 코드가 틀리면 거부', () => expect(P.canCreateUser(pending, 'p1', { ...req, inviteCode: 'wrong' }, CODE)).toBe(false));
  it('8. 스스로 관리자로 가입할 수 없다', () => expect(P.canCreateUser(pending, 'p1', { ...req, role: 'admin' }, CODE)).toBe(false));
  it('9. 스스로 활성 상태로 가입할 수 없다', () => expect(P.canCreateUser(pending, 'p1', { ...req, active: true }, CODE)).toBe(false));
  it('10. 스스로 승인 상태로 가입할 수 없다', () => expect(P.canCreateUser(pending, 'p1', { ...req, status: 'approved' }, CODE)).toBe(false));
  it('11. 남의 uid로 문서를 만들 수 없다', () => expect(P.canCreateUser(pending, 'zz', req, CODE)).toBe(false));
  it('12. 관리자는 계정을 직접 만들 수 있다(A안 보조)', () => expect(P.canCreateUser(admin, 'new', { role: 'teacher', active: true, status: 'approved' }, CODE)).toBe(true));
});

describe('users: 수정', () => {
  const me = profile('t1');
  it('13. 교사는 자기 role을 admin으로 바꿀 수 없다', () => expect(P.canUpdateUser(teacher, me, { ...me, role: 'admin' })).toBe(false));
  it('14. 승인 대기 교사는 스스로 활성화할 수 없다', () => {
    const p = profile('p1', { active: false, status: 'pending' });
    expect(P.canUpdateUser(pending, p, { ...p, active: true })).toBe(false);
    expect(P.canUpdateUser(pending, p, { ...p, status: 'approved' })).toBe(false);
  });
  it('15. 본인은 표시 이름·마지막 로그인 시각은 바꿀 수 있다', () => expect(P.canUpdateUser(teacher, me, { ...me, displayName: '새 이름', lastLoginAt: 'x' })).toBe(true));
  it('16. 교사는 다른 사람 프로필을 수정할 수 없다', () => expect(P.canUpdateUser(other, me, { ...me, displayName: 'x' })).toBe(false));
  it('17. 관리자는 승인(active·status 변경)할 수 있다', () => {
    const p = profile('p1', { active: false, status: 'pending' });
    expect(P.canUpdateUser(admin, p, { ...p, active: true, status: 'approved' })).toBe(true);
  });
  it('18. 삭제는 관리자만', () => {
    expect(P.canDeleteUser(admin)).toBe(true);
    expect(P.canDeleteUser(teacher)).toBe(false);
  });
});

describe('공통 데이터(교육과정·전략·appConfig)', () => {
  it('19. 활성 교사는 교육과정을 읽는다', () => expect(P.canReadShared(teacher, 'curriculumNodes')).toBe(true));
  it('20. 승인 대기 교사는 교육과정을 읽지 못한다', () => expect(P.canReadShared(pending, 'curriculumNodes')).toBe(false));
  it('21. 교사는 appConfig(가입 코드)를 읽지 못한다', () => expect(P.canReadShared(teacher, 'appConfig')).toBe(false));
  it('22. 관리자는 appConfig를 읽고 쓴다', () => {
    expect(P.canReadShared(admin, 'appConfig')).toBe(true);
    expect(P.canWriteShared(admin, 'appConfig')).toBe(true);
  });
  it('23. 교사는 교육과정·동사 매핑을 수정할 수 없다', () => {
    expect(P.canWriteShared(teacher, 'curriculumNodes')).toBe(false);
    expect(P.canWriteShared(teacher, 'verbMappings')).toBe(false);
  });
  it('24. 목록에 없는 컬렉션은 아무도 못 읽는다', () => expect(P.canReadShared(admin, 'secrets')).toBe(false));
});

describe('교사 산출물(자료·지도안)과 공유 보관함', () => {
  const mine: P.OwnedDoc = { ownerUid: 't1', visibility: 'private' };
  const shared: P.OwnedDoc = { ownerUid: 't1', visibility: 'shared' };
  it('25. 다른 교사의 비공개 자료는 읽을 수 없다', () => expect(P.canReadOwned(other, mine)).toBe(false));
  it('26. 공유된 자료는 다른 활성 교사가 읽을 수 있다', () => expect(P.canReadOwned(other, shared)).toBe(true));
  it('27. 승인 대기 교사는 공유 자료도 읽을 수 없다', () => expect(P.canReadOwned(pending, shared)).toBe(false));
  it('28. 다른 교사는 공유 자료를 수정·삭제할 수 없다(복제만 가능)', () => {
    expect(P.canUpdateOwned(other, shared, { ...shared, visibility: 'private' })).toBe(false);
    expect(P.canDeleteOwned(other, shared)).toBe(false);
  });
  it('29. 소유자는 공유/공유 취소할 수 있지만 소유자를 바꿀 수 없다', () => {
    expect(P.canUpdateOwned(teacher, mine, shared)).toBe(true);
    expect(P.canUpdateOwned(teacher, mine, { ...mine, ownerUid: 't2' })).toBe(false);
  });
  it('30. 남의 이름으로 자료를 만들 수 없다', () => expect(P.canCreateOwned(teacher, { ownerUid: 't2', visibility: 'private' })).toBe(false));
  it('31. 관리자는 모든 자료를 읽는다', () => expect(P.canReadOwned(admin, mine)).toBe(true));
});
