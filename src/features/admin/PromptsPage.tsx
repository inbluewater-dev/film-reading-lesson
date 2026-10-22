// 관리자 › 프롬프트 (가이드 §9.3-6): 템플릿 버전 관리, 미리보기·테스트 실행(지금은 Mock)
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useServices } from '../../app/AuthContext';
import { useCatalog } from '../../app/CatalogContext';
import { Alert, Badge, Button, errorMessage } from '../../components/ui';
import { getAi } from '../../lib/ai';
import { PROMPT_LABEL, PROMPT_VARIABLES, renderPrompt, unknownVariables } from '../../lib/ai/prompts';
import { filmVars, lessonPlanVars, materialVars, strategyVars } from '../../lib/ai/promptVars';
import { config } from '../../lib/config';
import type { PromptKind, PromptTemplate } from '../../lib/data/types';
import { buildContext, DEFAULT_PARAMS } from '../../lib/lesson/context';
import { toObjective } from '../../lib/lesson/objectives';
import { buildSkeleton } from '../../lib/lesson/plan';

const KINDS = Object.keys(PROMPT_LABEL) as PromptKind[];
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' }) : '기본값');

export default function PromptsPage() {
  const catalog = useCatalog();
  const { prompts } = useServices();
  const [list, setList] = useState<PromptTemplate[]>([]);
  const [kind, setKind] = useState<PromptKind>('material');
  const [body, setBody] = useState('');
  const [standardId, setStandardId] = useState(catalog.standards()[0]?.id ?? '');
  const [test, setTest] = useState<{ prompt: string; output: string } | null>(null);
  const [msg, setMsg] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const l = await prompts.list();
      setList(l);
      return l;
    } catch (e) {
      setMsg({ tone: 'error', text: errorMessage(e) });
      return [];
    }
  }, [prompts]);
  useEffect(() => {
    void load().then((l) => setBody(l.find((t) => t.kind === 'material')?.body ?? ''));
  }, [load]);

  const cur = list.find((t) => t.kind === kind);
  const unknown = useMemo(() => unknownVariables(kind, body), [kind, body]);

  function pick(k: PromptKind) {
    setKind(k);
    setBody(list.find((t) => t.kind === k)?.body ?? '');
    setTest(null);
    setMsg(null);
  }

  async function runTest() {
    setMsg(null);
    try {
      const std = catalog.node(standardId);
      if (!std || std.type !== 'standard') throw new Error('성취기준을 고르세요.');
      const context = buildContext(catalog, [std.id], std.subjectId);
      const ai = getAi();
      const label = (id: string) => catalog.textTypes.types.find((t) => t.id === id)?.label ?? id;
      const tt = DEFAULT_PARAMS.textType;
      let vars: Record<string, string | number | null>;
      let output: unknown;
      if (kind === 'material') {
        const req = { context, params: DEFAULT_PARAMS, textTypeLabels: { source: label(tt.source), structure: label(tt.structure), format: label(tt.format), content: label(tt.content) } };
        vars = materialVars(req);
        output = await ai.generateMaterial(req);
      } else if (kind === 'films') {
        const req = { context, count: 3 };
        vars = filmVars(req);
        output = await ai.suggestFilms(req);
      } else if (kind === 'strategies') {
        const fns = catalog.functionsFor(std).functionIds;
        const cands = catalog.reading.strategies.filter((s) => s.functionIds.some((f) => fns.includes(f))).slice(0, 3);
        const req = { context, materialTitle: '(예시) 읽기자료', candidates: cands.map((c) => ({ id: c.id, label: c.label, functionLabels: c.functionIds.map((f) => catalog.functionLabel(f)), matched: ['기능 일치'] })) };
        vars = strategyVars(req);
        output = await ai.explainStrategies(req);
      } else {
        const rows = buildSkeleton(catalog, 50, []);
        const req = {
          context,
          materialTitle: '(예시) 읽기자료',
          materialSummary: '',
          minutes: 50 as const,
          objectives: [toObjective(std.standardText)],
          strategies: [],
          events: rows.map((r) => ({ seq: r.seq, label: r.label, phase: r.phase, minutes: r.minutes, strategyLabels: [], referenceStrategies: [] })),
        };
        vars = lessonPlanVars(req);
        output = await ai.generateLessonPlan(req);
      }
      setTest({ prompt: renderPrompt(body, vars), output: JSON.stringify(output, null, 2) });
    } catch (e) {
      setMsg({ tone: 'error', text: errorMessage(e) });
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-stone-600">
        실제 AI(Gemini)에 보낼 지시문입니다. {config.aiMode === 'mock' ? '지금은 샘플(Mock) 모드라 테스트 실행 결과는 고정 샘플입니다 — 프롬프트가 어떻게 채워지는지 확인하는 용도입니다.' : ''}
      </p>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="프롬프트 종류">
        {KINDS.map((k) => (
          <button key={k} type="button" role="tab" aria-selected={k === kind} onClick={() => pick(k)} className={`rounded-md px-3 py-1.5 text-sm ${k === kind ? 'bg-stone-900 text-white' : 'border border-stone-300 bg-white hover:bg-stone-100'}`}>
            {PROMPT_LABEL[k]}
          </button>
        ))}
      </div>
      {cur && (
        <p className="text-sm">
          현재 <Badge tone="stone">v{cur.version}</Badge> <span className="text-stone-500">{fmt(cur.updatedAt)}</span>
        </p>
      )}
      <textarea aria-label={`${PROMPT_LABEL[kind]} 프롬프트`} rows={14} value={body} onChange={(e) => setBody(e.target.value)} className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 font-mono text-sm" />
      <details className="text-sm">
        <summary className="cursor-pointer">쓸 수 있는 자리 이름</summary>
        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
          {Object.entries(PROMPT_VARIABLES[kind]).map(([n, d]) => (
            <li key={n}>
              <code className="rounded bg-stone-100 px-1">{`{${n}}`}</code> {d}
            </li>
          ))}
        </ul>
      </details>
      {unknown.length > 0 && <Alert>모르는 자리 이름이 있습니다: {unknown.map((u) => `{${u}}`).join(', ')}</Alert>}
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={!cur || body === cur.body || unknown.length > 0}
          onClick={async () => {
            try {
              const t = await prompts.save(kind, body);
              await load();
              setMsg({ tone: 'success', text: `v${t.version}으로 저장했습니다.` });
            } catch (e) {
              setMsg({ tone: 'error', text: errorMessage(e) });
            }
          }}
        >
          새 버전으로 저장
        </Button>
        <Button variant="ghost" disabled={!cur || body === cur.body} onClick={() => setBody(cur!.body)}>
          고친 내용 버리기
        </Button>
      </div>

      {cur && cur.history.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer">이전 버전 {cur.history.length}개</summary>
          <ul className="mt-2 space-y-1">
            {cur.history.map((h) => (
              <li key={h.version} className="flex items-center gap-2">
                v{h.version} <span className="text-stone-500">{fmt(h.updatedAt)}</span>
                <button type="button" className="text-xs underline" onClick={() => setBody(h.body)}>
                  이 내용 불러오기
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      <section className="space-y-3 border-t border-stone-200 pt-6">
        <h2 className="font-semibold">테스트 실행</h2>
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="테스트할 성취기준" value={standardId} onChange={(e) => setStandardId(e.target.value)} className="max-w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm">
            {catalog.standards().map((s) => (
              <option key={s.id} value={s.id}>
                {s.standardCode} {s.standardText.slice(0, 40)}
              </option>
            ))}
          </select>
          <Button variant="secondary" onClick={runTest}>
            {config.aiMode === 'mock' ? '테스트 실행 (Mock)' : '테스트 실행'}
          </Button>
        </div>
        {test && (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="min-w-0">
              <h3 className="text-sm font-medium">채워진 프롬프트</h3>
              <pre className="mt-1 max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-stone-100 p-3 text-xs" data-testid="rendered-prompt">
                {test.prompt}
              </pre>
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-medium">응답</h3>
              <pre className="mt-1 max-h-96 overflow-auto rounded-md bg-stone-100 p-3 text-xs">{test.output}</pre>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
