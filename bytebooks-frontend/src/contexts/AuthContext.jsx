/**
 * AuthContext — global authentication state for the app.
 *
 * The context exposes:
 *   - `user`     – the current user object, or null
 *   - `token`    – the JWT string, or null
 *   - `loading`  – true while we're verifying an existing token on app boot
 *   - `error`    – last auth-related error message (cleared on new attempts)
 *   - `login(email, password)`
 *   - `register(username, email, password)` (auto-logs in on success)
 *   - `logout()`
 *
 * Why React Context instead of a state library?
 *   For global state that rarely changes (a user either IS or IS NOT
 *   logged in), Context is the right tool. Heavy tools like Redux or
 *   Zustand are overkill for a single slice of rarely-changing state.
 *
 * Why verify the token on mount?
 *   A stored token may be expired, revoked, or tampered with. Calling
 *   GET /auth/me at boot either confirms "yes, still valid" or returns
 *   401 and we clear the stale token. This also hydrates the `user`
 *   object, which the page (welcome banner, nav) needs.
 */

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

import { authFetch } from '../utils/api';

// Same base as src/utils/api.js so the context and authFetch stay in sync.
// We use an explicit absolute URL (set via VITE_API_URL) so navigating to
// SPA routes like /books/new does not accidentally hit the backend via
// Vite's proxy rules.
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // On mount, if we already have a token, verify it with /auth/me.
  // This also populates `user` after a page refresh.
  useEffect(() => {
    let cancelled = false;

    const verify = async () => {
      const stored = localStorage.getItem('token');
      if (!stored) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`${API_BASE_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${stored}` },
        });
        if (!res.ok) throw new Error('Token invalid');
        const me = await res.json();
        if (!cancelled) {
          setUser(me);
          setToken(stored);
        }
      } catch {
        localStorage.removeItem('token');
        if (!cancelled) {
          setUser(null);
          setToken(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    verify();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    setError(null);
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const msg = data.detail || 'Login failed';
      setError(msg);
      throw new Error(msg);
    }
    const { access_token } = await res.json();
    localStorage.setItem('token', access_token);
    setToken(access_token);

    // Fetch fresh user details. We could decode the JWT client-side but
    // /auth/me is the canonical source and also proves the token works.
    const meRes = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!meRes.ok) throw new Error('Could not fetch user info');
    const me = await meRes.json();
    setUser(me);
  }, []);

  const register = useCallback(
    async (username, email, password) => {
      setError(null);
      const res = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = data.detail || 'Registration failed';
        setError(msg);
        throw new Error(msg);
      }
      // Auto-login after successful registration so the user doesn't have
      // to type their credentials twice.
      await login(email, password);
    },
    [login],
  );

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setUser(null);
    setToken(null);
    setError(null);
  }, []);

  const value = { user, token, loading, error, login, register, logout };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Custom hook — cleaner call site than useContext(AuthContext) everywhere,
// and throws a loud error if used outside the provider (which is almost
// always a bug during refactoring).
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (ctx === null) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return ctx;
}

// Re-export authFetch for convenience so callers don't have to import
// from two places when they need both.
export { authFetch };
