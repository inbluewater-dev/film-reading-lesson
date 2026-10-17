import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { Role } from '../lib/data/types';
import { useAuth } from './AuthContext';

function Loading() {
  return <p className="p-8 text-sm text-stone-500">불러오는 중…</p>;
}

/** 로그인 + 활성(승인됨) 계정만 통과. role을 주면 그 역할만 통과 */
export function RequireActive({ role, children }: { role?: Role; children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!user.active) return <Navigate to="/pending" replace />;
  if (role && user.role !== role) return <Navigate to="/teacher" replace state={{ notice: '관리자만 들어갈 수 있는 화면입니다.' }} />;
  return <>{children}</>;
}

/** 로그인만 확인 (승인 대기 화면, 내 정보 등) */
export function RequireSignedIn({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
