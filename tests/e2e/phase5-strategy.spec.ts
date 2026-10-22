import { expect, test, type Page } from '@playwright/test';
import { loginTeacher, shot } from './helpers';

export async function makeMaterial(page: Page, codes: RegExp[]) {
  await page.getByRole('link', { name: '교육과정 탐색' }).click();
  const SUBJECT = { 영이: /영화의 이해/, 영감: /영화 감상과 비평/, 영삶: /영화와 삶/ } as const;
  for (const c of codes) {
    const code = c.source.replace(/\\/g, '').replace(/[\[\]]/g, '');
    await page.getByRole('navigation', { name: '과목' }).getByRole('button', { name: SUBJECT[code.slice(2, 4) as keyof typeof SUBJECT] }).click();
    await page.getByRole('searchbox').fill(code);
    await page.getByRole('checkbox', { name: c }).check();
  }
  await page.getByRole('searchbox').fill('');
  await page.getByRole('link', { name: '이 선택으로 수업 만들기' }).click();
  await page.getByRole('button', { name: '읽기자료 만들기' }).click();
  await page.getByLabel('내용을 검토했습니다 (사실·범위·표현 확인)').check();
  await page.getByRole('button', { name: '저장하고 독서전략 고르기' }).click();
}

test('성취기준 독서 기능 → 전략 추천·선택, 기능 미지정이면 교사가 직접 선택', async ({ page }) => {
  await loginTeacher(page);
  await makeMaterial(page, [/\[12영감01-01\]/]); // 탐구한다 → 미지정
  await expect(page.getByText('독서 기능 미지정')).toBeVisible();
  await expect(page.getByText('고른 성취기준에서 독서 기능을 정하지 못했습니다.')).toBeVisible();
  await expect(page.getByRole('button', { name: '전략을 하나 이상 고르세요' })).toBeDisabled();
  await page.locator('label').filter({ hasText: /^평가/ }).click();
  await expect(page.getByTestId('strategy-candidate')).toHaveCount(5);
  await page.getByLabel('오류 찾기').check();
  await page.getByLabel('복식 기재 일지').check();
  await page.getByRole('button', { name: '자세히' }).first().click();
  await expect(page.getByText('실행 절차가 아직 등록되지 않았습니다.')).toBeVisible();
  await expect(page.getByText('검수 전(초안)')).toBeVisible();
  await shot(page, 'p5-01-strategies');
  await expect(page.getByRole('button', { name: '고른 전략 2개로 지도안 만들기' })).toBeEnabled();
});

test('‘이해하다’ 성취기준은 기능이 자동으로 정해진다', async ({ page }) => {
  await loginTeacher(page);
  await makeMaterial(page, [/\[12영이01-03\]/]);
  await expect(page.getByText('→ 이해')).toBeVisible();
  // 저장 직후 단계 이동 — 저장한 자료 ID가 유지되어 3단계 버튼이 활성 상태여야 한다
  await expect(page.getByRole('list', { name: '진행 단계' }).getByRole('button', { name: /독서전략/ })).toBeEnabled();
  await expect(page.getByText('(끝 동사 일치)')).toBeVisible();
  await expect(page.getByTestId('strategy-candidate')).toHaveCount(5);
  // 최대 3개
  for (const name of ['단어의 나무', '낱말 접사 만들기', '손 그리기 활동']) await page.getByLabel(name).check();
  await expect(page.getByLabel('감정표')).toBeDisabled();
});
