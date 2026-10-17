import { beforeEach, describe, expect, it } from 'vitest';
import { LOCAL_SEED, LocalBackend } from '../../src/lib/data/local/localBackend';
import { MemoryStorage } from '../../src/lib/data/local/storage';
import { AppError } from '../../src/lib/data/types';

let storage: MemoryStorage;
let b: LocalBackend;
const fresh = async () => {
  const x = new LocalBackend({ storage });
  await x.whenReady();
  return x;
};
const code = (p: Promise<unknown>) => p.then(() => 'ok', (e: AppError) => e.code);
const signUpInput = { inviteCode: LOCAL_SEED.inviteCode, loginId: 'newteacher', displayName: '박감상', password: 'password1' };

beforeEach(async () => {
  storage = new MemoryStorage();
  b = await fresh();
});

describe('로그인', () => {
  it('시드 계정 admin01·teacher01로 로그인된다', async () => {
    expect((await b.auth.signIn('admin01', 'admin1234')).role).toBe('admin');
    expect((await b.auth.signIn('teacher01', 'teacher1234')).role).toBe('teacher');
  });
  it('틀린 비밀번호·없는 아이디는 같은 오류(어느 쪽이 틀렸는지 알려주지 않음)', async () => {
    expect(await code(b.auth.signIn('admin01', 'nope12345'))).toBe('wrong-credentials');
    expect(await code(b.auth.signIn('nobody1', 'nope12345'))).toBe('wrong-credentials');
  });
  it('아이디 형식 검사', async () => {
    expect(await code(b.auth.signIn('Admin01', 'admin1234'))).toBe('invalid-login-id');
  });
  it('로그인 상태가 저장소에 남아 새로 열어도 유지되고, 로그아웃하면 지워진다', async () => {
    await b.auth.signIn('teacher01', 'teacher1234');
    expect((await fresh()).auth.currentUser()?.loginId).toBe('teacher01');
    await b.auth.signOut();
    expect((await fresh()).auth.currentUser()).toBeNull();
  });
  it('응답에 가입 코드가 포함되지 않는다', async () => {
    const u = await b.auth.signUp(signUpInput);
    expect(JSON.stringify(u)).not.toContain(LOCAL_SEED.inviteCode);
  });
});

describe('가입 신청 → 승인 (B안)', () => {
  it('가입 코드가 맞으면 승인 대기(비활성) 교사 계정이 만들어진다', async () => {
    const u = await b.auth.signUp(signUpInput);
    expect(u).toMatchObject({ role: 'teacher', active: false, status: 'pending', loginId: 'newteacher' });
    expect(b.auth.currentUser()?.uid).toBe(u.uid);
  });
  it('가입 코드가 틀리면 거부되고 계정이 생기지 않는다', async () => {
    expect(await code(b.auth.signUp({ ...signUpInput, inviteCode: 'wrongcode' }))).toBe('wrong-invite-code');
    expect(await code(b.auth.signIn('newteacher', 'password1'))).toBe('wrong-credentials');
  });
  it('이미 있는 아이디로는 가입할 수 없다', async () => {
    expect(await code(b.auth.signUp({ ...signUpInput, loginId: 'teacher01' }))).toBe('login-id-taken');
  });
  it('비밀번호 8자 미만은 거부', async () => {
    expect(await code(b.auth.signUp({ ...signUpInput, password: 'short' }))).toBe('weak-password');
  });
  it('관리자가 승인하면 활성화되고, 다시 로그인하면 승인 상태로 보인다', async () => {
    const u = await b.auth.signUp(signUpInput);
    await b.auth.signIn('admin01', 'admin1234');
    await b.admin.approve(u.uid);
    await b.auth.signIn('newteacher', 'password1');
    expect(b.auth.currentUser()).toMatchObject({ active: true, status: 'approved' });
  });
  it('관리자가 거절하면 비활성·거절 상태와 사유가 남는다', async () => {
    const u = await b.auth.signUp(signUpInput);
    await b.auth.signIn('admin01', 'admin1234');
    await b.admin.reject(u.uid, '소속 확인 불가');
    await b.auth.signIn('newteacher', 'password1');
    expect(b.auth.currentUser()).toMatchObject({ active: false, status: 'rejected', rejectReason: '소속 확인 불가' });
  });
  it('관리자가 가입 코드를 바꾸면 옛 코드로는 가입할 수 없다', async () => {
    await b.auth.signIn('admin01', 'admin1234');
    await b.admin.setInviteCode('newcode2027');
    expect(await b.admin.getInviteCode()).toBe('newcode2027');
    expect(await code(b.auth.signUp(signUpInput))).toBe('wrong-invite-code');
    expect(await code(b.auth.signUp({ ...signUpInput, inviteCode: 'newcode2027' }))).toBe('ok');
  });
});

describe('권한', () => {
  it('교사는 관리자 기능(사용자 목록·승인·가입 코드)을 쓸 수 없다', async () => {
    await b.auth.signIn('teacher01', 'teacher1234');
    expect(await code(b.admin.listUsers())).toBe('permission-denied');
    expect(await code(b.admin.approve('x'))).not.toBe('ok');
    expect(await code(b.admin.getInviteCode())).toBe('permission-denied');
    expect(await code(b.admin.setInviteCode('hack1234'))).toBe('permission-denied');
  });
  it('승인 대기 교사는 자기 자신을 승인할 수 없다', async () => {
    const u = await b.auth.signUp(signUpInput);
    expect(await code(b.admin.approve(u.uid))).toBe('permission-denied');
  });
  it('비활성화된 교사는 로그인은 되지만 active=false 로 표시된다(앱이 차단 화면으로 보냄)', async () => {
    const t = await b.auth.signIn('teacher01', 'teacher1234');
    await b.auth.signIn('admin01', 'admin1234');
    await b.admin.setActive(t.uid, false);
    expect((await b.auth.signIn('teacher01', 'teacher1234')).active).toBe(false);
  });
  it('관리자는 자기 계정을 비활성화할 수 없다', async () => {
    const a = await b.auth.signIn('admin01', 'admin1234');
    expect(await code(b.admin.setActive(a.uid, false))).toBe('invalid-input');
  });
  it('승인되지 않은 계정은 활성화 대신 승인을 먼저 해야 한다', async () => {
    const u = await b.auth.signUp(signUpInput);
    await b.auth.signIn('admin01', 'admin1234');
    expect(await code(b.admin.setActive(u.uid, true))).toBe('invalid-input');
  });
  it('비밀번호 변경: 현재 비밀번호 확인 후 바뀐다', async () => {
    await b.auth.signIn('teacher01', 'teacher1234');
    expect(await code(b.auth.changePassword('wrong', 'newpass99'))).toBe('wrong-credentials');
    await b.auth.changePassword('teacher1234', 'newpass99');
    expect(await code(b.auth.signIn('teacher01', 'teacher1234'))).toBe('wrong-credentials');
    expect(await code(b.auth.signIn('teacher01', 'newpass99'))).toBe('ok');
  });
});
