# 교과 연계 읽기자료 · 독서전략 · 수업지도안 생성 시스템 — 개발 가이드

> **용도**: Google Antigravity 2.0에 이 파일과 TTL 4개를 함께 제공하여 바이브 코딩을 진행하기 위한 마스터 지침서
> **대상 사용자**: 고등학교 영화 교과 교사 — 이론·감상 3과목(<영화의 이해>, <영화 감상과 비평>, <영화와 삶>)으로 시작, 이후 실습 3과목·타 교과로 확장
> **원칙**: 오프라인(로컬)에서 먼저 완성·테스트 → GitHub 업로드 → Firebase 연결 배포
> **개정 이력**: v1(중학교 사회·과학 대상) → v2(2026-10-17, 고등학교 영화 3과목 대상, 성취기준 포함 TTL 반영) → **v2.1(2026-10-17, §15 열린 질문 결정 반영)**. v1 원본은 `GUIDE_독서전략기반_수업설계시스템_v1_사회과학.md`로 보관

---

## 0. 에이전트(Antigravity)에게 주는 최우선 지침

1. 이 문서를 먼저 끝까지 읽고, **코드를 작성하기 전에 구현 계획(Plan)을 먼저 제출**할 것.
2. 작업은 **§12 개발 단계(Phase)** 순서대로 진행하고, 각 Phase 끝에 **완료 기준(Acceptance Criteria)** 을 스스로 점검한 결과를 보고할 것.
3. 불확실한 부분은 임의로 가정하지 말고 **§15 열린 질문**에 해당하면 사용자에게 질문할 것.
4. **교육과정 내용(성취기준 문구, 해설, 내용 요소 등)을 기억에 의존해 생성·창작하지 말 것.** 반드시 업로드된 TTL(`영화과.ttl`에 성취기준·해설·적용 시 고려 사항까지 원문 그대로 수록됨) 또는 사용자가 제공한 원문만 사용한다. (§3의 “현재 TTL의 한계” 참조)
5. 모든 UI 문구는 **한국어**, 코드 주석은 한국어 또는 영어 중 하나로 일관되게 작성.
6. API 키·비밀번호·서비스 계정 키를 **절대 저장소에 커밋하지 말 것** (`.env.local`, `.gitignore` 사용).
7. 에이전트가 만든 결과물(스크린샷, 테스트 결과)은 Artifact로 남겨 사용자가 검토할 수 있게 할 것.

---

## 1. 프로젝트 개요

### 1.1 한 줄 정의
교사가 **교육과정(과목→영역→핵심 아이디어·내용 요소·성취기준)** 에서 출발점을 고르면, 시스템이
① 수업에 적합한 **읽기자료**를 생성하고 → ② 그 자료·목표에 맞는 **독서전략**을 추천하며 → ③ 선택한 독서전략을 **가네의 9가지 수업사태**에 배치한 **수업지도안**을 작성해 주는 웹 시스템.

### 1.2 핵심 사용자 흐름 (교사 모드)

```
[로그인] → [과목 선택] → [교육과정 탐색: 영역/핵심아이디어/내용요소/성취기준(해설 포함)]
   → [수업 조건 입력: 대상 학년(1~3, 참고용), 차시 시간(50분 / 블록 100분), 학생 수준, 텍스트 유형, 다룰 영화]
   → [① 읽기자료 생성·편집·저장]
   → [② 독서전략 추천·선택]   (읽기 기능 ↔ 전략, 텍스트 유형 ↔ 전략)
   → [③ 수업지도안 생성(가네 9사태에 전략 배치)·편집·저장]
   → [내보내기: 인쇄/PDF, DOCX, HWPX(한글)]
   → [공유 보관함에 게시(선택) / 다른 교사 자료 복제]
```

### 1.3 사용자 역할
| 역할 | 인증 방식 | 주요 권한 |
|---|---|---|
| 관리자(admin) | 관리자 ID/비밀번호 | 교사 계정 관리, TTL 업로드·수정·버전 관리, 과목 추가, 전체 통계, 프롬프트 템플릿 관리 |
| 일반 교사(teacher) | **ID + 비밀번호만** (가입 코드로 직접 가입 → 관리자 승인 후 사용) | 교육과정 탐색, 자료·지도안 생성, 본인 결과물 저장·조회·삭제, 공유 보관함 게시·열람·복제 |

### 1.4 대상 과목 (v2)
| 과목 | 교육과정 구분 | 영역 | 성취기준 |
|---|---|---|---|
| 영화의 이해 | 진로 선택 과목 | 영화의 특성 / 영화의 구성 요소 / 영화의 역사 | 15 |
| 영화 감상과 비평 | 진로 선택 과목 | 감상과 비평의 이해 / 감상과 비평의 실제 | 9 |
| 영화와 삶 | 융합 선택 과목 | 영화로 표현하기 / 영화로 세상읽기 / 영화로 탐색하기 | 8 |

- 출처: 교육부 고시 제2022-33호 [별책 22] 예술 계열 선택 교과 교육과정 — [영화]
- 다음 확장 후보: 실습 3과목(<촬영·조명>, <편집·사운드>, <영화 제작 실습>) — 실습 중심이라 읽기자료 기반 흐름과의 적합성 검토 후 추가

---

## 2. 기술 스택 (권장 — 에이전트가 근거를 들어 변경 제안 가능)

| 영역 | 선택 | 이유 |
|---|---|---|
| 프론트엔드 | **React + TypeScript + Vite** | 정적 빌드 → GitHub Pages 배포 용이 |
| 라우팅 | **HashRouter** (`/#/path`) | GitHub Pages는 새로고침 시 404 → 해시 라우팅으로 회피 |
| 스타일 | Tailwind CSS (또는 CSS Modules) | 빠른 UI 구현 |
| 인증 | **Firebase Authentication (이메일/비밀번호)** | §6 “ID를 가짜 이메일로 변환” 방식 |
| DB | **Cloud Firestore** | 사용자 요청 사항 |
| TTL 파싱 | **N3.js** (브라우저/Node 모두 가능) | 클라이언트에서 관리자 TTL 업로드 파싱 |
| AI 생성 | **Gemini API** (§8 참조) + **Mock 어댑터** | 오프라인 테스트와 실서비스 전환을 동일 인터페이스로 |
| 내보내기 | `docx`(DOCX), 브라우저 인쇄 CSS(PDF) | 서버 없이 클라이언트에서 처리 |
| 로컬 테스트 | **Firebase Emulator Suite** (Auth, Firestore) | 인터넷 없이 전체 흐름 검증 |
| 테스트 | Vitest(단위), Playwright(E2E) | 에이전트가 브라우저로 자체 검증하기 좋음 |
| 배포 | GitHub Actions → GitHub Pages | 프론트만 GitHub, 백엔드는 Firebase |

> **중요**: GitHub Pages는 **정적 호스팅**이므로 서버 코드가 없다. 모든 보안은 **Firebase Security Rules**로 처리한다. 프론트에 노출되는 Firebase 설정값(apiKey 등)은 비밀이 아니지만, **Rules가 허술하면 데이터가 노출**된다.

---

## 3. 업로드된 TTL 파일 분석 (에이전트 필독)

### 3.1 파일 역할

