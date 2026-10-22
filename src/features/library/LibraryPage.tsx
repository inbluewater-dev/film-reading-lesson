// 내 보관함 (가이드 §9.2-4): 목록·검색·복제·삭제
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useServices } from '../../app/AuthContext';
import { useCatalogState } from '../../app/CatalogContext';
import { Alert, Badge, Button, errorMessage } from '../../components/ui';
import type { MaterialRecord } from '../../lib/library/types';

export const fmtDate = (iso: string) => new Date(iso).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' });

export default function LibraryPage() {
  const { library } = useServices();
  const { catalog } = useCatalogState();
  const [items, setItems] = useState<MaterialRecord[] | null>(null);
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await library.materials.listMine());
    } catch (e) {
      setMsg({ tone: 'error', text: errorMessage(e) });
    }
  }, [library]);
  useEffect(() => {
    void load();
  }, [load]);

  const act = (fn: () => Promise<unknown>, ok: string) => async () => {
    setMsg(null);
    try {
      await fn();
      setMsg({ tone: 'success', text: ok });
      setConfirmDelete(null);
      await load();
    } catch (e) {
      setMsg({ tone: 'error', text: errorMessage(e) });
    }
  };

  const shown = (items ?? []).filter((m) => !q.trim() || m.title.replace(/\s/g, '').includes(q.replace(/\s/g, '')) || m.standardCodes.some((c) => c.includes(q.trim())));

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">내 보관함</h1>
          <p className="mt-1 text-sm text-stone-600">저장한 읽기자료입니다.</p>
        </div>
        <input type="search" aria-label="보관함 검색" placeholder="제목이나 성취기준 코드로 찾기" value={q} onChange={(e) => setQ(e.target.value)} className="w-64 max-w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm" />
      </div>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      {items === null ? (
        <p className="text-sm text-stone-500">불러오는 중…</p>
      ) : shown.length === 0 ? (
        <div className="rounded-md border border-dashed border-stone-300 p-8 text-center text-sm text-stone-600">
          {items.length === 0 ? '아직 저장한 읽기자료가 없습니다.' : '찾는 자료가 없습니다.'}{' '}
          <Link to="/explore" className="font-medium underline">
            새 수업 만들기
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-stone-200 rounded-md border border-stone-200 bg-white">
          {shown.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-3" data-testid="material-item">
              <div className="min-w-0 flex-1">
                <Link to={`/library/material/${m.id}`} className="font-medium hover:underline">
                  {m.title}
                </Link>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-stone-500">
                  <span>{catalog?.subject(m.subjectId)?.label}</span>
                  <span>{m.standardCodes.join(' ')}</span>
                  <span>{fmtDate(m.updatedAt)}</span>
                  {m.reviewedByTeacher ? <Badge tone="green">검토함</Badge> : <Badge tone="amber">검토 전</Badge>}
                  {m.copiedFrom && <Badge tone="stone">복제본</Badge>}
                </div>
              </div>
              {confirmDelete === m.id ? (
                <div className="flex items-center gap-2 text-sm">
                  <span>삭제할까요?</span>
                  <Button variant="danger" onClick={act(() => library.materials.remove(m.id), `「${m.title}」을(를) 삭제했습니다.`)}>
                    삭제
                  </Button>
                  <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
                    취소
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={act(() => library.materials.copy(m.id), `「${m.title}」을(를) 복제했습니다.`)}>
                    복제
                  </Button>
                  <Button variant="ghost" onClick={() => setConfirmDelete(m.id)}>
                    삭제
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
