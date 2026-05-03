/**
 * Playwright Global Setup — Reset Database Before Tests
 *
 * This script runs once before all test files. It sends a POST request to
 * the backend's /reset-db endpoint, which drops all rows and re-seeds the
 * database with the original sample data (4 authors, 6 books).
 *
 * This ensures every test run starts from a known, clean state — regardless
 * of what previous runs may have created, deleted, or modified.
 */

import type { FullConfig } from '@playwright/test'

async function globalSetup(_config: FullConfig) {
  const response = await fetch('http://localhost:8000/reset-db', {
    method: 'POST',
  })

  if (!response.ok) {
    throw new Error(
      `Failed to reset database: ${response.status} ${response.statusText}`
    )
  }

  console.log('Database reset to initial seed state')
}

export default globalSetup
