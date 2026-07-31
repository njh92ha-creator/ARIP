# 결산 분석세트 및 교차분석 구현 계획

> 상태: 승인된 설계 구현용  
> 기준 설계: `../specs/2026-07-30-closing-set-cross-analysis-design.md`  
> 작업 위치: 사용자가 현재 실행 중인 `ARIP_App` 작업 폴더

## 목적

총계정원장과 정산표를 각각 독립 분석하는 기존 흐름을 중단하고, 동일 회사·회계연도·회계월의 두 파일을 하나의 **결산 분석세트(Closing Analysis Set)** 로 묶어 함께 분석한다. AVI는 독립적인 리스크가 아니라 감사 리스크의 정량 신호로 연결한다.

## 구현 원칙

- 두 입력이 모두 승인되기 전에는 정식 감사 분석을 실행하지 않는다.
- 원장 행마다 LLM을 호출하지 않는다. 원장 → 사건 → 교차 신호 → Router 순서를 유지한다.
- Risk Package에는 원장 근거, 정산표 비교, AVI, 대사 결과 및 AI/규칙 판단 근거를 함께 남긴다.
- 승인되지 않은 지식자료 및 출처 없는 결론은 최종 패키지에 사용하지 않는다.
- 기존 단독 업로드 API는 삭제하지 않고 호환 기능으로 남기되, 화면의 기본 흐름은 결산 분석세트로 변경한다.

## 작업 1 — 도메인·저장소

**대상**

- `backend/app/domain/models.py`
- `backend/app/domain/repository.py`
- 신규: `backend/tests/test_closing_analysis_set.py`

**변경**

1. `ClosingAnalysisSet`을 추가한다. 회사, 회계연도, 월, 각 입력 매핑 Profile, 입력 상태, 분석 상태, 대사 상태, 분석 버전을 보관한다.
2. 정산표의 정규화된 계정잔액을 장기 보관할 `SettlementBalance`를 추가한다.
3. 원장과 정산표의 교차 신호를 저장할 `CrossAnalysisFinding`를 추가한다.
4. `JournalLine`, `AccountingEvent`, `VarianceObservation`, `Risk`, `RiskPackage`에 결산 분석세트와 교차 신호 연결 필드를 추가한다.
5. InMemoryRepository의 영속화 대상, 복원 규칙, 조회 도우미, 상태 Snapshot을 확장한다.

**검증**

- 재시작 후 ClosingAnalysisSet·SettlementBalance·CrossAnalysisFinding이 복원된다.
- 동일 회사/연도/월 결산세트는 하나만 존재한다.

## 작업 2 — 결산세트 분석 서비스

**대상**

- 신규: `backend/app/services/closing_analysis.py`
- `backend/app/services/import_pipeline.py`
- `backend/app/services/variance.py`
- `backend/app/services/event_engine.py`
- `backend/app/services/orchestrator.py`

**변경**

1. 원장 및 정산표를 같은 결산세트에 정규화하여 적재한다.
2. 계정별 원장 순액과 정산표 금액을 대사하고, 비교 불가·차이·중요 차이를 구분한다.
3. 정산표의 전월/전년동월 증감(AVI)을 계산하고 관련 원장/사건에 연결한다.
4. 계정코드·계정명과 전표 적요가 충돌할 수 있는 사실을 교차 신호로 만든다. 예: 단기차입금 + “장기 차입금 차입”.
5. Event Engine이 결산세트 범위에서 사건을 만들고, 교차 신호와 AVI를 이벤트 문맥으로 전달한다.
6. Analysis Router는 Risk Memory 재사용 → Rule/Template → 유사 사례 → RAG+LLM 순서를 유지하되, 교차 신호가 있는 이벤트는 AI 의미 판단 후보로 우선 라우팅한다.
7. AI 결과가 없거나 실패해도 교차 신호와 근거요청을 가진 후보 Risk를 생성한다.

**검증**

