// 교육과정 탐색 (가이드 §9.2-2): 과목 → 영역 → 핵심 아이디어·내용 요소·성취기준, 검색·필터·다중 선택
import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useCatalog } from '../../app/CatalogContext';
import { useDraft } from '../../app/DraftContext';
import { Badge } from '../../components/ui';
import { ELEMENT_KIND_LABEL, nodeTitle, type ElementNode } from '../../lib/catalog/catalog';
import type { CurriculumNode, StandardNode } from '../../lib/validation/schemas';

type Kind = ElementNode['elementKind'];
const KINDS: Kind[] = ['knowledge', 'process', 'value'];
const TYPE_LABEL: Record<CurriculumNode['type'], string> = { area: '영역', coreIdea: '핵심 아이디어', element: '내용 요소', standard: '성취기준' };

export default function ExplorerPage() {
  const catalog = useCatalog();
  const { draft, toggleNode, update } = useDraft();
  const [subjectId, setSubjectId] = useState(catalog.subjects[0].id);
  const [areaId, setAreaId] = useState(catalog.areasOf(catalog.subjects[0].id)[0].id);
  const [query, setQuery] = useState('');
  const [kinds, setKinds] = useState<Kind[]>(KINDS);
  const selected = new Set(draft.selectedNodeIds);

  const subject = catalog.subject(subjectId)!;
  const areas = catalog.areasOf(subjectId);
  const area = catalog.node(areaId);
  const results = useMemo(() => catalog.search(query, subjectId), [catalog, query, subjectId]);

  function pickSubject(id: string) {
    setSubjectId(id);
    setAreaId(catalog.areasOf(id)[0].id);
    setQuery('');
  }
  const countIn = (aid: string) => draft.selectedNodeIds.filter((id) => catalog.node(id)?.parentIds.includes(aid) || id === aid).length;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">교육과정 탐색</h1>
          <p className="mt-1 text-sm text-stone-600">수업의 출발점이 될 성취기준, 내용 요소, 핵심 아이디어를 고르세요. 여러 개를 함께 골라도 됩니다.</p>
        </div>
      </header>

      <nav aria-label="과목" className="flex flex-wrap gap-2">
        {catalog.subjects.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={s.id === subjectId}
            onClick={() => pickSubject(s.id)}
            className={`rounded-md border px-4 py-2 text-left focus:outline-none focus:ring-2 focus:ring-amber-600 ${
              s.id === subjectId ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-300 bg-white hover:bg-stone-100'
            }`}
          >
            <span className="block font-medium">{s.label}</span>
            <span className={`block text-xs ${s.id === subjectId ? 'text-stone-300' : 'text-stone-500'}`}>{s.courseCategory}</span>
          </button>
        ))}
      </nav>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex min-w-0 flex-1 items-center gap-2">
              <span className="sr-only">검색</span>
              <input
                type="search"
                id="curriculum-search"
                placeholder={`${subject.label}에서 검색 (예: 12영이02, 몽타주)`}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-600"
              />
            </label>
            <fieldset className="flex flex-wrap items-center gap-2 text-sm">
              <legend className="sr-only">내용 요소 범주</legend>
              {KINDS.map((k) => (
                <label key={k} className="flex items-center gap-1.5">
                  <input type="checkbox" checked={kinds.includes(k)} onChange={() => setKinds(kinds.includes(k) ? kinds.filter((x) => x !== k) : [...kinds, k])} />
                  {ELEMENT_KIND_LABEL[k]}
                </label>
              ))}
            </fieldset>
          </div>

          {query.trim() ? (
            <SearchResults results={results} selected={selected} onToggle={toggleNode} onOpenArea={(id) => { setAreaId(id); setQuery(''); }} />
          ) : (
            <div className="grid gap-6 md:grid-cols-[13rem_minmax(0,1fr)]">
              <nav aria-label="영역" className="flex flex-row flex-wrap gap-1 md:flex-col">
                {areas.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    aria-current={a.id === areaId ? 'true' : undefined}
                    onClick={() => setAreaId(a.id)}
                    className={`flex items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm focus:outline-none focus:ring-2 focus:ring-amber-600 ${
                      a.id === areaId ? 'bg-amber-100 font-semibold text-amber-950' : 'hover:bg-stone-100'
                    }`}
                  >
                    <span>
                      <span className="text-stone-500">({a.order})</span> {a.label}
                    </span>
                    {countIn(a.id) > 0 && <Badge tone="amber">{countIn(a.id)}</Badge>}
                  </button>
                ))}
              </nav>
              {area && area.type === 'area' && <AreaPanel areaId={area.id} kinds={kinds} selected={selected} onToggle={toggleNode} />}
            </div>
          )}
        </div>

        <SelectionTray ids={draft.selectedNodeIds} onRemove={toggleNode} onClear={() => update({ selectedNodeIds: [] })} />
      </div>
    </div>
  );
}

