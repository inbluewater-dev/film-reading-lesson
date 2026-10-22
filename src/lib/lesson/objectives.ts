// 학습목표 만들기 (가이드 §8.5): 성취기준 문장의 끝 동사를 “~할 수 있다”로 바꾼다. 문장 내용은 원문 그대로.
// 예) “영화 감상과 비평의 목적에 관해 탐구한다.” → “영화 감상과 비평의 목적에 관해 탐구할 수 있다.”

const JONG_N = 4; // ㄴ 받침
const JONG_L = 8; // ㄹ 받침

export function toObjective(standardText: string): string {
  const t = standardText.trim().replace(/\.$/, '');
  if (!t.endsWith('다')) return `${t}.`;
  const stem = t.slice(0, -1); // “탐구한”
  const last = stem.charCodeAt(stem.length - 1) - 0xac00;
  if (last < 0 || last >= 11172 || last % 28 !== JONG_N) return `${t}.`; // ㄴ다 형태가 아니면 그대로
  const withL = String.fromCharCode(0xac00 + last - JONG_N + JONG_L); // 한 → 할, 본 → 볼
  return `${stem.slice(0, -1)}${withL} 수 있다.`;
}
