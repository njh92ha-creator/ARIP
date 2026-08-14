from __future__ import annotations

import os
import json
import hashlib
import hmac
import secrets
import httpx
import shutil
import tempfile
from copy import deepcopy
from dataclasses import asdict
from decimal import Decimal
from enum import Enum
from pathlib import Path
from typing import Any
from urllib.parse import quote
from uuid import UUID, NAMESPACE_URL, uuid4, uuid5

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Query, Response, UploadFile
from fastapi.encoders import jsonable_encoder

from app.api.schemas import (
    AiConnectionInput,
    AiConnectionTestInput,
    AccountCredentials,
    CompanyCreate,
    CompanyUpdate,
    KnowledgeSourceInput,
    MappingApprove,
    MaterialityCreate,
    RiskDelete,
    RiskReviewAnswerUpdate,
    RiskReviewQuestionAssessmentRequest,
    RiskReviewQuestionStatusUpdate,
    RiskReviewCaseDecision,
    RiskReviewExposureUpdate,
    RiskReviewRemediationActionsUpdate,
    RiskReviewCaseSeverity,
    RiskReviewDecision,
    RiskReviewTransfer,
    RiskSeverity,
    RiskTransition,
)
from app.domain.models import (
    AccountingEvent,
    AuditLogEntry,
    CompanySettings,
    CrossAnalysisFinding,
    JournalLine,
    MappingProfile,
    MappingStatus,
    MaterialityProfile,
    RiskMemoryEntry,
    Risk,
    RiskLevel,
    RiskReviewAttachment,
    RiskReviewCase,
    RiskReviewQuestionAssessment,
    RiskStatus,
    UserAccount,
)
from app.domain.repository import repository
from app.core.security import (
    CurrentUser,
    Role,
    current_user,
    require_review_roles,
    require_roles,
)
from app.core.database import check_database
from app.services.risk_timestamps import latest_analysis_at
from app.services.risk_review import (
    REVIEW_DECISIONS,
    RISK_SEVERITIES,
    current_review_decision,
    current_risk_severity,
    is_visible_in_risk_lists,
    recommend_review_decision,
    recommend_risk_severity,
)
from app.services.import_pipeline import normalize_general_ledger, normalize_settlement
from app.services.mapping import propose_mapping
from app.services.orchestrator import process_journals
from app.services.ai_risk_analysis import assign_risk_code
from app.ai.provider import KIFRS_EVENT_ANALYSIS_PROMPT
from app.services.risk_review_transfer_summary import summarize_for_review_transfer
from app.services.review_question_assessment import assess_review_question
from app.services.review_overall_assessment import assess_review_overall
from app.services.knowledge_rag import KnowledgeIndexError, delete_indexed_document, index_document
from app.services.closing_analysis import (
    analyze_closing_analysis_set,
    analyze_queued_closing_event,
    attach_general_ledger,
    attach_settlement_schedule,
    create_closing_analysis_set,
    queue_closing_analysis_events,
    settlement_balances_from_rows,
)

router = APIRouter()
_RUNTIME_SETTINGS_PATH = Path(os.getenv("ARIP_RUNTIME_SETTINGS_PATH", "/app/data/runtime_settings.json"))
runtime_settings: dict[str, Any] = {
    "sourceMode": "EXCEL_ONLY",
    "aiConnection": {
        "configured": False,
        "enabled": False,
        "secretReference": None,
    },
    "knowledgeSources": [],
}


def _load_runtime_settings() -> None:
    """Load non-secret runtime settings from PostgreSQL, with a local-file fallback."""
    global runtime_settings
    stored = repository.get_runtime_setting("global")
    if isinstance(stored, dict):
        runtime_settings.update(stored)
        return
    try:
        if _RUNTIME_SETTINGS_PATH.exists():
            stored = json.loads(_RUNTIME_SETTINGS_PATH.read_text(encoding="utf-8"))
            if isinstance(stored, dict):
                runtime_settings.update(stored)
    except (OSError, json.JSONDecodeError):
        # A corrupt/unavailable settings file must not prevent the API from starting.
        pass


def _save_runtime_settings() -> None:
    repository.save_runtime_setting("global", runtime_settings)
    if repository._db_ready:
        return
    try:
        _RUNTIME_SETTINGS_PATH.parent.mkdir(parents=True, exist_ok=True)
        temporary = _RUNTIME_SETTINGS_PATH.with_suffix(".tmp")
        temporary.write_text(json.dumps(runtime_settings, ensure_ascii=False, indent=2), encoding="utf-8")
        temporary.replace(_RUNTIME_SETTINGS_PATH)
    except OSError:
        # Vercel's application directory is read-only; the in-memory setting still works.
        pass


def _ai_runtime_options() -> dict[str, Any]:
    """Return non-secret AI execution controls saved from the Settings screen."""
    connection = runtime_settings.get("aiConnection", {})
    secret_reference = str(connection.get("secretReference") or "env:OPENAI_API_KEY")
    return {
        "external_ai_enabled": bool(connection.get("enabled")),
        "ai_model": str(connection.get("chatModel") or "gpt-4o-mini"),
        "ai_provider": str(connection.get("provider") or "openai"),
        "ai_key_env": secret_reference.removeprefix("env:") if secret_reference.startswith("env:") else None,
        "embedding_model": str(connection.get("embeddingModel") or "text-embedding-3-large"),
    }


_load_runtime_settings()
knowledge_candidates: dict[str, dict[str, Any]] = repository.get_runtime_setting(
    "knowledge-candidates", {}
)
jobs: dict[str, dict[str, Any]] = {}


def _save_knowledge_candidates() -> None:
    repository.save_runtime_setting("knowledge-candidates", knowledge_candidates)


def _index_knowledge_candidate(
    *, candidate_id: str, company_id: UUID, filename: str, content: bytes, content_hash: str,
) -> dict[str, Any]:
    options = _ai_runtime_options()
    key_env = options["ai_key_env"] or "OPENAI_API_KEY"
    api_key = os.getenv(key_env)
    if not options["external_ai_enabled"] or not api_key:
        raise KnowledgeIndexError("AI 연결이 활성화되어 있고 서버 API 키가 설정되어 있어야 RAG 인덱스를 생성할 수 있습니다.")
    return index_document(
        candidate_id=candidate_id, company_id=company_id, filename=filename,
        content=content, content_hash=content_hash, provider=options["ai_provider"],
        api_key=api_key, embedding_model=options["embedding_model"],
    )


def encode(value: Any) -> Any:
    return jsonable_encoder(value, custom_encoder={Decimal: str})


def _attachment_content_disposition(filename: str) -> str:
    normalized = filename.replace("\\", "/").rsplit("/", 1)[-1]
    fallback = "".join(
        character
        if 0x20 <= ord(character) < 0x7F and character not in {'"', "\\", ";"}
        else "_"
        for character in normalized
    ).strip(" .")
    fallback = fallback[:150] or "attachment"
    return (
        f"attachment; filename=\"{fallback}\"; "
        f"filename*=UTF-8''{quote(normalized, safe='')}"
    )


def _reload_current_database_state() -> None:
    """Use the database as the source of truth for each list/dashboard read."""
    repository.reload_from_database()
    if not repository._db_ready:
        raise HTTPException(503, "database read failed")


def _database_collection(collection: str, fallback: dict[UUID, Any]) -> list[Any]:
    """Read a single current collection instead of restoring all application state."""
    if repository._db_ready:
        try:
            return repository.database_state_objects(collection)
        except RuntimeError as exc:
            raise HTTPException(503, "database read failed") from exc
    return list(fallback.values())


