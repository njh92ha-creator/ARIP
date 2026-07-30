# ARIP MVP Implementation Plan

## 목표

ARIP Framework v2.0의 핵심 흐름을 실제로 실행 가능한 수직 슬라이스로 구현한다.

## 단계

### 1. Foundation

- Monorepo, Docker Compose, 환경변수 예시
- PostgreSQL/pgvector, Redis, Object Storage 경계
- FastAPI와 React/TypeScript 골격

### 2. Operational Setup

- 회사·회계달력
- 중요성·AVI·데이터 품질
- AI/RAG와 로컬 기준서 경로
- Secret Reference만 저장

### 3. Excel Import

- 파일 저장
- Sheet/Header 자동 탐지
- 반자동 Mapping 제안
- Profile 승인·Revision
- Schema Drift 검증
- 정규화 및 대사

### 4. Accounting Event

- Journal Cluster
- Canonical Signature
- SHA-256 Event Hash
- Pattern Registry
- Analysis Router

### 5. Risk

- Rule-First Template
- Human Review Queue
- Risk Package
- Lifecycle 및 Risk Memory
- AI/RAG Adapter 경계

### 6. AVI

- 정산표 Snapshot
- YTD 수익·비용의 월간 흐름 환산
- MoM/YoY
- 회사별 ANY/ALL Threshold
- Audit Risk와 분리된 Dashboard

### 7. UI

- 로그인
- Dashboard
- Risk/Event/Journal
- Upload/Mapping
- Settings
- Account Variance

### 8. 검증

- 단위 테스트
- API 계약 테스트
- Frontend 빌드
- Docker 구성 검증
- 구현 상태 기록

