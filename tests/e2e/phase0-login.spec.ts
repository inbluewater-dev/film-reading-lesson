import { expect, test } from '@playwright/test';

test('Phase 0: 빈 로그인 화면이 표시된다', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/#\/login$/);
  await expect(page.getByRole('heading', { name: '영화 수업 설계 도우미' })).toBeVisible();
  await expect(page.getByLabel('아이디')).toBeVisible();
  await expect(page.getByLabel('비밀번호')).toBeVisible();

  // 입력 검증: 잘못된 아이디 형식
  await page.getByLabel('아이디').fill('AB');
  await page.getByLabel('비밀번호').fill('123456');
  await page.getByRole('button', { name: '로그인' }).click();
  await expect(page.getByRole('alert')).toHaveText('아이디는 영어 소문자와 숫자 4~20자입니다.');

  await page.screenshot({ path: 'test-results/phase0-login.png', fullPage: true });
});