def _database_object(collection: str, object_id: UUID, fallback: dict[UUID, Any]) -> Any | None:
    if repository._db_ready:
        try:
            return repository.database_state_object(collection, object_id)
        except RuntimeError as exc:
            raise HTTPException(503, "database read failed") from exc
    return fallback.get(object_id)


def _database_risk_memory() -> dict[UUID, list[RiskMemoryEntry]]:
    if repository._db_ready:
        try:
            entries = repository.database_log_entries("risk_memory")
        except RuntimeError as exc:
            raise HTTPException(503, "database read failed") from exc
    else:
        return repository.risk_memory
    grouped: dict[UUID, list[RiskMemoryEntry]] = {}
    for entry in entries:
        if isinstance(entry, RiskMemoryEntry):
            grouped.setdefault(entry.risk_id, []).append(entry)
    return grouped


def _database_transferred_risk_ids() -> set[UUID]:
    if repository._db_ready:
        try:
            markers = repository.database_state_objects("RiskReviewTransfer")
        except RuntimeError as exc:
            raise HTTPException(503, "database read failed") from exc
    else:
        markers = []
    result: set[UUID] = set()
    for marker in markers:
        if isinstance(marker, dict) and marker.get("source_risk_id"):
            try:
                result.add(UUID(str(marker["source_risk_id"])))
            except ValueError:
                continue
    return result


def _risk_list_payload(risk: Risk, memories: dict[UUID, list[RiskMemoryEntry]]) -> dict[str, Any]:
    memory = memories.get(risk.id, [])
    return {
        **encode(risk),
        "analyzed_at": latest_analysis_at(memory),
        "review_decision": current_review_decision(memory),
        "severity": current_risk_severity(memory, risk.level.value),
        "review_recommendation": None,
        "severity_recommendation": None,
    }


def _entity(store: dict[UUID, Any], entity_id: UUID, name: str) -> Any:
    entity = store.get(entity_id)
    if not entity:
        raise HTTPException(404, f"{name} not found")
    return entity


def _save_upload(upload: UploadFile) -> Path:
    suffix = Path(upload.filename or "upload.xlsx").suffix or ".xlsx"
    handle = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    try:
        shutil.copyfileobj(upload.file, handle)
    finally:
        handle.close()
    return Path(handle.name)


def _process_gl_job(
    job_id: str,
    path: Path,
    company_id: UUID,
    profile: MappingProfile,
) -> None:
    job = jobs[job_id]
    try:
        job.update(status="RUNNING", stage="NORMALIZATION")
        lines, reconciliation = normalize_general_ledger(
            path,
            company_id,
            profile,
            repository.processed_source_hashes,
        )
        job["processedRows"] = reconciliation.source_rows
        job["reconciliation"] = encode(reconciliation)
        if not reconciliation.balanced:
            job.update(status="FAILED", stage="RECONCILIATION")
            return
        job.update(stage="EVENT_HASH")
        result = process_journals(
            repository,
            lines,
            actor="system",
            knowledge_candidates=knowledge_candidates,
            **_ai_runtime_options(),
        )
        job.update(status="COMPLETED", stage="COMPLETE", result=result)
    except Exception as exc:
        job.update(status="FAILED", stage="ERROR", error=str(exc))
    finally:
        path.unlink(missing_ok=True)


@router.get("/health")
def health() -> dict[str, Any]:
    database_ok, database_error = check_database()
    return {
        "status": "ok",
        "sourceMode": "EXCEL_ONLY",
        "database": {"connected": database_ok, "error": database_error},
        "persistence": {
            "enabled": repository._db_ready,
            "error": repository.last_db_error,
        },
        "snapshot": repository.snapshot(),
    }


@router.post("/auth/demo-login")
def demo_login(user: CurrentUser = Depends(current_user)) -> Any:
    return {
        "userId": user.user_id,
        "role": user.role.value,
        "companyId": str(user.company_id) if user.company_id else None,
        "companyIds": sorted(str(company_id) for company_id in user.company_ids),
        "mode": "DEMO_HEADER_AUTH",
        "warning": "운영 배포 시 OIDC/SSO Adapter로 교체해야 합니다.",
    }


def _account_id(email: str) -> UUID:
    return uuid5(NAMESPACE_URL, f"arip-user:{email}")


def _password_digest(password: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 200_000).hex()


@router.post("/auth/signup", status_code=201)
def signup(payload: AccountCredentials) -> Any:
    account_id = _account_id(payload.email)
    existing = repository.database_state_object("UserAccount", account_id) if repository._db_ready else repository.user_accounts.get(account_id)
    if existing is not None:
        raise HTTPException(409, "email is already registered")
    salt = secrets.token_hex(16)
    account = UserAccount(
        id=account_id,
        email=payload.email,
        password_salt=salt,
        password_hash=_password_digest(payload.password, salt),
    )
    repository.save(account)
    return {"email": account.email}


@router.post("/auth/login")
def login(payload: AccountCredentials) -> Any:
    account_id = _account_id(payload.email)
    account = repository.database_state_object("UserAccount", account_id) if repository._db_ready else repository.user_accounts.get(account_id)
    if not isinstance(account, UserAccount) or not hmac.compare_digest(
        account.password_hash, _password_digest(payload.password, account.password_salt)
    ):
        raise HTTPException(401, "email or password is incorrect")
    return {"email": account.email}


@router.post("/runtime/reload-from-database")
def reload_runtime_from_database() -> dict[str, Any]:
    """Manually synchronize this backend instance with the current DB state."""
    repository.reload_from_database()
    if not repository._db_ready:
        raise HTTPException(503, "database reload failed")
    _load_runtime_settings()
    return {"status": "COMPLETED", "snapshot": repository.snapshot()}


@router.get("/auth/me")
def get_me(user: CurrentUser = Depends(current_user)) -> Any:
    return {
        "userId": user.user_id,
        "role": user.role.value,
        "companyId": str(user.company_id) if user.company_id else None,
        "companyIds": sorted(str(company_id) for company_id in user.company_ids),
    }


@router.post("/companies", status_code=201)
def create_company(
    payload: CompanyCreate,
    user: CurrentUser = Depends(require_roles(Role.ADMIN)),
) -> Any:
    company = repository.save(CompanySettings(**payload.model_dump()))
    repository.append_audit(
        AuditLogEntry(
            action="COMPANY_CREATED",
            resource_type="Company",
            resource_id=str(company.id),
            actor=user.user_id,
            company_id=company.id,
        )
    )
    return encode(company)


@router.get("/companies")
def list_companies() -> Any:
    return encode(_database_collection("CompanySettings", repository.companies))


@router.patch("/companies/{company_id}")
def update_company(
    company_id: UUID,
    payload: CompanyUpdate,
    user: CurrentUser = Depends(require_roles(Role.ADMIN)),
) -> Any:
    _entity(repository.companies, company_id, "company")
    company = repository.save(CompanySettings(id=company_id, **payload.model_dump()))
    repository.append_audit(AuditLogEntry(
        action="COMPANY_UPDATED", resource_type="Company", resource_id=str(company.id),
        actor=user.user_id, company_id=company.id,
    ))
    return encode(company)


@router.delete("/companies/{company_id}")
def delete_company(
    company_id: UUID,
    user: CurrentUser = Depends(require_roles(Role.ADMIN)),
) -> dict[str, str]:
    try:
        company = repository.remove_company(company_id)
    except KeyError as exc:
        raise HTTPException(404, "company not found") from exc
    repository.append_audit(AuditLogEntry(
        action="COMPANY_DELETED", resource_type="Company", resource_id=str(company.id),
        actor=user.user_id, company_id=company.id,
    ))
    return {"deleted": str(company.id)}


@router.get("/settings/materiality")
def get_materiality(company_id: UUID) -> Any:
    profile = repository.get_materiality_profile(company_id)
    return encode(profile) if profile else None


