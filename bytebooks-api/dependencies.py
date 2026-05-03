"""
dependencies.py - FastAPI dependency functions for authentication
==================================================================

FastAPI's "dependencies" are ordinary callables that the framework runs
before your route handler. Whatever they return gets injected into the
route by name. This module defines one dependency, `get_current_user`,
that any protected route can declare as a parameter:

    @app.post("/books")
    def create_book(..., current_user: User = Depends(get_current_user)):
        ...

When the route runs, `current_user` will already be a validated `User`
instance or the request will already have been rejected with 401. Routes
stay focused on business logic; auth enforcement lives here.

How the lookup works
--------------------
1. `HTTPBearer` reads the `Authorization: Bearer <token>` header and
   hands us an `HTTPAuthorizationCredentials` object whose `.credentials`
   is the raw token string. It also makes Swagger UI render the
   Authorize button as a simple "paste your token" dialog — which is
   what we want, because our `POST /auth/login` takes a JSON body
   (`{"email", "password"}`), not the form-encoded
   `username`/`password` that OAuth2's password-flow dialog would POST.
2. We decode the token with `decode_access_token`. Any failure — bad
   signature, expired, malformed — raises `JWTError`, which we convert
   to 401.
3. The `sub` claim holds the user id (as a string, per the JWT spec).
   We load the matching User row; if it's been deleted since the token
   was issued, we also return 401.

All failure modes (no header, malformed token, expired token, deleted
user) surface the **same** error message. Never tell an attacker *why*
authentication failed — that's free reconnaissance.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlmodel import Session

from auth_utils import decode_access_token
from database import get_session
from models import User

# `auto_error=False` means FastAPI won't raise its own 403 when the
# Authorization header is missing — we handle that case below so every
# auth failure returns the same 401 + "Could not validate credentials".
bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    session: Session = Depends(get_session),
) -> User:
    """Resolve the Bearer token in the request into a `User` row.

    Raises 401 with `WWW-Authenticate: Bearer` (per RFC 6750) on any
    failure. The `WWW-Authenticate` header is what tells the browser
    and Swagger UI to offer a login prompt.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if credentials is None:
        raise credentials_exception
    token = credentials.credentials

    try:
        payload = decode_access_token(token)
        user_id_raw = payload.get("sub")
        if user_id_raw is None:
            raise credentials_exception
        user_id = int(user_id_raw)
    except (JWTError, ValueError):
        raise credentials_exception

    user = session.get(User, user_id)
    if user is None:
        raise credentials_exception
    return user
