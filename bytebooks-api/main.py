"""
main.py - ByteBooks API (FastAPI Application Entry Point)
==========================================================

How to run this project
-----------------------
1. Create a virtual environment:
       python -m venv venv

2. Activate the virtual environment:
       source venv/bin/activate        # macOS / Linux
       venv\\Scripts\\activate           # Windows

3. Install dependencies:
       pip install -r requirements.txt

4. Start the development server:
       uvicorn main:app --reload

5. Open your browser:
       API root      → http://127.0.0.1:8000
       Interactive docs (Swagger UI) → http://127.0.0.1:8000/docs
       Alternative docs (ReDoc)      → http://127.0.0.1:8000/redoc

FastAPI automatically generates OpenAPI (Swagger) documentation from
your route definitions, type hints, and docstrings. The /docs page
lets you try every endpoint interactively — no Postman needed!

Testing all endpoints via Swagger UI
-------------------------------------
1. Access http://127.0.0.1:8000/docs
2. Test GET /books to list all books
3. Test POST /books to create a new book (provide JSON body)
4. Test GET /books/{id} to retrieve a specific book
5. Test PUT /books/{id} to update a book's fields
6. Test DELETE /books/{id} to remove a book
7. Repeat the same CRUD pattern for /authors endpoints
8. Test GET /books/search-external?q=... to search Open Library
9. Test POST /books/import-external to import a book by ISBN

Expected status codes:
  - 200 OK:          Successful GET, PUT
  - 201 Created:     Successful POST
  - 204 No Content:  Successful DELETE
  - 400 Bad Request: Duplicate ISBN, deleting author with books
  - 404 Not Found:   Book or author ID does not exist
  - 409 Conflict:    Duplicate ISBN when importing
  - 422 Unprocessable: Validation failure
  - 502 Bad Gateway:   External API returned an error
  - 503 Service Unavailable: External API unreachable
  - 504 Gateway Timeout:     External API timed out
"""

import os
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Path, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select

from auth_utils import create_access_token
from database import create_db_and_tables, get_session
from dependencies import get_current_user
from external_api import OpenLibraryService
from models import Author, Book, User
from schemas import (
    AuthorCreate,
    AuthorResponse,
    BookCreate,
    BookResponse,
    BookUpdate,
    ExternalBookResult,
    ImportBookRequest,
    Token,
    UserCreate,
    UserLogin,
    UserResponse,
)
from services import AuthorService, BookService, UserService


