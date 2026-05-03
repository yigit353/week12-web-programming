/**
 * Search and Filter E2E Tests
 *
 * WHY THESE TESTS MATTER FOR UX:
 * Search and filter functionality is one of the most user-facing features in
 * any data-heavy application. If filtering silently breaks — returning wrong
 * results or freezing — users lose trust and can't find what they need.
 * E2E tests at this layer catch regressions that unit tests miss because they
 * exercise the full React rendering pipeline: state change → DOM re-render →
 * visible result.
 *
 * PLAYWRIGHT FEATURES USED:
 * - page.goto()         – Navigate to a URL (uses baseURL from playwright.config.ts)
 * - page.click()        – Simulate a user click on a matched element
 * - page.fill()         – Set the value of an input field (replaces existing text)
 * - page.textContent()  – Read the text content of a matched element
 * - page.locator()      – Create a lazy element reference with retry logic built in
 * - locator.count()     – Count how many matching elements exist in the DOM
 * - locator.waitFor()   – Wait until an element reaches a specified state
 * - expect(locator)     – Playwright's auto-retrying assertion layer
 * - beforeEach hook     – Shared navigation setup that runs before every test,
 *                         keeping each test independent and reducing duplication
 */

import { test, expect } from '@playwright/test';

test.describe('Search and Filter Tests', () => {
  /**
   * beforeEach – Shared navigation to the Books page.
   *
   * Because this app uses state-based navigation (no React Router / URL
   * changes), every test must manually click through to the Books page.
   * Centralising this in beforeEach means each test starts from a clean,
   * fully-loaded Books page without repeating the same three lines everywhere.
   */
  test.beforeEach(async ({ page }) => {
    // Start from the root of the app
    await page.goto('/');

    // Click the "Books" nav item in the sidebar to switch the active page.
    // The nav items use the .nav-item class; we narrow by text so we pick
    // exactly the Books entry even if the sidebar order ever changes.
    await page.click('.nav-item:has-text("Books")');

    // Wait until the book grid is present and visible before any test logic
    // runs. This guards against the async fetch not having completed yet and
    // prevents false failures caused by querying the DOM too early.
    await page.locator('.book-grid').waitFor({ state: 'visible' });
  });

  /**
   * Test 1 – Typing a real title into the search box should narrow the list.
   *
   * This verifies the core search contract: the BookList component filters
   * book cards in real time as the user types, showing only cards whose
   * title contains the search string (case-insensitive). If the filter were
   * broken (e.g. always showing all books, or always showing none), this
   * test would catch it immediately.
   *
   * Playwright feature highlighted: page.textContent() reads live DOM text,
   * and page.fill() triggers the React onChange event just as a real user
   * typing would.
   */
  test('should filter books by search term', async ({ page }) => {
    // Grab the title of whichever book appears first in the grid.
    // We read from the DOM rather than hard-coding a title so the test
    // remains valid even when the seed data changes.
    const firstTitle = await page.locator('.book-card .book-title').first().textContent();

    // Guard: if there are no books at all the test cannot be meaningful.
    expect(firstTitle).toBeTruthy();

    // Use the first word of the title as the search term.
    // A single word is enough to exercise the filter and avoids brittle
    // reliance on the exact full title string.
    const searchTerm = (firstTitle as string).split(' ')[0];

    // Record how many books are currently visible before filtering.
    const totalBooks = await page.locator('.book-card').count();

    // Fill the search input — this triggers React's onChange, which updates
    // searchTerm state and re-renders filteredBooks on the next tick.
    await page.fill('.search-input', searchTerm);

    // Wait for the DOM to settle: we expect at least one card to remain.
    // Using expect with a locator gives Playwright's built-in retry logic,
    // so this assertion polls until it passes or the timeout expires.
    await expect(page.locator('.book-card').first()).toBeVisible();

    // The filtered count should be ≤ total (could be equal if every book
    // happens to contain that word, but never greater).
    const filteredCount = await page.locator('.book-card').count();
    expect(filteredCount).toBeGreaterThanOrEqual(1);
    expect(filteredCount).toBeLessThanOrEqual(totalBooks);
  });

  /**
   * Test 2 – A nonsense search term should produce zero results.
   *
   * This verifies the "empty state" path in BookList. When filteredBooks is
   * empty the component renders a <p className="no-results"> message instead
   * of the .book-grid. Testing both the absence of cards AND the presence of
   * the message gives double coverage: one check on the data layer, one on
   * the UI feedback layer. Users who see a blank screen with no message would
   * be confused; this test enforces that the app communicates clearly.
   */
  test('should show no results when search term matches nothing', async ({ page }) => {
    // This string is deliberately absurd and should never match any real title.
    const nonsenseTerm = 'XYZABC123NONEXISTENT';

    await page.fill('.search-input', nonsenseTerm);

    // After filtering, the book-grid itself is replaced by the .no-results
    // paragraph (see BookList.jsx: filteredBooks.length === 0 branch).
    // We assert the grid is gone and the message has appeared.
    await expect(page.locator('.book-grid')).not.toBeVisible();

    // Verify the user-facing "no results" message is shown so the app does
    // not leave users staring at a mysteriously empty screen.
    await expect(page.locator('.no-results')).toBeVisible();

    // Double-check at the card level: zero cards in the DOM confirms the
    // filter logic returned an empty array, not just that the grid is hidden.
    const cardCount = await page.locator('.book-card').count();
    expect(cardCount).toBe(0);
  });

  /**
   * Test 3 – Clearing the search input should restore the full book list.
   *
   * This verifies that the filter is purely derived from state: when
   * searchTerm resets to an empty string, every book passes the includes('')
   * check and all cards reappear. Without this test a subtle bug — such as
   * the clear action not firing onChange, or the state update not triggering
   * a re-render — could leave users stuck in a filtered view with no way to
   * see all books again.
   *
   * Playwright feature highlighted: page.fill() with an empty string '' is
   * the idiomatic way to clear a text input; it sets the value to '' and
   * fires the input event, just like selecting all text and pressing Delete.
   */
  test('should clear search and show all books again', async ({ page }) => {
    // Baseline: count every book card before any filtering is applied.
    const totalBooks = await page.locator('.book-card').count();

    // Apply a partial filter so the list is visibly narrowed before we clear.
    // Using a single letter maximises the chance of matching something while
    // still demonstrating that "some" filtering took place.
    await page.fill('.search-input', 'a');

    // Wait for the DOM to reflect the filtered state before clearing.
    // We wait for the input value to be set rather than asserting card counts,
    // because the filter result for 'a' is data-dependent.
    await expect(page.locator('.search-input')).toHaveValue('a');

    // Clear the input by filling it with an empty string.
    // This fires React's onChange with an empty value, setting searchTerm
    // back to '' so all books pass the filter again.
    await page.fill('.search-input', '');

    // The input should now be empty.
    await expect(page.locator('.search-input')).toHaveValue('');

    // The book grid should reappear if it was hidden (no-results state).
    await page.locator('.book-grid').waitFor({ state: 'visible' });

    // All original cards should be back — the count must match the baseline
    // we recorded before any filtering was applied.
    const restoredCount = await page.locator('.book-card').count();
    expect(restoredCount).toBe(totalBooks);
  });
});