| 파일 | 역할 | 네임스페이스(ex:) | 비고 |
|---|---|---|---|
| `영화과.ttl` | 고등학교 영화 교과 3과목 교육과정 | `https://example.org/curriculum/film#` | 교과 3, 영역 8, 핵심 아이디어 17, 내용 요소 82, 역량 7, **성취기준 32**(해설·적용 시 고려 사항 포함) |
| `가네.ttl` | 수업지도절차(가네 9사태) | `.../il-lesson/` | 9개 사태, 전략·활동·자료·평가 속성 |
| `text.ttl` | 텍스트 유형 분류 | `.../pisa#` | 자료/조직·탐색/체재/유형(내용) 4기준 |
| `readstrategy.ttl` | 독서기능·동사·전략 | `http://example.org/reading#` | 기능(이해·탐색·추론·예측·비교·대조·분류…) ↔ 동사 ↔ 전략 |

> 폴더에 있는 `사회과.ttl`, `과학과.ttl`, `수학과.ttl`은 이번 범위가 아니므로 **에이전트에게 제공하지 않는다**(Phase 11 과목 확장 검증용으로 보관). `영화감상과비평.ttl`은 `영화과.ttl`에 통합되어 폐기.

### 3.2 구조 요약

- **교육과정 TTL(`영화과.ttl`)**: `Subject → hasArea → LearningArea → (hasCoreIdea → CoreIdea) / (hasContentElement → ContentElement) / (hasStandard → AchievementStandard)`.
  - 내용요소는 `KnowledgeUnderstanding / ProcessSkill / ValueAttitude`로 하위분류, 모두 `gradeBand "고등학교"`.
  - `Subject`: `courseCategory`(진로 선택 과목/융합 선택 과목), `description`(성격 첫 문장), `developsCompetency`(영화 교과 핵심역량 7개).
  - `LearningArea`: `applicationNote`(성취기준 적용 시 고려 사항, 항목별 여러 값), `description`(성격에서 해당 영역을 설명한 문장, 없는 영역도 있음).
  - `AchievementStandard`: `standardCode`(예: `[12영이01-01]`), `standardText`, `standardExplanation`(해설, 여러 값 가능), `targetVerb`(끝 동사 기본형). `targetFunction`, `coversElement`는 **선언만 되어 있고 값은 비어 있음**(§3.3).
  - 핵심 아이디어·내용 요소·성취기준·해설·고려 사항은 모두 **원문 그대로**.
- **가네 TTL**: `InformationLiteracyLesson → hasEvent → InstructionalEvent(sequenceNumber 1~9)`, 각 사태는 `hasStrategy`, `usesResource`, `hasActivity`, `hasAssessment`, `exampleDescription`, `nextEvent`.
- **readstrategy TTL**: `ReadingFunction —hasVerb→ ReadingVerb`, `ReadingFunction —hasStrategy→ ReadingStrategy`. 하나의 전략이 여러 기능에 중복 소속(예: KWL은 탐색·예측).
- **text TTL**: `TextTypeAttribute`가 4개 분류 기준에 속하고, `TextExample`이 속성 조합 사례를 표현.

### 3.3 ⚠️ 현재 TTL의 한계와 보완 필요사항 (이 시스템의 핵심 리스크)

| # | 문제 | 영향 | 해결 방안 |
|---|---|---|---|
| 1 | ~~단원·성취기준이 TTL에 없음~~ → **해결**: `영화과.ttl`에 성취기준 32개 수록. 단, 국가 교육과정에 **‘단원’은 없음**(성취기준은 영역 아래에 묶임) | “단원”으로 접근하는 화면은 만들 수 없음 | 탐색 경로를 **영역 → 성취기준**으로 구성. `Unit` 클래스는 만들지 않음 |
| 2 | 실습 3과목(촬영·조명, 편집·사운드, 영화 제작 실습)이 TTL에 없음 | 해당 과목 교사는 사용 불가 | 범위 결정에 따른 의도적 제외. Phase 11에서 추가 검토 |
| 3 | 성취기준의 `targetFunction`(독서 기능 연결)이 **비어 있음**. `targetVerb` 32개 중 readstrategy.ttl의 읽기 동사와 **정확히 일치하는 것은 10개**(이해하다 7, 표현하다·분석하다·성찰하다 각 1). 나머지 22개는 불일치(**탐구하다 18**, 탐색하다 2, 확장하다 1, 제작하다 1) | 그대로 두면 대부분의 성취기준에서 전략 자동 추천 불가 | **사용자 결정: 관리자 화면에서 지정.** 동사→기능 **매핑 사전**(관리자 편집)을 두고, 미지정 성취기준은 교사가 독서 기능을 직접 선택(§5.2). 에이전트는 매핑 값을 임의로 채우지 말 것 |
| 4 | 4개 파일의 **네임스페이스가 모두 다르고**(readstrategy만 `http://`), `ex:hasStrategy`가 가네·독서전략 파일에서 **같은 이름으로 다른 의미**로 쓰임 | 하나로 병합 시 충돌 | 파일별 접두사 분리(`cur:`, `gagne:`, `rs:`, `tx:`)로 정규화. 원본 파일은 보존(`/data/ttl/original`). `영화과.ttl`의 `targetFunction` range는 `http://example.org/reading#ReadingFunction` |
| 5 | 가네.ttl은 **정보활용교육 수업 사례** 중심(사설 읽기 예) | 교과 수업에 일반화 필요 | 9사태의 **구조(순서·목적)** 만 템플릿으로 쓰고, 예시 문구는 “참고 예시”로 분리 |
| 6 | 독서전략에 **정의·절차·소요시간·적합 텍스트 유형**이 없고 이름만 있을 가능성 | 지도안에 구체 절차를 쓰기 어려움 | `rs:procedure`, `rs:suitableTextType`, `rs:gagneEvent`, `rs:minutes` 속성 추가 필요(§5.3). 초안은 AI가 제안하되 **관리자 승인 전에는 ‘미검수’ 표시** |
| 7 | `text.ttl`은 인쇄·디지털 글 중심(PISA) 분류라 **영상 텍스트 유형이 없음** | 영화 수업의 ‘영화를 읽는’ 활동은 텍스트 유형으로 표현 불가. 시나리오·비평문·감상문은 ‘서사’·‘논증’ 등으로 가능 | 우선 읽기자료(글)만 대상으로 함. 영상 유형 추가 여부는 §15-10에서 결정 |
| 8 | 성취기준 ↔ 내용 요소 연결(`coversElement`)이 비어 있음 | 성취기준 선택 시 관련 내용 요소 자동 표시 불가 | 원문에 연결 정보가 없음. 관리자 편집기에서 지정(선택 기능) |

> **에이전트는 Phase 1에서 위 8가지를 점검한 리포트를 먼저 제출할 것.** (실제 TTL을 파싱하여 클래스별 개수, 라벨이 없는 노드, 고아 노드, 중복 라벨을 표로 제시)

---

## 4. 데이터 파이프라인 (TTL → 앱 → Firestore)

```
원본 TTL(4개)  ──[ build script: scripts/ttl-to-json.mjs ]──▶  /data/compiled/*.json
                                                                   │
                           ┌───────────────────────────────────────┤
                           ▼                                       ▼
                 Emulator Firestore (로컬 테스트)        실제 Firestore (배포 시 관리자 import)
```

