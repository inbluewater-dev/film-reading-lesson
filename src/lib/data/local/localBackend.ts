// 로컬 모드 백엔드 — 개발·테스트 전용. Firebase 없이 로그인·가입·승인 흐름을 재현한다.
// 모든 쓰기는 policy.ts의 규칙(= firestore.rules)으로 먼저 검사한다.
// ⚠ 실서비스에서 쓰지 않는다(비밀번호가 브라우저에 저장됨). VITE_DATA_MODE=firebase 로 전환할 것.
import * as policy from '../policy';
import {
  AppError,
  INVITE_CODE_PATTERN,
  LOGIN_ID_PATTERN,
  MIN_PASSWORD_LENGTH,
  type AdminService,
  type AiSettings,
  type AuthService,
  type CatalogService,
  type CreateUserInput,
  type PromptService,
  type Services,
  type SignUpInput,
  type UsageKind,
  type UsageRecord,
  type UsageService,
  type UserProfile,
  validateSignUp,
} from '../types';
import type { LessonPlanRecord, LibraryService, MaterialRecord } from '../../library/types';
import { sha256Hex } from '../../util/hash';
import { sha256Fallback } from '../../util/sha256Fallback';
import { LocalCatalog } from './localCatalog';
import { LocalPrompts } from './localPrompts';
import { LocalOwnedStore } from './localOwnedStore';
import type { KeyValueStorage } from './storage';

const STORAGE_KEY = 'frl:local:v1';

interface Credential {
  uid: string;
  salt: string;
  hash: string;
}
interface State {
  version: 1;
  users: Record<string, UserProfile & { inviteCode?: string }>;
  credentials: Record<string, Credential>; // loginId → 비밀번호 해시
  appConfig: { signup: { inviteCode: string }; ai?: AiSettings };
  sessionUid: string | null;
  /** AI 사용 횟수: "uid_날짜" → 기록 */
  usage?: Record<string, UsageRecord>;
}

/** 로컬 모드 테스트 계정 — README에 안내. 실서비스와 같은 비밀번호를 쓰지 말 것 */
export const LOCAL_SEED = {
  inviteCode: 'film2026',
  accounts: [
    { loginId: 'admin01', password: 'admin1234', displayName: '관리자', role: 'admin' as const },
    { loginId: 'teacher01', password: 'teacher1234', displayName: '김영화 선생님', role: 'teacher' as const },
  ],
};

export interface LocalBackendOptions {
  storage: KeyValueStorage;
  now?: () => Date;
  newId?: () => string;
}

export class LocalBackend implements Services {
  readonly auth: AuthService;
  readonly admin: AdminService;
  readonly catalog: CatalogService;
  readonly library: LibraryService;
  readonly prompts: PromptService;
  readonly usage: UsageService;
  private listeners = new Set<(u: UserProfile | null) => void>();
  private state!: State;
  private ready: Promise<void>;

  constructor(private opts: LocalBackendOptions) {
    this.ready = this.load();
    // 메서드를 인터페이스 객체로 묶는다 (화면은 services.auth.signIn(...) 형태로 사용)
    this.auth = {
      signIn: (id, pw) => this.signIn(id, pw),
      signUp: (input) => this.signUp(input),
      signOut: () => this.signOut(),
      changePassword: (cur, next) => this.changePassword(cur, next),
      currentUser: () => this.currentUser(),
      onChange: (l) => this.onChange(l),
    };
    this.admin = {
      listUsers: () => this.listUsers(),
      approve: (uid) => this.approve(uid),
      reject: (uid, reason) => this.reject(uid, reason),
      setActive: (uid, active) => this.setActive(uid, active),
      getInviteCode: () => this.getInviteCode(),
      setInviteCode: (code) => this.setInviteCode(code),
      createUser: (input) => this.createUser(input),
      resetPassword: (uid, pw) => this.resetPassword(uid, pw),
      getAiSettings: () => this.getAiSettings(),
      setAiSettings: (v) => this.setAiSettings(v),
      listUsage: () => this.listUsage(),
    };
    const me = () => (this.state?.sessionUid ? this.state.users[this.state.sessionUid] ?? null : null);
    const now = () => this.nowIso();
    const id = () => this.newId();
    this.catalog = new LocalCatalog(opts.storage, () => this.actor(), me, now, id);
    this.prompts = new LocalPrompts(opts.storage, () => this.actor(), now);
    this.usage = { record: (k) => this.recordUsage(k), today: () => this.todayUsage() };
    this.library = {
      materials: new LocalOwnedStore<MaterialRecord>(opts.storage, 'frl:local:materials:v1', me, now, id),
      lessonPlans: new LocalOwnedStore<LessonPlanRecord>(opts.storage, 'frl:local:lessonPlans:v1', me, now, id),
    };
  }

