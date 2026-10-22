# 배포 안내 (Phase 10) — GitHub Pages

배포 주소: **https://inbluewater-dev.github.io/film-reading-lesson/**
main 브랜치에 코드가 들어오면 GitHub가 자동으로 테스트 → 빌드 → 배포합니다(`.github/workflows/deploy.yml`).

## 1. Fraud Defense(이전 reCAPTCHA Enterprise) 키 만들기 (App Check용)
reCAPTCHA 클래식(v3)은 지원이 중단되어 Firebase가 Fraud Defense를 쓰라고 안내합니다. Spark(무료) 요금제에서도 쓸 수 있습니다.
1. https://console.cloud.google.com/security/recaptcha 에 Firebase와 같은 Google 계정으로 들어갑니다.
2. 위쪽 프로젝트 선택에서 **film-reading-lesson**을 고릅니다. 'API 사용 설정(Enable)'이 나오면 누릅니다.
3. **키 만들기(Create key)** → 이름: `film-reading-web`, 플랫폼 유형: **웹(Website)**.
4. 도메인 목록에 `inbluewater-dev.github.io` 를 추가합니다. **`localhost`는 넣지 않습니다**(내 컴퓨터는 디버그 토큰 사용).
5. **체크박스 문제 사용(Use checkbox challenge)은 끈 채로**(점수 기반) 두고 만들기.
6. 만들어진 **키 ID**(긴 영문·숫자)를 복사합니다. 이것이 사이트 키입니다.

## 2. Firebase App Check에 등록
Firebase 콘솔 **App Check → 앱 → Film-Reading(웹)** → **Fraud Defense(이전 명칭: reCAPTCHA Enterprise)** 를 펼침 → 1단계 **키 ID** 붙여 넣기 → 저장.
- 그 아래 'reCAPTCHA'(클래식) 칸은 비워 둡니다.
- 위험 기준(threshold)은 기본값 0.5 그대로.

## 3. Firebase 로그인에 배포 주소 허용
Firebase 콘솔 **Authentication → 설정 → 승인된 도메인 → 도메인 추가** → `inbluewater-dev.github.io`.

## 4. GitHub 저장소 설정
1. 저장소 **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. 저장소 **Settings → Secrets and variables → Actions → New repository secret** 으로 다섯 개를 넣습니다(이름은 정확히, 값은 `.env.local`과 같음):
   | 이름 | 값 |
   |---|---|
   | `VITE_FIREBASE_API_KEY` | `.env.local`의 같은 줄 값 |
   | `VITE_FIREBASE_AUTH_DOMAIN` | 〃 |
   | `VITE_FIREBASE_PROJECT_ID` | 〃 |
   | `VITE_FIREBASE_APP_ID` | 〃 |
   | `VITE_RECAPTCHA_SITE_KEY` | 1단계의 **키 ID** |
   - `VITE_APPCHECK_DEBUG_TOKEN`은 **넣지 않습니다**(내 컴퓨터 전용).

## 5. 배포하기
- 배포용 PR을 Merge하면 자동으로 시작됩니다. 이미 Merge했다면 **Actions → 배포 (GitHub Pages) → Run workflow**.
- Actions 화면에서 초록색 체크가 뜨면 배포 주소를 엽니다(처음엔 1~2분 걸릴 수 있음).

## 6. 확인 → App Check 적용
1. 배포 주소에서 로그인 → 수업 만들기 → 읽기자료 만들기가 되는지 확인.
2. Firebase 콘솔 **App Check → API** 에서 Firebase AI Logic의 '확인된 요청'이 올라가는지 확인.
3. 확인되면 **Firebase AI Logic**과 **Cloud Firestore**를 **적용됨**으로 바꿉니다(내 컴퓨터는 디버그 토큰이 있어 계속 됩니다).

## 문제가 생기면
- Actions가 빨간 X: 클릭해서 빨간 줄의 문장을 Claude에게 보여 주세요. "Secrets에 다음 값을 넣어 주세요"면 4-2단계를 확인.
- 배포 주소에서 로그인 오류(auth/unauthorized-domain): 3단계 확인.
- AI에서 App Check 오류: 1~2단계와 Secrets의 사이트 키 확인.

## 7. Firebase 호스팅 (두 번째 주소: https://film-reading-lesson.web.app)
GitHub Pages와 **같은 코드가 함께** 올라갑니다. 처음 한 번만 설정합니다.

1. **Fraud Defense 키에 도메인 추가**: https://console.cloud.google.com/security/recaptcha?project=film-reading-lesson → `film-reading-web` 키 → 수정 → 도메인에 `film-reading-lesson.web.app`, `film-reading-lesson.firebaseapp.com` 추가 → 저장.
   (로그인 승인된 도메인에는 두 주소가 처음부터 들어 있어 따로 할 일 없음)
2. **호스팅 시작**: Firebase 콘솔 **Hosting → 시작하기** → 안내 화면은 '다음'으로 넘기고 마지막에 '콘솔로 이동'(명령은 실행하지 않아도 됨).
3. **자동 배포용 열쇠(서비스 계정) 만들기**: 최신 코드를 받은 폴더에서
   ```
   npx firebase-tools init hosting:github
   ```
   - 저장소를 물으면 `inbluewater-dev/film-reading-lesson`
   - 브라우저가 열리면 GitHub 로그인·허용
   - "Uploaded service account JSON to GitHub as secret **FIREBASE_SERVICE_ACCOUNT_FILM_READING_LESSON**" 이 나오면 성공 (이름이 다르면 Claude에게 알려 주기)
   - 이어서 나오는 질문(build script, automatic deployment)은 모두 **N** — 배포 설정은 이미 저장소에 있음
   - 폴더에 `firebase-hosting-pull-request.yml` 같은 파일이 새로 생겨도 그냥 두면 됩니다(GitHub에 올리지 않음)
4. GitHub **Actions → 배포 → Run workflow**. 'firebase-hosting'까지 초록색이면 https://film-reading-lesson.web.app 에서 확인.

### (선택) 내 컴퓨터에서 바로 올리기
`.env.local`에 `VITE_RECAPTCHA_SITE_KEY=키 ID`를 넣은 뒤 `npx firebase-tools deploy --only hosting` (빌드는 자동).
