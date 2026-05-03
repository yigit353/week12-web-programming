/**
 * Visual Regression Tests for ByteBooks Admin Dashboard
 *
 * WHAT ARE VISUAL REGRESSION TESTS?
 * Visual regression tests capture screenshots of your application and compare
 * them against previously saved "baseline" images. If the UI changes — whether
 * intentionally (a redesign) or accidentally (a CSS bug) — the pixel-level
 * comparison will detect the difference and fail the test. This catches layout
 * shifts, colour changes, missing elements, and font rendering issues that
 * functional tests would miss because they only check DOM structure and text
 * content, not how the page actually looks to a user.
 *
 * WHY PIXEL-PERFECT COMPARISON MATTERS FOR UI:
 * Users interact with what they see, not with the DOM. A button that exists in
 * the DOM but is rendered off-screen, overlapped by another element, or styled
 * with invisible text is functionally broken even though a locator-based test
 * would pass. Screenshot tests verify the final rendered output — the same
 * pixels the user sees — providing a last line of defence against visual bugs.
 *
 * HOW TO HANDLE FALSE POSITIVES:
 * Font rendering varies across operating systems (macOS vs Linux vs Windows)
 * and even across OS versions. Anti-aliasing and sub-pixel rendering can cause
 * tiny pixel differences that are invisible to the human eye but fail a strict
 * comparison. The playwright.config.ts in this project sets:
 *   - threshold: 0.2 (20% per-pixel colour tolerance)
 *   - maxDiffPixels: 100 (up to 100 pixels may differ)
 * These settings absorb normal rendering variance. If tests still produce
 * false positives after an OS update or font change, regenerate baselines:
 *   npx playwright test --update-snapshots
 *
 * FIRST RUN BEHAVIOUR:
 * On the very first run there are no baseline screenshots to compare against.
 * Playwright will create them automatically and store them in a
 * `visual-regression.spec.ts-snapshots/` directory next to this test file.
 * Subsequent runs compare new screenshots against these baselines. Commit the
 * baseline images to version control so all team members compare against the
 * same reference.
 *
 * PLAYWRIGHT FEATURES USED:
 * - expect(page).toHaveScreenshot(): Takes a screenshot of the full page (or
 *   viewport) and compares it against a stored baseline. Options like
 *   { fullPage: true } capture the entire scrollable area.
 * - expect(locator).toHaveScreenshot(): Takes a screenshot of a single element
 *   rather than the full page — useful for testing individual components like
 *   a book card without being affected by changes elsewhere on the page.
 * - waitForLoadState('networkidle'): Ensures all API fetches have completed
 *   and the page has settled before taking a screenshot. Without this, a
 *   screenshot might capture a loading spinner or partial data.
 */

import { test, expect } from '@playwright/test'

/**
 * Helper: navigate to the Books page and wait for the book grid to load.
 */
async function goToBooksPage(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.locator('.nav-item', { hasText: 'Books' }).click()
  await page.waitForLoadState('networkidle')
  await expect(page.locator('.book-grid')).toBeVisible()
}

test.beforeAll(async () => {
  await fetch('http://localhost:8000/reset-db', { method: 'POST' })
})

test.describe('Visual Regression Tests', () => {
  // ---------------------------------------------------------------------------
  // Test 1: Dashboard page screenshot
  //
  // The Dashboard is the landing page and shows statistics cards and a data
  // table. This screenshot captures the complete layout including the sidebar,
  // header, stats grid, and books table.
  // ---------------------------------------------------------------------------
  test('should match screenshot of Dashboard page', async ({ page }) => {
    await page.goto('/')
    // Wait for the Dashboard's two parallel API calls (/books and /authors)
    // to complete. The stat cards and data table are rendered from this data,
    // so we must wait for networkidle to avoid capturing a loading state.
    await page.waitForLoadState('networkidle')

    // Confirm the dashboard content is fully rendered before screenshotting.
    await expect(page.locator('.stat-card').first()).toBeVisible()
    await expect(page.locator('.data-table')).toBeVisible()

    // Take a viewport screenshot and compare against the stored baseline.
    // On first run this creates the baseline; subsequent runs compare.
    await expect(page).toHaveScreenshot('dashboard.png')
  })

  // ---------------------------------------------------------------------------
  // Test 2: Books list page screenshot (full page)
  //
  // Captures the entire scrollable books page including all book cards. Using
  // { fullPage: true } ensures cards below the fold are included.
  // ---------------------------------------------------------------------------
  test('should match screenshot of Books list page', async ({ page }) => {
    await goToBooksPage(page)

    // fullPage: true captures the entire document height, not just the
    // viewport. This is important for the book list because there may be
    // more cards than fit in a single viewport.
    await expect(page).toHaveScreenshot('books-list.png', { fullPage: true })
  })

  // ---------------------------------------------------------------------------
  // Test 3: Add Book form screenshot
  //
  // Captures the Add Book form in its initial empty state with all fields
  // and the author dropdown populated.
  // ---------------------------------------------------------------------------
  test('should match screenshot of Add Book form', async ({ page }) => {
    await goToBooksPage(page)

    // Click the "Add New Book" button to switch BookList's mode to 'add',
    // which renders the AddBookForm component.
    await page.click('.add-book-button')

    // Wait for the AddBookForm to be visible. The form fetches /authors on
    // mount to populate the author dropdown, so we also wait for networkidle.
    await expect(page.locator('.add-book-form')).toBeVisible()
    await page.waitForLoadState('networkidle')

    await expect(page).toHaveScreenshot('add-book-form.png')
  })

  // ---------------------------------------------------------------------------
  // Test 4: Book detail modal screenshot
  //
  // Captures the detail overlay that appears when a user clicks a book card.
  // The modal shows the book's title, author, price, genre, ISBN, and stock.
  // ---------------------------------------------------------------------------
  test('should match screenshot of Book detail page', async ({ page }) => {
    await goToBooksPage(page)

    // Click the title of the first book card to open the detail modal.
    // We target .book-title to avoid hitting the Edit or Delete buttons.
    const firstCard = page.locator('.book-card').first()
    await firstCard.locator('.book-title').click()

    // Wait for the BookDetail overlay to mount and become visible.
    await expect(page.locator('.book-detail-overlay')).toBeVisible()
    await expect(page.locator('.book-detail-card')).toBeVisible()

    await expect(page).toHaveScreenshot('book-detail.png')
  })

  // ---------------------------------------------------------------------------
  // Test 5: Individual book card screenshot
  //
  // Captures just the first book card element, isolating it from the rest of
  // the page. This is useful for detecting layout changes within the card
  // component (font size, padding, badge positioning) without being affected
  // by changes to the surrounding page layout.
  //
  // Playwright feature highlighted: expect(locator).toHaveScreenshot() takes
  // a screenshot of only the matched element's bounding box, not the full page.
  // ---------------------------------------------------------------------------
  test('should detect layout changes in book cards', async ({ page }) => {
    await goToBooksPage(page)

    // Take a screenshot of only the first book card. If CSS changes break the
    // card's internal layout (padding, font size, badge position), this test
    // will catch it even if the overall page layout is unchanged.
    await expect(
      page.locator('.book-card').first()
    ).toHaveScreenshot('book-card.png')
  })
})