  /** 초기화(시드 포함)가 끝날 때까지 기다린다 */
  whenReady(): Promise<void> {
    return this.ready;
  }

  // ------------------------------------------------------------ 상태 저장
  private async load() {
    const raw = this.opts.storage.get(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as State;
        if (parsed.version === 1) {
          this.state = parsed;
          return;
        }
      } catch {
        /* 손상된 값이면 새로 만든다 */
      }
    }
    this.state = { version: 1, users: {}, credentials: {}, appConfig: { signup: { inviteCode: LOCAL_SEED.inviteCode } }, sessionUid: null };
    for (const a of LOCAL_SEED.accounts) {
      const uid = this.newId();
      this.state.users[uid] = {
        uid,
        loginId: a.loginId,
        displayName: a.displayName,
        role: a.role,
        active: true,
        status: 'approved',
        createdAt: this.nowIso(),
        approvedAt: this.nowIso(),
        approvedBy: 'seed',
      };
      this.state.credentials[a.loginId] = await makeCredential(uid, a.password);
    }
    this.save();
  }

  private save() {
    this.opts.storage.set(STORAGE_KEY, JSON.stringify(this.state));
  }

  private nowIso() {
    return (this.opts.now?.() ?? new Date()).toISOString();
  }
  private newId() {
    return this.opts.newId?.() ?? randomId();
  }

  private actor(): policy.Actor {
    const u = this.state.sessionUid ? this.state.users[this.state.sessionUid] : undefined;
    return u ? { uid: u.uid, role: u.role, active: u.active } : null;
  }

  private publicProfile(u: UserProfile & { inviteCode?: string }): UserProfile {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { inviteCode, ...rest } = u;
    return { ...rest };
  }

  private emit() {
    const u = this.currentUser();
    for (const l of this.listeners) l(u);
  }

  // ------------------------------------------------------------ AuthService
  private async signIn(loginId: string, password: string): Promise<UserProfile> {
    await this.ready;
    if (!LOGIN_ID_PATTERN.test(loginId)) throw new AppError('invalid-login-id', '아이디는 영어 소문자와 숫자 4~20자입니다.');
    const cred = this.state.credentials[loginId];
    if (!cred || !(await verifyCredential(cred, password))) throw new AppError('wrong-credentials', '아이디 또는 비밀번호가 맞지 않습니다.');
    this.state.sessionUid = cred.uid;
    const before = this.state.users[cred.uid];
    const after = { ...before, lastLoginAt: this.nowIso() };
    if (policy.canUpdateUser(this.actor(), before, after)) this.state.users[cred.uid] = after;
    this.save();
    this.emit();
    return this.publicProfile(this.state.users[cred.uid]);
  }

  private async signUp(input: SignUpInput): Promise<UserProfile> {
    await this.ready;
    const clean = { ...input, loginId: input.loginId.trim(), displayName: input.displayName.trim(), inviteCode: input.inviteCode.trim() };
    validateSignUp(clean);
    if (this.state.credentials[clean.loginId]) throw new AppError('login-id-taken', '이미 사용 중인 아이디입니다.');
    const uid = this.newId();
    const profile = {
      uid,
      loginId: clean.loginId,
      displayName: clean.displayName,
      role: 'teacher' as const,
      active: false,
      status: 'pending' as const,
      createdAt: this.nowIso(),
      inviteCode: clean.inviteCode,
    };
    // Firebase에서는 계정 생성 직후 본인 자격으로 users 문서를 만든다 → 같은 순서로 검사
    const actorAfterAuth: policy.Actor = { uid, role: 'teacher', active: false };
    if (!policy.canCreateUser(actorAfterAuth, uid, profile, this.state.appConfig.signup.inviteCode))
      throw new AppError('wrong-invite-code', '가입 코드가 맞지 않습니다. 관리자에게 가입 코드를 확인하세요.');
    this.state.users[uid] = profile;
    this.state.credentials[clean.loginId] = await makeCredential(uid, clean.password);
    this.state.sessionUid = uid;
    this.save();
    this.emit();
    return this.publicProfile(profile);
  }

  private async signOut(): Promise<void> {
    await this.ready;
    this.state.sessionUid = null;
    this.save();
    this.emit();
  }

  private async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await this.ready;
    const me = this.requireSignedIn();
    const cred = this.state.credentials[me.loginId];
    if (!(await verifyCredential(cred, currentPassword))) throw new AppError('wrong-credentials', '현재 비밀번호가 맞지 않습니다.');
    if (newPassword.length < MIN_PASSWORD_LENGTH) throw new AppError('weak-password', `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상입니다.`);
    this.state.credentials[me.loginId] = await makeCredential(me.uid, newPassword);
    this.save();
  }

  private currentUser(): UserProfile | null {
    if (!this.state?.sessionUid) return null;
    const u = this.state.users[this.state.sessionUid];
    return u ? this.publicProfile(u) : null;
  }

  private onChange(listener: (u: UserProfile | null) => void): () => void {
    this.listeners.add(listener);
    void this.ready.then(() => listener(this.currentUser()));
    return () => this.listeners.delete(listener);
  }

  // ------------------------------------------------------------ AdminService
  private requireSignedIn() {
    const u = this.state.sessionUid ? this.state.users[this.state.sessionUid] : undefined;
    if (!u) throw new AppError('permission-denied', '로그인이 필요합니다.');
    return u;
  }

  private async listUsers(): Promise<UserProfile[]> {
    await this.ready;
    const a = this.actor();
    const visible = Object.values(this.state.users).filter((u) => policy.canReadUser(a, u.uid));
    if (!policy.isAdmin(a)) throw new AppError('permission-denied', '관리자만 사용할 수 있습니다.');
    return visible.map((u) => this.publicProfile(u)).sort((x, y) => x.createdAt.localeCompare(y.createdAt));
  }

  private updateUser(uid: string, patch: Partial<UserProfile> & { inviteCode?: undefined }) {
    const before = this.state.users[uid];
    if (!before) throw new AppError('not-found', '사용자를 찾을 수 없습니다.');
    const after = { ...before, ...patch };
    if (!policy.canUpdateUser(this.actor(), before, after)) throw new AppError('permission-denied', '권한이 없습니다.');
    this.state.users[uid] = after;
    this.save();
    if (uid === this.state.sessionUid) this.emit();
  }

  private async approve(uid: string): Promise<void> {
    await this.ready;
    // 승인 시 가입 코드 기록은 지운다
    this.updateUser(uid, { active: true, status: 'approved', approvedAt: this.nowIso(), approvedBy: this.actor()?.uid, rejectReason: undefined, inviteCode: undefined });
  }

  private async reject(uid: string, reason: string): Promise<void> {
    await this.ready;
    this.updateUser(uid, { active: false, status: 'rejected', rejectReason: reason.trim() || '사유 없음' });
  }

  private async setActive(uid: string, active: boolean): Promise<void> {
    await this.ready;
    if (uid === this.state.sessionUid && !active) throw new AppError('invalid-input', '자기 계정은 비활성화할 수 없습니다.');
    const target = this.state.users[uid];
    if (target && active && target.status !== 'approved') throw new AppError('invalid-input', '승인되지 않은 계정은 먼저 승인하세요.');
    this.updateUser(uid, { active });
  }

  private async getInviteCode(): Promise<string> {
    await this.ready;
    if (!policy.canReadShared(this.actor(), 'appConfig')) throw new AppError('permission-denied', '관리자만 볼 수 있습니다.');
    return this.state.appConfig.signup.inviteCode;
  }

  private async setInviteCode(code: string): Promise<void> {
    await this.ready;
    if (!policy.canWriteShared(this.actor(), 'appConfig')) throw new AppError('permission-denied', '관리자만 바꿀 수 있습니다.');
    const c = code.trim();
    if (!INVITE_CODE_PATTERN.test(c)) throw new AppError('invalid-input', '가입 코드는 공백 없이 4~32자로 정하세요.');
    this.state.appConfig.signup.inviteCode = c;
    this.save();
  }

  // ------------------------------------------------------------ 계정 직접 발급·비밀번호 재설정 (가이드 §9.3-1)
  private async createUser(input: CreateUserInput): Promise<UserProfile> {
    await this.ready;
    if (!policy.isAdmin(this.actor())) throw new AppError('permission-denied', '관리자만 계정을 만들 수 있습니다.');
    const clean = { loginId: input.loginId.trim(), displayName: input.displayName.trim(), password: input.password };
    validateSignUp({ ...clean, inviteCode: 'admin-issued' });
    if (this.state.credentials[clean.loginId]) throw new AppError('login-id-taken', `이미 사용 중인 아이디입니다: ${clean.loginId}`);
    const uid = this.newId();
    const profile: UserProfile = {
      uid,
      loginId: clean.loginId,
      displayName: clean.displayName,
      role: 'teacher',
      active: true,
      status: 'approved',
      createdAt: this.nowIso(),
      approvedAt: this.nowIso(),
      approvedBy: this.actor()!.uid,
    };
    if (!policy.canCreateUser(this.actor(), uid, profile, this.state.appConfig.signup.inviteCode)) throw new AppError('permission-denied', '권한이 없습니다.');
    this.state.users[uid] = profile;
    this.state.credentials[clean.loginId] = await makeCredential(uid, clean.password);
    this.save();
    return this.publicProfile(profile);
  }

  private async resetPassword(uid: string, newPassword: string): Promise<void> {
    await this.ready;
    if (!policy.isAdmin(this.actor())) throw new AppError('permission-denied', '관리자만 비밀번호를 재설정할 수 있습니다.');
    const u = this.state.users[uid];
    if (!u) throw new AppError('not-found', '사용자를 찾을 수 없습니다.');
    if (newPassword.length < MIN_PASSWORD_LENGTH) throw new AppError('weak-password', `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상입니다.`);
    this.state.credentials[u.loginId] = await makeCredential(uid, newPassword);
    this.save();
  }

  // ------------------------------------------------------------ AI 사용 설정·사용 현황 (가이드 §9.3-7)
  private async getAiSettings(): Promise<AiSettings> {
    await this.ready;
    if (!policy.canReadAiSettings(this.actor())) throw new AppError('permission-denied', '승인된 계정만 볼 수 있습니다.');
    return this.state.appConfig.ai ?? { dailyQuotaPerTeacher: null };
  }

  private async setAiSettings(v: AiSettings): Promise<void> {
    await this.ready;
    if (!policy.canWriteShared(this.actor(), 'appConfig')) throw new AppError('permission-denied', '관리자만 바꿀 수 있습니다.');
    const q = v.dailyQuotaPerTeacher;
    if (q !== null && (!Number.isInteger(q) || q < 1 || q > 1000)) throw new AppError('invalid-input', '하루 한도는 1~1000 사이 정수로 정하거나 비워 두세요.');
    this.state.appConfig.ai = { dailyQuotaPerTeacher: q };
    this.save();
  }

  private today() {
    const d = this.opts.now?.() ?? new Date();
    // 한국 시간 기준 날짜
    return new Date(d.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
  }

  private async todayUsage(): Promise<{ total: number; quota: number | null }> {
    await this.ready;
    const a = this.actor();
    if (!a || !policy.canReadUsage(a, a.uid)) throw new AppError('permission-denied', '로그인이 필요합니다.');
    const rec = this.state.usage?.[`${a.uid}_${this.today()}`];
    return { total: rec?.total ?? 0, quota: this.state.appConfig.ai?.dailyQuotaPerTeacher ?? null };
  }

  private async recordUsage(kind: UsageKind): Promise<void> {
    const { total, quota } = await this.todayUsage();
    const a = this.actor()!;
    if (quota !== null && total >= quota) throw new AppError('quota-exceeded', `오늘 AI 생성 한도(${quota}회)를 모두 썼습니다. 내일 다시 이용하거나 관리자에게 문의하세요.`);
    const key = `${a.uid}_${this.today()}`;
    const before = this.state.usage?.[key] ?? { uid: a.uid, day: this.today(), counts: {}, total: 0 };
    const after: UsageRecord = { ...before, counts: { ...before.counts, [kind]: (before.counts[kind] ?? 0) + 1 }, total: before.total + 1 };
    if (!policy.canWriteUsage(a, a.uid, before.total, after.total)) throw new AppError('permission-denied', '권한이 없습니다.');
    this.state.usage = { ...this.state.usage, [key]: after };
    this.save();
  }

  private async listUsage(): Promise<UsageRecord[]> {
    await this.ready;
    if (!policy.isAdmin(this.actor())) throw new AppError('permission-denied', '관리자만 볼 수 있습니다.');
    return Object.values(this.state.usage ?? {}).sort((x, y) => y.day.localeCompare(x.day) || x.uid.localeCompare(y.uid));
  }
}

// ------------------------------------------------------------ 비밀번호 해시 (로컬 모드 전용)
// 일부 내장 화면(보안 컨텍스트가 아닌 프레임)에는 crypto.subtle이 없으므로 순수 JS 대체 구현을 둔다.
const sha256 = sha256Hex;
function randomId(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  const bytes = new Uint8Array(16);
  if (c?.getRandomValues) c.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function makeCredential(uid: string, password: string): Promise<Credential> {
  const salt = randomId();
  return { uid, salt, hash: await sha256(salt + password) };
}
async function verifyCredential(c: Credential, password: string): Promise<boolean> {
  return (await sha256(c.salt + password)) === c.hash;
}

export { sha256Fallback };
