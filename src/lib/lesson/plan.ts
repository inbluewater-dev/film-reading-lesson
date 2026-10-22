// 수업지도안 뼈대 (가이드 §8.5): 9사태 순서·단계는 가네.ttl, 전략 배치·시간은 규칙, AI는 활동 문장·평가 준거만 채운다
import type { LessonPlanResult } from '../ai/types';
import type { Catalog, ReadingPhase } from '../catalog/catalog';
import type { EditableCell, LessonEventRow } from '../library/types';
import { DEFAULT_MINUTES, sum } from './timing';

/** 전략을 둘 사태: 관리자가 정한 권장 사태(4~6) → 없으면 읽기 단계로 (전 4, 중·미분류 5, 후 6) */
export function placementOf(catalog: Catalog, strategyId: string): number[] {
  const s = catalog.strategy(strategyId);
  if (!s) return [];
  const rec = s.recommendedEvents.filter((e) => e >= 4 && e <= 6);
  if (rec.length) return rec;
  const phases = new Set<ReadingPhase>(s.functionIds.map((f) => catalog.readingPhaseOf(f)));
  const out: number[] = [];
  if (phases.has('before')) out.push(4);
  if (phases.has('during') || phases.has('unset') || phases.size === 0) out.push(5);
  if (phases.has('after')) out.push(6);
  return out.length ? out : [5];
}

export function buildSkeleton(catalog: Catalog, minutes: 50 | 100, strategyIds: string[]): LessonEventRow[] {
  const mins = DEFAULT_MINUTES[minutes];
  return catalog.gagne.events.map((e, i) => ({
    seq: e.seq,
    label: e.label,
    phase: e.phase,
    minutes: mins[i],
    teacherActivity: '',
    studentActivity: '',
    material: '',
    assessment: '',
    strategyIds: strategyIds.filter((sid) => placementOf(catalog, sid).includes(e.seq)),
    locked: {},
  }));
}

const FILLABLE: Exclude<EditableCell, 'minutes'>[] = ['teacherActivity', 'studentActivity', 'material', 'assessment'];

/** AI 결과를 채운다. 잠근 칸은 그대로 둔다 */
export function applyFill(rows: LessonEventRow[], fill: LessonPlanResult['events']): LessonEventRow[] {
  return rows.map((r) => {
    const f = fill.find((x) => x.seq === r.seq);
    if (!f) return r;
    const next = { ...r };
    for (const k of FILLABLE) if (!r.locked[k]) next[k] = f[k];
    return next;
  });
}

/** 수업 시간을 바꾸면 잠그지 않은 칸의 시간을 기본 배분으로 다시 맞춘다 */
export function rescaleMinutes(rows: LessonEventRow[], minutes: 50 | 100): LessonEventRow[] {
  const mins = DEFAULT_MINUTES[minutes];
  return rows.map((r, i) => (r.locked.minutes ? r : { ...r, minutes: mins[i] }));
}

export function timeCheck(rows: LessonEventRow[], minutes: number) {
  const total = sum(rows.map((r) => r.minutes));
  return { total, ok: total === minutes, diff: total - minutes };
}