@router.put("/settings/materiality/{company_id}")
def upsert_materiality(
    company_id: UUID,
    payload: MaterialityCreate,
    user: CurrentUser = Depends(require_roles(Role.CLOSING_MANAGER, Role.ADMIN)),
) -> Any:
    _entity(repository.companies, company_id, "company")
    data = payload.model_dump(exclude={"approve"})
    data.pop("company_id")
    profile = repository.upsert_materiality_profile(company_id, **data)
    return encode(profile)


@router.get("/settings/runtime")
def get_runtime_settings() -> Any:
    response = dict(runtime_settings)
    connection = dict(response.get("aiConnection", {}))
    secret_reference = connection.get("secretReference")
    secret_name = (
        secret_reference.removeprefix("env:")
        if isinstance(secret_reference, str) and secret_reference.startswith("env:")
        else "OPENAI_API_KEY"
    )
    connection["secretReadable"] = bool(os.getenv(secret_name))
    connection["ready"] = bool(connection.get("enabled")) and connection["secretReadable"]
    response["aiConnection"] = connection
    return response


@router.patch("/settings/ai-connection")
def set_ai_connection(
    payload: AiConnectionInput,
    user: CurrentUser = Depends(require_roles(Role.ADMIN)),
) -> Any:
    runtime_settings["aiConnection"] = {
        "provider": payload.provider,
        "chatModel": payload.chat_model,
        "embeddingModel": payload.embedding_model,
        "secretReference": payload.secret_reference,
        "configured": True,
        "enabled": payload.enabled,
        "secretReadable": (
            bool(os.getenv(payload.secret_reference.removeprefix("env:")))
            if payload.secret_reference.startswith("env:")
            else None
        ),
    }
    _save_runtime_settings()
    return get_runtime_settings()["aiConnection"]


@router.post("/settings/ai-connection/test")
def test_ai_connection(
    payload: AiConnectionTestInput,
    user: CurrentUser = Depends(require_roles(Role.ADMIN)),
) -> Any:
    api_key = payload.api_key
    if not api_key and payload.secret_reference and payload.secret_reference.startswith("env:"):
        api_key = os.getenv(payload.secret_reference.removeprefix("env:"))
    if not api_key:
        return {"ok": False, "message": "연결할 API 키를 찾지 못했습니다."}
    try:
        if payload.provider.lower() == "nvidia":
            response = httpx.post(
                "https://integrate.api.nvidia.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}"},
                json={
                    "model": payload.chat_model or "meta/llama-3.1-70b-instruct",
                    "messages": ([
                        {"role": "system", "content": KIFRS_EVENT_ANALYSIS_PROMPT},
                        {"role": "user", "content": payload.analysis_prompt},
                    ] if payload.analysis_prompt else [{"role": "user", "content": "Reply only with OK."}]),
                    "max_tokens": 900 if payload.analysis_prompt else 16,
                    "temperature": 0,
                },
                timeout=120.0,
            )
        else:
            response = httpx.get(
                "https://api.openai.com/v1/models",
                headers={"Authorization": f"Bearer {api_key}"},
                timeout=10.0,
            )
    except httpx.HTTPError:
        return {"ok": False, "message": "OpenAI 연결에 실패했습니다. 네트워크 상태를 확인해 주세요."}
    if response.status_code == 200:
        if payload.analysis_prompt and payload.provider.lower() == "nvidia":
            answer = response.json().get("choices", [{}])[0].get("message", {}).get("content")
            return {"ok": True, "answer": answer}
        return {"ok": True, "message": "OpenAI 연결이 확인되었습니다."}
    if response.status_code in {401, 403}:
        return {"ok": False, "message": "API 키를 확인해 주세요."}
    return {"ok": False, "message": "OpenAI 연결을 확인하지 못했습니다."}


@router.patch("/settings/knowledge-sources/local-standards")
def set_knowledge_source(
    payload: KnowledgeSourceInput,
    user: CurrentUser = Depends(require_roles(Role.ADMIN)),
) -> Any:
    source = payload.model_dump()
    source["status"] = "CONFIGURED"
    runtime_settings["knowledgeSources"] = [
        item
        for item in runtime_settings["knowledgeSources"]
        if item.get("company_id") != str(payload.company_id)
    ]
    source["company_id"] = str(payload.company_id)
    runtime_settings["knowledgeSources"].append(source)
    _save_runtime_settings()
    return source


@router.post("/settings/knowledge-sources/local-standards/scan")
def scan_knowledge_source(
    company_id: UUID,
    user: CurrentUser = Depends(require_roles(Role.ADMIN)),
) -> Any:
    source = next(
        (
            item
            for item in runtime_settings["knowledgeSources"]
            if item.get("company_id") == str(company_id)
        ),
        None,
    )
    if not source:
        raise HTTPException(404, "knowledge source not configured")
    root = Path(source["root_directory"])
    if not root.exists() or not root.is_dir():
        raise HTTPException(422, "configured directory is unavailable")
    allowed = {item.lower() for item in source["allowed_extensions"]}
    scanned = 0
    for path in root.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in allowed:
            continue
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        candidate_id = str(uuid4())
        knowledge_candidates[candidate_id] = {
            "id": candidate_id,
            "companyId": str(company_id),
            "relativePath": str(path.relative_to(root)),
            "contentHash": digest,
            "status": "APPROVED",
            "ragEligible": True,
        }
        scanned += 1
    _save_knowledge_candidates()
    repository.append_audit(
        AuditLogEntry(
            action="KNOWLEDGE_SOURCE_SCANNED",
            resource_type="KnowledgeSource",
            resource_id=str(company_id),
            actor=user.user_id,
            company_id=company_id,
            reason=f"{scanned} candidates",
        )
    )
    return {"scanned": scanned, "status": "COMPLETED"}


@router.post("/settings/knowledge-sources/local-standards/upload")
async def upload_knowledge_documents(
    company_id: UUID,
    files: list[UploadFile] = File(...),
    user: CurrentUser = Depends(require_roles(Role.ADMIN)),
) -> Any:
    """Upload standards from the browser into the configured PostgreSQL store."""
    allowed = {".pdf", ".hwp", ".hwpx", ".docx", ".txt", ".md", ".html"}
    existing_names = {
        str(item.get("relativePath", "")).casefold()
        for item in knowledge_candidates.values()
        if item.get("companyId") == str(company_id)
    }
    requested_names = [
        Path(upload.filename or "document").name
        for upload in files
        if Path(upload.filename or "document").suffix.lower() in allowed
    ]
    duplicate_names = sorted(
        {
            name
            for name in requested_names
            if name.casefold() in existing_names or requested_names.count(name) > 1
        }
    )
    if duplicate_names:
        raise HTTPException(
            409,
            detail=f"이미 등록된 파일명입니다: {', '.join(duplicate_names)}",
        )
    scanned = 0
    for upload in files:
        name = Path(upload.filename or "document").name
        if Path(name).suffix.lower() not in allowed:
            continue
        content = await upload.read()
        digest = hashlib.sha256(content).hexdigest()
        candidate_id = str(uuid4())
        knowledge_candidates[candidate_id] = {
            "id": candidate_id, "companyId": str(company_id),
            "relativePath": name, "contentHash": digest,
            "status": "APPROVED", "ragEligible": False,
            "ragStatus": "NOT_INDEXED", "chunkCount": 0, "pageCount": 0,
        }
        repository.save_runtime_setting(
            f"knowledge-document:{candidate_id}",
            {"filename": name, "content": content, "contentHash": digest},
        )
        scanned += 1
    _save_knowledge_candidates()
    return {"uploaded": scanned, "status": "COMPLETED"}


