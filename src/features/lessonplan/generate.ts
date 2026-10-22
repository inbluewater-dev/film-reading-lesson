// 지도안 생성: 규칙 기반 뼈대 + AI 문장 채우기 (잠근 칸 유지)
import type { AiProvider, CurriculumContext } from '../../lib/ai/types';
import { READING_PHASE_LABEL, type Catalog } from '../../lib/catalog/catalog';
import type { LessonEventRow, LessonPlanRecord } from '../../lib/library/types';
import { applyFill, buildSkeleton } from '../../lib/lesson/plan';

export async function fillPlan(
  ai: AiProvider,
  catalog: Catalog,
  ctx: CurriculumContext,
  opts: { materialTitle: string; materialSummary: string; minutes: 50 | 100; strategyIds: string[]; objectives: string[]; rows?: LessonEventRow[] },
): Promise<Pick<LessonPlanRecord, 'overview' | 'events' | 'rubric' | 'worksheet'>> {
  const rows = opts.rows ?? buildSkeleton(catalog, opts.minutes, opts.strategyIds);
  const label = (id: string) => catalog.strategy(id)?.label ?? id;
  const result = await ai.generateLessonPlan({
    context: ctx,
    materialTitle: opts.materialTitle,
    materialSummary: opts.materialSummary,
    minutes: opts.minutes,
    objectives: opts.objectives,
    strategies: opts.strategyIds.map((id) => {
      const s = catalog.strategy(id)!;
      return { id, label: s.label, procedure: s.procedure, phase: s.functionIds.map((f) => READING_PHASE_LABEL[catalog.readingPhaseOf(f)]).join('·') };
    }),
    events: rows.map((r) => ({
      seq: r.seq,
      label: r.label,
      phase: r.phase,
      minutes: r.minutes,
      strategyLabels: r.strategyIds.map(label),
      referenceStrategies: catalog.gagne.events.find((e) => e.seq === r.seq)?.defaultStrategies ?? [],
    })),
  });
  return { overview: result.overview, events: applyFill(rows, result.events), rubric: result.rubric, worksheet: result.worksheet };
}
