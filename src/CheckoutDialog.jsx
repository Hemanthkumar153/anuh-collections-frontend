import { useEffect, useState } from 'react'
import './CheckoutDialog.css'

const emptyAddress = {
  fullName: '',
  phone: '',
  addressLine1: '',
  addressLine2: '',
  landmark: '',
  city: '',
  state: '',
  postalCode: '',
  defaultAddress: true,
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

async function responseBody(response) {
  try {
    return await response.json()
  } catch {
    return {}
  }
}

function loadRazorpayScript() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve()
      return
    }

    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = resolve
    script.onerror = () =>
      reject(new Error('Could not load Razorpay Checkout. Check your internet connection.'))
    document.body.appendChild(script)
  })
}

function CheckoutDialog({ customer, onClose, onOrderComplete }) {
  const [addresses, setAddresses] = useState([])
  const [selectedAddressId, setSelectedAddressId] = useState('')
  const [addressForm, setAddressForm] = useState(emptyAddress)
  const [useNewAddress, setUseNewAddress] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('ONLINE')
  const [loadingAddresses, setLoadingAddresses] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [completedOrder, setCompletedOrder] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function loadAddresses() {
      try {
        const response = await fetch('/api/v1/addresses', {
          credentials: 'include',
        })

        if (!response.ok) {
          throw new Error('Could not load your saved addresses.')
        }

        const savedAddresses = await response.json()

        if (cancelled) return

        setAddresses(savedAddresses)

        const preferredAddress =
          savedAddresses.find((address) => address.defaultAddress) ||
          savedAddresses[0]

        if (preferredAddress) {
          setSelectedAddressId(String(preferredAddress.id))
        } else {
          setUseNewAddress(true)
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError.message)
      } finally {
        if (!cancelled) setLoadingAddresses(false)
      }
    }

    loadAddresses()

    return () => {
      cancelled = true
    }
  }, [])

  function updateAddressField(event) {
    const { name, value } = event.target
    setAddressForm((current) => ({ ...current, [name]: value }))
  }

  async function saveNewAddress() {
    const csrfHeader = await getCsrfHeader()
    const response = await fetch('/api/v1/addresses', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...csrfHeader,
      },
      body: JSON.stringify(addressForm),
    })

    const result = await responseBody(response)

    if (!response.ok) {
      throw new Error(
        result.detail || result.message || 'Could not save this address.',
      )
    }

    return result
  }

  async function placeOrder(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      if (paymentMethod === 'ONLINE') {
        await loadRazorpayScript()
      }

      let addressId = Number(selectedAddressId)

      if (useNewAddress) {
        const savedAddress = await saveNewAddress()
        addressId = savedAddress.id
      }

      if (!addressId) {
        throw new Error('Choose or add a delivery address.')
      }

      const csrfHeader = await getCsrfHeader()
      const orderResponse = await fetch('/api/v1/orders', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...csrfHeader,
        },
        body: JSON.stringify({
          addressId,
          paymentMethod,
        }),
      })

      const checkoutResult = await responseBody(orderResponse)

      if (!orderResponse.ok) {
        throw new Error(
          checkoutResult.detail ||
            checkoutResult.message ||
            'Could not create your order.',
        )
      }

      if (paymentMethod === 'COD') {
        setCompletedOrder(checkoutResult.order)
        onOrderComplete()
        setSubmitting(false)
        return
      }

      const order = checkoutResult.order
      const payment = checkoutResult.razorpayCheckout

      if (!order || !payment?.keyId || !payment?.razorpayOrderId) {
        throw new Error('The backend did not return the Razorpay checkout details.')
      }

      const razorpay = new window.Razorpay({
        key: payment.keyId,
        amount: payment.amount,
        currency: payment.currency,
        name: 'Anuh Collections',
        description: `Order ${order.orderNumber}`,
        order_id: payment.razorpayOrderId,
        prefill: {
          name: customer.fullName,
          email: customer.email,
          contact:
            (useNewAddress
              ? addressForm.phone
              : addresses.find(
                  (address) => address.id === addressId,
                )?.phone) || '',
        },
        theme: {
          color: '#392f29',
        },
        modal: {
          ondismiss: () => {
            setSubmitting(false)
            setError(
              'Payment was not completed. Your order is still pending; you can try checkout again.',
            )
          },
        },
        handler: async (gatewayResponse) => {
          setSubmitting(true)
          setError('')

          try {
            const verifyCsrfHeader = await getCsrfHeader()
            const verifyResponse = await fetch(
              `/api/v1/orders/${order.id}/payments/verify`,
              {
                method: 'POST',
                credentials: 'include',
                headers: {
                  'Content-Type': 'application/json',
                  ...verifyCsrfHeader,
                },
                body: JSON.stringify({
                  razorpayOrderId: gatewayResponse.razorpay_order_id,
                  razorpayPaymentId: gatewayResponse.razorpay_payment_id,
                  razorpaySignature: gatewayResponse.razorpay_signature,
                }),
              },
            )

            const verifiedOrder = await responseBody(verifyResponse)

            if (!verifyResponse.ok) {
              throw new Error(
                verifiedOrder.detail ||
                  verifiedOrder.message ||
                  'The server could not verify this payment.',
              )
            }

            setCompletedOrder(verifiedOrder)
            onOrderComplete()
          } catch (verifyError) {
            setError(
              `${verifyError.message} Check the order status before trying to pay again.`,
            )
          } finally {
            setSubmitting(false)
          }
        },
      })

      razorpay.on('payment.failed', (failure) => {
        setSubmitting(false)
        setError(
          failure?.error?.description ||
            'Payment did not complete. Your order remains pending.',
        )
      })

      razorpay.open()
      setSubmitting(false)
    } catch (requestError) {
      setError(requestError.message || 'Checkout could not be completed.')
      setSubmitting(false)
    }
  }

  if (completedOrder) {
    const onlinePaid =
      completedOrder.paymentMethod === 'ONLINE' &&
      completedOrder.paymentStatus === 'PAID'

    return (
      <div className="checkout-backdrop">
        <section className="checkout-dialog checkout-success">
          <button
            className="checkout-close"
            type="button"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
          <p className="checkout-eyebrow">ANUH COLLECTIONS</p>
          <div className="success-mark">✓</div>
          <h2>
            {onlinePaid ? 'Payment confirmed' : 'Order placed'}
          </h2>
          <p>
            Order number <strong>{completedOrder.orderNumber}</strong>
          </p>
          <p className="success-note">
            {onlinePaid
              ? 'Your payment was verified by the server.'
              : 'You can pay for this order when it is delivered.'}
          </p>
          <button className="checkout-primary" type="button" onClick={onClose}>
            Continue shopping
          </button>
        </section>
      </div>
    )
  }

  return (
    <div className="checkout-backdrop">
      <section
        className="checkout-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkout-title"
      >
        <header className="checkout-header">
          <div>
            <p className="checkout-eyebrow">SECURE CHECKOUT</p>
            <h2 id="checkout-title">Delivery & payment</h2>
          </div>
          <button
            className="checkout-close"
            type="button"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <form onSubmit={placeOrder}>
          <section className="checkout-section">
            <h3>Deliver to</h3>

            {loadingAddresses ? (
              <p className="checkout-hint">Loading saved addresses…</p>
            ) : (
              <>
                {addresses.map((address) => (
                  <label className="address-option" key={address.id}>
                    <input
                      type="radio"
                      name="address"
                      checked={
                        !useNewAddress &&
                        selectedAddressId === String(address.id)
                      }
                      onChange={() => {
                        setSelectedAddressId(String(address.id))
                        setUseNewAddress(false)
                      }}
                    />
                    <span>
                      <strong>{address.fullName}</strong>
                      <br />
                      {address.addressLine1}
                      {address.addressLine2
                        ? `, ${address.addressLine2}`
                        : ''}
                      <br />
                      {address.city}, {address.state} {address.postalCode}
                      <br />
                      Phone: {address.phone}
                    </span>
                  </label>
                ))}

                <button
                  className="add-address-toggle"
                  type="button"
                  onClick={() => setUseNewAddress((current) => !current)}
                >
                  {useNewAddress ? 'Choose a saved address' : '+ Add a new address'}
                </button>
              </>
            )}

            {useNewAddress && (
              <div className="address-form">
                <label>
                  Full name
                  <input
                    name="fullName"
                    value={addressForm.fullName}
                    onChange={updateAddressField}
                    maxLength="120"
                    required
                  />
                </label>

                <label>
                  Indian mobile number
                  <input
                    name="phone"
                    value={addressForm.phone}
                    onChange={updateAddressField}
                    placeholder="9876543210"
                    required
                  />
                </label>

                <label className="full-width">
                  Address line 1
                  <input
                    name="addressLine1"
                    value={addressForm.addressLine1}
                    onChange={updateAddressField}
                    maxLength="180"
                    required
                  />
                </label>

                <label className="full-width">
                  Address line 2 (optional)
                  <input
                    name="addressLine2"
                    value={addressForm.addressLine2}
                    onChange={updateAddressField}
                    maxLength="180"
                  />
                </label>

                <label>
                  City
                  <input
                    name="city"
                    value={addressForm.city}
                    onChange={updateAddressField}
                    maxLength="80"
                    required
                  />
                </label>

                <label>
                  State
                  <input
                    name="state"
                    value={addressForm.state}
                    onChange={updateAddressField}
                    maxLength="80"
                    required
                  />
                </label>

                <label>
                  PIN code
                  <input
                    name="postalCode"
                    value={addressForm.postalCode}
                    onChange={updateAddressField}
                    inputMode="numeric"
                    pattern="[1-9][0-9]{5}"
                    placeholder="6 digits"
                    required
                  />
                </label>

                <label className="full-width">
                  Landmark (optional)
                  <input
                    name="landmark"
                    value={addressForm.landmark}
                    onChange={updateAddressField}
                    maxLength="120"
                  />
                </label>
              </div>
            )}
          </section>

          <section className="checkout-section">
            <h3>Payment method</h3>

            <label className="payment-option">
              <input
                type="radio"
                name="paymentMethod"
                value="ONLINE"
                checked={paymentMethod === 'ONLINE'}
                onChange={() => setPaymentMethod('ONLINE')}
              />
              <span>
                <strong>Pay online</strong>
                <small>UPI, credit/debit cards and other Razorpay methods</small>
              </span>
            </label>

            <label className="payment-option">
              <input
                type="radio"
                name="paymentMethod"
                value="COD"
                checked={paymentMethod === 'COD'}
                onChange={() => setPaymentMethod('COD')}
              />
              <span>
                <strong>Cash on delivery</strong>
                <small>Pay when your order arrives</small>
              </span>
            </label>

            <p className="checkout-hint">
              Online payment opens Razorpay Checkout. This website does not ask
              for or store your card number, CVV, or UPI PIN.
            </p>
          </section>

          {error && <p className="checkout-error">{error}</p>}

          <button
            className="checkout-primary"
            type="submit"
            disabled={submitting || loadingAddresses}
          >
            {submitting
              ? 'Please wait…'
              : paymentMethod === 'COD'
                ? 'Place COD order'
                : 'Continue to Razorpay'}
          </button>
        </form>
      </section>
    </div>
  )
}

export default CheckoutDialog