function AreaPanel({ areaId, kinds, selected, onToggle }: { areaId: string; kinds: Kind[]; selected: Set<string>; onToggle: (id: string) => void }) {
  const catalog = useCatalog();
  const [showNotes, setShowNotes] = useState(false);
  const area = catalog.node(areaId);
  if (!area || area.type !== 'area') return null;
  const coreIdeas = catalog.childrenOf(areaId, 'coreIdea');
  const elements = catalog.childrenOf(areaId, 'element');
  const standards = catalog.childrenOf(areaId, 'standard');

  return (
    <section aria-labelledby="area-h" className="min-w-0 space-y-6">
      <div>
        <h2 id="area-h" className="text-lg font-semibold">
          ({area.order}) {area.label}
        </h2>
        {area.description && <p className="mt-1 text-sm text-stone-600">{area.description}</p>}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-stone-700">핵심 아이디어</h3>
        <ul className="mt-2 space-y-2">
          {coreIdeas.map((c) => (
            <li key={c.id}>
              <SelectRow id={c.id} checked={selected.has(c.id)} onToggle={onToggle}>
                <span className="text-stone-800">{c.description}</span>
              </SelectRow>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-stone-700">내용 요소</h3>
        <div className="mt-2 grid gap-4 sm:grid-cols-3">
          {KINDS.filter((k) => kinds.includes(k)).map((k) => (
            <div key={k} className="min-w-0">
              <p className="text-xs font-medium text-stone-500">{ELEMENT_KIND_LABEL[k]}</p>
              <ul className="mt-1 space-y-1">
                {elements
                  .filter((e) => e.elementKind === k)
                  .map((e) => (
                    <li key={e.id}>
                      <SelectRow id={e.id} checked={selected.has(e.id)} onToggle={onToggle} compact>
                        {e.label}
                      </SelectRow>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-stone-700">성취기준</h3>
        <ul className="mt-2 space-y-3">
          {standards.map((s) => (
            <li key={s.id}>
              <StandardCard standard={s} checked={selected.has(s.id)} onToggle={onToggle} />
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-md border border-stone-200 bg-white">
        <button
          type="button"
          aria-expanded={showNotes}
          onClick={() => setShowNotes(!showNotes)}
          className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-600"
        >
          성취기준 적용 시 고려 사항 ({area.applicationNotes.length})
          <span aria-hidden>{showNotes ? '접기' : '펼치기'}</span>
        </button>
        {showNotes && (
          <ul className="list-disc space-y-2 px-8 pb-4 text-sm text-stone-700">
            {area.applicationNotes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export function FunctionBadge({ standard }: { standard: StandardNode }) {
  const catalog = useCatalog();
  const { functionIds, source } = catalog.functionsFor(standard);
  if (source === 'none')
    return (
      <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-950" title={`끝 동사 “${standard.targetVerb}”에 연결된 독서 기능이 없습니다. 수업을 만들 때 직접 고릅니다.`}>
        독서 기능 미지정
      </span>
    );
  const how = source === 'admin' ? '관리자 지정' : source === 'mapping' ? '동사 매핑' : `“${standard.targetVerb}”`;
  return (
    <span className="inline-flex items-center gap-1 rounded bg-sky-100 px-2 py-0.5 text-xs text-sky-950">
      독서 기능: {functionIds.map((f) => catalog.functionLabel(f)).join(', ')} <span className="text-sky-800/70">({how})</span>
    </span>
  );
}

function StandardCard({ standard, checked, onToggle }: { standard: StandardNode; checked: boolean; onToggle: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`rounded-md border bg-white ${checked ? 'border-amber-500 ring-1 ring-amber-500' : 'border-stone-200'}`}>
      <div className="flex gap-3 p-3">
        <input type="checkbox" id={`sel-${standard.id}`} checked={checked} onChange={() => onToggle(standard.id)} className="mt-1" />
        <label htmlFor={`sel-${standard.id}`} className="min-w-0 flex-1 cursor-pointer">
          <span className="font-semibold tabular-nums text-stone-900">{standard.standardCode}</span> <span>{standard.standardText}</span>
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-stone-100 px-3 py-2">
        <FunctionBadge standard={standard} />
        <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="ml-auto text-xs font-medium text-stone-700 underline">
          {open ? '해설 접기' : '해설 보기'}
        </button>
      </div>
      {open && (
        <div className="space-y-2 border-t border-stone-100 bg-stone-50 px-4 py-3 text-sm text-stone-700">
          <p className="text-xs font-semibold text-stone-500">성취기준 해설</p>
          {standard.standardExplanations.map((e, i) => (
            <p key={i}>{e}</p>
          ))}
        </div>
      )}
    </div>
  );
}

function SelectRow({ id, checked, onToggle, compact, children }: { id: string; checked: boolean; onToggle: (id: string) => void; compact?: boolean; children: ReactNode }) {
  return (
    <label className={`flex cursor-pointer items-start gap-2 rounded-md ${compact ? 'px-1 py-0.5 text-sm' : 'border border-stone-200 bg-white p-3'} ${checked ? 'bg-amber-50' : ''}`}>
      <input type="checkbox" id={`sel-${id}`} checked={checked} onChange={() => onToggle(id)} className="mt-1" />
      <span className="min-w-0">{children}</span>
    </label>
  );
}

function SearchResults({ results, selected, onToggle, onOpenArea }: { results: CurriculumNode[]; selected: Set<string>; onToggle: (id: string) => void; onOpenArea: (areaId: string) => void }) {
  const catalog = useCatalog();
  if (results.length === 0) return <p className="text-sm text-stone-500">찾는 내용이 없습니다. 다른 낱말이나 성취기준 코드(예: 12영감01)로 찾아보세요.</p>;
  return (
    <section aria-label="검색 결과" className="space-y-2">
      <p className="text-sm text-stone-600">{results.length}개 찾음</p>
      <ul className="divide-y divide-stone-200 rounded-md border border-stone-200 bg-white">
        {results.map((n) => {
          const area = catalog.areaOf(n);
          return (
            <li key={n.id} className="flex items-start gap-3 px-3 py-2">
              {n.type !== 'area' && <input type="checkbox" aria-label={`${nodeTitle(n)} 선택`} checked={selected.has(n.id)} onChange={() => onToggle(n.id)} className="mt-1" />}
              <div className="min-w-0 flex-1">
                <span className="mr-2 text-xs text-stone-500">{TYPE_LABEL[n.type]}</span>
                <span className="text-sm">{nodeTitle(n)}</span>
              </div>
              {area && (
                <button type="button" onClick={() => onOpenArea(area.id)} className="shrink-0 text-xs text-stone-600 underline">
                  {area.label}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function SelectionTray({ ids, onRemove, onClear }: { ids: string[]; onRemove: (id: string) => void; onClear: () => void }) {
  const catalog = useCatalog();
  const nodes = ids.map((id) => catalog.node(id)).filter((n): n is CurriculumNode => !!n);
  const standards = nodes.filter((n) => n.type === 'standard');
  return (
    <aside aria-label="고른 항목" className="h-fit space-y-3 rounded-md border border-stone-200 bg-white p-4 lg:sticky lg:top-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">고른 항목 <span className="tabular-nums text-stone-500">{nodes.length}</span></h2>
        {nodes.length > 0 && (
          <button type="button" onClick={onClear} className="text-xs text-stone-600 underline">
            모두 지우기
          </button>
        )}
      </div>
      {nodes.length === 0 ? (
        <p className="text-sm text-stone-500">왼쪽에서 성취기준이나 내용 요소를 고르면 여기에 모입니다.</p>
      ) : (
        <ul className="max-h-80 space-y-2 overflow-y-auto text-sm" data-testid="selection-list">
          {nodes.map((n) => (
            <li key={n.id} className="flex items-start gap-2">
              <span className="min-w-0 flex-1">
                <span className="block text-xs text-stone-500">
                  {catalog.subject(n.subjectId)?.label} · {TYPE_LABEL[n.type]}
                </span>
                {n.type === 'standard' ? <span className="font-medium tabular-nums">{n.standardCode}</span> : <span className="line-clamp-2">{nodeTitle(n)}</span>}
              </span>
              <button type="button" aria-label={`${nodeTitle(n)} 빼기`} onClick={() => onRemove(n.id)} className="text-stone-400 hover:text-stone-800">
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      {nodes.length > 0 && standards.length === 0 && <p className="text-xs text-amber-900">성취기준을 하나 이상 고르면 학습목표와 독서전략 추천이 더 정확해집니다.</p>}
      <Link
        to="/lesson"
        aria-disabled={nodes.length === 0}
        onClick={(e) => nodes.length === 0 && e.preventDefault()}
        className={`block rounded-md px-4 py-2 text-center text-sm font-medium ${nodes.length ? 'bg-stone-900 text-white hover:bg-stone-700' : 'cursor-not-allowed bg-stone-200 text-stone-500'}`}
      >
        이 선택으로 수업 만들기
      </Link>
    </aside>
  );
}

