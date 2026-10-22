# 배포 안내 (Phase 10) — GitHub Pages

배포 주소: **https://inbluewater-dev.github.io/film-reading-lesson/**
main 브랜치에 코드가 들어오면 GitHub가 자동으로 테스트 → 빌드 → 배포합니다(`.github/workflows/deploy.yml`).

## 1. reCAPTCHA v3 키 만들기 (App Check용, 무료)
1. https://www.google.com/recaptcha/admin/create 에 Firebase와 같은 Google 계정으로 들어갑니다.
2. 라벨: `film-reading-lesson`, 유형: **점수 기반(v3)**.
3. 도메인: `inbluewater-dev.github.io` (그리고 `localhost`).
4. 제출하면 **사이트 키**와 **비밀 키**가 나옵니다. 둘 다 복사해 둡니다.
   - 화면이 Google Cloud 콘솔로 넘어가 'reCAPTCHA 키 만들기'가 나오면, 같은 프로젝트(film-reading-lesson)를 고르고 웹 사이트용 키를 만들면 됩니다. 이 경우 비밀 키 대신 다른 안내가 나오면 화면을 캡처해 Claude에게 보여 주세요.

## 2. Firebase App Check에 등록
Firebase 콘솔 **App Check → 앱 → Film-Reading(웹) → reCAPTCHA** → **비밀 키** 붙여 넣기 → 저장.

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
   | `VITE_RECAPTCHA_SITE_KEY` | 1단계의 **사이트 키**(비밀 키 아님) |
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
