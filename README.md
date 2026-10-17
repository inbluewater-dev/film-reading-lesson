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
| | `firebase` | 실서비스. Firebase 설정값 필요 (Phase 9~10) |
| `VITE_AI_MODE` | `mock` (기본) | 고정 샘플 응답. 인터넷 불필요 |
| | `gemini` | 실제 AI 생성 (Phase 9) |

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
