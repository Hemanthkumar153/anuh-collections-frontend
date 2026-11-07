import './WishlistDrawer.css'

const formatPrice = (price) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number(price) || 0)

function WishlistDrawer({ items, message, onClose, onRemove, onMoveToBag }) {
  return (
    <div className="wishlist-backdrop" onMouseDown={onClose}>
      <aside
        className="wishlist-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wishlist-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="wishlist-header">
          <div>
            <p className="wishlist-eyebrow">YOUR SAVED PIECES</p>
            <h2 id="wishlist-title">Wishlist ({items.length})</h2>
          </div>
          <button
            className="wishlist-close"
            type="button"
            onClick={onClose}
            aria-label="Close wishlist"
          >
            ×
          </button>
        </header>

        <div className="wishlist-items">
          {items.length === 0 ? (
            <div className="wishlist-empty">
              <span>♡</span>
              <h3>Save something lovely</h3>
              <p>Tap the heart on a product to keep it here.</p>
            </div>
          ) : (
            items.map((item) => (
              <article className="wishlist-item" key={item.productId}>
                <div className="wishlist-item-image">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt="" />
                  ) : (
                    <span>♡</span>
                  )}
                </div>

                <div className="wishlist-item-info">
                  <h3>{item.productName}</h3>
                  <p>{formatPrice(item.price)}</p>
                  <span
                    className={
                      item.available
                        ? 'wishlist-availability available'
                        : 'wishlist-availability'
                    }
                  >
                    {item.available ? 'Available' : 'Currently unavailable'}
                  </span>

                  <div className="wishlist-actions">
                    <button
                      className="wishlist-add"
                      type="button"
                      disabled={!item.available}
                      onClick={() => onMoveToBag(item)}
                    >
                      Add to bag
                    </button>
                    <button
                      className="wishlist-remove"
                      type="button"
                      onClick={() => onRemove(item.productId)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>

        {message && <p className="wishlist-message">{message}</p>}
      </aside>
    </div>
  )
}

export default WishlistDrawer