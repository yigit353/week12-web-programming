# ByteBooks API v2 - Startup & Testing Guide

## What's New in v2

- **External API integration** with Open Library (https://openlibrary.org)
- `GET /books/search-external?q=...` — Search Open Library for books
- `POST /books/import-external` — Import a book by ISBN from Open Library into the local database
- New file: `external_api.py` — Async HTTP client using httpx
- New schemas: `ExternalBookResult`, `ImportBookRequest`
- Async error handling: timeout (504), network failure (503), external API error (502)

## Prerequisites

- Python 3.10+

## Getting Started

```bash
# 1. Navigate to the v2 directory
cd v2

# 2. Create a virtual environment
python -m venv venv

# 3. Activate the virtual environment
source venv/bin/activate        # macOS / Linux
venv\Scripts\activate           # Windows

# 4. Install dependencies
pip install -r requirements.txt

# 5. Start the development server
uvicorn main:app --reload
```

The API will be available at:

| URL | Description |
|-----|-------------|
| http://127.0.0.1:8000 | API root (health check) |
| http://127.0.0.1:8000/docs | Swagger UI (interactive docs) |
| http://127.0.0.1:8000/redoc | ReDoc (alternative docs) |

On first startup the database (`bytebooks.db`) is created automatically and seeded with 4 authors and 6 books.

---

## Testing Scenarios via Swagger UI

Open http://127.0.0.1:8000/docs in your browser. Each endpoint has a **"Try it out"** button. Use the JSON bodies below to test each edge case.

### Existing Endpoints (from v1)

#### 1. Create a book with negative price (expect `422`)

**Endpoint:** `POST /books`

```json
{
  "title": "Bad Price Book",
  "author_id": 1,
  "price": -5.0,
  "stock": 0
}
```

#### 2. Create a book with negative stock (expect `422`)

**Endpoint:** `POST /books`

```json
{
  "title": "Bad Stock Book",
  "author_id": 1,
  "price": 10.0,
  "stock": -3
}
```

#### 3. Create a book with invalid ISBN format (expect `422`)

**Endpoint:** `POST /books`

```json
{
  "title": "Bad ISBN Book",
  "author_id": 1,
  "price": 10.0,
  "isbn": "abc-123"
}
```

#### 4. Create a book with non-existent author (expect `404`)

**Endpoint:** `POST /books`

```json
{
  "title": "Orphan Book",
  "author_id": 9999,
  "price": 10.0
}
```

#### 5. Create a book with duplicate ISBN (expect `409`)

**Endpoint:** `POST /books`

```json
{
  "title": "Duplicate ISBN Book",
  "author_id": 1,
  "price": 15.0,
  "isbn": "9780132350884"
}
```

#### 6. Update a book's ISBN to one already taken (expect `409`)

**Endpoint:** `PUT /books/2`

```json
{
  "isbn": "9780132350884"
}
```

#### 7. Delete an author who has books (expect `409`)

**Endpoint:** `DELETE /authors/1`

#### 8. Delete an author with no books (expect `204`)

**Step 1 -** `POST /authors`

```json
{
  "name": "Temporary Author"
}
```

**Step 2 -** `DELETE /authors/5`

#### 9. Partial update - only change price (expect `200`)

**Endpoint:** `PUT /books/1`

```json
{
  "price": 99.99
}
```

---

### New Endpoints (v2 - External API)

#### 10. Search Open Library for books (expect `200`)

**Endpoint:** `GET /books/search-external?q=python programming`

Returns up to 10 results from Open Library with `title`, `author`, `year`, and `isbn` fields.

#### 11. Search with empty query (expect `422`)

**Endpoint:** `GET /books/search-external?q=`

The `q` parameter requires `min_length=1`.

#### 12. Import a book by valid ISBN (expect `201`)

**Endpoint:** `POST /books/import-external`

```json
{
  "isbn": "0132350884",
  "author_name": "Robert C. Martin"
}
```

Creates the book in the local database with data from Open Library, default price (19.99) and stock (10).

#### 13. Import with invalid ISBN format (expect `422`)

**Endpoint:** `POST /books/import-external`

```json
{
  "isbn": "abc-123"
}
```

#### 14. Import with non-existent ISBN (expect `404`)

**Endpoint:** `POST /books/import-external`

```json
{
  "isbn": "0000000000"
}
```

Open Library returns 404 → our API returns 404: "Book with ISBN 0000000000 not found on Open Library".

#### 15. Import the same book twice (expect `409` on second attempt)

Run scenario 12 twice. The second request returns 409: "Book with ISBN 0132350884 already exists in database".

#### 16. Import without specifying author (expect `201`)

**Endpoint:** `POST /books/import-external`

```json
{
  "isbn": "0201633612"
}
```

The book is assigned to an "Unknown Author" record (created automatically if it doesn't exist).

---

## Testing with curl

```bash
# List all books
curl http://127.0.0.1:8000/books

# Get a single book
curl http://127.0.0.1:8000/books/1

# Create a book (valid)
curl -X POST http://127.0.0.1:8000/books \
  -H "Content-Type: application/json" \
  -d '{"title": "New Book", "author_id": 1, "price": 29.99}'

# Search Open Library
curl "http://127.0.0.1:8000/books/search-external?q=python%20programming"

# Import a book from Open Library
curl -X POST http://127.0.0.1:8000/books/import-external \
  -H "Content-Type: application/json" \
  -d '{"isbn": "0132350884", "author_name": "Robert C. Martin"}'

# Import without author (uses "Unknown Author")
curl -X POST http://127.0.0.1:8000/books/import-external \
  -H "Content-Type: application/json" \
  -d '{"isbn": "0201633612"}'

# Partial update (only price)
curl -X PUT http://127.0.0.1:8000/books/1 \
  -H "Content-Type: application/json" \
  -d '{"price": 99.99}'

# Delete a book
curl -X DELETE http://127.0.0.1:8000/books/1

# Delete author with books (should fail 409)
curl -X DELETE http://127.0.0.1:8000/authors/1
```

---

## Expected Status Code Summary

| Status | Meaning | When |
|--------|---------|------|
| `200` | OK | Successful GET or PUT |
| `201` | Created | Successful POST (create book, import book) |
| `204` | No Content | Successful DELETE |
| `404` | Not Found | Book/author ID doesn't exist, or ISBN not found on Open Library |
| `409` | Conflict | Duplicate ISBN (local or import) or deleting author with books |
| `422` | Unprocessable Entity | Validation failure (bad price, stock, ISBN format, empty query) |
| `502` | Bad Gateway | Open Library API returned an unexpected error |
| `503` | Service Unavailable | Cannot reach Open Library (network error) |
| `504` | Gateway Timeout | Open Library took longer than 5 seconds to respond |
