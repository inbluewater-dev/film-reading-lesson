import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useServices } from '../../app/AuthContext';
import { Alert, Badge, Button, Field, errorMessage } from '../../components/ui';
import type { UserProfile } from '../../lib/data/types';

const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' }) : '—');

export default function AdminHome() {
  const { admin, auth } = useServices();
  const me = auth.currentUser();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [code, setCode] = useState('');
  const [newCode, setNewCode] = useState('');
  const [msg, setMsg] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [rejecting, setRejecting] = useState<{ uid: string; reason: string } | null>(null);

  const reload = useCallback(async () => {
    try {
      setUsers(await admin.listUsers());
      setCode(await admin.getInviteCode());
    } catch (e) {
      setMsg({ tone: 'error', text: errorMessage(e) });
    }
  }, [admin]);
  useEffect(() => {
    void reload();
  }, [reload]);

  const run = (fn: () => Promise<void>, ok: string) => async () => {
    setMsg(null);
    try {
      await fn();
      setMsg({ tone: 'success', text: ok });
      await reload();
    } catch (e) {
      setMsg({ tone: 'error', text: errorMessage(e) });
    }
  };

  const pending = users.filter((u) => u.status === 'pending');
  const others = users.filter((u) => u.status !== 'pending');

  async function saveCode(e: FormEvent) {
    e.preventDefault();
    await run(() => admin.setInviteCode(newCode), '가입 코드를 바꿨습니다. 이제 새 코드로만 가입할 수 있습니다.')();
    setNewCode('');
  }

  return (
    <div className="space-y-10">
      <h1 className="text-xl font-bold">관리자</h1>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}

      <section aria-labelledby="pending-h">
        <h2 id="pending-h" className="text-lg font-semibold">
          가입 신청 <Badge tone="amber">{pending.length}건</Badge>
        </h2>
        {pending.length === 0 ? (
          <p className="mt-3 text-sm text-stone-500">대기 중인 가입 신청이 없습니다.</p>
        ) : (
          <ul className="mt-3 divide-y divide-stone-200 rounded-md border border-stone-200 bg-white">
            {pending.map((u) => (
              <li key={u.uid} className="flex flex-wrap items-center gap-3 px-4 py-3" data-testid={`pending-${u.loginId}`}>
                <div className="min-w-48">
                  <div className="font-medium">{u.displayName}</div>
                  <div className="text-xs text-stone-500">
                    {u.loginId} · 신청 {fmt(u.createdAt)}
                  </div>
                </div>
                {rejecting?.uid === u.uid ? (
                  <div className="ml-auto flex flex-wrap items-center gap-2">
                    <input
                      aria-label="거절 사유"
                      placeholder="거절 사유"
                      value={rejecting.reason}
                      onChange={(e) => setRejecting({ uid: u.uid, reason: e.target.value })}
                      className="rounded-md border border-stone-300 px-2 py-1.5 text-sm"
                    />
                    <Button variant="danger" onClick={run(() => admin.reject(u.uid, rejecting.reason), `${u.displayName}(${u.loginId})의 가입 신청을 거절했습니다.`)}>
                      거절 확정
                    </Button>
                    <Button variant="ghost" onClick={() => setRejecting(null)}>
                      취소
                    </Button>
                  </div>
                ) : (
                  <div className="ml-auto flex gap-2">
                    <Button onClick={run(() => admin.approve(u.uid), `${u.displayName}(${u.loginId}) 계정을 승인했습니다.`)}>승인</Button>
                    <Button variant="danger" onClick={() => setRejecting({ uid: u.uid, reason: '' })}>
                      거절
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="users-h">
        <h2 id="users-h" className="text-lg font-semibold">사용자</h2>
        <div className="mt-3 overflow-x-auto rounded-md border border-stone-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-stone-100 text-left text-stone-600">
              <tr>
                <th className="px-4 py-2">이름</th>
                <th className="px-4 py-2">아이디</th>
                <th className="px-4 py-2">역할</th>
                <th className="px-4 py-2">상태</th>
                <th className="px-4 py-2">마지막 로그인</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {others.map((u) => (
                <tr key={u.uid} data-testid={`user-${u.loginId}`}>
                  <td className="px-4 py-2">{u.displayName}</td>
                  <td className="px-4 py-2 text-stone-600">{u.loginId}</td>
                  <td className="px-4 py-2">{u.role === 'admin' ? '관리자' : '교사'}</td>
                  <td className="px-4 py-2">
                    {u.status === 'rejected' ? <Badge tone="red">거절됨</Badge> : u.active ? <Badge tone="green">사용 중</Badge> : <Badge tone="stone">중지</Badge>}
                  </td>
                  <td className="px-4 py-2 text-stone-600">{fmt(u.lastLoginAt)}</td>
                  <td className="px-4 py-2 text-right">
                    {u.uid !== me?.uid && u.status === 'approved' && (
                      <Button variant="secondary" onClick={run(() => admin.setActive(u.uid, !u.active), u.active ? `${u.displayName}(${u.loginId}) 계정의 사용을 중지했습니다.` : `${u.displayName}(${u.loginId}) 계정을 다시 사용할 수 있게 했습니다.`)}>
                        {u.active ? '사용 중지' : '다시 사용'}
                      </Button>
                    )}
                    {u.status === 'rejected' && (
                      <Button variant="secondary" onClick={run(() => admin.approve(u.uid), `${u.displayName}(${u.loginId}) 계정을 승인했습니다.`)}>
                        승인
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-stone-500">비밀번호 재설정은 관리자 도구로 처리합니다(Phase 8에서 안내).</p>
      </section>

      <section aria-labelledby="code-h" className="max-w-md">
        <h2 id="code-h" className="text-lg font-semibold">가입 코드</h2>
        <p className="mt-2 text-sm">
          현재 가입 코드: <code className="rounded bg-stone-100 px-2 py-0.5" data-testid="invite-code">{code || '—'}</code>
        </p>
        <form onSubmit={saveCode} className="mt-3 flex items-end gap-2">
          <div className="flex-1">
            <Field label="새 가입 코드" name="newCode" hint="공백 없이 4~32자. 바꾸면 이전 코드로는 가입할 수 없습니다." value={newCode} onChange={(e) => setNewCode(e.target.value)} />
          </div>
          <Button type="submit" disabled={!newCode.trim()} className="mb-6">
            변경
          </Button>
        </form>
      </section>
    </div>
  );
}
