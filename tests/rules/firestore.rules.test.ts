// firebase/firestore.rules 시나리오 테스트 (tests/unit/policy.test.ts와 같은 규칙)
// 실행: npm run test:rules  (Java + Firebase 에뮬레이터 필요 — Claude 작업 환경에서는 실행 불가)
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

let env: RulesTestEnvironment;
const CODE = 'film2026';
const user = (uid: string, over: Record<string, unknown> = {}) => ({
  loginId: uid + 'id', displayName: uid, role: 'teacher', active: true, status: 'approved', createdAt: '2026-10-17T00:00:00Z', ...over,
});

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'film-reading-lesson-test',
    firestore: { rules: readFileSync('firebase/firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => env?.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'appConfig/signup'), { inviteCode: CODE });
    await setDoc(doc(db, 'users/a1'), user('a1', { role: 'admin' }));
    await setDoc(doc(db, 'users/a2'), user('a2', { role: 'admin', active: false }));
    await setDoc(doc(db, 'users/t1'), user('t1'));
    await setDoc(doc(db, 'users/t2'), user('t2'));
    await setDoc(doc(db, 'users/p1'), user('p1', { active: false, status: 'pending' }));
    await setDoc(doc(db, 'curriculumNodes/n1'), { label: '영화의 특성' });
    await setDoc(doc(db, 'materials/m1'), { ownerUid: 't1', visibility: 'private', title: '비공개' });
    await setDoc(doc(db, 'materials/m2'), { ownerUid: 't1', visibility: 'shared', title: '공유' });
    await setDoc(doc(db, 'lessonPlans/l1'), { ownerUid: 't1', visibility: 'shared' });
  });
});
const as = (uid: string | null) => (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()).firestore();
const pendingReq = { loginId: 'newid', displayName: '새 교사', role: 'teacher', active: false, status: 'pending', createdAt: 'x', inviteCode: CODE };

describe('users', () => {
  it('본인 프로필 읽기 가능(승인 대기 포함)', () => assertSucceeds(getDoc(doc(as('p1'), 'users/p1'))));
  it('교사는 남의 프로필을 못 읽음', () => assertFails(getDoc(doc(as('t1'), 'users/t2'))));
  it('관리자는 모든 프로필 읽음', () => assertSucceeds(getDoc(doc(as('a1'), 'users/t2'))));
  it('비로그인 읽기 불가', () => assertFails(getDoc(doc(as(null), 'users/t1'))));
  it('비활성 관리자는 관리자 권한 없음', () => assertFails(getDoc(doc(as('a2'), 'users/t1'))));
  it('가입 코드가 맞으면 가입 신청 가능', () => assertSucceeds(setDoc(doc(as('n1'), 'users/n1'), pendingReq)));
  it('가입 코드가 틀리면 거부', () => assertFails(setDoc(doc(as('n1'), 'users/n1'), { ...pendingReq, inviteCode: 'wrong' })));
  it('스스로 관리자로 가입 불가', () => assertFails(setDoc(doc(as('n1'), 'users/n1'), { ...pendingReq, role: 'admin' })));
  it('스스로 활성으로 가입 불가', () => assertFails(setDoc(doc(as('n1'), 'users/n1'), { ...pendingReq, active: true })));
  it('남의 uid로 가입 불가', () => assertFails(setDoc(doc(as('n1'), 'users/zz'), pendingReq)));
  it('교사는 자기 role 변경 불가', () => assertFails(updateDoc(doc(as('t1'), 'users/t1'), { role: 'admin' })));
  it('승인 대기 교사는 스스로 활성화 불가', () => assertFails(updateDoc(doc(as('p1'), 'users/p1'), { active: true, status: 'approved' })));
  it('본인은 표시 이름 변경 가능', () => assertSucceeds(updateDoc(doc(as('t1'), 'users/t1'), { displayName: '새 이름' })));
  it('관리자는 승인 가능', () => assertSucceeds(updateDoc(doc(as('a1'), 'users/p1'), { active: true, status: 'approved' })));
  it('삭제는 관리자만', async () => {
    await assertFails(deleteDoc(doc(as('t1'), 'users/t2')));
    await assertSucceeds(deleteDoc(doc(as('a1'), 'users/t2')));
  });
});

describe('공통 데이터·appConfig', () => {
  it('활성 교사는 교육과정 읽기 가능', () => assertSucceeds(getDoc(doc(as('t1'), 'curriculumNodes/n1'))));
  it('승인 대기 교사는 교육과정 읽기 불가', () => assertFails(getDoc(doc(as('p1'), 'curriculumNodes/n1'))));
  it('교사는 가입 코드(appConfig) 읽기 불가', () => assertFails(getDoc(doc(as('t1'), 'appConfig/signup'))));
  it('관리자는 appConfig 읽기·쓰기 가능', async () => {
    await assertSucceeds(getDoc(doc(as('a1'), 'appConfig/signup')));
    await assertSucceeds(setDoc(doc(as('a1'), 'appConfig/signup'), { inviteCode: 'new2027' }));
  });
  it('교사는 교육과정·동사 매핑 수정 불가', async () => {
    await assertFails(setDoc(doc(as('t1'), 'curriculumNodes/n1'), { label: 'x' }));
    await assertFails(setDoc(doc(as('t1'), 'verbMappings/탐구하다'), { functionIds: [] }));
  });
});

