"""
schemas.py - Pydantic Request/Response Schemas
===============================================

These are *separate* Pydantic schemas used exclusively for API request
validation and response serialization. They are distinct from the SQLModel
database models defined in models.py.

Why separate schemas instead of reusing the SQLModel models directly?

  - SQLModel table models expose internal fields (e.g. foreign keys,
    database constraints) that should not be part of the public API surface.
  - Separate schemas let us shape exactly what the client sends (request)
    and exactly what the API returns (response) without coupling to the
    database layer.
  - Response schemas can embed nested objects (e.g. BookResponse includes
    a full AuthorResponse) whereas the DB model only stores author_id.
  - Validation rules (min_length, gt, pattern) belong to the API contract,
    not to the database schema.

Usage:
  - *Create schemas  – validate incoming POST request bodies.
  - *Update schemas  – validate incoming PUT/PATCH request bodies (all
                       fields optional for partial updates).
  - *Response schemas – serialise ORM objects into JSON responses.
                        model_config = ConfigDict(from_attributes=True)
                        enables construction from SQLModel/ORM instances.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field


# ---------------------------------------------------------------------------
# Author Schemas  (defined first – BookResponse embeds AuthorResponse)
# ---------------------------------------------------------------------------

class AuthorCreate(BaseModel):
    """Payload for creating a new author."""

    name: str = Field(min_length=1, max_length=100)
    bio: Optional[str] = Field(default=None, max_length=1000)


class AuthorResponse(BaseModel):
    """Author representation returned by the API."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    bio: Optional[str]
    created_at: datetime


# ---------------------------------------------------------------------------
# Book Schemas
# ---------------------------------------------------------------------------

class BookCreate(BaseModel):
    """Payload for creating a new book."""

    title: str = Field(min_length=1, max_length=200)
    author_id: int
    isbn: Optional[str] = Field(default=None, pattern=r"^(\d{10}|\d{13})$")
    price: float = Field(gt=0)
    stock: int = Field(default=0, ge=0)
    genre: str = Field(default="", max_length=50)


class BookUpdate(BaseModel):
    """Payload for partially updating an existing book (all fields optional)."""

    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    isbn: Optional[str] = Field(default=None, pattern=r"^(\d{10}|\d{13})$")
    price: Optional[float] = Field(default=None, gt=0)
    stock: Optional[int] = Field(default=None, ge=0)
    genre: Optional[str] = Field(default=None, max_length=50)


class BookResponse(BaseModel):
    """Book representation returned by the API, including nested author data."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    author_id: int
    isbn: Optional[str]
    price: float
    stock: int
    genre: str
    created_at: datetime
    author: AuthorResponse


# ---------------------------------------------------------------------------
# External API Schemas (Session 2 – Open Library Integration)
# ---------------------------------------------------------------------------

class ExternalBookResult(BaseModel):
    """Represents a book result from the Open Library external search API.

    This schema is used to return a simplified, standardized view of
    book data fetched from Open Library's search endpoint. Fields are
    optional because external data may be incomplete or missing.
    """

    title: str
    author: Optional[str] = None
    year: Optional[int] = None
    isbn: Optional[str] = None


class ImportBookRequest(BaseModel):
    """Request payload for importing a book from Open Library by ISBN.

    The ISBN must be exactly 10 or 13 digits. An optional author_name
    can be provided; if omitted, the book will be assigned to an
    "Unknown Author" record in the database.
    """

    isbn: str = Field(pattern=r"^(\d{10}|\d{13})$")
    author_name: Optional[str] = Field(None, max_length=100)


# ---------------------------------------------------------------------------
# Auth Schemas (Session 1 – JWT Authentication)
# ---------------------------------------------------------------------------

class UserCreate(BaseModel):
    """Registration payload. Sent to POST /auth/register.

    Validation rules enforced at the edge of the system (before any DB
    call) so bad input never reaches the service layer:
      * `username` must be 3–50 characters — short enough for a display
        name, long enough to avoid trivial collisions.
      * `email` is validated with Pydantic's `EmailStr` (format only —
        we don't send a confirmation email in this exercise).
      * `password` must be at least 8 characters. This is a *minimum*;
        strong passwords are longer. bcrypt doesn't care about length.
    """

    username: str = Field(min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(min_length=8)


class UserLogin(BaseModel):
    """Login payload. Sent to POST /auth/login."""

    email: EmailStr
    password: str


class Token(BaseModel):
    """JWT response payload returned by POST /auth/login.

    `token_type` is fixed to "bearer" per RFC 6750: clients MUST send
    subsequent requests with `Authorization: Bearer <access_token>`.
    """

    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    """Public user representation. Note there is no `hashed_password` —
    the hash must never leave the server."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    email: str
    created_at: datetime