- **TTL이 원본(Source of Truth)** 이고, 앱은 컴파일된 JSON(및 Firestore 문서)을 읽는다.
- 컴파일 스크립트는 N3.js로 파싱 → 정규화된 JSON 생성 → **스키마 검증**(zod 등) 실패 시 오류 위치 출력.
- 관리자 화면에서 TTL을 업로드하면 **클라이언트에서 파싱 → 변경 미리보기(추가/수정/삭제 diff) → 확인 후 새 버전으로 저장**.
- 모든 데이터에 **`ontologyVersion`** 을 부여하여 지도안·읽기자료가 어떤 버전 기준으로 생성되었는지 추적.
- 앱에서 수정한 내용을 다시 **TTL로 내보내기(Export)** 할 수 있어야 한다(왕복 변환 테스트 포함: TTL→JSON→TTL 후 triple 수 일치).

---

## 5. 확장 스키마 (TTL 보완안)

### 5.1 교육과정 — 성취기준 (`영화과.ttl`에 이미 적용됨)

```turtle
@prefix ex: <https://example.org/curriculum/film#> .
@prefix rs: <http://example.org/reading#> .

ex:AchievementStandard a owl:Class ; rdfs:label "성취기준"@ko .

ex:hasStandard         a owl:ObjectProperty ;   rdfs:domain ex:LearningArea ;        rdfs:range ex:AchievementStandard .
ex:standardCode        a owl:DatatypeProperty ; rdfs:domain ex:AchievementStandard . # 예: "[12영이01-01]" — 원문 그대로
ex:standardText        a owl:DatatypeProperty ; rdfs:domain ex:AchievementStandard . # 성취기준 원문
ex:standardExplanation a owl:DatatypeProperty ; rdfs:domain ex:AchievementStandard . # 성취기준 해설(여러 값)
ex:applicationNote     a owl:DatatypeProperty ; rdfs:domain ex:LearningArea .        # 적용 시 고려 사항(항목별 여러 값)
ex:targetVerb          a owl:DatatypeProperty ; rdfs:domain ex:AchievementStandard . # 끝 동사 기본형(예: 탐구하다)
ex:targetFunction      a owl:ObjectProperty ;   rdfs:domain ex:AchievementStandard ; rdfs:range rs:ReadingFunction .  # 비어 있음 — 관리자 지정
ex:coversElement       a owl:ObjectProperty ;   rdfs:domain ex:AchievementStandard ; rdfs:range ex:ContentElement .   # 비어 있음 — 선택
```

- 국가 교육과정에 ‘단원’이 없으므로 `Unit`/`inArea`는 사용하지 않는다. 성취기준 노드 IRI 예: `ex:FilmUnderstandingStd01_01`.
- `standardCode`, `standardText`, `standardExplanation`, `applicationNote`는 **원문 복사값**이며 앱에서 수정 불가(읽기 전용)로 둔다.
- 해설 한 문단이 여러 성취기준을 함께 설명하는 경우 같은 문단이 각 성취기준에 연결되어 있다.

### 5.2 읽기 기능 매칭 규칙
1. 관리자가 지정한 `targetFunction`이 있으면 그것을 사용
2. 없으면 `targetVerb` → `ReadingVerb` 정확 일치 → 해당 `ReadingFunction` (현재 32개 중 10개 해당)
3. 불일치 시 **동사 매핑 사전**(관리자 편집, 초기값 비어 있음) → 후보 1~3개
4. 그래도 없으면 교사에게 “읽기 목적”을 직접 선택하게 함(이해/탐색/추론/예측/비교/대조/분류 …)
- 매핑이 필요한 동사(초기 데이터): **탐구하다(18), 탐색하다(2), 확장하다(1), 제작하다(1)**. 에이전트는 이 매핑을 임의로 채우지 말고, 관리자 화면에서 입력할 수 있게만 구현한다.

### 5.3 독서전략 확장 속성
```turtle
rs:procedure          a owl:DatatypeProperty .  # 전략 실행 절차(3~6단계)
rs:suitableTextType   a owl:ObjectProperty .    # tx:TextTypeAttribute와 연결
rs:recommendedEvent   a owl:ObjectProperty .    # 가네 사태(주로 4~6)와 연결
rs:minutes            a owl:DatatypeProperty .  # 권장 소요시간
rs:worksheetHint      a owl:DatatypeProperty .  # 활동지 형태(표, 벤다이어그램 등)
rs:reviewStatus       a owl:DatatypeProperty .  # draft | reviewed
```

---

## 6. 인증·권한 설계

### 6.1 “ID + 비밀번호만”을 Firebase에서 구현하는 방법
Firebase Auth는 이메일 기반이므로 **교사가 입력한 ID를 가상 이메일로 변환**한다.

```
loginId "kimtc01"  →  내부 이메일 "kimtc01@ttl-edu.local"  (사용자에게는 노출하지 않음)
```
- ID 규칙: 영소문자·숫자 4~20자 (정규식 `^[a-z0-9]{4,20}$`), 관리자가 발급.
- 비밀번호: Firebase 최소 6자. 앱에서는 **8자 이상** 권장.
- 이메일이 가짜이므로 **“비밀번호 재설정 메일”은 동작하지 않음** → 재설정은 관리자가 처리(§6.3).

### 6.2 계정 생성 방식 — **B안으로 결정**
- **B안(채택)**: 공용 **가입 코드(invite code)** 를 아는 교사가 직접 ID/비번 가입 → `active: false` 상태로 생성 → 관리자가 승인(`active: true`)해야 사용 가능.
  - 가입 코드는 `appConfig/signup.inviteCode`에 저장, 관리자가 변경. 클라이언트는 가입 코드를 읽을 수 없고 **Rules의 `get()`으로만 대조**한다(§6.4).
  - 승인 대기 계정은 로그인 직후 “관리자 승인 대기 중” 화면만 볼 수 있다.
  - 관리자는 가입 신청을 승인·거절(거절 = 비활성 유지 + 사유 메모)할 수 있다.
- A안(관리자 발급)은 보조 기능으로 유지(관리자가 직접 계정을 만들 때).

> 클라이언트에서 다른 사용자 계정을 만들면 현재 로그인이 바뀐다. 관리자 화면의 계정 생성은 **보조 Firebase App 인스턴스(secondary app)** 를 사용해 관리자 세션을 유지할 것.

### 6.3 관리자 권한과 비밀번호 재설정
- 관리자 여부는 `users/{uid}.role == 'admin'` 으로 판단하며, **본인이 role을 수정할 수 없도록 Rules로 차단**.
- 최초 관리자 1명은 Firebase 콘솔(또는 에뮬레이터 시드 스크립트)에서 수동 생성.
- 다른 사용자의 비밀번호를 클라이언트에서 직접 바꿀 수 없음 → 다음 중 택1:
  1. **로컬 관리자 CLI**(`tools/admin-cli.mjs`, Firebase Admin SDK, 서비스 계정 키는 관리자 PC에만 보관)로 재설정
  2. Blaze 요금제 전환 후 Cloud Functions 사용(비용·약관 확인 필요)
- 계정 비활성화: `users/{uid}.active=false` → 앱이 로그인 직후 검사하여 차단 + Rules에서도 `active` 확인.

