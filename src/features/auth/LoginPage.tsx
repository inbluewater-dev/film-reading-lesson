import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { homePathFor, useAuth, useServices } from '../../app/AuthContext';
import { Alert, Button, Field, errorMessage } from '../../components/ui';
import { LOGIN_ID_PATTERN } from '../../lib/data/types';
import AuthShell from './AuthShell';

export default function LoginPage() {
  const { user } = useAuth();
  const services = useServices();
  const navigate = useNavigate();
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={homePathFor(user)} replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!LOGIN_ID_PATTERN.test(loginId)) return setError('아이디는 영어 소문자와 숫자 4~20자입니다.');
    if (!password) return setError('비밀번호를 입력하세요.');
    setBusy(true);
    try {
      const u = await services.auth.signIn(loginId, password);
      navigate(homePathFor(u), { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="영화 수업 설계 도우미" lead="교육과정에서 출발해 읽기자료, 독서전략, 수업지도안을 만듭니다.">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Field label="아이디" name="loginId" autoComplete="username" value={loginId} onChange={(e) => setLoginId(e.target.value.trim())} />
        <Field label="비밀번호" name="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <Alert>{error}</Alert>}
        <Button type="submit" className="w-full py-2.5" disabled={busy}>
          {busy ? '확인 중…' : '로그인'}
        </Button>
      </form>
      <p className="mt-6 text-sm text-stone-600">
        처음 사용하시나요? <Link to="/signup" className="font-medium text-amber-800 underline">가입 신청</Link>
      </p>
      <p className="mt-2 text-xs text-stone-500">비밀번호를 잊었으면 관리자에게 문의하세요.</p>
    </AuthShell>
  );
}
