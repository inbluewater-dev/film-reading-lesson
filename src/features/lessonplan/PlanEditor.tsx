// 수업지도안 편집기 (가이드 §8.5): 기본 정보·개관·전략 개요·9사태 표·평가 준거·활동지. 모든 칸 인라인 편집 + 잠금
import { Fragment } from 'react';
import type { Catalog } from '../../lib/catalog/catalog';
import { READING_PHASE_LABEL } from '../../lib/catalog/catalog';
import type { EditableCell, LessonPlanRecord } from '../../lib/library/types';
import { timeCheck } from '../../lib/lesson/plan';
import { Alert } from '../../components/ui';

type Plan = Pick<LessonPlanRecord, 'title' | 'objectives' | 'overview' | 'events' | 'rubric' | 'worksheet' | 'lessonMinutes' | 'strategyIds' | 'standardCodes' | 'materialTitle' | 'subjectId' | 'grade' | 'nodeIds'>;

const area = 'w-full rounded border border-stone-300 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600';
const small = 'text-xs font-medium text-stone-600 underline';

function Lock({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <button type="button" aria-pressed={on} aria-label={`${label} ${on ? '잠금 해제' : '잠그기'}`} title={on ? '잠김: 다시 만들기 때 바뀌지 않음' : '잠그면 다시 만들기 때 이 칸은 그대로 둡니다'} onClick={onToggle} className={`rounded px-1 text-xs ${on ? 'bg-stone-800 text-white' : 'text-stone-400 hover:text-stone-700'}`}>
      {on ? '잠김' : '잠금'}
    </button>
  );
}

