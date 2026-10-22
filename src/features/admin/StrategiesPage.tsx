// 관리자 › 독서전략 (가이드 §9.3-4, §5.3): 실행 절차·적합 텍스트 유형·권장 사태·권장 시간·활동지 형태·검수 상태
import { useState } from 'react';
import { useServices } from '../../app/AuthContext';
import { useCatalog, useCatalogState } from '../../app/CatalogContext';
import { Alert, Badge, Button, errorMessage } from '../../components/ui';
import { READING_PHASE_LABEL, type StrategyExtension } from '../../lib/catalog/catalog';

type Draft = Omit<StrategyExtension, 'procedure' | 'minutes'> & { procedure: string; minutes: string };

export default function StrategiesPage() {
  const catalog = useCatalog();
  const { reload } = useCatalogState();
  const { catalog: service } = useServices();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'draft' | 'reviewed'>('all');
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [msg, setMsg] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);

  const list = catalog.reading.strategies.filter((s) => (!q.trim() || s.label.includes(q.trim())) && (filter === 'all' || s.reviewStatus === filter));
  const reviewed = catalog.reading.strategies.filter((s) => s.reviewStatus === 'reviewed').length;

  function open(id: string) {
    const s = catalog.strategy(id)!;
    setSelected(id);
    setMsg(null);
    setDraft({ procedure: s.procedure.join('\n'), suitableTextTypeIds: s.suitableTextTypeIds, recommendedEvents: s.recommendedEvents, minutes: s.minutes === null ? '' : String(s.minutes), reviewStatus: s.reviewStatus, worksheetHint: s.worksheetHint ?? '' });
  }

  async function save() {
    if (!selected || !draft) return;
    const procedure = draft.procedure.split('\n').map((x) => x.trim()).filter(Boolean);
    const minutes = draft.minutes.trim() ? Number(draft.minutes) : null;
    if (minutes !== null && (!Number.isInteger(minutes) || minutes < 1 || minutes > 100)) return setMsg({ tone: 'error', text: '권장 시간은 1~100 사이 정수(분)로 쓰거나 비워 두세요.' });
    if (draft.reviewStatus === 'reviewed' && procedure.length === 0) return setMsg({ tone: 'error', text: '실행 절차가 없으면 ‘검수 완료’로 바꿀 수 없습니다.' });
    try {
      await service.saveOverrides({ strategies: { [selected]: { procedure, suitableTextTypeIds: draft.suitableTextTypeIds, recommendedEvents: [...draft.recommendedEvents].sort((a, b) => a - b), minutes, reviewStatus: draft.reviewStatus, worksheetHint: draft.worksheetHint.trim() } } });
      await reload();
      setMsg({ tone: 'success', text: `「${catalog.strategy(selected)!.label}」을(를) 저장했습니다. 교사 화면 추천·지도안에 바로 반영됩니다.` });
    } catch (e) {
      setMsg({ tone: 'error', text: errorMessage(e) });
    }
  }

  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const s = selected ? catalog.strategy(selected) : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <aside className="space-y-3">
        <p className="text-sm text-stone-600">
          전략 {catalog.reading.strategies.length}개 · 검수 완료 {reviewed}개
        </p>
        <input type="search" aria-label="전략 찾기" placeholder="전략 이름" value={q} onChange={(e) => setQ(e.target.value)} className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm" />
        <select aria-label="검수 상태" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm">
          <option value="all">모두</option>
          <option value="draft">검수 전</option>
          <option value="reviewed">검수 완료</option>
        </select>
        <ul className="max-h-[60vh] divide-y divide-stone-100 overflow-y-auto rounded-md border border-stone-200 bg-white text-sm">
          {list.map((x) => (
            <li key={x.id}>
              <button type="button" onClick={() => open(x.id)} aria-current={selected === x.id} className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left ${selected === x.id ? 'bg-stone-900 text-white' : 'hover:bg-stone-50'}`}>
                <span>{x.label}</span>
                {x.reviewStatus === 'reviewed' && <span className="text-xs">✓</span>}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className="min-w-0 space-y-5">
        {!s || !draft ? (
          <p className="text-sm text-stone-500">왼쪽에서 전략을 고르세요.</p>
        ) : (
          <>
            <div>
              <h2 className="text-lg font-semibold">{s.label}</h2>
              <p className="text-sm text-stone-600">
                독서 기능: {s.functionIds.map((f) => `${catalog.functionLabel(f)}(${READING_PHASE_LABEL[catalog.readingPhaseOf(f)]})`).join(', ')}{' '}
                {s.reviewStatus === 'reviewed' ? <Badge tone="green">검수 완료</Badge> : <Badge tone="amber">검수 전(초안)</Badge>}
              </p>
            </div>
            <div className="space-y-1">
              <label htmlFor="procedure" className="text-sm font-semibold">
                실행 절차 <span className="font-normal text-stone-500">(한 줄에 한 단계, 3~6단계 권장)</span>
              </label>
              <textarea id="procedure" rows={6} value={draft.procedure} onChange={(e) => setDraft({ ...draft, procedure: e.target.value })} className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm" />
            </div>
            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold">적합 텍스트 유형</legend>
              {catalog.textTypes.categories.map((c) => (
                <div key={c.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="w-24 text-xs text-stone-500">{c.label}</span>
                  {catalog.textTypes.types
                    .filter((t) => t.categoryId === c.id)
                    .map((t) => (
                      <label key={t.id} className="flex items-center gap-1">
                        <input type="checkbox" checked={draft.suitableTextTypeIds.includes(t.id)} onChange={() => setDraft({ ...draft, suitableTextTypeIds: toggle(draft.suitableTextTypeIds, t.id) })} />
                        {t.label}
                      </label>
                    ))}
                </div>
              ))}
            </fieldset>
            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold">
                권장 사태 <span className="font-normal text-stone-500">(지도안에서 이 사태에 배치. 주로 4~6, 비우면 읽기 단계로 정함)</span>
              </legend>
              <div className="flex flex-wrap gap-3 text-sm">
                {catalog.gagne.events.map((e) => (
                  <label key={e.seq} className="flex items-center gap-1">
                    <input type="checkbox" checked={draft.recommendedEvents.includes(e.seq)} onChange={() => setDraft({ ...draft, recommendedEvents: toggle(draft.recommendedEvents, e.seq) })} />
                    {e.seq}. {e.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="font-semibold">권장 시간(분)</span>
                <input type="number" min={1} max={100} value={draft.minutes} onChange={(e) => setDraft({ ...draft, minutes: e.target.value })} className="block w-32 rounded-md border border-stone-300 bg-white px-3 py-2" />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-semibold">활동지 형태</span>
                <input value={draft.worksheetHint} onChange={(e) => setDraft({ ...draft, worksheetHint: e.target.value })} placeholder="예: 표, 벤 다이어그램" className="block w-full rounded-md border border-stone-300 bg-white px-3 py-2" />
              </label>
            </div>
            <fieldset className="flex gap-4 text-sm">
              <legend className="mb-1 font-semibold">검수 상태</legend>
              <label className="flex items-center gap-1">
                <input type="radio" name="review" checked={draft.reviewStatus === 'draft'} onChange={() => setDraft({ ...draft, reviewStatus: 'draft' })} />
                검수 전(초안)
              </label>
              <label className="flex items-center gap-1">
                <input type="radio" name="review" checked={draft.reviewStatus === 'reviewed'} onChange={() => setDraft({ ...draft, reviewStatus: 'reviewed' })} />
                검수 완료
              </label>
            </fieldset>
            {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
            <Button onClick={save}>저장</Button>
          </>
        )}
      </section>
    </div>
  );
}
