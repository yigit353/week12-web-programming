# ByteBooks E2E Tests — v2

## Overview
Playwright end-to-end tests for the ByteBooks frontend application. **v2** extends the Session 1 test suite with form interaction tests, CRUD operation tests, visual regression tests, and an auto-generated author page test.

## Prerequisites
- Node.js installed
- Playwright installed (`npm install -D @playwright/test`)
- Playwright browsers installed (`npx playwright install`)
- Backend API running on port 8000 (`cd bytebooks-api && uvicorn main:app --port 8000`)
- Frontend dev server running on port 5173 (`cd bytebooks-frontend && npm run dev`)

## Running Tests

### Run all tests (Session 1 + Session 2)
```bash
npx playwright test --config v2/playwright.config.ts
```

### Run in headed mode (see the browser)
```bash
npx playwright test --config v2/playwright.config.ts --headed
```

### Run a specific test file
```bash
npx playwright test --config v2/playwright.config.ts v2/tests/form-interactions.spec.ts
```

### Open Playwright Test UI
```bash
npx playwright test --config v2/playwright.config.ts --ui
```

### Debug a test
```bash
npx playwright test --config v2/playwright.config.ts --debug
```

### Generate HTML report
```bash
npx playwright show-report
```

## Visual Regression Tests

### How they work
Visual regression tests capture screenshots and compare them against saved baseline images. On the **first run**, Playwright creates baseline screenshots in `tests/visual-regression.spec.ts-snapshots/`. On subsequent runs, new screenshots are compared pixel-by-pixel against these baselines. If the UI changes beyond the configured threshold, the test fails.

### Updating baseline screenshots
When you intentionally change the UI (new feature, redesign, theme change), the visual tests will fail because the screenshots no longer match. Regenerate the baselines with:

```bash
npx playwright test --config v2/playwright.config.ts --update-snapshots
```

Or use the npm script:
```bash
npm run test:update-snapshots
```

### When to update baselines
- **DO update** after intentional UI changes (new feature, redesign, colour scheme change)
- **DO update** when switching operating systems or font rendering changes
- **DO NOT update** to hide actual bugs — investigate the visual diff first

### Configuration
Visual comparison settings in `playwright.config.ts`:
- `threshold: 0.2` — 20% per-pixel colour tolerance (absorbs anti-aliasing differences)
- `maxDiffPixels: 100` — up to 100 pixels may differ (handles font rendering variance)

## Debugging with Trace Viewer

### Enable tracing on a test run
```bash
npx playwright test --config v2/playwright.config.ts --trace on
```

### View the trace after a failure
```bash
npx playwright show-trace trace.zip
```

### Trace viewer features
- **Step-by-step playback**: See each action (click, fill, navigate) in sequence
- **Screenshots at each step**: Visual timeline of what the page looked like
- **Network requests**: Every fetch/XHR call with request/response bodies
- **Console logs**: All console.log, console.error output during the test
- **DOM snapshots**: Inspect the DOM tree at any point during the test

### Best practices for tracing
- The default config already captures traces on first retry (`trace: 'on-first-retry'`)
- Use `--trace on` when actively debugging to capture traces on every run
- Traces are stored as `.zip` files — they can be shared with team members

## Test Files

### Session 1 (v1) — Core Functionality
| File | Description |
|------|-------------|
| `navigation.spec.ts` | Tests sidebar navigation between Dashboard, Books, and Authors pages |
| `book-list.spec.ts` | Tests that books load and display correctly with title, author, price |
| `search-filter.spec.ts` | Tests search input filtering and clearing of search results |
| `book-interactions.spec.ts` | Tests clicking book cards to open detail modal and closing it |

### Session 2 (v2) — CRUD & Visual Regression
| File | Description |
|------|-------------|
| `form-interactions.spec.ts` | Tests adding a new book via the form, empty form validation, and invalid price validation |
| `edit-book.spec.ts` | Tests editing an existing book's title and price, verifying pre-populated form data |
| `delete-book.spec.ts` | Tests deleting a book with confirmation and cancelling a delete operation |
| `visual-regression.spec.ts` | Screenshot tests for Dashboard, Books list, Add Book form, Book detail modal, and individual book cards |
| `author-page.spec.ts` | Tests that the Authors page displays author names, book counts, and IDs (generated with Claude Code) |

## Configuration
The Playwright config (`v2/playwright.config.ts`) includes:
- Base URL: http://localhost:5173
- Browsers: Chromium, Firefox, WebKit
- Timeout: 30 seconds per test
- Screenshots: Captured on failure
- Video: Recorded on first retry
- Traces: Captured on first retry
- Visual comparison: 20% threshold, 100 max diff pixels

## Best Practices: Visual Tests vs Functional Tests

| Use visual tests when... | Use functional tests when... |
|--------------------------|------------------------------|
| Verifying overall page layout | Checking specific text content |
| Catching CSS regressions | Testing user interaction flows |
| Detecting unintended style changes | Validating form submissions |
| Ensuring responsive design consistency | Verifying API integration |
| Checking component spacing and alignment | Testing error handling paths |

**Rule of thumb**: Functional tests answer "does it work?" — visual tests answer "does it look right?"

## Troubleshooting
- If tests fail to connect, ensure both backend (port 8000) and frontend (port 5173) servers are running
- If elements aren't found, the app may still be loading data from the API — check that the backend is responding
- If visual tests fail on a new machine, regenerate baselines with `--update-snapshots`
- Run with `--debug` to step through tests interactively
- Run with `--trace on` to capture detailed traces for post-mortem analysis
