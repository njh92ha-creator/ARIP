# ARIP 결산 세트 교차분석 설계

## 목적

ARIP의 분석 단위를 개별 업로드 파일에서 **결산 분석 세트(Closing Analysis Set)** 로 변경한다.

결산 분석 세트는 하나의 회사, 회계연도, 회계월에 귀속되는 다음 두 자료를 함께 보유한다.

- 총계정원장: 전표, 계정, 상대계정, 적요, 거래의 발생 원인
- 정산표: 계정별 기말잔액, 수익·비용 누적금액, 계정 증감 및 재무제표 관점의 결과

두 자료는 서로 독립적인 분석 결과를 만드는 입력물이 아니다. ARIP는 두 자료를 대사하고, 증감과 전표 의미를 함께 사용해 하나의 Audit Risk Package를 만든다.

## 핵심 원칙

1. Audit Risk는 ARIP의 주 결과물이다.
2. AVI(Account Variance Intelligence)는 별도의 리스크 체계가 아니라 Audit Risk의 탐지 신호 및 드릴다운 관점이다.
3. 총계정원장은 거래의 원인과 회계사건을 설명하고, 정산표는 해당 사건의 잔액·증감·중요성을 설명한다.
4. AI는 전표 행마다 호출하지 않는다. 대사와 이벤트 그룹화 뒤 생성된 회계사건을 분석한다.
5. AI는 회계오류를 확정하지 않는다. 근거, 검토 필요사항, 예상 감사질문 및 필요한 증빙을 제시한다.
6. 두 파일 중 하나만 준비된 상태에서는 초안 데이터만 저장한다. 완전한 Audit Risk 분석은 두 파일이 동일 회사·연도·월로 연결된 후 실행한다.

## 사용자 흐름

```text
회사·기간 선택
  ├─ 총계정원장 업로드 → 매핑 승인 → 원장 초안 저장
  └─ 정산표 업로드 → 매핑 승인 → 정산표 초안 저장
                 ↓
       결산 세트 완성 여부 검증
                 ↓
     [결산 교차분석 실행]
                 ↓
  대사 → AVI → 원장 Event → AI 의미 분석 → Risk 통합
                 ↓
       Audit Risk Dashboard / Event / Journal Drill-down
```

## 도메인 모델

### ClosingAnalysisSet

필수 속성:

- `id`
- `company_id`
- `fiscal_year`
- `fiscal_period`
- `general_ledger_upload_id`
- `settlement_schedule_upload_id`
- `status`: `DRAFT`, `READY`, `PROCESSING`, `COMPLETED`, `FAILED`
- `reconciliation_status`: `PENDING`, `MATCHED`, `MISMATCHED`, `NOT_COMPARABLE`
- `analysis_version`
- `created_at`, `completed_at`

동일 회사·연도·월에는 활성 결산 세트가 하나만 존재한다. 새 파일을 올리면 기존 결산 세트의 새 분석 버전을 생성하거나 명시적으로 교체한다. 과거 분석 결과는 삭제하지 않는다.

### CrossAnalysisFinding

교차분석에서 발견된 구조화된 신호다. 독립적인 Audit Risk가 아니라 Risk 생성의 근거 또는 트리거다.

- `GL_SETTLEMENT_RECONCILIATION_DIFFERENCE`
- `MATERIAL_VARIANCE`
- `ACCOUNT_DESCRIPTION_CLASSIFICATION_CONFLICT`
- `PERIOD_CUTOFF_ANOMALY`
- `MISSING_COUNTERPART_OR_EVIDENCE`

각 Finding은 연결된 계정, 정산표 잔액, 원장 전표 행, 이벤트 및 중요성 기준을 가진다.

## 처리 파이프라인

### 1. 정규화와 대사

- 총계정원장은 차변·대변, 전표일자, 계정코드, 계정명, 적요를 정규화한다.
- 정산표는 자산·부채·자본·가계정의 기말잔액과 수익·비용의 누적잔액을 정규화한다.
- 수익·비용은 정산표 누적값을 직전월 누적값과 비교해 월간 흐름으로 환산한다.
- 계정코드를 기본 연결키로 하고 계정명이 다르면 경고를 남긴다.
- 원장 계정별 순액·기말잔액과 정산표 금액을 비교한다.
- 비교 불가능한 계정, 매핑 누락, 허용오차 초과 차이는 Finding으로 저장한다.

### 2. AVI를 Audit Risk 트리거로 전환

- 설정된 중요성 금액, 증감률, 최소 기준금액, `ANY`/`ALL` 조건으로 계정 증감을 판정한다.
- AVI가 Trigger되면 연결 계정의 원장 전표와 Event를 검색한다.
- AVI 결과는 `MATERIAL_VARIANCE` Finding으로 저장된다.
- Account Variance 화면은 독립 점수 화면이 아니라 Finding 목록과 원장/Event/Risk 링크를 제공한다.

