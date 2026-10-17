import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getServices } from '../lib/data';
import type { Services, UserProfile } from '../lib/data/types';

interface AuthState {
  services: Services | null;
  user: UserProfile | null;
  loading: boolean;
}
const Ctx = createContext<AuthState>({ services: null, user: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ services: null, user: null, loading: true });
  useEffect(() => {
    let unsub = () => {};
    let alive = true;
    getServices().then((services) => {
      if (!alive) return;
      unsub = services.auth.onChange((user) => setState({ services, user, loading: false }));
    });
    return () => {
      alive = false;
      unsub();
    };
  }, []);
  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);

/** 서비스가 준비된 화면에서만 사용 */
export function useServices(): Services {
  const { services } = useAuth();
  if (!services) throw new Error('서비스가 아직 준비되지 않았습니다.');
  return services;
}

/** 로그인한 사용자를 어느 화면으로 보낼지 */
export function homePathFor(user: UserProfile): string {
  if (!user.active) return '/pending';
  return user.role === 'admin' ? '/admin' : '/teacher';
}
