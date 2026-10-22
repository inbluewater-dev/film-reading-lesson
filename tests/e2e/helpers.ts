import { expect, type Page } from '@playwright/test';
export const shot = (page: Page, name: string) => page.screenshot({ path: `test-results/${name}.png`, fullPage: true });
export async function login(page: Page, id: string, pw: string) {
  await page.goto('/#/login');
  await page.getByLabel('아이디').fill(id);
  await page.getByLabel('비밀번호').fill(pw);
  await page.getByRole('button', { name: '로그인' }).click();
}
export async function loginTeacher(page: Page) {
  await login(page, 'teacher01', 'teacher1234');
  await expect(page).toHaveURL(/#\/teacher$/);
}
