/**
 * AddBookPage — thin wrapper around <AddBookForm> so the "add a book"
 * flow can live at its own URL (/books/new) and be gated by
 * <ProtectedRoute>. Navigating away on success or cancel goes back to
 * the Books list so the user sees their new book in context.
 */

import { useNavigate } from 'react-router-dom';

import AddBookForm from '../components/AddBookForm';

function AddBookPage() {
  const navigate = useNavigate();

  return (
    <AddBookForm
      onBookAdded={() => navigate('/books')}
      onCancel={() => navigate('/books')}
    />
  );
}

export default AddBookPage;
