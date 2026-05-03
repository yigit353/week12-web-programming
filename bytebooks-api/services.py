"""
services.py - Service Layer for ByteBooks API
==============================================

This module contains the business logic layer of the application. Routes
in main.py act as thin wrappers that delegate all real work here.

Each service class groups related operations and exposes them as static
methods so callers never need to instantiate a service object.

Design principles:
  - All DB queries and validation live here, not in routes.
  - All error conditions raise HTTPException with appropriate status codes.
  - Methods receive an open Session and commit/refresh as needed.
"""

from typing import Optional

from fastapi import HTTPException
from sqlmodel import Session, select

from auth_utils import hash_password, verify_password
from models import Author, Book, User
from schemas import AuthorCreate, BookCreate, BookUpdate, UserCreate


# ---------------------------------------------------------------------------
# BookService
# ---------------------------------------------------------------------------
class BookService:
    """Service class that encapsulates all business logic for Book operations."""

    @staticmethod
    def create_book(book_data: BookCreate, db: Session) -> Book:
        """Create a new book record in the database.

        Validates that the referenced author exists and that no other book
        already uses the same ISBN before persisting the new record.

        Args:
            book_data: Validated creation payload from the request.
            db: Active database session.

        Returns:
            The newly created Book instance.

        Raises:
            HTTPException(404): If the author referenced by author_id does not exist.
            HTTPException(409): If a book with the provided ISBN already exists.
        """
        # Verify author exists
        author = db.get(Author, book_data.author_id)
        if author is None:
            raise HTTPException(
                status_code=404,
                detail=f"Author with id {book_data.author_id} not found",
            )

        # Check for duplicate ISBN
        if book_data.isbn is not None:
            existing = db.exec(
                select(Book).where(Book.isbn == book_data.isbn)
            ).first()
            if existing is not None:
                raise HTTPException(
                    status_code=409,
                    detail=f"Book with ISBN {book_data.isbn} already exists",
                )

        book = Book(
            title=book_data.title,
            author_id=book_data.author_id,
            isbn=book_data.isbn if book_data.isbn is not None else "",
            price=book_data.price,
            stock=book_data.stock,
            genre=book_data.genre,
        )
        db.add(book)
        db.commit()
        db.refresh(book)
        return book

    @staticmethod
    def update_book(book_id: int, book_data: BookUpdate, db: Session) -> Book:
        """Partially update an existing book record.

        Only fields present in the request payload are updated. Validates
        that the book exists, that any new ISBN is not already taken by
        another book, and that price/stock values are non-negative.

        Args:
            book_id: Primary key of the book to update.
            book_data: Partial update payload; only set fields are applied.
            db: Active database session.

        Returns:
            The updated Book instance.

        Raises:
            HTTPException(404): If no book with book_id exists.
            HTTPException(409): If the new ISBN is already used by another book.
            HTTPException(422): If price is negative or stock is negative.
        """
        book = db.get(Book, book_id)
        if book is None:
            raise HTTPException(
                status_code=404,
                detail=f"Book with id {book_id} not found",
            )

        update_data = book_data.model_dump(exclude_unset=True)

        # Validate price
        if "price" in update_data and update_data["price"] < 0:
            raise HTTPException(
                status_code=422,
                detail="Price must be positive",
            )

        # Validate stock
        if "stock" in update_data and update_data["stock"] < 0:
            raise HTTPException(
                status_code=422,
                detail="Stock cannot be negative",
            )

        # Check for duplicate ISBN (excluding the current book)
        if "isbn" in update_data and update_data["isbn"] is not None:
            isbn = update_data["isbn"]
            existing = db.exec(
                select(Book).where(Book.isbn == isbn, Book.id != book_id)
            ).first()
            if existing is not None:
                raise HTTPException(
                    status_code=409,
                    detail=f"Book with ISBN {isbn} already exists",
                )

        for field, value in update_data.items():
            setattr(book, field, value)

        db.add(book)
        db.commit()
        db.refresh(book)
        return book

    @staticmethod
    def delete_book(book_id: int, db: Session) -> None:
        """Delete a book record from the database.

        Args:
            book_id: Primary key of the book to delete.
            db: Active database session.

        Raises:
            HTTPException(404): If no book with book_id exists.
        """
        book = db.get(Book, book_id)
        if book is None:
            raise HTTPException(
                status_code=404,
                detail=f"Book with id {book_id} not found",
            )
        db.delete(book)
        db.commit()

    @staticmethod
    def get_book(book_id: int, db: Session) -> Book:
        """Retrieve a single book by its primary key.

        Args:
            book_id: Primary key of the book to fetch.
            db: Active database session.

        Returns:
            The matching Book instance.

        Raises:
            HTTPException(404): If no book with book_id exists.
        """
        book = db.get(Book, book_id)
        if book is None:
            raise HTTPException(
                status_code=404,
                detail=f"Book with id {book_id} not found",
            )
        return book

    @staticmethod
    def list_books(db: Session) -> list[Book]:
        """Return all books in the database.

        Args:
            db: Active database session.

        Returns:
            A list of all Book instances (may be empty).
        """
        return list(db.exec(select(Book)).all())


