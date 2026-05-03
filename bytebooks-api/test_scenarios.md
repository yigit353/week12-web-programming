# ByteBooks API - Edge Case Test Scenarios

This document lists edge cases that should be verified against the ByteBooks API
to ensure validation, conflict detection, and business rules are all working
correctly. Each scenario includes the endpoint to call, the expected HTTP status
code, and a short explanation of the underlying rule being enforced.

---

## Book Creation Edge Cases

### 1. Create a book with a negative price

**Endpoint:** `POST /books`

**Expected status:** `422 Unprocessable Entity`

The `BookCreate` schema declares `price: float = Field(gt=0)`. FastAPI rejects
the request before it reaches the service layer because a negative (or zero)
price violates the `gt=0` constraint.

---

### 2. Create a book with negative stock

**Endpoint:** `POST /books`

**Expected status:** `422 Unprocessable Entity`

The `BookCreate` schema declares `stock: int = Field(default=0, ge=0)`. A
negative integer fails the `ge=0` (greater-than-or-equal-to zero) constraint,
so FastAPI returns a validation error before any database operation occurs.

---

### 3. Create a book with an invalid ISBN format

**Endpoint:** `POST /books`

**Expected status:** `422 Unprocessable Entity`

The `BookCreate` schema validates ISBN with the regex `^(\d{10}|\d{13})$`.
Any string that is not exactly 10 or 13 digits (e.g. contains letters, has the
wrong length, or includes hyphens) fails the pattern check and is rejected by
FastAPI's request validation.

---

### 4. Create a book referencing a non-existent author

**Endpoint:** `POST /books`

**Expected status:** `404 Not Found`

`BookService.create_book` looks up the author by `author_id` before inserting
the book. If no matching author row exists in the database, it raises
`HTTPException(404)`.

---

### 5. Create a book with a duplicate ISBN

**Endpoint:** `POST /books`

**Expected status:** `409 Conflict`

`BookService.create_book` queries the database for an existing book with the
same ISBN before inserting. If one is found, it raises `HTTPException(409)`
to signal a resource conflict rather than a client input error.

---

## Book Update Edge Cases

### 6. Update a book's ISBN to one already used by another book

**Endpoint:** `PUT /books/{book_id}`

**Expected status:** `409 Conflict`

`BookService.update_book` checks whether the supplied ISBN is already taken by
a *different* book (excluding the current book's own record). If a conflict is
found, it raises `HTTPException(409)`.

---

## Author Deletion Edge Cases

### 7. Delete an author who still has books

**Endpoint:** `DELETE /authors/{author_id}`

**Expected status:** `409 Conflict`

`AuthorService.delete_author` queries for any books whose `author_id` matches
the target author before deleting. If books exist, it raises
`HTTPException(409)` to prevent orphaned book records. The error message
instructs the caller to delete the books first.

---

### 8. Delete an author who has no books

**Endpoint:** `DELETE /authors/{author_id}`

**Expected status:** `204 No Content`

When the author exists and has no associated books, `AuthorService.delete_author`
deletes the record and the route returns an empty `204 No Content` response,
confirming a clean deletion.

---

## Partial Update

### 9. Update only the price of an existing book (omit all other fields)

**Endpoint:** `PUT /books/{book_id}`

**Expected status:** `200 OK`

`BookUpdate` declares every field as `Optional` with `default=None`.
`BookService.update_book` calls `model_dump(exclude_unset=True)` so only the
fields explicitly provided in the request body are written to the database.
Sending `{"price": 29.99}` updates the price while leaving the title, ISBN,
stock, and any other fields unchanged.

---

## External API – Search (Session 2)

### 10. Search for books with query "python programming"

**Endpoint:** `GET /books/search-external?q=python programming`

**Expected status:** `200 OK`

The endpoint calls Open Library's search API and returns a list of
`ExternalBookResult` objects. The response should contain up to 10 results
with `title`, `author`, `year`, and `isbn` fields. Some fields may be `null`
if the external data is incomplete.

---

### 11. Search for books with empty query

**Endpoint:** `GET /books/search-external?q=`

**Expected status:** `422 Unprocessable Entity`

The `q` query parameter has `min_length=1` validation. An empty string
fails this constraint and FastAPI returns a validation error before the
external API is ever called.

---

## External API – Import (Session 2)

### 12. Import a book by valid ISBN

**Endpoint:** `POST /books/import-external`

```json
{
  "isbn": "0132350884",
  "author_name": "Robert C. Martin"
}
```

**Expected status:** `201 Created`

The endpoint fetches the book from Open Library by ISBN, creates or finds
the author in the local database, and creates a new `Book` record with
default price (19.99) and stock (10). The response is a full `BookResponse`.

---

### 13. Import a book with invalid ISBN format

**Endpoint:** `POST /books/import-external`

```json
{
  "isbn": "abc-123"
}
```

**Expected status:** `422 Unprocessable Entity`

The `ImportBookRequest` schema validates ISBN with the regex `^(\d{10}|\d{13})$`.
A string with letters or hyphens fails the pattern check.

---

### 14. Import a book with non-existent ISBN

**Endpoint:** `POST /books/import-external`

```json
{
  "isbn": "0000000000"
}
```

**Expected status:** `404 Not Found`

When Open Library returns a 404 for the ISBN lookup, `OpenLibraryService`
raises `HTTPException(404)` with the message "Book with ISBN 0000000000
not found on Open Library".

---

### 15. Import the same book twice (duplicate check)

**Endpoint:** `POST /books/import-external`

**Expected status:** `409 Conflict` (on second attempt)

After the first successful import, the ISBN exists in the local database.
The second import attempt detects the duplicate and raises
`HTTPException(409)` with the message "Book with ISBN ... already exists
in database".

---

### 16. Test timeout scenario

**Endpoint:** `GET /books/search-external?q=python` (or import endpoint)

**Expected status:** `504 Gateway Timeout`

If the Open Library API takes longer than 5 seconds to respond, `httpx`
raises a `TimeoutException`, which `OpenLibraryService` catches and
translates into `HTTPException(504)`. This scenario is difficult to
reproduce manually but can be verified by mocking a slow response in
unit tests.
