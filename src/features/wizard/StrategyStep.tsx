// 3단계: 독서전략 추천·선택 (가이드 §8.4)
import { useEffect, useMemo, useState } from 'react';
import { useCatalog } from '../../app/CatalogContext';
import { useDraft } from '../../app/DraftContext';
import { Alert, Badge, Button } from '../../components/ui';
import { useAi } from '../../app/useAi';
import { READING_PHASE_LABEL, type Catalog } from '../../lib/catalog/catalog';
import { buildContext } from '../../lib/lesson/context';
import { recommendStrategies } from '../../lib/lesson/strategies';
import type { StandardNode } from '../../lib/validation/schemas';
import { useWizard } from './state';

const MAX_PICK = 3;
/** 전략 추천 이유 캐시 (이 탭을 닫을 때까지) */
const REASON_CACHE = new Map<string, Record<string, string>>();

export function StrategyDetail({ catalog, id }: { catalog: Catalog; id: string }) {
  const s = catalog.strategy(id);
  if (!s) return null;
  return (
    <div className="space-y-2 text-sm">
      <p>
        <span className="text-stone-500">독서 기능</span> {s.functionIds.map((f) => `${catalog.functionLabel(f)}(${READING_PHASE_LABEL[catalog.readingPhaseOf(f)]})`).join(', ')}
      </p>
      {s.procedure.length ? (
        <ol className="list-decimal space-y-0.5 pl-5">
          {s.procedure.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ol>
      ) : (
        <p className="text-stone-500">실행 절차가 아직 등록되지 않았습니다. 관리자가 절차를 입력하면 여기에 보입니다.</p>
      )}
      <p className="flex flex-wrap gap-2 text-xs text-stone-600">
        {s.minutes !== null && <span>권장 {s.minutes}분</span>}
        {s.recommendedEvents.length > 0 && <span>권장 사태 {s.recommendedEvents.join('·')}</span>}
        {s.suitableTextTypeIds.length > 0 && <span>적합 텍스트 {s.suitableTextTypeIds.map((t) => catalog.textTypes.types.find((x) => x.id === t)?.label).join('·')}</span>}
        {s.reviewStatus === 'reviewed' ? <Badge tone="green">검수 완료</Badge> : <Badge tone="amber">검수 전(초안)</Badge>}
      </p>
    </div>
  );
}

export default function StrategyStep({ onNext }: { onNext: () => void }) {
  const catalog = useCatalog();
  const { draft } = useDraft();
  const [w, patch] = useWizard();
  const ai = useAi();
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [openId, setOpenId] = useState<string | null>(null);

  const ctx = buildContext(catalog, draft.selectedNodeIds, w.subjectId!);
  const standards = ctx.standards.map((s) => catalog.node(s.id) as StandardNode);
  const p = w.params;
  const rec = useMemo(
    () =>
      recommendStrategies(catalog, {
        standards,
        chosenFunctionIds: w.chosenFunctionIds,
        textTypeIds: [p.textType.source, p.textType.structure, p.textType.format, p.textType.content],
        minutes: p.minutes,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [catalog, draft.selectedNodeIds.join(), w.chosenFunctionIds.join(), JSON.stringify(p.textType), p.minutes],
  );

  useEffect(() => {
    if (rec.candidates.length === 0) return setReasons({});
    // 같은 자료·같은 후보면 다시 부르지 않는다 (단계를 오갈 때마다 AI 한도를 쓰지 않게)
    const key = `${w.material?.title ?? ''}|${rec.candidates.map((c) => c.id).join(',')}`;
    const cached = REASON_CACHE.get(key);
    if (cached) return setReasons(cached);
    let alive = true;
    ai
      .explainStrategies({
        context: ctx,
        materialTitle: w.material?.title ?? '',
        candidates: rec.candidates.map((c) => ({ id: c.id, label: c.label, functionLabels: c.functionIds.map((f) => catalog.functionLabel(f)), matched: c.matched })),
      })
      .then((r) => {
        REASON_CACHE.set(key, r.reasons);
        if (alive) setReasons(r.reasons);
      })
      .catch(() => alive && setReasons({}));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec]);

  const picked = w.strategyIds;
  const toggle = (id: string) =>
    patch({
      strategyIds: picked.includes(id) ? picked.filter((x) => x !== id) : picked.length >= MAX_PICK ? picked : [...picked, id],
      stale: { ...w.stale, strategies: false, plan: !!w.planId },
    });
  const toggleFn = (id: string) => patch({ chosenFunctionIds: w.chosenFunctionIds.includes(id) ? w.chosenFunctionIds.filter((x) => x !== id) : [...w.chosenFunctionIds, id] });
  const SOURCE = { admin: '관리자 지정', verb: '끝 동사 일치', mapping: '동사 매핑', none: '미지정' } as const;

  return (
    <div className="space-y-8">
      {w.stale.strategies && <Alert tone="info">읽기자료가 바뀌었습니다. 추천 전략을 다시 확인하세요.</Alert>}
      <section className="space-y-2">
        <h2 className="font-semibold">성취기준의 독서 기능</h2>
        {rec.perStandard.length === 0 ? (
          <p className="text-sm text-stone-600">성취기준을 고르지 않았습니다. 아래에서 읽기 목적(독서 기능)을 직접 고르세요.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {rec.perStandard.map(({ standard, functionIds, source }) => (
              <li key={standard.id} className="flex flex-wrap items-center gap-2">
                <strong className="tabular-nums">{standard.standardCode}</strong>
                <span className="text-stone-500">끝 동사 “{standard.targetVerb}”</span>
                {source === 'none' ? (
                  <Badge tone="amber">독서 기능 미지정</Badge>
                ) : (
                  <span>
                    → {functionIds.map((f) => catalog.functionLabel(f)).join(', ')} <span className="text-xs text-stone-500">({SOURCE[source]})</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">
          읽기 목적 직접 고르기 <span className="text-sm font-normal text-stone-500">{rec.needsTeacherChoice ? '(필요)' : '(선택)'}</span>
        </h2>
        {rec.needsTeacherChoice && w.chosenFunctionIds.length === 0 && <Alert tone="info">고른 성취기준에서 독서 기능을 정하지 못했습니다. 이번 수업의 읽기 목적을 하나 이상 고르세요.</Alert>}
        <div className="flex flex-wrap gap-2">
          {catalog.reading.functions.map((f) => {
            const on = w.chosenFunctionIds.includes(f.id);
            return (
              <label key={f.id} className={`cursor-pointer rounded-md border px-3 py-1.5 text-sm ${on ? 'border-sky-700 bg-sky-50 text-sky-950' : 'border-stone-300 bg-white hover:bg-stone-100'}`}>
                <input type="checkbox" className="sr-only" checked={on} onChange={() => toggleFn(f.id)} />
                {f.label} <span className="text-xs text-stone-500">{READING_PHASE_LABEL[catalog.readingPhaseOf(f.id)]}</span>
              </label>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">
          추천 독서전략 <span className="text-sm font-normal text-stone-500">1~{MAX_PICK}개 고르기</span>
        </h2>
        {rec.candidates.length === 0 ? (
          <p className="text-sm text-stone-600">추천할 전략이 없습니다. 위에서 읽기 목적을 고르세요.</p>
        ) : (
          <ul className="space-y-2">
            {rec.candidates.map((c) => {
              const on = picked.includes(c.id);
              return (
                <li key={c.id} className={`rounded-md border bg-white ${on ? 'border-stone-900 ring-1 ring-stone-900' : 'border-stone-200'}`} data-testid="strategy-candidate">
                  <div className="flex flex-wrap items-start gap-3 p-3">
                    <input type="checkbox" id={`st-${c.id}`} checked={on} disabled={!on && picked.length >= MAX_PICK} onChange={() => toggle(c.id)} className="mt-1" />
                    <label htmlFor={`st-${c.id}`} className="min-w-0 flex-1 cursor-pointer">
                      <span className="font-semibold">{c.label}</span>
                      <span className="ml-2 text-xs text-stone-500">{c.phases.map((ph) => READING_PHASE_LABEL[ph]).join(' · ')}</span>
                      <span className="mt-0.5 block text-sm text-stone-700">{reasons[c.id] ?? c.matched.join(', ')}</span>
                    </label>
                    <span className="text-xs tabular-nums text-stone-500" title="추천 점수: 기능 일치 3, 텍스트 유형 2, 시간 1, 검수 1">
                      {c.score}점
                    </span>
                    <button type="button" aria-expanded={openId === c.id} onClick={() => setOpenId(openId === c.id ? null : c.id)} className="text-xs font-medium text-stone-700 underline">
                      {openId === c.id ? '접기' : '자세히'}
                    </button>
                  </div>
                  {openId === c.id && (
                    <div className="border-t border-stone-100 bg-stone-50 px-4 py-3">
                      <StrategyDetail catalog={catalog} id={c.id} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Button onClick={onNext} disabled={picked.length === 0}>
        {picked.length ? `고른 전략 ${picked.length}개로 지도안 만들기` : '전략을 하나 이상 고르세요'}
      </Button>
    </div>
  );
}
