// 저장소 어댑터 인터페이스 — 로컬 모드(개발·테스트)와 Firebase 모드(실서비스)가 같은 인터페이스를 구현한다.
// 화면 코드는 이 인터페이스만 사용하고 Firebase를 직접 부르지 않는다.

export type Role = 'admin' | 'teacher';
/** 가입 신청 상태 (가이드 §6.2 B안) */
export type UserStatus = 'pending' | 'approved' | 'rejected';

export interface UserProfile {
  uid: string;
  loginId: string;
  displayName: string;
  role: Role;
  active: boolean;
  status: UserStatus;
  createdAt: string;
  approvedAt?: string;
  approvedBy?: string;
  rejectReason?: string;
  lastLoginAt?: string;
}

export interface SignUpInput {
  inviteCode: string;
  loginId: string;
  displayName: string;
  password: string;
}

export interface AuthService {
  /** ID(영소문자·숫자 4~20자)와 비밀번호로 로그인. 실패 시 AppError */
  signIn(loginId: string, password: string): Promise<UserProfile>;
  /** 가입 코드로 가입 신청 → 승인 대기(active=false) 계정 생성 후 로그인 상태가 됨 */
  signUp(input: SignUpInput): Promise<UserProfile>;
  signOut(): Promise<void>;
  /** 내 비밀번호 변경 (본인만) */
  changePassword(currentPassword: string, newPassword: string): Promise<void>;
  currentUser(): UserProfile | null;
  /** 로그인 상태 변화 구독. 반환값을 호출하면 구독 해제 */
  onChange(listener: (user: UserProfile | null) => void): () => void;
}

export interface CreateUserInput {
  loginId: string;
  displayName: string;
  password: string;
}

/** AI 사용 설정 (appConfig/ai, 가이드 §7) */
export interface AiSettings {
  /** 교사 1명이 하루에 AI로 만들 수 있는 횟수. null = 제한 없음 */
  dailyQuotaPerTeacher: number | null;
  /** Gemini 모델 이름. null = 기본값(src/lib/ai/geminiCore.ts DEFAULT_MODEL) */
  model?: string | null;
}

/** 설정이 없을 때의 하루 한도 (2026-10-22 사용자 결정: 정하지 않으면 20회) */
export const DEFAULT_DAILY_QUOTA = 20;

export type UsageKind = 'material' | 'films' | 'strategies' | 'lessonPlan';
export const USAGE_LABEL: Record<UsageKind, string> = { material: '읽기자료', films: '영화 추천', strategies: '전략 추천 이유', lessonPlan: '수업지도안' };

/** 교사별·날짜별 AI 사용 횟수 (usage/{uid}_{날짜}). 개인정보 최소화: 무엇을 만들었는지는 남기지 않는다 */
export interface UsageRecord {
  uid: string;
  day: string;
  counts: Partial<Record<UsageKind, number>>;
  total: number;
}

export interface AdminService {
  listUsers(): Promise<UserProfile[]>;
  approve(uid: string): Promise<void>;
  reject(uid: string, reason: string): Promise<void>;
  setActive(uid: string, active: boolean): Promise<void>;
  getInviteCode(): Promise<string>;
  setInviteCode(code: string): Promise<void>;
  /** 관리자가 직접 교사 계정 발급 (바로 사용 가능) */
  createUser(input: CreateUserInput): Promise<UserProfile>;
  /** 다른 사용자 비밀번호 재설정 — 로컬 모드만. Firebase 모드는 관리자 CLI(tools/admin-cli.mjs) 사용 */
  resetPassword(uid: string, newPassword: string): Promise<void>;
  getAiSettings(): Promise<AiSettings>;
  setAiSettings(s: AiSettings): Promise<void>;
  listUsage(): Promise<UsageRecord[]>;
}

/** TTL 버전 (ontologyVersions, 가이드 §4·§7) */
export interface OntologyVersionMeta {
  id: string;
  note: string;
  createdAt: string;
  createdBy: string;
  createdByName: string;
  /** 네 TTL 파일 해시로 만든 12자리 버전 */
  ontologyVersion: string;
  stats: import('../ontology/compileAll').CompileReport['stats'];
}

