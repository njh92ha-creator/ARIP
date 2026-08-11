from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
import json
import os
from typing import Callable
from uuid import UUID

from fastapi import Header, HTTPException


class Role(StrEnum):
    VIEWER = "VIEWER"
    ACCOUNTANT = "ACCOUNTANT"
    CLOSING_MANAGER = "CLOSING_MANAGER"
    ADMIN = "ADMIN"


@dataclass(frozen=True, slots=True)
class CurrentUser:
    user_id: str
    role: Role
    company_id: UUID | None = None
    company_ids: frozenset[UUID] = frozenset()


def _authorized_company_scope(user_id: str) -> tuple[UUID | None, frozenset[UUID]]:
    raw_scopes = os.getenv("ARIP_USER_COMPANY_SCOPES", "{}")
    try:
        configured = json.loads(raw_scopes)
        if not isinstance(configured, dict):
            raise TypeError("company scopes must be an object")
        values = configured.get(user_id, [])
        if not isinstance(values, list):
            raise TypeError("a user company scope must be a list")
        ordered = tuple(dict.fromkeys(UUID(str(value)) for value in values))
        return (ordered[0] if ordered else None), frozenset(ordered)
    except (TypeError, ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(503, "ARIP user company scopes are misconfigured") from exc


def current_user(
    x_arip_user: str = Header("demo-accountant"),
    x_arip_role: str = Header("ACCOUNTANT"),
) -> CurrentUser:
    try:
        role = Role(x_arip_role.upper())
    except ValueError as exc:
        raise HTTPException(403, "invalid ARIP role") from exc
    return CurrentUser(user_id=x_arip_user, role=role)


def authenticated_review_user() -> CurrentUser:
    """Resolve review identity and tenant scope exclusively from server configuration.

    ``X-ARIP-*`` is demo header auth and is not a trustworthy tenant boundary. Review
    routes therefore use this server-owned principal until an OIDC/SSO adapter can
    supply an equivalently verified principal.
    """
    raw_principal = os.getenv("ARIP_AUTHENTICATED_PRINCIPAL")
    if not raw_principal:
        raise HTTPException(403, "authenticated review principal is not configured")
    try:
        configured = json.loads(raw_principal)
        if not isinstance(configured, dict):
            raise ValueError("principal must be an object")
        user_id = str(configured["user_id"]).strip()
        if not user_id:
            raise ValueError("principal user_id is required")
        role = Role(str(configured["role"]).upper())
    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(503, "ARIP authenticated principal is misconfigured") from exc
    company_id, company_ids = _authorized_company_scope(user_id)
    return CurrentUser(
        user_id=user_id,
        role=role,
        company_id=company_id,
        company_ids=company_ids,
    )


def require_roles(*roles: Role) -> Callable[..., CurrentUser]:
    def dependency(
        x_arip_user: str = Header("demo-admin"),
        x_arip_role: str = Header("ADMIN"),
    ) -> CurrentUser:
        user = current_user(x_arip_user, x_arip_role)
        if user.role not in roles:
            raise HTTPException(403, "insufficient role")
        return user

    return dependency


def require_review_roles(*roles: Role) -> Callable[[], CurrentUser]:
    def dependency() -> CurrentUser:
        user = authenticated_review_user()
        if user.role not in roles:
            raise HTTPException(403, "insufficient role")
        return user

    return dependency

