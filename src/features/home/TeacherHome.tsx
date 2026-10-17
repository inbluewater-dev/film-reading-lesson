import { useLocation } from 'react-router-dom';
import { useAuth } from '../../app/AuthContext';
import { Alert } from '../../components/ui';

export default function TeacherHome() {
  const { user } = useAuth();
  const notice = (useLocation().state as { notice?: string } | null)?.notice;
  return (
    <section className="space-y-4">
      {notice && <Alert>{notice}</Alert>}
      <h1 className="text-xl font-bold">{user?.displayName}, 안녕하세요</h1>
      <p className="text-stone-600">교육과정 탐색과 수업 만들기는 다음 단계(Phase 3~)에서 이 화면에 추가됩니다.</p>
    </section>
  );
}
