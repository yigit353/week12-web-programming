/**
 * LoginPage — collects email + password and calls AuthContext.login.
 *
 * Three UX details worth noting:
 *
 *   1. We early-return a <Navigate> when the user is already logged in.
 *      Otherwise someone who hit /login manually while authenticated
 *      would see the form and wonder why their nav changed. This pattern
 *      is strictly "router-level redirect on mount".
 *
 *   2. The form is a controlled component — every keystroke flows through
 *      React state. That makes it easy to disable the submit button on
 *      submit and to clear the form from one place.
 *
 *   3. We show only the backend's error message and nothing else. If
 *      credentials are wrong the server returns the same "Invalid
 *      credentials" text whether the email is unknown or the password is
 *      wrong. Leaking that distinction would let an attacker enumerate
 *      valid emails for later phishing.
 */

import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext';
import '../styles/auth.css';

function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setLocalError(err.message || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <span role="img" aria-label="book">📖</span> ByteBooks
        </div>
        <h1 className="auth-title">Login to ByteBooks</h1>
        <p className="auth-subtitle">Sign in to add, edit, or remove books.</p>

        {localError && <p className="auth-error" role="alert">{localError}</p>}

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="auth-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="auth-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button className="auth-submit" type="submit" disabled={submitting}>
            {submitting ? 'Logging in…' : 'Login'}
          </button>
        </form>

        <p className="auth-switch">
          Don&apos;t have an account? <Link to="/register">Register here</Link>
        </p>
      </div>
    </div>
  );
}

export default LoginPage;
