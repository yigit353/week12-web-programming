/**
 * Book Interaction Tests
 *
 * WHY THESE TESTS MATTER:
 * Interaction tests verify that users can actually use the application, not
 * just that it renders. The two core user journeys tested here are:
 *   1. Clicking a book card to view its full details in a modal overlay.
 *   2. Dismissing that modal and returning to the book list.
 * Without these tests, a regression could silently break the ability to view
 * book details — the most fundamental feature after the list itself.
 *
 * KEY ARCHITECTURAL NOTE — MODALS NOT ROUTES:
 * ByteBooks uses state-based navigation throughout: there is no React Router
 * and no URL changes. The book detail view is a MODAL rendered conditionally
 * by the BookList component. When the user clicks a book card, BookList sets
 * its `selectedBook` state to that book object, which causes BookDetail to
 * mount as a `.book-detail-overlay` in the DOM. Calling onClose (via the
 * close button or clicking the overlay background) sets `selectedBook` back
 * to null, which unmounts BookDetail entirely — it is removed from the DOM,
 * not merely hidden. This is why we assert `not.toBeVisible()` on close rather
 * than checking a CSS display property.
 *
 * PLAYWRIGHT FEATURES USED:
 * - test.describe: Groups related tests so they appear together in reports.
 * - beforeEach: Shared setup that runs before every test in the describe block,
 *   keeping individual tests focused on their own assertions.
 * - page.goto / locator / click: Core navigation and interaction primitives.
 * - waitFor / toBeVisible: Explicit waits for async state changes (the API
 *   fetch and React re-render) before asserting.
 * - locator scoping: Calling `.locator()` on an existing locator restricts
 *   the query to descendants, preventing cross-card matches.
 * - not.toBeVisible(): Asserts an element is absent or hidden after the modal
 *   is closed. Playwright retries this assertion automatically until it passes
 *   or the timeout expires.
 */

import { test, expect } from '@playwright/test'

