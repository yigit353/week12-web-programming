// useState lets us store values that persist across re-renders.
// Unlike regular variables (which reset every time the component function runs),
// state is preserved by React between renders. When you call a setter like
// setBooks(...), React schedules a re-render and the component will see the
// new value on the next render cycle.
//
// useEffect lets us run side effects (like data fetching, subscriptions, or
// DOM mutations) after the component has rendered. Passing an empty dependency
// array [] as the second argument tells React to run this effect only once,
// right after the first mount — never again on subsequent re-renders.
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext';
import { authFetch } from '../utils/api';
import BookCard from './BookCard';
import BookDetail from './BookDetail';
import EditBookForm from './EditBookForm';
import './BookList.css';

/*
 * ── State Management Strategy ───────────────────────────────────────────────
 *
 * BookList manages all state for the book browsing experience:
 *
 *   books         – Array of book objects returned by the API
 *   loading       – Boolean flag: true while the fetch is in progress
 *   error         – Error message string, or null when everything is fine
 *   searchTerm    – The current value of the search input (controlled component)
 *   selectedGenre – The currently selected genre filter ('All' shows everything)
 *   selectedBook  – The book object currently being viewed in the detail modal,
 *                   or null when no book is selected
 *
 * Why is all this state in BookList instead of spread across child components?
 * This is called "lifting state up". The search input, genre dropdown, and book
 * grid all need access to the same filtered data. By keeping the filtering
 * state in their common parent (BookList), we have a single source of truth
 * and avoid prop-drilling or state synchronisation bugs.
 */