# ---------------------------------------------------------------------------
# Lifespan Event Handler – Create Tables & Seed Sample Data
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application startup and shutdown.

    Startup:
      1. Creates all database tables if they don't exist yet.
      2. Seeds initial sample data (authors and books) so the API
         is immediately useful for exploration and learning.
    """
    create_db_and_tables()
    _seed_data()
    yield


# ---------------------------------------------------------------------------
# FastAPI Application Instance
# ---------------------------------------------------------------------------
app = FastAPI(
    title="ByteBooks API",
    version="3.0.0",
    description=(
        "A bookstore REST API built with FastAPI and SQLModel, "
        "with Open Library external API integration."
    ),
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# CORS (Cross-Origin Resource Sharing) Middleware
# ---------------------------------------------------------------------------
# CORS is a browser security mechanism based on the Same-Origin Policy.
# Browsers block JavaScript from making requests to a different origin
# (domain, protocol, or port) than the page was served from.
#
# Our React frontend runs on http://localhost:5173 (Vite dev server)
# but our API runs on http://localhost:8000. Without CORS middleware,
# the browser would block all fetch() requests from the frontend to
# the API. This middleware tells the browser "it's OK, I trust this origin."
# In production the deployed frontend lives on a different origin (Vercel),
# so we read its URL from FRONTEND_URL and add it to the allow-list. Local
# Vite dev servers stay in the list so the same backend can serve both
# environments without a config change.
FRONTEND_URL = os.getenv("FRONTEND_URL")
allowed_origins = [
    "http://localhost:5173",
    "http://localhost:5174",
]
if FRONTEND_URL:
    allowed_origins.append(FRONTEND_URL)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _seed_data() -> None:
    """Insert sample authors and books if the database is empty.

    The function first checks whether any authors already exist.
    If the table is not empty we skip seeding to avoid duplicate-key
    errors on subsequent restarts.
    """
    from database import engine

    with Session(engine) as session:
        # Check if data already exists
        existing_authors = session.exec(select(Author)).first()
        if existing_authors is not None:
            return  # Database already seeded – nothing to do

        # ---- Authors ----
        author_martin = Author(
            name="Robert C. Martin",
            bio="Software craftsman and author of Clean Code",
        )
        author_fowler = Author(
            name="Martin Fowler",
            bio="Chief Scientist at ThoughtWorks, refactoring expert",
        )
        author_evans = Author(
            name="Eric Evans",
            bio="Domain-Driven Design pioneer",
        )
        author_beck = Author(
            name="Kent Beck",
            bio="Creator of Extreme Programming and Test-Driven Development",
        )

        session.add_all([author_martin, author_fowler, author_evans, author_beck])
        session.commit()

        # Refresh to get auto-generated IDs
        for author in [author_martin, author_fowler, author_evans, author_beck]:
            session.refresh(author)

        # ---- Books ----
        books = [
            Book(
                title="Clean Code",
                price=44.95,
                isbn="9780132350884",
                stock=15,
                genre="technical",
                author_id=author_martin.id,
            ),
            Book(
                title="The Clean Coder",
                price=39.99,
                isbn="9780137081073",
                stock=12,
                genre="technical",
                author_id=author_martin.id,
            ),
            Book(
                title="Refactoring",
                price=54.99,
                isbn="9780201485672",
                stock=8,
                genre="technical",
                author_id=author_fowler.id,
            ),
            Book(
                title="Domain-Driven Design",
                price=59.99,
                isbn="9780321125217",
                stock=5,
                genre="technical",
                author_id=author_evans.id,
            ),
            Book(
                title="Test-Driven Development",
                price=49.95,
                isbn="9780321146533",
                stock=10,
                genre="technical",
                author_id=author_beck.id,
            ),
            Book(
                title="Implementation Patterns",
                price=44.99,
                isbn="9780321413093",
                stock=7,
                genre="technical",
                author_id=author_beck.id,
            ),
        ]

        session.add_all(books)
        session.commit()


# ---------------------------------------------------------------------------
# API Endpoints
# ---------------------------------------------------------------------------


@app.get("/")
def root() -> dict:
    """Root endpoint – returns a welcome message and a link to the docs.

    This is a good health-check endpoint: if it responds, the server is up.
    """
    return {"message": "Welcome to ByteBooks API", "docs": "/docs"}


@app.post("/reset-db", tags=["Testing"])
def reset_database() -> dict:
    """Reset the database to its initial seeded state.

    Drops all rows from the book and author tables and re-seeds the sample
    data. Intended for use by automated test suites that need a clean
    starting state before each run.
    """
    from database import engine

    with Session(engine) as session:
        session.exec(select(Book)).all()  # load for cascade awareness
        # Delete all books first (FK constraint), then authors
        for book in session.exec(select(Book)).all():
            session.delete(book)
        for author in session.exec(select(Author)).all():
            session.delete(author)
        session.commit()

    _seed_data()
    return {"message": "Database reset to initial seed state"}


# ===========================================================================
# Book Endpoints
# ===========================================================================


@app.get("/books", response_model=list[BookResponse], tags=["Books"])
def list_books(session: Session = Depends(get_session)) -> list[Book]:
    """Return all books in the database."""
    books = BookService.list_books(session)
    for book in books:
        _ = book.author
    return books


@app.get("/books/search-external", response_model=list[ExternalBookResult], tags=["Books - External"])
async def search_external_books(
    q: str = Query(..., min_length=1, description="Search query for Open Library"),
):
    """Search Open Library for books matching a query string.

    This endpoint calls the Open Library Search API and returns a simplified
    list of results. It does NOT save anything to the local database.

    Error handling:
      - We catch HTTPExceptions raised by OpenLibraryService and let them
        propagate directly (these already have the correct status codes:
        504 for timeout, 503 for network failure, 502 for external API errors).
      - Any unexpected error is caught and returned as a generic 500 response
        so we never expose raw stack traces to the client.
    """
    try:
        results = await OpenLibraryService.search_books(q)
        return results
    except HTTPException:
        # Let HTTP exceptions from the service layer propagate unchanged
        raise
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred while searching external books",
        )


@app.post("/books/import-external", response_model=BookResponse, status_code=201, tags=["Books - External"])
async def import_external_book(
    import_data: ImportBookRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Import a book from Open Library into the local database by ISBN.

    Workflow:
      1. Fetch book details from Open Library using the provided ISBN.
      2. Check if a book with this ISBN already exists locally (→ 409 if so).
      3. Create or find the author record in the local database.
      4. Create a new Book record with data from Open Library.

    Error handling:
      - External API errors (404, 502, 503, 504) propagate as HTTPExceptions
        from OpenLibraryService.
      - Duplicate ISBN in local DB → 409 Conflict.
      - Database errors → 500 Internal Server Error.
      - Validation errors are handled by FastAPI automatically → 422.
    """
    try:
        # Step 1: Fetch book details from Open Library
        external_book = await OpenLibraryService.get_book_by_isbn(import_data.isbn)

        # Step 2: Check if book with this ISBN already exists locally
        existing = session.exec(
            select(Book).where(Book.isbn == import_data.isbn)
        ).first()
        if existing is not None:
            raise HTTPException(
                status_code=409,
                detail=f"Book with ISBN {import_data.isbn} already exists in database",
            )

        # Step 3: Create or find the author
        if import_data.author_name:
            # Look for an existing author with this name
            author = session.exec(
                select(Author).where(Author.name == import_data.author_name)
            ).first()
            if author is None:
                # Create new author
                author = Author(name=import_data.author_name)
                session.add(author)
                session.commit()
                session.refresh(author)
        else:
            # Use "Unknown Author" as default
            author = session.exec(
                select(Author).where(Author.name == "Unknown Author")
            ).first()
            if author is None:
                author = Author(name="Unknown Author", bio="Placeholder for imported books")
                session.add(author)
                session.commit()
                session.refresh(author)

        # Step 4: Create the book record using external data + defaults
        book = Book(
            title=external_book["title"],
            author_id=author.id,
            isbn=import_data.isbn,
            price=19.99,   # Default price – Open Library doesn't provide pricing
            stock=10,      # Default stock level
            genre="",      # Not available from Open Library
        )
        session.add(book)
        session.commit()
        session.refresh(book)

        # Eagerly load the author relationship for the response
        _ = book.author

        return book

    except HTTPException:
        # Let HTTP exceptions propagate (external API errors + our 409)
        raise
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred while importing the book",
        )


