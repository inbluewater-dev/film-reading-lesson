// 가네 9사태 기본 시간 배분 (교사가 지도안에서 고칠 수 있는 출발값)
// 도입(1~3) / 전개(4~8) / 정리(9). 합계가 수업 시간과 같아야 한다 (가이드 §8.5 시간 검증)
export const DEFAULT_MINUTES: Record<50 | 100, number[]> = {
  50: [3, 2, 3, 10, 7, 12, 4, 6, 3],
  100: [5, 3, 5, 20, 15, 25, 8, 12, 7],
};

/** 독서전략이 들어가는 사태 4~6(자료 제시·학습 지침·수행 요구)에 배정된 시간 */
export const strategyWindow = (minutes: 50 | 100) => DEFAULT_MINUTES[minutes].slice(3, 6).reduce((a, b) => a + b, 0);

export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
