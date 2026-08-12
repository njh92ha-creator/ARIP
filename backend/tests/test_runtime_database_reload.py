from uuid import uuid4

from app.domain.models import CompanySettings
from app.domain.repository import InMemoryRepository


def test_database_reload_replaces_stale_in_memory_state(monkeypatch) -> None:
    repository = InMemoryRepository(persistent=False)
    replacement = CompanySettings("C002", "DB company", "Manufacturing", id=uuid4())
    calls = []

    monkeypatch.setattr(repository, "_initialize_database", lambda: setattr(repository, "_db_ready", True))
    monkeypatch.setattr(repository, "_restore", lambda: (calls.append(True), repository.companies.__setitem__(replacement.id, replacement)))
    repository.companies[uuid4()] = CompanySettings("OLD", "old", "Manufacturing")
    repository.risks[uuid4()] = object()

    repository.reload_from_database()

    assert calls == [True]
    assert list(repository.companies) == [replacement.id]
    assert repository.risks == {}
