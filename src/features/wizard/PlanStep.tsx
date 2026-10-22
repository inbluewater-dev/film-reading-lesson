// 4단계: 수업지도안 — 생성(자동 저장)·편집·잠금·다시 만들기·검토·공유
import { useEffect, useState } from 'react';
import { useServices } from '../../app/AuthContext';
import { useCatalog } from '../../app/CatalogContext';
import { useDraft } from '../../app/DraftContext';
import { Alert, Button, errorMessage } from '../../components/ui';
import { useAi } from '../../app/useAi';
import type { LessonPlanRecord } from '../../lib/library/types';
import { buildContext } from '../../lib/lesson/context';
import { toObjective } from '../../lib/lesson/objectives';
import { rescaleMinutes } from '../../lib/lesson/plan';
import { fillPlan } from '../lessonplan/generate';
import { PlanEditor } from '../lessonplan/PlanEditor';
import { useWizard } from './state';

export default function PlanStep({ onNext }: { onNext: () => void }) {
  const catalog = useCatalog();
  const { library } = useServices();
  const { draft } = useDraft();
  const [w, patch] = useWizard();
  const ai = useAi();
  const [plan, setPlan] = useState<LessonPlanRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'error' | 'success' | 'info'; text: string } | null>(null);
  const ctx = buildContext(catalog, draft.selectedNodeIds, w.subjectId!);
  const m = w.material!;
  const summary = m.blocks.flatMap((b) => (b.kind === 'paragraph' ? [b.text] : [])).join(' ').slice(0, 300);

  useEffect(() => {
    if (w.planId) library.lessonPlans.get(w.planId).then(setPlan, () => patch({ planId: null }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w.planId]);

  async function create() {
    setBusy(true);
    setMsg(null);
    try {
      const objectives = ctx.standards.map((s) => toObjective(s.text));
      const filled = await fillPlan(ai, catalog, ctx, { materialTitle: m.title, materialSummary: summary, minutes: w.params.minutes, strategyIds: w.strategyIds, objectives });
      const rec = await library.lessonPlans.create({
        subjectId: w.subjectId!,
        nodeIds: ctx.nodeIds,
        standardCodes: ctx.standards.map((s) => s.code),
        materialId: w.materialId,
        materialTitle: m.title,
        strategyIds: w.strategyIds,
        lessonMinutes: w.params.minutes,
        grade: w.params.grade,
        title: `${m.title} 수업지도안`,
        objectives,
        ...filled,
        reviewedByTeacher: false,
        model: ai.model,
        ontologyVersion: catalog.ontologyVersion,
      });
      setPlan(rec);
      patch({ planId: rec.id, stale: { ...w.stale, plan: false } });
      setMsg({ tone: 'success', text: '지도안을 만들어 내 보관함에 저장했습니다. 고친 뒤 ‘저장’을 누르세요.' });
    } catch (e) {
      setMsg({ tone: 'error', text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  async function regenerate() {
    if (!plan) return;
    setBusy(true);
    setMsg(null);
    try {
      const filled = await fillPlan(ai, catalog, ctx, { materialTitle: plan.materialTitle, materialSummary: summary, minutes: plan.lessonMinutes, strategyIds: plan.strategyIds, objectives: plan.objectives, rows: plan.events });
      setPlan({ ...plan, ...filled });
      setMsg({ tone: 'info', text: '잠그지 않은 칸을 새로 채웠습니다. 저장하려면 ‘저장’을 누르세요.' });
    } catch (e) {
      setMsg({ tone: 'error', text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  async function save(extra: Partial<LessonPlanRecord> = {}) {
    if (!plan) return;
    try {
      const next = { ...plan, ...extra };
      const { title, objectives, overview, events, rubric, worksheet, lessonMinutes, reviewedByTeacher } = next;
      setPlan(await library.lessonPlans.update(plan.id, { title, objectives, overview, events, rubric, worksheet, lessonMinutes, reviewedByTeacher }));
      setMsg({ tone: 'success', text: '저장했습니다.' });
    } catch (e) {
      setMsg({ tone: 'error', text: errorMessage(e) });
    }
  }

  async function toggleShare() {
    if (!plan) return;
    try {
      const v = plan.visibility === 'shared' ? 'private' : 'shared';
      await save();
      setPlan(await library.lessonPlans.setVisibility(plan.id, v));
      setMsg({ tone: 'success', text: v === 'shared' ? '공유 보관함에 올렸습니다. 다른 선생님이 보고 복제할 수 있습니다.' : '공유를 취소했습니다.' });
    } catch (e) {
      setMsg({ tone: 'error', text: errorMessage(e) });
    }
  }

  if (!plan)
    return (
      <div className="space-y-4">
        <p className="text-stone-700">
          읽기자료 「{m.title}」와 고른 전략 {w.strategyIds.length}개로 {w.params.minutes === 100 ? '블록 100분' : '50분'} 수업지도안을 만듭니다. 가네의 9가지 수업사태 순서를 따릅니다.
        </p>
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
        <Button onClick={create} disabled={busy}>
          {busy ? '만드는 중…' : '수업지도안 만들기'}
        </Button>
      </div>
    );

  return (
    <div className="space-y-6">
      {w.stale.plan && <Alert tone="info">앞 단계가 바뀌었습니다. 필요하면 ‘다시 만들기’로 잠그지 않은 칸을 새로 채우세요.</Alert>}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={regenerate} disabled={busy}>
          다시 만들기 (잠근 칸 유지)
        </Button>
        <label className="flex items-center gap-2 text-sm">
          수업 시간
          <select
            aria-label="지도안 수업 시간"
            value={plan.lessonMinutes}
            onChange={(e) => {
              const v = Number(e.target.value) as 50 | 100;
              setPlan({ ...plan, lessonMinutes: v, events: rescaleMinutes(plan.events, v) });
            }}
            className="rounded-md border border-stone-300 bg-white px-2 py-1.5"
          >
            <option value={50}>50분</option>
            <option value={100}>블록 100분</option>
          </select>
        </label>
        <span className="ml-auto text-xs text-stone-500">{plan.visibility === 'shared' ? '공유 중' : '나만 보기'}</span>
      </div>
      <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-950">AI 생성물 — 사용 전 교사 검토. 활동 문장과 평가 준거는 초안입니다.</div>
      <PlanEditor value={plan} onChange={(v) => setPlan({ ...plan, ...v })} catalog={catalog} />
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" checked={plan.reviewedByTeacher} onChange={() => setPlan({ ...plan, reviewedByTeacher: !plan.reviewedByTeacher })} />
        지도안을 검토했습니다
      </label>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" onClick={() => save()}>
          저장
        </Button>
        <Button variant="secondary" onClick={toggleShare}>
          {plan.visibility === 'shared' ? '공유 취소' : '공유 보관함에 올리기'}
        </Button>
        <Button
          onClick={async () => {
            await save();
            onNext();
          }}
        >
          저장하고 내보내기
        </Button>
      </div>
    </div>
  );
}