- 두 입력 없이 분석을 요청하면 명확히 거부된다.
- 단기차입금 계정에 장기차입 적요가 있는 1억원 이상 사건은 분류·유동성·공시 검토 후보가 된다.
- AVI 결과는 Audit Risk와 연결되지만 별도 점수에 합산되지 않는다.

## 작업 3 — API·작업 흐름

**대상**

- `backend/app/api/router.py`
- 필요 시 `backend/app/api/schemas.py`

**변경**

1. 결산세트 목록·상세·생성 API를 제공한다.
2. 총계정원장/정산표를 각각 결산세트에 첨부하는 업로드 API를 제공한다.
3. 현재 일반원장 Sheet3 강제 선택을 제거하고, 매핑 제안 시 실제 Sheet 목록과 사용자의 선택을 사용한다.
4. 두 Profile이 승인되면 `READY`, 분석 중 `PROCESSING`, 완료 후 `COMPLETED` 상태를 반환한다.
5. 분석 API는 한 번의 비동기 Job으로 정규화·대사·AVI·사건·Risk를 처리한다.
6. API 응답에 입력 준비 상태, 대사 상태, 교차 신호 수, 생성 Event/Risk 수를 포함한다.

**검증**

- 같은 회사·연도·월의 두 업로드가 하나의 결산세트에 연결된다.
- 업로드 재시도는 중복 Journal/Risk를 만들지 않는다.
- JSON API 및 백그라운드 Job이 회사별 데이터 격리를 유지한다.

## 작업 4 — 화면·API 클라이언트

**대상**

- `frontend/src/api.ts`
- `frontend/src/pages/UploadPage.tsx`
- `frontend/src/pages/VariancePage.tsx`
- `frontend/src/pages/RiskPages.tsx`
- 필요 시 `frontend/src/pages/EventPages.tsx`

**변경**

1. Excel Upload 화면을 “결산 분석세트” 중심으로 재구성한다.
2. 회사·회계연도·회계월을 선택하고, 총계정원장과 정산표를 각자 매핑·승인한다.
3. 두 입력이 준비되면 하나의 “결산 분석 실행” 버튼을 활성화한다.
4. 실행 결과에 대사 현황, AVI 경보, 교차 이슈, 사건 수, 감사 Risk 수를 보여준다.
5. AVI 행에서 연결된 Event/Risk/전표로 이동하도록 한다.
6. Risk 상세에서 결산세트, 정산표 증감, 대사 결과, 계정-적요 충돌을 근거 신호로 표시한다.

**검증**

- 파일 하나만 등록된 상태에서는 정식 분석 버튼이 비활성화된다.
- 두 파일의 매핑 승인 뒤 새로고침해도 진행 상태가 유지된다.
- AVI와 Audit Risk가 연결되나 서로의 점수는 독립적으로 표시된다.

## 작업 5 — 테스트·운영 문서·검증

**대상**

- `backend/tests/test_closing_analysis_set.py`
- `backend/tests/test_api_*.py` (필요 범위)
- `IMPLEMENTATION_STATUS.md`
- 신규 또는 보완: `CLOSING_ANALYSIS_SET_STATUS.md`

**변경**

1. 결산세트 생성, 입력 완결성, 원장-정산표 대사, AVI 연결, 적요-계정 충돌, AI 실패 fallback을 단위 시험한다.
2. Python 컴파일 및 단위 테스트를 실행한다.
3. 프론트엔드 빌드는 현 환경에서 가능하면 실행하고, 불가능하면 Docker에서 검증할 명령을 기록한다.
4. 실행 방법, 업로드 순서, 기존 단독 업로드와의 차이를 상태 문서에 기록한다.

**완료 기준**

- 사용자는 같은 월의 총계정원장과 정산표를 함께 올려 결산 분석세트를 만들 수 있다.
- 분석은 AVI뿐 아니라 Event/Risk를 동시에 생성한다.
- 단기/장기 차입 분류 불일치 같은 사건이 Audit Risk로 표시된다.
- 결과와 이력이 Neon/PostgreSQL 영속 저장소에 남는다.
