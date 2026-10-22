import { expect, test } from '@playwright/test';
import { loginTeacher, shot } from './helpers';

test('3과목 탐색, 성취기준 해설, 선택 저장', async ({ page }) => {
  await loginTeacher(page);
  await page.getByRole('link', { name: '교육과정 탐색' }).click();
  await expect(page.getByRole('heading', { name: '교육과정 탐색' })).toBeVisible();

  // 영화의 이해: 영역 3개, 첫 영역 성취기준 5개
  await expect(page.getByRole('navigation', { name: '영역' }).getByRole('button')).toHaveCount(3);
  await expect(page.getByText('[12영이01-01]')).toBeVisible();
  await page.getByLabel(/\[12영이01-01\]/).check();
  // 해설 펼치기
  await page.getByRole('button', { name: '해설 보기' }).first().click();
  await expect(page.getByText('성취기준 해설')).toBeVisible();
  // 독서 기능 표시: 01-03은 ‘이해하다’ → 이해, 01-02는 ‘탐구하다’ → 미지정
  await expect(page.getByText('독서 기능: 이해')).toBeVisible();
  await expect(page.getByText('독서 기능 미지정').first()).toBeVisible();
  await shot(page, 'p3-01-explorer');

  // 영화 감상과 비평 → 두 번째 영역
  await page.getByRole('button', { name: /영화 감상과 비평/ }).click();
  await expect(page.getByRole('navigation', { name: '영역' }).getByRole('button')).toHaveCount(2);
  await page.getByRole('button', { name: /감상과 비평의 실제/ }).click();
  await page.getByLabel('영화와 사회', { exact: true }).check();

  // 영화와 삶 → 검색으로 성취기준 선택
  await page.getByRole('button', { name: /영화와 삶/ }).click();
  await page.getByRole('searchbox').fill('12영삶03');
  await expect(page.getByText('2개 찾음')).toBeVisible();
  await page.getByRole('checkbox', { name: /\[12영삶03-01\]/ }).check();
  await shot(page, 'p3-02-search');

  const tray = page.getByTestId('selection-list');
  await expect(tray.getByRole('listitem')).toHaveCount(3);
  await expect(page.getByRole('complementary', { name: '고른 항목' })).toContainText('[12영이01-01]');

  // 새로 고침해도 선택이 남는다(교사별 임시 저장)
  await page.reload();
  await page.getByRole('link', { name: '교육과정 탐색' }).click();
  await expect(page.getByTestId('selection-list').getByRole('listitem')).toHaveCount(3);
  // 홈에서도 보인다
  await page.getByRole('link', { name: '홈' }).click();
  await expect(page.getByText('교육과정에서 3개를 골라 두었습니다.')).toBeVisible();
});
