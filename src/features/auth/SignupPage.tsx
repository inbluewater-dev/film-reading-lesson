import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useServices } from '../../app/AuthContext';
import { Alert, Button, Field, errorMessage } from '../../components/ui';
import { MIN_PASSWORD_LENGTH, validateSignUp } from '../../lib/data/types';
import AuthShell from './AuthShell';

export default function SignupPage() {
  const services = useServices();
  const navigate = useNavigate();
  const [form, setForm] = useState({ inviteCode: '', loginId: '', displayName: '', password: '', confirm: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const input = { inviteCode: form.inviteCode.trim(), loginId: form.loginId.trim(), displayName: form.displayName.trim(), password: form.password };
    try {
      validateSignUp(input);
      if (form.password !== form.confirm) throw new Error('비밀번호 확인이 일치하지 않습니다.');
      setBusy(true);
      await services.auth.signUp(input);
      navigate('/pending', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="가입 신청" lead="관리자에게 받은 가입 코드를 입력하세요. 관리자가 승인하면 사용할 수 있습니다.">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Field label="가입 코드" name="inviteCode" autoComplete="off" value={form.inviteCode} onChange={set('inviteCode')} />
        <Field label="아이디" name="loginId" autoComplete="username" hint="영어 소문자와 숫자 4~20자" value={form.loginId} onChange={set('loginId')} />
        <Field label="표시 이름" name="displayName" hint="다른 교사에게 보이는 이름 (예: 김영화 선생님)" value={form.displayName} onChange={set('displayName')} />
        <Field label="비밀번호" name="password" type="password" autoComplete="new-password" hint={`${MIN_PASSWORD_LENGTH}자 이상`} value={form.password} onChange={set('password')} />
        <Field label="비밀번호 확인" name="confirm" type="password" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} />
        {error && <Alert>{error}</Alert>}
        <Button type="submit" className="w-full py-2.5" disabled={busy}>
          {busy ? '신청 중…' : '가입 신청'}
        </Button>
      </form>
      <p className="mt-6 text-sm text-stone-600">
        이미 계정이 있나요? <Link to="/login" className="font-medium text-amber-800 underline">로그인</Link>
      </p>
    </AuthShell>
  );
}
