import { useEffect, useState } from 'react'
import './OrderHistoryDrawer.css'

const formatPrice = (price) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number(price) || 0)

function readableStatus(value = '') {
  return value
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function formatDate(value) {
  if (!value) return 'Date unavailable'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Date unavailable'

  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function OrderHistoryDrawer({ onClose }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadOrders() {
      try {
        const response = await fetch('/api/v1/orders', {
          credentials: 'include',
        })

        let result = []
        try {
          result = await response.json()
        } catch {
          result = []
        }

        if (!response.ok) {
          throw new Error(
            result.detail || result.message || 'Could not load your orders.',
          )
        }

        if (!cancelled) setOrders(Array.isArray(result) ? result : [])
      } catch (requestError) {
        if (!cancelled) setError(requestError.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadOrders()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="orders-backdrop" onMouseDown={onClose}>
      <aside
        className="orders-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="orders-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="orders-header">
          <div>
            <p className="orders-eyebrow">YOUR ANUH ACCOUNT</p>
            <h2 id="orders-title">My orders</h2>
          </div>
          <button
            className="orders-close"
            type="button"
            onClick={onClose}
            aria-label="Close orders"
          >
            ×
          </button>
        </header>

        <div className="orders-content">
          {loading && (
            <p className="orders-status">Loading your order history…</p>
          )}

          {!loading && error && (
            <p className="orders-status orders-error">{error}</p>
          )}

          {!loading && !error && orders.length === 0 && (
            <div className="orders-empty">
              <span>✦</span>
              <h3>No orders yet</h3>
              <p>Your confirmed purchases will appear here.</p>
            </div>
          )}

          {!loading && !error && orders.length > 0 && (
            <div className="orders-list">
              {orders.map((order) => {
                const hasTracking = Boolean(
                  order.shippingCarrier || order.trackingNumber,
                )

                return (
                  <article className="order-card" key={order.id}>
                    <div className="order-card-header">
                      <div>
                        <p className="order-label">ORDER NUMBER</p>
                        <strong>{order.orderNumber}</strong>
                      </div>
                      <strong className="order-total">
                        {formatPrice(order.total)}
                      </strong>
                    </div>

                    <div className="order-badges">
                      <span className={`order-badge status-${order.status?.toLowerCase()}`}>
                        {readableStatus(order.status)}
                      </span>
                      <span className={`order-badge payment-${order.paymentStatus?.toLowerCase()}`}>
                        {readableStatus(order.paymentStatus)}
                      </span>
                    </div>

                    <p className="order-date">{formatDate(order.createdAt)}</p>

                    <div className="order-lines">
                      {(order.items || []).map((item, index) => (
                        <div
                          className="order-line"
                          key={`${order.id}-${item.productId ?? item.sku}-${index}`}
                        >
                          <div>
                            <strong>{item.productName}</strong>
                            <span>Qty {item.quantity}</span>
                          </div>
                          <span>{formatPrice(item.lineTotal)}</span>
                        </div>
                      ))}
                    </div>

                    {order.shippingAddress && (
                      <div className="order-address">
                        <p className="order-label">DELIVERING TO</p>
                        <p>
                          {order.shippingAddress.fullName}
                          <br />
                          {order.shippingAddress.addressLine1}
                          {order.shippingAddress.addressLine2
                            ? `, ${order.shippingAddress.addressLine2}`
                            : ''}
                          <br />
                          {order.shippingAddress.city},{' '}
                          {order.shippingAddress.state}{' '}
                          {order.shippingAddress.postalCode}
                        </p>
                      </div>
                    )}

                    {hasTracking ? (
                      <div className="order-tracking">
                        <p className="order-label">SHIPMENT TRACKING</p>
                        {order.shippingCarrier && (
                          <p>
                            <strong>Courier:</strong> {order.shippingCarrier}
                          </p>
                        )}
                        {order.trackingNumber && (
                          <p>
                            <strong>Tracking number:</strong>{' '}
                            {order.trackingNumber}
                          </p>
                        )}
                        {order.trackingUrl && (
                          <a
                            href={order.trackingUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Track your parcel
                          </a>
                        )}
                      </div>
                    ) : order.status === 'SHIPPED' ||
                      order.status === 'DELIVERED' ? (
                      <div className="order-tracking order-tracking-pending">
                        <p className="order-label">SHIPMENT TRACKING</p>
                        <p>
                          Tracking details are not available yet. Please check
                          again later.
                        </p>
                      </div>
                    ) : null}

                    <div className="order-payment">
                      <span>
                        {order.paymentMethod === 'COD'
                          ? 'Cash on delivery'
                          : 'Online payment'}
                      </span>
                      {order.gatewayPaymentMethod && (
                        <span>
                          Paid via {readableStatus(order.gatewayPaymentMethod)}
                        </span>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}

export default OrderHistoryDrawer