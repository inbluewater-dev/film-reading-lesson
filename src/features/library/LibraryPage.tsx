// 내 보관함 (가이드 §9.2-4): 읽기자료·수업지도안 목록, 검색, 공유/공유 취소, 복제, 삭제
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useServices } from '../../app/AuthContext';
import { useCatalogState } from '../../app/CatalogContext';
import { Alert, Badge, Button, errorMessage } from '../../components/ui';
import type { LessonPlanRecord, MaterialRecord, OwnedStore } from '../../lib/library/types';

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
type Rec = MaterialRecord | LessonPlanRecord;
type Kind = 'materials' | 'lessonPlans';
const KIND_LABEL: Record<Kind, string> = {
  materials: '읽기자료',
  lessonPlans: '수업지도안',
};
export const detailPath = (kind: Kind, id: string) => (kind === 'materials' ? `/library/material/${id}` : `/library/plan/${id}`);

export default function LibraryPage() {
  const [kind, setKind] = useState<Kind>('materials');
  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">내 보관함</h1>
        <p className="mt-1 text-sm text-stone-600">저장한 읽기자료와 수업지도안입니다. 공유하면 다른 선생님이 공유 보관함에서 보고 복제할 수 있습니다.</p>
      </div>
      <KindTabs kind={kind} onChange={setKind} />
      <RecordList key={kind} kind={kind} scope="mine" />
    </section>
  );
}

export function KindTabs({ kind, onChange }: { kind: Kind; onChange: (k: Kind) => void }) {
  return (
    <div className="flex gap-2" role="tablist" aria-label="종류">
      {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
        <button
          key={k}
          type="button"
          role="tab"
          aria-selected={k === kind}
          onClick={() => onChange(k)}
          className={`rounded-md px-4 py-2 text-sm font-medium ${k === kind ? 'bg-stone-900 text-white' : 'border border-stone-300 bg-white hover:bg-stone-100'}`}
        >
          {KIND_LABEL[k]}
        </button>
      ))}
    </div>
  );
}

export function RecordList({ kind, scope }: { kind: Kind; scope: 'mine' | 'shared' }) {
  const { library } = useServices();
  const { catalog } = useCatalogState();
  const store = library[kind] as OwnedStore<Rec>;
  const [items, setItems] = useState<Rec[] | null>(null);
  const [q, setQ] = useState('');
  const [subject, setSubject] = useState('');
  const [msg, setMsg] = useState<{
    tone: 'error' | 'success';
    text: string;
  } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(scope === 'mine' ? await store.listMine() : await store.listShared());
    } catch (e) {
      setMsg({ tone: 'error', text: errorMessage(e) });
    }
  }, [store, scope]);
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

  const norm = (s: string) => s.replace(/\s/g, '');
  const shown = (items ?? []).filter((m) => (!subject || m.subjectId === subject) && (!q.trim() || norm(m.title).includes(norm(q)) || m.standardCodes.some((c) => c.includes(q.trim()))));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <input
          type="search"
          aria-label={`${KIND_LABEL[kind]} 검색`}
          placeholder="제목이나 성취기준 코드로 찾기"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-64 max-w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
        />
        {catalog && (
          <select aria-label="과목" value={subject} onChange={(e) => setSubject(e.target.value)} className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm">
            <option value="">모든 과목</option>
            {catalog.subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        )}
      </div>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      {items === null ? (
        <p className="text-sm text-stone-500">불러오는 중…</p>
      ) : shown.length === 0 ? (
        <div className="rounded-md border border-dashed border-stone-300 p-8 text-center text-sm text-stone-600">
          {items.length === 0 ? (scope === 'mine' ? `아직 저장한 ${KIND_LABEL[kind]}가 없습니다. ` : `아직 공유된 ${KIND_LABEL[kind]}가 없습니다.`) : '찾는 항목이 없습니다.'}
          {scope === 'mine' && items.length === 0 && (
            <Link to="/explore" className="font-medium underline">
              새 수업 만들기
            </Link>
          )}
        </div>
      ) : (
        <ul className="divide-y divide-stone-200 rounded-md border border-stone-200 bg-white">
          {shown.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-3" data-testid={`${kind}-item`}>
              <div className="min-w-0 flex-1">
                <Link to={detailPath(kind, m.id)} className="font-medium hover:underline">
                  {m.title}
                </Link>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-stone-500">
                  {scope === 'shared' && <span>{m.ownerDisplayName}</span>}
                  <span>{catalog?.subject(m.subjectId)?.label}</span>
                  <span className="tabular-nums">{m.standardCodes.join(' ')}</span>
                  <span>{fmtDate(scope === 'shared' ? (m.sharedAt ?? m.updatedAt) : m.updatedAt)}</span>
                  {scope === 'mine' && (m.reviewedByTeacher ? <Badge tone="green">검토함</Badge> : <Badge tone="amber">검토 전</Badge>)}
                  {scope === 'mine' && m.visibility === 'shared' && <Badge tone="stone">공유 중</Badge>}
                  {m.copiedFrom && <Badge tone="stone">복제본</Badge>}
                </div>
              </div>
              {scope === 'shared' ? (
                <Button variant="secondary" onClick={act(() => store.copy(m.id), `「${m.title}」을(를) 내 보관함으로 복제했습니다.`)}>
                  내 보관함으로 복제
                </Button>
              ) : confirmDelete === m.id ? (
                <div className="flex items-center gap-2 text-sm">
                  <span>삭제할까요?</span>
                  <Button variant="danger" onClick={act(() => store.remove(m.id), `「${m.title}」을(를) 삭제했습니다.`)}>
                    삭제
                  </Button>
                  <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
                    취소
                  </Button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    onClick={act(() => store.setVisibility(m.id, m.visibility === 'shared' ? 'private' : 'shared'), m.visibility === 'shared' ? '공유를 취소했습니다.' : '공유 보관함에 올렸습니다.')}
                  >
                    {m.visibility === 'shared' ? '공유 취소' : '공유'}
                  </Button>
                  <Button variant="secondary" onClick={act(() => store.copy(m.id), `「${m.title}」을(를) 복제했습니다.`)}>
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
    </div>
  );
}
