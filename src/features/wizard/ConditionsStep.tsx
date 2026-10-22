// 1단계: 수업 조건 (가이드 §8.3 입력)
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCatalog } from '../../app/CatalogContext';
import { useDraft } from '../../app/DraftContext';
import { Alert, Button, errorMessage } from '../../components/ui';
import { getAi } from '../../lib/ai';
import type { FilmChoice, MaterialParams } from '../../lib/ai/types';
import { nodeTitle } from '../../lib/catalog/catalog';
import { buildContext, subjectsOf, unconfirmedFilms } from '../../lib/lesson/context';
import { useWizard } from './state';

const TEXT_CATEGORY: { key: keyof MaterialParams['textType']; cat: string; label: string; multi?: boolean }[] = [
  { key: 'source', cat: 'tx:SourceMaterial', label: '자료' },
  { key: 'structure', cat: 'tx:StructureAndNavigation', label: '조직과 탐색' },
  { key: 'format', cat: 'tx:Format', label: '체재' },
  { key: 'content', cat: 'tx:ContentType', label: '유형(내용)' },
];

function Choice<T extends string | number | null>({ name, value, options, onChange }: { name: string; value: T; options: { v: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={name}>
      {options.map((o) => (
        <label key={String(o.v)} className={`cursor-pointer rounded-md border px-3 py-1.5 text-sm ${value === o.v ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-300 bg-white hover:bg-stone-100'}`}>
          <input type="radio" name={name} className="sr-only" checked={value === o.v} onChange={() => onChange(o.v)} />
          {o.label}
        </label>
      ))}
    </div>
  );
}

export default function ConditionsStep({ onGenerate }: { onGenerate: () => void }) {
  const catalog = useCatalog();
  const { draft } = useDraft();
  const [w, patch] = useWizard();
  const p = w.params;
  const [filmTitle, setFilmTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subjects = subjectsOf(catalog, draft.selectedNodeIds);
  const subjectId = w.subjectId && subjects.includes(w.subjectId) ? w.subjectId : subjects[0];
  const nodes = draft.selectedNodeIds.map((id) => catalog.node(id)).filter((n) => n && n.subjectId === subjectId);

  const setParams = (next: Partial<MaterialParams>) =>
    patch({ subjectId, params: { ...p, ...next }, stale: w.material ? { material: true, strategies: w.strategyIds.length > 0, plan: !!w.planId } : w.stale });
  const setFilms = (films: FilmChoice[]) => setParams({ films });

  function addFilm() {
    const t = filmTitle.trim();
    if (!t || p.films.some((f) => f.title === t)) return;
    setFilms([...p.films, { title: t, source: 'teacher', confirmed: true }]);
    setFilmTitle('');
  }

  async function suggest() {
    setError(null);
    setBusy(true);
    try {
      const r = await getAi().suggestFilms({ context: buildContext(catalog, draft.selectedNodeIds, subjectId), count: 3 });
      const fresh = r.suggestions.filter((s) => !p.films.some((f) => f.title === s.title)).map((s) => ({ title: s.title, source: 'ai' as const, confirmed: false, reason: `${s.reason} ${s.caution}` }));
      setFilms([...p.films, ...fresh]);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const unconfirmed = unconfirmedFilms(p);

  return (
    <div className="space-y-8">
      <section className="rounded-md border border-stone-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">고른 교육과정</h2>
          <Link to="/explore" className="text-sm text-stone-700 underline">
            다시 고르기
          </Link>
        </div>
        {subjects.length > 1 && (
          <div className="mt-3 space-y-2">
            <Alert tone="info">여러 과목에서 골랐습니다. 수업은 한 과목 기준으로 만듭니다.</Alert>
            <Choice name="과목" value={subjectId} options={subjects.map((id) => ({ v: id, label: catalog.subject(id)!.label }))} onChange={(v) => patch({ subjectId: v })} />
          </div>
        )}
        <ul className="mt-3 space-y-1 text-sm">
          {nodes.map((n) => (
            <li key={n!.id} className="text-stone-700">
              {n!.type === 'standard' ? <strong className="tabular-nums">{n!.standardCode}</strong> : null} {n!.type === 'standard' ? n!.standardText : nodeTitle(n!)}
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">대상 학년 <span className="font-normal text-stone-500">(선택, 어휘 수준 참고)</span></h3>
          <Choice name="대상 학년" value={p.grade} options={[{ v: null, label: '정하지 않음' }, { v: 1, label: '1학년' }, { v: 2, label: '2학년' }, { v: 3, label: '3학년' }]} onChange={(v) => setParams({ grade: v })} />
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">수업 시간</h3>
          <Choice name="수업 시간" value={p.minutes} options={[{ v: 50, label: '50분' }, { v: 100, label: '블록 100분' }]} onChange={(v) => setParams({ minutes: v })} />
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">읽기자료 분량</h3>
          <Choice name="분량" value={p.length} options={[{ v: 400, label: '400자' }, { v: 600, label: '600자' }, { v: 800, label: '800자' }]} onChange={(v) => setParams({ length: v })} />
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">읽기 수준</h3>
          <Choice name="읽기 수준" value={p.level} options={[{ v: '쉬움', label: '쉬움' }, { v: '보통', label: '보통' }, { v: '도전', label: '도전' }]} onChange={(v) => setParams({ level: v })} />
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">텍스트 유형</h3>
        <div className="grid gap-4 md:grid-cols-2">
          {TEXT_CATEGORY.map((c) => (
            <div key={c.key} className="space-y-1">
              <p className="text-xs text-stone-500">{c.label}</p>
              <Choice
                name={`텍스트 유형 ${c.label}`}
                value={p.textType[c.key]}
                options={catalog.textTypes.types.filter((t) => t.categoryId === c.cat).map((t) => ({ v: t.id, label: t.label }))}
                onChange={(v) => setParams({ textType: { ...p.textType, [c.key]: v } })}
              />
              <p className="text-xs text-stone-500">{catalog.textTypes.types.find((t) => t.id === p.textType[c.key])?.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">다룰 영화 <span className="font-normal text-stone-500">(선택)</span></h3>
        <div className="flex flex-wrap gap-2">
          <input
            aria-label="영화 제목"
            placeholder="영화 제목을 입력하세요"
            value={filmTitle}
            onChange={(e) => setFilmTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addFilm())}
            className="min-w-0 flex-1 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
          />
          <Button variant="secondary" onClick={addFilm} disabled={!filmTitle.trim()}>
            추가
          </Button>
          <Button variant="secondary" onClick={suggest} disabled={busy}>
            {busy ? '추천받는 중…' : 'AI에게 추천받기'}
          </Button>
        </div>
        {error && <Alert>{error}</Alert>}
        {p.films.length > 0 && (
          <ul className="space-y-2">
            {p.films.map((f) => (
              <li key={f.title} className={`rounded-md border p-3 text-sm ${f.source === 'ai' && !f.confirmed ? 'border-amber-300 bg-amber-50' : 'border-stone-200 bg-white'}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <strong>「{f.title}」</strong>
                  <span className="text-xs text-stone-500">{f.source === 'ai' ? 'AI 추천' : '직접 입력'}</span>
                  <button type="button" onClick={() => setFilms(p.films.filter((x) => x.title !== f.title))} className="ml-auto text-xs text-stone-600 underline">
                    빼기
                  </button>
                </div>
                {f.source === 'ai' && (
                  <>
                    {f.reason && <p className="mt-1 text-stone-700">{f.reason}</p>}
                    <label className="mt-2 flex items-center gap-2 font-medium text-amber-950">
                      <input type="checkbox" checked={f.confirmed} onChange={() => setFilms(p.films.map((x) => (x.title === f.title ? { ...x, confirmed: !x.confirmed } : x)))} />
                      제목·감독·연도 등 사실을 확인했습니다
                    </label>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <label htmlFor="extra" className="text-sm font-semibold">
          추가 요청 <span className="font-normal text-stone-500">(선택)</span>
        </label>
        <textarea
          id="extra"
          rows={2}
          value={p.extra}
          onChange={(e) => setParams({ extra: e.target.value })}
          placeholder="예: 모둠 토의로 이어질 수 있게 질문을 넣어 주세요"
          className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
        />
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={onGenerate} disabled={unconfirmed.length > 0 || nodes.length === 0}>
          {w.material ? '이 조건으로 읽기자료 다시 만들기' : '읽기자료 만들기'}
        </Button>
        {unconfirmed.length > 0 && <span className="text-sm text-amber-900">AI가 추천한 영화는 사실 확인을 표시하거나 빼야 진행할 수 있습니다.</span>}
      </div>
    </div>
  );
}