@router.post("/settings/knowledge-sources/local-standards/reindex")
def reindex_knowledge_documents(
    company_id: UUID,
    candidate_ids: list[UUID] | None = Query(None),
    user: CurrentUser = Depends(require_roles(Role.ADMIN)),
) -> Any:
    indexed = 0
    failures: list[dict[str, str]] = []
    requested_ids = {str(value) for value in candidate_ids} if candidate_ids else None
    for candidate in knowledge_candidates.values():
        if candidate.get("companyId") != str(company_id):
            continue
        candidate_id = str(candidate["id"])
        if requested_ids is not None and candidate_id not in requested_ids:
            continue
        stored = repository.get_runtime_setting(f"knowledge-document:{candidate_id}")
        if not isinstance(stored, dict) or not isinstance(stored.get("content"), bytes):
            candidate["ragStatus"] = "NOT_INDEXED"
            failures.append({"name": str(candidate.get("relativePath", candidate_id)), "reason": "원본 파일이 서버에 없습니다."})
            continue
        try:
            result = _index_knowledge_candidate(
                candidate_id=candidate_id, company_id=company_id,
                filename=str(stored.get("filename") or candidate.get("relativePath") or "document"),
                content=stored["content"], content_hash=str(stored.get("contentHash") or candidate.get("contentHash") or ""),
            )
            candidate.update({"ragStatus": "INDEXED", "ragEligible": True, **result})
            indexed += 1
        except KnowledgeIndexError as exc:
            candidate["ragStatus"] = "FAILED"
            candidate["ragEligible"] = False
            candidate["ragError"] = str(exc)
            failures.append({"name": str(candidate.get("relativePath", candidate_id)), "reason": str(exc)})
    _save_knowledge_candidates()
    return {"indexed": indexed, "failures": failures, "status": "COMPLETED"}


@router.get("/settings/knowledge-sources/local-standards/candidates")
def list_knowledge_candidates(company_id: UUID) -> Any:
    return [
        item for item in knowledge_candidates.values() if item["companyId"] == str(company_id)
    ]


@router.delete("/settings/knowledge-sources/local-standards/documents")
def delete_knowledge_documents(
    company_id: UUID,
    candidate_ids: list[UUID] = Query(...),
) -> Any:
    """Permanently delete selected uploaded standards and their RAG data."""
    requested_ids = {str(value) for value in candidate_ids}
    selected = [
        (candidate_id, candidate)
        for candidate_id, candidate in knowledge_candidates.items()
        if candidate_id in requested_ids and candidate.get("companyId") == str(company_id)
    ]
    if len(selected) != len(requested_ids):
        raise HTTPException(404, "삭제할 기준서 문서를 찾을 수 없습니다.")

    for candidate_id, _candidate in selected:
        delete_indexed_document(candidate_id=UUID(candidate_id), company_id=company_id)

    for candidate_id, _candidate in selected:
        knowledge_candidates.pop(candidate_id, None)
        repository.delete_runtime_setting(f"knowledge-document:{candidate_id}")
    _save_knowledge_candidates()
    return {"deleted": len(selected), "status": "COMPLETED"}


@router.post("/knowledge-candidates/{candidate_id:path}/approve")
def approve_knowledge_candidate(
    candidate_id: str,
    user: CurrentUser = Depends(require_roles(Role.CLOSING_MANAGER, Role.ADMIN)),
) -> Any:
    candidate = knowledge_candidates.get(candidate_id)
    if not candidate:
        raise HTTPException(404, "knowledge candidate not found")
    candidate["status"] = "APPROVED"
    candidate["ragEligible"] = True
    candidate["approvedBy"] = user.user_id
    _save_knowledge_candidates()
    return candidate


@router.post("/mapping/propose")
def propose(
    company_id: UUID = Form(...),
    source_type: str = Form(...),
    file: UploadFile = File(...),
) -> Any:
    _entity(repository.companies, company_id, "company")
    path = _save_upload(file)
    try:
        proposal = propose_mapping(
            path,
            source_type,
        )
        return encode(proposal)
    finally:
        path.unlink(missing_ok=True)


@router.post("/mapping/approve", status_code=201)
def approve_mapping(
    payload: MappingApprove,
    user: CurrentUser = Depends(require_roles(Role.CLOSING_MANAGER, Role.ADMIN)),
) -> Any:
    profile = MappingProfile(
        company_id=payload.company_id,
        source_type=payload.source_type,
        sheet_name=payload.sheet_name,
        header_row=payload.header_row,
        source_signature=payload.source_signature,
        mapping=payload.mapping,
        status=MappingStatus.APPROVED,
    )
    repository.save(profile)
    repository.append_audit(
        AuditLogEntry(
            action="MAPPING_APPROVED",
            resource_type="MappingProfile",
            resource_id=str(profile.id),
            actor=user.user_id,
            company_id=profile.company_id,
        )
    )
    return encode(profile)


@router.get("/mapping/profiles")
def list_mapping_profiles(company_id: UUID, source_type: str | None = None) -> Any:
    return encode(
        [
            profile
            for profile in repository.mapping_profiles.values()
            if profile.company_id == company_id
            and (not source_type or profile.source_type == source_type)
        ]
    )


@router.post("/closing-analysis-sets", status_code=201)
def create_close_analysis_set(
    company_id: UUID = Form(...),
    fiscal_year: int = Form(0),
    fiscal_period: int = Form(0),
    user: CurrentUser = Depends(require_roles(Role.CLOSING_MANAGER, Role.ADMIN)),
) -> Any:
    _entity(repository.companies, company_id, "company")
    closing_set = create_closing_analysis_set(
        repository, company_id, fiscal_year, fiscal_period
    )
    repository.append_audit(
        AuditLogEntry(
            action="CLOSING_ANALYSIS_SET_OPENED",
            resource_type="ClosingAnalysisSet",
            resource_id=str(closing_set.id),
            actor=user.user_id,
            company_id=company_id,
        )
    )
    return encode(closing_set)


@router.get("/closing-analysis-sets")
def list_closing_analysis_sets(
    company_id: UUID,
    fiscal_year: int | None = None,
) -> Any:
    return encode(
        sorted(
            (
                item
                for item in repository.closing_analysis_sets.values()
                if item.company_id == company_id
                and (fiscal_year is None or item.fiscal_year == fiscal_year)
            ),
            key=lambda item: (item.fiscal_year, item.fiscal_period),
            reverse=True,
        )
    )


@router.get("/closing-analysis-sets/{closing_analysis_set_id}")
def get_closing_analysis_set(closing_analysis_set_id: UUID) -> Any:
    closing_set = _entity(
        repository.closing_analysis_sets, closing_analysis_set_id, "closing analysis set"
    )
    findings = [
        finding
        for finding in repository.cross_analysis_findings.values()
        if finding.closing_analysis_set_id == closing_set.id
    ]
    return encode(
        {
            "closingAnalysisSet": closing_set,
            "journalLineCount": len(repository.lines_for_set(closing_set.id)),
            "settlementBalanceCount": len(repository.settlement_for_set(closing_set.id)),
            "crossFindings": findings,
        }
    )


