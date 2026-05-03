# ByteBooks E2E Tests

## Overview
These are Playwright end-to-end tests for the ByteBooks frontend application, testing navigation, book list display, search/filter functionality, and book interactions.

## Prerequisites
- Node.js installed
- Playwright installed (`npm install -D @playwright/test`)
- Playwright browsers installed (`npx playwright install`)
- Backend API running on port 8000 (`cd bytebooks-api && uvicorn main:app --port 8000`)
- Frontend dev server running on port 5173 (`cd bytebooks-frontend && npm run dev`)

## Running Tests

### Run all tests
```bash
npx playwright test --config v1/playwright.config.ts
```

### Run in headed mode (see the browser)
```bash
npx playwright test --config v1/playwright.config.ts --headed
```

### Run a specific test file
```bash
npx playwright test --config v1/playwright.config.ts v1/tests/navigation.spec.ts
```

### Open Playwright Test UI
```bash
npx playwright test --config v1/playwright.config.ts --ui
```

### Debug a test
```bash
npx playwright test --config v1/playwright.config.ts --debug
```

### Generate HTML report
```bash
npx playwright show-report
```

## Test Files

| File | Description |
|------|-------------|
| `navigation.spec.ts` | Tests sidebar navigation between Dashboard, Books, and Authors pages |
| `book-list.spec.ts` | Tests that books load and display correctly with title, author, price |
| `search-filter.spec.ts` | Tests search input filtering and clearing of search results |
| `book-interactions.spec.ts` | Tests clicking book cards to open detail modal and closing it |

## Configuration
The Playwright config (`v1/playwright.config.ts`) includes:
- Base URL: http://localhost:5173
- Browsers: Chromium, Firefox, WebKit
- Timeout: 30 seconds per test
- Screenshots: Captured on failure
- Video: Recorded on first retry
- Traces: Captured on first retry

## Troubleshooting
- If tests fail to connect, ensure both backend (port 8000) and frontend (port 5173) servers are running
- If elements aren't found, the app may still be loading data from the API - check that the backend is responding
- Run with `--debug` to step through tests interactively
