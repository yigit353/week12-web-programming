/**
 * Book List Display Tests
 *
 * WHY THESE TESTS MATTER:
 * The book list is the core feature of ByteBooks. Users need to see their
 * library of books with accurate titles, authors, and prices. These tests
 * verify that the BookList component correctly fetches data from the /books
 * API and renders each book card with all required fields.
 *
 * PLAYWRIGHT FEATURES USED:
 * - Locators: page.locator() for querying DOM elements by CSS selector
 * - Auto-waiting: Playwright automatically waits for elements to be visible
 *   before interacting with or asserting on them, eliminating manual waits
 * - waitFor / toBeVisible: Explicitly wait for async data-loading states
 * - first(): Targets only the first matched element in a list
 * - count(): Returns the number of elements matching a locator
 * - toContainText / toHaveText: Text assertion helpers on locators
 * - toMatch (regex): Validates text content against a regular expression
 */

import { test, expect } from '@playwright/test'

/**
 * Helper: navigate to the homepage and click the Books nav item.
 *
 * The app uses state-based navigation (no React Router), so there is no
 * /books URL. Clicking the nav item with text "Books" triggers an internal
 * state change that renders the BookList component.
 */
async function goToBooksPage(page: import('@playwright/test').Page) {
  await page.goto('/')
  // Click the navigation item labelled "Books" to switch to the books view.
  // Playwright auto-waits for the element to be visible and enabled before clicking.
  await page.locator('.nav-item', { hasText: 'Books' }).click()
}

test.describe('Book List Display Tests', () => {
  // -------------------------------------------------------------------------
  // Test 1: Basic book list visibility
  // -------------------------------------------------------------------------
  test('should display list of books on Books page', async ({ page }) => {
    // Navigate to the app root, then activate the Books view via the nav item.
    await goToBooksPage(page)

    // The .book-grid becomes visible only after the /books API call resolves
    // and the BookList component renders. Playwright's toBeVisible() includes
    // an implicit retry loop, so we don't need an explicit waitForSelector call.
    await expect(page.locator('.book-grid')).toBeVisible()

    // Assert at least one book card was rendered inside the grid.
    // This confirms the API returned data and the component mapped it to cards.
    const firstCard = page.locator('.book-card').first()
    await expect(firstCard).toBeVisible()

    // Verify the first card has all three mandatory display fields.
    // Using .locator() on a scoped element keeps selectors relative to the card.
    await expect(firstCard.locator('.book-title')).toBeVisible()
    await expect(firstCard.locator('.book-author')).toBeVisible()
    await expect(firstCard.locator('.book-price')).toBeVisible()
  })

  // -------------------------------------------------------------------------
  // Test 2: Book card contains meaningful content
  // -------------------------------------------------------------------------
  test('should display book details on card', async ({ page }) => {
    // Navigate to the Books page using the shared helper.
    await goToBooksPage(page)

    // Wait for the book grid to be present so cards are fully rendered
    // before we start reading their content.
    await expect(page.locator('.book-grid')).toBeVisible()

    // Scope all subsequent assertions to the first book card so we test
    // a single, coherent unit of data rather than mixing fields across cards.
    const firstCard = page.locator('.book-card').first()

    // Assert the title element has non-empty text content.
    // toHaveText with a non-empty regex ensures the element is not blank.
    const titleText = await firstCard.locator('.book-title').textContent()
    expect(titleText?.trim().length).toBeGreaterThan(0)

    // Assert the author element has non-empty text content.
    const authorText = await firstCard.locator('.book-author').textContent()
    expect(authorText?.trim().length).toBeGreaterThan(0)

    // Assert price text matches the expected currency format $XX.XX.
    // Using a regex locator lets Playwright validate the text in one assertion
    // without a separate textContent() call.
    const priceText = await firstCard.locator('.book-price').textContent()
    expect(priceText).toMatch(/\$\d+\.\d{2}/)
  })

  // -------------------------------------------------------------------------
  // Test 3: Correct number of books is rendered
  // -------------------------------------------------------------------------
  test('should show correct number of books', async ({ page }) => {
    // Navigate to the Books page using the shared helper.
    await goToBooksPage(page)

    // Wait for the loading phase to complete. The .book-grid appearing means
    // the spinner has been replaced by actual content.
    await expect(page.locator('.book-grid')).toBeVisible()

    // count() returns the total number of elements matching the locator.
    // Playwright resolves the locator before counting, but does NOT
    // automatically retry for a minimum count — the toBeVisible() above
    // ensures rendering is complete first.
    const bookCount = await page.locator('.book-card').count()

    // Log the count so it appears in the Playwright test report for debugging.
    console.log(`Number of books rendered: ${bookCount}`)

    // The library must contain at least one book for this test to be meaningful.
    expect(bookCount).toBeGreaterThan(0)
  })
})
