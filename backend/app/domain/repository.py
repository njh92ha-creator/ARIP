from __future__ import annotations

from collections import defaultdict
from dataclasses import asdict
from threading import RLock
from typing import Any, TypeVar
from uuid import UUID
import pickle
from sqlalchemy import text
from app.core.database import engine

from .models import (
    AccountingEvent,
    AuditLogEntry,
    CompanySettings,
    JournalLine,
    MappingProfile,
    MaterialityProfile,
    Risk,
    RiskMemoryEntry,
    VarianceObservation,
    VarianceProfile,
)

T = TypeVar("T")


class InMemoryRepository:
    """Compatibility repository backed by PostgreSQL when available."""

    def __init__(self) -> None:
        self._lock = RLock()
        self.companies: dict[UUID, CompanySettings] = {}
        self.materiality_profiles: dict[UUID, MaterialityProfile] = {}
        self.variance_profiles: dict[UUID, VarianceProfile] = {}
        self.mapping_profiles: dict[UUID, MappingProfile] = {}
        self.journal_lines: dict[UUID, JournalLine] = {}
        self.events: dict[UUID, AccountingEvent] = {}
        self.risks: dict[UUID, Risk] = {}
        self.risk_memory: dict[UUID, list[RiskMemoryEntry]] = defaultdict(list)
        self.variance_observations: dict[UUID, VarianceObservation] = {}
        self.audit_log: list[AuditLogEntry] = []
        self.processed_source_hashes: set[str] = set()
        self.event_hash_index: dict[tuple[UUID, str], UUID] = {}
        self._db_ready = False
        self.last_db_error: str | None = None
        self._initialize_database()
        self._restore()

    def _initialize_database(self) -> None:
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

    def _restore(self) -> None:
        if not self._db_ready:
            return
        try:
            with engine.connect() as connection:
                rows = connection.execute(text("select collection, object_id, payload from arip_state"))
                for collection, object_id, payload in rows:
                    obj = pickle.loads(bytes(payload))
                    store_name = {
                        "CompanySettings": "companies",
                        "MaterialityProfile": "materiality_profiles",
                        "VarianceProfile": "variance_profiles",
                        "MappingProfile": "mapping_profiles",
                        "JournalLine": "journal_lines",
                        "AccountingEvent": "events",
                        "Risk": "risks",
                        "VarianceObservation": "variance_observations",
                    }.get(collection)
                    store = getattr(self, store_name, None) if store_name else None
                    if isinstance(store, dict):
                        store[UUID(object_id)] = obj
                        if isinstance(obj, AccountingEvent):
                            self.event_hash_index[(obj.company_id, obj.event_hash)] = obj.id
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

    def save(self, obj: T) -> T:
        with self._lock:
            stores: dict[type[Any], dict[Any, Any]] = {
                CompanySettings: self.companies,
                MaterialityProfile: self.materiality_profiles,
                VarianceProfile: self.variance_profiles,
                MappingProfile: self.mapping_profiles,
                JournalLine: self.journal_lines,
                AccountingEvent: self.events,
                Risk: self.risks,
                VarianceObservation: self.variance_observations,
            }
            store = stores[type(obj)]
            store[obj.id] = obj
            if isinstance(obj, AccountingEvent):
                self.event_hash_index[(obj.company_id, obj.event_hash)] = obj.id
            self._persist(type(obj).__name__, obj)
            return obj

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

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            return {
                "companies": len(self.companies),
                "mappingProfiles": len(self.mapping_profiles),
                "journalLines": len(self.journal_lines),
                "events": len(self.events),
                "risks": len(self.risks),
                "varianceObservations": len(self.variance_observations),
                "auditEntries": len(self.audit_log),
            }


repository = InMemoryRepository()
