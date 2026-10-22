// 읽기자료 편집기·보기 — 생성 결과를 교사가 고친 뒤 저장한다 (가이드 §8.3, §14)
import type { MaterialResult } from '../../lib/ai/types';
import { Badge } from '../../components/ui';

type M = Pick<MaterialResult, 'title' | 'blocks' | 'glossary' | 'comprehensionQuestions' | 'sourceNote'> & { standardCodes: string[] };

const input = 'w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600';
const small = 'text-xs font-medium text-stone-600 underline';

export function ReviewBanner({ note, codes }: { note: string; codes: string[] }) {
  return (
    <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
      <p className="font-semibold text-amber-950">AI 생성물 — 사용 전 교사 검토</p>
      <p className="text-stone-700">{note}</p>
      {codes.length > 0 && (
        <p className="flex flex-wrap items-center gap-1">
          <span className="text-xs text-stone-600">연결된 성취기준</span>
          {codes.map((c) => (
            <Badge key={c} tone="stone">
              {c}
            </Badge>
          ))}
        </p>
      )}
    </div>
  );
}

export function MaterialEditor({ value, onChange }: { value: M; onChange: (v: M) => void }) {
  const set = (p: Partial<M>) => onChange({ ...value, ...p });
  const setBlock = (i: number, b: M['blocks'][number]) => set({ blocks: value.blocks.map((x, j) => (j === i ? b : x)) });

  return (
    <div className="space-y-6">
      <ReviewBanner note={value.sourceNote} codes={value.standardCodes} />
      <div>
        <label htmlFor="m-title" className="text-sm font-semibold">
          제목
        </label>
        <input id="m-title" className={`${input} mt-1 text-base font-semibold`} value={value.title} onChange={(e) => set({ title: e.target.value })} />
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold">본문</h3>
        {value.blocks.map((b, i) =>
          b.kind === 'paragraph' ? (
            <div key={i} className="space-y-1">
              <textarea aria-label={`문단 ${i + 1}`} rows={3} className={input} value={b.text} onChange={(e) => setBlock(i, { ...b, text: e.target.value })} />
              <button type="button" className={small} onClick={() => set({ blocks: value.blocks.filter((_, j) => j !== i) })} disabled={value.blocks.length <= 1}>
                문단 지우기
              </button>
            </div>
          ) : (
            <div key={i} className="space-y-2 overflow-x-auto rounded-md border border-stone-200 bg-white p-3">
              <input aria-label="표 제목" className={input} value={b.caption} onChange={(e) => setBlock(i, { ...b, caption: e.target.value })} />
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    {b.columns.map((c, ci) => (
                      <th key={ci} className="p-1">
                        <input aria-label={`열 ${ci + 1} 제목`} className={input} value={c} onChange={(e) => setBlock(i, { ...b, columns: b.columns.map((x, k) => (k === ci ? e.target.value : x)) })} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {b.rows.map((r, ri) => (
                    <tr key={ri}>
                      {r.map((cell, ci) => (
                        <td key={ci} className="p-1">
                          <input
                            aria-label={`${ri + 1}행 ${ci + 1}열`}
                            className={input}
                            value={cell}
                            onChange={(e) => setBlock(i, { ...b, rows: b.rows.map((row, k) => (k === ri ? row.map((x, m) => (m === ci ? e.target.value : x)) : row)) })}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex gap-3">
                <button type="button" className={small} onClick={() => setBlock(i, { ...b, rows: [...b.rows, b.columns.map(() => '')] })}>
                  행 추가
                </button>
                <button type="button" className={small} onClick={() => set({ blocks: value.blocks.filter((_, j) => j !== i) })}>
                  표 지우기
                </button>
              </div>
            </div>
          ),
        )}
        <button type="button" className={small} onClick={() => set({ blocks: [...value.blocks, { kind: 'paragraph', text: '' }] })}>
          문단 추가
        </button>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">용어 풀이</h3>
        {value.glossary.map((g, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-[10rem_minmax(0,1fr)_auto]">
            <input aria-label={`용어 ${i + 1}`} className={input} value={g.term} onChange={(e) => set({ glossary: value.glossary.map((x, j) => (j === i ? { ...x, term: e.target.value } : x)) })} />
            <input aria-label={`뜻 ${i + 1}`} className={input} value={g.meaning} onChange={(e) => set({ glossary: value.glossary.map((x, j) => (j === i ? { ...x, meaning: e.target.value } : x)) })} />
            <button type="button" className={small} onClick={() => set({ glossary: value.glossary.filter((_, j) => j !== i) })}>
              지우기
            </button>
          </div>
        ))}
        <button type="button" className={small} onClick={() => set({ glossary: [...value.glossary, { term: '', meaning: '' }] })}>
          용어 추가
        </button>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">이해 확인 질문</h3>
        {value.comprehensionQuestions.map((q, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-[6rem_minmax(0,1fr)_auto]">
            <select
              aria-label={`질문 ${i + 1} 수준`}
              className={input}
              value={q.level}
              onChange={(e) => set({ comprehensionQuestions: value.comprehensionQuestions.map((x, j) => (j === i ? { ...x, level: e.target.value as typeof q.level } : x)) })}
            >
              <option>기본</option>
              <option>중간</option>
              <option>심화</option>
            </select>
            <input aria-label={`질문 ${i + 1}`} className={input} value={q.question} onChange={(e) => set({ comprehensionQuestions: value.comprehensionQuestions.map((x, j) => (j === i ? { ...x, question: e.target.value } : x)) })} />
            <button type="button" className={small} disabled={value.comprehensionQuestions.length <= 3} onClick={() => set({ comprehensionQuestions: value.comprehensionQuestions.filter((_, j) => j !== i) })}>
              지우기
            </button>
          </div>
        ))}
        {value.comprehensionQuestions.length < 5 && (
          <button type="button" className={small} onClick={() => set({ comprehensionQuestions: [...value.comprehensionQuestions, { level: '중간', question: '' }] })}>
            질문 추가
          </button>
        )}
      </div>
    </div>
  );
}

export function MaterialView({ value }: { value: M }) {
  return (
    <article className="space-y-5">
      <ReviewBanner note={value.sourceNote} codes={value.standardCodes} />
      <h2 className="text-xl font-bold">{value.title}</h2>
      <div className="space-y-3 leading-7">
        {value.blocks.map((b, i) =>
          b.kind === 'paragraph' ? (
            <p key={i}>{b.text}</p>
          ) : (
            <div key={i} className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <caption className="mb-1 text-left text-xs text-stone-600">{b.caption}</caption>
                <thead>
                  <tr>{b.columns.map((c, ci) => <th key={ci} className="border border-stone-300 bg-stone-100 px-2 py-1 text-left">{c}</th>)}</tr>
                </thead>
                <tbody>
                  {b.rows.map((r, ri) => (
                    <tr key={ri}>{r.map((cell, ci) => <td key={ci} className="border border-stone-300 px-2 py-1">{cell}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          ),
        )}
      </div>
      {value.glossary.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold">용어 풀이</h3>
          <dl className="mt-2 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[10rem_minmax(0,1fr)]">
            {value.glossary.map((g, i) => (
              <div key={i} className="contents">
                <dt className="font-medium">{g.term}</dt>
                <dd className="text-stone-700">{g.meaning}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      <section>
        <h3 className="text-sm font-semibold">이해 확인 질문</h3>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
          {value.comprehensionQuestions.map((q, i) => (
            <li key={i}>
              <span className="mr-1 text-xs text-stone-500">[{q.level}]</span>
              {q.question}
            </li>
          ))}
        </ol>
      </section>
    </article>
  );
}
