// 2단계: 읽기자료 — 생성 결과 편집·검토·저장 (가이드 §8.3, §14)
import { useState } from 'react';
import { useServices } from '../../app/AuthContext';
import { useCatalog } from '../../app/CatalogContext';
import { useDraft } from '../../app/DraftContext';
import { Alert, Button, errorMessage } from '../../components/ui';
import { MaterialEditor } from '../materials/MaterialEditor';
import { buildContext } from '../../lib/lesson/context';
import { getAi } from '../../lib/ai';
import { PROMPT_VERSION } from '../../lib/ai/prompts';
import { useWizard } from './state';

export default function MaterialStep({ onRegenerate, onNext, busy }: { onRegenerate: (level?: '쉬움' | '도전') => void; onNext: () => void; busy: boolean }) {
  const { library } = useServices();
  const catalog = useCatalog();
  const { draft } = useDraft();
  const [w, patch] = useWizard();
  const [msg, setMsg] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  if (!w.material) return <p className="text-sm text-stone-500">{busy ? '읽기자료를 만드는 중…' : '1단계에서 조건을 정하고 읽기자료를 만드세요.'}</p>;
  const m = w.material;
  const ctx = buildContext(catalog, draft.selectedNodeIds, w.subjectId!);

  async function save(): Promise<string | null> {
    setMsg(null);
    try {
      const data = {
        subjectId: w.subjectId!,
        nodeIds: ctx.nodeIds,
        params: w.params,
        title: m.title,
        blocks: m.blocks,
        glossary: m.glossary,
        questions: m.comprehensionQuestions,
        sourceNote: m.sourceNote,
        standardCodes: m.alignment.standardCodes,
        reviewedByTeacher: w.materialReviewed,
        model: getAi().model,
        promptVersion: PROMPT_VERSION,
      };
      const rec = w.materialId ? await library.materials.update(w.materialId, data) : await library.materials.create({ ...data, ontologyVersion: catalog.ontologyVersion });
      patch({ materialId: rec.id });
      setMsg({ tone: 'success', text: '내 보관함에 저장했습니다.' });
      return rec.id;
    } catch (e) {
      setMsg({ tone: 'error', text: errorMessage(e) });
      return null;
    }
  }

  return (
    <div className="space-y-6">
      {w.stale.material && <Alert tone="info">수업 조건이 바뀌었습니다. 새 조건을 반영하려면 ‘이 조건으로 다시 만들기’를 누르세요.</Alert>}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => onRegenerate()} disabled={busy}>
          이 조건으로 다시 만들기
        </Button>
        <Button variant="secondary" onClick={() => onRegenerate('쉬움')} disabled={busy}>
          쉬운 버전으로
        </Button>
        <Button variant="secondary" onClick={() => onRegenerate('도전')} disabled={busy}>
          도전 버전으로
        </Button>
      </div>
      <MaterialEditor
        value={{ ...m, standardCodes: m.alignment.standardCodes }}
        onChange={(v) => patch({ material: { ...m, title: v.title, blocks: v.blocks, glossary: v.glossary, comprehensionQuestions: v.comprehensionQuestions } })}
      />
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" checked={w.materialReviewed} onChange={() => patch({ materialReviewed: !w.materialReviewed })} />
        내용을 검토했습니다 (사실·범위·표현 확인)
      </label>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" onClick={save}>
          {w.materialId ? '변경 내용 저장' : '내 보관함에 저장'}
        </Button>
        <Button
          onClick={async () => {
            if (await save()) onNext();
          }}
        >
          저장하고 독서전략 고르기
        </Button>
      </div>
    </div>
  );
}
