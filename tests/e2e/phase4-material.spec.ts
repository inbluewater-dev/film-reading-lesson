import { expect, test } from '@playwright/test';
import { loginTeacher, shot } from './helpers';

test('조건 입력 → 읽기자료 생성·편집·검토·저장 → 보관함', async ({ page }) => {
  await loginTeacher(page);
  await page.getByRole('link', { name: '교육과정 탐색' }).click();
  await page.getByRole('button', { name: /영화의 구성 요소/ }).click();
  await page.getByLabel(/\[12영이02-03\]/).check();
  await page.getByLabel('영화 언어와 이미지', { exact: true }).check();
  await page.getByRole('link', { name: '이 선택으로 수업 만들기' }).click();

  // 1단계: 조건
  await expect(page.getByRole('heading', { name: '수업 만들기' })).toBeVisible();
  await page.getByRole('radiogroup', { name: '대상 학년' }).getByText('2학년').click();
  await page.getByRole('radiogroup', { name: '수업 시간' }).getByText('블록 100분').click();
  await page.getByRole('radiogroup', { name: '텍스트 유형 체재' }).getByText('혼합적').click();
  await page.getByLabel('영화 제목').fill('교사가 고른 영화');
  await page.getByRole('button', { name: '추가', exact: true }).click();
  await page.getByRole('button', { name: 'AI에게 추천받기' }).click();
  await expect(page.getByText('(샘플) 예시 영화 1')).toBeVisible();
  // 확인하지 않은 AI 추천이 있으면 만들 수 없다
  await expect(page.getByRole('button', { name: '읽기자료 만들기' })).toBeDisabled();
  await shot(page, 'p4-01-conditions');
  await page.getByRole('checkbox', { name: '제목·감독·연도 등 사실을 확인했습니다' }).first().check();
  for (let i = 0; i < 2; i++) await page.getByRole('button', { name: '빼기' }).last().click();
  await expect(page.getByRole('button', { name: '읽기자료 만들기' })).toBeEnabled();
  await page.getByRole('button', { name: '읽기자료 만들기' }).click();

  // 2단계: 읽기자료
  await expect(page.getByText('AI 생성물 — 사용 전 교사 검토')).toBeVisible();
  await expect(page.getByLabel('표 제목')).toBeVisible(); // 혼합적 → 표 포함
  await expect(page.locator('textarea').filter({ hasText: '교사가 고른 영화' })).toBeVisible();
  await page.getByLabel('제목', { exact: true }).fill('몽타주로 읽는 장면의 연결');
  await page.getByLabel('뜻 1').fill('영화 언어: 영화가 의미를 전하는 표현 방식');
  await page.getByLabel('내용을 검토했습니다 (사실·범위·표현 확인)').check();
  await shot(page, 'p4-02-material');
  await page.getByRole('button', { name: '내 보관함에 저장' }).click();
  await expect(page.getByRole('status').filter({ hasText: '내 보관함에 저장했습니다.' })).toBeVisible();

  // 조건을 바꾸면 ‘다시 만들기 필요’ 표시
  await page.getByRole('list', { name: '진행 단계' }).getByRole('button', { name: /수업 조건/ }).click();
  await page.getByRole('radiogroup', { name: '읽기 수준' }).getByText('도전').click();
  await expect(page.getByRole('list', { name: '진행 단계' }).getByText('다시 만들기 필요')).toHaveCount(1);
  await page.getByRole('list', { name: '진행 단계' }).getByRole('button', { name: /읽기자료/ }).click();
  await page.getByRole('button', { name: '쉬운 버전으로' }).click();
  await expect(page.getByLabel('제목', { exact: true })).toHaveValue('(샘플) 영화의 구성 요소 읽기자료');

  // 보관함
  await page.getByRole('link', { name: '내 보관함' }).click();
  await expect(page.getByTestId('material-item')).toHaveCount(1);
  await expect(page.getByTestId('material-item')).toContainText('몽타주로 읽는 장면의 연결');
  await expect(page.getByTestId('material-item')).toContainText('검토함');
  await page.getByRole('button', { name: '복제' }).click();
  await expect(page.getByTestId('material-item')).toHaveCount(2);
  await shot(page, 'p4-03-library');
  await page.getByRole('link', { name: '몽타주로 읽는 장면의 연결' }).first().click();
  await page.getByLabel('제목', { exact: true }).fill('몽타주 읽기 (수정)');
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: '저장했습니다.' })).toBeVisible();
  await page.getByRole('link', { name: '← 내 보관함' }).click();
  await page.getByRole('button', { name: '삭제' }).first().click();
  await page.getByRole('button', { name: '삭제', exact: true }).first().click();
  await expect(page.getByTestId('material-item')).toHaveCount(1);
});
