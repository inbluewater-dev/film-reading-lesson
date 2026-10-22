import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { login, loginTeacher, makeMaterial, shot } from './helpers';

const logout = (page: Page) => page.getByRole('button', { name: '로그아웃' }).click();
async function loginAdmin(page: Page) {
  await login(page, 'admin01', 'admin1234');
  await expect(page).toHaveURL(/#\/admin$/);
}
const adminTab = (page: Page, name: string) => page.getByRole('navigation', { name: '관리자 메뉴' }).getByRole('link', { name }).click();

test('동사 매핑을 넣으면 그 동사의 성취기준 전략 추천에 바로 반영된다', async ({ page }) => {
  await loginAdmin(page);
  await adminTab(page, '교육과정 연결');
  await expect(page.getByRole('heading', { name: /성취기준별 독서 기능/ })).toContainText('미지정 22개');
  const row = page.getByTestId('verb-탐구하다');
  await expect(row).toContainText('성취기준 18개');
  await row.getByRole('group', { name: '탐구하다 독서 기능' }).getByText('탐색', { exact: true }).click();
  await row.getByRole('button', { name: '“탐구하다” 저장' }).click();
  await expect(page.getByText('“탐구하다” 매핑을 저장했습니다.')).toBeVisible();
  await expect(page.getByRole('heading', { name: /성취기준별 독서 기능/ })).toContainText('미지정 4개');
  await shot(page, 'p8-01-verb-mapping');
  await logout(page);

  await loginTeacher(page);
  await makeMaterial(page, [/\[12영감01-01\]/]);
  await expect(page.getByText('(동사 매핑)')).toBeVisible();
  await expect(page.getByText('고른 성취기준에서 독서 기능을 정하지 못했습니다.')).toHaveCount(0);
  await expect(page.getByTestId('strategy-candidate')).toHaveCount(5);
});

test('성취기준 독서 기능 지정·전략 보완이 교사 화면에 반영된다', async ({ page }) => {
  await loginAdmin(page);
  await adminTab(page, '교육과정 연결');
  const std = page.getByTestId('std-[12영감01-01]');
  await std.getByRole('button', { name: '연결 편집' }).click();
  await std.getByRole('group', { name: '[12영감01-01] 독서 기능' }).getByText('평가', { exact: true }).click();
  await std.getByRole('button', { name: '저장' }).click();
  await expect(page.getByText('[12영감01-01] 연결을 저장했습니다.')).toBeVisible();

  await adminTab(page, '독서전략');
  await page.getByRole('button', { name: '오류 찾기' }).click();
  await page.getByLabel(/실행 절차/).fill('오류가 섞인 글을 읽는다\n오류를 찾아 표시한다\n근거를 들어 바로잡는다');
  await page.getByLabel('6. 학생 수행 요구').check();
  await page.getByLabel('권장 시간(분)').fill('15');
  await page.getByLabel('검수 완료').check();
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page.getByText(/「오류 찾기」을\(를\) 저장했습니다/)).toBeVisible();
  await shot(page, 'p8-02-strategy-editor');
  await logout(page);

  await loginTeacher(page);
  await makeMaterial(page, [/\[12영감01-01\]/]);
  await expect(page.getByText('(관리자 지정)')).toBeVisible();
  const cand = page.getByTestId('strategy-candidate').filter({ hasText: '오류 찾기' });
  await cand.getByRole('button', { name: '자세히' }).click();
  await expect(cand.getByText('근거를 들어 바로잡는다')).toBeVisible();
  await expect(cand.getByText('검수 완료', { exact: true })).toBeVisible();
  // 지도안에서 권장 사태 6에 배치
  await cand.getByRole('checkbox').check();
  await page.getByRole('button', { name: /지도안 만들기/ }).click();
  await page.getByRole('button', { name: '수업지도안 만들기' }).click();
  await expect(page.getByRole('row', { name: /6\. 학생 수행 요구/ })).toContainText('오류 찾기');
});

