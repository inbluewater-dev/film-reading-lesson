// 수업 만들기 마법사 상태 — 작성 중 초안(DraftContext)에 함께 저장된다
import { useCallback } from 'react';
import { useDraft } from '../../app/DraftContext';
import type { MaterialParams, MaterialResult } from '../../lib/ai/types';
import { DEFAULT_PARAMS } from '../../lib/lesson/context';

export type Step = 1 | 2 | 3 | 4 | 5;
export const STEPS: { n: Step; label: string }[] = [
  { n: 1, label: '수업 조건' },
  { n: 2, label: '읽기자료' },
  { n: 3, label: '독서전략' },
  { n: 4, label: '수업지도안' },
  { n: 5, label: '내보내기' },
];

export interface WizardState {
  step: Step;
  subjectId: string | null;
  params: MaterialParams;
  /** 편집 중인 읽기자료 */
  material: MaterialResult | null;
  materialId: string | null;
  materialReviewed: boolean;
  /** 앞 단계를 바꿔서 다시 만들어야 하는 단계 */
  stale: { material: boolean; strategies: boolean; plan: boolean };
  /** 교사가 직접 고른 독서 기능 (성취기준에 기능이 없을 때) */
  chosenFunctionIds: string[];
  strategyIds: string[];
  planId: string | null;
}

export const EMPTY_WIZARD: WizardState = {
  step: 1,
  subjectId: null,
  params: DEFAULT_PARAMS,
  material: null,
  materialId: null,
  materialReviewed: false,
  stale: { material: false, strategies: false, plan: false },
  chosenFunctionIds: [],
  strategyIds: [],
  planId: null,
};

export function useWizard(): [WizardState, (patch: Partial<WizardState>) => void, () => void] {
  const { draft, update } = useDraft();
  const w = { ...EMPTY_WIZARD, ...((draft.wizard as Partial<WizardState>) ?? {}) };
  const patch = useCallback(
    (p: Partial<WizardState>) => update((d) => ({ wizard: { ...EMPTY_WIZARD, ...((d.wizard as Partial<WizardState>) ?? {}), ...p } })),
    [update],
  );
  const reset = useCallback(() => update({ wizard: EMPTY_WIZARD }), [update]);
  return [w, patch, reset];
}
