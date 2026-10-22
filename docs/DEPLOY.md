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
