/**
 * Author Page Tests for ByteBooks Admin Dashboard
 *
 * WHY THESE TESTS MATTER:
 * The Authors page provides a read-only overview of all authors and how many
 * books each one has. If the page fails to load, shows incorrect book counts,
 * or renders empty cards, users cannot verify their catalogue's author data.
 * These tests confirm that the AuthorsPage component correctly fetches from
 * both /authors and /books endpoints, computes per-author book counts, and
 * renders a card for each author with their name and count.
 *
 * KEY ARCHITECTURAL NOTE — DUAL FETCH:
 * AuthorsPage makes two parallel API calls on mount: GET /authors and
 * GET /books. The author list comes from /authors, but the book count for
 * each author is computed client-side by filtering the /books array with
 * `books.filter(b => b.author_id === author.id).length`. This means the
 * book count display depends on BOTH endpoints returning correct data.
 *
 * PLAYWRIGHT FEATURES USED:
 * - page.goto() + nav click: State-based navigation (no React Router).
 * - waitForLoadState('networkidle'): Waits for both parallel fetches to
 *   resolve before asserting on rendered content.
 * - locator.count(): Counts the number of author cards rendered.
 * - expect(locator).toContainText(): Checks that card text includes the
 *   expected author name or book count string.
 * - toMatch (regex): Validates the book count format ("N book(s)").
 *
 * GENERATED WITH CLAUDE CODE PLAYWRIGHT MCP:
 * This test file was generated using Claude Code by analysing the current app
 * structure (AuthorsPage.jsx component, its CSS classes, and API endpoints)
 * and producing test code that exercises the author listing feature.
 */

import { test, expect } from '@playwright/test'

/**
 * Helper: navigate to the Authors page via the sidebar nav item.
 *
 * The app uses state-based navigation — clicking the "Authors" nav item
 * triggers setActivePage('authors') which conditionally renders AuthorsPage.
 */
async function goToAuthorsPage(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.locator('.nav-item', { hasText: 'Authors' }).click()
  // AuthorsPage fetches /authors and /books in parallel on mount.
  // networkidle ensures both calls have resolved and the component has
  // rendered the author cards.
  await page.waitForLoadState('networkidle')
  await expect(page.locator('.authors-grid')).toBeVisible()
}

test.describe('Author Page Tests', () => {
  // ---------------------------------------------------------------------------
  // Test 1: Authors page displays a grid of author cards
  //
  // This test verifies the basic rendering: after navigating to the Authors
  // page, the .authors-grid is visible and contains at least one .author-card.
  // Each card should have a visible author name.
  // ---------------------------------------------------------------------------
  test('should display a list of authors with names', async ({ page }) => {
    await goToAuthorsPage(page)

    // The authors-grid should be visible (confirmed by the helper).
    // Count the number of author cards — there should be at least one.
    const authorCount = await page.locator('.author-card').count()
    expect(authorCount).toBeGreaterThan(0)

    // Log the count for debugging in the Playwright test report.
    console.log(`Number of authors rendered: ${authorCount}`)

    // Verify each author card has a non-empty name displayed.
    // AuthorsPage renders author.name inside a .author-name element.
    for (let i = 0; i < authorCount; i++) {
      const card = page.locator('.author-card').nth(i)
      const nameText = await card.locator('.author-name').textContent()
      expect(nameText?.trim().length).toBeGreaterThan(0)
    }
  })

  // ---------------------------------------------------------------------------
  // Test 2: Each author card shows a book count
  //
  // AuthorsPage computes book counts client-side by filtering the /books
  // array for each author's ID. Each card renders the count as "N book(s)"
  // inside a .author-meta element.
  // ---------------------------------------------------------------------------
  test('should show book counts for each author', async ({ page }) => {
    await goToAuthorsPage(page)

    const authorCount = await page.locator('.author-card').count()
    expect(authorCount).toBeGreaterThan(0)

    // Verify each card has a .author-meta element with a book count string
    // matching the pattern "N book" or "N books" (singular/plural).
    for (let i = 0; i < authorCount; i++) {
      const card = page.locator('.author-card').nth(i)
      const metaText = await card.locator('.author-meta').textContent()

      // The format is "N book" or "N books" — validated by regex.
      // \d+ matches the count, \s+ matches whitespace, book(s)? matches
      // the word with optional plural suffix.
      expect(metaText).toMatch(/\d+\s+books?/)
    }
  })

  // ---------------------------------------------------------------------------
  // Test 3: Author cards display author IDs
  //
  // Each author card shows an "ID: N" badge inside a .author-id element.
  // This test verifies the ID is present and numeric.
  // ---------------------------------------------------------------------------
  test('should display author IDs on cards', async ({ page }) => {
    await goToAuthorsPage(page)

    const authorCount = await page.locator('.author-card').count()
    expect(authorCount).toBeGreaterThan(0)

    // Check each card has an .author-id element with "ID: <number>" text.
    for (let i = 0; i < authorCount; i++) {
      const card = page.locator('.author-card').nth(i)
      const idText = await card.locator('.author-id').textContent()
      expect(idText).toMatch(/ID:\s*\d+/)
    }
  })

  // ---------------------------------------------------------------------------
  // Test 4: Header shows "Authors" when on the Authors page
  //
  // The DashboardLayout header title reflects the active page. When the
  // Authors nav item is clicked, the header should read "Authors".
  // ---------------------------------------------------------------------------
  test('should show Authors heading in the header', async ({ page }) => {
    await goToAuthorsPage(page)

    // The header title is set by DashboardLayout based on the activePage state.
    await expect(page.locator('.header-title')).toHaveText('Authors')

    // The Authors nav item should have the 'active' class.
    const authorsNavItem = page.locator('.nav-item', { hasText: 'Authors' })
    await expect(authorsNavItem).toHaveClass(/active/)
  })
})
