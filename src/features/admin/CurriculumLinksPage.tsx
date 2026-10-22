// 관리자 › 교육과정 연결 (가이드 §9.3-3, §5.2): 성취기준별 독서 기능(targetFunction)·내용 요소(coversElement),
// 동사 매핑 사전, 읽기 전·중·후 분류. 원문(코드·원문·해설·고려 사항)은 읽기 전용.
import { useMemo, useState } from 'react';
import { useServices } from '../../app/AuthContext';
import { useCatalog, useCatalogState } from '../../app/CatalogContext';
import { Alert, Badge, Button, errorMessage } from '../../components/ui';
import { ELEMENT_KIND_LABEL, READING_PHASE_LABEL, type CatalogOverrides, type ReadingPhase } from '../../lib/catalog/catalog';
import type { StandardNode } from '../../lib/validation/schemas';

const SOURCE = { admin: '관리자 지정', verb: '끝 동사 일치', mapping: '동사 매핑', none: '미지정' } as const;

function Chips({ options, value, onChange, name }: { options: { id: string; label: string }[]; value: string[]; onChange: (v: string[]) => void; name: string }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={name}>
      {options.map((o) => {
        const on = value.includes(o.id);
        return (
          <label key={o.id} className={`cursor-pointer rounded border px-2 py-1 text-xs ${on ? 'border-sky-700 bg-sky-50 text-sky-950' : 'border-stone-300 bg-white hover:bg-stone-100'}`}>
            <input type="checkbox" className="sr-only" checked={on} onChange={() => onChange(on ? value.filter((x) => x !== o.id) : [...value, o.id])} />
            {o.label}
          </label>
        );
      })}
    </div>
  );
}

