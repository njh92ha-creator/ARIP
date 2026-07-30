from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from typing import Callable

from fastapi import Header, HTTPException


class Role(StrEnum):
    ACCOUNTANT = "ACCOUNTANT"
    CLOSING_MANAGER = "CLOSING_MANAGER"
    ADMIN = "ADMIN"


@dataclass(frozen=True, slots=True)
class CurrentUser:
    user_id: str
    role: Role


def current_user(
    x_arip_user: str = Header("demo-accountant"),
    x_arip_role: str = Header("ACCOUNTANT"),
) -> CurrentUser:
    try:
        role = Role(x_arip_role.upper())
    except ValueError as exc:
        raise HTTPException(403, "invalid ARIP role") from exc
    return CurrentUser(user_id=x_arip_user, role=role)


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

