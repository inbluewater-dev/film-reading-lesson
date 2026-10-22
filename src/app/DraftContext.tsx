// 지금 만들고 있는 수업(작성 중 초안) — 교사별로 이 브라우저에 자동 임시 저장 (가이드 §13 안정성: localStorage 초안)
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { browserStorage } from '../lib/data/local/storage';
import { useAuth } from './AuthContext';

export interface LessonDraft {
  /** 교육과정 탐색에서 고른 노드 (영역·핵심 아이디어·내용 요소·성취기준) */
  selectedNodeIds: string[];
  /** 이후 단계(Phase 4~6)에서 쓰는 값 */
  [key: string]: unknown;
}

const EMPTY: LessonDraft = { selectedNodeIds: [] };
const storage = browserStorage();

interface DraftState {
  draft: LessonDraft;
  update: (patch: Partial<LessonDraft>) => void;
  toggleNode: (id: string) => void;
  reset: () => void;
}
const Ctx = createContext<DraftState>({ draft: EMPTY, update: () => {}, toggleNode: () => {}, reset: () => {} });

export function DraftProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const key = user ? `frl:draft:${user.uid}` : null;
  const [draft, setDraft] = useState<LessonDraft>(EMPTY);

  useEffect(() => {
    if (!key) return setDraft(EMPTY);
    try {
      const raw = storage.get(key);
      setDraft(raw ? { ...EMPTY, ...(JSON.parse(raw) as LessonDraft) } : EMPTY);
    } catch {
      setDraft(EMPTY);
    }
  }, [key]);

  const persist = useCallback(
    (next: LessonDraft) => {
      setDraft(next);
      if (key) storage.set(key, JSON.stringify(next));
    },
    [key],
  );

  const value = useMemo<DraftState>(
    () => ({
      draft,
      update: (patch) => persist({ ...draft, ...patch } as LessonDraft),
      toggleNode: (id) =>
        persist({ ...draft, selectedNodeIds: draft.selectedNodeIds.includes(id) ? draft.selectedNodeIds.filter((x) => x !== id) : [...draft.selectedNodeIds, id] }),
      reset: () => persist(EMPTY),
    }),
    [draft, persist],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useDraft = () => useContext(Ctx);
