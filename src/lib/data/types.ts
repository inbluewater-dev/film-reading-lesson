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

export interface AdminService {
  listUsers(): Promise<UserProfile[]>;
  approve(uid: string): Promise<void>;
  reject(uid: string, reason: string): Promise<void>;
  setActive(uid: string, active: boolean): Promise<void>;
  getInviteCode(): Promise<string>;
  setInviteCode(code: string): Promise<void>;
}

export interface Services {
  auth: AuthService;
  admin: AdminService;
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

export function validateSignUp(input: SignUpInput): void {
  if (!INVITE_CODE_PATTERN.test(input.inviteCode)) throw new AppError('wrong-invite-code', '가입 코드를 확인하세요.');
  if (!LOGIN_ID_PATTERN.test(input.loginId)) throw new AppError('invalid-login-id', '아이디는 영어 소문자와 숫자 4~20자입니다.');
  if (input.displayName.trim().length < 1 || input.displayName.trim().length > 30)
    throw new AppError('invalid-input', '표시 이름은 1~30자로 입력하세요.');
  if (input.password.length < MIN_PASSWORD_LENGTH) throw new AppError('weak-password', `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상입니다.`);
}
