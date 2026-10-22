import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { errorMessage } from '../components/ui';
import type { Catalog } from '../lib/catalog/catalog';
import { useServices } from './AuthContext';

interface CatalogState {
  catalog: Catalog | null;
  error: string | null;
  reload: () => Promise<void>;
}
const Ctx = createContext<CatalogState>({ catalog: null, error: null, reload: async () => {} });

/** 로그인(승인)된 화면에서 카탈로그를 한 번 불러와 공유한다 (가이드 §7: 과목 단위 캐시) */
export function CatalogProvider({ children }: { children: ReactNode }) {
  const { catalog: service } = useServices();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    try {
      setCatalog(await service.load());
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [service]);
  useEffect(() => {
    void reload();
  }, [reload]);
  return <Ctx.Provider value={{ catalog, error, reload }}>{children}</Ctx.Provider>;
}

export const useCatalogState = () => useContext(Ctx);

/** 카탈로그가 준비된 뒤에만 쓰는 화면용 */
export function useCatalog(): Catalog {
  const { catalog } = useContext(Ctx);
  if (!catalog) throw new Error('교육과정 데이터가 아직 준비되지 않았습니다.');
  return catalog;
}

/** 카탈로그가 준비될 때까지 대기 화면을 보여준다 */
export function CatalogGate({ children }: { children: ReactNode }) {
  const { catalog, error } = useContext(Ctx);
  if (error) return <p role="alert" className="text-sm text-red-700">{error}</p>;
  if (!catalog) return <p className="text-sm text-stone-500">교육과정을 불러오는 중…</p>;
  return <>{children}</>;
}