describe('자료·지도안·공유', () => {
  it('남의 비공개 자료 읽기 불가', () => assertFails(getDoc(doc(as('t2'), 'materials/m1'))));
  it('공유 자료는 다른 교사가 읽기 가능', () => assertSucceeds(getDoc(doc(as('t2'), 'materials/m2'))));
  it('공유 지도안도 읽기 가능', () => assertSucceeds(getDoc(doc(as('t2'), 'lessonPlans/l1'))));
  it('승인 대기 교사는 공유 자료도 읽기 불가', () => assertFails(getDoc(doc(as('p1'), 'materials/m2'))));
  it('다른 교사는 공유 자료 수정·삭제 불가', async () => {
    await assertFails(updateDoc(doc(as('t2'), 'materials/m2'), { title: 'x' }));
    await assertFails(deleteDoc(doc(as('t2'), 'materials/m2')));
  });
  it('소유자는 공유 설정 변경 가능, 소유자 변경은 불가', async () => {
    await assertSucceeds(updateDoc(doc(as('t1'), 'materials/m1'), { visibility: 'shared' }));
    await assertFails(updateDoc(doc(as('t1'), 'materials/m1'), { ownerUid: 't2' }));
  });
  it('남의 이름으로 자료 생성 불가, 내 이름으로는 가능', async () => {
    await assertFails(setDoc(doc(as('t1'), 'materials/m9'), { ownerUid: 't2', visibility: 'private' }));
    await assertSucceeds(setDoc(doc(as('t1'), 'materials/m9'), { ownerUid: 't1', visibility: 'private' }));
  });
  it('관리자는 모든 자료 읽기 가능', () => assertSucceeds(getDoc(doc(as('a1'), 'materials/m1'))));
});

describe('Phase 8: TTL 버전·프롬프트·AI 사용 기록', () => {
  it('활성 교사는 게시된 TTL 버전·원문·사용 중 버전을 읽는다', async () => {
    await assertSucceeds(getDoc(doc(as('t1'), 'ontologyFiles/v1')));
    await assertSucceeds(getDoc(doc(as('t1'), 'ontologyState/active')));
  });
  it('교사는 TTL 버전을 게시·변경할 수 없다', async () => {
    await assertFails(setDoc(doc(as('t1'), 'ontologyState/active'), { versionId: 'x' }));
    await assertFails(setDoc(doc(as('t1'), 'ontologyFiles/x'), { files: {} }));
  });
  it('관리자는 TTL 버전을 게시한다', () => assertSucceeds(setDoc(doc(as('a1'), 'ontologyState/active'), { versionId: 'v2' })));
  it('교사는 프롬프트를 읽지만 바꿀 수 없다', async () => {
    await assertSucceeds(getDoc(doc(as('t1'), 'promptTemplates/material')));
    await assertFails(setDoc(doc(as('t1'), 'promptTemplates/material'), { body: 'x' }));
  });
  it('교사는 하루 한도(appConfig/ai)를 읽지만 가입 코드는 못 읽는다', async () => {
    await assertSucceeds(getDoc(doc(as('t1'), 'appConfig/ai')));
    await assertFails(getDoc(doc(as('t1'), 'appConfig/signup')));
    await assertFails(setDoc(doc(as('t1'), 'appConfig/ai'), { dailyQuotaPerTeacher: 999 }));
  });
  it('사용 기록: 본인 것만 1부터 시작해 1씩 늘린다', async () => {
    const rec = { uid: 't1', day: '2026-10-22', counts: { material: 1 }, total: 1 };
    await assertSucceeds(setDoc(doc(as('t1'), 'usage/t1_2026-10-22'), rec));
    await assertFails(setDoc(doc(as('t1'), 'usage/t2_2026-10-22'), { ...rec, uid: 't2' }));
    await assertSucceeds(updateDoc(doc(as('t1'), 'usage/t1_2026-10-22'), { total: 2, counts: { material: 2 } }));
    await assertFails(updateDoc(doc(as('t1'), 'usage/t1_2026-10-22'), { total: 0 }));
    await assertSucceeds(getDoc(doc(as('t1'), 'usage/t1_2026-10-22')));
    await assertFails(getDoc(doc(as('t2'), 'usage/t1_2026-10-22')));
    await assertSucceeds(getDoc(doc(as('a1'), 'usage/t1_2026-10-22')));
  });
});
