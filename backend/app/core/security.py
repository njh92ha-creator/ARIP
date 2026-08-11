from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from typing import Callable
from uuid import UUID

from fastapi import Header, HTTPException


class Role(StrEnum):
    ACCOUNTANT = "ACCOUNTANT"
    CLOSING_MANAGER = "CLOSING_MANAGER"
    ADMIN = "ADMIN"


@dataclass(frozen=True, slots=True)
class CurrentUser:
    user_id: str
    role: Role
    company_id: UUID | None = None


def current_user(
    x_arip_user: str = Header("demo-accountant"),
    x_arip_role: str = Header("ACCOUNTANT"),
    x_arip_company_id: str | None = Header(None),
) -> CurrentUser:
    try:
        role = Role(x_arip_role.upper())
    except ValueError as exc:
        raise HTTPException(403, "invalid ARIP role") from exc
    try:
        company_id = UUID(x_arip_company_id) if x_arip_company_id else None
    except ValueError as exc:
        raise HTTPException(403, "invalid ARIP company scope") from exc
    return CurrentUser(user_id=x_arip_user, role=role, company_id=company_id)


def require_roles(*roles: Role) -> Callable[..., CurrentUser]:
    def dependency(
        x_arip_user: str = Header("demo-admin"),
        x_arip_role: str = Header("ADMIN"),
        x_arip_company_id: str | None = Header(None),
    ) -> CurrentUser:
        user = current_user(x_arip_user, x_arip_role, x_arip_company_id)
        if user.role not in roles:
            raise HTTPException(403, "insufficient role")
        return user

    return dependency