@router.post("/closing-analysis-sets/{closing_analysis_set_id}/general-ledger")
def attach_closing_general_ledger(
    closing_analysis_set_id: UUID,
    mapping_profile_id: UUID = Form(...),
    file: UploadFile = File(...),
    user: CurrentUser = Depends(require_roles(Role.CLOSING_MANAGER, Role.ADMIN)),
) -> Any:
    closing_set = _entity(
        repository.closing_analysis_sets, closing_analysis_set_id, "closing analysis set"
    )
    profile = _entity(repository.mapping_profiles, mapping_profile_id, "mapping profile")
    if (
        profile.company_id != closing_set.company_id
        or profile.source_type != "GENERAL_LEDGER"
        or profile.status != MappingStatus.APPROVED
    ):
        raise HTTPException(422, "approved general ledger mapping profile required")
    source_filename = Path(file.filename or "general-ledger.xlsx").name
    seen_hashes = {
        line.source_hash
        for line in repository.lines_for_set(closing_set.id)
        if line.source_filename != source_filename
    }
    path = _save_upload(file)
    try:
        lines, reconciliation = normalize_general_ledger(
            path, closing_set.company_id, profile, seen_hashes, source_filename
        )
        if not reconciliation.balanced:
            return {
                "status": "FAILED",
                "stage": "GENERAL_LEDGER_RECONCILIATION",
                "reconciliation": encode(reconciliation),
            }
        closing_set = attach_general_ledger(
            repository, closing_set, lines, mapping_profile_id=profile.id
        )
        return encode(
            {
                "status": closing_set.status.value,
                "closingAnalysisSet": closing_set,
                "reconciliation": reconciliation,
                "acceptedRows": len(lines),
            }
        )
    finally:
        path.unlink(missing_ok=True)


@router.post("/closing-analysis-sets/{closing_analysis_set_id}/settlement-schedule")
def attach_closing_settlement_schedule(
    closing_analysis_set_id: UUID,
    mapping_profile_id: UUID = Form(...),
    file: UploadFile = File(...),
    user: CurrentUser = Depends(require_roles(Role.CLOSING_MANAGER, Role.ADMIN)),
) -> Any:
    closing_set = _entity(
        repository.closing_analysis_sets, closing_analysis_set_id, "closing analysis set"
    )
    profile = _entity(repository.mapping_profiles, mapping_profile_id, "mapping profile")
    if (
        profile.company_id != closing_set.company_id
        or profile.source_type != "SETTLEMENT_SCHEDULE"
        or profile.status != MappingStatus.APPROVED
    ):
        raise HTTPException(422, "approved settlement schedule mapping profile required")
    path = _save_upload(file)
    try:
        rows = normalize_settlement(path, profile, upload_period="UPLOADED")
        balances = settlement_balances_from_rows(
            closing_set.company_id, rows, closing_set.fiscal_year, closing_set.fiscal_period
        )
        closing_set = attach_settlement_schedule(
            repository, closing_set, balances, mapping_profile_id=profile.id
        )
        return encode(
            {
                "status": closing_set.status.value,
                "closingAnalysisSet": closing_set,
                "acceptedRows": len(balances),
            }
        )
    finally:
        path.unlink(missing_ok=True)


@router.post("/closing-analysis-sets/{closing_analysis_set_id}/analyze")
def analyze_closing_set(
    closing_analysis_set_id: UUID,
    user: CurrentUser = Depends(require_roles(Role.CLOSING_MANAGER, Role.ADMIN)),
) -> Any:
    try:
        return queue_closing_analysis_events(
            repository,
            closing_analysis_set_id,
            actor=user.user_id,
            **_ai_runtime_options(),
        )
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc


@router.post("/closing-analysis-sets/{closing_analysis_set_id}/analysis-events/{event_id}/analyze")
def analyze_closing_event(
    closing_analysis_set_id: UUID,
    event_id: UUID,
    user: CurrentUser = Depends(require_roles(Role.CLOSING_MANAGER, Role.ADMIN)),
) -> Any:
    try:
        return analyze_queued_closing_event(
            repository,
            closing_analysis_set_id,
            event_id,
            actor=user.user_id,
            **_ai_runtime_options(),
        )
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc


@router.post("/imports/general-ledger")
def import_general_ledger(
    company_id: UUID = Form(...),
    mapping_profile_id: UUID = Form(...),
    file: UploadFile = File(...),
) -> Any:
    profile = _entity(repository.mapping_profiles, mapping_profile_id, "mapping profile")
    if profile.company_id != company_id or profile.source_type != "GENERAL_LEDGER":
        raise HTTPException(422, "mapping profile scope mismatch")
    path = _save_upload(file)
    try:
        lines, reconciliation = normalize_general_ledger(
            path,
            company_id,
            profile,
            repository.processed_source_hashes,
        )
        if not reconciliation.balanced:
            return {
                "status": "FAILED",
                "stage": "RECONCILIATION",
                "reconciliation": encode(reconciliation),
            }
        result = process_journals(
            repository,
            lines,
            actor="system",
            knowledge_candidates=knowledge_candidates,
            **_ai_runtime_options(),
        )
        return {
            "status": "COMPLETED",
            "reconciliation": encode(reconciliation),
            "processing": result,
        }
    finally:
        path.unlink(missing_ok=True)


@router.post("/import-jobs/general-ledger", status_code=202)
def queue_general_ledger_import(
    background_tasks: BackgroundTasks,
    company_id: UUID = Form(...),
    mapping_profile_id: UUID = Form(...),
    file: UploadFile = File(...),
) -> Any:
    profile = _entity(repository.mapping_profiles, mapping_profile_id, "mapping profile")
    if profile.company_id != company_id or profile.source_type != "GENERAL_LEDGER":
        raise HTTPException(422, "mapping profile scope mismatch")
    path = _save_upload(file)
    job_id = str(uuid4())
    jobs[job_id] = {
        "jobId": job_id,
        "status": "RECEIVED",
        "stage": "UPLOAD_COMPLETE",
        "processedRows": 0,
    }
    background_tasks.add_task(_process_gl_job, job_id, path, company_id, profile)
    return {**jobs[job_id], "statusUrl": f"/api/v1/jobs/{job_id}"}


@router.get("/jobs/{job_id}")
def get_job(job_id: str) -> Any:
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(404, "job not found")
    return job


@router.get("/dashboard")
def dashboard(company_id: UUID) -> Any:
    risks = [risk for risk in _database_collection("Risk", repository.risks) if isinstance(risk, Risk) and risk.company_id == company_id]
    events = [event for event in _database_collection("AccountingEvent", repository.events) if isinstance(event, AccountingEvent) and event.company_id == company_id]
    return {
        "dataAsOf": "current-memory-snapshot",
        "totalRisks": len(risks),
        "highRisks": sum(1 for risk in risks if risk.level.value in {"HIGH", "CRITICAL"}),
        "openRisks": sum(1 for risk in risks if risk.status == RiskStatus.OPEN),
        "events": len(events),
        "routeDistribution": {
            route: sum(1 for risk in risks if risk.route.value == route)
            for route in {risk.route.value for risk in risks}
        },
    }


@router.get("/risks")
def list_risks(company_id: UUID) -> Any:
    memories = _database_risk_memory()
    transferred_risk_ids = _database_transferred_risk_ids()
    return encode(
        [
            _risk_list_payload(risk, memories)
            for risk in _database_collection("Risk", repository.risks)
            if isinstance(risk, Risk)
            if risk.company_id == company_id
            and is_visible_in_risk_lists(memories.get(risk.id, []))
            and risk.id not in transferred_risk_ids
        ]
    )


