// useState manages the form's field values and UI state (loading, authors list).
// useEffect runs the authors fetch once after the component mounts so the
// Author dropdown is populated before the user tries to submit.
import { useState, useEffect } from 'react';

import { authFetch } from '../utils/api';
import './AddBookForm.css';

/*
 * ── Controlled Component Pattern ────────────────────────────────────────────
 *
 * Every <input> and <select> in this form is a "controlled component":
 * its current value lives in React state (formData), and every keystroke or
 * selection fires an onChange handler that updates that state. This means
 * React is always the single source of truth — we never read raw DOM values.
 *
 * A single state object (formData) is used for all fields. The handleChange
 * helper uses the input's `name` attribute to update only the relevant key,
 * so we don't need a separate setter for each field.
 *
 * ── Form Submission Flow ─────────────────────────────────────────────────────
 *
 * 1. User clicks "Add Book".
 * 2. handleSubmit calls event.preventDefault() to stop the browser's default
 *    form navigation.
 * 3. Required fields are validated; an alert fires and the function returns
 *    early if any are empty.
 * 4. submitting is set to true — the button is disabled and shows "Adding…"
 *    to prevent duplicate submissions.
 * 5. fetch() POSTs the book data as JSON to the backend.
 * 6a. On success: the form is reset, onBookAdded() is called so the parent
 *     can refresh the book list, and an alert confirms the addition.
 * 6b. On error: the error detail from the API response is shown via alert,
 *     and the form data is preserved so the user can fix the mistake.
 * 7. submitting is set back to false in either case.
 */