export default function CurriculumLinksPage() {
  const catalog = useCatalog();
  const { reload } = useCatalogState();
  const { catalog: service } = useServices();
  const [msg, setMsg] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [subject, setSubject] = useState('');
  const [onlyUnset, setOnlyUnset] = useState(true);
  const [editing, setEditing] = useState<{ id: string; functions: string[]; elements: string[] } | null>(null);
  const [verbDraft, setVerbDraft] = useState<Record<string, string[]>>({});
  const [newVerb, setNewVerb] = useState('');

  const functions = catalog.reading.functions.map((f) => ({ id: f.id, label: f.label }));
  const standards = catalog.standards();
  const rows = useMemo(() => {
    const withRes = standards.map((s) => ({ s, res: catalog.functionsFor(s) }));
    return withRes
      .filter((r) => (!subject || r.s.subjectId === subject) && (!onlyUnset || r.res.source === 'none'))
      .sort((a, b) => Number(b.res.source === 'none') - Number(a.res.source === 'none'));
  }, [catalog, standards, subject, onlyUnset]);
  const unsetCount = standards.filter((s) => catalog.functionsFor(s).source === 'none').length;

  // 동사 매핑이 필요한 동사: 읽기 동사와 정확히 일치하지 않는 성취기준 끝 동사 (+ 이미 매핑된 동사)
  const verbs = useMemo(() => {
    const exact = new Set(catalog.reading.verbs.filter((v) => v.functionIds.length).map((v) => v.label));
    const count = new Map<string, number>();
    for (const s of standards) if (!exact.has(s.targetVerb)) count.set(s.targetVerb, (count.get(s.targetVerb) ?? 0) + 1);
    for (const v of Object.keys(catalog.overrides.verbMappings)) if (!count.has(v)) count.set(v, 0);
    return [...count.entries()].sort((a, b) => b[1] - a[1]);
  }, [catalog, standards]);

  async function save(patch: Partial<CatalogOverrides>, ok: string) {
    setMsg(null);
    try {
      await service.saveOverrides(patch);
      await reload();
      setMsg({ tone: 'success', text: ok });
      return true;
    } catch (e) {
      setMsg({ tone: 'error', text: errorMessage(e) });
      return false;
    }
  }

  const elementsOf = (s: StandardNode) => catalog.childrenOf(catalog.areaOf(s)!.id, 'element');

  return (
    <div className="space-y-12">
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}

      <section aria-labelledby="std-h" className="space-y-3">
        <h2 id="std-h" className="text-lg font-semibold">
          성취기준별 독서 기능 <Badge tone={unsetCount ? 'amber' : 'green'}>미지정 {unsetCount}개</Badge>
        </h2>
        <p className="text-sm text-stone-600">
          지정하면 끝 동사·매핑보다 먼저 쓰입니다(§5.2 1단계). 교사 화면의 독서전략 추천에 바로 반영됩니다. 성취기준 원문은 바꿀 수 없습니다.
        </p>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <select aria-label="과목" value={subject} onChange={(e) => setSubject(e.target.value)} className="rounded-md border border-stone-300 bg-white px-3 py-2">
            <option value="">모든 과목</option>
            {catalog.subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={onlyUnset} onChange={() => setOnlyUnset(!onlyUnset)} />
            미지정만 보기
          </label>
          <span className="text-stone-500">{rows.length}개</span>
        </div>
        <ul className="divide-y divide-stone-200 rounded-md border border-stone-200 bg-white">
          {rows.map(({ s, res }) => (
            <li key={s.id} className="space-y-2 px-4 py-3" data-testid={`std-${s.standardCode}`}>
              <div className="flex flex-wrap items-start gap-2">
                <strong className="tabular-nums">{s.standardCode}</strong>
                <span className="min-w-0 flex-1 text-sm">{s.standardText}</span>
                {editing?.id !== s.id && (
                  <Button variant="secondary" onClick={() => setEditing({ id: s.id, functions: catalog.overrides.standardFunctions[s.id] ?? [], elements: catalog.overrides.standardElements[s.id] ?? s.coversElementIds })}>
                    연결 편집
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-stone-600">
                <span>끝 동사 “{s.targetVerb}”</span>
                {res.source === 'none' ? <Badge tone="amber">독서 기능 미지정</Badge> : <span>→ {res.functionIds.map((f) => catalog.functionLabel(f)).join(', ')} ({SOURCE[res.source]})</span>}
                {s.coversElementIds.length > 0 && <span>· 내용 요소 {s.coversElementIds.map((e) => (catalog.node(e) as { label?: string })?.label).join(', ')}</span>}
              </div>
              {editing?.id === s.id && (
                <div className="space-y-3 rounded-md bg-stone-50 p-3">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold">독서 기능 (비우면 끝 동사·매핑 규칙을 따름)</p>
                    <Chips name={`${s.standardCode} 독서 기능`} options={functions} value={editing.functions} onChange={(v) => setEditing({ ...editing, functions: v })} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold">내용 요소 (같은 영역)</p>
                    <Chips
                      name={`${s.standardCode} 내용 요소`}
                      options={elementsOf(s).map((e) => ({ id: e.id, label: `${e.label} (${ELEMENT_KIND_LABEL[e.elementKind]})` }))}
                      value={editing.elements}
                      onChange={(v) => setEditing({ ...editing, elements: v })}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={async () => {
                        if (await save({ standardFunctions: { [s.id]: editing.functions }, standardElements: { [s.id]: editing.elements } }, `${s.standardCode} 연결을 저장했습니다.`)) setEditing(null);
                      }}
                    >
                      저장
                    </Button>
                    <Button variant="ghost" onClick={() => setEditing(null)}>
                      취소
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="verb-h" className="space-y-3">
        <h2 id="verb-h" className="text-lg font-semibold">동사 매핑 사전</h2>
        <p className="text-sm text-stone-600">성취기준 끝 동사가 독서 동사와 정확히 같지 않을 때 쓸 독서 기능을 정합니다(§5.2 3단계). 처음에는 비어 있습니다.</p>
        <ul className="divide-y divide-stone-200 rounded-md border border-stone-200 bg-white">
          {verbs.map(([verb, n]) => {
            const value = verbDraft[verb] ?? catalog.overrides.verbMappings[verb] ?? [];
            const dirty = verbDraft[verb] !== undefined && JSON.stringify(verbDraft[verb]) !== JSON.stringify(catalog.overrides.verbMappings[verb] ?? []);
            return (
              <li key={verb} className="space-y-2 px-4 py-3" data-testid={`verb-${verb}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <strong>{verb}</strong>
                  <span className="text-xs text-stone-500">성취기준 {n}개</span>
                  {(catalog.overrides.verbMappings[verb] ?? []).length === 0 ? <Badge tone="amber">매핑 없음</Badge> : <Badge tone="green">매핑됨</Badge>}
                </div>
                <Chips name={`${verb} 독서 기능`} options={functions} value={value} onChange={(v) => setVerbDraft({ ...verbDraft, [verb]: v })} />
                {dirty && (
                  <Button
                    onClick={async () => {
                      if (await save({ verbMappings: { [verb]: value } }, `“${verb}” 매핑을 저장했습니다.`)) {
                        const next = { ...verbDraft };
                        delete next[verb];
                        setVerbDraft(next);
                      }
                    }}
                  >
                    “{verb}” 저장
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
        <div className="flex flex-wrap items-center gap-2">
          <input aria-label="새 동사" placeholder="동사 기본형 (예: 감상하다)" value={newVerb} onChange={(e) => setNewVerb(e.target.value)} className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm" />
          <Button
            variant="secondary"
            disabled={!/^[가-힣]+다$/.test(newVerb.trim()) || verbs.some(([v]) => v === newVerb.trim())}
            onClick={() => {
              setVerbDraft({ ...verbDraft, [newVerb.trim()]: [] });
              setNewVerb('');
            }}
          >
            동사 추가
          </Button>
        </div>
        {Object.keys(verbDraft)
          .filter((v) => !verbs.some(([x]) => x === v))
          .map((verb) => (
            <div key={verb} className="space-y-2 rounded-md border border-dashed border-stone-300 p-3">
              <strong>{verb}</strong>
              <Chips name={`${verb} 독서 기능`} options={functions} value={verbDraft[verb]} onChange={(v) => setVerbDraft({ ...verbDraft, [verb]: v })} />
              <Button
                disabled={verbDraft[verb].length === 0}
                onClick={async () => {
                  if (await save({ verbMappings: { [verb]: verbDraft[verb] } }, `“${verb}” 매핑을 저장했습니다.`)) {
                    const next = { ...verbDraft };
                    delete next[verb];
                    setVerbDraft(next);
                  }
                }}
              >
                “{verb}” 저장
              </Button>
            </div>
          ))}
      </section>

      <section aria-labelledby="phase-h" className="space-y-3">
        <h2 id="phase-h" className="text-lg font-semibold">읽기 전·중·후 분류</h2>
        <p className="text-sm text-stone-600">독서전략 추천 화면과 지도안의 전략 배치(사태 4·5·6)에 쓰입니다. 기본값은 가이드 예시(탐색·예측=전, 이해·추론=중, 비교·분류·평가=후)뿐입니다.</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {catalog.reading.functions.map((f) => (
            <label key={f.id} className="flex items-center justify-between gap-2 rounded-md border border-stone-200 bg-white px-3 py-2 text-sm">
              {f.label}
              <select
                aria-label={`${f.label} 읽기 단계`}
                value={catalog.readingPhaseOf(f.id)}
                onChange={(e) => void save({ readingPhases: { [f.id]: e.target.value as ReadingPhase } }, `${f.label}: ${READING_PHASE_LABEL[e.target.value as ReadingPhase]}로 정했습니다.`)}
                className="rounded border border-stone-300 bg-white px-2 py-1"
              >
                {(Object.keys(READING_PHASE_LABEL) as ReadingPhase[]).map((p) => (
                  <option key={p} value={p}>
                    {READING_PHASE_LABEL[p]}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </section>
    </div>
  );
}
