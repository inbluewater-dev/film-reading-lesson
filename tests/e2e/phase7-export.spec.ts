import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { loginTeacher, makeMaterial, shot } from './helpers';

test('5단계 내보내기: 미리보기, DOCX·HWPX 받기, 읽기자료·활동지 선택', async ({ page }) => {
  await loginTeacher(page);
  await makeMaterial(page, [/\[12영이01-03\]/]);
  await page.getByLabel('단어의 나무').check();
  await page.getByRole('button', { name: /지도안 만들기/ }).click();
  await page.getByRole('button', { name: '수업지도안 만들기' }).click();
  await page.getByRole('button', { name: '저장하고 내보내기' }).click();

  await expect(page.getByText('아직 ‘검토함’ 표시가 없는 지도안입니다.')).toBeVisible();
  const preview = page.frameLocator('iframe[title="내보내기 미리보기"]');
  await expect(preview.getByRole('heading', { name: '(샘플) 영화의 특성 읽기자료 수업지도안' })).toBeVisible();
  await expect(preview.getByRole('cell', { name: '1. 주의집중' })).toBeVisible();
  await expect(preview.getByRole('heading', { name: /^활동지/ })).toBeVisible();
  await expect(preview.getByRole('heading', { name: '낱말 풀이' })).toBeVisible(); // 읽기자료 포함
  await shot(page, 'p7-01-export');

  await page.getByLabel('읽기자료').uncheck();
  await expect(preview.getByRole('heading', { name: '낱말 풀이' })).toHaveCount(0);
  await page.getByLabel('활동지').uncheck();
  await expect(preview.getByRole('heading', { name: /^활동지/ })).toHaveCount(0);
  await page.getByLabel('읽기자료').check();

  const [docx] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'DOCX(워드) 받기' }).click()]);
  expect(docx.suggestedFilename()).toBe('(샘플) 영화의 특성 읽기자료 수업지도안.docx');
  const docxBytes = readFileSync((await docx.path())!);
  expect(docxBytes.subarray(0, 2).toString()).toBe('PK');
  await expect(page.getByText('DOCX(워드) 파일을 저장했습니다.')).toBeVisible();

  const [hwpx] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'HWPX(한글) 받기' }).click()]);
  expect(hwpx.suggestedFilename()).toMatch(/\.hwpx$/);
  const hwpxBytes = readFileSync((await hwpx.path())!);
  expect(hwpxBytes.subarray(30, 38).toString()).toBe('mimetype');
  await expect(page.getByRole('button', { name: '인쇄 · PDF로 저장' })).toBeVisible();
});

test('보관함의 지도안에서도 내보내기', async ({ page }) => {
  await loginTeacher(page);
  await makeMaterial(page, [/\[12영이01-03\]/]);
  await page.getByLabel('단어의 나무').check();
  await page.getByRole('button', { name: /지도안 만들기/ }).click();
  await page.getByRole('button', { name: '수업지도안 만들기' }).click();
  await expect(page.getByText('지도안을 만들어 내 보관함에 저장했습니다.')).toBeVisible();
  await page.getByRole('link', { name: '내 보관함', exact: true }).click();
  await page.getByRole('tab', { name: '수업지도안' }).click();
  await page.getByTestId('lessonPlans-item').getByRole('link').click();
  await page.getByRole('button', { name: '내보내기 (인쇄·PDF·워드·한글)' }).click();
  const [hwpx] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'HWPX(한글) 받기' }).click()]);
  expect(hwpx.suggestedFilename()).toMatch(/수업지도안\.hwpx$/);
});
