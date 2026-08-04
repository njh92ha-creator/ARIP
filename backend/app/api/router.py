from __future__ import annotations

import os
import json
import hashlib
import shutil
import tempfile
from dataclasses import asdict
from decimal import Decimal
from enum import Enum
from pathlib import Path
from typing import Any
from uuid import UUID, uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Response, UploadFile
from fastapi.encoders import jsonable_encoder

from app.api.schemas import (
    AiConnectionInput,
    CompanyCreate,
    CompanyUpdate,
    KnowledgeSourceInput,
    MappingApprove,
    MaterialityCreate,
    RiskTransition,
)
from app.domain.models import (
    AuditLogEntry,
    CompanySettings,
    MappingProfile,
    MappingStatus,
    MaterialityProfile,
    RiskMemoryEntry,
    RiskStatus,
)
from app.domain.repository import repository
from app.core.security import CurrentUser, Role, current_user, require_roles
from app.core.database import check_database
from app.services.import_pipeline import normalize_general_ledger, normalize_settlement
from app.services.mapping import propose_mapping
from app.services.orchestrator import process_journals
from app.services.closing_analysis import (
    analyze_closing_analysis_set,
    attach_general_ledger,
    attach_settlement_schedule,
    create_closing_analysis_set,
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
    """Load non-secret runtime settings from the persistent application volume."""
    global runtime_settings
    try:
        if _RUNTIME_SETTINGS_PATH.exists():
            stored = json.loads(_RUNTIME_SETTINGS_PATH.read_text(encoding="utf-8"))
            if isinstance(stored, dict):
                runtime_settings.update(stored)
    except (OSError, json.JSONDecodeError):
        # A corrupt/unavailable settings file must not prevent the API from starting.
        pass


def _save_runtime_settings() -> None:
    _RUNTIME_SETTINGS_PATH.parent.mkdir(parents=True, exist_ok=True)
    temporary = _RUNTIME_SETTINGS_PATH.with_suffix(".tmp")
    temporary.write_text(json.dumps(runtime_settings, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary.replace(_RUNTIME_SETTINGS_PATH)


_load_runtime_settings()
knowledge_candidates: dict[str, dict[str, Any]] = {}
jobs: dict[str, dict[str, Any]] = {}


def encode(value: Any) -> Any:
    return jsonable_encoder(value, custom_encoder={Decimal: str})


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
        "mode": "DEMO_HEADER_AUTH",
        "warning": "운영 배포 시 OIDC/SSO Adapter로 교체해야 합니다.",
    }


@router.get("/auth/me")
def get_me(user: CurrentUser = Depends(current_user)) -> Any:
    return {"userId": user.user_id, "role": user.role.value}


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
    return encode(list(repository.companies.values()))


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
    return runtime_settings


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
    return runtime_settings["aiConnection"]


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
        candidate_id = f"{company_id}:{digest}"
        knowledge_candidates[candidate_id] = {
            "id": candidate_id,
            "companyId": str(company_id),
            "relativePath": str(path.relative_to(root)),
            "contentHash": digest,
            "status": "PENDING",
            "ragEligible": False,
        }
        scanned += 1
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
    """Upload standards from the browser; avoids inaccessible host paths in Docker."""
    root = Path("/app/data/standards") / str(company_id)
    root.mkdir(parents=True, exist_ok=True)
    allowed = {".pdf", ".hwp", ".hwpx", ".docx", ".txt", ".md", ".html"}
    scanned = 0
    for upload in files:
        name = Path(upload.filename or "document").name
        if Path(name).suffix.lower() not in allowed:
            continue
        target = root / name
        content = await upload.read()
        target.write_bytes(content)
        digest = hashlib.sha256(content).hexdigest()
        candidate_id = f"{company_id}:{digest}"
        knowledge_candidates[candidate_id] = {
            "id": candidate_id, "companyId": str(company_id),
            "relativePath": name, "contentHash": digest,
            "status": "PENDING", "ragEligible": False,
        }
        scanned += 1
    _save_runtime_settings()
    return {"uploaded": scanned, "status": "COMPLETED"}


@router.get("/settings/knowledge-sources/local-standards/candidates")
def list_knowledge_candidates(company_id: UUID) -> Any:
    return [
        item for item in knowledge_candidates.values() if item["companyId"] == str(company_id)
    ]


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
    fiscal_year: int = Form(...),
    fiscal_period: int = Form(...),
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
    path = _save_upload(file)
    try:
        lines, reconciliation = normalize_general_ledger(
            path, closing_set.company_id, profile, set(repository.processed_source_hashes)
        )
        if not reconciliation.balanced:
            return {
                "status": "FAILED",
                "stage": "GENERAL_LEDGER_RECONCILIATION",
                "reconciliation": encode(reconciliation),
            }
        mismatched_periods = [
            line
            for line in lines
            if line.fiscal_year != closing_set.fiscal_year
            or line.fiscal_period != closing_set.fiscal_period
        ]
        if mismatched_periods:
            raise HTTPException(
                422, "general ledger fiscal year/period does not match closing analysis set"
            )
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
        period = f"{closing_set.fiscal_year:04d}-{closing_set.fiscal_period:02d}"
        rows = normalize_settlement(path, profile, upload_period=period)
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
        return analyze_closing_analysis_set(
            repository,
            closing_analysis_set_id,
            actor=user.user_id,
            knowledge_candidates=knowledge_candidates,
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
    risks = [risk for risk in repository.risks.values() if risk.company_id == company_id]
    events = [event for event in repository.events.values() if event.company_id == company_id]
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
    return encode([risk for risk in repository.risks.values() if risk.company_id == company_id])


@router.get("/risks/{risk_id}")
def get_risk(risk_id: UUID) -> Any:
    risk = _entity(repository.risks, risk_id, "risk")
    return {
        **encode(risk),
        "memory": encode(repository.risk_memory.get(risk.id, [])),
        "crossFindings": encode(
            [
                finding
                for finding in repository.cross_analysis_findings.values()
                if risk.id in finding.linked_risk_ids
                or finding.id in risk.cross_finding_ids
            ]
        ),
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
    return {**encode(event), "journalLines": encode(lines)}


@router.get("/journals")
def list_journals(company_id: UUID, limit: int = 100) -> Any:
    safe_limit = min(max(limit, 1), 500)
    lines = [
        line for line in repository.journal_lines.values() if line.company_id == company_id
    ]
    lines.sort(key=lambda item: (item.posting_date, item.document_number), reverse=True)
    return encode(lines[:safe_limit])


@router.get("/audit-log")
def audit_log(company_id: UUID) -> Any:
    return encode(
        [entry for entry in repository.audit_log if entry.company_id == company_id]
    )
