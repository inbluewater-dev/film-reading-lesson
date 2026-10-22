import { STEPS, type Step, type WizardState } from './state';

export default function StepBar({ w, onGo, reachable }: { w: WizardState; onGo: (s: Step) => void; reachable: (s: Step) => boolean }) {
  const staleOf: Partial<Record<Step, boolean>> = { 2: w.stale.material, 3: w.stale.strategies, 4: w.stale.plan };
  return (
    <ol className="flex flex-wrap gap-2" aria-label="진행 단계">
      {STEPS.map((s) => {
        const current = s.n === w.step;
        const can = reachable(s.n);
        return (
          <li key={s.n}>
            <button
              type="button"
              disabled={!can}
              aria-current={current ? 'step' : undefined}
              onClick={() => onGo(s.n)}
              className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600 disabled:cursor-not-allowed disabled:opacity-40 ${
                current ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-300 bg-white hover:bg-stone-100'
              }`}
            >
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs tabular-nums ${current ? 'bg-white text-stone-900' : 'bg-stone-200 text-stone-700'}`}>{s.n}</span>
              {s.label}
              {staleOf[s.n] && <span className="rounded bg-amber-200 px-1.5 text-[11px] text-amber-950">다시 만들기 필요</span>}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
