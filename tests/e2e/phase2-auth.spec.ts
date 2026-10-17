import { expect, test, type Page } from '@playwright/test';

const shot = (page: Page, name: string) => page.screenshot({ path: `test-results/${name}.png`, fullPage: true });

async function login(page: Page, id: string, pw: string) {
  await page.goto('/#/login');
  await page.getByLabel('아이디').fill(id);
  await page.getByLabel('비밀번호').fill(pw);
  await page.getByRole('button', { name: '로그인' }).click();
}
async function logout(page: Page) {
  await page.getByRole('button', { name: '로그아웃' }).click();
  await expect(page).toHaveURL(/#\/login$/);
}

test('로그인 화면과 입력 검증', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/#\/login$/);
  await page.getByLabel('아이디').fill('AB');
  await page.getByLabel('비밀번호').fill('x');
  await page.getByRole('button', { name: '로그인' }).click();
  await expect(page.getByRole('alert')).toHaveText('아이디는 영어 소문자와 숫자 4~20자입니다.');
  await login(page, 'teacher01', 'wrongpass');
  await expect(page.getByRole('alert')).toHaveText('아이디 또는 비밀번호가 맞지 않습니다.');
  await shot(page, 'p2-01-login');
});

test('교사는 관리자 화면에 들어갈 수 없다', async ({ page }) => {
  await login(page, 'teacher01', 'teacher1234');
  await expect(page).toHaveURL(/#\/teacher$/);
  await expect(page.getByRole('link', { name: '관리자' })).toHaveCount(0);
  await page.goto('/#/admin');
  await expect(page).toHaveURL(/#\/teacher$/);
  await expect(page.getByRole('alert')).toHaveText('관리자만 들어갈 수 있는 화면입니다.');
  await shot(page, 'p2-02-teacher-blocked-from-admin');
});

test('가입 신청 → 관리자 승인 → 로그인', async ({ page }) => {
  // 1) 틀린 가입 코드
  await page.goto('/#/signup');
  const fill = async (code: string) => {
    await page.getByLabel('가입 코드').fill(code);
    await page.getByLabel('아이디').fill('parkfilm');
    await page.getByLabel('표시 이름').fill('박감상 선생님');
    await page.getByLabel('비밀번호', { exact: true }).fill('password1');
    await page.getByLabel('비밀번호 확인').fill('password1');
    await page.getByRole('button', { name: '가입 신청' }).click();
  };
  await fill('wrongcode');
  await expect(page.getByRole('alert')).toContainText('가입 코드가 맞지 않습니다');
  // 2) 맞는 가입 코드 → 승인 대기
  await fill('film2026');
  await expect(page).toHaveURL(/#\/pending$/);
  await expect(page.getByRole('heading', { name: '관리자 승인 대기 중' })).toBeVisible();
  await shot(page, 'p2-03-pending');
  // 승인 전에는 교사 화면에 못 들어감
  await page.goto('/#/teacher');
  await expect(page).toHaveURL(/#\/pending$/);
  await page.getByRole('button', { name: '로그아웃' }).click();

  // 3) 관리자 승인
  await login(page, 'admin01', 'admin1234');
  await expect(page).toHaveURL(/#\/admin$/);
  const row = page.getByTestId('pending-parkfilm');
  await expect(row).toContainText('박감상 선생님');
  await shot(page, 'p2-04-admin-pending');
  await row.getByRole('button', { name: '승인' }).click();
  await expect(page.getByRole('status')).toHaveText('박감상 선생님(parkfilm) 계정을 승인했습니다.');
  await expect(page.getByTestId('user-parkfilm')).toContainText('사용 중');
  await logout(page);

  // 4) 승인된 교사 로그인
  await login(page, 'parkfilm', 'password1');
  await expect(page).toHaveURL(/#\/teacher$/);
  await expect(page.getByRole('heading', { name: /박감상 선생님/ })).toBeVisible();
});

test('거절과 사용 중지', async ({ page }) => {
  await page.goto('/#/signup');
  await page.getByLabel('가입 코드').fill('film2026');
  await page.getByLabel('아이디').fill('leefilm');
  await page.getByLabel('표시 이름').fill('이비평');
  await page.getByLabel('비밀번호', { exact: true }).fill('password1');
  await page.getByLabel('비밀번호 확인').fill('password1');
  await page.getByRole('button', { name: '가입 신청' }).click();
  await expect(page).toHaveURL(/#\/pending$/);
  await page.getByRole('button', { name: '로그아웃' }).click();

  await login(page, 'admin01', 'admin1234');
  const row = page.getByTestId('pending-leefilm');
  await row.getByRole('button', { name: '거절' }).click();
  await row.getByLabel('거절 사유').fill('소속 확인 불가');
  await row.getByRole('button', { name: '거절 확정' }).click();
  await expect(page.getByTestId('user-leefilm')).toContainText('거절됨');
  // teacher01 사용 중지
  await page.getByTestId('user-teacher01').getByRole('button', { name: '사용 중지' }).click();
  await expect(page.getByTestId('user-teacher01')).toContainText('중지');
  await logout(page);

  await login(page, 'leefilm', 'password1');
  await expect(page.getByRole('heading', { name: '가입이 승인되지 않았습니다' })).toBeVisible();
  await expect(page.getByText('사유: 소속 확인 불가')).toBeVisible();
  await page.getByRole('button', { name: '로그아웃' }).click();

  await login(page, 'teacher01', 'teacher1234');
  await expect(page.getByRole('heading', { name: '사용이 중지된 계정입니다' })).toBeVisible();
});

test('관리자 가입 코드 변경, 비밀번호 변경', async ({ page }) => {
  await login(page, 'admin01', 'admin1234');
  await expect(page.getByTestId('invite-code')).toHaveText('film2026');
  await page.getByLabel('새 가입 코드').fill('cinema2027');
  await page.getByRole('button', { name: '변경' }).click();
  await expect(page.getByTestId('invite-code')).toHaveText('cinema2027');
  await shot(page, 'p2-05-admin');

  await page.getByRole('link', { name: '내 정보' }).click();
  await page.getByLabel('현재 비밀번호').fill('admin1234');
  await page.getByLabel('새 비밀번호', { exact: true }).fill('newadmin99');
  await page.getByLabel('새 비밀번호 확인').fill('newadmin99');
  await page.getByRole('button', { name: '비밀번호 변경' }).click();
  await expect(page.getByRole('status')).toHaveText('비밀번호를 바꿨습니다.');
  await logout(page);
  await login(page, 'admin01', 'newadmin99');
  await expect(page).toHaveURL(/#\/admin$/);
});
