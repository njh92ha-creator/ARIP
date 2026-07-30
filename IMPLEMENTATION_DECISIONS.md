# ARIP MVP Implementation Decisions

## DEC-001 — FastAPI 선택

Excel 처리·회계 데이터 파이프라인·향후 통계/ML 생태계와의 결합을 위해 FastAPI를 선택한다. 도메인 로직은 FastAPI와 분리된 순수 Python 모듈로 유지한다.

## DEC-002 — React + TypeScript + Vite

문서의 React 요구사항과 화면 수를 고려해 Vite 기반 React SPA를 사용한다. 서버 상태는 TanStack Query, UI는 MUI를 사용한다.

## DEC-003 — PostgreSQL 운영, SQLite 개발 보조

운영 기준은 PostgreSQL + pgvector다. 로컬 단위 테스트는 외부 서비스 없이 검증할 수 있도록 In-memory Repository를 사용한다. SQLite는 운영 대체재로 간주하지 않는다.

## DEC-004 — Celery + Redis 비동기 경계

월 50만 행 처리와 재시도를 위해 Celery/Redis를 기본 비동기 구성으로 둔다. 도메인 작업은 동기 함수로도 호출 가능해 테스트와 재처리를 단순화한다.

## DEC-005 — Excel Only

Framework Volume 2의 ERP API 범위보다 최신 Volume 25의 Excel-only 초기 운영 결정을 우선한다. ERP Connector 인터페이스는 두되 구현하지 않는다.

## DEC-006 — Sheet3 고정은 총계정원장 회사 Profile에만 적용

제공 회사 양식의 총계정원장은 Sheet1/Sheet2를 무시하고 Sheet3만 사용한다. 정산표는 별도 자동 탐지·승인 Profile을 사용한다.

## DEC-007 — Rule First, LLM Last

정규화·대사·Hash·AVI·Threshold는 결정론적으로 수행한다. AI는 낮은 분류 신뢰도, 신규·고중요성·기준서 범위 모호성에만 사용한다.

## DEC-008 — AI 미설정 시 기능 저하 운전

Secret이 없으면 Excel, Event Hash, Rule Risk, AVI, Dashboard는 계속 동작한다. AI 대상 Event는 `AI_UNAVAILABLE` 또는 `REVIEW_REQUIRED`로 남긴다.

## DEC-009 — Risk와 AVI 분리

AVI Observation은 Risk Aggregate와 독립 저장한다. 사용자가 사유를 입력해 명시적으로 연결하기 전에는 Risk를 생성하거나 Score에 합산하지 않는다.

## DEC-010 — 인증 MVP 경계

MVP에는 역할별 데모 세션과 RBAC 미들웨어를 제공한다. 운영 SSO/OIDC 연결은 Adapter 경계와 환경설정만 제공하며 실제 IdP 연동은 배포 환경 결정 후 수행한다.

## DEC-011 — Object Storage

업로드 원본과 증빙은 S3 호환 Object Storage(MinIO 개발환경)에 저장한다. DB에는 Object Key, Hash, Metadata만 저장한다.

## DEC-012 — Hot/Warm/Cold

MVP는 Tier Metadata와 Restore API 경계를 구현한다. 실제 장기 Archive 전환은 보존정책 승인 이후 운영 Job으로 활성화한다.

## 확인된 문서 위험과 보수적 해석

- Volume 17에는 9개 화면이라고 쓰면서 SCR-010 이상이 Addendum으로 추가되어 있다. 구현 Navigation은 최신 Addendum을 포함한다.
- Lifecycle UI의 `Resolved`는 Domain의 `DORMANT`와 완전히 같지 않다. API에는 Domain 상태를 저장하고 UI Label만 매핑한다.
- 전 계정과목 지원은 데이터 구조 범위이며 모든 계정별 전문 Rule이 완성됐다는 의미로 해석하지 않는다.
- 성능 목표는 운영 인프라와 실제 회사 파일로 부하시험 후 확정한다. MVP에는 Chunk 처리·Idempotency·Partition DDL·측정 지표를 포함한다.

