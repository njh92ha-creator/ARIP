# AI 감사 검토 출력 설계

## 목표

RAG를 호출하지 않는 외부 AI 분석이 전표별 감사 검토 결과를 구조화해 반환하고, 리스크 상세 화면의 기존 영역에 그 결과를 표시한다.

## 입력과 처리

- 분석 단위는 동일 전표번호의 원장 행이다.
- AI에는 계정, 적요, 차대변, 금액, 전기일 및 같은 유형의 전표 수를 전달한다.
- 업로드된 RAG 청크는 검색하거나 프롬프트에 전달하지 않는다.
- AI는 오류를 확정하지 않고 감사 이슈와 확인 필요 사실을 구분한다.

## 출력 계약

- `relatedAccounts`: 대표 관련 계정 목록
- `voucherCount`: 같은 유형의 전표 수
- `eventInference`: 전표 사실로부터 추론한 회계사건
- `auditIssues`: 해당 회계사건의 감사 이슈 목록
- `riskSummary`: 회계사건 추론, 감사 이슈 및 판단 한계를 포함한 한국어 서술
- `expectedQuestions`, `evidenceChecklist`: 검토 질문과 권장 증빙
- `standardsEvidence`: 검증 가능한 K-IFRS 문단, 한국회계기준원 질의회신 URL, IFRIC URL만 포함하는 근거 목록
- `ledgerEvidence`: 해당 전표의 원장 요약
- `missingFacts`, `uncertainty`, `issueTypes`

## 근거 제한

- RAG와 외부 웹 검색을 사용하지 않는 현재 분석 경로에서 AI가 확인할 수 없는 기준서 문단, 한국회계기준원 질의회신 URL, IFRIC URL은 빈 목록으로 반환한다.
- 임의로 문단, 본문, URL을 생성하지 않는다.

## 화면 매핑

- 분석 입력 근거: `relatedAccounts`, `voucherCount`
- 분석 결과: `eventInference`, `auditIssues`, `riskSummary`
- 검토 질문: `expectedQuestions`
- 권장 증빙: `evidenceChecklist`
- 기준서 검색 근거: `standardsEvidence`
- 원장 근거: `ledgerEvidence`
