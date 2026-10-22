# Firebase·실제 AI 연결 안내 (Phase 9)

선생님 Google 계정으로 한 번만 하면 됩니다. 화면 이름은 2026년 10월 기준이며, Firebase 콘솔이 바뀌면 이름이 조금 다를 수 있습니다.
결정 사항: **무료 등급(Spark 요금제)으로 시작**, 신용카드 필요 없음. 무료 등급으로 AI에 보낸 내용은 Google 제품 개선에 쓰일 수 있으므로 학생 개인정보는 넣지 않습니다(화면에도 안내).

준비물: 이 저장소를 받아 둔 컴퓨터, Node.js 20 이상

---

## 1. 프로젝트 만들기
1. https://console.firebase.google.com 에 선생님 Google 계정으로 들어갑니다.
2. **프로젝트 만들기** → 이름 입력(예: `film-reading-lesson`) → Google 애널리틱스는 꺼도 됩니다 → 만들기.
3. 요금제가 **Spark(무료)** 인지 확인합니다(왼쪽 아래).

## 2. 웹 앱 등록 → 설정값 4개
1. 프로젝트 개요 화면에서 **웹 아이콘(</>)** → 앱 닉네임 입력 → 등록(Firebase 호스팅은 체크하지 않음).
2. 화면에 나온 `firebaseConfig`에서 아래 4개를 복사합니다.
3. 저장소 폴더에 `.env.local` 파일을 만들고(이미 있으면 고치기) 다음처럼 적습니다. **이 파일은 GitHub에 올라가지 않습니다.**
   ```
   VITE_DATA_MODE=firebase
   VITE_AI_MODE=gemini
   VITE_FIREBASE_API_KEY=복사한 apiKey
   VITE_FIREBASE_AUTH_DOMAIN=복사한 authDomain
   VITE_FIREBASE_PROJECT_ID=복사한 projectId
   VITE_FIREBASE_APP_ID=복사한 appId
   VITE_RECAPTCHA_SITE_KEY=
   VITE_APPCHECK_DEBUG_TOKEN=
   ```
   (Firebase 웹 설정값은 비밀번호가 아니라 앱 주소 같은 값이라 화면 코드에 들어가도 됩니다. 접근 제어는 보안 규칙과 App Check가 합니다.)

## 3. 로그인 켜기
**빌드 → Authentication → 시작하기 → 로그인 방법 → 이메일/비밀번호 → 사용 설정 → 저장.**
(교사는 아이디로 로그인하지만, 앱이 내부적으로 `아이디@ttl-edu.local` 형태로 바꿔 씁니다. 메일은 보내지 않습니다.)

## 4. 데이터베이스 만들기
**빌드 → Firestore Database → 데이터베이스 만들기 → 위치: `asia-northeast3 (서울)` → 프로덕션 모드로 시작.**

## 5. 보안 규칙·인덱스 올리기
저장소 폴더에서 명령 프롬프트(또는 터미널)를 열고:
```
npx firebase-tools login
npx firebase-tools use --add          ← 목록에서 1단계 프로젝트를 고르고, 별칭은 default
npx firebase-tools deploy --only firestore:rules,firestore:indexes
```
`✔ Deploy complete!`가 나오면 됩니다.

## 6. AI 켜기 (Firebase AI Logic)
1. **빌드(또는 AI) → AI Logic → 시작하기 → Gemini Developer API** 를 고릅니다(무료 등급, 카드 불필요).
2. Firebase가 Gemini용 키를 알아서 만들고 관리합니다. **키를 복사해 앱이나 `.env.local`에 넣지 않습니다.**
3. 기본 모델은 `gemini-3.8-flash`입니다. 관리자 화면 › 사용 현황에서 바꿀 수 있습니다.

## 7. App Check (필수 — 2026-11-02부터 AI Logic에 필수)
다른 사이트가 우리 프로젝트의 AI를 몰래 쓰지 못하게 막습니다. Firebase 콘솔에 "2026년 11월 2일부터 Firebase AI Logic을 사용하려면 앱 체크 시행이 필수"라고 안내되어 있습니다.

### 7-1. 내 컴퓨터에서 개발할 때: 디버그 토큰
1. Firebase 콘솔 **App Check → 앱** 탭 → 웹 앱(Film-Reading) 줄 오른쪽 **⋮ 메뉴 → 디버그 토큰 관리 → 디버그 토큰 추가 → 생성**.
2. 이름(예: 집 PC)을 적고, 만들어진 값(긴 영문·숫자)을 복사해 저장합니다.
3. `.env.local`에 한 줄 추가: `VITE_APPCHECK_DEBUG_TOKEN=복사한 값`
4. 명령 프롬프트 창을 닫고 새로 열어 `npm run dev`.
- 이 값은 비밀번호처럼 다룹니다. 컴퓨터마다 따로 만들고, 쓰지 않는 값은 콘솔에서 지웁니다. `npm run dev`에서만 쓰이고 배포 빌드에는 들어가지 않습니다.

### 7-2. 배포할 때(Phase 10): reCAPTCHA v3
1. https://www.google.com/recaptcha/admin 에서 **reCAPTCHA v3(점수 기반)** 키 만들기 → 도메인에 배포 주소(`inbluewater-dev.github.io`) 추가 → **사이트 키**와 **비밀 키**.
2. Firebase 콘솔 **App Check → 앱 → 웹 앱 → reCAPTCHA** 에 비밀 키를 넣고 저장.
3. 배포용 설정에 `VITE_RECAPTCHA_SITE_KEY=사이트 키`.

### 7-3. 적용(Enforce)
App Check 화면에서 '확인된 요청'이 100%에 가까운지 본 뒤, **Firebase AI Logic**(그리고 Cloud Firestore)을 '적용됨'으로 바꿉니다.

## 8. 가입 코드 만들기
**Firestore Database → 컬렉션 시작 → 컬렉션 ID `appConfig` → 문서 ID `signup` → 필드 `inviteCode`(문자열) = 원하는 가입 코드(공백 없이 4~32자).**
가입 코드는 선생님들께만 알려 주세요(교사 화면에서는 읽을 수 없습니다).

## 9. 첫 관리자 만들기
1. 저장소 폴더에서 `npm install` → `npm run dev` → 화면에 나온 주소(http://localhost:5173)를 엽니다. 화면 위에 ‘로컬 테스트 모드’ 띠가 **없으면** Firebase 모드입니다.
2. **가입 신청**에서 8단계 가입 코드로 관리자로 쓸 아이디를 만듭니다 → ‘승인 대기’ 화면이 나옵니다.
3. Firebase 콘솔 **Firestore → users → 방금 만든 문서**를 열어 세 필드를 고칩니다: `role` = `admin`, `active` = `true`(불리언), `status` = `approved`.
4. 화면을 새로 고치면 관리자 메뉴가 보입니다.

## 10. 확인
- 관리자 › 계정에서 교사 계정을 하나 만들고, 그 계정으로 **수업 만들기 → 읽기자료 만들기**를 눌러 봅니다. 샘플 대신 실제 글이 나오면 성공입니다.
- 관리자 › 사용 현황에 사용 횟수가 쌓이는지, 하루 한도(기본 20회)가 맞는지 봅니다.
- 문제가 생기면 화면의 오류 문장을 그대로 알려 주세요.

## 11. (선택) 보안 규칙 테스트
Java 21 이상을 설치한 뒤 `npm run test:rules`. 모든 항목이 통과해야 합니다.

---
다음 단계(Phase 10): GitHub Pages로 배포하고, 배포 주소를 Authentication › 설정 › 승인된 도메인과 reCAPTCHA 도메인에 추가합니다.