### 6.4 Firestore Security Rules 기본 골격
```
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    function signedIn() { return request.auth != null; }
    function me() { return get(/databases/$(db)/documents/users/$(request.auth.uid)).data; }
    function isActive() { return signedIn() && me().active == true; }
    function isAdmin()  { return isActive() && me().role == 'admin'; }

    // 사용자 프로필: 본인 읽기 가능, role/active 수정은 관리자만
    match /users/{uid} {
      allow read: if signedIn() && (request.auth.uid == uid || isAdmin());
      // B안: 본인 가입 신청 — 교사·비활성으로만, 가입 코드가 일치할 때만 생성 가능
      allow create: if isAdmin()
        || (signedIn() && request.auth.uid == uid
            && request.resource.data.role == 'teacher'
            && request.resource.data.active == false
            && request.resource.data.inviteCode == get(/databases/$(db)/documents/appConfig/signup).data.inviteCode);
      allow delete: if isAdmin();
      allow update: if isAdmin()
        || (request.auth.uid == uid
            && request.resource.data.role == resource.data.role
            && request.resource.data.active == resource.data.active);
    }

    // 교육과정·전략·가네·텍스트유형: 활성 사용자 읽기, 관리자만 쓰기
    match /{coll}/{doc=**} {
      allow read: if isActive() && coll in
        ['subjects','curriculumNodes','readingFunctions','readingStrategies','textTypes','gagneEvents','ontologyVersions','verbMappings'];
      allow write: if isAdmin() && coll in
        ['subjects','curriculumNodes','readingFunctions','readingStrategies','textTypes','gagneEvents','ontologyVersions','verbMappings','promptTemplates','appConfig'];
    }

    // 교사 산출물: 소유자만 쓰기, 공유(visibility == 'shared')된 것은 활성 사용자 모두 읽기
    match /materials/{id} {
      allow read: if isActive() && (resource.data.ownerUid == request.auth.uid || resource.data.visibility == 'shared') || isAdmin();
      allow create: if isActive() && request.resource.data.ownerUid == request.auth.uid;
      allow update, delete: if isActive() && resource.data.ownerUid == request.auth.uid
        && (request.method == 'delete' || request.resource.data.ownerUid == resource.data.ownerUid);
    }
    match /lessonPlans/{id} {
      allow read: if isActive() && (resource.data.ownerUid == request.auth.uid || resource.data.visibility == 'shared') || isAdmin();
      allow create: if isActive() && request.resource.data.ownerUid == request.auth.uid;
      allow update, delete: if isActive() && resource.data.ownerUid == request.auth.uid
        && (request.method == 'delete' || request.resource.data.ownerUid == resource.data.ownerUid);
    }
  }
}
```
> 위는 골격이다. 에이전트는 **Rules 단위 테스트(`@firebase/rules-unit-testing`)** 를 작성하여 “교사가 타인의 자료를 읽을 수 없음”, “교사가 role을 바꿀 수 없음”, “비활성 계정 차단” 등을 검증할 것.

---

## 7. Firestore 데이터 모델

| 컬렉션 | 주요 필드 | 설명 |
|---|---|---|
| `users` | loginId, displayName, role, active, status(`pending`/`approved`/`rejected`), inviteCode(가입 시에만), rejectReason?, createdAt, approvedAt?, approvedBy?, lastLoginAt | 사용자 프로필 (B안 가입·승인) |
| `ontologyVersions` | versionId, note, createdBy, createdAt, sourceFiles[] | TTL 버전 이력 |
| `subjects` | id(`filmUnderstanding`,`filmAppreciationCriticism`,`filmAndLife`), name, courseCategory, description, competencies[] | 과목 |
| `curriculumNodes` | id, subjectId, type(`area`/`coreIdea`/`element`/`standard`), elementKind?(`knowledge`/`process`/`value`), label, description, parentIds[], gradeBand, applicationNotes[]?(area), standardCode?, standardText?, standardExplanations[]?, targetVerb?, targetFunctionIds[], coversElementIds[] | **하나의 컬렉션에 계층 노드 저장**(경로 탐색은 parentIds로) |
| `verbMappings` | verb, functionIds[], updatedBy, updatedAt | 동사 → 독서 기능 매핑 사전(§5.2-3, 관리자 편집) |
| `readingFunctions` | id, label, verbs[], strategyIds[] | 독서 기능 |
| `readingStrategies` | id, label, functionIds[], procedure[], suitableTextTypeIds[], recommendedEvents[], minutes, reviewStatus | 독서 전략 |
| `textTypes` | id, category(자료/조직과탐색/체재/유형), label, description | 텍스트 속성 |
| `gagneEvents` | seq(1~9), label, purpose, phase(도입/전개/정리), defaultStrategies[], exampleDescription | 가네 9사태 |
| `promptTemplates` | id, kind(`material`/`strategy`/`lessonPlan`), version, body, outputSchema | 프롬프트 버전 관리 |
| `materials` | ownerUid, ownerDisplayName, subjectId, nodeIds[], params{학년?, 분량, 수준, 텍스트유형, 수업시간, films[]{title, source(`teacher`/`ai`), confirmed}}, title, body, glossary[], questions[], visibility(`private`/`shared`), sharedAt?, copiedFrom?, ontologyVersion, promptVersion, model, createdAt | 생성된 읽기자료 |
| `lessonPlans` | ownerUid, ownerDisplayName, materialId, strategyIds[], lessonMinutes(50/100), events[9]{seq, teacherActivity, studentActivity, material, minutes, assessment}, rubric{criteria[]{상, 중, 하}}, visibility, sharedAt?, copiedFrom?, ontologyVersion, createdAt | 수업지도안 |
| `appConfig` | `signup`{inviteCode}, `ai`{mode, model, dailyQuotaPerTeacher} | 앱 설정 (가입 코드는 클라이언트가 읽지 못함) |

- 인덱스가 필요한 쿼리(`ownerUid + createdAt desc` 등)는 `firestore.indexes.json`에 명시.
- 교육과정 읽기는 호출 횟수를 줄이기 위해 **과목 단위로 캐시**(앱 시작 시 1회 로드 후 메모리 보관).

---

## 8. AI 생성 기능 설계 (가장 중요한 설계 결정)

### 8.1 API 키 보관 문제
GitHub Pages(정적) 프론트에 AI API 키를 넣으면 **누구나 키를 탈취**할 수 있다. 선택지:

| 방식 | 장점 | 단점 |
|---|---|---|
| **① Firebase AI Logic(Gemini) + App Check** (권장) | 키를 프론트에 두지 않음, Firebase 안에서 해결 | 설정 필요, 최신 요금·제공 범위 확인 필요 |
| ② Cloud Functions 프록시 | 가장 유연 | Blaze(종량제) 요금제 필요 |
| ③ 교사가 본인 API 키 입력 | 서버 불필요 | 교사에게 부담, 키 관리 위험 |
| ④ 관리자 PC 로컬 프록시 | 무료 | 상시 가동 불가 |

→ **에이전트는 ①을 기본으로 설계하되, §8.2의 어댑터 인터페이스로 구현하여 방식을 바꿔도 UI 변경이 없도록 할 것.** 구현 시점의 최신 공식 문서를 확인하고, 모델명·요금·무료 한도는 **관리자 설정(`appConfig`)** 으로 분리한다.

