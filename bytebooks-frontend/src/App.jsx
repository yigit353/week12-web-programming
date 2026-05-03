import { Route, Routes } from 'react-router-dom';

import DashboardLayout from './components/DashboardLayout';
import ProtectedRoute from './components/ProtectedRoute';
import AddBookPage from './pages/AddBookPage';
import AuthorsPage from './pages/AuthorsPage';
import BooksPage from './pages/BooksPage';
import Dashboard from './pages/Dashboard';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';

/**
 * App — URL-to-component routing table.
 *
 * Public routes: /, /books, /authors, /login, /register.
 * Protected: /books/new (wrapped in <ProtectedRoute>).
 *
 * The auth routes are *outside* the DashboardLayout so they render as
 * full-screen centred cards, not inside the admin chrome. Everything
 * else nests inside <DashboardLayout>, which renders its children via
 * <Outlet /> — that's how a "layout route" in React Router v6 works.
 */
function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route element={<DashboardLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="books" element={<BooksPage />} />
        <Route path="authors" element={<AuthorsPage />} />
        <Route
          path="books/new"
          element={
            <ProtectedRoute>
              <AddBookPage />
            </ProtectedRoute>
          }
        />
      </Route>
    </Routes>
  );
}

export default App;
