// 관리자 › 사용 현황 (가이드 §9.3-7): 교사별 AI 생성 횟수(무엇을 만들었는지는 남기지 않음), 하루 한도
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useServices } from '../../app/AuthContext';
import { Alert, Button, errorMessage } from '../../components/ui';
import { USAGE_LABEL, type UsageKind, type UsageRecord, type UserProfile } from '../../lib/data/types';

const KINDS = Object.keys(USAGE_LABEL) as UsageKind[];
const kstToday = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);

export default function UsagePage() {
  const { admin } = useServices();
  const [rows, setRows] = useState<UsageRecord[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [quota, setQuota] = useState('');
  const [msg, setMsg] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const [u, r, s] = await Promise.all([admin.listUsers(), admin.listUsage(), admin.getAiSettings()]);
      setUsers(u);
      setRows(r);
      setQuota(s.dailyQuotaPerTeacher === null ? '' : String(s.dailyQuotaPerTeacher));
    } catch (e) {
      setMsg({ tone: 'error', text: errorMessage(e) });
    }
  }, [admin]);
  useEffect(() => {
    void load();
  }, [load]);

  async function saveQuota(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      const v = quota.trim() ? Number(quota) : null;
      await admin.setAiSettings({ dailyQuotaPerTeacher: v });
      setMsg({ tone: 'success', text: v === null ? '하루 한도를 없앴습니다.' : `교사 1명당 하루 ${v}회로 정했습니다.` });
    } catch (err) {
      setMsg({ tone: 'error', text: errorMessage(err) });
    }
  }

  const name = (uid: string) => {
    const u = users.find((x) => x.uid === uid);
    return u ? `${u.displayName} (${u.loginId})` : uid;
  };
  const month = kstToday().slice(0, 7);
  const monthly = new Map<string, number>();
  for (const r of rows) if (r.day.startsWith(month)) monthly.set(r.uid, (monthly.get(r.uid) ?? 0) + r.total);
  const today = rows.filter((r) => r.day === kstToday());

  return (
    <div className="space-y-10">
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <section className="max-w-md space-y-2">
        <h2 className="text-lg font-semibold">하루 한도</h2>
        <p className="text-sm text-stone-600">교사 1명이 하루(한국 시간)에 AI로 만들 수 있는 횟수입니다. 읽기자료·영화 추천·전략 추천 이유·지도안이 각각 1회입니다. 비워 두면 제한하지 않습니다.</p>
        <form onSubmit={saveQuota} className="flex items-end gap-2">
          <label className="text-sm">
            <span className="block font-medium">하루 횟수</span>
            <input type="number" min={1} max={1000} value={quota} onChange={(e) => setQuota(e.target.value)} placeholder="제한 없음" className="mt-1 w-36 rounded-md border border-stone-300 bg-white px-3 py-2" aria-label="하루 횟수" />
          </label>
          <Button type="submit">저장</Button>
        </form>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">이번 달 교사별 합계</h2>
        {monthly.size === 0 ? (
          <p className="text-sm text-stone-500">이번 달 기록이 없습니다.</p>
        ) : (
          <ul className="text-sm">
            {[...monthly.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([uid, n]) => (
                <li key={uid}>
                  {name(uid)} — {n}회
                </li>
              ))}
          </ul>
        )}
        <p className="text-xs text-stone-500">오늘 {today.reduce((a, r) => a + r.total, 0)}회 · 사용한 교사 {today.length}명</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">날짜별 기록</h2>
        <div className="overflow-x-auto rounded-md border border-stone-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-stone-100 text-left text-stone-600">
              <tr>
                <th className="px-3 py-2">날짜</th>
                <th className="px-3 py-2">교사</th>
                {KINDS.map((k) => (
                  <th key={k} className="px-3 py-2 text-right">
                    {USAGE_LABEL[k]}
                  </th>
                ))}
                <th className="px-3 py-2 text-right">합계</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={KINDS.length + 3} className="px-3 py-4 text-center text-stone-500">
                    아직 기록이 없습니다.
                  </td>
                </tr>
              )}
              {rows.slice(0, 200).map((r) => (
                <tr key={`${r.uid}_${r.day}`} data-testid="usage-row">
                  <td className="px-3 py-2 tabular-nums">{r.day}</td>
                  <td className="px-3 py-2">{name(r.uid)}</td>
                  {KINDS.map((k) => (
                    <td key={k} className="px-3 py-2 text-right tabular-nums">
                      {r.counts[k] ?? 0}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right font-medium tabular-nums">{r.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