### 3. 회계사건 및 의미 충돌 탐지

- 원장은 전표번호, 계약·프로젝트, 기간을 기준으로 클러스터링한다.
- Event Signature와 Hash를 생성해 동일 반복 사건을 재사용한다.
- 계정명·계정코드와 적요·상대계정의 의미 충돌을 구조화된 Finding으로 생성한다.
- 예: `단기차입금` 계정 + `장기 차입금 차입` 적요 + 중요 금액 증가는 `ACCOUNT_DESCRIPTION_CLASSIFICATION_CONFLICT` Finding이다.

### 4. AI 분석

AI에는 다음의 축약된 사건 문맥만 전달한다.

- Event의 계정·상대계정·적요·금액·차대구분
- 해당 계정의 정산표 기말잔액, 전월/전년 비교, AVI Trigger
- 원장-정산표 대사 결과
- 승인된 회계기준·질의회신·사례의 검색 문단

AI 호출 순서:

1. 동일 Event Hash Risk Memory 재사용
2. Rule/Template Risk 적용
3. 교차분석 Finding이 있는 신규 Event에 한해 RAG + LLM 호출
4. 근거가 있으면 evidence-backed Risk Package 생성
5. 근거가 부족하면 `EVIDENCE_ENRICHMENT_REQUIRED` 후보 생성

AI 호출 실패는 결산 분석을 멈추지 않는다. 해당 Event에는 인간 검토용 후보와 실패 이력을 남긴다.

### 5. Risk 통합

한 Event에 다수의 신호가 있어도 하나의 중복되지 않은 Risk Package로 통합한다.

Risk Package는 다음을 포함한다.

- Risk 요약과 중요성
- 연결된 AVI·대사·의미충돌 Finding
- 관련 계정·정산표 잔액·증감 및 관련 전표
- 승인된 기준서 및 사례 인용
- 예상 감사 질문
- 필요 증빙 및 대응 가이드
- Lifecycle과 Risk Memory

## 화면 변경

### Excel Upload & Mapping

- 회사·회계연도·회계월 선택을 필수로 한다.
- 총계정원장과 정산표의 업로드 상태를 같은 결산 세트 카드에 표시한다.
- 두 파일이 모두 승인되기 전에는 `교차분석 실행` 버튼을 비활성화한다.
- 두 파일이 준비되면 단일 `결산 교차분석 실행` 버튼을 제공한다.

### Audit Risk

- 기본 목록은 결산 세트에서 생성된 통합 Risk다.
- 각 Risk에서 AVI, 대사 차이, Event, Journal로 드릴다운한다.
- `근거보강 필요` Risk와 근거 인용 완료 Risk를 명확히 구분한다.

### Account Variance Intelligence

- 기존 증감 계산을 유지한다.
- 각 행에 `연결 Risk`, `연결 Event`, `원장 전표` 링크를 추가한다.
- Audit Risk에서 분리된 별도 Risk 점수나 독립 종결 상태를 만들지 않는다.

## 실패 처리 및 감사성

- 파일 매핑 오류: 해당 파일을 `DRAFT`로 유지하고 교차분석을 차단한다.
- 원장-정산표 대사 차이: 분석을 중단하지 않고 고위험 Finding으로 생성한다.
- AI 오류: Event와 대사 결과는 보존하고 사람이 검토할 후보를 생성한다.
- 모든 업로드, 매핑 승인, 결산 세트 실행, Risk 생성, AI 호출 실패는 Append-only Audit Log에 기록한다.

## 수용 기준

1. 동일 회사·연도·월의 총계정원장과 정산표가 있어야 정식 교차분석을 실행할 수 있다.
2. 정산표만 실행한 AVI 결과는 Audit Risk를 생성하지 않으며, 결산 세트 실행 시에만 통합된다.
3. 총계정원장과 정산표의 계정별 대사 결과가 저장되고 Risk Drill-down으로 추적 가능하다.
4. 중요한 AVI 계정은 연결된 원장 Event를 AI 분석 입력으로 사용한다.
5. 단기차입금 계정과 장기차입 적요의 불일치가 포함된 1억원 Event는 Audit Risk 후보로 생성된다.
6. AI가 비활성·실패한 경우에도 같은 Event는 사람 검토 후보로 생성된다.
7. 기존 AVI 화면의 관측치는 Audit Risk와 Event를 링크할 수 있다.

## 범위 제외

- ERP 직접 연동
- 자동 전표 수정 또는 회계처리 승인
- 미승인 외부 지식의 자동 인용
- 초기 버전의 ML 학습 및 자동 모델 재학습