# ---------------------------------------------------------------------------
# AuthorService
# ---------------------------------------------------------------------------
class AuthorService:
    """Service class that encapsulates all business logic for Author operations."""

    @staticmethod
    def create_author(author_data: AuthorCreate, db: Session) -> Author:
        """Create a new author record in the database.

        Args:
            author_data: Validated creation payload from the request.
            db: Active database session.

        Returns:
            The newly created Author instance.
        """
        author = Author(
            name=author_data.name,
            bio=author_data.bio,
        )
        db.add(author)
        db.commit()
        db.refresh(author)
        return author

    @staticmethod
    def delete_author(author_id: int, db: Session) -> None:
        """Delete an author record from the database.

        The author must not have any books associated with them. If books
        exist, the caller should delete those books first.

        Args:
            author_id: Primary key of the author to delete.
            db: Active database session.

        Raises:
            HTTPException(404): If no author with author_id exists.
            HTTPException(409): If the author still has books in the database.
        """
        author = db.get(Author, author_id)
        if author is None:
            raise HTTPException(
                status_code=404,
                detail=f"Author with id {author_id} not found",
            )

        # Guard against orphaned books
        books = db.exec(select(Book).where(Book.author_id == author_id)).all()
        if books:
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Cannot delete author with id {author_id} because they have "
                    "books. Delete the books first."
                ),
            )

        db.delete(author)
        db.commit()

    @staticmethod
    def get_author(author_id: int, db: Session) -> Author:
        """Retrieve a single author by their primary key.

        Args:
            author_id: Primary key of the author to fetch.
            db: Active database session.

        Returns:
            The matching Author instance.

        Raises:
            HTTPException(404): If no author with author_id exists.
        """
        author = db.get(Author, author_id)
        if author is None:
            raise HTTPException(
                status_code=404,
                detail=f"Author with id {author_id} not found",
            )
        return author

    @staticmethod
    def list_authors(db: Session) -> list[Author]:
        """Return all authors in the database.

        Args:
            db: Active database session.

        Returns:
            A list of all Author instances (may be empty).
        """
        return list(db.exec(select(Author)).all())


# ---------------------------------------------------------------------------
# UserService (Session 1 – Authentication)
# ---------------------------------------------------------------------------
class UserService:
    """Business logic for user registration and authentication.

    Two design decisions worth flagging for the reader:

      * **Uniqueness is enforced at two layers.** The DB column has a
        UNIQUE constraint (see models.py) — that's the source of truth
        and the only thing that survives race conditions. We also check
        in Python so we can return a friendly 400 "Email already
        registered" instead of the raw DB integrity error. The DB is
        defense in depth for the uncommon case where two requests race.

      * **One error message for every login failure.** Whether the email
        is unknown or the password is wrong, we return the same
        401 "Invalid credentials". Distinguishing them leaks whether a
        given email has an account — a free lookup attackers use to
        build target lists for phishing or credential-stuffing. The
        single-message policy is cheap and closes that channel.
    """

    @staticmethod
    def create_user(user_data: UserCreate, db: Session) -> User:
        """Hash the password, persist a new User, reject duplicates.

        Raises:
            HTTPException(400): email or username already exists.
        """
        existing_email = db.exec(
            select(User).where(User.email == user_data.email)
        ).first()
        if existing_email is not None:
            raise HTTPException(
                status_code=400,
                detail="Email already registered",
            )

        existing_username = db.exec(
            select(User).where(User.username == user_data.username)
        ).first()
        if existing_username is not None:
            raise HTTPException(
                status_code=400,
                detail="Username already taken",
            )

        user = User(
            username=user_data.username,
            email=user_data.email,
            hashed_password=hash_password(user_data.password),
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def authenticate(email: str, password: str, db: Session) -> User:
        """Verify credentials and return the user, or raise 401.

        See class docstring: the error message is identical for "unknown
        email" and "wrong password" on purpose.
        """
        user = db.exec(select(User).where(User.email == email)).first()
        if user is None or not verify_password(password, user.hashed_password):
            raise HTTPException(
                status_code=401,
                detail="Invalid credentials",
            )
        return user

    @staticmethod
    def get_by_id(user_id: int, db: Session) -> Optional[User]:
        """Fetch a user by primary key, or None if absent."""
        return db.get(User, user_id)
