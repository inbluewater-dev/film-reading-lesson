#!/usr/bin/env node
// 관리자 CLI (가이드 §6.3) — Firebase 모드에서 화면으로 할 수 없는 일을 관리자 PC에서 처리한다.
// 서비스 계정 키는 관리자 PC에만 두고 절대 저장소에 올리지 않는다.
//
// 준비:  npm install --no-save firebase-admin
//        set GOOGLE_APPLICATION_CREDENTIALS=C:\경로\service-account.json   (Windows)
//        export GOOGLE_APPLICATION_CREDENTIALS=/경로/service-account.json  (macOS·Linux)
// 사용:  node tools/admin-cli.mjs reset-password <아이디> <새 비밀번호>
//        node tools/admin-cli.mjs make-admin <아이디>        (최초 관리자 지정)
//        node tools/admin-cli.mjs list-users
const EMAIL_DOMAIN = 'ttl-edu.local'; // src/lib/data/types.ts LOGIN_EMAIL_DOMAIN과 같아야 함
const [cmd, loginId, arg] = process.argv.slice(2);

let admin;
try {
  admin = (await import('firebase-admin')).default;
} catch {
  console.error('firebase-admin이 없습니다. 먼저 `npm install --no-save firebase-admin`을 실행하세요.');
  process.exit(1);
}
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('GOOGLE_APPLICATION_CREDENTIALS에 서비스 계정 키 파일 경로를 지정하세요.');
  process.exit(1);
}
admin.initializeApp({ credential: admin.credential.applicationDefault() });
const auth = admin.auth();
const db = admin.firestore();
const userOf = (id) => auth.getUserByEmail(`${id}@${EMAIL_DOMAIN}`);

try {
  if (cmd === 'reset-password') {
    if (!loginId || !arg || arg.length < 8) throw new Error('사용법: reset-password <아이디> <새 비밀번호(8자 이상)>');
    const u = await userOf(loginId);
    await auth.updateUser(u.uid, { password: arg });
    console.log(`✓ ${loginId}의 비밀번호를 바꿨습니다. 본인에게 직접 전달하세요.`);
  } else if (cmd === 'make-admin') {
    if (!loginId) throw new Error('사용법: make-admin <아이디>');
    const u = await userOf(loginId);
    await db.doc(`users/${u.uid}`).set({ role: 'admin', active: true, status: 'approved' }, { merge: true });
    console.log(`✓ ${loginId}을(를) 관리자로 지정했습니다.`);
  } else if (cmd === 'list-users') {
    const snap = await db.collection('users').get();
    for (const d of snap.docs) {
      const v = d.data();
      console.log(`${v.loginId}\t${v.displayName}\t${v.role}\t${v.status}\t${v.active ? '사용 중' : '중지'}`);
    }
  } else {
    console.log('명령: reset-password <아이디> <새 비밀번호> | make-admin <아이디> | list-users');
  }
} catch (e) {
  console.error('✗', e.message);
  process.exit(1);
}
