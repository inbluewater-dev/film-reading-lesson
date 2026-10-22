# 영화 수업 설계 도우미

고등학교 영화 교과 교사가 **교육과정(과목 → 영역 → 핵심 아이디어·내용 요소·성취기준)** 에서 출발해
① 읽기자료를 만들고 ② 독서전략을 추천받고 ③ 가네의 9가지 수업사태에 맞춘 수업지도안을 작성하는 웹 시스템입니다.

- 대상 과목: <영화의 이해>, <영화 감상과 비평>(진로 선택), <영화와 삶>(융합 선택)
- 출처: 교육부 고시 제2022-33호 [별책 22] 예술 계열 선택 교과 교육과정
- 명세: [`docs/GUIDE_독서전략기반_수업설계시스템.md`](docs/GUIDE_독서전략기반_수업설계시스템.md)

## 실행 방법 (내 컴퓨터에서)

1. [Node.js](https://nodejs.org/) LTS 버전 설치
2. 이 저장소를 내려받은 폴더에서:
   ```bash
   npm install
   npm run compile:data   # TTL → JSON 변환
   npm run dev            # http://localhost:5173 에서 열기
   ```

## 로컬 모드 테스트 계정

로컬 모드(`VITE_DATA_MODE=local`)에서는 처음 열 때 아래 계정이 자동으로 만들어집니다. **실서비스(Firebase)에서는 절대 같은 비밀번호를 쓰지 마세요.**

| 아이디 | 비밀번호 | 역할 |
|---|---|---|
| `admin01` | `admin1234` | 관리자 |
| `teacher01` | `teacher1234` | 교사 |

- 가입 코드: `film2026` (관리자 화면에서 변경 가능)
- 데이터는 브라우저(localStorage)에만 저장됩니다. 초기화하려면 브라우저 개발자 도구에서 `frl:local:v1` 항목을 지우세요.

## 실행 모드

`.env.example`을 복사해 `.env.local`을 만들고 값을 바꿉니다.

| 설정 | 값 | 설명 |
|---|---|---|
| `VITE_DATA_MODE` | `local` (기본) | 브라우저 안 임시 저장소. 인터넷·Firebase 없이 개발·테스트 |
| | `firebase` | 실서비스. Firebase 설정값 필요 — [docs/SETUP_Firebase.md](docs/SETUP_Firebase.md) |
| `VITE_AI_MODE` | `mock` (기본) | 고정 샘플 응답. 인터넷 불필요 |
| | `gemini` | 실제 AI 생성 (Firebase AI Logic + Gemini 무료 등급, `firebase` 모드에서만) |

## 내보내기 (인쇄·PDF, DOCX, HWPX)

- 수업 만들기 5단계 또는 내 보관함의 지도안에서 내보냅니다. 읽기자료·활동지를 함께 담을지 고를 수 있습니다.
- **인쇄·PDF**: A4 인쇄 화면이 열리면 ‘PDF로 저장’을 고릅니다.
- **DOCX**: 맑은 고딕, 표 병합 유지. 워드·한컴오피스·구글 문서에서 열립니다.
- **HWPX**: 한글 2014 이후에서 열리는 공개 형식(OWPML). 구형 .hwp는 만들지 않습니다. 뼈대 출처는 `src/lib/export/hwpx-template/NOTICE.md`.
- 점검: `npm test`가 `test-output/export/`에 예시 파일을 만듭니다. `python scripts/check-hwpx.py`(python-hwpx 필요)로 구조를 검사할 수 있고, 최종 확인은 워드·한글에서 직접 엽니다.

## 관리자 기능

관리자 계정으로 로그인하면 ‘관리자’ 메뉴에서 다음을 합니다.

| 탭 | 하는 일 |
|---|---|
| 계정 | 가입 신청 승인·거절, 사용 중지, 계정 직접 만들기(한 명·CSV), 비밀번호 재설정(로컬 모드), 가입 코드 |
| 교육과정 연결 | 성취기준별 독서 기능·내용 요소 연결, 동사 매핑 사전, 읽기 전·중·후 분류 |
| 독서전략 | 실행 절차·적합 텍스트 유형·권장 사태·권장 시간·활동지 형태·검수 상태 |
| TTL 버전 | TTL 올리기 → 검증 리포트 → 변경 미리보기 → 새 버전 게시, 이전 버전으로 되돌리기, TTL 내려받기(zip), 관리자 설정 JSON 백업·복원 |
| 프롬프트 | AI 지시문 버전 관리, 테스트 실행 |
| 사용 현황 | 교사별·날짜별 AI 생성 횟수, 하루 한도 |

- 바꾼 내용은 교사 화면에 바로 반영됩니다(다른 브라우저의 교사는 새로 고침 후).
- TTL 내려받기: ‘사용 중’ 버전은 관리자가 입력한 독서 기능·내용 요소 연결과 전략 보완이 TTL에 들어갑니다. 동사 매핑·읽기 단계는 가이드에 TTL 속성이 정해져 있지 않아 함께 들어 있는 `관리자설정.json`에 담깁니다.
- **Firebase 모드 비밀번호 재설정**: 화면에서 남의 비밀번호를 바꿀 수 없으므로 관리자 PC에서 `tools/admin-cli.mjs`를 씁니다.
  ```
  npm install --no-save firebase-admin
  set GOOGLE_APPLICATION_CREDENTIALS=C:\경로\service-account.json
  node tools/admin-cli.mjs reset-password <아이디> <새 비밀번호>
  ```
  서비스 계정 키 파일은 절대 저장소에 올리지 않습니다.

## 명령어

| 명령 | 내용 |
|---|---|
| `npm run compile:data` | `data/ttl/original/*.ttl` → `data/compiled/*.json` (스키마 검증 포함, `npm run dev`·`build` 때 자동 실행) |
| `npm run report:ttl` | TTL 점검 리포트 생성 → `docs/reports/ttl-analysis.md` |
| `npm test` | 단위 테스트 (Vitest) |
| `npm run test:e2e` | 화면 테스트 (Playwright) |
| `npm run test:rules` | Firestore 보안 규칙 테스트 — **Java 필요**, Firebase 에뮬레이터를 자동으로 띄워 실행 |
| `npm run build` | 배포용 빌드 |

## 폴더 구조

```
data/ttl/original/   원본 TTL 4개 (수정 금지)
data/ttl/working/    보완·확장 작업본
data/compiled/       변환된 JSON
scripts/             TTL 변환·리포트 스크립트
src/lib/data/        로그인·저장소 어댑터 (로컬 / Firebase), 권한 정책(policy.ts)
firebase/            Firestore 보안 규칙(firestore.rules)·인덱스 — policy.ts와 같은 규칙
src/lib/ai/          AI 어댑터 (Mock / Gemini)
src/features/        화면 기능별 코드
tests/               unit / e2e
docs/                명세서, 리포트
```
