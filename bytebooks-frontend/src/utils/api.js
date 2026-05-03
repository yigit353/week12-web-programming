/**
 * authFetch — fetch() with automatic Bearer-token injection and 401 handling.
 *
 * Every network call in the app that needs to hit the backend goes through
 * this wrapper. Two concerns live here:
 *
 *   1. **Inject the token.** If `localStorage` has a `token`, we set
 *      `Authorization: Bearer <token>` on the outgoing request. Callers
 *      don't have to think about auth — public endpoints (GET /books) work
 *      unchanged, and protected endpoints (POST /books) become authenticated.
 *
 *   2. **Handle token expiry centrally.** If the backend responds 401, the
 *      token is either missing, wrong, or expired. We scrub it from
 *      localStorage and redirect to /login with `window.location.href` so
 *      the whole app reloads with clean state. Doing this in one place
 *      means every component gets consistent behaviour for free.
 *
 * **Why localStorage?** Trade-off discussed in README.md and v2/HOW_TO_USE.md:
 * it's simple and survives page reloads, but is readable by any JavaScript
 * on the page — so an XSS bug becomes an account-takeover bug. For a
 * production app, prefer httpOnly cookies (XSS can't touch them, but you
 * have to worry about CSRF instead).
 */

// Base URL for the API. Empty string makes fetches relative, which
// routes them through Vite's dev-server proxy during development.
// In production you would set VITE_API_URL at build time to your
// actual API domain (https://api.bytebooks.example).
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export async function authFetch(url, options = {}) {
  const token = localStorage.getItem('token');

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${url}`, { ...options, headers });

  // Centralised 401 handling. Redirect only if we were actually sending a
  // token — a 401 with no token is an expected "please log in" from a
  // protected route (and the page will route to /login via ProtectedRoute).
  if (response.status === 401 && token) {
    localStorage.removeItem('token');
    window.location.href = '/login';
    // Throw so callers don't keep processing a half-redirected response.
    throw new Error('Session expired');
  }

  return response;
}