test('TTL 올리기 → 검증·변경 미리보기 → 게시 → 교사 화면 반영 → 되돌리기, TTL 내려받기', async ({ page }) => {
  const sources = JSON.parse(readFileSync('data/compiled/sources.json', 'utf-8')) as Record<string, string>;
  const original = '다양한 측면에서 영화를 탐구하고 정의함으로써 영화의 의미를 탐색한다.';
  const edited = sources.curriculum.replace(original, '여러 측면에서 영화를 탐구하고 정의하여 영화의 의미를 탐색한다.');
  await loginAdmin(page);
  await adminTab(page, 'TTL 버전');
  // 깨진 파일은 게시할 수 없다
  await page.getByLabel('가네 9사태 (가네.ttl) 파일').setInputFiles({ name: '가네.ttl', mimeType: 'text/turtle', buffer: Buffer.from('@@ 깨진 TTL') });
  await page.getByRole('button', { name: '검증하고 변경 미리보기' }).click();
  await expect(page.getByLabel('검증 결과')).toContainText('문법 오류');
  await expect(page.getByRole('button', { name: '새 버전으로 게시' })).toHaveCount(0);
  await page.getByLabel('가네 9사태 (가네.ttl) 파일').setInputFiles([]);

  await page.getByLabel('교육과정 (영화과.ttl) 파일').setInputFiles({ name: '영화과.ttl', mimeType: 'text/turtle', buffer: Buffer.from(edited) });
  await page.getByRole('button', { name: '검증하고 변경 미리보기' }).click();
  const result = page.getByLabel('검증 결과');
  await expect(result).toContainText('영화과.ttl: 861 triples');
  await expect(result).toContainText('수정 1');
  await expect(result).toContainText('성취기준 원문');
  await page.getByLabel('버전 메모').fill('12영이01-01 문구 시험 수정');
  await shot(page, 'p8-03-ttl-diff');
  await page.getByRole('button', { name: '새 버전으로 게시' }).click();
  await expect(page.getByText(/새 버전\(.+\)을 게시했습니다/)).toBeVisible();
  await expect(page.getByTestId('ontology-version').first()).toContainText('사용 중');

  const [zip] = await Promise.all([page.waitForEvent('download'), page.getByTestId('ontology-version').first().getByRole('button', { name: 'TTL 내려받기' }).click()]);
  expect(zip.suggestedFilename()).toMatch(/^영화교과-TTL-[0-9a-f]{12}\.zip$/);
  await logout(page);

  await loginTeacher(page);
  await page.getByRole('link', { name: '교육과정 탐색' }).click();
  await page.getByRole('navigation', { name: '과목' }).getByRole('button', { name: /영화의 이해/ }).click();
  await page.getByRole('searchbox').fill('12영이01-01');
  await expect(page.getByText('여러 측면에서 영화를 탐구하고 정의하여 영화의 의미를 탐색한다.').first()).toBeVisible();
  await logout(page);

  await loginAdmin(page);
  await adminTab(page, 'TTL 버전');
  const bundled = page.getByTestId('ontology-version').filter({ hasText: '기본 데이터' });
  await bundled.getByRole('button', { name: '이 버전으로 되돌리기' }).click();
  await bundled.getByRole('button', { name: '바꾸기' }).click();
  await expect(page.getByText('기본(앱에 묶인) 데이터로 되돌렸습니다.')).toBeVisible();
  await logout(page);
  await loginTeacher(page);
  await page.getByRole('link', { name: '교육과정 탐색' }).click();
  await page.getByRole('navigation', { name: '과목' }).getByRole('button', { name: /영화의 이해/ }).click();
  await page.getByRole('searchbox').fill('12영이01-01');
  await expect(page.getByText(original).first()).toBeVisible();
});

test('계정 직접 발급(단건·CSV)과 비밀번호 재설정', async ({ page }) => {
  await loginAdmin(page);
  await page.getByLabel('아이디', { exact: true }).fill('parkfilm');
  await page.getByLabel('표시 이름', { exact: true }).fill('박영화 선생님');
  await page.getByLabel('임시 비밀번호', { exact: true }).fill('temp12345');
  await page.getByRole('button', { name: '계정 만들기' }).click();
  await expect(page.getByText('박영화 선생님(parkfilm) 계정을 만들었습니다.', { exact: false })).toBeVisible();
  await page.getByLabel(/한 줄에 한 명씩/).fill('아이디,표시 이름,임시 비밀번호\nchoifilm,최영화 선생님,temp12345\nparkfilm,중복,temp12345');
  await page.getByRole('button', { name: '2명 만들기' }).click();
  const results = page.getByRole('list', { name: 'CSV 결과' });
  await expect(results).toContainText('choifilm: 만듦');
  await expect(results).toContainText('parkfilm: 이미 사용 중인 아이디입니다');
  await expect(page.getByTestId('user-choifilm')).toContainText('사용 중');
  const row = page.getByTestId('user-choifilm');
  await row.getByRole('button', { name: '비밀번호 재설정' }).click();
  await row.getByLabel('choifilm 새 비밀번호').fill('reset5678');
  await row.getByRole('button', { name: '바꾸기' }).click();
  await expect(page.getByText('최영화 선생님(choifilm)의 비밀번호를 바꿨습니다.', { exact: false })).toBeVisible();
  await shot(page, 'p8-04-accounts');
  await logout(page);
  await login(page, 'choifilm', 'reset5678');
  await expect(page).toHaveURL(/#\/teacher$/);
});

test('하루 한도·사용 현황, 프롬프트 새 버전·테스트 실행', async ({ page }) => {
  await loginAdmin(page);
  await adminTab(page, '사용 현황');
  await page.getByLabel('하루 횟수').fill('1');
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page.getByText('교사 1명당 하루 1회로 정했습니다.')).toBeVisible();

  await adminTab(page, '프롬프트');
  const box = page.getByLabel('읽기자료 생성 프롬프트');
  await box.fill((await box.inputValue()) + '\n[추가] 문단마다 소제목을 붙인다.');
  await page.getByRole('button', { name: '새 버전으로 저장' }).click();
  await expect(page.getByText('v2으로 저장했습니다.')).toBeVisible();
  await page.getByRole('button', { name: '테스트 실행 (Mock)' }).click();
  await expect(page.getByTestId('rendered-prompt')).toContainText('[12영이01-01]');
  await expect(page.getByTestId('rendered-prompt')).toContainText('[추가] 문단마다 소제목을 붙인다.');
  await shot(page, 'p8-05-prompts');
  await logout(page);

  await loginTeacher(page);
  await expect(page.getByTestId('usage-today')).toHaveText('오늘 AI 사용 0회 / 하루 1회까지');
  await makeMaterial(page, [/\[12영이01-03\]/]); // 읽기자료 1회 사용
  // 전략 추천 이유는 한도에 걸려도 화면이 멈추지 않는다(일치 근거로 대신 표시)
  await expect(page.getByTestId('strategy-candidate')).toHaveCount(5);
  await page.getByRole('list', { name: '진행 단계' }).getByRole('button', { name: /수업 조건/ }).click();
  await page.getByRole('button', { name: '이 조건으로 읽기자료 다시 만들기' }).click();
  await expect(page.getByRole('alert')).toContainText('오늘 AI 생성 한도(1회)를 모두 썼습니다.');
  await logout(page);

  await loginAdmin(page);
  await adminTab(page, '사용 현황');
  await expect(page.getByTestId('usage-row').first()).toContainText('김영화 선생님');
});
