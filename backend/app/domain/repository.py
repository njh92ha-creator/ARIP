from __future__ import annotations

from collections import defaultdict
from copy import deepcopy
from dataclasses import asdict
import re
from threading import RLock
from typing import Any, TypeVar
from uuid import UUID, NAMESPACE_URL, uuid5
import os
import pickle
from sqlalchemy import text
from app.core.database import engine

from .models import (
    AccountingEvent,
    AnalysisEventResult,
    AuditLogEntry,
    ClosingAnalysisSet,
    CompanySettings,
    CrossAnalysisFinding,
    JournalLine,
    MappingProfile,
    MaterialityProfile,
    Risk,
    RiskPackage,
    RiskReviewAnswer,
    RiskReviewAttachment,
    RiskReviewCase,
    RiskReviewQuestionStatus,
    RiskMemoryEntry,
    SettlementBalance,
    VarianceObservation,
    VarianceException,
    VarianceProfile,
    utcnow,
)


def hydrate_legacy_object(obj: Any) -> None:
    """Populate fields added after a persisted dataclass instance was saved."""
    if isinstance(obj, SettlementBalance):
        if not hasattr(obj, "current_amount"):
            object.__setattr__(obj, "current_amount", None)
        if not hasattr(obj, "prior_amount"):
            object.__setattr__(obj, "prior_amount", None)
    if isinstance(obj, JournalLine) and not hasattr(obj, "source_filename"):
        object.__setattr__(obj, "source_filename", "")
    if isinstance(obj, (Risk, RiskPackage)):
        package = obj.package if isinstance(obj, Risk) else obj
        if isinstance(obj, Risk) and not hasattr(obj, "risk_code"):
            object.__setattr__(obj, "risk_code", "")
        defaults = {
            "related_accounts": [],
            "voucher_count": 0,
            "event_inference": "",
            "audit_issues": [],
            "standards_evidence": [],
            "ledger_evidence": [],
            "issue_types": [],
        }
        for field_name, default in defaults.items():
            if not hasattr(package, field_name):
                object.__setattr__(package, field_name, default)
    if isinstance(obj, RiskReviewCase):
        defaults = {
            "materiality_level": "LOW",
            "closing_analysis_set_id": None,
            "cross_finding_ids": [],
            "status": "OPEN",
        }
        for field_name, default in defaults.items():
            if not hasattr(obj, field_name):
                object.__setattr__(obj, field_name, default)
    if isinstance(obj, RiskReviewAnswer) and not hasattr(obj, "created_at"):
        object.__setattr__(obj, "created_at", obj.updated_at)

T = TypeVar("T")

RISK_CODE_PATTERN = re.compile(r"^(AS|LI|EQ|SA|CO)_\d{8}_\d{3}$")


def _pickle_payload(value: Any) -> bytes:
    return pickle.dumps(value, protocol=pickle.HIGHEST_PROTOCOL)


def _upsert_state(connection: Any, collection: str, object_id: str, value: Any) -> None:
    connection.execute(
        text("""
            insert into arip_state (collection, object_id, payload)
            values (:collection, :object_id, :payload)
            on conflict (collection, object_id) do update
            set payload = excluded.payload, updated_at = current_timestamp
        """),
        {
            "collection": collection,
            "object_id": object_id,
            "payload": _pickle_payload(value),
        },
    )


def _insert_state_once(
    connection: Any, collection: str, object_id: str, value: Any
) -> bool:
    inserted = connection.execute(
        text("""
            insert into arip_state (collection, object_id, payload)
            values (:collection, :object_id, :payload)
            on conflict (collection, object_id) do nothing
            returning object_id
        """),
        {
            "collection": collection,
            "object_id": object_id,
            "payload": _pickle_payload(value),
        },
    ).scalar_one_or_none()
    return inserted is not None


def _state_value(connection: Any, collection: str, object_id: str) -> Any | None:
    payload = connection.execute(
        text("""
            select payload from arip_state
            where collection = :collection and object_id = :object_id
        """),
        {"collection": collection, "object_id": object_id},
    ).scalar_one_or_none()
    return pickle.loads(bytes(payload)) if payload is not None else None