function BookList() {
  // Auth state — `user` is non-null once login has completed. Used below to
  // conditionally show edit/delete controls. The Add Book action is a Link
  // to the protected /books/new route, so we gate it the same way.
  const { user } = useAuth();

  // ── Data & fetch state ──────────────────────────────────────────────────
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ── Filter state ────────────────────────────────────────────────────────
  // searchTerm and selectedGenre are "controlled component" values.
  // A controlled component is an input whose value is driven by React state:
  //   <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
  // React owns the value, and every keystroke flows through state. This gives
  // us a single source of truth for the input's value, making it easy to use
  // the value elsewhere (e.g. for filtering).
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('All');

  // ── Detail view state ───────────────────────────────────────────────────
  // selectedBook is either a full book object (when the user has clicked a
  // card) or null (when no detail view is open). We use a null check to
  // conditionally render the BookDetail modal:
  //   {selectedBook && <BookDetail ... />}
  // This is different from checking for undefined — null is an intentional
  // "nothing selected" value, while undefined usually means "not yet set".
  const [selectedBook, setSelectedBook] = useState(null);

  // ── CRUD view mode ──────────────────────────────────────────────────────
  // mode controls which view is shown: 'list' (default), 'add', or 'edit'
  const [mode, setMode] = useState('list');
  // The book currently being edited (only used when mode is 'edit')
  const [editingBook, setEditingBook] = useState(null);

  // ── Data fetching ───────────────────────────────────────────────────────
  // We extract fetchBooks so it can be called both on mount and when the
  // user clicks the "Retry" button after an error.
  const fetchBooks = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await authFetch('/books');
      const data = await response.json();
      setBooks(data);
    } catch (err) {
      console.error('Error fetching books:', err);
      setError('Failed to load books. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBooks();
  }, []);

  // ── Delete handler ──────────────────────────────────────────────────────
  const handleDelete = async (book, e) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete ${book.title}?`)) {
      return;
    }
    try {
      const response = await authFetch(`/books/${book.id}`, {
        method: 'DELETE',
      });
      if (response.status === 204) {
        fetchBooks();
      } else {
        const data = await response.json().catch(() => ({}));
        alert(data.detail || `Failed to delete book (status ${response.status})`);
      }
    } catch (err) {
      alert(`Error deleting book: ${err.message}`);
    }
  };

  // ── Edit handler ────────────────────────────────────────────────────────
  const handleEdit = (book, e) => {
    e.stopPropagation();
    setEditingBook(book);
    setMode('edit');
  };

  // ── Filtering logic ────────────────────────────────────────────────────
  // We chain two filters: first by search term, then by genre.
  // Both conditions must be true for a book to appear in the results.
  // This creates a derived value — filteredBooks is computed from state on
  // every render, so it is always in sync with the current search and genre.
  const filteredBooks = books.filter(book => {
    const matchesSearch = book.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesGenre = selectedGenre === 'All' || book.genre === selectedGenre;
    return matchesSearch && matchesGenre;
  });

  // Extract unique genres from the books array for the dropdown.
  // We use a Set to deduplicate, then spread into an array.
  // 'All' is prepended as a "show everything" option.
  const genres = ['All', ...new Set(books.map(book => book.genre).filter(Boolean))];

  // ── Loading state ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Loading books...</p>
      </div>
    );
  }

  // ── Error state ─────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="error">
        <p>{error}</p>
        <button className="retry-button" onClick={fetchBooks}>
          Retry
        </button>
      </div>
    );
  }

  // ── Edit form view ───────────────────────────────────────────────────────
  if (mode === 'edit') {
    return (
      <EditBookForm
        key={editingBook.id}
        book={editingBook}
        onBookUpdated={() => { fetchBooks(); setMode('list'); }}
        onCancel={() => setMode('list')}
      />
    );
  }

  // ── List view (default) ──────────────────────────────────────────────────
  return (
    <div className="book-list-container">
      {/* Add New Book: a Link to the protected /books/new route when the
          user is signed in; a prompt to log in otherwise. This is the same
          "lift the action to a real URL" pattern used for most of the app,
          which plays nicely with the back button and bookmarks. */}
      {user ? (
        <Link to="/books/new" className="add-book-button">
          Add New Book
        </Link>
      ) : (
        <p className="auth-hint">
          <Link to="/login">Login</Link> to add, edit, or remove books.
        </p>
      )}

      {/* ── Search & Filter Controls ─────────────────────────────────────
          These are "controlled components": their displayed value comes from
          React state (value={...}), and every change is captured via onChange
          and routed back into state. This means React is always the single
          source of truth for the input values. */}
      <div className="filters-section">
        <input
          type="text"
          className="search-input"
          placeholder="Search books by title..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        <select
          className="genre-select"
          value={selectedGenre}
          onChange={(e) => setSelectedGenre(e.target.value)}
        >
          {genres.map((genre) => (
            <option key={genre} value={genre}>
              {genre}
            </option>
          ))}
        </select>
      </div>

      {/* ── Book Grid or No Results ──────────────────────────────────── */}
      {filteredBooks.length === 0 ? (
        <p className="no-results">No books found matching your criteria.</p>
      ) : (
        <div className="book-grid">
          {filteredBooks.map((book) => (
            // Wrapping BookCard in a div with onClick lets us capture clicks
            // without modifying BookCard itself. When clicked, we "lift" the
            // book data up into selectedBook state, which triggers the modal.
            <div key={book.id} onClick={() => setSelectedBook(book)}>
              <BookCard
                book={book}
                // Edit/delete controls only fire meaningfully when signed
                // in. For unauthenticated users we pass undefined so the
                // card can choose to hide the buttons entirely.
                onEdit={user ? (e) => handleEdit(book, e) : undefined}
                onDelete={user ? (e) => handleDelete(book, e) : undefined}
              />
            </div>
          ))}
        </div>
      )}

      {/* ── Book Detail Modal ────────────────────────────────────────────
          Conditional rendering: if selectedBook is not null (i.e. the user
          clicked a card), we render the BookDetail modal. The && operator
          short-circuits — when selectedBook is null (falsy), React renders
          nothing. When it's a book object (truthy), the right side evaluates
          and the modal appears.

          onClose sets selectedBook back to null, which removes the modal
          from the DOM entirely (not just hidden — unmounted). */}
      {selectedBook && (
        <BookDetail
          selectedBook={selectedBook}
          onClose={() => setSelectedBook(null)}
        />
      )}
    </div>
  );
}

export default BookList;