def _risk_review_payload(risk: Any) -> dict[str, Any]:
    def issue_types_for(item: Any) -> list[str]:
        issue_types = list(getattr(item.package, "issue_types", []))
        if issue_types:
            return issue_types
        title = str(getattr(item, "title", ""))
        return [title.removeprefix("검토 필요:").strip()] if title else []

    event = repository.events.get(risk.event_id)
    lines = [
        line for line in repository.journal_lines.values()
        if event and line.id in event.journal_line_ids
    ]

    if not getattr(risk, "risk_code", "") and lines:
        assign_risk_code(repository, risk, lines)
        repository.save(risk)
    history = [
        (
            prior_event,
            [
                line for line in repository.journal_lines.values()
                if line.id in prior_event.journal_line_ids
            ],
            repository.risk_memory.get(prior_risk.id, []),
            issue_types_for(prior_risk),
        )
        for prior_risk in repository.risks.values()
        if prior_risk.company_id == risk.company_id
        and prior_risk.id != risk.id
        and (prior_event := repository.events.get(prior_risk.event_id))
    ]
    return {
        **encode(risk),
        "analyzed_at": latest_analysis_at(repository.risk_memory.get(risk.id, [])),
        "review_decision": current_review_decision(repository.risk_memory.get(risk.id, [])),
        "review_recommendation": recommend_review_decision(
            event, lines, history,
            issue_types=issue_types_for(risk),
        ) if event else None,
        "severity": current_risk_severity(repository.risk_memory.get(risk.id, []), risk.level.value),
        "severity_recommendation": recommend_risk_severity(
            event, lines, history,
            issue_types=issue_types_for(risk),
        ) if event else None,
    }


def _review_case(review_case_ref: UUID | str) -> Any:
    try:
        review_case_id = UUID(str(review_case_ref))
    except ValueError:
        matches = [
            item for item in repository.risk_review_cases.values()
            if item.risk_code == str(review_case_ref)
        ]
        review_case = matches[0] if len(matches) == 1 else None
    else:
        review_case = repository.get_review_case(review_case_id)
    if review_case is None:
        raise HTTPException(404, "risk review case not found")
    return review_case


def _require_review_company(user: CurrentUser, company_id: UUID) -> None:
    if user.company_id is None or user.company_id != company_id:
        raise HTTPException(403, "company scope does not authorize this review")


def _review_case_for_user(review_case_id: UUID, user: CurrentUser) -> Any:
    review_case = _review_case(review_case_id)
    _require_review_company(user, review_case.company_id)
    return review_case


def _review_case_summary(review_case: Any) -> dict[str, Any]:
    return {
        "company_id": str(review_case.company_id),
        "risk_code": review_case.risk_code,
        "title": review_case.title,
        "statement": review_case.statement,
        "review_decision": review_case.review_decision,
        "severity": review_case.severity,
        "exposure_amount": review_case.exposure_amount,
        "status": review_case.status,
        "transferred_at": encode(review_case.transferred_at),
    }


@router.get("/risk-reviews")
def list_risk_reviews(company_id: UUID, status: str | None = None) -> Any:
    requested_status = status.upper() if status else None
    if requested_status not in {None, "OPEN", "CLEARED"}:
        raise HTTPException(422, "status must be OPEN or CLEARED")
    return encode(
        [
            _review_case_summary(review_case)
            for review_case in _database_collection("RiskReviewCase", repository.risk_review_cases)
            if isinstance(review_case, RiskReviewCase)
            if review_case.company_id == company_id
            if review_case.review_decision != "PASS"
            and (requested_status is None or review_case.status == requested_status)
        ]
    )


@router.get("/settings/risk-management")
def list_risk_management(company_id: UUID) -> Any:
    """Administrative view of every source analysis, including PASS and transferred risks."""
    memories = _database_risk_memory()
    return encode(
        [
            _risk_list_payload(risk, memories)
            for risk in _database_collection("Risk", repository.risks)
            if isinstance(risk, Risk)
            if risk.company_id == company_id
        ]
    )


def _review_case_payload(review_case: Any) -> dict[str, Any]:
    payload = encode(review_case)
    payload.pop("source_risk_id", None)
    payload["answers"] = encode(repository.answers_for_review_case(review_case.id))
    payload["question_assessments"] = encode(
        repository.question_assessments_for_review_case(review_case.id)
    )
    payload["overall_assessment"] = encode(
        repository.overall_assessment_for_review_case(review_case.id)
    )
    payload["question_statuses"] = encode(
        repository.question_statuses_for_review_case(review_case.id)
    )
    payload["attachments"] = [
        {
            "id": str(attachment.id),
            "filename": attachment.filename,
            "content_type": attachment.content_type,
            "size_bytes": attachment.size_bytes,
            "created_at": encode(attachment.created_at),
        }
        for attachment in repository.attachments_for_review_case(review_case.id)
    ]
    return payload


@router.post("/risks/{risk_id}/transfer-to-review")
def transfer_risk_to_review(
    risk_id: UUID,
    payload: RiskReviewTransfer,
    user: CurrentUser = Depends(require_roles(Role.ACCOUNTANT, Role.CLOSING_MANAGER, Role.ADMIN)),
) -> Any:
    risk = _database_object("Risk", risk_id, repository.risks)
    if not isinstance(risk, Risk):
        raise HTTPException(404, "risk not found")
    decision = payload.review_decision.upper()
    severity = payload.severity.upper()
    existing_case = repository.review_case_for_source_risk(risk.id)
    if existing_case is not None:
        return _review_case_payload(existing_case)
    risk_for_review = deepcopy(risk)
    options = _ai_runtime_options()
    summaries = summarize_for_review_transfer(
        audit_issues=list(risk.package.audit_issues),
        evidence_checklist=list(risk.package.evidence_checklist),
        model=options["ai_model"],
        api_key_env=options["ai_key_env"],
        enabled=options["external_ai_enabled"],
        provider=options["ai_provider"],
    )
    risk_for_review.package.audit_issues = summaries["auditIssues"]
    risk_for_review.package.evidence_checklist = summaries["evidenceChecklist"]
    risk_for_review.package.missing_facts = []
    try:
        review_case, _ = repository.transfer_risk_to_review(
            risk_for_review,
            review_decision=decision,
            severity=severity,
            actor=user.user_id,
        )
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    return _review_case_payload(review_case)


@router.get("/risk-reviews/{review_case_id}")
def get_risk_review_case(
    review_case_id: str,
) -> Any:
    return _review_case_payload(_review_case(review_case_id))


@router.put("/risk-reviews/{review_case_id}/answers")
def save_risk_review_answer(
    review_case_id: UUID,
    payload: RiskReviewAnswerUpdate,
    user: CurrentUser = Depends(require_roles(Role.ACCOUNTANT, Role.CLOSING_MANAGER, Role.ADMIN)),
) -> Any:
    _review_case(review_case_id)
    return encode(
        repository.add_review_answer(
            review_case_id, question=payload.question, answer=payload.answer
        )
    )


@router.delete("/risk-reviews/{review_case_id}/answers/{answer_id}")
def delete_risk_review_answer(
    review_case_id: UUID,
    answer_id: UUID,
    user: CurrentUser = Depends(require_roles(Role.ACCOUNTANT, Role.CLOSING_MANAGER, Role.ADMIN)),
) -> Any:
    _review_case(review_case_id)
    try:
        repository.remove_review_answer(review_case_id, answer_id)
    except KeyError as exc:
        raise HTTPException(404, "review answer not found") from exc
    return {"deleted": True}


@router.post("/risk-reviews/{review_case_id}/question-assessment")
def assess_risk_review_question(
    review_case_id: UUID,
    payload: RiskReviewQuestionAssessmentRequest,
) -> Any:
    review_case = _review_case(review_case_id)
    answers = [
        answer.answer
        for answer in repository.answers_for_review_case(review_case_id)
        if answer.question == payload.question and answer.answer.strip()
    ]
    if not answers:
        raise HTTPException(422, "저장된 답변이 있어야 AI 검토를 실행할 수 있습니다.")
    options = _ai_runtime_options()
    try:
        assessment = assess_review_question(
            audit_issues=review_case.package.audit_issues,
            question=payload.question,
            answers=answers,
            provider=options["ai_provider"],
            model=options["ai_model"],
            api_key_env=options["ai_key_env"],
            enabled=options["external_ai_enabled"],
        )
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    except Exception as exc:
        raise HTTPException(502, f"AI 검토에 실패했습니다: {type(exc).__name__}") from exc
    return encode(
        repository.save_review_question_assessment(
            review_case_id,
            question=payload.question,
            status=assessment["status"],
            reason=assessment["reason"],
        )
    )


