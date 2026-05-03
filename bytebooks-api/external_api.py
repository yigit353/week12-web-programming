"""
external_api.py - External API Integration (Open Library)
==========================================================

This module provides an async service layer for communicating with the
Open Library API (https://openlibrary.org). It is used by the ByteBooks
API to search for books and fetch book details by ISBN from a public
external data source.

Why async?
  httpx.AsyncClient() is async-compatible with FastAPI. This prevents
  blocking the server while waiting for external API responses. When
  FastAPI receives a request that calls an external API, the event loop
  can continue handling other requests instead of waiting idle.

Error Handling Strategy:
  External API calls can fail in several ways. We translate each failure
  into an appropriate HTTP status code so the client understands what
  went wrong:

    - Timeout (external API too slow)     → 504 Gateway Timeout
    - Network error (can't reach API)     → 503 Service Unavailable
    - External API returns non-200        → 502 Bad Gateway
    - External API returns 404            → 404 Not Found
"""

import httpx
from fastapi import HTTPException


class OpenLibraryService:
    """Service class for interacting with the Open Library public API.

    All methods are async and use httpx.AsyncClient for non-blocking
    HTTP requests. Each method sets a 5-second timeout to prevent
    the server from hanging if the external API is slow or unresponsive.
    """

    @staticmethod
    async def search_books(query: str) -> list[dict]:
        """Search Open Library for books matching a query string.

        Calls the Open Library search endpoint and returns a simplified
        list of book results.

        External API endpoint:
            GET https://openlibrary.org/search.json?q={query}&limit=10

        Args:
            query: The search term (e.g. "python programming").

        Returns:
            A list of dictionaries, each containing:
              - title (str): Book title
              - author (str | None): Author name(s), comma-separated
              - year (int | None): First publication year
              - isbn (str | None): First available ISBN

        Raises:
            HTTPException(504): If the external API request times out.
            HTTPException(503): If the external API is unreachable (network error).
            HTTPException(502): If the external API returns a non-200 status.
        """
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(
                    "https://openlibrary.org/search.json",
                    params={"q": query, "limit": 10},
                )
        except httpx.TimeoutException:
            raise HTTPException(
                status_code=504,
                detail="External API request timed out",
            )
        except httpx.RequestError:
            raise HTTPException(
                status_code=503,
                detail="External API unavailable",
            )

        if response.status_code != 200:
            raise HTTPException(
                status_code=502,
                detail="External API returned an error",
            )

        # Parse the JSON response; return empty list if malformed
        try:
            data = response.json()
        except Exception:
            return []

        docs = data.get("docs", [])
        if not isinstance(docs, list):
            return []

        results = []
        for doc in docs:
            # Extract author names – may be a list of strings
            author_names = doc.get("author_name", [])
            author = ", ".join(author_names) if author_names else None

            # Extract first available ISBN from the isbn array
            isbn_list = doc.get("isbn", [])
            isbn = isbn_list[0] if isbn_list else None

            results.append(
                {
                    "title": doc.get("title", "Unknown Title"),
                    "author": author,
                    "year": doc.get("first_publish_year"),
                    "isbn": isbn,
                }
            )

        return results

    @staticmethod
    async def get_book_by_isbn(isbn: str) -> dict:
        """Fetch detailed book information from Open Library by ISBN.

        Calls the Open Library ISBN endpoint and returns a simplified
        book dictionary.

        External API endpoint:
            GET https://openlibrary.org/isbn/{isbn}.json

        Args:
            isbn: A 10- or 13-digit ISBN string.

        Returns:
            A dictionary containing:
              - title (str): Book title
              - author (str | None): Author name (placeholder if unavailable)
              - year (str | None): Publication date string
              - isbn (str): The ISBN that was looked up

        Raises:
            HTTPException(504): If the external API request times out.
            HTTPException(404): If no book with the given ISBN exists on Open Library.
            HTTPException(502): If the external API returns a non-200/non-404 status.
        """
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(
                    f"https://openlibrary.org/isbn/{isbn}.json",
                )
        except httpx.TimeoutException:
            raise HTTPException(
                status_code=504,
                detail="External API request timed out",
            )
        except httpx.RequestError:
            raise HTTPException(
                status_code=503,
                detail="External API unavailable",
            )

        # 404 from Open Library means the ISBN doesn't exist in their database
        if response.status_code == 404:
            raise HTTPException(
                status_code=404,
                detail=f"Book with ISBN {isbn} not found on Open Library",
            )

        if response.status_code != 200:
            raise HTTPException(
                status_code=502,
                detail="External API returned an error",
            )

        data = response.json()

        # Extract title, handling missing field gracefully
        title = data.get("title", "Unknown")

        # Open Library stores authors as references (e.g. {"key": "/authors/OL123A"}).
        # Fetching author names would require additional API calls, so we use a
        # placeholder here. The caller can supply the author name separately.
        author = None

        # Extract publication date
        year = data.get("publish_date", None)

        return {
            "title": title,
            "author": author,
            "year": year,
            "isbn": isbn,
        }
