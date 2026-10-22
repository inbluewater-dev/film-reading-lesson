// 읽기자료 상세: 내 것이면 편집·저장, 공유받은 것이면 보기·복제
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth, useServices } from '../../app/AuthContext';
import { Alert, Button, errorMessage } from '../../components/ui';
import type { MaterialRecord } from '../../lib/library/types';
import { MaterialEditor, MaterialView } from '../materials/MaterialEditor';

export default function MaterialDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { library } = useServices();
  const navigate = useNavigate();
  const [m, setM] = useState<MaterialRecord | null>(null);
  const [msg, setMsg] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);

  useEffect(() => {
    library.materials.get(id!).then(setM, (e) => setMsg({ tone: 'error', text: errorMessage(e) }));
  }, [id, library]);

  if (!m) return msg ? <Alert>{msg.text}</Alert> : <p className="text-sm text-stone-500">불러오는 중…</p>;
  const mine = m.ownerUid === user?.uid;
  const asEdit = { title: m.title, blocks: m.blocks, glossary: m.glossary, comprehensionQuestions: m.questions, sourceNote: m.sourceNote, standardCodes: m.standardCodes };

  return (
    <section className="max-w-3xl space-y-6">
      <Link to={mine ? '/library' : '/shared'} className="text-sm text-stone-600 underline">
        ← {mine ? '내 보관함' : '공유 보관함'}
      </Link>
      {!mine && <p className="text-sm text-stone-600">{m.ownerDisplayName}님이 공유한 자료입니다. 고치려면 내 보관함으로 복제하세요.</p>}
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      {mine ? (
        <>
          <MaterialEditor value={asEdit} onChange={(v) => setM({ ...m, title: v.title, blocks: v.blocks, glossary: v.glossary, questions: v.comprehensionQuestions })} />
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={m.reviewedByTeacher} onChange={() => setM({ ...m, reviewedByTeacher: !m.reviewedByTeacher })} />
            내용을 검토했습니다 (사실·범위·표현 확인)
          </label>
          <Button
            onClick={async () => {
              try {
                setM(await library.materials.update(m.id, { title: m.title, blocks: m.blocks, glossary: m.glossary, questions: m.questions, reviewedByTeacher: m.reviewedByTeacher }));
                setMsg({ tone: 'success', text: '저장했습니다.' });
              } catch (e) {
                setMsg({ tone: 'error', text: errorMessage(e) });
              }
            }}
          >
            저장
          </Button>
        </>
      ) : (
        <>
          <MaterialView value={asEdit} />
          <Button
            onClick={async () => {
              try {
                const c = await library.materials.copy(m.id);
                navigate(`/library/material/${c.id}`);
              } catch (e) {
                setMsg({ tone: 'error', text: errorMessage(e) });
              }
            }}
          >
            내 보관함으로 복제
          </Button>
        </>
      )}
    </section>
  );
}
