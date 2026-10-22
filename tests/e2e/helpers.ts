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