test.describe('Book Interaction Tests', () => {
  /**
   * beforeEach — shared navigation setup
   *
   * Every test in this block starts from the Books page. Because the app uses
   * state-based navigation (no React Router), we must:
   *   1. Navigate to '/' to load the React app.
   *   2. Click the "Books" nav item to trigger the internal state change that
   *      renders the BookList component.
   *   3. Wait for .book-grid to be visible, confirming the /books API call has
   *      resolved and at least one book card is present in the DOM.
   *
   * Doing this in beforeEach means each test gets a clean, fully-loaded Books
   * page without needing to duplicate these steps.
   */
  test.beforeEach(async ({ page }) => {
    // Load the React app from the base URL (http://localhost:5173).
    await page.goto('/')

    // The app renders the Dashboard page by default. Click the "Books" nav
    // item to switch to the book list view. Playwright auto-waits for the
    // element to be visible and enabled before clicking.
    await page.locator('.nav-item', { hasText: 'Books' }).click()

    // Wait for the book grid to appear, which confirms the BookList component
    // has finished fetching data from the /books API and rendered the cards.
    await expect(page.locator('.book-grid')).toBeVisible()
  })

  // ---------------------------------------------------------------------------
  // Test 1: Clicking a book card opens the detail modal
  //
  // This test verifies the primary interaction path: a user clicks a book card
  // to view its full details. It confirms that:
  //   - The .book-detail-overlay modal mounts in the DOM after the click.
  //   - The .book-detail-card inside the overlay is visible (the card did not
  //     accidentally close itself via event bubbling).
  //   - The modal contains meaningful content: a non-empty title and author.
  // ---------------------------------------------------------------------------
  test('should click on book card and open detail modal', async ({ page }) => {
    // Locate the first book card and read its title text so we can verify the
    // modal shows the same book's data. We scope the title lookup to the card
    // so we don't accidentally match a title on a different card.
    const firstCard = page.locator('.book-card').first()

    // Capture the title text from the card before clicking, so we can confirm
    // the modal displays the correct book's information afterwards.
    const cardTitle = await firstCard.locator('.book-title').textContent()

    // Click on the book title within the card. We target .book-title rather
    // than the card root to avoid hitting the .btn-edit or .btn-delete buttons
    // that sit at the bottom of the card. The click bubbles up through the
    // wrapper div (which carries the onClick handler) to trigger setSelectedBook
    // in BookList, causing BookDetail to mount.
    await firstCard.locator('.book-title').click()

    // Wait for the modal overlay to appear. Because BookDetail is conditionally
    // rendered (it is mounted when selectedBook is truthy and unmounted when
    // null), toBeVisible() here also implicitly confirms the component mounted.
    await expect(page.locator('.book-detail-overlay')).toBeVisible()

    // Confirm the inner card element is visible. This rules out a scenario
    // where the overlay rendered but the card content did not.
    await expect(page.locator('.book-detail-card')).toBeVisible()

    // Verify the modal title element exists and contains text. Scoping to
    // .book-detail-card ensures we query inside the modal, not the grid.
    const detailCard = page.locator('.book-detail-card')
    const detailTitle = detailCard.locator('.detail-title')
    await expect(detailTitle).toBeVisible()

    // The modal title should match the title we read from the card, confirming
    // the correct book's data was passed to BookDetail via selectedBook state.
    const detailTitleText = await detailTitle.textContent()
    expect(detailTitleText?.trim().length).toBeGreaterThan(0)
    expect(detailTitleText?.trim()).toBe(cardTitle?.trim())

    // Confirm the author element is present and non-empty inside the modal.
    // BookDetail renders the author as ".detail-author" in the format "by <name>".
    const detailAuthor = detailCard.locator('.detail-author')
    await expect(detailAuthor).toBeVisible()
    const detailAuthorText = await detailAuthor.textContent()
    expect(detailAuthorText?.trim().length).toBeGreaterThan(0)
  })

  // ---------------------------------------------------------------------------
  // Test 2: Closing the detail modal returns to the book list
  //
  // This test verifies the dismissal path: after opening the modal, the user
  // clicks the close button and returns to the book list. It confirms that:
  //   - The .book-detail-overlay is removed from the DOM after clicking close.
  //   - The .book-grid is still visible, confirming the list view persisted
  //     underneath the modal and is immediately usable after dismissal.
  //
  // NOTE: BookDetail is conditionally rendered, so "closing" means the
  // component unmounts (selectedBook is set to null in BookList). Playwright's
  // not.toBeVisible() assertion retries until the element is gone or the
  // 30-second timeout expires, making it resilient to animation delays.
  // ---------------------------------------------------------------------------
  test('should close detail modal and return to book list', async ({ page }) => {
    // Open the modal by clicking the title of the first book card, using the
    // same targeting strategy as Test 1 (avoid the action buttons).
    const firstCard = page.locator('.book-card').first()
    await firstCard.locator('.book-title').click()

    // Confirm the overlay is visible before attempting to close it. This makes
    // the test fail at the right assertion if the open step regresses.
    await expect(page.locator('.book-detail-overlay')).toBeVisible()

    // Click the close button rendered by BookDetail. This calls the onClose
    // prop, which executes () => setSelectedBook(null) in BookList, causing
    // React to unmount the BookDetail component on the next render.
    await page.locator('.detail-close-btn').click()

    // Assert the overlay is no longer visible. Because BookDetail is unmounted
    // (not just hidden), Playwright will report the element as detached from
    // the DOM, which satisfies not.toBeVisible(). The assertion retries until
    // the React re-render completes.
    await expect(page.locator('.book-detail-overlay')).not.toBeVisible()

    // Confirm the book grid is still visible after closing the modal. This
    // verifies that the list view was preserved under the modal overlay and
    // is immediately accessible again — users do not need to reload the page.
    await expect(page.locator('.book-grid')).toBeVisible()
  })
})
