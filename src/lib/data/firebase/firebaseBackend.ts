// Firebase 모드 백엔드 (실서비스). 권한은 firebase/firestore.rules가 강제하고, 여기서는 호출만 한다.
// ⚠ 이 파일은 Claude 작업 환경에서 실제 Firebase에 연결해 시험하지 못했다(네트워크 차단) — Phase 9~10에서 검증.
import { deleteApp, initializeApp } from 'firebase/app';
import { CustomProvider, initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import {
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  type User,
} from 'firebase/auth';
import { collection, deleteField, doc, getDoc, getDocs, getFirestore, setDoc, updateDoc } from 'firebase/firestore';
import {
  AppError,
  INVITE_CODE_PATTERN,
  LOGIN_ID_PATTERN,
  MIN_PASSWORD_LENGTH,
  type Services,
  type UsageRecord,
  type UserProfile,
  toInternalEmail,
  validateAiSettings,
  validateSignUp,
} from '../types';
import type { LessonPlanRecord, MaterialRecord } from '../../library/types';
import { createFirebaseCatalog } from './firebaseCatalog';
import { createFirebasePrompts, createFirebaseUsage, readAiSettings } from './firebaseExtras';
import { config } from '../../config';
import { registerAi } from '../../ai';
import { createGeminiProvider } from '../../ai/geminiProvider';
import { createFirebaseOwnedStore } from './firebaseOwnedStore';

export function createFirebaseServices(): Services {
  const env = import.meta.env;
  const firebaseConfig = {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  };
  const app = initializeApp(firebaseConfig);
  // App Check(가이드 §8.1): 사이트 키(Fraud Defense)가 있으면 켠다. 이 앱에서 온 요청만 AI·DB를 쓰게 한다
  // 내 컴퓨터(npm run dev)에서는 콘솔에 등록한 디버그 토큰으로 통과한다 — 배포 빌드에는 절대 들어가지 않음
  const debugToken = import.meta.env.DEV ? env.VITE_APPCHECK_DEBUG_TOKEN : undefined;
  if (debugToken) (globalThis as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string }).FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken;
  if (env.VITE_RECAPTCHA_SITE_KEY || debugToken)
    initializeAppCheck(app, {
      // 디버그 토큰만 있을 때는 reCAPTCHA를 불러오지 않는다(디버그 모드가 토큰을 대신 만든다)
      // 내 컴퓨터(디버그 토큰)에서는 사이트 키가 있어도 reCAPTCHA를 불러오지 않는다(localhost는 키 도메인에 없음)
      provider:
        env.VITE_RECAPTCHA_SITE_KEY && !debugToken
          ? // reCAPTCHA 클래식(v3)은 지원 중단 → Fraud Defense(이전 reCAPTCHA Enterprise) 점수 기반 키
            new ReCaptchaEnterpriseProvider(env.VITE_RECAPTCHA_SITE_KEY)
          : new CustomProvider({ getToken: () => Promise.reject(new Error('App Check: reCAPTCHA 사이트 키가 없습니다.')) }),
      isTokenAutoRefreshEnabled: true,
    });
  const auth = getAuth(app);
  const db = getFirestore(app);
  const prompts = createFirebasePrompts(db, auth);
  if (config.aiMode === 'gemini') registerAi(createGeminiProvider(app, () => readAiSettings(db), prompts));
  let current: UserProfile | null = null;
  const listeners = new Set<(u: UserProfile | null) => void>();

  async function loadProfile(u: User | null): Promise<UserProfile | null> {
    if (!u) return null;
    const snap = await getDoc(doc(db, 'users', u.uid));
    if (!snap.exists()) return null;
    const data = snap.data() as UserProfile & { inviteCode?: string };
    delete data.inviteCode;
    return { ...data, uid: u.uid };
  }

  onAuthStateChanged(auth, async (u) => {
    current = await loadProfile(u).catch(() => null);
    for (const l of listeners) l(current);
  });

  const mapAuthError = (e: unknown): never => {
    const code = (e as { code?: string }).code ?? '';
    if (code === 'auth/email-already-in-use') throw new AppError('login-id-taken', '이미 사용 중인 아이디입니다.');
    if (['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found'].includes(code))
      throw new AppError('wrong-credentials', '아이디 또는 비밀번호가 맞지 않습니다.');
    if (code === 'auth/too-many-requests') throw new AppError('unavailable', '시도가 너무 많습니다. 잠시 후 다시 시도하세요.');
    if (code === 'permission-denied') throw new AppError('permission-denied', '권한이 없습니다.');
    throw new AppError('unavailable', '서버와 통신하지 못했습니다. 잠시 후 다시 시도하세요.');
  };

  const requireMe = () => {
    if (!auth.currentUser) throw new AppError('permission-denied', '로그인이 필요합니다.');
    return auth.currentUser;
  };

  return {
    catalog: createFirebaseCatalog(db, auth, () => current),
    prompts,
    usage: createFirebaseUsage(db, auth),
    library: {
      materials: createFirebaseOwnedStore<MaterialRecord>(db, auth, 'materials', () => current),
      lessonPlans: createFirebaseOwnedStore<LessonPlanRecord>(db, auth, 'lessonPlans', () => current),
    },
    auth: {
      async signIn(loginId, password) {
        if (!LOGIN_ID_PATTERN.test(loginId)) throw new AppError('invalid-login-id', '아이디는 영어 소문자와 숫자 4~20자입니다.');
        const cred = await signInWithEmailAndPassword(auth, toInternalEmail(loginId), password).catch(mapAuthError);
        await updateDoc(doc(db, 'users', cred.user.uid), { lastLoginAt: new Date().toISOString() }).catch(() => undefined);
        current = await loadProfile(cred.user);
        if (!current) throw new AppError('not-found', '사용자 정보가 없습니다. 관리자에게 문의하세요.');
        return current;
      },
      async signUp(input) {
        const clean = { ...input, loginId: input.loginId.trim(), displayName: input.displayName.trim(), inviteCode: input.inviteCode.trim() };
        validateSignUp(clean);
        const cred = await createUserWithEmailAndPassword(auth, toInternalEmail(clean.loginId), clean.password).catch(mapAuthError);
        const profile = {
          loginId: clean.loginId,
          displayName: clean.displayName,
          role: 'teacher' as const,
          active: false,
          status: 'pending' as const,
          createdAt: new Date().toISOString(),
          inviteCode: clean.inviteCode,
        };
        try {
          await setDoc(doc(db, 'users', cred.user.uid), profile);
        } catch {
          // Rules가 거부 = 가입 코드 불일치 → 방금 만든 인증 계정을 지운다
          await cred.user.delete().catch(() => undefined);
          throw new AppError('wrong-invite-code', '가입 코드가 맞지 않습니다. 관리자에게 가입 코드를 확인하세요.');
        }
        current = await loadProfile(cred.user);
        return current!;
      },
      async signOut() {
        await signOut(auth);
      },
      async changePassword(currentPassword, newPassword) {
        const me = requireMe();
        if (newPassword.length < MIN_PASSWORD_LENGTH) throw new AppError('weak-password', `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상입니다.`);
        await reauthenticateWithCredential(me, EmailAuthProvider.credential(me.email!, currentPassword)).catch(mapAuthError);
        await updatePassword(me, newPassword).catch(mapAuthError);
      },
      currentUser: () => current,
      onChange(listener) {
        listeners.add(listener);
        listener(current);
        return () => listeners.delete(listener);
      },
    },
    admin: {
      async listUsers() {
        const snap = await getDocs(collection(db, 'users')).catch(mapAuthError);
        return snap.docs
          .map((d) => {
            const data = d.data() as UserProfile & { inviteCode?: string };
            delete data.inviteCode;
            return { ...data, uid: d.id };
          })
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      },
      async approve(uid) {
        await updateDoc(doc(db, 'users', uid), {
          active: true,
          status: 'approved',
          approvedAt: new Date().toISOString(),
          approvedBy: requireMe().uid,
          rejectReason: deleteField(),
          inviteCode: deleteField(),
        }).catch(mapAuthError);
      },
      async reject(uid, reason) {
        await updateDoc(doc(db, 'users', uid), { active: false, status: 'rejected', rejectReason: reason.trim() || '사유 없음' }).catch(mapAuthError);
      },
      async setActive(uid, active) {
        if (uid === requireMe().uid && !active) throw new AppError('invalid-input', '자기 계정은 비활성화할 수 없습니다.');
        await updateDoc(doc(db, 'users', uid), { active }).catch(mapAuthError);
      },
      async getInviteCode() {
        const snap = await getDoc(doc(db, 'appConfig', 'signup')).catch(mapAuthError);
        return (snap.data()?.inviteCode as string | undefined) ?? '';
      },
      async setInviteCode(code) {
        const c = code.trim();
        if (!INVITE_CODE_PATTERN.test(c)) throw new AppError('invalid-input', '가입 코드는 공백 없이 4~32자로 정하세요.');
        await setDoc(doc(db, 'appConfig', 'signup'), { inviteCode: c }, { merge: true }).catch(mapAuthError);
      },
      async createUser(input) {
        // 관리자 세션을 유지하려고 보조 앱 인스턴스로 계정을 만든다 (가이드 §6.2)
        const clean = { loginId: input.loginId.trim(), displayName: input.displayName.trim(), password: input.password };
        validateSignUp({ ...clean, inviteCode: 'admin-issued' });
        const secondary = initializeApp(firebaseConfig, `create-${Date.now()}`);
        try {
          const cred = await createUserWithEmailAndPassword(getAuth(secondary), toInternalEmail(clean.loginId), clean.password).catch(mapAuthError);
          const now = new Date().toISOString();
          const profile = { loginId: clean.loginId, displayName: clean.displayName, role: 'teacher' as const, active: true, status: 'approved' as const, createdAt: now, approvedAt: now, approvedBy: requireMe().uid };
          await setDoc(doc(db, 'users', cred.user.uid), profile).catch(mapAuthError);
          return { ...profile, uid: cred.user.uid };
        } finally {
          await deleteApp(secondary).catch(() => undefined);
        }
      },
      async resetPassword() {
        throw new AppError('unavailable', 'Firebase 모드에서는 다른 사람의 비밀번호를 화면에서 바꿀 수 없습니다. 관리자 PC에서 tools/admin-cli.mjs로 재설정하세요(README 참고).');
      },
      getAiSettings: () => readAiSettings(db).catch(mapAuthError),
      async setAiSettings(v) {
        validateAiSettings(v);
        await setDoc(doc(db, 'appConfig', 'ai'), { dailyQuotaPerTeacher: v.dailyQuotaPerTeacher, ...(v.model !== undefined ? { model: v.model || null } : {}) }, { merge: true }).catch(mapAuthError);
      },
      async listUsage() {
        const snap = await getDocs(collection(db, 'usage')).catch(mapAuthError);
        return snap.docs.map((d) => d.data() as UsageRecord).sort((x, y) => y.day.localeCompare(x.day) || x.uid.localeCompare(y.uid));
      },
    },
  };
}
