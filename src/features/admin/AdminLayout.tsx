// 관리자 화면 틀 (가이드 §9.3): 계정 · 교육과정 연결 · 독서전략 · TTL 버전 · 프롬프트 · 사용 현황
import { Suspense } from 'react';
import { NavLink, Outlet } from 'react-router-dom';

const TABS = [
  { to: '/admin', label: '계정', end: true },
  { to: '/admin/curriculum', label: '교육과정 연결' },
  { to: '/admin/strategies', label: '독서전략' },
  { to: '/admin/ontology', label: 'TTL 버전' },
  { to: '/admin/prompts', label: '프롬프트' },
  { to: '/admin/usage', label: '사용 현황' },
];

export default function AdminLayout() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">관리자</h1>
      <nav aria-label="관리자 메뉴" className="flex flex-wrap gap-1 border-b border-stone-200">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) => `-mb-px border-b-2 px-3 py-2 text-sm ${isActive ? 'border-stone-900 font-semibold text-stone-900' : 'border-transparent text-stone-600 hover:text-stone-900'}`}
          >
            {t.label}
          </NavLink>
        ))}
      </nav>
      <Suspense fallback={<p className="text-sm text-stone-500">불러오는 중…</p>}>
        <Outlet />
      </Suspense>
    </div>
  );
}
