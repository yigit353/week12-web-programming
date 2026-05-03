/**
 * Navigation Tests for ByteBooks Admin Dashboard
 *
 * Why navigation tests matter:
 * ─────────────────────────────────────────────────────────────────────────────
 * Navigation is the spine of any multi-page application. If a user cannot
 * reach a section, every feature inside that section is effectively broken —
 * regardless of how well those features work in isolation. These tests act as
 * a smoke-test gate: before trusting that Books CRUD or Author listings work,
 * we first confirm the user can actually land on those pages.
 *
 * Key Playwright features used in this file:
 * ─────────────────────────────────────────────────────────────────────────────
 * • page.goto()          – Navigates the browser to a URL. Resolves when the
 *                          browser fires the "load" event.
 * • page.waitForLoadState('networkidle') – Waits until there are no more than
 *                          2 active network connections for 500 ms. This ensures
 *                          async API fetches triggered by the page mount have
 *                          settled before we start asserting.
 * • page.locator()       – Returns a Locator object for a CSS selector. Locators
 *                          are *lazy*: they don't touch the DOM until you call an
 *                          action (click, etc.) or assertion on them.
 * • locator.filter()     – Narrows a locator to elements that also match another
 *                          selector or contain specific text. Used here to pick
 *                          the exact nav item out of the three `.nav-item` nodes.
 * • locator.click()      – Clicks the matching element. Playwright auto-waits for
 *                          the element to be visible and stable before clicking.
 * • expect(locator).toBeVisible() – Asserts the element is in the DOM and
 *                          visible to the user. Auto-waits up to the configured
 *                          timeout (30 s) for the condition to become true.
 * • expect(locator).toHaveClass() – Asserts the element's class list contains
 *                          the given string, used to verify the active nav state.
 *
 * Architecture note — state-based routing:
 * ─────────────────────────────────────────────────────────────────────────────
 * ByteBooks does NOT use React Router. Navigation is driven by an `activePage`
 * React state value in App.jsx. Clicking a `.nav-item` calls `setActivePage()`
 * which causes a conditional re-render — the URL never changes. All tests
 * therefore start at the base URL '/' and drive navigation through clicks, not
 * URL changes.
 */

import { test, expect } from '@playwright/test'

test.describe('Navigation Tests', () => {
  // ── Test 1 ─────────────────────────────────────────────────────────────────
  // Verifies the initial page load: the browser should render the dashboard
  // layout with the ByteBooks branding and the default Dashboard content.
  // This is the most fundamental check — if the app does not mount at all,
  // every subsequent test is meaningless.
  test('should load the homepage and display ByteBooks title', async ({ page }) => {
    // Navigate to the root URL and wait for all network activity to settle.
    // 'networkidle' is important here because Dashboard.jsx triggers two
    // parallel fetch() calls on mount (/books and /authors). We want those
    // to complete before we start asserting on rendered content.
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // The sidebar logo always reads "ByteBooks Admin" and is present on every
    // page. Asserting its visibility confirms that the React app has mounted
    // and the DashboardLayout rendered successfully.
    await expect(page.locator('.sidebar-logo')).toBeVisible()
    await expect(page.locator('.sidebar-logo')).toContainText('ByteBooks')

    // The header title reflects the active page. On first load the default
    // activePage is 'dashboard', so the header should read "Dashboard".
    await expect(page.locator('.header-title')).toHaveText('Dashboard')

    // Confirm the Dashboard content area is visible. `.stat-card` elements are
    // rendered by Dashboard.jsx once the API data has loaded. Their presence
    // proves the full render pipeline (mount → fetch → state update → render)
    // completed successfully.
    await expect(page.locator('.stat-card').first()).toBeVisible()
  })

  // ── Test 2 ─────────────────────────────────────────────────────────────────
  // Verifies that clicking the "Books" nav item switches the rendered content
  // to the Books page. Because there is no URL change, we assert on DOM
  // content rather than the browser address bar.
  test('should navigate to Books page from navigation menu', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Locate the specific nav item by combining the CSS class with a text
    // filter. Without .filter({ hasText: 'Books' }) we would match all three
    // `.nav-item` elements. The filter narrows it to the single "Books" entry.
    const booksNavItem = page.locator('.nav-item').filter({ hasText: 'Books' })
    await booksNavItem.click()

    // After the click, setActivePage('books') fires in React. The app
    // conditionally renders <BooksPage /> which in turn renders <BookList />.
    // BookList fetches /books and, once loaded, renders a `.book-grid`.
    // waitForLoadState ensures the fetch has completed before we assert.
    await page.waitForLoadState('networkidle')

    // The header title should now reflect the Books page.
    await expect(page.locator('.header-title')).toHaveText('Books')

    // The active nav item should have the 'active' CSS class applied by
    // DashboardLayout's conditional className logic.
    await expect(booksNavItem).toHaveClass(/active/)

    // The BookList renders a `.book-grid` once books are loaded. Its presence
    // confirms that BooksPage mounted and BookList completed its data fetch.
    await expect(page.locator('.book-grid')).toBeVisible()
  })

  // ── Test 3 ─────────────────────────────────────────────────────────────────
  // Verifies that clicking the "Authors" nav item renders the Authors page.
  // AuthorsPage.jsx fetches /authors and /books then renders an `.authors-grid`.
  test('should navigate to Authors page from navigation menu', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const authorsNavItem = page.locator('.nav-item').filter({ hasText: 'Authors' })
    await authorsNavItem.click()

    // Wait for the two API calls made by AuthorsPage (GET /authors, GET /books)
    // to complete before asserting on the rendered author cards.
    await page.waitForLoadState('networkidle')

    // Header and active-class checks mirror the same pattern as Test 2,
    // providing consistent, easy-to-debug failure messages.
    await expect(page.locator('.header-title')).toHaveText('Authors')
    await expect(authorsNavItem).toHaveClass(/active/)

    // `.authors-grid` is the top-level container rendered by AuthorsPage.jsx
    // once authors have loaded. Its visibility confirms the full render cycle.
    await expect(page.locator('.authors-grid')).toBeVisible()
  })

  // ── Test 4 ─────────────────────────────────────────────────────────────────
  // Verifies round-trip navigation: Books → Dashboard. This catches regression
  // scenarios where navigating away from a page leaves behind stale state or
  // DOM nodes that prevent a prior page from re-mounting cleanly.
  test('should navigate back to Dashboard from Books page', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Step 1 — Go to Books.
    await page.locator('.nav-item').filter({ hasText: 'Books' }).click()
    await page.waitForLoadState('networkidle')

    // Quick sanity-check: confirm we actually reached the Books page before
    // testing the return journey. This makes failures easier to attribute.
    await expect(page.locator('.book-grid')).toBeVisible()

    // Step 2 — Navigate back to Dashboard.
    const dashboardNavItem = page.locator('.nav-item').filter({ hasText: 'Dashboard' })
    await dashboardNavItem.click()
    await page.waitForLoadState('networkidle')

    // The header should revert to "Dashboard".
    await expect(page.locator('.header-title')).toHaveText('Dashboard')

    // The Dashboard nav item should now hold the active class.
    await expect(dashboardNavItem).toHaveClass(/active/)

    // Dashboard content must be visible again. We check for both `.stat-card`
    // (the statistics grid) and `.data-table` (the books table) to confirm
    // that Dashboard re-mounted and its data fetches completed successfully.
    await expect(page.locator('.stat-card').first()).toBeVisible()
    await expect(page.locator('.data-table')).toBeVisible()
  })
})
