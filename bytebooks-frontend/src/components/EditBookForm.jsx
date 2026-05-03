// useState manages controlled form input values and component-level UI state.
// useEffect runs the author-fetch side effect once after the first render,
// giving us the authors list for the dropdown without blocking the initial paint.
import { useState, useEffect } from 'react';

import { authFetch } from '../utils/api';
import './EditBookForm.css';

// Genre options shared with AddBookForm so the dropdown is always consistent.
const GENRES = ['Fiction', 'Non-Fiction', 'Sci-Fi', 'Mystery', 'Romance', 'Biography', 'Technical'];

/**
 * EditBookForm — form for updating an existing book's details.
 *
 * ── Pre-population ────────────────────────────────────────────────────────────
 * The form initialises its state directly from the `book` prop. Because the
 * prop is stable (the parent passes the same object for the lifetime of this
 * form), reading it once in the useState initialiser is sufficient. If the
 * parent ever replaces the book object with a different one, the key prop
 * technique (setting key={book.id} on this component in the parent) would
 * cause React to unmount and remount the component, reinitialising state from
 * the new book automatically.
 *
 * ── Update flow ───────────────────────────────────────────────────────────────
 * 1. User edits fields — each onChange syncs to formData via setFormData.
 * 2. User clicks "Update Book" — handleSubmit calls preventDefault, validates,
 *    then sends a PUT request to /books/{id} with the four mutable fields.
 *    Note: author_id is intentionally excluded — the backend schema does not
 *    accept it in updates.
 * 3. On success the parent's onBookUpdated callback is called so the book list
 *    refreshes to reflect the changes.
 * 4. On error the response body's detail field is surfaced via alert so the
 *    user knows what went wrong without losing their edits.
 *
 * @param {Object}   props.book           - The existing book object to edit
 * @param {Function} props.onBookUpdated  - Called after a successful PUT
 * @param {Function} props.onCancel       - Called when the user cancels
 */
function EditBookForm({ book, onBookUpdated, onCancel }) {
  // ── Author dropdown state ──────────────────────────────────────────────────
  const [authors, setAuthors] = useState([]);
  const [authorsLoading, setAuthorsLoading] = useState(true);

  // ── Form submission state ──────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);

  // ── Controlled form fields ─────────────────────────────────────────────────
  // Pre-populate all fields from the book prop so the user sees the current
  // values and can make targeted edits rather than filling everything from scratch.
  const [formData, setFormData] = useState({
    title: book.title,
    // author_id is stored as a string because select values are always strings;
    // it is converted back to a number only when needed for display logic.
    author_id: String(book.author_id),
    price: book.price,
    isbn: book.isbn,
    genre: book.genre || '',
    stock: book.stock,
  });

  // ── Fetch authors on mount ─────────────────────────────────────────────────
  // The empty dependency array [] tells React to run this effect only once,
  // immediately after the component first renders.
  useEffect(() => {
    const fetchAuthors = async () => {
      try {
        const response = await authFetch('/authors');
        const data = await response.json();
        setAuthors(data);
      } catch (err) {
        console.error('Error fetching authors:', err);
      } finally {
        setAuthorsLoading(false);
      }
    };

    fetchAuthors();
  }, []);

  // ── Generic change handler ─────────────────────────────────────────────────
  // All inputs share this handler. The computed property name [e.target.name]
  // maps each input's name attribute to the matching key in formData, so we
  // need only one function instead of a separate setter per field.
  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  // ── Form submission / update flow ──────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Basic validation — required fields must be non-empty.
    if (!formData.title.trim() || !formData.isbn.trim() || !formData.price) {
      alert('Please fill in all required fields.');
      return;
    }

    setSubmitting(true);

    try {
      // author_id is NOT included in the request body — the backend update
      // schema does not accept it. Only the four mutable fields are sent.
      const body = {
        title: formData.title.trim(),
        price: Number(formData.price),
        isbn: formData.isbn.trim(),
        genre: formData.genre,
        stock: Number(formData.stock),
      };

      // authFetch attaches the JWT. The backend only allows PUT to
      // logged-in users; without auth this returns 401 and we redirect.
      const response = await authFetch(`/books/${book.id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        // Parse the FastAPI error response and surface the detail message.
        const error = await response.json();
        alert(error.detail || 'Failed to update book.');
        return;
      }

      alert('Book updated successfully!');
      // Notify the parent so it can refresh the book list.
      onBookUpdated();
    } catch (err) {
      console.error('Error updating book:', err);
      alert('An unexpected error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="edit-book-form-container">
      <h2 className="edit-book-form-title">Edit Book</h2>

      <form className="edit-book-form" onSubmit={handleSubmit}>
        {/* ── Title ────────────────────────────────────────────────────────── */}
        <div className="form-group">
          <label className="form-label" htmlFor="edit-title">
            Title <span className="form-required">*</span>
          </label>
          <input
            id="edit-title"
            className="form-input"
            type="text"
            name="title"
            value={formData.title}
            onChange={handleChange}
            required
          />
        </div>

        {/* ── Author ───────────────────────────────────────────────────────── */}
        <div className="form-group">
          <label className="form-label" htmlFor="edit-author">
            Author
          </label>
          {authorsLoading ? (
            <p className="form-loading">Loading authors...</p>
          ) : (
            <select
              id="edit-author"
              className="form-select"
              name="author_id"
              value={formData.author_id}
              onChange={handleChange}
            >
              <option value="">Select an author</option>
              {authors.map((author) => (
                <option key={author.id} value={String(author.id)}>
                  {author.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* ── Price ────────────────────────────────────────────────────────── */}
        <div className="form-group">
          <label className="form-label" htmlFor="edit-price">
            Price <span className="form-required">*</span>
          </label>
          <input
            id="edit-price"
            className="form-input"
            type="number"
            name="price"
            value={formData.price}
            onChange={handleChange}
            min="0"
            step="0.01"
            required
          />
        </div>

        {/* ── ISBN ─────────────────────────────────────────────────────────── */}
        <div className="form-group">
          <label className="form-label" htmlFor="edit-isbn">
            ISBN <span className="form-required">*</span>
          </label>
          <input
            id="edit-isbn"
            className="form-input"
            type="text"
            name="isbn"
            value={formData.isbn}
            onChange={handleChange}
            placeholder="978-0-123456-78-9"
            required
          />
        </div>

        {/* ── Genre ────────────────────────────────────────────────────────── */}
        <div className="form-group">
          <label className="form-label" htmlFor="edit-genre">
            Genre
          </label>
          <select
            id="edit-genre"
            className="form-select"
            name="genre"
            value={formData.genre}
            onChange={handleChange}
          >
            <option value="">Select a genre</option>
            {GENRES.map((genre) => (
              <option key={genre} value={genre}>
                {genre}
              </option>
            ))}
          </select>
        </div>

        {/* ── Stock ────────────────────────────────────────────────────────── */}
        <div className="form-group">
          <label className="form-label" htmlFor="edit-stock">
            Stock
          </label>
          <input
            id="edit-stock"
            className="form-input"
            type="number"
            name="stock"
            value={formData.stock}
            onChange={handleChange}
            min="0"
          />
        </div>

        {/* ── Actions ──────────────────────────────────────────────────────── */}
        <div className="form-actions">
          <button
            type="submit"
            className="btn-primary"
            disabled={submitting}
          >
            {submitting ? 'Updating...' : 'Update Book'}
          </button>

          <button
            type="button"
            className="btn-secondary"
            onClick={onCancel}
            disabled={submitting}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

export default EditBookForm;
