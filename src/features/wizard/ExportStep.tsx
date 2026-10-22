// 5단계: 내보내기
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useServices } from '../../app/AuthContext';
import { Alert } from '../../components/ui';
import type { LessonPlanRecord } from '../../lib/library/types';
import { ExportPanel } from '../export/ExportPanel';
import { useWizard } from './state';

export default function ExportStep() {
  const { library } = useServices();
  const [w] = useWizard();
  const [plan, setPlan] = useState<LessonPlanRecord | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (w.planId) library.lessonPlans.get(w.planId).then(setPlan, () => setError(true));
  }, [w.planId, library]);
  if (error) return <Alert>저장한 지도안을 찾을 수 없습니다. 4단계에서 다시 만들어 주세요.</Alert>;
  if (!plan) return <p className="text-sm text-stone-500">불러오는 중…</p>;
  return (
    <div className="space-y-4">
      <p className="text-sm text-stone-600">
        저장된 지도안 「{plan.title}」을 내보냅니다. 나중에 <Link to={`/library/plan/${plan.id}`} className="underline">내 보관함</Link>에서도 내보낼 수 있습니다.
      </p>
      <ExportPanel plan={plan} />
    </div>
  );
}