### 8.2 AI 어댑터 인터페이스
```ts
interface AiProvider {
  generateMaterial(input: MaterialRequest): Promise<MaterialResult>;
  recommendStrategies(input: StrategyRequest): Promise<StrategyResult>;
  generateLessonPlan(input: LessonPlanRequest): Promise<LessonPlanResult>;
}
// 구현체: MockProvider(오프라인·테스트), GeminiProvider(실서비스)
```
- **MockProvider**: 고정된 그럴듯한 샘플을 반환(스키마 동일) → **인터넷 없이 전체 흐름 테스트 가능**. 오프라인 개발의 필수 요소.
- 모든 AI 응답은 **JSON 스키마 강제 + zod 검증**, 실패 시 1회 재시도 후 사용자에게 오류 안내.
- **지도안 생성은 규칙 기반 뼈대 + AI 보완**: 9사태 순서·단계 구분은 `gagneEvents`에서 가져오고, 선택된 전략을 사태 4~6(자료 제시·학습 안내·수행)에 배치(`recommendedEvents` 활용). AI는 활동 문장·발문·시간 배분만 채움.

### 8.3 ① 읽기자료 생성

**입력**: 선택 노드(영역/핵심아이디어/내용요소/성취기준 중 1개 이상), 분량(예: 400/600/800자), 읽기 수준(쉬움/보통/도전), 텍스트 유형(text.ttl의 4기준 조합), 수업 시간(50분 / 블록 100분), 대상 학년(1~3, 선택 — 어휘 수준 참고용), 다룰 영화(선택), 추가 요청(선택).
- **다룰 영화(§15-9 결정: 두 방식 모두)**
  - 교사가 제목을 직접 입력하거나, **AI에게 예시 영화 추천**을 요청할 수 있다.
  - AI가 추천한 영화는 `source: 'ai'`, `confirmed: false`로 표시하고 “제목·감독·연도 등 사실 확인 필요” 경고를 붙인다. **교사가 확인 체크를 해야** 읽기자료 생성에 쓸 수 있다.
  - AI 추천 시 장르·국가·시대가 고르게 섞이도록 요청하고, 추천 이유는 성취기준과 연결해 한 줄로 쓴다.
- 프롬프트에는 선택 성취기준의 **원문 + 성취기준 해설 + 해당 영역의 적용 시 고려 사항**을 함께 넣어 범위를 지키게 한다.

**출력(JSON)**: `title`, `body`(문단 배열 또는 비연속 요소 포함 시 `blocks[]`), `glossary[{term, meaning}]`, `comprehensionQuestions[]`(수준별 3~5개), `sourceNote`(“AI 생성 자료, 교사 검토 필요”), `alignment{nodeIds, standardCodes}`.

**품질 규칙(프롬프트에 반드시 포함)**
- 선택한 성취기준·핵심 아이디어의 범위를 **벗어나는 개념 도입 금지**
- 고등학생 수준에 맞는 어휘·문장 길이, 어려운 용어(영화 용어 포함: 미장센, 몽타주 등)는 `glossary`에 수록
- **사실 오류 금지**: 불확실한 수치·연도·인용은 쓰지 말고 일반적 서술로 대체
- **실존 교과서·기사·저작물 문장 복제 금지**(창작 서술). 영화 **대사·자막·시나리오 원문을 옮겨 쓰지 않는다**
- **실존 영화의 사실 정보(감독, 개봉 연도, 출연진, 수상, 구체적 줄거리·장면)를 단정하지 않는다.** 교사가 입력한 영화에 대해서도 확인할 수 없는 세부는 일반적 서술로 대체하고, 사실 확인 필요 표시를 붙인다
- 하나의 장르·국가·시대에 치우치지 않게 한다(원문 적용 시 고려 사항: “하나의 장르, 주제 등에 치우치지 않고 다양한 장르와 특성의 영화를 골고루 제공”)
- 텍스트 유형이 “비연속적/혼합”이면 표·그래프 설명용 **데이터 표(JSON)** 를 함께 생성(실제 차트 이미지는 선택 기능)
- 영화가 다루는 사회·역사 쟁점은 **다양한 관점 제시**(<영화 감상과 비평> ‘감상과 비평의 실제’, <영화와 삶> ‘영화로 세상읽기’ 관련)
- 모든 자료는 **교사가 편집 후 저장**하도록 UI에서 “검토 필요” 배지를 노출

### 8.4 ② 독서전략 추천 로직
1. 후보 기능 결정: §5.2 규칙(관리자 지정 → 동사 일치 → 매핑 사전 → 교사 직접 선택). 어느 단계에서 정해졌는지 UI에 표시
2. 후보 전략 = 해당 기능의 `hasStrategy` ∪ (생성한 텍스트 유형에 `suitableTextType`이 맞는 전략)
3. 점수화: 기능 일치(+3) / 텍스트 유형 일치(+2) / 소요시간 ≤ 수업시간 배분(+1) / `reviewStatus=reviewed`(+1)
4. 상위 3~5개를 **추천 이유(한 줄)** 와 함께 제시, 교사가 1~3개 선택
5. 읽기 전·중·후 단계 분류(탐색·예측은 읽기 전, 이해·추론은 읽기 중, 비교·분류·평가는 읽기 후 등)를 UI에 표시 — 단, 이 분류는 **관리자 편집 가능한 데이터**로 둘 것

### 8.5 ③ 수업지도안 생성
- 템플릿: **가네 9사태** → 도입(1~3) / 전개(4~8) / 정리(9) 3단계 표시
  1. 주의 획득 2. 학습목표 제시 3. 선수학습 재생 4. 학습자료 제시 5. 학습 지침 제공 6. 수행 요구 7. 피드백 제공 8. 수행 평가 9. 파지와 전이
- 지도안 구성: **기본 정보**(과목·교육과정 구분·영역·성취기준·차시·학습목표) / **영역·차시 개관** / **읽기자료 요약** / **독서전략 개요** / **9사태별 표**(단계, 교수·학습 활동(교사/학생), 시간, 자료·유의점, 평가) / **평가 계획**(평가 준거 3수준 선택) / **활동지 초안**
- **시간 검증**: 사태별 시간 합계 = 수업 시간(50분 또는 블록 100분)이 아니면 경고
- **평가 준거(§15-7 결정: 자동 생성)**: 8사태 ‘수행 평가’에 성취기준 기반 평가 요소별 상·중·하 준거를 AI가 초안으로 생성, 교사가 수정
- ‘자료·유의점’ 칸에는 해당 영역의 **성취기준 적용 시 고려 사항**을 참고 정보로 제시(원문 그대로, 교사가 선택해 반영)
- 학습목표는 성취기준 동사를 반영하여 “~할 수 있다” 형식으로 생성
- 모든 칸은 **인라인 편집 가능**, 재생성 시 수정한 칸 보호(잠금 기능)

---

## 9. 화면 구성(IA)

### 9.1 공통
- 로그인(ID/비번), 로그아웃, 내 정보(비밀번호 변경 — 본인은 가능)

