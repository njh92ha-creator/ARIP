# ARIP MVP

ARIP Framework v2.0을 실행 가능한 수직 슬라이스로 구현한 초기 애플리케이션이다.

현재 구현 범위:

- 회사·회계연도·중요성·AVI·AI/RAG 설정
- 총계정원장 및 정산표 Excel 반자동 열 매핑
- 승인된 매핑 프로필 기반 정규화
- 전표 대사와 중복 방지
- Journal Clustering, Accounting Event, Canonical Signature, Event Hash
- Rule-First 분석과 Human Review 대기열
- Risk, Risk Package, Lifecycle, Risk Memory
- 전월·전년동월 계정 증감 분석(AVI)
- 담당자/팀장 대시보드 및 주요 업무 화면
- Append-only 감사로그

## 빠른 실행

### Docker

```bash
docker compose up --build
```

- Web: `http://localhost:3000`
- API: `http://localhost:8000/docs`
- PostgreSQL: `localhost:5432`

### 로컬 개발

Backend:

```bash
cd backend
python -m venv .venv
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Frontend:

```bash
cd frontend
pnpm install
pnpm dev
```

## 운영 전 필수 설정

1. 회사·업종·기능통화·회계연도
2. 중요성 Profile
3. AVI Threshold Profile
4. 총계정원장/정산표 Mapping Profile
5. 데이터 품질 Gate
6. AI Secret Reference와 모델
7. 기준서 로컬 폴더

API 키 원문은 애플리케이션 DB에 저장하지 않는다. `OPENAI_API_KEY` 같은 환경변수 또는 Secret Manager를 사용한다.

## 보안상 기본값

- 실제 외부 AI 호출은 `ARIP_ENABLE_EXTERNAL_AI=false`일 때 비활성화된다.
- 승인되지 않은 Knowledge는 검색에 포함되지 않는다.
- 전표 행별 LLM 호출은 금지한다.
- AVI 결과는 Audit Risk를 자동 생성하지 않는다.
- 모든 승인·상태 변경은 Audit Log에 기록한다.

## 문서

- [구현 계획](IMPLEMENTATION_PLAN.md)
- [구현 결정](IMPLEMENTATION_DECISIONS.md)
- [구현 상태](IMPLEMENTATION_STATUS.md)

## 현재 구현 단계

이 산출물은 실행 가능한 MVP 수직 슬라이스와 운영 인프라 정의를 포함한다. 도메인 단위 테스트와 실제 회사 원장 양식의 Mapping 검증은 완료했다. 현재 작업환경에는 Docker와 외부 패키지 다운로드 권한이 없어 PostgreSQL·Frontend 통합 실행은 별도 개발환경에서 `docker compose up --build`로 검증해야 한다. 상세한 통과·미검증 항목은 `IMPLEMENTATION_STATUS.md`를 참조한다.