@router.post("/risk-reviews/{review_case_id}/overall-assessment")
def assess_risk_review_overall(review_case_id: UUID) -> Any:
    review_case = _review_case(review_case_id)
    excluded_questions = {
        item.question
        for item in repository.question_statuses_for_review_case(review_case_id)
        if item.status in {"NOT_REQUIRED", "DUPLICATE"}
    }
    answers_by_question: dict[str, list[str]] = {}
    for answer in repository.answers_for_review_case(review_case_id):
        if answer.question not in excluded_questions and answer.answer.strip():
            answers_by_question.setdefault(answer.question, []).append(answer.answer)
    if not answers_by_question:
        raise HTTPException(422, "저장된 답변이 있어야 종합 AI 검토를 실행할 수 있습니다.")
    options = _ai_runtime_options()
    question_assessments = {
        item.question: {"status": item.status, "reason": item.reason}
        for item in repository.question_assessments_for_review_case(review_case_id)
        if item.question not in excluded_questions
    }
    try:
        assessment = assess_review_overall(
            audit_issues=review_case.package.audit_issues,
            questions=list(dict.fromkeys([
                question
                for question in (review_case.package.expected_questions or [])
                if question not in excluded_questions
            ] + [
                *answers_by_question.keys(),
            ])),
            answers_by_question=answers_by_question,
            question_assessments=question_assessments,
            provider=options["ai_provider"],
            model=options["ai_model"],
            api_key_env=options["ai_key_env"],
            enabled=options["external_ai_enabled"],
        )
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    except Exception as exc:
        raise HTTPException(502, f"종합 AI 검토에 실패했습니다: {type(exc).__name__}") from exc
    return encode(
        repository.save_review_overall_assessment(
            review_case_id,
            question_findings=[],
            confirmed_facts=[],
            conclusion_status=assessment["conclusionStatus"],
            accounting_conclusion=assessment["accountingConclusion"],
            recommended_actions=assessment["recommendedActions"],
        )
    )


@router.put("/risk-reviews/{review_case_id}/question-status")
def set_risk_review_question_status(
    review_case_id: UUID,
    payload: RiskReviewQuestionStatusUpdate,
    user: CurrentUser = Depends(require_roles(Role.ACCOUNTANT, Role.CLOSING_MANAGER, Role.ADMIN)),
) -> Any:
    _review_case(review_case_id)
    try:
        return encode(
            repository.set_review_question_status(
                review_case_id, question=payload.question, status=payload.status.upper()
            )
        )
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc


@router.post("/risk-reviews/{review_case_id}/review-decision")
def set_risk_review_case_decision(
    review_case_id: UUID,
    payload: RiskReviewCaseDecision,
    user: CurrentUser = Depends(require_review_roles(Role.ACCOUNTANT, Role.CLOSING_MANAGER, Role.ADMIN)),
) -> Any:
    decision = payload.decision.upper()
    if decision not in REVIEW_DECISIONS:
        raise HTTPException(422, "decision must be CHECK, PENDING, or PASS")
    _review_case_for_user(review_case_id, user)
    review_case = repository.update_review_case_decision(review_case_id, decision)
    return _review_case_payload(review_case)


@router.post("/risk-reviews/{review_case_id}/severity")
def set_risk_review_case_severity(
    review_case_id: UUID,
    payload: RiskReviewCaseSeverity,
    user: CurrentUser = Depends(require_roles(Role.ACCOUNTANT, Role.CLOSING_MANAGER, Role.ADMIN)),
) -> Any:
    severity = payload.severity.upper()
    if severity not in RISK_SEVERITIES:
        raise HTTPException(422, "severity must be HIGH, MEDIUM, or LOW")
    _review_case(review_case_id)
    review_case = repository.update_review_case_severity(review_case_id, severity)
    return _review_case_payload(review_case)


@router.put("/risk-reviews/{review_case_id}/exposure")
def set_risk_review_case_exposure(
    review_case_id: UUID,
    payload: RiskReviewExposureUpdate,
    user: CurrentUser = Depends(require_roles(Role.ACCOUNTANT, Role.CLOSING_MANAGER, Role.ADMIN)),
) -> Any:
    _review_case(review_case_id)
    try:
        review_case = repository.update_review_case_exposure(
            review_case_id, payload.exposure_amount, payload.exposure_basis
        )
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    return _review_case_payload(review_case)


@router.put("/risk-reviews/{review_case_id}/remediation-actions")
def set_risk_review_remediation_actions(
    review_case_id: UUID,
    payload: RiskReviewRemediationActionsUpdate,
) -> Any:
    try:
        review_case = repository.update_review_case_remediation_actions(
            review_case_id, payload.remediation_actions
        )
    except KeyError as exc:
        raise HTTPException(404, "review case not found") from exc
    return _review_case_payload(review_case)


@router.post("/risk-reviews/{review_case_id}/clear")
def toggle_risk_review_case_clear(review_case_id: UUID) -> Any:
    try:
        review_case = repository.toggle_review_case_clear(review_case_id)
    except KeyError as exc:
        raise HTTPException(404, "risk review case not found") from exc
    return _review_case_payload(review_case)


@router.post("/risk-reviews/{review_case_id}/attachments")
def add_risk_review_attachment(
    review_case_id: UUID,
    file: UploadFile = File(...),
    user: CurrentUser = Depends(require_roles(Role.ACCOUNTANT, Role.CLOSING_MANAGER, Role.ADMIN)),
) -> Any:
    _review_case(review_case_id)
    attachment = RiskReviewAttachment(
        review_case_id=review_case_id,
        filename=file.filename or "attachment",
        content_type=file.content_type or "application/octet-stream",
        size_bytes=0,
        content=file.file.read(),
    )
    attachment.size_bytes = len(attachment.content)
    try:
        stored = repository.add_review_attachment(attachment)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    return {
        "id": str(stored.id),
        "filename": stored.filename,
        "content_type": stored.content_type,
        "size_bytes": stored.size_bytes,
        "created_at": encode(stored.created_at),
    }


@router.get("/risk-reviews/{review_case_id}/attachments/{attachment_id}/download")
def download_risk_review_attachment(
    review_case_id: UUID,
    attachment_id: UUID,
    user: CurrentUser = Depends(require_roles(Role.ACCOUNTANT, Role.CLOSING_MANAGER, Role.ADMIN)),
) -> Response:
    _review_case(review_case_id)
    attachment = next(
        (
            item
            for item in repository.attachments_for_review_case(review_case_id)
            if item.id == attachment_id
        ),
        None,
    )
    if attachment is None or attachment.review_case_id != review_case_id:
        raise HTTPException(404, "attachment not found")
    return Response(
        content=attachment.content,
        media_type=attachment.content_type,
        headers={
            "Content-Disposition": _attachment_content_disposition(
                attachment.filename
            )
        },
    )


@router.delete("/risk-reviews/{review_case_id}/attachments/{attachment_id}")
def delete_risk_review_attachment(
    review_case_id: UUID,
    attachment_id: UUID,
    user: CurrentUser = Depends(require_roles(Role.ACCOUNTANT, Role.CLOSING_MANAGER, Role.ADMIN)),
) -> Any:
    _review_case(review_case_id)
    try:
        repository.remove_review_attachment(review_case_id, attachment_id)
    except KeyError as exc:
        raise HTTPException(404, "attachment not found") from exc
    return {"deleted": True}


