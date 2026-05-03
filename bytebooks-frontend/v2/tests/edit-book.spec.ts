/**
 * Edit Book Tests for ByteBooks Admin Dashboard
 *
 * WHY THESE TESTS MATTER:
 * Editing book details is a core CRUD operation. If the edit form fails to
 * pre-populate existing data, loses changes on submit, or shows stale data
 * after an update, users will lose trust in the admin dashboard. These tests
 * verify the complete edit lifecycle: opening the form, seeing pre-populated
 * data, making changes, submitting, and confirming the updated data appears
 * in the book list.
 *
 * KEY ARCHITECTURAL NOTE — MODE-BASED RENDERING:
 * BookList manages a `mode` state ('list' | 'add' | 'edit'). When the user
 * clicks an "Edit" button on a BookCard, BookList sets mode to 'edit' and
 * stores the book object in `editingBook` state. This causes the entire list
 * view to be replaced by the EditBookForm component (not a modal overlay).
 * The form pre-populates its fields from the `book` prop using useState
 * initialisers. On successful PUT /books/{id}, the onBookUpdated callback
 * triggers fetchBooks() and switches mode back to 'list'.
 *
 * ALERT-BASED FEEDBACK:
 * EditBookForm uses alert() for both success ("Book updated successfully!")
 * and validation errors ("Please fill in all required fields."). Playwright's
 * page.on('dialog') captures these so the test can assert on the message text.
 *
 * PLAYWRIGHT FEATURES USED:
 * - page.on('dialog'):  Intercepts alert/confirm dialogs.
 * - page.fill():       Clears and sets input values, triggering React onChange.
 * - page.inputValue(): Reads the current value of an input to verify
 *   pre-population without relying on textContent (which doesn't work for
 *   input elements).
 * - expect(locator).toBeVisible(): Auto-retrying visibility assertion.
 * - waitForLoadState('networkidle'): Waits for PUT and re-fetch to complete.
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

test.describe('Edit Book Tests', () => {
  // ---------------------------------------------------------------------------
  // Test: Edit an existing book's details
  //
  // This test verifies the full edit workflow:
  //   1. Navigate to the book list.
  //   2. Click "Edit" on the first book card.
  //   3. Verify the edit form appears with pre-populated data.
  //   4. Change the title and price.
  //   5. Submit the form.
  //   6. Verify the success alert appears.
  //   7. Verify the updated data appears in the book list.
  //
  // The Edit button uses e.stopPropagation() in the BookList handler so
  // clicking it does not also open the detail modal.
  // ---------------------------------------------------------------------------
  test('should edit existing book details', async ({ page }) => {
    await goToBooksPage(page)

    // Read the title of the first book before editing so we can confirm
    // the form pre-populates correctly.
    const firstCard = page.locator('.book-card').first()
    const originalTitle = await firstCard.locator('.book-title').textContent()

    // Click the "Edit" button on the first book card. The button has class
    // .btn-edit and its click handler calls handleEdit(book, e) in BookList,
    // which sets editingBook and mode='edit'.
    await firstCard.locator('.btn-edit').click()

    // The edit form should now be visible — BookList replaces the grid with
    // EditBookForm when mode is 'edit'.
    await expect(page.locator('.edit-book-form')).toBeVisible()

    // Verify the form is pre-populated with the existing book's title.
    // We use inputValue() instead of textContent() because <input> elements
    // store their content in the value attribute, not as child text nodes.
    const prePopulatedTitle = await page.inputValue('#edit-title')
    expect(prePopulatedTitle).toBe(originalTitle?.trim())

    // Change the title to a new value. page.fill() first clears the input,
    // then types the new text and fires onChange on every keystroke.
    await page.fill('#edit-title', 'Updated Book Title')

    // Change the price. The input type="number" accepts numeric strings.
    await page.fill('#edit-price', '39.99')

    // Set up a promise to capture the success alert dialog BEFORE clicking
    // submit. page.waitForEvent('dialog') returns a promise that resolves
    // when the next dialog event fires — eliminating the race between
    // networkidle and the dialog handler that page.on('dialog') suffers from.
    const dialogPromise = page.waitForEvent('dialog')

    // Click the "Update Book" submit button to send the PUT request.
    await page.click('.btn-primary')

    // Wait for the dialog to appear and capture its message.
    const dialog = await dialogPromise
    const dialogMessage = dialog.message()

    // Set up a response listener BEFORE accepting the dialog. After
    // acceptance, onBookUpdated() triggers fetchBooks() → GET /books.
    // The listener must be registered first to avoid missing the response.
    const booksResponsePromise = page.waitForResponse(
      (resp) => resp.url().includes('/books') && resp.request().method() === 'GET'
    )
    await dialog.accept()

    // Wait for the GET /books re-fetch to complete.
    await booksResponsePromise

    // Assert the success dialog appeared.
    expect(dialogMessage).toBe('Book updated successfully!')

    // After success, BookList switches mode back to 'list' and re-fetches
    // books. The grid should be visible again with the updated data.
    await expect(page.locator('.book-grid')).toBeVisible()

    // Assert the updated title appears in the book list.
    await expect(
      page.locator('.book-card', { hasText: 'Updated Book Title' })
    ).toBeVisible()

    // Assert the updated price is shown on the card. The BookCard renders
    // price as "$XX.XX" via toFixed(2).
    const updatedCard = page.locator('.book-card', { hasText: 'Updated Book Title' })
    await expect(updatedCard.locator('.book-price')).toContainText('$39.99')
  })
})
