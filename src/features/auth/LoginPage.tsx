import { FormEvent, useState } from 'react';
import { config } from '../../lib/config';
import { LOGIN_ID_PATTERN } from '../../lib/data/types';

export default function LoginPage() {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!LOGIN_ID_PATTERN.test(loginId)) {
      setError('아이디는 영어 소문자와 숫자 4~20자입니다.');
      return;
    }
    if (password.length < 6) {
      setError('비밀번호는 6자 이상입니다.');
      return;
    }
    // 실제 로그인 처리는 Phase 2에서 AuthService로 연결
    setError('로그인 기능은 아직 준비 중입니다. (Phase 2)');
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <p className="text-sm font-medium text-amber-700 tracking-wide">고등학교 영화 교과</p>
        <h1 className="mt-1 text-2xl font-bold">영화 수업 설계 도우미</h1>
        <p className="mt-2 text-sm text-stone-600">
          교육과정에서 출발해 읽기자료, 독서전략, 수업지도안을 만듭니다.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4" noValidate>
          <label className="block">
            <span className="text-sm font-medium">아이디</span>
            <input
              name="loginId"
              autoComplete="username"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value.trim())}
              className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-600"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">비밀번호</span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-600"
            />
          </label>
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
          <button
            type="submit"
            className="w-full rounded-md bg-stone-900 py-2.5 text-white font-medium hover:bg-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-600 focus:ring-offset-2"
          >
            로그인
          </button>
        </form>

        <p className="mt-6 text-xs text-stone-500">
          비밀번호를 잊었으면 관리자에게 문의하세요.
        </p>
        {config.dataMode === 'local' && (
          <p className="mt-2 text-xs text-stone-400">로컬 모드 · AI {config.aiMode === 'mock' ? '샘플(Mock)' : 'Gemini'}</p>
        )}
      </div>
    </main>
  );
}
