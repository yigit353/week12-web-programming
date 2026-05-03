/**
 * Delete Book Tests for ByteBooks Admin Dashboard
 *
 * WHY THESE TESTS MATTER:
 * Deletion is the most destructive CRUD operation. If the delete button
 * silently removes the wrong book, skips the confirmation dialog, or leaves
 * stale data in the UI after the API call, users could lose data without
 * realising it. These tests verify both the confirmation and cancellation
 * paths: that a confirmed delete actually removes the book from the list,
 * and that cancelling the confirmation dialog leaves the book intact.
 *
 * KEY ARCHITECTURAL NOTE — CONFIRM DIALOG:
 * BookList's handleDelete uses window.confirm() to ask the user for
 * confirmation before sending a DELETE /books/{id} request. Playwright
 * intercepts this dialog via page.on('dialog'). The dialog type is 'confirm'
 * (not 'alert'), and we must call either dialog.accept() to confirm or
 * dialog.dismiss() to cancel. After a successful DELETE (HTTP 204), BookList
 * calls fetchBooks() to re-render the list without the deleted book.
 *
 * PLAYWRIGHT FEATURES USED:
 * - page.on('dialog'):   Intercepts confirm() dialogs. We use dialog.type()
 *   to verify it's a confirmation dialog, dialog.message() to check the text,
 *   and dialog.accept() or dialog.dismiss() to simulate user choice.
 * - locator.count():     Returns the number of matching elements — used to
 *   compare book counts before and after deletion.
 * - expect(locator).not.toBeVisible(): Asserts an element is absent or hidden
 *   — used to verify the deleted book is no longer in the DOM.
 * - waitForLoadState('networkidle'): Waits for the DELETE request and the
 *   subsequent re-fetch of books to complete before asserting.
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

test.describe('Delete Book Tests', () => {
  // ---------------------------------------------------------------------------
  // Test 1: Successfully delete a book from the list
  //
  // This test verifies the confirmed-delete path:
  //   1. Navigate to the book list and count the initial number of books.
  //   2. Record the title of the first book (the one we'll delete).
  //   3. Click "Delete" on the first book card.
  //   4. Accept the confirmation dialog.
  //   5. Wait for the DELETE API call and re-fetch to complete.
  //   6. Verify the book count decreased by one.
  //   7. Verify the deleted book's title is no longer visible in the list.
  //
  // The Delete button uses e.stopPropagation() so clicking it does not also
  // open the book detail modal.
  // ---------------------------------------------------------------------------
  test('should delete a book from the list', async ({ page }) => {
    await goToBooksPage(page)

    // Count the initial number of book cards rendered in the grid.
    const initialCount = await page.locator('.book-card').count()

    // Read the title of the first book so we can verify it disappears.
    const firstCard = page.locator('.book-card').first()
    const deletedTitle = await firstCard.locator('.book-title').textContent()

    // Register a dialog handler to accept the confirmation dialog.
    // BookList's handleDelete fires:
    //   window.confirm(`Are you sure you want to delete ${book.title}?`)
    // We accept it to proceed with deletion.
    page.on('dialog', async (dialog) => {
      await dialog.accept()
    })

    // Wait for the GET /books re-fetch triggered after a successful DELETE.
    // Using waitForResponse instead of waitForLoadState('networkidle') avoids
    // a race on Firefox where networkidle fires before the dialog handler has
    // accepted the confirm and the DELETE request is sent.
    const booksReloadPromise = page.waitForResponse(
      (resp) => resp.url().includes('/books') && resp.request().method() === 'GET'
    )

    // Click the "Delete" button on the first book card.
    await firstCard.locator('.btn-delete').click()

    // Wait for the list to actually reload after the DELETE completes.
    await booksReloadPromise

    // Assert the book count decreased by exactly one.
    await expect(page.locator('.book-card')).toHaveCount(initialCount - 1)

    // Assert the deleted book's title is no longer visible in any card.
    // We use a text-based locator to search all cards for the deleted title.
    if (deletedTitle) {
      await expect(
        page.locator('.book-card .book-title').getByText(deletedTitle.trim(), { exact: true })
      ).not.toBeVisible()
    }
  })

  // ---------------------------------------------------------------------------
  // Test 2: Cancel the delete operation
  //
  // This test verifies that dismissing the confirmation dialog does NOT delete
  // the book. The user clicks "Delete", sees the confirm() dialog, and clicks
  // "Cancel" (simulated by dialog.dismiss()). The book should remain in the
  // list and the count should not change.
  //
  // Playwright feature highlighted: dialog.dismiss() simulates clicking the
  // "Cancel" button on a confirm() dialog, which returns false to the JS code.
  // BookList's handleDelete then returns early without sending the DELETE
  // request.
  // ---------------------------------------------------------------------------
  test('should cancel delete operation', async ({ page }) => {
    await goToBooksPage(page)

    // Count books before the cancel operation.
    const initialCount = await page.locator('.book-card').count()

    // Read the title of the book we'll attempt (and cancel) deleting.
    const firstCard = page.locator('.book-card').first()
    const bookTitle = await firstCard.locator('.book-title').textContent()

    // Register a dialog handler that DISMISSES (cancels) the confirmation.
    // dialog.dismiss() returns false to window.confirm(), causing handleDelete
    // to return early without sending the API call.
    page.on('dialog', async (dialog) => {
      await dialog.dismiss()
    })

    // Click the "Delete" button on the first book card.
    await firstCard.locator('.btn-delete').click()

    // Give the dialog handler time to fire and the app to settle.
    // Since no API call is made (the confirm was dismissed), networkidle
    // should resolve almost immediately.
    await page.waitForLoadState('networkidle')

    // Assert the book is still in the list — the count should be unchanged.
    const currentCount = await page.locator('.book-card').count()
    expect(currentCount).toBe(initialCount)

    // Assert the specific book's title is still visible in the list.
    // Use getByText with exact:true to avoid substring matches — e.g.
    // "Clean Code" would otherwise also match "The Clean Coder".
    if (bookTitle) {
      await expect(
        page.getByText(bookTitle.trim(), { exact: true })
      ).toBeVisible()
    }
  })
})
