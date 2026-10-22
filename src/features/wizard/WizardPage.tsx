// 수업 만들기 마법사 (가이드 §9.2-3): 조건 → 읽기자료 → 독서전략 → 지도안 → 내보내기
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCatalog } from '../../app/CatalogContext';
import { useDraft } from '../../app/DraftContext';
import { Alert, Button, errorMessage } from '../../components/ui';
import { getAi } from '../../lib/ai';
import { buildContext, subjectsOf } from '../../lib/lesson/context';
import ConditionsStep from './ConditionsStep';
import MaterialStep from './MaterialStep';
import StepBar from './StepBar';
import StrategyStep from './StrategyStep';
import PlanStep from './PlanStep';
import { useWizard, type Step } from './state';

export default function WizardPage() {
  const catalog = useCatalog();
  const { draft } = useDraft();
  const [w, patch, reset] = useWizard();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  if (draft.selectedNodeIds.length === 0)
    return (
      <section className="space-y-4">
        <h1 className="text-xl font-bold">수업 만들기</h1>
        <p className="text-stone-600">먼저 교육과정에서 성취기준이나 내용 요소를 고르세요.</p>
        <Link to="/explore" className="inline-block rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white">
          교육과정 탐색으로 가기
        </Link>
      </section>
    );

  const subjectId = w.subjectId && subjectsOf(catalog, draft.selectedNodeIds).includes(w.subjectId) ? w.subjectId : subjectsOf(catalog, draft.selectedNodeIds)[0];

  async function generate(level?: '쉬움' | '도전') {
    setError(null);
    setBusy(true);
    try {
      const params = level ? { ...w.params, level } : w.params;
      const label = (id: string) => catalog.textTypes.types.find((t) => t.id === id)?.label ?? id;
      const material = await getAi().generateMaterial({
        context: buildContext(catalog, draft.selectedNodeIds, subjectId),
        params,
        textTypeLabels: { source: label(params.textType.source), structure: label(params.textType.structure), format: label(params.textType.format), content: label(params.textType.content) },
      });
      patch({ subjectId, params, material, step: 2, materialReviewed: false, stale: { material: false, strategies: w.strategyIds.length > 0, plan: !!w.planId } });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const reachable = (s: Step) =>
    s === 1 || (s === 2 && !!w.material) || (s === 3 && !!w.materialId) || (s === 4 && !!w.materialId && w.strategyIds.length > 0) || (s === 5 && !!w.planId);
  const go = (s: Step) => reachable(s) && patch({ step: s });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">수업 만들기</h1>
          <p className="mt-1 text-sm text-stone-600">{catalog.subject(subjectId)?.label}</p>
        </div>
        {confirmReset ? (
          <div className="flex items-center gap-2 text-sm">
            <span>작성 중인 내용을 지우고 처음부터 할까요? (저장한 자료는 남습니다)</span>
            <Button variant="danger" onClick={() => (reset(), setConfirmReset(false))}>
              처음부터
            </Button>
            <Button variant="ghost" onClick={() => setConfirmReset(false)}>
              취소
            </Button>
          </div>
        ) : (
          <Button variant="ghost" onClick={() => setConfirmReset(true)}>
            새로 시작
          </Button>
        )}
      </header>
      <StepBar w={w} onGo={go} reachable={reachable} />
      {error && <Alert>{error}</Alert>}
      {w.step === 1 && <ConditionsStep onGenerate={() => generate()} />}
      {w.step === 2 && <MaterialStep busy={busy} onRegenerate={generate} onNext={() => patch({ step: 3 })} />}
      {w.step === 3 && <StrategyStep onNext={() => patch({ step: 4 })} />}
      {w.step === 4 && <PlanStep onNext={() => patch({ step: 5 })} />}
      {w.step === 5 && <p className="text-sm text-stone-500">이 단계는 다음 업데이트에서 추가됩니다.</p>}
      {busy && <p role="status" className="text-sm text-stone-600">AI가 만드는 중입니다…</p>}
    </div>
  );
}
