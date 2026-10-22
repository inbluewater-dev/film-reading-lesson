// 지금 만들고 있는 수업(작성 중 초안) — 교사별로 이 브라우저에 자동 임시 저장 (가이드 §13 안정성: localStorage 초안)
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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

type Patch = Partial<LessonDraft> | ((current: LessonDraft) => Partial<LessonDraft>);
interface DraftState {
  draft: LessonDraft;
  /** 항상 최신 초안에 덧붙인다 (연달아 호출해도 앞의 변경이 사라지지 않음) */
  update: (patch: Patch) => void;
  toggleNode: (id: string) => void;
  reset: () => void;
}
const Ctx = createContext<DraftState>({ draft: EMPTY, update: () => {}, toggleNode: () => {}, reset: () => {} });

export function DraftProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const key = user ? `frl:draft:${user.uid}` : null;
  const [draft, setDraft] = useState<LessonDraft>(EMPTY);
  const latest = useRef<LessonDraft>(EMPTY);

  useEffect(() => {
    let next = EMPTY;
    if (key) {
      try {
        const raw = storage.get(key);
        if (raw) next = { ...EMPTY, ...(JSON.parse(raw) as LessonDraft) };
      } catch {
        /* 손상된 초안은 버린다 */
      }
    }
    latest.current = next;
    setDraft(next);
  }, [key]);

  const persist = useCallback(
    (patch: Patch | 'reset') => {
      const cur = latest.current;
      const next = patch === 'reset' ? EMPTY : ({ ...cur, ...(typeof patch === 'function' ? patch(cur) : patch) } as LessonDraft);
      latest.current = next;
      setDraft(next);
      if (key) storage.set(key, JSON.stringify(next));
    },
    [key],
  );

  const value = useMemo<DraftState>(
    () => ({
      draft,
      update: (patch) => persist(patch),
      toggleNode: (id) => persist((d) => ({ selectedNodeIds: d.selectedNodeIds.includes(id) ? d.selectedNodeIds.filter((x) => x !== id) : [...d.selectedNodeIds, id] })),
      reset: () => persist('reset'),
    }),
    [draft, persist],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useDraft = () => useContext(Ctx);
