"""
models.py - SQLModel Database Models
======================================

SQLModel is a library created by the same author as FastAPI (Sebastián
Ramírez). It combines two powerful libraries into one:

  1. SQLAlchemy  – the most popular Python ORM (Object-Relational Mapper)
  2. Pydantic    – the most popular Python data-validation library

This means a single SQLModel class serves as:
  - A database table definition  (like SQLAlchemy models)
  - A request/response schema    (like Pydantic models)
  - A data validator             (type checking, constraints)

Why use SQLModel?
  - Write your model ONCE and use it everywhere (DRY principle)
  - Full type-hint support for editor auto-completion
  - Automatic JSON serialization for API responses
  - Built-in validation (max_length, ge, unique, etc.)
"""

from datetime import datetime
from typing import List, Optional

from sqlmodel import Field, Relationship, SQLModel


# ---------------------------------------------------------------------------
# Author Model
# ---------------------------------------------------------------------------
class Author(SQLModel, table=True):
    """Represents a book author in the database.

    Attributes:
        id:         Auto-generated primary key.
        name:       Author's full name (indexed for fast lookups).
        bio:        Short biography (optional).
        created_at: Timestamp when the record was created.
        books:      One-to-many relationship – one author can have many books.

    Relationships:
        Author.books  ←→  Book.author
        This is a *bidirectional* relationship. When you load an Author,
        you can access author.books to get all their Book objects, and
        when you load a Book, you can access book.author to get the
        Author object. SQLModel/SQLAlchemy handles the JOIN automatically.
    """

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True, max_length=100)
    bio: Optional[str] = Field(default=None, max_length=500)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationship: one author → many books
    books: List["Book"] = Relationship(back_populates="author")


# ---------------------------------------------------------------------------
# Book Model
# ---------------------------------------------------------------------------
class Book(SQLModel, table=True):
    """Represents a book in the bookstore inventory.

    Attributes:
        id:         Auto-generated primary key.
        title:      Book title (indexed for fast lookups).
        price:      Retail price in USD (must be >= 0).
        isbn:       International Standard Book Number (unique, 13 chars).
        stock:      Number of copies available (must be >= 0).
        genre:      Book genre (fiction, non-fiction, sci-fi, mystery,
                    romance, technical).
        author_id:  Foreign key linking to the Author table.
        author:     Many-to-one relationship back to the Author model.
        created_at: Timestamp when the record was created.

    Relationships:
        Book.author  ←→  Author.books
        The foreign key `author_id` stores the Author's primary key.
        The `author` field is a convenience accessor that SQLModel resolves
        into a full Author object via a JOIN query.
    """

    id: Optional[int] = Field(default=None, primary_key=True)
    title: str = Field(index=True, max_length=200)
    price: float = Field(ge=0)
    isbn: str = Field(unique=True, max_length=13)
    stock: int = Field(default=0, ge=0)
    genre: str = Field(max_length=50)
    author_id: int = Field(foreign_key="author.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationship: many books → one author
    author: Author = Relationship(back_populates="books")


# ---------------------------------------------------------------------------
# User Model (Session 1 – Authentication)
# ---------------------------------------------------------------------------
class User(SQLModel, table=True):
    """Represents an application user for login / JWT auth.

    Attributes:
        id:              Auto-generated primary key.
        username:        Display name. Unique + indexed so login-by-username
                         (and uniqueness checks at signup) are O(log n).
        email:           Login identifier. Unique + indexed for the same
                         reasons. Stored lower-case by convention but not
                         enforced at the model layer.
        hashed_password: The bcrypt hash of the user's password. We NEVER
                         store the plaintext — if the DB leaks, hashes
                         don't reveal passwords to anyone but a brute
                         forcer willing to spend a long time per guess.
        created_at:      Timestamp when the account was created.

    Why a separate table instead of reusing Author?
      Users and authors are different domain concepts. An author is a
      person books are attributed to; a user is an authenticated API
      caller. Conflating them would make it impossible to distinguish
      "this user is logged in" from "this person wrote a book we sell".
    """

    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(unique=True, index=True, max_length=50)
    email: str = Field(unique=True, index=True, max_length=100)
    hashed_password: str = Field(max_length=255)
    created_at: datetime = Field(default_factory=datetime.utcnow)
