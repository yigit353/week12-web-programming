import { useState, useEffect } from 'react';

import { authFetch } from '../utils/api';

/*
 * AuthorsPage — Read-only list of authors
 *
 * Fetches authors from /authors and books from /books.
 * Displays each author as a card showing their name, ID, and book count.
 * Book count is calculated by counting books with matching author_id.
 */
function AuthorsPage() {
  const [authors, setAuthors] = useState([]);
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [authorsRes, booksRes] = await Promise.all([
          authFetch('/authors'),
          authFetch('/books'),
        ]);

        if (!authorsRes.ok || !booksRes.ok) {
          throw new Error('Failed to fetch data');
        }

        const authorsData = await authorsRes.json();
        const booksData = await booksRes.json();
        setAuthors(authorsData);
        setBooks(booksData);
      } catch (err) {
        console.error('Authors fetch error:', err);
        setError('Failed to load authors. Make sure the backend is running.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Count books per author
  const getBookCount = (authorId) => {
    return books.filter((book) => book.author_id === authorId).length;
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading authors...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <p>{error}</p>
        <button className="retry-btn" onClick={() => window.location.reload()}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="section-heading">Authors</h1>
      <div className="authors-grid">
        {authors.map((author) => {
          const bookCount = getBookCount(author.id);
          return (
            <div key={author.id} className="author-card">
              <div className="author-name">{author.name}</div>
              <div className="author-meta">
                {bookCount} {bookCount === 1 ? 'book' : 'books'}
              </div>
              <div className="author-id">ID: {author.id}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default AuthorsPage;
