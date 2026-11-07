import { useEffect, useState } from 'react'
import './AdminOrdersDrawer.css'

const nextStatus = {
  PLACED: 'PROCESSING',
  PROCESSING: 'SHIPPED',
  SHIPPED: 'DELIVERED',
}

const statusLabel = {
  PAYMENT_PENDING: 'Payment pending',
  PLACED: 'Placed',
  PROCESSING: 'Processing',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
}

const paymentLabel = {
  ONLINE: 'Online payment',
  COD: 'Cash on delivery',
  PENDING: 'Pending',
  PAID: 'Paid',
  FAILED: 'Failed',
  REFUND_PENDING: 'Refund pending',
  REFUNDED: 'Refunded',
}

const emptyTrackingForm = {
  shippingCarrier: '',
  trackingNumber: '',
  trackingUrl: '',
}

function formatPrice(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0)
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

async function getCsrfHeader() {
  const response = await fetch('/api/v1/auth/csrf', {
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error('Could not get a security token. Please try again.')
  }

  const csrf = await response.json()

  return {
    [csrf.headerName || 'X-CSRF-TOKEN']: csrf.token,
  }
}

async function readResponse(response) {
  try {
    return await response.json()
  } catch {
    return {}
  }
}

function AdminOrdersDrawer({ onClose }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [updatingOrderId, setUpdatingOrderId] = useState(null)
  const [trackingOrderId, setTrackingOrderId] = useState(null)
  const [trackingForm, setTrackingForm] = useState(emptyTrackingForm)

  async function loadOrders() {
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/v1/admin/orders', {
        credentials: 'include',
      })
      const result = await readResponse(response)

      if (!response.ok) {
        throw new Error(
          result.detail ||
            result.message ||
            'Could not load orders. Check that you are signed in as an admin.',
        )
      }

      setOrders(Array.isArray(result) ? result : [])
    } catch (requestError) {
      setError(requestError.message || 'Could not load orders.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadOrders()
  }, [])

  function openTrackingForm(order) {
    setError('')
    setMessage('')
    setTrackingOrderId(order.id)
    setTrackingForm({
      shippingCarrier: order.shippingCarrier || '',
      trackingNumber: order.trackingNumber || '',
      trackingUrl: order.trackingUrl || '',
    })
  }

  function closeTrackingForm() {
    setTrackingOrderId(null)
    setTrackingForm(emptyTrackingForm)
  }

  function updateTrackingField(event) {
    const { name, value } = event.target

    setTrackingForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  async function saveTrackingAndShip(event, order) {
    event.preventDefault()

    if (!trackingForm.shippingCarrier.trim()) {
      setError('Enter the courier name.')
      return
    }

    if (!trackingForm.trackingNumber.trim()) {
      setError('Enter the tracking number.')
      return
    }

    const isAlreadyShipped = order.status === 'SHIPPED'
    const actionMessage = isAlreadyShipped
      ? `Save tracking details for order ${order.orderNumber}?`
      : `Mark order ${order.orderNumber} as shipped? Only do this after handing the parcel to the courier.`

    if (!window.confirm(actionMessage)) return

    setUpdatingOrderId(order.id)
    setError('')
    setMessage('')

    try {
      const csrfHeader = await getCsrfHeader()
      const response = await fetch(
        `/api/v1/admin/orders/${order.id}/status`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...csrfHeader,
          },
          body: JSON.stringify({
            status: 'SHIPPED',
            shippingCarrier: trackingForm.shippingCarrier.trim(),
            trackingNumber: trackingForm.trackingNumber.trim(),
            trackingUrl: trackingForm.trackingUrl.trim() || null,
          }),
        },
      )

      const result = await readResponse(response)

      if (!response.ok) {
        throw new Error(
          result.detail ||
            result.message ||
            'Could not save the shipping details.',
        )
      }

      setOrders((currentOrders) =>
        currentOrders.map((item) =>
          item.id === result.id ? result : item,
        ),
      )
      setMessage(
        isAlreadyShipped
          ? `Tracking details saved for ${result.orderNumber}.`
          : `Order ${result.orderNumber} is now shipped.`,
      )
      closeTrackingForm()
    } catch (requestError) {
      setError(requestError.message || 'Could not save shipping details.')
    } finally {
      setUpdatingOrderId(null)
    }
  }

  async function advanceOrder(order) {
    const status = nextStatus[order.status]

    if (!status || status === 'SHIPPED') return

    const actionLabel = {
      PROCESSING: 'start processing',
      DELIVERED: 'mark as delivered',
    }[status]

    const confirmed = window.confirm(
      `Are you sure you want to ${actionLabel} order ${order.orderNumber}?`,
    )

    if (!confirmed) return

    setUpdatingOrderId(order.id)
    setError('')
    setMessage('')

    try {
      const csrfHeader = await getCsrfHeader()
      const response = await fetch(
        `/api/v1/admin/orders/${order.id}/status`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...csrfHeader,
          },
          body: JSON.stringify({ status }),
        },
      )
      const result = await readResponse(response)

      if (!response.ok) {
        throw new Error(
          result.detail ||
            result.message ||
            'Could not update this order status.',
        )
      }

      setOrders((currentOrders) =>
        currentOrders.map((item) =>
          item.id === result.id ? result : item,
        ),
      )
      setMessage(
        `Order ${result.orderNumber} is now ${statusLabel[result.status]}.`,
      )
    } catch (requestError) {
      setError(requestError.message || 'Could not update this order.')
    } finally {
      setUpdatingOrderId(null)
    }
  }

  return (
    <div className="admin-orders-overlay" onMouseDown={onClose}>
      <aside
        className="admin-orders-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-orders-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="admin-orders-header">
          <div>
            <p className="admin-orders-eyebrow">ANUH ADMIN</p>
            <h2 id="admin-orders-title">Manage orders</h2>
            <p>Review payments and update order fulfilment.</p>
          </div>

          <button
            className="admin-orders-close"
            type="button"
            onClick={onClose}
            aria-label="Close order management"
          >
            ×
          </button>
        </header>

        <div className="admin-orders-toolbar">
          <span>{orders.length} orders</span>
          <button
            type="button"
            onClick={loadOrders}
            disabled={loading}
          >
            Refresh
          </button>
        </div>

        <div className="admin-orders-messages" aria-live="polite">
          {error && <p className="admin-orders-alert error">{error}</p>}
          {message && <p className="admin-orders-alert success">{message}</p>}
        </div>

        {loading ? (
          <p className="admin-orders-empty">Loading orders…</p>
        ) : orders.length === 0 ? (
          <p className="admin-orders-empty">There are no orders yet.</p>
        ) : (
          <div className="admin-order-list">
            {orders.map((order) => {
              const address = order.shippingAddress || {}
              const actionStatus = nextStatus[order.status]
              const isEditingTracking = trackingOrderId === order.id
              const isAlreadyShipped = order.status === 'SHIPPED'
              const hasTracking = Boolean(
                order.shippingCarrier && order.trackingNumber,
              )

              return (
                <article className="admin-order-card" key={order.id}>
                  <div className="admin-order-topline">
                    <div>
                      <p className="admin-order-eyebrow">ORDER NUMBER</p>
                      <strong>{order.orderNumber}</strong>
                    </div>
                    <strong className="admin-order-total">
                      {formatPrice(order.total)}
                    </strong>
                  </div>

                  <div className="admin-order-badges">
                    <span
                      className={`order-status-badge ${String(order.status).toLowerCase()}`}
                    >
                      {statusLabel[order.status] || order.status}
                    </span>
                    <span
                      className={`payment-status-badge ${String(order.paymentStatus).toLowerCase()}`}
                    >
                      {paymentLabel[order.paymentStatus] || order.paymentStatus}
                    </span>
                  </div>

                  <p className="admin-order-date">{formatDate(order.createdAt)}</p>

                  <div className="admin-order-items">
                    {order.items?.map((item, index) => (
                      <div
                        className="admin-order-item"
                        key={`${item.productId ?? item.sku}-${index}`}
                      >
                        <div>
                          <strong>{item.productName}</strong>
                          <span>Qty {item.quantity}</span>
                        </div>
                        <span>{formatPrice(item.lineTotal)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="admin-order-delivery">
                    <p className="admin-order-eyebrow">DELIVERING TO</p>
                    <strong>{address.fullName || 'Name unavailable'}</strong>
                    <span>{address.phone || 'Phone unavailable'}</span>
                    <span>{address.addressLine1}</span>
                    {address.addressLine2 && <span>{address.addressLine2}</span>}
                    {address.landmark && <span>{address.landmark}</span>}
                    <span>
                      {[address.city, address.state, address.postalCode]
                        .filter(Boolean)
                        .join(', ')}
                    </span>
                    {address.country && <span>{address.country}</span>}
                  </div>

                  <div className="admin-order-payment">
                    <span>
                      {paymentLabel[order.paymentMethod] || order.paymentMethod}
                    </span>
                    {order.gatewayPaymentMethod && (
                      <span>Paid via {order.gatewayPaymentMethod}</span>
                    )}
                  </div>

                  {hasTracking && (
                    <div className="admin-saved-tracking">
                      <strong>Shipping details</strong>
                      <span>
                        Courier: {order.shippingCarrier}
                      </span>
                      <span>
                        Tracking number: {order.trackingNumber}
                      </span>
                      {order.trackingUrl && (
                        <a
                          href={order.trackingUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open tracking page
                        </a>
                      )}
                    </div>
                  )}

                  {order.status === 'PROCESSING' && !isEditingTracking && (
                    <button
                      className="admin-order-action"
                      type="button"
                      onClick={() => openTrackingForm(order)}
                    >
                      Enter shipping details
                    </button>
                  )}

                  {isAlreadyShipped && !isEditingTracking && (
                    <div className="admin-order-action-group">
                      {!hasTracking && (
                        <button
                          className="admin-order-secondary-action"
                          type="button"
                          onClick={() => openTrackingForm(order)}
                        >
                          Add tracking details
                        </button>
                      )}
                      {hasTracking && actionStatus === 'DELIVERED' && (
                        <button
                          className="admin-order-action"
                          type="button"
                          onClick={() => advanceOrder(order)}
                          disabled={updatingOrderId === order.id}
                        >
                          {updatingOrderId === order.id
                            ? 'Updating…'
                            : 'Mark as delivered'}
                        </button>
                      )}
                    </div>
                  )}

                  {isEditingTracking && (
                    <form
                      className="admin-tracking-form"
                      onSubmit={(event) => saveTrackingAndShip(event, order)}
                    >
                      <h3>
                        {isAlreadyShipped
                          ? 'Add tracking details'
                          : 'Shipment details'}
                      </h3>

                      <label>
                        Courier name
                        <input
                          name="shippingCarrier"
                          value={trackingForm.shippingCarrier}
                          onChange={updateTrackingField}
                          placeholder="Courier or postal service"
                          maxLength="80"
                          required
                        />
                      </label>

                      <label>
                        Tracking number
                        <input
                          name="trackingNumber"
                          value={trackingForm.trackingNumber}
                          onChange={updateTrackingField}
                          placeholder="Enter the tracking number"
                          maxLength="100"
                          required
                        />
                      </label>

                      <label>
                        Tracking link <span>(optional)</span>
                        <input
                          name="trackingUrl"
                          type="url"
                          value={trackingForm.trackingUrl}
                          onChange={updateTrackingField}
                          placeholder="https://courier.example/track"
                          maxLength="1000"
                        />
                      </label>

                      <p className="admin-tracking-note">
                        Only mark the parcel as shipped after you have handed
                        it to the courier.
                      </p>

                      <div className="admin-tracking-actions">
                        <button
                          className="admin-order-secondary-action"
                          type="button"
                          onClick={closeTrackingForm}
                          disabled={updatingOrderId === order.id}
                        >
                          Cancel
                        </button>
                        <button
                          className="admin-order-action"
                          type="submit"
                          disabled={updatingOrderId === order.id}
                        >
                          {updatingOrderId === order.id
                            ? 'Saving…'
                            : isAlreadyShipped
                              ? 'Save tracking details'
                              : 'Save and mark shipped'}
                        </button>
                      </div>
                    </form>
                  )}

                  {order.status === 'PAYMENT_PENDING' && (
                    <p className="admin-order-note">
                      Fulfilment is unavailable until payment is verified.
                    </p>
                  )}

                  {order.status === 'CANCELLED' && (
                    <p className="admin-order-note">
                      This order is cancelled and cannot be advanced.
                    </p>
                  )}

                  {order.status === 'DELIVERED' && (
                    <p className="admin-order-note">
                      This order is marked as delivered.
                    </p>
                  )}

                  {updatingOrderId === order.id && (
                    <p className="admin-order-note">Updating order…</p>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </aside>
    </div>
  )
}

export default AdminOrdersDrawer