### 9.2 교사 모드
0. **가입 신청**: 가입 코드 + 아이디 + 표시 이름 + 비밀번호 → “관리자 승인 대기” 안내
1. **홈**: 최근 작업, 새 수업 만들기
2. **교육과정 탐색**: 과목 탭(3과목) → 트리/카드(영역 → 핵심아이디어·내용요소·성취기준), 성취기준 클릭 시 해설·적용 시 고려 사항 펼침, 검색(키워드·성취기준 코드), 필터(과목 구분·내용 요소 범주), 다중 선택
3. **수업 마법사(Wizard)**: 단계별 진행 막대 — 조건 입력 → 읽기자료 → 독서전략 → 지도안 → 내보내기. 이전 단계 수정 시 후속 결과에 “다시 생성 필요” 표시
4. **내 보관함**: 자료/지도안 목록, 검색, 복제, 삭제, **공유하기/공유 취소**
4-1. **공유 보관함**: 다른 교사가 공유한 자료·지도안 열람(과목·영역·성취기준 필터), **내 보관함으로 복제**(원본은 수정 불가, `copiedFrom` 기록)
5. **도움말**: 사용법, 각 독서전략 설명, 가네 9사태 설명

### 9.3 관리자 모드
1. **계정 관리**: **가입 신청 승인·거절**, 목록, 직접 발급(단건/CSV), 비활성화, 가입 코드 변경, (CLI 안내) 비밀번호 재설정
2. **온톨로지 관리**: TTL 업로드 → 검증 리포트 → diff 미리보기 → 새 버전 게시 / 이전 버전 롤백 / TTL 내보내기
3. **교육과정 편집기**: 성취기준별 독서 기능 연결(`targetFunction`) 지정 — 미지정 22개 목록 우선 표시, 성취기준 ↔ 내용 요소 연결(`coversElement`), **동사 매핑 사전** 편집. 원문 필드(코드·원문·해설·고려 사항)는 읽기 전용
4. **독서전략 편집기**: 절차·적합 텍스트 유형·권장 사태 편집, 검수 상태 변경
5. **과목 추가 마법사**: 새 과목 TTL 업로드 → 매핑 검증 → 과목 활성화
6. **프롬프트 템플릿 관리**: 버전, 테스트 실행(Mock/실제)
7. **사용 현황**: 교사별 생성 횟수(개인정보 최소화), 할당량 설정

### 9.4 UX 원칙
- 교사가 **3클릭 이내** 에 수업 마법사 시작
- 모바일·태블릿 대응(반응형), 인쇄 미리보기 제공
- 접근성: 키보드 이동, 명도 대비, 글꼴 크기 조절
- 생성 중 진행 표시와 **취소** 버튼, 오류 시 **입력값 보존**

---

## 10. 오프라인 개발·테스트 환경

> 목표: **인터넷 없이** 로그인 → 탐색 → 읽기자료(Mock) → 전략 → 지도안 → 내보내기까지 전 과정을 로컬에서 검증한 뒤 GitHub에 업로드.

### 10.1 구성
- `npm run dev` : Vite 개발 서버
- `firebase emulators:start` : Auth + Firestore 에뮬레이터 (Node, Java 필요 — 사전 설치 안내를 README에 포함)
- `.env.local`: `VITE_USE_EMULATOR=true`, `VITE_AI_MODE=mock`
- `npm run seed` : 컴파일된 JSON을 에뮬레이터에 적재 + **테스트 계정**(admin / teacher) 생성
- 앱 코드는 `VITE_USE_EMULATOR` 값에 따라 `connectAuthEmulator`, `connectFirestoreEmulator`를 호출

### 10.2 테스트 계정(로컬 전용)
| ID | 역할 | 비밀번호 |
|---|---|---|
| `admin01` | admin | 로컬 시드 스크립트에서 설정 |
| `teacher01` | teacher | 로컬 시드 스크립트에서 설정 |

> 실서비스에서는 **절대 동일한 비밀번호 사용 금지**. 시드 스크립트는 에뮬레이터 환경에서만 실행되도록 가드할 것.

### 10.3 테스트 범위
| 구분 | 내용 |
|---|---|
| 단위 | TTL→JSON 변환, 동사→기능 매칭, 전략 점수화, 지도안 시간 합계 검증 |
| Rules | 권한 시나리오 15개 이상(교사/관리자/비활성/비로그인) |
| E2E(Playwright) | ① 교사 로그인→자료→전략→지도안→저장 ② 관리자 계정 발급 ③ TTL 업로드 diff ④ 비활성 계정 로그인 차단 |
| 회귀 | TTL 왕복 변환 triple 수 일치 |
| 오프라인 | 네트워크 차단 상태에서 Mock 모드로 E2E 통과 |

---

## 11. 저장소 구조 · 배포

### 11.1 폴더 구조
```
/
├─ AGENTS.md                  # 이 문서의 핵심 규칙 요약(에이전트용)
├─ README.md                  # 설치·실행·배포 안내(한국어)
├─ data/
│  ├─ ttl/original/           # 업로드 원본 4개 (수정 금지)
│  ├─ ttl/working/            # 보완·확장 작업본
│  └─ compiled/               # 변환된 JSON
├─ scripts/                   # ttl-to-json.mjs, seed.mjs, validate.mjs
├─ tools/admin-cli.mjs        # 관리자용 비밀번호 재설정 등 (서비스 계정 키는 저장소 밖)
├─ firebase/                  # firestore.rules, firestore.indexes.json, firebase.json
├─ src/
│  ├─ app/                    # 라우팅, 레이아웃
│  ├─ features/{auth,curriculum,wizard,materials,strategies,lessonplan,admin,export}/
│  ├─ lib/{firebase,ttl,ai,validation}/
│  └─ components/
├─ tests/{unit,rules,e2e}/
└─ .github/workflows/deploy.yml
```

### 11.2 GitHub Pages 배포 체크리스트
- `vite.config.ts`의 `base`를 `/저장소이름/` 으로 설정
- HashRouter 사용
- GitHub Actions: `npm ci → npm run test → npm run build → Pages 배포`
- Firebase 콘솔 → Authentication → **승인된 도메인**에 `사용자명.github.io` 추가
- Firebase 설정값은 GitHub **Variables** 또는 빌드 시 주입(공개돼도 되지만 Rules·App Check가 필수)
- 서비스 계정 키, 관리자 비밀번호는 **절대 저장소 금지**
- 배포 후 스모크 테스트(로그인→탐색→생성) 체크리스트 수행

### 11.3 Git 워크플로
- `main`(배포) / `dev`(통합) / `feature/*` 브랜치, 커밋 메시지는 한국어 가능(`feat:`, `fix:` 접두사)
- Phase 완료마다 태그(`v0.1-phase1` …)

---

## 12. 개발 단계 (Phase별 작업·완료 기준)

### Phase 0 — 환경·골격
- Vite+React+TS 프로젝트, Tailwind, 라우터, 린트, 폴더 구조, `AGENTS.md`, `README.md`
- Firebase 에뮬레이터 설정, 환경변수 분기
- ✅ 완료 기준: `npm run dev` + 에뮬레이터 기동, 빈 로그인 화면 표시

### Phase 1 — TTL 분석·컴파일
- 4개 TTL 파싱, **분석 리포트**(§3.3의 8개 항목 점검), JSON 컴파일 스크립트, 스키마 검증
- ✅ 완료 기준: 리포트 Artifact 제출, 컴파일 JSON 생성(성취기준 32개·해설·고려 사항 포함 확인), 단위 테스트 통과, **사용자 검토 후 스키마(§5) 확정**