/** 교육과정·독서전략 카탈로그 (원문 데이터 + 관리자 입력 연결 정보) */
export interface CatalogService {
  load(): Promise<import('../catalog/catalog').Catalog>;
  /** 관리자 전용: 연결 정보(독서 기능·내용 요소·동사 매핑·전략 보완·읽기 단계) 저장 */
  saveOverrides(patch: Partial<import('../catalog/catalog').CatalogOverrides>): Promise<void>;
  /** 관리자 전용: 연결 정보 전체 바꾸기 (설정 JSON 복원) */
  replaceOverrides(o: import('../catalog/catalog').CatalogOverrides): Promise<void>;
  /** 게시된 TTL 버전 목록 (최신 먼저) */
  listVersions(): Promise<OntologyVersionMeta[]>;
  /** 버전의 TTL 원문. null = 앱에 함께 묶인 기본 데이터 */
  getVersionFiles(id: string | null): Promise<import('../ttl/sourceFiles').SourceFiles>;
  /** 관리자 전용: 검증을 통과한 TTL을 새 버전으로 게시하고 바로 사용 */
  publishVersion(input: { files: import('../ttl/sourceFiles').SourceFiles; note: string }): Promise<OntologyVersionMeta>;
  /** 지금 쓰는 버전. null = 기본 데이터 */
  getActiveVersionId(): Promise<string | null>;
  /** 관리자 전용: 사용할 버전 바꾸기(롤백 포함). null = 기본 데이터 */
  setActiveVersion(id: string | null): Promise<void>;
}

/** AI 프롬프트 템플릿 (promptTemplates, 가이드 §7·§9.3-6) */
export type PromptKind = 'material' | 'films' | 'strategies' | 'lessonPlan';
export interface PromptTemplate {
  kind: PromptKind;
  version: number;
  body: string;
  updatedAt: string | null;
  updatedBy: string | null;
  /** 이전 버전 (최근 10개) */
  history: { version: number; body: string; updatedAt: string | null }[];
}
export interface PromptService {
  list(): Promise<PromptTemplate[]>;
  /** 관리자 전용: 새 버전으로 저장 */
  save(kind: PromptKind, body: string): Promise<PromptTemplate>;
}

export interface UsageService {
  /** AI 생성 1회 기록. 하루 한도를 넘으면 AppError('quota-exceeded') */
  record(kind: UsageKind): Promise<void>;
  /** 오늘 내 사용 횟수와 한도 */
  today(): Promise<{ total: number; quota: number | null }>;
}

export interface Services {
  auth: AuthService;
  admin: AdminService;
  catalog: CatalogService;
  library: import('../library/types').LibraryService;
  prompts: PromptService;
  usage: UsageService;
}

/** 화면에 그대로 보여줄 수 있는 한국어 메시지를 담은 오류 */
export class AppError extends Error {
  constructor(
    readonly code:
      | 'invalid-login-id'
      | 'weak-password'
      | 'wrong-credentials'
      | 'wrong-invite-code'
      | 'login-id-taken'
      | 'permission-denied'
      | 'not-found'
      | 'invalid-input'
      | 'quota-exceeded'
      | 'unavailable',
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/** 로그인 ID 규칙 (가이드 §6.1) */
export const LOGIN_ID_PATTERN = /^[a-z0-9]{4,20}$/;
/** 앱 비밀번호 최소 길이 (가이드 §6.1: Firebase 최소 6자, 앱은 8자 이상 권장) */
export const MIN_PASSWORD_LENGTH = 8;
/** 가입 코드 규칙: 공백 없는 4~32자 */
export const INVITE_CODE_PATTERN = /^\S{4,32}$/;
/** 로그인 ID → Firebase용 내부 이메일 (사용자에게 노출하지 않음, 가이드 §6.1) */
export const LOGIN_EMAIL_DOMAIN = 'ttl-edu.local';
export const toInternalEmail = (loginId: string) => `${loginId}@${LOGIN_EMAIL_DOMAIN}`;

export function validateAiSettings(v: AiSettings): void {
  const q = v.dailyQuotaPerTeacher;
  if (q !== null && (!Number.isInteger(q) || q < 1 || q > 1000)) throw new AppError('invalid-input', '하루 한도는 1~1000 사이 정수로 정하거나 비워 두세요.');
  if (v.model && !/^gemini-[a-z0-9.-]+$/.test(v.model)) throw new AppError('invalid-input', '모델 이름은 gemini-로 시작하는 영어 소문자·숫자·점·하이픈으로 쓰세요.');
}

export function validateSignUp(input: SignUpInput): void {
  if (!INVITE_CODE_PATTERN.test(input.inviteCode)) throw new AppError('wrong-invite-code', '가입 코드를 확인하세요.');
  if (!LOGIN_ID_PATTERN.test(input.loginId)) throw new AppError('invalid-login-id', '아이디는 영어 소문자와 숫자 4~20자입니다.');
  if (input.displayName.trim().length < 1 || input.displayName.trim().length > 30)
    throw new AppError('invalid-input', '표시 이름은 1~30자로 입력하세요.');
  if (input.password.length < MIN_PASSWORD_LENGTH) throw new AppError('weak-password', `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상입니다.`);
}