export function PlanEditor({ value, onChange, catalog, readOnly = false }: { value: Plan; onChange: (v: Plan) => void; catalog: Catalog; readOnly?: boolean }) {
  const set = (p: Partial<Plan>) => onChange({ ...value, ...p });
  const setRow = (seq: number, p: Partial<Plan['events'][number]>) => set({ events: value.events.map((r) => (r.seq === seq ? { ...r, ...p } : r)) });
  const toggleLock = (seq: number, k: EditableCell) => {
    const r = value.events.find((x) => x.seq === seq)!;
    setRow(seq, { locked: { ...r.locked, [k]: !r.locked[k] } });
  };
  const tc = timeCheck(value.events, value.lessonMinutes);
  const subject = catalog.subject(value.subjectId);
  const areas = [...new Set(value.nodeIds.map((id) => catalog.node(id)).map((n) => (n ? catalog.areaOf(n) : undefined)).filter(Boolean).map((a) => a!.id))].map((id) => catalog.node(id)!);
  const notes = areas.flatMap((a) => (a.type === 'area' ? a.applicationNotes : []));
  // 주의: 컴포넌트가 아닌 함수로 호출한다(매 입력마다 다시 마운트되어 포커스를 잃지 않도록)
  const text = (seq: number, k: Exclude<EditableCell, 'minutes'>, rows = 3) => {
    const r = value.events.find((x) => x.seq === seq)!;
    if (readOnly) return <p className="whitespace-pre-wrap text-sm">{r[k] || <span className="text-stone-400">—</span>}</p>;
    return (
      <div className="space-y-0.5">
        <textarea aria-label={`${seq}. ${r.label} ${CELL[k]}`} rows={rows} className={area} value={r[k]} onChange={(e) => setRow(seq, { [k]: e.target.value })} />
        <Lock on={!!r.locked[k]} onToggle={() => toggleLock(seq, k)} label={`${seq}. ${CELL[k]}`} />
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        {readOnly ? (
          <h2 className="text-xl font-bold">{value.title}</h2>
        ) : (
          <div>
            <label htmlFor="plan-title" className="text-sm font-semibold">
              지도안 제목
            </label>
            <input id="plan-title" className={`${area} mt-1 text-base font-semibold`} value={value.title} onChange={(e) => set({ title: e.target.value })} />
          </div>
        )}
        <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[7rem_minmax(0,1fr)]">
          <dt className="text-stone-500">과목</dt>
          <dd>
            {subject?.label} ({subject?.courseCategory})
          </dd>
          <dt className="text-stone-500">영역</dt>
          <dd>{areas.map((a) => (a.type === 'area' ? a.label : '')).join(', ')}</dd>
          <dt className="text-stone-500">성취기준</dt>
          <dd className="tabular-nums">{value.standardCodes.join(', ') || '—'}</dd>
          <dt className="text-stone-500">대상·시간</dt>
          <dd>
            {value.grade ? `${value.grade}학년 · ` : ''}
            {value.lessonMinutes === 100 ? '블록 100분' : '50분'}
          </dd>
          <dt className="text-stone-500">읽기자료</dt>
          <dd>{value.materialTitle}</dd>
        </dl>
      </section>

      <section className="space-y-2">
        <h3 className="font-semibold">학습목표</h3>
        {value.objectives.length === 0 && !readOnly && <Alert tone="info">성취기준을 고르지 않아 학습목표를 자동으로 만들지 못했습니다. 직접 입력하세요.</Alert>}
        <ul className="space-y-2">
          {value.objectives.map((o, i) => (
            <li key={i} className="flex gap-2">
              {readOnly ? (
                <span className="text-sm">• {o}</span>
              ) : (
                <>
                  <input aria-label={`학습목표 ${i + 1}`} className={area} value={o} onChange={(e) => set({ objectives: value.objectives.map((x, j) => (j === i ? e.target.value : x)) })} />
                  <button type="button" className={small} onClick={() => set({ objectives: value.objectives.filter((_, j) => j !== i) })}>
                    지우기
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
        {!readOnly && (
          <button type="button" className={small} onClick={() => set({ objectives: [...value.objectives, ''] })}>
            학습목표 추가
          </button>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="font-semibold">차시 개관</h3>
        {readOnly ? <p className="text-sm">{value.overview}</p> : <textarea aria-label="차시 개관" rows={2} className={area} value={value.overview} onChange={(e) => set({ overview: e.target.value })} />}
      </section>

      <section className="space-y-2">
        <h3 className="font-semibold">독서전략</h3>
        <ul className="space-y-1 text-sm">
          {value.strategyIds.map((id) => {
            const s = catalog.strategy(id);
            if (!s) return null;
            return (
              <li key={id}>
                <strong>{s.label}</strong>{' '}
                <span className="text-stone-500">
                  ({s.functionIds.map((f) => `${catalog.functionLabel(f)}·${READING_PHASE_LABEL[catalog.readingPhaseOf(f)]}`).join(', ')}) — 사태 {value.events.filter((r) => r.strategyIds.includes(id)).map((r) => r.seq).join('·')}
                </span>
                {s.procedure.length > 0 && <span className="block text-stone-600">절차: {s.procedure.join(' → ')}</span>}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">교수·학습 과정 (가네 9사태)</h3>
          <span className={`text-sm tabular-nums ${tc.ok ? 'text-emerald-800' : 'font-semibold text-red-700'}`} role={tc.ok ? undefined : 'alert'}>
            시간 합계 {tc.total}분 / {value.lessonMinutes}분{tc.ok ? '' : ` (${tc.diff > 0 ? `${tc.diff}분 초과` : `${-tc.diff}분 부족`})`}
          </span>
        </div>
        <div className="overflow-x-auto rounded-md border border-stone-200 bg-white">
          <table className="w-full min-w-[56rem] border-collapse text-sm">
            <thead className="bg-stone-100 text-left text-stone-700">
              <tr>
                <th className="w-14 px-2 py-2">단계</th>
                <th className="w-32 px-2 py-2">수업사태</th>
                <th className="px-2 py-2">교사 활동</th>
                <th className="px-2 py-2">학생 활동</th>
                <th className="w-20 px-2 py-2">시간(분)</th>
                <th className="px-2 py-2">자료·유의점</th>
                <th className="px-2 py-2">평가</th>
              </tr>
            </thead>
            <tbody>
              {(['도입', '전개', '정리'] as const).map((phase) => {
                const rows = value.events.filter((r) => r.phase === phase);
                return (
                  <Fragment key={phase}>
                    {rows.map((r, i) => (
                      <tr key={r.seq} className="border-t border-stone-200 align-top">
                        {i === 0 && (
                          <th rowSpan={rows.length} className="bg-stone-50 px-2 py-2 text-center font-semibold">
                            {phase}
                          </th>
                        )}
                        <td className="px-2 py-2">
                          <span className="font-medium">
                            {r.seq}. {r.label}
                          </span>
                          {r.strategyIds.length > 0 && <span className="mt-1 block text-xs text-sky-800">{r.strategyIds.map((id) => catalog.strategy(id)?.label).join(', ')}</span>}
                        </td>
                        <td className="px-2 py-2">
                          {text(r.seq, 'teacherActivity')}
                        </td>
                        <td className="px-2 py-2">
                          {text(r.seq, 'studentActivity')}
                        </td>
                        <td className="px-2 py-2">
                          {readOnly ? (
                            <span className="tabular-nums">{r.minutes}</span>
                          ) : (
                            <div className="space-y-0.5">
                              <input aria-label={`${r.seq}. ${r.label} 시간`} type="number" min={0} max={100} className={`${area} tabular-nums`} value={r.minutes} onChange={(e) => setRow(r.seq, { minutes: Math.max(0, Number(e.target.value) || 0) })} />
                              <Lock on={!!r.locked.minutes} onToggle={() => toggleLock(r.seq, 'minutes')} label={`${r.seq}. 시간`} />
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-2">
                          {text(r.seq, 'material', 2)}
                        </td>
                        <td className="px-2 py-2">
                          {text(r.seq, 'assessment', 2)}
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        {notes.length > 0 && (
          <details className="rounded-md border border-stone-200 bg-white px-4 py-2 text-sm">
            <summary className="cursor-pointer font-medium">자료·유의점 참고: 성취기준 적용 시 고려 사항 (원문)</summary>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-stone-700">
              {notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="font-semibold">평가 계획 (평가 준거)</h3>
        <div className="overflow-x-auto rounded-md border border-stone-200 bg-white">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="bg-stone-100 text-left text-stone-700">
              <tr>
                <th className="px-2 py-2">평가 요소</th>
                <th className="px-2 py-2">상</th>
                <th className="px-2 py-2">중</th>
                <th className="px-2 py-2">하</th>
                {!readOnly && <th className="w-12" />}
              </tr>
            </thead>
            <tbody>
              {value.rubric.map((r, i) => (
                <tr key={i} className="border-t border-stone-200 align-top">
                  {(['criterion', 'high', 'mid', 'low'] as const).map((k) => (
                    <td key={k} className="px-2 py-2">
                      {readOnly ? (
                        r[k]
                      ) : (
                        <textarea aria-label={`평가 ${i + 1} ${RUBRIC[k]}`} rows={2} className={area} value={r[k]} onChange={(e) => set({ rubric: value.rubric.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)) })} />
                      )}
                    </td>
                  ))}
                  {!readOnly && (
                    <td className="px-2 py-2">
                      <button type="button" className={small} onClick={() => set({ rubric: value.rubric.filter((_, j) => j !== i) })}>
                        지우기
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!readOnly && (
          <button type="button" className={small} onClick={() => set({ rubric: [...value.rubric, { criterion: '', high: '', mid: '', low: '' }] })}>
            평가 요소 추가
          </button>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="font-semibold">활동지 초안</h3>
        <ol className="list-decimal space-y-2 pl-5">
          {value.worksheet.map((w, i) => (
            <li key={i}>
              {readOnly ? (
                <span className="text-sm">{w}</span>
              ) : (
                <div className="flex gap-2">
                  <input aria-label={`활동지 ${i + 1}`} className={area} value={w} onChange={(e) => set({ worksheet: value.worksheet.map((x, j) => (j === i ? e.target.value : x)) })} />
                  <button type="button" className={small} onClick={() => set({ worksheet: value.worksheet.filter((_, j) => j !== i) })}>
                    지우기
                  </button>
                </div>
              )}
            </li>
          ))}
        </ol>
        {!readOnly && (
          <button type="button" className={small} onClick={() => set({ worksheet: [...value.worksheet, ''] })}>
            문항 추가
          </button>
        )}
      </section>
    </div>
  );
}

const CELL: Record<Exclude<EditableCell, 'minutes'>, string> = { teacherActivity: '교사 활동', studentActivity: '학생 활동', material: '자료·유의점', assessment: '평가' };
const RUBRIC = { criterion: '평가 요소', high: '상', mid: '중', low: '하' } as const;
