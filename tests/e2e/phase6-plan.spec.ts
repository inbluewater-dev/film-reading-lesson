import { expect, test, type Page } from '@playwright/test';
import { login, loginTeacher, makeMaterial, shot } from './helpers';

async function toPlan(page: Page) {
  await makeMaterial(page, [/\[12영이01-03\]/]);
  await page.getByLabel('단어의 나무').check();
  await page.getByRole('button', { name: /지도안 만들기/ }).click();
  await page.getByRole('button', { name: '수업지도안 만들기' }).click();
  await expect(page.getByText('지도안을 만들어 내 보관함에 저장했습니다.')).toBeVisible();
}

test('50분 지도안: 9사태·시간 점검·잠금 후 다시 만들기·저장 후 다시 열기', async ({ page }) => {
  await loginTeacher(page);
  await toPlan(page);
  await expect(page.getByText('시간 합계 50분 / 50분')).toBeVisible();
  for (const s of ['1. 주의집중', '5. 학습 지침 제공', '9. 파지와 전이']) await expect(page.getByText(s, { exact: true })).toBeVisible();
  // 시간 고치면 경고
  await page.getByLabel('1. 주의집중 시간').fill('10');
  await expect(page.getByRole('alert')).toContainText('7분 초과');
  await page.getByLabel('1. 주의집중 시간').fill('3');
  // 교사 활동 고치고 잠근 뒤 다시 만들기
  const cell = page.getByLabel('2. 학습목표 제시 교사 활동');
  await cell.fill('직접 쓴 목표 안내 문장');
  await page.getByRole('button', { name: '2. 교사 활동 잠그기' }).click();
  const other = page.getByLabel('3. 선수학습 능력 재생 교사 활동');
  await other.fill('잠그지 않은 칸');
  await page.getByRole('button', { name: '다시 만들기 (잠근 칸 유지)' }).click();
  await expect(cell).toHaveValue('직접 쓴 목표 안내 문장');
  await expect(other).not.toHaveValue('잠그지 않은 칸');
  await page.getByLabel('지도안을 검토했습니다').check();
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.getByText('저장했습니다.')).toBeVisible();
  await shot(page, 'p6-01-plan-50');
  // 보관함에서 다시 열기
  await page.getByRole('link', { name: '내 보관함', exact: true }).click();
  await page.getByRole('tab', { name: '수업지도안' }).click();
  await expect(page.getByTestId('lessonPlans-item')).toHaveCount(1);
  await expect(page.getByTestId('lessonPlans-item')).toContainText('검토함');
  await page.getByTestId('lessonPlans-item').getByRole('link').click();
  await expect(page.getByLabel('2. 학습목표 제시 교사 활동')).toHaveValue('직접 쓴 목표 안내 문장');
  await expect(page.getByRole('button', { name: '2. 교사 활동 잠금 해제' })).toBeVisible();
});

test('블록 100분 지도안과 수업 시간 전환', async ({ page }) => {
  await loginTeacher(page);
  await page.getByRole('link', { name: '교육과정 탐색' }).click();
  await makeMaterial(page, [/\[12영이01-03\]/]);
  await page.getByRole('list', { name: '진행 단계' }).getByRole('button', { name: /수업 조건/ }).click();
  await page.getByRole('radiogroup', { name: '수업 시간' }).getByText('블록 100분').click();
  await page.getByRole('button', { name: '이 조건으로 읽기자료 다시 만들기' }).click();
  await page.getByLabel('내용을 검토했습니다 (사실·범위·표현 확인)').check();
  await page.getByRole('button', { name: '저장하고 독서전략 고르기' }).click();
  await page.getByLabel('단어의 나무').check();
  await page.getByRole('button', { name: /지도안 만들기/ }).click();
  await page.getByRole('button', { name: '수업지도안 만들기' }).click();
  await expect(page.getByText('시간 합계 100분 / 100분')).toBeVisible();
  await page.getByLabel('지도안 수업 시간').selectOption('50');
  await expect(page.getByText('시간 합계 50분 / 50분')).toBeVisible();
  await shot(page, 'p6-02-plan-100-to-50');
});

test('공유 → 다른 교사가 공유 보관함에서 보고 복제', async ({ page }) => {
  // 두 번째 교사 가입·승인
  await page.goto('/#/signup');
  await page.getByLabel('가입 코드').fill('film2026');
  await page.getByLabel('아이디').fill('leefilm');
  await page.getByLabel('표시 이름').fill('이영화 선생님');
  await page.getByLabel('비밀번호', { exact: true }).fill('password1');
  await page.getByLabel('비밀번호 확인').fill('password1');
  await page.getByRole('button', { name: '가입 신청' }).click();
  await expect(page).toHaveURL(/#\/pending$/);
  await page.getByRole('button', { name: '로그아웃' }).click();
  await login(page, 'admin01', 'admin1234');
  await page.getByTestId('pending-leefilm').getByRole('button', { name: '승인' }).click();
  await page.getByRole('button', { name: '로그아웃' }).click();

  // teacher01: 지도안 만들고 공유, 읽기자료도 보관함에서 공유
  await loginTeacher(page);
  await toPlan(page);
  await page.getByRole('button', { name: '공유 보관함에 올리기' }).click();
  await expect(page.getByText('공유 보관함에 올렸습니다.')).toBeVisible();
  await page.getByRole('link', { name: '내 보관함', exact: true }).click();
  await page.getByTestId('materials-item').first().getByRole('button', { name: '공유' }).click();
  await expect(page.getByTestId('materials-item').first()).toContainText('공유 중');
  await page.getByRole('button', { name: '로그아웃' }).click();

  // leefilm: 공유 보관함에서 보고 복제
  await login(page, 'leefilm', 'password1');
  await page.getByRole('link', { name: '공유 보관함', exact: true }).click();
  const item = page.getByTestId('lessonPlans-item');
  await expect(item).toHaveCount(1);
  await item.getByRole('link').click();
  await expect(page.getByText(/님이 공유한 지도안입니다/)).toBeVisible();
  await expect(page.getByLabel('1. 주의집중 교사 활동')).toHaveCount(0); // 읽기 전용
  await shot(page, 'p6-03-shared-view');
  await page.getByRole('button', { name: '내 보관함으로 복제' }).click();
  await expect(page.getByLabel('1. 주의집중 교사 활동')).toBeVisible(); // 내 복제본은 편집 가능
  await page.getByRole('link', { name: '내 보관함', exact: true }).click();
  await page.getByRole('tab', { name: '수업지도안' }).click();
  await expect(page.getByTestId('lessonPlans-item')).toContainText('복제본');
  // 공유된 읽기자료도 복제
  await page.getByRole('link', { name: '공유 보관함', exact: true }).click();
  await page.getByRole('tab', { name: '읽기자료' }).click();
  await page.getByTestId('materials-item').getByRole('button', { name: '내 보관함으로 복제' }).click();
  await expect(page.getByText('내 보관함으로 복제했습니다.')).toBeVisible();
});
