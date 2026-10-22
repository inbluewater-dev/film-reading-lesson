// 화면에서 쓰는 AI: 사용 기록·하루 한도 확인이 붙은 공급자
import { useMemo } from 'react';
import { getAi } from '../lib/ai';
import { trackedAi } from '../lib/ai/tracked';
import { useServices } from './AuthContext';

export function useAi() {
  const { usage } = useServices();
  return useMemo(() => trackedAi(getAi(), usage), [usage]);
}