### Phase 2 — 인증·권한
- ID→가상 이메일 로그인, **가입 코드 가입 신청·관리자 승인(B안)**, 관리자/교사 분기, 승인 대기·비활성 계정 차단, Rules + Rules 테스트, 시드 스크립트
- ✅ 완료 기준: Rules 테스트 통과, 교사로 관리자 화면 접근 불가, 가입 신청 → 승인 → 로그인 흐름 동작

### Phase 3 — 교육과정 탐색(교사)
- 영화 3과목 트리/검색/다중선택, 성취기준 해설·적용 시 고려 사항 표시, 독서 기능 미지정 성취기준에 “독서 기능 미지정” 표시
- ✅ 완료 기준: 3과목 모두 노드 선택→상태 저장, 성취기준 코드 검색 동작

### Phase 4 — 읽기자료 생성(Mock 우선)
- 조건 입력 폼, `AiProvider` 인터페이스, MockProvider, 결과 편집·저장·보관함
- ✅ 완료 기준: 오프라인에서 자료 생성·저장·재열람

### Phase 5 — 독서전략 추천
- 기능 매칭·점수화, 추천 이유 표시, 전략 상세 보기
- ✅ 완료 기준: 단위 테스트(동사→기능→전략, §5.2 4단계 순서), `targetFunction`이 비어 있는 성취기준(예: ‘탐구하다’)에서도 교사가 기능을 직접 선택해 진행 가능

### Phase 6 — 수업지도안(가네 9사태)
- 9사태 템플릿 로드, 전략 배치, 시간 검증(50/100분), 평가 준거 자동 생성, 인라인 편집·잠금, 저장
- 공유 보관함: 자료·지도안 공유/공유 취소, 열람, 복제
- ✅ 완료 기준: 50분·100분 기준 지도안 각 1건 생성→편집→저장→재열람, 공유한 지도안을 다른 교사 계정에서 열람·복제

### Phase 7 — 내보내기
- 인쇄 CSS(A4) PDF, DOCX 내보내기, **HWPX(한글) 내보내기**, 활동지 포함
  - HWPX는 한글 2014 이후 버전이 여는 공개 XML 형식(OWPML). 클라이언트에서 템플릿 기반으로 생성. 구형 바이너리 .hwp는 만들지 않음
- ✅ 완료 기준: 한글 폰트 깨짐 없음(DOCX·HWPX를 각각 워드·한글에서 열어 확인), 표 레이아웃 유지

### Phase 8 — 관리자 기능
- 계정 관리, TTL 업로드·diff·버전·롤백·내보내기, 교육과정/전략 편집기(독서 기능 연결·동사 매핑 사전 포함), 프롬프트 관리
- ✅ 완료 기준: 수정 후 교사 화면에 즉시 반영, 롤백 동작, 동사 매핑 추가 시 해당 동사의 성취기준 전략 추천에 반영

### Phase 9 — 실제 AI 연결(온라인)
- GeminiProvider(§8.1 방식), App Check, 사용량 제한, 오류·재시도, 비용 상한 안내
- ✅ 완료 기준: Mock과 동일한 스키마 통과, 실패 시 사용자 안내

### Phase 10 — GitHub 업로드·배포
- Actions, Pages, Firebase 실서비스 연결, 데이터 import, 스모크 테스트
- ✅ 완료 기준: 배포 URL에서 교사/관리자 시나리오 통과

### Phase 11 — 과목 확장
- 과목 추가 마법사로 새 과목 TTL 투입(코드 수정 없이 가능한지 검증)
- 후보: 영화 실습 3과목(TTL 추가 작성 필요), 보관 중인 `사회과.ttl`·`과학과.ttl`·`수학과.ttl`(중학교·성취기준 없음 → 성취기준 없는 과목도 동작하는지 검증)
- ✅ 완료 기준: 코드 변경 0건으로 신규 과목 활성화

---

## 13. 비기능 요구사항

| 항목 | 기준 |
|---|---|
| 성능 | 교육과정 트리 초기 로딩 2초 이내(캐시 후 즉시), AI 생성은 진행 표시 |
| 보안 | Rules 필수 테스트, 입력 검증(XSS 방지: 생성 텍스트는 `dangerouslySetInnerHTML` 금지), App Check |
| 개인정보 | 학생 정보 입력 필드 **만들지 않음**. 교사 정보는 ID·표시명만 최소 수집. 보관함은 본인만 열람 |
| 비용 | Firestore 읽기 최소화(캐시), AI 호출 1일 한도(교사별), 한도 초과 안내 |
| 안정성 | 자동 임시저장(작성 중 새로고침 대비 `localStorage` 초안), 낙관적 업데이트 시 충돌 처리 |
| 유지보수 | 모든 AI 프롬프트는 **코드가 아닌 DB 템플릿**으로 관리(버전 기록) |
| 한국어 | 날짜·숫자·줄바꿈(`word-break: keep-all`) 처리, 폰트 Pretendard/Noto Sans KR(로컬 번들 가능) |

---

## 14. 교육적 품질 관리 (이 시스템의 신뢰성 핵심)

1. **교사 검토 우선**: 모든 AI 산출물에 “AI 생성물 — 사용 전 교사 검토” 표기. 저장 시 `reviewedByTeacher` 체크박스 제공.
2. **정합성 표시**: 읽기자료에 사용된 성취기준·핵심 아이디어를 **정합성 배지**로 노출, 범위 이탈 의심 시 경고(핵심 용어 사전과 대조하는 간단한 규칙 + AI 자가점검 프롬프트).
3. **전략의 교육적 적합성**: 전략별 `reviewStatus`(검수 전/후)를 UI에 표시하고, 미검수 전략의 절차는 “초안”임을 명시.
4. **영화 자료 점검 체크리스트**(자료 생성 후 자동 표시):
   - 사실 정확성: 실존 영화의 감독·연도·출연·수상·줄거리 서술이 있는가 → 교사 확인
   - 용어 정확성: 영화 용어(숏, 앵글, 미장센, 몽타주, 장르 등)의 정의가 성취기준 해설과 어긋나지 않는가
   - 다양성: 특정 장르·국가·시대에 치우치지 않았는가
   - 관점: 사회·역사 쟁점을 다룰 때 다양한 관점을 제시했는가
5. **저작권**: 외부 저작물 인용 금지가 기본. 영화 대사·자막·시나리오·스틸 이미지는 넣지 않으며, 인용이 필요하면 교사가 직접 입력하는 별도 필드 사용(출처 표기). 원문 가치·태도에도 “저작자의 노력과 가치를 인정하고 권리를 보호하는 태도”가 있음.
6. **수준 조절**: 같은 자료의 “쉬운 버전/도전 버전” 재생성 버튼(학생 수준 차이 대응).

---

## 15. 열린 질문 (에이전트가 Phase 1 종료 시 사용자에게 확인)

**이미 결정된 사항 (다시 묻지 말 것)**
- 범위: 고등학교 영화 교과 이론·감상 3과목(§1.4)
- 성취기준: `영화과.ttl`에 원문 수록 완료(해설·적용 시 고려 사항 포함)
- 동사 ↔ 독서 기능 연결: 관리자 화면에서 지정(§5.2), 에이전트가 임의로 채우지 않음

