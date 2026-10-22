import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth, useServices } from '../../app/AuthContext';
import { useCatalogState } from '../../app/CatalogContext';
import { useDraft } from '../../app/DraftContext';
import { Alert } from '../../components/ui';

export default function TeacherHome() {
  const { user } = useAuth();
  const { catalog } = useCatalogState();
  const { draft } = useDraft();
  const notice = (useLocation().state as { notice?: string } | null)?.notice;
  const picked = draft.selectedNodeIds.length;
  const { usage } = useServices();
  const [today, setToday] = useState<{ total: number; quota: number | null } | null>(null);
  useEffect(() => {
    usage.today().then(setToday, () => setToday(null));
  }, [usage]);
  return (
    <section className="space-y-8">
      {notice && <Alert>{notice}</Alert>}
      <div>
        <h1 className="text-xl font-bold">{user?.displayName}, 안녕하세요</h1>
        <p className="mt-1 text-stone-600">교육과정에서 출발해 읽기자료 → 독서전략 → 수업지도안 순서로 수업을 만듭니다.</p>
        {today && today.quota !== null && (
          <p className="mt-2 text-sm text-stone-600" data-testid="usage-today">
            오늘 AI 사용 {today.total}회 / 하루 {today.quota}회까지
          </p>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link to="/explore" className="rounded-md border border-stone-900 bg-stone-900 p-5 text-white hover:bg-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-600">
          <span className="block text-lg font-semibold">{picked ? '고른 항목 이어서 보기' : '새 수업 만들기'}</span>
          <span className="mt-1 block text-sm text-stone-300">
            {picked ? `교육과정에서 ${picked}개를 골라 두었습니다.` : '교육과정에서 성취기준을 골라 시작합니다.'}
          </span>
        </Link>
        {catalog && (
          <div className="rounded-md border border-stone-200 bg-white p-5 text-sm">
            <p className="font-semibold">사용할 수 있는 과목</p>
            <ul className="mt-2 space-y-1 text-stone-700">
              {catalog.subjects.map((s) => (
                <li key={s.id}>
                  {s.label} <span className="text-stone-500">({s.courseCategory}, 성취기준 {catalog.standards().filter((x) => x.subjectId === s.id).length}개)</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
