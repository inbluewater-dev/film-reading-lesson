// 저장소 어댑터 인터페이스 — 로컬 모드(개발·테스트)와 Firebase 모드(실서비스)가 같은 인터페이스를 구현한다.
// 화면 코드는 이 인터페이스만 사용하고 Firebase를 직접 부르지 않는다. (구현은 Phase 2)

export type Role = 'admin' | 'teacher';

export interface UserProfile {
  uid: string;
  loginId: string;
  displayName: string;
  role: Role;
  active: boolean;
}

export interface AuthService {
  /** ID(영소문자·숫자 4~20자)와 비밀번호로 로그인. 실패 시 한국어 오류 메시지를 담은 Error */
  signIn(loginId: string, password: string): Promise<UserProfile>;
  signOut(): Promise<void>;
  currentUser(): UserProfile | null;
  onChange(listener: (user: UserProfile | null) => void): () => void;
}

/** 로그인 ID 규칙 (가이드 §6.1) */
export const LOGIN_ID_PATTERN = /^[a-z0-9]{4,20}$/;
