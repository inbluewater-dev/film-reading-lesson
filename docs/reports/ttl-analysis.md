# TTL 분석 리포트 (Phase 1)

- 생성: 2026-10-17 · 대상: `data/ttl/original`의 4개 파일
- 생성 명령: `npm run report:ttl` (내용은 TTL을 실제로 파싱해 계산한 값)

## 1. 파일별 개요와 무결성 점검

| 파일 | 네임스페이스(ex:) | triple | 클래스별 인스턴스 수 | @ko 라벨 |
|---|---|---|---|---|
| `영화과.ttl` | `https://example.org/curriculum/film#` | 861 | Competency 7, Subject 3, FilmUnderstandingSubject 1, LearningArea 8, CoreIdea 17, KnowledgeUnderstanding 28, ProcessSkill 26, ValueAttitude 28, AchievementStandard 32, FilmAppreciationCriticismSubject 1, FilmAndLifeSubject 1 | 158/158 |
| `readstrategy.ttl` | `http://example.org/reading#` | 460 | ReadingFunction 15, ReadingVerb 71, ReadingStrategy 54 | 146/146 |
| `가네.ttl` | `http://example.org/il-lesson/` | 161 | InformationLiteracyLesson 1, InstructionalEvent 9, TeachingStrategy 9, LearningResource 5, LearningActivity 4, AssessmentMethod 1 | 44/44 |
| `text.ttl` | `http://example.org/pisa#` | 116 | TextClassificationCategory 4, TextTypeAttribute 13, TextExample 3 | 0/29 |

| 파일 | 라벨 없는 인스턴스 | 참조되지만 정의 없음 | 고아 노드(최상위 제외, 아무도 참조 안 함) | 중복 라벨 |
|---|---|---|---|---|
| `영화과.ttl` | 없음 | 없음 | 없음 | 없음 |
| `readstrategy.ttl` | 없음 | **Verb_적용하다** | 없음 | 없음 |
| `가네.ttl` | 없음 | 없음 | 없음 | 없음 |
| `text.ttl` | 없음 | 없음 | 없음 | 없음 |

## 2. 가이드 §3.3 점검 항목

| # | 항목 | 점검 결과 | 판정 |
|---|---|---|---|
| 1 | 단원·성취기준 | 성취기준 32개(영화의 이해 15, 영화 감상과 비평 9, 영화와 삶 8). 모든 성취기준에 해설 있음. Unit 클래스 없음(국가 교육과정에 단원 없음) | 해결 — 탐색 경로는 영역 → 성취기준 |
| 2 | 수록 과목 | 영화의 이해(진로 선택 과목), 영화 감상과 비평(진로 선택 과목), 영화와 삶(융합 선택 과목) | 의도적 범위 — 실습 3과목은 Phase 11 |
| 3 | 독서 기능 연결 | targetFunction 지정 0/32. 끝 동사가 읽기 동사와 정확히 일치 10/32 | 관리자 화면에서 매핑 필요(아래 표) |
| 4 | 네임스페이스·속성 충돌 | 4개 파일 모두 접두사 `ex:`이나 IRI가 서로 다름(영화과만 `https://`, 나머지 3개는 `http://`). `hasStrategy`: 가네(InstructionalEvent → TeachingStrategy) / 독서전략(ReadingFunction → ReadingStrategy) | 컴파일 시 cur:/rs:/gagne:/tx: 로 분리 완료 |
| 5 | 가네.ttl 성격 | 수업 인스턴스 1개 “신문 사설의 주장 분석 및 정보 탐색 수업”. 9개 사태의 전략·자료·활동·평가·예시가 모두 이 사설 수업 기준 | 사태 순서·이름만 템플릿으로 쓰고, 전략·예시는 “참고 예시”로 분리 저장 |
| 6 | 독서전략 정보 | 전략 54개 모두 이름만 있음. 확장 속성(procedure·suitableTextType·recommendedEvent·minutes) 없음 | 컴파일 JSON에 빈 필드로 준비, reviewStatus=draft |
| 7 | 영상 텍스트 유형 | 텍스트 속성 13개(단일 텍스트, 다중 텍스트, 정적, 동적, 연속적, 비연속적, 혼합적, 기술, 서사, 설명, 논증, 지시, 교섭). 영상 관련 속성 없음 | §15-10 결정 필요 |
| 8 | 성취기준 ↔ 내용 요소 | coversElement 지정 0/32 | 관리자 편집기에서 선택 입력 |

### 2-1. 성취기준 끝 동사와 읽기 동사 대응 (항목 3 상세)

| 끝 동사(targetVerb) | 성취기준 수 | readstrategy.ttl 대응 기능 |
|---|---|---|
| 탐구하다 | 18 | **없음 — 매핑 필요** |
| 이해하다 | 7 | 이해 |
| 탐색하다 | 2 | **없음 — 매핑 필요** |
| 확장하다 | 1 | **없음 — 매핑 필요** |
| 표현하다 | 1 | 표현 |
| 제작하다 | 1 | **없음 — 매핑 필요** |
| 분석하다 | 1 | 분석 |
| 성찰하다 | 1 | 조절(메타인지) |

과목별로 보면:

| 과목 | 자동 연결 가능 | 매핑 필요 |
|---|---|---|
| 영화의 이해 | 3 | 12 |
| 영화 감상과 비평 | 4 | 5 |
| 영화와 삶 | 3 | 5 |

## 3. 그 밖의 발견 사항

- **readstrategy.ttl에 정의가 빠진 동사**: Verb_적용하다 — ‘적용’ 기능이 참조하지만 `a ex:ReadingVerb ; rdfs:label` 정의 줄이 없음. 컴파일 시 IRI 이름에서 라벨 “적용하다”를 만들고 `labelSource: "iri"`로 표시함. → **결정: 작업본 `data/ttl/working/readstrategy.ttl`에 정의 한 줄 추가**(원본은 보존). 컴파일은 작업본을 우선 사용.
- **여러 기능에 속한 동사** 2개: 예상하다(탐색·예측), 연결하다(비교·관계화) — 추천 시 두 기능 모두 후보가 됨.
- **여러 기능에 속한 전략** 29개 (예: 낱말 접사 만들기, 손 그리기 활동, LEAD 어휘연습, 밑줄 긋기, 빈칸 메우기 …) — 정상(가이드 §3.2).
- **가네 사태 이름이 가이드 표기와 다름** 4곳: 1. 주의 획득 → TTL “주의집중” / 3. 선수학습 재생 → TTL “선수학습 능력 재생” / 6. 수행 요구 → TTL “학생 수행 요구” / 8. 수행 평가 → TTL “성취 행동 평가”. 앱 화면에는 TTL 표기를 사용함.
- **text.ttl 라벨에 언어 태그(@ko)가 없음** — 다른 파일과 달리 일반 문자열. 파싱에는 문제없음.
- **영화과.ttl**: 내용 요소 82개 모두 gradeBand “고등학교”, 영역 8개 중 description 있는 영역 5개(<영화와 삶> 3개 영역은 원문에 영역별 설명 문장이 없어 비어 있음).

## 4. 컴파일 결과

`npm run compile:data` → `data/compiled/` (curriculum.json, reading.json, gagne.json, textTypes.json, manifest.json). 모든 파일이 `src/lib/validation/schemas.ts` 스키마를 통과해야 생성됨.
