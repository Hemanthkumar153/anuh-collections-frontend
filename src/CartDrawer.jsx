import './CartDrawer.css'

const formatPrice = (price) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number(price) || 0)

function CartDrawer({
  cart,
  isGuest,
  message,
  onClose,
  onChangeQuantity,
  onRemove,
  onCheckout,
}) {
  return (
    <div className="cart-backdrop" onMouseDown={onClose}>
      <aside
        className="cart-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="cart-header">
          <div>
            <p className="cart-eyebrow">YOUR ANUH EDIT</p>
            <h2 id="cart-title">Your bag ({cart.totalQuantity || 0})</h2>
          </div>
          <button type="button" className="cart-close" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="cart-items">
          {cart.items.length === 0 ? (
            <div className="cart-empty">
              <span>✦</span>
              <h3>Your bag is waiting</h3>
              <p>Find a handmade piece to make it yours.</p>
            </div>
          ) : (
            cart.items.map((item) => (
              <article className="cart-item" key={item.productId}>
                <div className="cart-item-art">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt="" />
                  ) : (
                    <span>✦</span>
                  )}
                </div>

                <div className="cart-item-details">
                  <h3>{item.productName}</h3>
                  <p>{formatPrice(item.unitPrice)}</p>

                  <div className="cart-item-controls">
                    <div className="quantity-control">
                      <button
                        type="button"
                        aria-label={`Decrease ${item.productName} quantity`}
                        onClick={() =>
                          onChangeQuantity(item.productId, item.quantity - 1)
                        }
                      >
                        −
                      </button>
                      <span>{item.quantity}</span>
                      <button
                        type="button"
                        aria-label={`Increase ${item.productName} quantity`}
                        onClick={() =>
                          onChangeQuantity(item.productId, item.quantity + 1)
                        }
                      >
                        +
                      </button>
                    </div>

                    <button
                      className="remove-item"
                      type="button"
                      onClick={() => onRemove(item.productId)}
                    >
                      Remove
                    </button>
                  </div>
                </div>

                <strong className="cart-line-total">
                  {formatPrice(item.lineTotal)}
                </strong>
              </article>
            ))
          )}
        </div>

        {message && <p className="cart-message">{message}</p>}

        {cart.items.length > 0 && (
          <footer className="cart-footer">
            <div className="cart-subtotal">
              <span>Subtotal</span>
              <strong>{formatPrice(cart.subtotal)}</strong>
            </div>
            <p className="cart-shipping-note">
              Shipping and delivery details are confirmed at checkout.
            </p>
            <button className="cart-checkout" type="button" onClick={onCheckout}>
              {isGuest ? 'Sign in to checkout' : 'Continue to checkout'}
            </button>
            {isGuest && (
              <p className="guest-note">
                Your bag is saved in this browser. Sign in or create an account
                to continue.
              </p>
            )}
          </footer>
        )}
      </aside>
    </div>
  )
}

export default CartDrawer