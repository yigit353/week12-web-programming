import BookList from '../components/BookList';

/*
 * BooksPage — Wraps the existing BookList CRUD component
 *
 * This page reuses all the Session 1 functionality (search, filter, add, edit, delete)
 * and simply wraps it with the dashboard page heading and styling container.
 * The 'books-page' class applies dashboard-themed overrides to the existing
 * BookList styles (cards, forms, buttons) defined in dashboard.css.
 */
function BooksPage() {
  return (
    <div className="books-page">
      <h1 className="section-heading">Manage Books</h1>
      <BookList />
    </div>
  );
}

export default BooksPage;
