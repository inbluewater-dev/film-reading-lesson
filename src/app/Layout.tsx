import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui';
import { config } from '../lib/config';
import { useAuth, useServices } from './AuthContext';

export default function Layout() {
  const { user } = useAuth();
  const services = useServices();
  const navigate = useNavigate();
  const link = ({ isActive }: { isActive: boolean }) => `px-3 py-2 rounded-md text-sm ${isActive ? 'bg-stone-200 font-medium' : 'text-stone-700 hover:bg-stone-100'}`;
  return (
    <div className="min-h-screen">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-3">
          <span className="mr-4 font-bold">영화 수업 설계 도우미</span>
          <nav className="flex flex-wrap gap-1" aria-label="주 메뉴">
            <NavLink to="/teacher" className={link}>
              홈
            </NavLink>
            <NavLink to="/explore" className={link}>
              교육과정 탐색
            </NavLink>
            {user?.role === 'admin' && (
              <NavLink to="/admin" className={link}>
                관리자
              </NavLink>
            )}
            <NavLink to="/account" className={link}>
              내 정보
            </NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-stone-600">
              {user?.displayName} <span className="text-stone-400">({user?.loginId})</span>
            </span>
            <Button
              variant="secondary"
              onClick={async () => {
                await services.auth.signOut();
                navigate('/login');
              }}
            >
              로그아웃
            </Button>
          </div>
        </div>
        {config.dataMode === 'local' && (
          <div className="bg-amber-50 px-4 py-1 text-center text-xs text-amber-900">로컬 테스트 모드 — 데이터가 이 브라우저에만 저장됩니다</div>
        )}
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