@router.get("/risks/{risk_id}")
def get_risk(
    risk_id: UUID,
) -> Any:
    risk = _database_object("Risk", risk_id, repository.risks)
    if not isinstance(risk, Risk):
        raise HTTPException(404, "risk not found")
    event = _database_object("AccountingEvent", risk.event_id, repository.events)
    lines = (
        [
            line
            for line in repository.database_state_objects(
                "JournalLine", object_ids=event.journal_line_ids
            )
            if isinstance(line, JournalLine)
        ]
        if isinstance(event, AccountingEvent)
        else []
    )
    memories = _database_risk_memory()
    cross_findings = [
        finding
        for finding in _database_collection("CrossAnalysisFinding", repository.cross_analysis_findings)
        if isinstance(finding, CrossAnalysisFinding)
        and (risk.id in finding.linked_risk_ids or finding.id in risk.cross_finding_ids)
    ]
    return {
        **_risk_list_payload(risk, memories),
        "event": encode(event) if isinstance(event, AccountingEvent) else None,
        "journalLines": encode(lines),
        "memory": encode(memories.get(risk.id, [])),
        "crossFindings": encode(cross_findings),
    }


@router.post("/risks/{risk_id}/transition")
def transition_risk(
    risk_id: UUID,
    payload: RiskTransition,
    user: CurrentUser = Depends(
        require_roles(Role.ACCOUNTANT, Role.CLOSING_MANAGER, Role.ADMIN)
    ),
) -> Any:
    risk = _entity(repository.risks, risk_id, "risk")
    try:
        target = RiskStatus(payload.target_status)
    except ValueError as exc:
        raise HTTPException(422, "invalid target status") from exc
    allowed = {
        RiskStatus.OPEN: {RiskStatus.IN_REVIEW},
        RiskStatus.IN_REVIEW: {RiskStatus.EVIDENCE_ATTACHED, RiskStatus.ACCEPTED},
        RiskStatus.EVIDENCE_ATTACHED: {RiskStatus.REASSESSMENT},
        RiskStatus.REASSESSMENT: {RiskStatus.ACCEPTED, RiskStatus.DORMANT},
        RiskStatus.ACCEPTED: {RiskStatus.DORMANT},
        RiskStatus.DORMANT: {RiskStatus.REACTIVATED},
        RiskStatus.REACTIVATED: {RiskStatus.IN_REVIEW},
    }
    if target not in allowed.get(risk.status, set()):
        raise HTTPException(409, f"transition not allowed: {risk.status} -> {target}")
    previous = risk.status
    risk.status = target
    risk.row_version += 1
    repository.save(risk)
    repository.append_memory(
        RiskMemoryEntry(
            risk_id=risk.id,
            entry_type="STATUS_CHANGED",
            summary=f"{previous.value} → {target.value}: {payload.reason}",
            actor=user.user_id,
        )
    )
    repository.append_audit(
        AuditLogEntry(
            action="RISK_STATUS_CHANGED",
            resource_type="Risk",
            resource_id=str(risk.id),
            actor=user.user_id,
            company_id=risk.company_id,
            reason=payload.reason,
        )
    )
    return encode(risk)


@router.get("/events")
def list_events(company_id: UUID) -> Any:
    return encode([event for event in repository.events.values() if event.company_id == company_id])


@router.get("/events/{event_id}")
def get_event(event_id: UUID) -> Any:
    event = _entity(repository.events, event_id, "event")
    lines = [
        line for line in repository.journal_lines.values() if line.id in event.journal_line_ids
    ]
    related_risks = [
        risk for risk in repository.risks.values() if risk.event_id == event.id
    ]
    return {
        **encode(event),
        "journalLines": encode(lines),
        "relatedRisks": encode(related_risks),
    }


@router.post("/risks/{risk_id}/review-decision")
def set_risk_review_decision(
    risk_id: UUID,
    payload: RiskReviewDecision,
    user: CurrentUser = Depends(require_roles(Role.ACCOUNTANT, Role.CLOSING_MANAGER, Role.ADMIN)),
) -> Any:
    risk = _entity(repository.risks, risk_id, "risk")
    decision = payload.decision.upper()
    if decision not in REVIEW_DECISIONS:
        raise HTTPException(422, "decision must be CHECK, PENDING, or PASS")
    if payload.expected_version != risk.row_version:
        raise HTTPException(409, "risk has been updated; refresh and try again")
    risk.row_version += 1
    repository.save(risk)
    repository.append_memory(
        RiskMemoryEntry(
            risk_id=risk.id,
            entry_type="REVIEW_DECISION",
            summary=decision,
            actor=user.user_id,
            metadata={"decision": decision},
        )
    )
    repository.append_audit(
        AuditLogEntry(
            action="RISK_REVIEW_DECISION_SET",
            resource_type="Risk",
            resource_id=str(risk.id),
            actor=user.user_id,
            company_id=risk.company_id,
            reason=decision,
        )
    )
    return encode(_risk_review_payload(risk))


@router.post("/risks/{risk_id}/severity")
def set_risk_severity(
    risk_id: UUID,
    payload: RiskSeverity,
    user: CurrentUser = Depends(require_roles(Role.ACCOUNTANT, Role.CLOSING_MANAGER, Role.ADMIN)),
) -> Any:
    risk = _entity(repository.risks, risk_id, "risk")
    severity = payload.severity.upper()
    if severity not in RISK_SEVERITIES:
        raise HTTPException(422, "severity must be HIGH, MEDIUM, or LOW")
    if payload.expected_version != risk.row_version:
        raise HTTPException(409, "risk has been updated; refresh and try again")
    risk.level = RiskLevel(severity)
    risk.row_version += 1
    repository.save(risk)
    repository.append_memory(RiskMemoryEntry(
        risk_id=risk.id, entry_type="RISK_SEVERITY", summary=severity,
        actor=user.user_id, metadata={"severity": severity},
    ))
    repository.append_audit(AuditLogEntry(
        action="RISK_SEVERITY_SET", resource_type="Risk", resource_id=str(risk.id),
        actor=user.user_id, company_id=risk.company_id, reason=severity,
    ))
    return encode(_risk_review_payload(risk))


@router.delete("/risks/{risk_id}")
def delete_risk_analysis(
    risk_id: UUID,
    payload: RiskDelete,
    user: CurrentUser = Depends(require_roles(Role.CLOSING_MANAGER, Role.ADMIN)),
) -> Any:
    risk = _entity(repository.risks, risk_id, "risk")
    if payload.expected_version != risk.row_version:
        raise HTTPException(409, "risk has been updated; refresh and try again")
    try:
        deleted = repository.delete_risk_analysis(risk_id)
    except KeyError as exc:
        raise HTTPException(404, "risk not found") from exc
    return {"deleted": True, "risk_id": str(deleted.id), "company_id": str(deleted.company_id)}


@router.get("/journals")
def list_journals(company_id: UUID, limit: int = 100) -> Any:
    safe_limit = min(max(limit, 1), 500)
    lines = [
        line for line in repository.journal_lines.values() if line.company_id == company_id
    ]
    lines.sort(key=lambda item: (item.posting_date, item.document_number), reverse=True)
    return encode(lines[:safe_limit])


@router.get("/journals/document")
def get_journal_document(company_id: UUID, document_number: str) -> Any:
    lines = [
        line
        for line in repository.journal_lines.values()
        if line.company_id == company_id and line.document_number == document_number
    ]
    lines.sort(key=lambda item: (item.source_row, item.id.hex))
    return encode(lines)


@router.get("/audit-log")
def audit_log(company_id: UUID) -> Any:
    return encode(
        [entry for entry in repository.audit_log if entry.company_id == company_id]
    )
