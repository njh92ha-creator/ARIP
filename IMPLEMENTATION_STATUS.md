# ARIP MVP Implementation Status

## 상태

ARIP MVP v0.1 수직 슬라이스 구현 완료.

## 구현 결과

- FastAPI API와 React/TypeScript UI 소스 구성
- PostgreSQL/pgvector, Redis, MinIO, Celery Docker 구성
- 총계정원장 Sheet3 반자동 Mapping 및 승인 Profile
- 정산표 Mapping 및 AVI 실행 API/UI
- 정규화, 차대 대사, 중복 Hash
- Journal Cluster, Accounting Event, Canonical Signature, SHA-256 Event Hash
- Rule Template, Risk Package, Lifecycle, Risk Memory
- 회사·회계연도·중요성·AVI·AI/RAG·기준서 폴더 설정
- 로컬 기준서 스캔 → PENDING → 승인 경계
- 역할 3종 데모 RBAC 경계
- Audit Risk Dashboard와 AVI Dashboard 분리

## 완료 기준

- [x] Backend Python 문법 검증
- [x] 회사·설정 API 구현
- [x] Excel Mapping
- [x] Normalization/Reconciliation
- [x] Event/Hash
- [x] Rule Risk/Package
- [x] AVI
- [x] Dashboard
- [x] Unit Test 3건
- [x] 실제 회사 총계정원장 양식 Sheet3/Header/필수 Mapping 검증
- [x] 10만 행 합성 Event 파이프라인 Benchmark
- [ ] FastAPI 통합 실행 — 현재 실행환경에 FastAPI 패키지 미설치
- [ ] Frontend Build — 현재 실행환경의 NPM 네트워크 접근 제한
- [ ] PostgreSQL Migration 실행 — 현재 실행환경에 Docker/PostgreSQL 미설치
- [ ] Docker Compose 통합 검증 — 현재 실행환경에 Docker 미설치

## 검증 수치

- Python Unit Test: 3/3 PASS
- 실제 회사 양식: `Sheet3`, Header Row 2, 필수 Mapping 누락 0
- 합성 100,000행: 50,000 Event 구성, 약 1.24초
- 합성 Benchmark는 Excel 파싱·DB I/O·Queue·RAG/LLM을 제외한 순수 메모리 도메인 처리 수치이며 운영 SLA를 의미하지 않는다.

## 운영 전 남은 작업

1. 의존성 설치 후 API/Frontend 통합 테스트
2. PostgreSQL Repository Adapter 연결 및 재시작 영속성 검증
3. 회사 승인 SSO/OIDC 연결
4. 실제 Secret Manager 연결
5. 승인된 기준서 Corpus와 Citation 검증
6. 실제 월 50만 행 파일로 성능·대사·복구 시험
7. 브랜드·보안·보존기간 승인
