/**
 * ProtectedRoute — gate child routes behind authentication.
 *
 * Usage:
 *   <Route path="/books/new" element={
 *     <ProtectedRoute><AddBookPage /></ProtectedRoute>
 *   }/>
 *
 * If the user is not logged in, we redirect to /login via <Navigate>.
 * The `replace` prop swaps the current URL rather than pushing, so the
 * browser Back button doesn't loop the user back to the protected page
 * they weren't allowed to see in the first place.
 *
 * During initial auth verification (AuthContext is calling /auth/me to
 * check a stored token) we render a placeholder. Without this, a quick
 * page refresh while logged in would flash the login screen before the
 * verification resolved, which is jarring.
 */

import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="auth-loading">
        <div className="spinner" />
        <p>Checking sign-in…</p>
      </div>
    );
  }

  if (!user) {
    // `state={{ from: location }}` would let LoginPage redirect back
    // after a successful login. Not used today but cheap to include.
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}

export default ProtectedRoute;