function AddBookForm({ onBookAdded, onCancel }) {
  // ── Form field state ──────────────────────────────────────────────────────
  // All fields are in one object. Keeping them together makes it trivial to
  // reset the form (just reassign the initial value object) and keeps the
  // handleChange logic in a single generic function.
  const [formData, setFormData] = useState({
    title: '',
    author_id: '',
    price: '',
    isbn: '',
    genre: 'Fiction',
    stock: 0,
  });

  // ── Authors list state ────────────────────────────────────────────────────
  const [authors, setAuthors] = useState([]);
  const [authorsLoading, setAuthorsLoading] = useState(true);

  // ── Submission state ──────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);

  // ── Fetch authors on mount ────────────────────────────────────────────────
  // The empty dependency array [] means this effect runs exactly once, right
  // after the first render. It populates the Author dropdown before the user
  // can interact with the form.
  useEffect(() => {
    const fetchAuthors = async () => {
      try {
        const response = await authFetch('/authors');
        const data = await response.json();
        setAuthors(data);

        // Pre-select the first author so the dropdown always has a valid value
        // when the user submits without explicitly choosing one.
        if (data.length > 0) {
          setFormData((prev) => ({ ...prev, author_id: data[0].id }));
        }
      } catch (err) {
        console.error('Error fetching authors:', err);
      } finally {
        setAuthorsLoading(false);
      }
    };

    fetchAuthors();
  }, []);

  // ── Generic field change handler ──────────────────────────────────────────
  // Using the input's `name` attribute as the key lets one function handle
  // every field, instead of a separate onChange for each one.
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // ── Form submission ───────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate required fields before hitting the network.
    if (!formData.title.trim()) {
      alert('Title is required.');
      return;
    }
    if (!formData.author_id) {
      alert('Please select an author.');
      return;
    }
    if (formData.price === '' || formData.price === null) {
      alert('Price is required.');
      return;
    }
    if (!formData.isbn.trim()) {
      alert('ISBN is required.');
      return;
    }

    setSubmitting(true);

    try {
      // authFetch automatically attaches our JWT so the backend allows
      // the POST. Without a token (or with an expired one) the backend
      // returns 401 and authFetch redirects us to /login.
      const response = await authFetch('/books', {
        method: 'POST',
        // The API schema expects numeric types for author_id, price, and stock.
        // We cast them explicitly here so we never send strings to a typed API.
        body: JSON.stringify({
          title: formData.title,
          author_id: Number(formData.author_id),
          price: Number(formData.price),
          isbn: formData.isbn,
          genre: formData.genre,
          stock: Number(formData.stock),
        }),
      });

      if (response.ok) {
        // Reset the form to its initial state on success.
        setFormData({
          title: '',
          author_id: authors.length > 0 ? authors[0].id : '',
          price: '',
          isbn: '',
          genre: 'Fiction',
          stock: 0,
        });

        // Show success feedback first, then notify the parent.
        // The alert must fire before onBookAdded() because onBookAdded
        // starts an async fetch. If the fetch is initiated before alert(),
        // the browser may block JS (during the alert dialog) before the
        // fetch request is actually sent, causing timing issues in tests.
        alert('Book added successfully!');
        onBookAdded();
      } else {
        // The FastAPI backend returns errors as { detail: "..." }.
        const errorData = await response.json();
        alert(`Error: ${errorData.detail || 'Failed to add book.'}`);
      }
    } catch (err) {
      console.error('Error adding book:', err);
      alert('Network error. Make sure the backend is running.');
    } finally {
      // Always restore the button, whether the request succeeded or failed.
      setSubmitting(false);
    }
  };

  return (
    <div className="add-book-form-container">
      <h2 className="add-book-title">Add New Book</h2>

      <form onSubmit={handleSubmit} className="add-book-form" noValidate>

        {/* ── Title ──────────────────────────────────────────────────────── */}
        <div className="form-group">
          <label htmlFor="title" className="form-label">Title</label>
          <input
            id="title"
            type="text"
            name="title"
            className="form-input"
            value={formData.title}
            onChange={handleChange}
            required
          />
        </div>

        {/* ── Author ─────────────────────────────────────────────────────── */}
        <div className="form-group">
          <label htmlFor="author_id" className="form-label">Author</label>
          {authorsLoading ? (
            <p className="authors-loading">Loading authors...</p>
          ) : (
            <select
              id="author_id"
              name="author_id"
              className="form-select"
              value={formData.author_id}
              onChange={handleChange}
            >
              {authors.map((author) => (
                <option key={author.id} value={author.id}>
                  {author.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* ── Price ──────────────────────────────────────────────────────── */}
        <div className="form-group">
          <label htmlFor="price" className="form-label">Price</label>
          <input
            id="price"
            type="number"
            name="price"
            className="form-input"
            value={formData.price}
            onChange={handleChange}
            min="0"
            step="0.01"
            required
          />
        </div>

        {/* ── ISBN ───────────────────────────────────────────────────────── */}
        <div className="form-group">
          <label htmlFor="isbn" className="form-label">ISBN</label>
          <input
            id="isbn"
            type="text"
            name="isbn"
            className="form-input"
            value={formData.isbn}
            onChange={handleChange}
            placeholder="978-0-123456-78-9"
            required
          />
        </div>

        {/* ── Genre ──────────────────────────────────────────────────────── */}
        <div className="form-group">
          <label htmlFor="genre" className="form-label">Genre</label>
          <select
            id="genre"
            name="genre"
            className="form-select"
            value={formData.genre}
            onChange={handleChange}
          >
            <option value="Fiction">Fiction</option>
            <option value="Non-Fiction">Non-Fiction</option>
            <option value="Sci-Fi">Sci-Fi</option>
            <option value="Mystery">Mystery</option>
            <option value="Romance">Romance</option>
            <option value="Biography">Biography</option>
            <option value="Technical">Technical</option>
          </select>
        </div>

        {/* ── Stock ──────────────────────────────────────────────────────── */}
        <div className="form-group">
          <label htmlFor="stock" className="form-label">Stock</label>
          <input
            id="stock"
            type="number"
            name="stock"
            className="form-input"
            value={formData.stock}
            onChange={handleChange}
            min="0"
            required
          />
        </div>

        {/* ── Actions ────────────────────────────────────────────────────── */}
        <div className="form-actions">
          {/* The submit button is disabled while a request is in flight to
              prevent duplicate POSTs from rapid clicking. */}
          <button
            type="submit"
            className="btn-submit"
            disabled={submitting}
          >
            {submitting ? 'Adding...' : 'Add Book'}
          </button>

          <button
            type="button"
            className="btn-cancel"
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

export default AddBookForm;