@app.get("/books/{book_id}", response_model=BookResponse, tags=["Books"])
def get_book(
    book_id: int = Path(..., description="The ID of the book"),
    session: Session = Depends(get_session),
) -> Book:
    """Return a single book by ID with author relationship data."""
    book = BookService.get_book(book_id, session)
    _ = book.author
    return book


@app.post("/books", response_model=BookResponse, status_code=201, tags=["Books"])
def create_book(
    book_data: BookCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Book:
    """Create a new book in the database. Requires authentication."""
    book = BookService.create_book(book_data, session)
    _ = book.author
    return book


@app.put("/books/{book_id}", response_model=BookResponse, tags=["Books"])
def update_book(
    book_data: BookUpdate,
    book_id: int = Path(..., description="The ID of the book"),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Book:
    """Update an existing book's fields. Requires authentication."""
    book = BookService.update_book(book_id, book_data, session)
    _ = book.author
    return book


@app.delete("/books/{book_id}", status_code=204, tags=["Books"])
def delete_book(
    book_id: int = Path(..., description="The ID of the book"),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Response:
    """Delete a book from the database. Requires authentication."""
    BookService.delete_book(book_id, session)
    return Response(status_code=204)


# ===========================================================================
# Author Endpoints
# ===========================================================================


@app.get("/authors", response_model=list[AuthorResponse], tags=["Authors"])
def list_authors(session: Session = Depends(get_session)) -> list[Author]:
    """Return every author in the database."""
    authors = AuthorService.list_authors(session)
    for author in authors:
        _ = author.books
    return authors


@app.get("/authors/{author_id}", response_model=AuthorResponse, tags=["Authors"])
def get_author(
    author_id: int = Path(..., description="The ID of the author"),
    session: Session = Depends(get_session),
) -> Author:
    """Return a single author by ID."""
    author = AuthorService.get_author(author_id, session)
    _ = author.books
    return author


@app.post("/authors", response_model=AuthorResponse, status_code=201, tags=["Authors"])
def create_author(
    author_data: AuthorCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Author:
    """Create a new author in the database. Requires authentication."""
    author = AuthorService.create_author(author_data, session)
    _ = author.books
    return author


@app.delete("/authors/{author_id}", status_code=204, tags=["Authors"])
def delete_author(
    author_id: int = Path(..., description="The ID of the author"),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Response:
    """Delete an author from the database. Requires authentication."""
    AuthorService.delete_author(author_id, session)
    return Response(status_code=204)


# ===========================================================================
# Auth Endpoints (Session 1 – JWT Authentication)
# ===========================================================================


@app.post(
    "/auth/register",
    response_model=UserResponse,
    status_code=201,
    tags=["Auth"],
)
def register_user(
    payload: UserCreate,
    session: Session = Depends(get_session),
) -> User:
    """Create a new account.

    Password flow: UserService hashes the plaintext password with bcrypt
    before persisting. The plaintext never touches the database.
    """
    return UserService.create_user(payload, session)


@app.post("/auth/login", response_model=Token, tags=["Auth"])
def login_user(
    payload: UserLogin,
    session: Session = Depends(get_session),
) -> dict:
    """Exchange email + password for a signed JWT access token.

    On success the response is `{"access_token": "<jwt>", "token_type":
    "bearer"}`. The client should store the token and send it on every
    subsequent request in the `Authorization: Bearer <jwt>` header.
    """
    user = UserService.authenticate(payload.email, payload.password, session)
    # The JWT spec says `sub` (subject) SHOULD be a string. We stringify
    # the numeric id here and parse it back on the other end.
    token = create_access_token({"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer"}


@app.get("/auth/me", response_model=UserResponse, tags=["Auth"])
def get_me(current_user: User = Depends(get_current_user)) -> User:
    """Return the currently-authenticated user.

    Useful both as a "who am I?" probe for clients after a page refresh
    and as the canonical example of how to protect a route: depend on
    `get_current_user` and the token handling is done for you.
    """
    return current_user
