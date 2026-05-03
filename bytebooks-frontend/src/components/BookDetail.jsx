import "./BookDetail.css";

/**
 * BookDetail component — a modal overlay that shows the full details of a
 * single book selected by the user.
 *
 * ── How the detail modal pattern works ───────────────────────────────────────
 * The parent (BookList) holds a piece of state called `selectedBook`.
 * When the user clicks a BookCard, BookList sets selectedBook to that book
 * object, which causes a re-render. Because BookDetail is rendered
 * conditionally — `{selectedBook && <BookDetail ... />}` — it only appears in
 * the DOM when selectedBook is a truthy value. Calling onClose resets
 * selectedBook to null in the parent, which removes BookDetail from the DOM.
 * This "conditional rendering based on state" pattern keeps the modal logic
 * entirely in React without any direct DOM manipulation.
 *
 * ── Why selectedBook and onClose are received as props ───────────────────────
 * "State is lifted up" to the nearest common ancestor that needs it. BookList
 * both owns the books array (from the API fetch) and decides which book is
 * selected. It passes the selected book data down to BookDetail via
 * selectedBook, and hands down the setter (wrapped as onClose) so BookDetail
 * can ask its parent to clear the selection without needing to own any state
 * itself. This keeps BookDetail a pure "display" component — easy to test,
 * re-use, and reason about.
 *
 * @param {Object}   props.selectedBook - The book object to display
 * @param {Function} props.onClose      - Callback that clears the selection
 */
function BookDetail({ selectedBook, onClose }) {
  return (
    /*
     * Overlay div covers the entire viewport with a semi-transparent dark
     * background. Clicking it triggers onClose so the user can dismiss the
     * modal by clicking outside the card — the same convention used by most
     * modal dialogs on the web.
     */
    <div className="book-detail-overlay" onClick={onClose}>
      {/*
       * Why e.stopPropagation()?
       * Click events bubble up the DOM tree. Without stopPropagation, a click
       * anywhere inside the card would bubble up to the overlay div and fire
       * onClose — immediately closing the modal the user just tried to
       * interact with. Calling e.stopPropagation() stops the event from
       * travelling further up the tree, so only clicks on the bare overlay
       * (outside the card) reach the onClose handler.
       */}
      <div className="book-detail-card" onClick={(e) => e.stopPropagation()}>
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <h2 className="detail-title">{selectedBook.title}</h2>

        {/*
         * Optional chaining (?.) safely reads selectedBook.author.name even
         * when author is null or undefined, falling back to "Unknown Author"
         * — the same defensive pattern used in BookCard.
         */}
        <p className="detail-author">
          by {selectedBook.author?.name || "Unknown Author"}
        </p>

        {/* ── Metadata grid ───────────────────────────────────────────────── */}
        <div className="detail-info">
          <div className="detail-row">
            <span className="detail-label">Price</span>
            {/*
             * toFixed(2) ensures the price always renders with two decimal
             * places: "$10" becomes "$10.00", "$9.9" becomes "$9.90".
             */}
            <span className="detail-value detail-price">
              ${selectedBook.price.toFixed(2)}
            </span>
          </div>

          {selectedBook.genre && (
            <div className="detail-row">
              <span className="detail-label">Genre</span>
              <span className="detail-value">
                <span className="detail-genre-badge">{selectedBook.genre}</span>
              </span>
            </div>
          )}

          {selectedBook.isbn && (
            <div className="detail-row">
              <span className="detail-label">ISBN</span>
              <span className="detail-value detail-isbn">
                {selectedBook.isbn}
              </span>
            </div>
          )}

          {/*
           * Stock is rendered only when the field is present on the object.
           * A value of 0 is still truthy enough to be worth showing ("Out of
           * stock"), so we check for `!= null` rather than a plain truthy
           * check, which would hide a legitimate zero stock value.
           */}
          {selectedBook.stock != null && (
            <div className="detail-row">
              <span className="detail-label">Stock</span>
              <span
                className={`detail-value ${
                  selectedBook.stock === 0 ? "detail-out-of-stock" : ""
                }`}
              >
                {selectedBook.stock === 0
                  ? "Out of stock"
                  : `${selectedBook.stock} available`}
              </span>
            </div>
          )}
        </div>

        {/* ── Close button ────────────────────────────────────────────────── */}
        <button className="detail-close-btn" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

export default BookDetail;