**§15 질문 결정 (2026-10-17, 사용자 답변)**

| # | 질문 | 결정 | 반영 위치 |
|---|---|---|---|
| 1 | 성취기준 데이터 | `영화과.ttl`로 제공 (해결) | §3, §5 |
| 2 | AI 연결 방식 | **① Firebase AI Logic(Gemini) + App Check**. 예상 교사 수·월 생성 횟수는 Phase 9에서 확인 | §8.1 |
| 3 | 계정 방식 | **B안: 가입 코드 + 관리자 승인** | §6.2, §6.4, §7, §9 |
| 4 | 대상 학년 입력 | **받음** (1~3, 선택 입력, 어휘 수준 참고용) | §1.2, §8.3 |
| 5 | 한글 출력 | **필요 → HWPX 생성** | §12 Phase 7 |
| 6 | 수업 시간 | **50분과 블록 100분 모두 지원** | §8.5 |
| 7 | 평가 준거 자동 생성 | **생성**(상·중·하, 교사 수정) | §8.5 |
| 8 | 교사 간 공유 | **이번 버전에 포함** (공유 보관함) | §6.4, §7, §9, §12 Phase 6 |
| 9 | 실존 영화 | **교사 입력 + AI 추천 둘 다**. AI 추천은 사실 확인 체크 필수 | §8.3 |
| 10 | 영상 텍스트 유형 | **초기 버전은 글 자료만** | §3.3-7 |
| 추가 | readstrategy.ttl `적용하다` 정의 누락 | **작업본(`data/ttl/working/readstrategy.ttl`)에 정의 한 줄 추가**, 원본은 그대로 | §3.3 |

---

## 16. 에이전트용 초기 프롬프트 (그대로 복사해 사용)

```
첨부한 GUIDE_독서전략기반_수업설계시스템.md(v2)를 끝까지 읽고 아래 순서로 진행해줘.
대상은 고등학교 영화 교과 3과목(영화의 이해, 영화 감상과 비평, 영화와 삶)이야.

1) 코드를 작성하기 전에 구현 계획(Plan)을 먼저 만들어 보여줘.
2) Phase 0~1만 먼저 수행해줘.
   - 프로젝트 골격(Vite+React+TS, Firebase 에뮬레이터, Mock AI 모드)
   - 첨부한 TTL 4개(영화과.ttl, 가네.ttl, text.ttl, readstrategy.ttl)를 실제로 파싱해서 §3.3의 8가지 점검 결과를 표로 정리한 분석 리포트를 Artifact로 제출
3) 영화과.ttl의 성취기준 구조(단원 없음, 영역 → 성취기준, targetFunction·coversElement는 비어 있음)를 반영해 컴파일된 JSON 구조를 제안해줘.
4) 교육과정 원문 내용(성취기준 문구, 해설 등)은 TTL에 있는 값만 쓰고 절대 기억으로 만들어내지 마. 동사→독서 기능 매핑도 임의로 채우지 말고 비워 둬.
5) Phase 1이 끝나면 §15의 열린 질문을 나에게 물어보고 멈춰줘. 내가 답한 뒤 Phase 2로 넘어가자.
6) 모든 Phase는 완료 기준을 직접 테스트하고 결과(스크린샷/테스트 로그)를 남겨줘.
```

---

## 17. 부록

### 17.1 AGENTS.md (저장소 루트에 둘 요약본)
```
# 프로젝트 규칙 (에이전트용)
- 문서: GUIDE_독서전략기반_수업설계시스템.md 가 최상위 명세
- 언어: UI 한국어
- 교육과정 원문(성취기준·해설·고려 사항 등)은 생성 금지, TTL/사용자 제공값만 사용
- 동사→독서 기능 매핑, 성취기준↔내용 요소 연결은 임의로 채우지 않음(관리자 입력)
- 실존 영화의 사실 정보는 단정하지 않음, 영화 대사·시나리오 원문 복제 금지
- 비밀키·서비스계정 커밋 금지
- AI 호출은 반드시 AiProvider 인터페이스 경유, 기본값은 MockProvider
- 변경 시 단위/Rules/E2E 테스트 통과 필수
- Phase 순서를 지키고 완료 기준을 보고
- 원본 TTL(data/ttl/original) 수정 금지, 작업본은 data/ttl/working
```

### 17.2 프롬프트 템플릿 뼈대 (읽기자료)
```
[역할] 당신은 고등학교 영화 교과 <{과목}> 교사를 돕는 읽기자료 작성 도우미입니다.
[맥락] 과목 구분: {진로 선택|융합 선택} / 영역: {영역} / 핵심 아이디어: {…} / 성취기준: {코드 + 원문} / 성취기준 해설: {…} / 적용 시 고려 사항: {…} / 내용요소: {…} / 다룰 영화: {교사 입력 또는 없음}
[요구] 텍스트 유형: {단일|다중, 연속|비연속|혼합, 설명|논증|…} / 분량: {n}자 / 수준: {쉬움|보통|도전}
[제약] 성취기준 범위를 벗어난 개념을 도입하지 않는다. 불확실한 수치·연도는 쓰지 않는다.
       실존 저작물을 복제하지 않는다(영화 대사·자막·시나리오 포함). 어려운 용어는 용어 풀이에 포함한다.
       실존 영화의 감독·연도·출연·줄거리 세부를 단정하지 않는다. 특정 장르·국가·시대에 치우치지 않는다.
[출력] 아래 JSON 스키마만 출력한다(설명·마크다운 금지): {스키마}
```

### 17.3 용어 정리
- **가네 9사태**: 주의 획득 → 학습목표 제시 → 선수학습 재생 → 학습자료 제시 → 학습 지침 제공 → 수행 요구 → 피드백 제공 → 수행 평가 → 파지와 전이
- **독서 기능**: 이해, 탐색, 추론, 예측, 비교, 대조, 분류 등 (`readstrategy.ttl`)
- **텍스트 4기준**: 자료(단일/다중), 조직과 탐색(정적/동적), 체재(연속/비연속/혼합), 유형(기술·서사·설명·논증·지시 등)
- **성취기준 해설 / 적용 시 고려 사항**: 교육과정 원문에서 성취기준마다 붙은 해설, 영역마다 붙은 지도상 유의점. 읽기자료·지도안 생성 시 범위 판단의 근거
- **진로 선택 / 융합 선택 과목**: 2022 개정 고등학교 선택 과목 구분. <영화의 이해>·<영화 감상과 비평>은 진로 선택, <영화와 삶>은 융합 선택

### 17.4 우선순위 요약(MVP 범위)
- **반드시(MVP)**: 로그인 2종 + 가입 신청·승인, 영화 3과목 탐색(성취기준·해설 포함), 읽기자료(Mock→실제, 실존 영화 교사 입력·AI 추천), 전략 추천, 가네 지도안(50/100분, 평가 준거), 저장·내보내기(PDF·DOCX·HWPX), **공유 보관함**, 관리자 계정 관리, TTL 업로드, 독서 기능 연결·동사 매핑 편집기
- **다음 버전**: 영화 실습 3과목, 영상 텍스트 유형, 통계 대시보드, 이미지/차트 자동 생성, 과목 추가 자동 매핑 고도화
