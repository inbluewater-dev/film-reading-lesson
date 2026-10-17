import { useState, type FormEvent } from 'react';
import { useAuth, useServices } from '../../app/AuthContext';
import { Alert, Button, Field, errorMessage } from '../../components/ui';
import { MIN_PASSWORD_LENGTH } from '../../lib/data/types';

export default function AccountPage() {
  const { user } = useAuth();
  const services = useServices();
  const [f, setF] = useState({ current: '', next: '', confirm: '' });
  const [msg, setMsg] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (f.next !== f.confirm) return setMsg({ tone: 'error', text: '새 비밀번호 확인이 일치하지 않습니다.' });
    try {
      await services.auth.changePassword(f.current, f.next);
      setF({ current: '', next: '', confirm: '' });
      setMsg({ tone: 'success', text: '비밀번호를 바꿨습니다.' });
    } catch (err) {
      setMsg({ tone: 'error', text: errorMessage(err) });
    }
  }

  return (
    <section className="max-w-sm space-y-6">
      <h1 className="text-xl font-bold">내 정보</h1>
      <dl className="grid grid-cols-[6rem_1fr] gap-y-1 text-sm">
        <dt className="text-stone-500">아이디</dt>
        <dd>{user?.loginId}</dd>
        <dt className="text-stone-500">표시 이름</dt>
        <dd>{user?.displayName}</dd>
        <dt className="text-stone-500">역할</dt>
        <dd>{user?.role === 'admin' ? '관리자' : '교사'}</dd>
      </dl>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <h2 className="font-semibold">비밀번호 변경</h2>
        <Field label="현재 비밀번호" type="password" autoComplete="current-password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} />
        <Field label="새 비밀번호" type="password" autoComplete="new-password" hint={`${MIN_PASSWORD_LENGTH}자 이상`} value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} />
        <Field label="새 비밀번호 확인" type="password" autoComplete="new-password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} />
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
        <Button type="submit">비밀번호 변경</Button>
      </form>
    </section>
  );
}