class InMemoryRepository:
    """Compatibility repository backed by PostgreSQL when available."""

    def __init__(self, *, persistent: bool | None = None) -> None:
        self._lock = RLock()
        self.companies: dict[UUID, CompanySettings] = {}
        self.materiality_profiles: dict[UUID, MaterialityProfile] = {}
        self.variance_profiles: dict[UUID, VarianceProfile] = {}
        self.mapping_profiles: dict[UUID, MappingProfile] = {}
        self.journal_lines: dict[UUID, JournalLine] = {}
        self.closing_analysis_sets: dict[UUID, ClosingAnalysisSet] = {}
        self.settlement_balances: dict[UUID, SettlementBalance] = {}
        self.cross_analysis_findings: dict[UUID, CrossAnalysisFinding] = {}
        self.events: dict[UUID, AccountingEvent] = {}
        self.analysis_event_results: dict[UUID, AnalysisEventResult] = {}
        self.risks: dict[UUID, Risk] = {}
        self.risk_review_cases: dict[UUID, RiskReviewCase] = {}
        self.risk_review_answers: dict[UUID, RiskReviewAnswer] = {}
        self.risk_review_question_statuses: dict[UUID, RiskReviewQuestionStatus] = {}
        self.risk_review_attachments: dict[UUID, RiskReviewAttachment] = {}
        self.risk_memory: dict[UUID, list[RiskMemoryEntry]] = defaultdict(list)
        self.variance_observations: dict[UUID, VarianceObservation] = {}
        self.audit_log: list[AuditLogEntry] = []
        self.runtime_settings: dict[str, Any] = {}
        self.processed_source_hashes: set[str] = set()
        self.event_hash_index: dict[tuple[UUID, str], UUID] = {}
        self._db_ready = False
        self.last_db_error: str | None = None
        self._persistence_enabled = (
            os.getenv("ARIP_SKIP_DATABASE", "false").lower() not in {"1", "true", "yes"}
            if persistent is None
            else persistent
        )
        if self._persistence_enabled:
            self._initialize_database()
            self._restore()

    def _initialize_database(self) -> None:
        if not self._persistence_enabled:
            return
        try:
            with engine.begin() as connection:
                connection.execute(text("""
                    create table if not exists arip_state (
                        collection varchar(80) not null,
                        object_id varchar(64) not null,
                        payload bytea not null,
                        updated_at timestamptz not null default now(),
                        primary key (collection, object_id)
                    )
                """))
                connection.execute(text("""
                    create table if not exists arip_state_log (
                        id bigserial primary key,
                        collection varchar(80) not null,
                        object_id varchar(64),
                        payload bytea not null,
                        created_at timestamptz not null default now()
                    )
                """))
            self._db_ready = True
        except Exception as exc:
            # The API remains usable in local/demo mode if the DB is unavailable.
            self._db_ready = False
            self.last_db_error = type(exc).__name__

    def _sync_transfer_marker(self, marker: dict[str, Any]) -> None:
        memory_entry = marker.get("memory")
        if isinstance(memory_entry, RiskMemoryEntry):
            entries = self.risk_memory[memory_entry.risk_id]
            if all(entry.id != memory_entry.id for entry in entries):
                entries.append(memory_entry)
        audit_entry = marker.get("audit")
        if isinstance(audit_entry, AuditLogEntry) and all(
            entry.id != audit_entry.id for entry in self.audit_log
        ):
            self.audit_log.append(audit_entry)

    def _restore(self) -> None:
        if not self._db_ready:
            return
        try:
            transfer_markers: list[dict[str, Any]] = []
            with engine.connect() as connection:
                rows = connection.execute(text("select collection, object_id, payload from arip_state"))
                for collection, object_id, payload in rows:
                    obj = pickle.loads(bytes(payload))
                    if collection == "RiskReviewTransfer" and isinstance(obj, dict):
                        transfer_markers.append(obj)
                        continue
                    hydrate_legacy_object(obj)
                    store_name = {
                        "CompanySettings": "companies",
                        "MaterialityProfile": "materiality_profiles",
                        "VarianceProfile": "variance_profiles",
                        "MappingProfile": "mapping_profiles",
                        "JournalLine": "journal_lines",
                        "ClosingAnalysisSet": "closing_analysis_sets",
                        "SettlementBalance": "settlement_balances",
                        "CrossAnalysisFinding": "cross_analysis_findings",
                        "AccountingEvent": "events",
                        "AnalysisEventResult": "analysis_event_results",
                        "Risk": "risks",
                        "RiskReviewCase": "risk_review_cases",
                        "RiskReviewAnswer": "risk_review_answers",
                        "RiskReviewQuestionStatus": "risk_review_question_statuses",
                        "RiskReviewAttachment": "risk_review_attachments",
                        "VarianceObservation": "variance_observations",
                    }.get(collection)
                    store = getattr(self, store_name, None) if store_name else None
                    if isinstance(store, dict):
                        store[UUID(object_id)] = obj
                        if isinstance(obj, JournalLine) and obj.source_hash:
                            self.processed_source_hashes.add(obj.source_hash)
                        if isinstance(obj, AccountingEvent):
                            self.event_hash_index[(obj.company_id, obj.event_hash)] = obj.id
                log_rows = connection.execute(
                    text("select collection, payload from arip_state_log order by id")
                )
                for collection, payload in log_rows:
                    obj = pickle.loads(bytes(payload))
                    if collection == "risk_memory" and isinstance(obj, RiskMemoryEntry):
                        self.risk_memory[obj.risk_id].append(obj)
                    elif collection == "audit_log" and isinstance(obj, AuditLogEntry):
                        self.audit_log.append(obj)
            for marker in transfer_markers:
                self._sync_transfer_marker(marker)
        except Exception as exc:
            self._db_ready = False
            self.last_db_error = type(exc).__name__

    def _persist(self, collection: str, obj: Any, *, append_only: bool = False) -> None:
        if not self._db_ready:
            return
        payload = pickle.dumps(obj, protocol=pickle.HIGHEST_PROTOCOL)
        try:
            with engine.begin() as connection:
                if append_only:
                    connection.execute(text("insert into arip_state_log (collection, object_id, payload) values (:collection, :object_id, :payload)"), {"collection": collection, "object_id": str(getattr(obj, "id", "")), "payload": payload})
                else:
                    connection.execute(text("""
                        insert into arip_state (collection, object_id, payload)
                        values (:collection, :object_id, :payload)
                        on conflict (collection, object_id) do update
                        set payload = excluded.payload, updated_at = now()
                    """), {"collection": collection, "object_id": str(obj.id), "payload": payload})
        except Exception as exc:
            self._db_ready = False
            self.last_db_error = type(exc).__name__

    def get_runtime_setting(self, key: str, default: Any = None) -> Any:
        with self._lock:
            if key in self.runtime_settings:
                return self.runtime_settings[key]
            if not self._db_ready:
                return default
            try:
                with engine.connect() as connection:
                    payload = connection.execute(
                        text("select payload from arip_state where collection = :collection and object_id = :object_id"),
                        {"collection": "RuntimeSetting", "object_id": key},
                    ).scalar_one_or_none()
                if payload is None:
                    return default
                value = pickle.loads(bytes(payload))
                self.runtime_settings[key] = value
                return value
            except Exception as exc:
                self._db_ready = False
                self.last_db_error = type(exc).__name__
                return default

    def save_runtime_setting(self, key: str, value: Any) -> None:
        with self._lock:
            self.runtime_settings[key] = value
            if not self._db_ready:
                return
            try:
                with engine.begin() as connection:
                    connection.execute(text("""
                        insert into arip_state (collection, object_id, payload)
                        values (:collection, :object_id, :payload)
                        on conflict (collection, object_id) do update
                        set payload = excluded.payload, updated_at = now()
                    """), {
                        "collection": "RuntimeSetting",
                        "object_id": key,
                        "payload": pickle.dumps(value, protocol=pickle.HIGHEST_PROTOCOL),
                    })
            except Exception as exc:
                self._db_ready = False
                self.last_db_error = type(exc).__name__

    def save(self, obj: T) -> T:
        with self._lock:
            stores: dict[type[Any], dict[Any, Any]] = {
                CompanySettings: self.companies,
                MaterialityProfile: self.materiality_profiles,
                VarianceProfile: self.variance_profiles,
                MappingProfile: self.mapping_profiles,
                JournalLine: self.journal_lines,
                ClosingAnalysisSet: self.closing_analysis_sets,
                SettlementBalance: self.settlement_balances,
                CrossAnalysisFinding: self.cross_analysis_findings,
                AccountingEvent: self.events,
                AnalysisEventResult: self.analysis_event_results,
                Risk: self.risks,
                RiskReviewCase: self.risk_review_cases,
                RiskReviewAnswer: self.risk_review_answers,
                RiskReviewQuestionStatus: self.risk_review_question_statuses,
                RiskReviewAttachment: self.risk_review_attachments,
                VarianceObservation: self.variance_observations,
            }
            store = stores[type(obj)]
            store[obj.id] = obj
            if isinstance(obj, AccountingEvent):
                self.event_hash_index[(obj.company_id, obj.event_hash)] = obj.id
            self._persist(type(obj).__name__, obj)
            return obj

    def get_materiality_profile(self, company_id: UUID) -> MaterialityProfile | None:
        return next(
            (item for item in self.materiality_profiles.values() if item.company_id == company_id),
            None,
        )

    def upsert_materiality_profile(
        self,
        company_id: UUID,
        *,
        name: str,
        benchmark: str,
        overall_materiality: Any,
        performance_materiality: Any,
        trivial_threshold: Any,
        effective_from: Any,
        qualitative_factors: list[str] | None = None,
    ) -> MaterialityProfile:
        with self._lock:
            profiles = [
                item for item in self.materiality_profiles.values() if item.company_id == company_id
            ]
            profile = profiles[0] if profiles else MaterialityProfile(
                company_id=company_id,
                name=name,
                benchmark=benchmark,
                overall_materiality=overall_materiality,
                performance_materiality=performance_materiality,
                trivial_threshold=trivial_threshold,
                effective_from=effective_from,
            )
            profile.name = name
            profile.benchmark = benchmark
            profile.overall_materiality = overall_materiality
            profile.performance_materiality = performance_materiality
            profile.trivial_threshold = trivial_threshold
            profile.effective_from = effective_from
            profile.qualitative_factors = qualitative_factors or []
            profile.status = "APPROVED"
            for duplicate in profiles[1:]:
                self.materiality_profiles.pop(duplicate.id, None)
                if self._db_ready:
                    try:
                        with engine.begin() as connection:
                            connection.execute(
                                text("delete from arip_state where collection = :collection and object_id = :object_id"),
                                {"collection": "MaterialityProfile", "object_id": str(duplicate.id)},
                            )
                    except Exception as exc:
                        self._db_ready = False
                        self.last_db_error = type(exc).__name__
            return self.save(profile)

    def get_variance_profile(self, company_id: UUID) -> VarianceProfile | None:
        with self._lock:
            profile = next(
                (item for item in self.variance_profiles.values() if item.company_id == company_id),
                None,
            )
            if profile is None or hasattr(profile, "effective_from"):
                return profile
            upgraded = VarianceProfile(
                company_id=profile.company_id,
                name=profile.name,
                thresholds=profile.thresholds,
                status=profile.status,
                version=profile.version,
                id=profile.id,
            )
            self.variance_profiles[upgraded.id] = upgraded
            self._persist("VarianceProfile", upgraded)
            return upgraded

    def upsert_variance_profile(
        self,
        company_id: UUID,
        *,
        name: str,
        thresholds: list[VarianceThreshold],
        effective_from: Any = None,
        effective_to: Any = None,
        exceptions: list[dict[str, Any] | VarianceException] | None = None,
    ) -> VarianceProfile:
        with self._lock:
            profiles = [
                item for item in self.variance_profiles.values() if item.company_id == company_id
            ]
            profile = profiles[0] if profiles else VarianceProfile(
                company_id=company_id,
                name=name,
                thresholds=thresholds,
            )
            profile.name = name
            profile.thresholds = thresholds
            profile.effective_from = effective_from
            profile.effective_to = effective_to
            profile.exceptions = [
                item if isinstance(item, VarianceException) else VarianceException(**item)
                for item in (exceptions or [])
            ]
            profile.status = "APPROVED"
            for duplicate in profiles[1:]:
                self.variance_profiles.pop(duplicate.id, None)
                if self._db_ready:
                    try:
                        with engine.begin() as connection:
                            connection.execute(
                                text("delete from arip_state where collection = :collection and object_id = :object_id"),
                                {"collection": "VarianceProfile", "object_id": str(duplicate.id)},
                            )
                    except Exception as exc:
                        self._db_ready = False
                        self.last_db_error = type(exc).__name__
            return self.save(profile)

    def remove(self, obj: Any) -> None:
        """Remove a replaceable current-state record while retaining append-only logs."""
        with self._lock:
            stores: dict[type[Any], dict[Any, Any]] = {
                ClosingAnalysisSet: self.closing_analysis_sets,
                SettlementBalance: self.settlement_balances,
                JournalLine: self.journal_lines,
                CrossAnalysisFinding: self.cross_analysis_findings,
                VarianceObservation: self.variance_observations,
            }
            store = stores.get(type(obj))
            if store is None:
                raise ValueError(f"object type is not replaceable: {type(obj).__name__}")
            store.pop(obj.id, None)
            if not self._db_ready:
                return
            try:
                with engine.begin() as connection:
                    connection.execute(
                        text("delete from arip_state where collection = :collection and object_id = :object_id"),
                        {"collection": type(obj).__name__, "object_id": str(obj.id)},
                    )
            except Exception as exc:
                self._db_ready = False
                self.last_db_error = type(exc).__name__

    def delete_risk_analysis(self, risk_id: UUID) -> Risk:
        """Permanently delete one derived risk and its risk-specific history."""
        with self._lock:
            risk = self.risks.pop(risk_id, None)
            if risk is None:
                raise KeyError(risk_id)
            self.risk_memory.pop(risk_id, None)
            self.audit_log = [
                entry
                for entry in self.audit_log
                if not (entry.resource_type == "Risk" and entry.resource_id == str(risk_id))
            ]
            if not self._db_ready:
                return risk
            try:
                with engine.begin() as connection:
                    connection.execute(
                        text("delete from arip_state where collection = 'Risk' and object_id = :risk_id"),
                        {"risk_id": str(risk_id)},
                    )
                    rows = connection.execute(
                        text("select id, collection, payload from arip_state_log where collection in ('risk_memory', 'audit_log')")
                    ).all()
                    log_ids = []
                    for row in rows:
                        entry = pickle.loads(bytes(row.payload))
                        if isinstance(entry, RiskMemoryEntry) and entry.risk_id == risk_id:
                            log_ids.append(row.id)
                        elif (
                            isinstance(entry, AuditLogEntry)
                            and entry.resource_type == "Risk"
                            and entry.resource_id == str(risk_id)
                        ):
                            log_ids.append(row.id)
                    if log_ids:
                        connection.execute(
                            text("delete from arip_state_log where id = any(:log_ids)"),
                            {"log_ids": log_ids},
                        )
            except Exception as exc:
                self._db_ready = False
                self.last_db_error = type(exc).__name__
            return risk

    @staticmethod
    def _validate_review_transfer(
        source_risk: Risk, review_decision: str, severity: str
    ) -> None:
        if review_decision not in {"CHECK", "PENDING"}:
            raise ValueError("review decision must be CHECK or PENDING")
        if severity not in {"HIGH", "MEDIUM", "LOW"}:
            raise ValueError("severity must be HIGH, MEDIUM, or LOW")
        if not RISK_CODE_PATTERN.fullmatch(source_risk.risk_code or ""):
            raise ValueError(
                "risk code must match AS|LI|EQ|SA|CO_YYYYMMDD_NNN before transfer"
            )

    def _ensure_review_persistence(self) -> None:
        if self._persistence_enabled and not self._db_ready:
            raise RuntimeError("review persistence is unavailable")

    @staticmethod
    def _build_review_case(
        source_risk: Risk, review_decision: str, severity: str
    ) -> RiskReviewCase:
        return RiskReviewCase(
            company_id=source_risk.company_id,
            source_risk_id=source_risk.id,
            risk_code=source_risk.risk_code,
            title=source_risk.title,
            statement=source_risk.statement,
            level=source_risk.level,
            score=source_risk.score,
            route=source_risk.route,
            package=deepcopy(source_risk.package),
            review_decision=review_decision,
            severity=severity,
            materiality_level=source_risk.materiality_level,
            closing_analysis_set_id=source_risk.closing_analysis_set_id,
            cross_finding_ids=deepcopy(source_risk.cross_finding_ids),
        )

    def get_review_case(self, review_case_id: UUID) -> RiskReviewCase | None:
        with self._lock:
            review_case = self.risk_review_cases.get(review_case_id)
            if self._db_ready:
                with engine.connect() as connection:
                    persisted = _state_value(
                        connection, "RiskReviewCase", str(review_case_id)
                    )
                    if isinstance(persisted, RiskReviewCase):
                        hydrate_legacy_object(persisted)
                        review_case = persisted
                    if review_case is not None:
                        decision = _state_value(
                            connection, "RiskReviewCaseDecision", str(review_case_id)
                        )
                        severity = _state_value(
                            connection, "RiskReviewCaseSeverity", str(review_case_id)
                        )
                        if isinstance(decision, str):
                            review_case.review_decision = decision
                        if isinstance(severity, str):
                            review_case.severity = severity
            if review_case is not None:
                self.risk_review_cases[review_case.id] = review_case
            return review_case

    def review_cases_for_company(self, company_id: UUID) -> list[RiskReviewCase]:
        with self._lock:
            case_ids = {
                case.id
                for case in self.risk_review_cases.values()
                if case.company_id == company_id
            }
            if self._db_ready:
                with engine.connect() as connection:
                    rows = connection.execute(
                        text("select payload from arip_state where collection = 'RiskReviewCase'")
                    )
                    for (payload,) in rows:
                        case = pickle.loads(bytes(payload))
                        if isinstance(case, RiskReviewCase) and case.company_id == company_id:
                            case_ids.add(case.id)
            return [
                case
                for case_id in case_ids
                if (case := self.get_review_case(case_id)) is not None
            ]

    def review_case_for_source_risk(self, source_risk_id: UUID) -> RiskReviewCase | None:
        with self._lock:
            if self._db_ready:
                with engine.connect() as connection:
                    marker = _state_value(
                        connection, "RiskReviewTransfer", str(source_risk_id)
                    )
                if isinstance(marker, dict) and marker.get("case_id"):
                    self._sync_transfer_marker(marker)
                    return self.get_review_case(UUID(str(marker["case_id"])))
            existing = next(
                (
                    case
                    for case in self.risk_review_cases.values()
                    if case.source_risk_id == source_risk_id
                ),
                None,
            )
            if existing is not None or not self._db_ready:
                return existing
            with engine.connect() as connection:
                rows = connection.execute(
                    text("select payload from arip_state where collection = 'RiskReviewCase'")
                )
                for (payload,) in rows:
                    case = pickle.loads(bytes(payload))
                    if isinstance(case, RiskReviewCase) and case.source_risk_id == source_risk_id:
                        self.risk_review_cases[case.id] = case
                        return self.get_review_case(case.id)
            return None

    def review_case_by_risk_code(
        self, company_id: UUID, risk_code: str
    ) -> RiskReviewCase | None:
        with self._lock:
            if self._db_ready:
                with engine.connect() as connection:
                    case_id = _state_value(
                        connection,
                        "RiskReviewCaseByCode",
                        f"{company_id}:{risk_code}",
                    )
                if case_id is not None:
                    return self.get_review_case(UUID(str(case_id)))
            return next(
                (
                    case
                    for case in self.review_cases_for_company(company_id)
                    if case.risk_code == risk_code
                ),
                None,
            )

    def is_risk_transferred(self, source_risk_id: UUID) -> bool:
        if self._db_ready:
            with engine.connect() as connection:
                if _state_value(
                    connection, "RiskReviewTransfer", str(source_risk_id)
                ) is not None:
                    return True
        return self.review_case_for_source_risk(source_risk_id) is not None

    def create_review_case(
        self, source_risk: Risk, *, review_decision: str, severity: str
    ) -> RiskReviewCase:
        """Create one review case per source risk, preserving its transfer-time snapshot."""
        with self._lock:
            self._ensure_review_persistence()
            self._validate_review_transfer(source_risk, review_decision, severity)
            existing = self.review_case_for_source_risk(source_risk.id)
            if existing is not None:
                return existing
            duplicate = self.review_case_by_risk_code(
                source_risk.company_id, source_risk.risk_code
            )
            if duplicate is not None:
                raise ValueError("risk code already belongs to another review case")
            review_case = self._build_review_case(
                source_risk, review_decision, severity
            )
            return self.save(review_case)

    def transfer_risk_to_review(
        self,
        source_risk: Risk,
        *,
        review_decision: str,
        severity: str,
        actor: str,
    ) -> tuple[RiskReviewCase, bool]:
        """Atomically claim a source risk and persist its case, marker, and audit."""
        with self._lock:
            self._ensure_review_persistence()
            self._validate_review_transfer(source_risk, review_decision, severity)
            existing = self.review_case_for_source_risk(source_risk.id)
            duplicate = self.review_case_by_risk_code(
                source_risk.company_id, source_risk.risk_code
            )
            if (
                duplicate is not None
                and duplicate.source_risk_id != source_risk.id
            ):
                raise ValueError("risk code already belongs to another review case")
            if not self._db_ready:
                review_case = self.create_review_case(
                    source_risk,
                    review_decision=review_decision,
                    severity=severity,
                )
                created = existing is None
                if created:
                    memory = RiskMemoryEntry(
                        risk_id=source_risk.id,
                        entry_type="RISK_TRANSFERRED",
                        summary=f"Transferred to review case {source_risk.risk_code}",
                        actor=actor,
                        metadata={
                            "review_case_id": str(review_case.id),
                            "risk_code": source_risk.risk_code,
                        },
                    )
                    audit = AuditLogEntry(
                        action="RISK_TRANSFERRED",
                        resource_type="Risk",
                        resource_id=str(source_risk.id),
                        actor=actor,
                        company_id=source_risk.company_id,
                        reason=review_decision,
                    )
                    self.risk_memory[source_risk.id].append(memory)
                    self.audit_log.append(audit)
                return review_case, created

            review_case = existing or self._build_review_case(
                source_risk, review_decision, severity
            )
            marker: dict[str, Any] = {
                "case_id": str(review_case.id),
                "memory": RiskMemoryEntry(
                    risk_id=source_risk.id,
                    entry_type="RISK_TRANSFERRED",
                    summary=f"Transferred to review case {source_risk.risk_code}",
                    actor=actor,
                    metadata={
                        "review_case_id": str(review_case.id),
                        "risk_code": source_risk.risk_code,
                    },
                ),
                "audit": AuditLogEntry(
                    action="RISK_TRANSFERRED",
                    resource_type="Risk",
                    resource_id=str(source_risk.id),
                    actor=actor,
                    company_id=source_risk.company_id,
                    reason=review_decision,
                ),
            }
            with engine.begin() as connection:
                created = _insert_state_once(
                    connection,
                    "RiskReviewTransfer",
                    str(source_risk.id),
                    marker,
                )
                if created:
                    code_key = f"{source_risk.company_id}:{source_risk.risk_code}"
                    if not _insert_state_once(
                        connection,
                        "RiskReviewCaseByCode",
                        code_key,
                        str(review_case.id),
                    ):
                        owner_id = _state_value(
                            connection, "RiskReviewCaseByCode", code_key
                        )
                        if str(owner_id) != str(review_case.id):
                            raise ValueError(
                                "risk code already belongs to another review case"
                            )
                    _upsert_state(
                        connection,
                        "RiskReviewCase",
                        str(review_case.id),
                        review_case,
                    )
                else:
                    persisted_marker = _state_value(
                        connection, "RiskReviewTransfer", str(source_risk.id)
                    )
                    if not isinstance(persisted_marker, dict):
                        raise RuntimeError("review transfer marker is invalid")
                    marker = persisted_marker

            self._sync_transfer_marker(marker)
            persisted_case = self.get_review_case(UUID(str(marker["case_id"])))
            if persisted_case is None:
                raise RuntimeError("review transfer case is missing")
            return persisted_case, created

    def answers_for_review_case(self, review_case_id: UUID) -> list[RiskReviewAnswer]:
        with self._lock:
            if self._db_ready:
                loaded: dict[UUID, RiskReviewAnswer] = {}
                with engine.connect() as connection:
                    rows = connection.execute(
                        text("select payload from arip_state where collection = 'RiskReviewAnswer'")
                    )
                    for (payload,) in rows:
                        answer = pickle.loads(bytes(payload))
                        if (
                            isinstance(answer, RiskReviewAnswer)
                            and answer.review_case_id == review_case_id
                        ):
                            loaded[answer.id] = answer
                self.risk_review_answers.update(loaded)
            answers = [
                answer
                for answer in self.risk_review_answers.values()
                if answer.review_case_id == review_case_id
            ]
            return sorted(answers, key=lambda answer: answer.created_at)

    def add_review_answer(
        self, review_case_id: UUID, *, question: str, answer: str
    ) -> RiskReviewAnswer:
        with self._lock:
            self._ensure_review_persistence()
            if self.get_review_case(review_case_id) is None:
                raise KeyError(review_case_id)
            entry = RiskReviewAnswer(
                review_case_id=review_case_id,
                question=question,
                answer=answer,
            )
            if self._db_ready:
                with engine.begin() as connection:
                    _upsert_state(
                        connection,
                        "RiskReviewAnswer",
                        str(entry.id),
                        entry,
                    )
                self.risk_review_answers[entry.id] = entry
                return entry
            return self.save(entry)

    def remove_review_answer(
        self, review_case_id: UUID, answer_id: UUID
    ) -> RiskReviewAnswer:
        with self._lock:
            self._ensure_review_persistence()
            answer = self.risk_review_answers.get(answer_id)
            if answer is None or answer.review_case_id != review_case_id:
                raise KeyError(answer_id)
            self.risk_review_answers.pop(answer_id)
            if self._db_ready:
                with engine.begin() as connection:
                    connection.execute(
                        text("delete from arip_state where collection = :collection and object_id = :object_id"),
                        {"collection": "RiskReviewAnswer", "object_id": str(answer_id)},
                    )
            return answer

    def question_statuses_for_review_case(
        self, review_case_id: UUID
    ) -> list[RiskReviewQuestionStatus]:
        with self._lock:
            statuses = [
                item
                for item in self.risk_review_question_statuses.values()
                if item.review_case_id == review_case_id
            ]
            return sorted(statuses, key=lambda item: item.created_at)

    def set_review_question_status(
        self, review_case_id: UUID, *, question: str, status: str
    ) -> RiskReviewQuestionStatus:
        if status not in {"NOT_REQUIRED", "DUPLICATE"}:
            raise ValueError("status must be NOT_REQUIRED or DUPLICATE")
        with self._lock:
            self._ensure_review_persistence()
            if self.get_review_case(review_case_id) is None:
                raise KeyError(review_case_id)
            existing = next(
                (
                    item
                    for item in self.question_statuses_for_review_case(review_case_id)
                    if item.question == question
                ),
                None,
            )
            if existing is None:
                existing = RiskReviewQuestionStatus(
                    review_case_id=review_case_id, question=question, status=status
                )
            else:
                existing.status = status
                existing.created_at = utcnow()
            return self.save(existing)

    def update_review_case_decision(
        self, review_case_id: UUID, decision: str
    ) -> RiskReviewCase:
        if decision not in {"CHECK", "PENDING", "PASS"}:
            raise ValueError("decision must be CHECK, PENDING, or PASS")
        with self._lock:
            self._ensure_review_persistence()
            review_case = self.get_review_case(review_case_id)
            if review_case is None:
                raise KeyError(review_case_id)
            if self._db_ready:
                with engine.begin() as connection:
                    _upsert_state(
                        connection,
                        "RiskReviewCaseDecision",
                        str(review_case_id),
                        decision,
                    )
            review_case.review_decision = decision
            self.risk_review_cases[review_case_id] = review_case
            return review_case

    def update_review_case_severity(
        self, review_case_id: UUID, severity: str
    ) -> RiskReviewCase:
        if severity not in {"HIGH", "MEDIUM", "LOW"}:
            raise ValueError("severity must be HIGH, MEDIUM, or LOW")
        with self._lock:
            self._ensure_review_persistence()
            review_case = self.get_review_case(review_case_id)
            if review_case is None:
                raise KeyError(review_case_id)
            if self._db_ready:
                with engine.begin() as connection:
                    _upsert_state(
                        connection,
                        "RiskReviewCaseSeverity",
                        str(review_case_id),
                        severity,
                    )
            review_case.severity = severity
            self.risk_review_cases[review_case_id] = review_case
            return review_case

    def attachments_for_review_case(self, review_case_id: UUID) -> list[RiskReviewAttachment]:
        with self._lock:
            if self._db_ready:
                loaded: dict[UUID, RiskReviewAttachment] = {}
                with engine.connect() as connection:
                    rows = connection.execute(
                        text("select payload from arip_state where collection = 'RiskReviewAttachment'")
                    )
                    for (payload,) in rows:
                        attachment = pickle.loads(bytes(payload))
                        if (
                            isinstance(attachment, RiskReviewAttachment)
                            and attachment.review_case_id == review_case_id
                        ):
                            loaded[attachment.id] = attachment
                self.risk_review_attachments.update(loaded)
            return [
                attachment
                for attachment in self.risk_review_attachments.values()
                if attachment.review_case_id == review_case_id
            ]

    def add_review_attachment(
        self, attachment: RiskReviewAttachment
    ) -> RiskReviewAttachment:
        with self._lock:
            self._ensure_review_persistence()
            if self.get_review_case(attachment.review_case_id) is None:
                raise KeyError(attachment.review_case_id)
            if self._db_ready:
                with engine.begin() as connection:
                    rows = connection.execute(
                        text("select payload from arip_state where collection = 'RiskReviewAttachment'")
                    )
                    existing_attachments = []
                    for (payload,) in rows:
                        candidate = pickle.loads(bytes(payload))
                        if (
                            isinstance(candidate, RiskReviewAttachment)
                            and candidate.review_case_id == attachment.review_case_id
                        ):
                            existing_attachments.append(candidate)
                    if len(existing_attachments) >= 10:
                        raise ValueError(
                            "a review case cannot have more than 10 attachments"
                        )
                    for index, candidate in enumerate(
                        sorted(existing_attachments, key=lambda item: str(item.id))
                    ):
                        _insert_state_once(
                            connection,
                            "RiskReviewAttachmentSlot",
                            f"{attachment.review_case_id}:{index:02d}",
                            str(candidate.id),
                        )
                    claimed = False
                    for index in range(10):
                        if _insert_state_once(
                            connection,
                            "RiskReviewAttachmentSlot",
                            f"{attachment.review_case_id}:{index:02d}",
                            str(attachment.id),
                        ):
                            claimed = True
                            break
                    if not claimed:
                        raise ValueError(
                            "a review case cannot have more than 10 attachments"
                        )
                    _upsert_state(
                        connection,
                        "RiskReviewAttachment",
                        str(attachment.id),
                        attachment,
                    )
                self.risk_review_attachments[attachment.id] = attachment
                return attachment
            if len(self.attachments_for_review_case(attachment.review_case_id)) >= 10:
                raise ValueError("a review case cannot have more than 10 attachments")
            return self.save(attachment)

    def remove_review_attachment(
        self, review_case_id: UUID, attachment_id: UUID
    ) -> RiskReviewAttachment:
        with self._lock:
            self._ensure_review_persistence()
            attachment = next(
                (
                    item
                    for item in self.attachments_for_review_case(review_case_id)
                    if item.id == attachment_id
                ),
                None,
            )
            if attachment is None or attachment.review_case_id != review_case_id:
                raise KeyError(attachment_id)
            self.risk_review_attachments.pop(attachment_id)
            if self._db_ready:
                with engine.begin() as connection:
                    connection.execute(
                        text("delete from arip_state where collection = :collection and object_id = :object_id"),
                        {"collection": "RiskReviewAttachment", "object_id": str(attachment_id)},
                    )
                    slots = connection.execute(
                        text("select object_id, payload from arip_state where collection = 'RiskReviewAttachmentSlot'")
                    )
                    for slot_id, payload in slots:
                        if str(pickle.loads(bytes(payload))) == str(attachment_id):
                            connection.execute(
                                text("delete from arip_state where collection = 'RiskReviewAttachmentSlot' and object_id = :object_id"),
                                {"object_id": slot_id},
                            )
            return attachment

    def remove_company(self, company_id: UUID) -> CompanySettings:
        with self._lock:
            company = self.companies.pop(company_id, None)
            if company is None:
                raise KeyError(company_id)
            stores = (
                ("MaterialityProfile", self.materiality_profiles),
                ("VarianceProfile", self.variance_profiles),
                ("MappingProfile", self.mapping_profiles),
                ("JournalLine", self.journal_lines),
                ("ClosingAnalysisSet", self.closing_analysis_sets),
                ("SettlementBalance", self.settlement_balances),
                ("CrossAnalysisFinding", self.cross_analysis_findings),
                ("AccountingEvent", self.events),
                ("Risk", self.risks),
                ("RiskReviewCase", self.risk_review_cases),
                ("VarianceObservation", self.variance_observations),
            )
            removed = [("CompanySettings", str(company.id))]
            removed_review_case_ids: set[UUID] = set()
            for collection, store in stores:
                for object_id, item in list(store.items()):
                    if getattr(item, "company_id", None) == company_id:
                        store.pop(object_id)
                        removed.append((collection, str(object_id)))
                        if collection == "RiskReviewCase":
                            removed_review_case_ids.add(object_id)
            for collection, store in (
                ("RiskReviewAnswer", self.risk_review_answers),
                ("RiskReviewQuestionStatus", self.risk_review_question_statuses),
                ("RiskReviewAttachment", self.risk_review_attachments),
            ):
                for object_id, item in list(store.items()):
                    if item.review_case_id in removed_review_case_ids:
                        store.pop(object_id)
                        removed.append((collection, str(object_id)))
            self.risk_memory = defaultdict(
                list,
                {risk_id: entries for risk_id, entries in self.risk_memory.items()
                 if risk_id in self.risks},
            )
            self.event_hash_index = {
                key: event_id for key, event_id in self.event_hash_index.items()
                if key[0] != company_id
            }
            if self._db_ready:
                try:
                    with engine.begin() as connection:
                        for collection, object_id in removed:
                            connection.execute(
                                text("delete from arip_state where collection = :collection and object_id = :object_id"),
                                {"collection": collection, "object_id": object_id},
                            )
                except Exception as exc:
                    self._db_ready = False
                    self.last_db_error = type(exc).__name__
            return company

    def append_memory(self, entry: RiskMemoryEntry) -> None:
        with self._lock:
            self.risk_memory[entry.risk_id].append(entry)
            self._persist("risk_memory", entry, append_only=True)

    def append_audit(self, entry: AuditLogEntry) -> None:
        with self._lock:
            self.audit_log.append(entry)
            self._persist("audit_log", entry, append_only=True)

    def event_by_hash(self, company_id: UUID, event_hash: str) -> AccountingEvent | None:
        event_id = self.event_hash_index.get((company_id, event_hash))
        return self.events.get(event_id) if event_id else None

    def closing_set_by_scope(
        self, company_id: UUID, fiscal_year: int, fiscal_period: int
    ) -> ClosingAnalysisSet | None:
        return next(
            (
                item
                for item in self.closing_analysis_sets.values()
                if item.company_id == company_id
                and item.fiscal_year == fiscal_year
                and item.fiscal_period == fiscal_period
            ),
            None,
        )

    def settlement_for_set(self, closing_analysis_set_id: UUID) -> list[SettlementBalance]:
        return [
            balance
            for balance in self.settlement_balances.values()
            if balance.closing_analysis_set_id == closing_analysis_set_id
        ]

    def lines_for_set(self, closing_analysis_set_id: UUID) -> list[JournalLine]:
        return [
            line
            for line in self.journal_lines.values()
            if line.closing_analysis_set_id == closing_analysis_set_id
        ]

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            return {
                "companies": len(self.companies),
                "mappingProfiles": len(self.mapping_profiles),
                "journalLines": len(self.journal_lines),
                "closingAnalysisSets": len(self.closing_analysis_sets),
                "settlementBalances": len(self.settlement_balances),
                "crossAnalysisFindings": len(self.cross_analysis_findings),
                "events": len(self.events),
                "risks": len(self.risks),
                "riskReviewCases": len(self.risk_review_cases),
                "varianceObservations": len(self.variance_observations),
                "auditEntries": len(self.audit_log),
            }


repository = InMemoryRepository(
    persistent=os.getenv("ARIP_SKIP_DATABASE", "false").lower() not in {"1", "true", "yes"}
)
