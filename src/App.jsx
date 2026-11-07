import { useEffect, useState } from 'react'
import AuthDialog from './AuthDialog'
import CartDrawer from './CartDrawer'
import CheckoutDialog from './CheckoutDialog'
import OrderHistoryDrawer from './OrderHistoryDrawer'
import WishlistDrawer from './WishlistDrawer'
import AdminProductsDrawer from './AdminProductsDrawer'
import AdminOrdersDrawer from './AdminOrdersDrawer'
import './App.css'

const GUEST_BAG_KEY = 'anuh-guest-bag'
const emptyWishlist = { itemCount: 0, items: [] }

const formatPrice = (price) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number(price) || 0)

function readGuestBag() {
  try {
    const savedItems = JSON.parse(
      window.localStorage.getItem(GUEST_BAG_KEY) || '[]',
    )
    return Array.isArray(savedItems) ? savedItems : []
  } catch {
    return []
  }
}

function makeGuestCart(items) {
  const normalizedItems = items.map((item) => ({
    ...item,
    lineTotal: Number(item.unitPrice) * item.quantity,
  }))

  return {
    totalQuantity: normalizedItems.reduce(
      (total, item) => total + item.quantity,
      0,
    ),
    subtotal: normalizedItems.reduce(
      (total, item) => total + item.lineTotal,
      0,
    ),
    items: normalizedItems,
  }
}

function categorySymbol(categoryName = '') {
  const name = categoryName.toLowerCase()

  if (name.includes('earring')) return '✦'
  if (name.includes('ring')) return '◌'
  if (name.includes('bracelet')) return '〰'
  if (name.includes('keychain')) return '❀'
  return '⌁'
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

function App() {
  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [searchText, setSearchText] = useState('')
  const [submittedSearch, setSubmittedSearch] = useState('')
  const [sortOrder, setSortOrder] = useState('name-asc')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [productsVersion, setProductsVersion] = useState(0)

  const [user, setUser] = useState(null)
  const [authOpen, setAuthOpen] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [wishlistOpen, setWishlistOpen] = useState(false)
  const [ordersOpen, setOrdersOpen] = useState(false)
  const [adminProductsOpen, setAdminProductsOpen] = useState(false)
  const [adminOrdersOpen, setAdminOrdersOpen] = useState(false)
  const [accountMessage, setAccountMessage] = useState('')

  const [guestItems, setGuestItems] = useState(readGuestBag)
  const [cart, setCart] = useState(() => makeGuestCart(readGuestBag()))
  const [cartMessage, setCartMessage] = useState('')

  const [wishlist, setWishlist] = useState(emptyWishlist)
  const [wishlistMessage, setWishlistMessage] = useState('')
  const [pendingWishlistProductId, setPendingWishlistProductId] =
    useState(null)

  const [checkoutRequested, setCheckoutRequested] = useState(false)

  useEffect(() => {
    let cancelled = false

    fetch('/api/v1/categories')
      .then((response) => {
        if (!response.ok) throw new Error('Could not load categories.')
        return response.json()
      })
      .then((result) => {
        if (!cancelled) setCategories(result)
      })
      .catch(() => {
        if (!cancelled) {
          setError(
            'Could not connect to the shop API. Check that Spring Boot is running.',
          )
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadProducts() {
      setLoading(true)
      setError('')

      const [sortBy, direction] = sortOrder.split('-')
      const params = new URLSearchParams({
        page: '0',
        size: '24',
        sortBy,
        direction,
      })

      if (selectedCategory) {
        params.set('categoryId', selectedCategory)
      }

      if (submittedSearch.trim()) {
        params.set('q', submittedSearch.trim())
      }

      try {
        const response = await fetch(
          `/api/v1/products?${params.toString()}`,
          { credentials: 'include' },
        )

        if (!response.ok) throw new Error('Could not load products.')

        const result = await response.json()
        const productList = Array.isArray(result)
          ? result
          : result.content ?? []

        if (!cancelled) setProducts(productList)
      } catch {
        if (!cancelled) {
          setError('Could not load products. Make sure the backend is running.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadProducts()

    return () => {
      cancelled = true
    }
  }, [selectedCategory, submittedSearch, sortOrder, productsVersion])

  useEffect(() => {
    let cancelled = false

    fetch('/api/v1/auth/me', { credentials: 'include' })
      .then((response) => (response.ok ? response.json() : null))
      .then((account) => {
        if (!cancelled) setUser(account)
      })
      .catch(() => {
        if (!cancelled) setUser(null)
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    window.localStorage.setItem(GUEST_BAG_KEY, JSON.stringify(guestItems))

    if (!user) {
      setCart(makeGuestCart(guestItems))
    }
  }, [guestItems, user])

  useEffect(() => {
    if (!user) return undefined

    let cancelled = false

    fetch('/api/v1/cart', { credentials: 'include' })
      .then((response) => {
        if (!response.ok) throw new Error('Could not load your bag.')
        return response.json()
      })
      .then((accountCart) => {
        if (!cancelled) setCart(accountCart)
      })
      .catch(() => {
        if (!cancelled) {
          setCartMessage('Could not load your account bag. Please refresh.')
        }
      })

    return () => {
      cancelled = true
    }
  }, [user])

  useEffect(() => {
    if (!user) {
      setWishlist(emptyWishlist)
      return undefined
    }

    let cancelled = false

    fetch('/api/v1/wishlist', { credentials: 'include' })
      .then((response) => {
        if (!response.ok) throw new Error('Could not load your wishlist.')
        return response.json()
      })
      .then((accountWishlist) => {
        if (!cancelled) setWishlist(accountWishlist)
      })
      .catch(() => {
        if (!cancelled) {
          setWishlistMessage('Could not load your wishlist. Please refresh.')
        }
      })

    return () => {
      cancelled = true
    }
  }, [user])

  useEffect(() => {
    if (!user || !pendingWishlistProductId) return undefined

    let cancelled = false

    async function savePendingFavourite() {
      try {
        const csrfHeader = await getCsrfHeader()
        const response = await fetch('/api/v1/wishlist/items', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...csrfHeader,
          },
          body: JSON.stringify({
            productId: pendingWishlistProductId,
          }),
        })

        const result = await readResponse(response)

        if (!response.ok) {
          throw new Error(
            result.detail || result.message || 'Could not save this favourite.',
          )
        }

        if (!cancelled) {
          setWishlist(result)
          setWishlistOpen(true)
          setWishlistMessage('')
        }
      } catch (requestError) {
        if (!cancelled) setWishlistMessage(requestError.message)
      } finally {
        if (!cancelled) setPendingWishlistProductId(null)
      }
    }

    savePendingFavourite()

    return () => {
      cancelled = true
    }
  }, [user, pendingWishlistProductId])

  function handleSearch(event) {
    event.preventDefault()
    setSubmittedSearch(searchText)
  }

  function showProducts() {
    document.getElementById('shop-products')?.scrollIntoView({
      behavior: 'smooth',
    })
  }

  function selectCategory(categoryId) {
    setSelectedCategory(categoryId)
    showProducts()
  }

  async function addToBag(product) {
    setCartMessage('')

    if (!user) {
      setGuestItems((currentItems) => {
        const existing = currentItems.find(
          (item) => item.productId === product.id,
        )

        if (existing) {
          return currentItems.map((item) =>
            item.productId === product.id
              ? { ...item, quantity: item.quantity + 1 }
              : item,
          )
        }

        return [
          ...currentItems,
          {
            productId: product.id,
            productName: product.name,
            productSlug: product.slug,
            imageUrl: product.imageUrl,
            unitPrice: Number(product.price),
            quantity: 1,
          },
        ]
      })

      setCartOpen(true)
      return true
    }

    try {
      const csrfHeader = await getCsrfHeader()
      const response = await fetch('/api/v1/cart/items', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...csrfHeader,
        },
        body: JSON.stringify({
          productId: product.id,
          quantity: 1,
        }),
      })

      const result = await readResponse(response)

      if (!response.ok) {
        throw new Error(
          result.detail || result.message || 'Could not add this item.',
        )
      }

      setCart(result)
      setCartOpen(true)
      return true
    } catch (requestError) {
      setCartMessage(requestError.message)
      setCartOpen(true)
      return false
    }
  }

  async function changeQuantity(productId, quantity) {
    if (quantity < 1) {
      await removeFromBag(productId)
      return
    }

    setCartMessage('')

    if (!user) {
      setGuestItems((currentItems) =>
        currentItems.map((item) =>
          item.productId === productId ? { ...item, quantity } : item,
        ),
      )
      return
    }

    try {
      const csrfHeader = await getCsrfHeader()
      const response = await fetch(`/api/v1/cart/items/${productId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...csrfHeader,
        },
        body: JSON.stringify({ quantity }),
      })

      const result = await readResponse(response)

      if (!response.ok) {
        throw new Error(
          result.detail || result.message || 'Could not update quantity.',
        )
      }

      setCart(result)
    } catch (requestError) {
      setCartMessage(requestError.message)
    }
  }

  async function removeFromBag(productId) {
    setCartMessage('')

    if (!user) {
      setGuestItems((currentItems) =>
        currentItems.filter((item) => item.productId !== productId),
      )
      return
    }

    try {
      const csrfHeader = await getCsrfHeader()
      const response = await fetch(`/api/v1/cart/items/${productId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: csrfHeader,
      })

      if (!response.ok) throw new Error('Could not remove this item.')

      const cartResponse = await fetch('/api/v1/cart', {
        credentials: 'include',
      })

      if (!cartResponse.ok) {
        throw new Error('Item removed, but could not refresh the bag.')
      }

      setCart(await cartResponse.json())
    } catch (requestError) {
      setCartMessage(requestError.message)
    }
  }

  async function removeFromWishlist(productId) {
    setWishlistMessage('')

    try {
      const csrfHeader = await getCsrfHeader()
      const response = await fetch(
        `/api/v1/wishlist/items/${productId}`,
        {
          method: 'DELETE',
          credentials: 'include',
          headers: csrfHeader,
        },
      )

      if (!response.ok) throw new Error('Could not remove this favourite.')

      setWishlist((current) => {
        const items = current.items.filter(
          (item) => item.productId !== productId,
        )
        return { itemCount: items.length, items }
      })
    } catch (requestError) {
      setWishlistMessage(requestError.message)
    }
  }

  async function toggleWishlist(product) {
    setWishlistMessage('')

    if (!user) {
      setPendingWishlistProductId(product.id)
      setAuthOpen(true)
      return
    }

    const alreadySaved = wishlist.items.some(
      (item) => item.productId === product.id,
    )

    if (alreadySaved) {
      await removeFromWishlist(product.id)
      return
    }

    try {
      const csrfHeader = await getCsrfHeader()
      const response = await fetch('/api/v1/wishlist/items', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...csrfHeader,
        },
        body: JSON.stringify({ productId: product.id }),
      })

      const result = await readResponse(response)

      if (!response.ok) {
        throw new Error(
          result.detail || result.message || 'Could not save this favourite.',
        )
      }

      setWishlist(result)
    } catch (requestError) {
      setWishlistMessage(requestError.message)
    }
  }

  async function moveWishlistItemToBag(item) {
    setWishlistOpen(false)

    const product = {
      id: item.productId,
      name: item.productName,
      slug: item.productSlug,
      imageUrl: item.imageUrl,
      price: item.price,
      inStock: item.available,
    }

    const added = await addToBag(product)

    if (added) {
      await removeFromWishlist(item.productId)
    }
  }

  async function handleAuthenticated(account) {
    setCartMessage('')

    try {
      const pendingItems = readGuestBag()

      if (pendingItems.length > 0) {
        const csrfHeader = await getCsrfHeader()

        for (const item of pendingItems) {
          const response = await fetch('/api/v1/cart/items', {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              ...csrfHeader,
            },
            body: JSON.stringify({
              productId: item.productId,
              quantity: item.quantity,
            }),
          })

          if (!response.ok) {
            throw new Error(
              'Your saved bag could not be moved to your account.',
            )
          }
        }

        window.localStorage.removeItem(GUEST_BAG_KEY)
        setGuestItems([])
      }

      setUser(account)
      setAuthOpen(false)

      if (checkoutRequested) {
        setCheckoutOpen(true)
        setCheckoutRequested(false)
      }
    } catch (requestError) {
      setUser(account)
      setAuthOpen(false)
      setCartMessage(requestError.message)
      setCartOpen(true)
      setCheckoutRequested(false)
    }
  }

  async function handleLogout() {
    setAccountMessage('')

    try {
      const csrfHeader = await getCsrfHeader()
      const response = await fetch('/api/v1/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: csrfHeader,
      })

      if (!response.ok) {
        const result = await readResponse(response)
        throw new Error(
          result.detail || result.message || 'Could not sign out.',
        )
      }

      setUser(null)
      setCart(makeGuestCart(guestItems))
      setWishlist(emptyWishlist)
      setCartMessage('')
      setWishlistMessage('')
      setAccountMessage('You have signed out.')
      setAuthOpen(false)
      setCartOpen(false)
      setCheckoutOpen(false)
      setWishlistOpen(false)
      setOrdersOpen(false)
      setAdminProductsOpen(false)
      setAdminOrdersOpen(false)
      setCheckoutRequested(false)
      setPendingWishlistProductId(null)
    } catch (requestError) {
      setAccountMessage(requestError.message || 'Could not sign out.')
    }
  }

  function handleCheckout() {
    setCartMessage('')

    if (cart.items.length === 0) {
      setCartMessage('Your bag is empty.')
      return
    }

    if (!user) {
      setCheckoutRequested(true)
      setCartOpen(false)
      setAuthOpen(true)
      return
    }

    setCartOpen(false)
    setCheckoutOpen(true)
  }

  function openWishlist() {
    if (!user) {
      setAuthOpen(true)
      return
    }

    setWishlistMessage('')
    setWishlistOpen(true)
  }

  function openOrders() {
    if (!user) {
      setAuthOpen(true)
      return
    }

    setOrdersOpen(true)
  }

  async function handleOrderComplete() {
    try {
      const response = await fetch('/api/v1/cart', {
        credentials: 'include',
      })
      if (response.ok) setCart(await response.json())
    } catch {
      // Keep the checkout confirmation visible if refreshing the bag fails.
    }
  }

  const cartCount = cart.totalQuantity || 0
  const savedProductIds = new Set(
    wishlist.items.map((item) => item.productId),
  )

  return (
    <div className="store">
      <div className="announcement">
        Thoughtful handmade pieces, made to feel like you
      </div>

      <header className="site-header">
        <a className="brand" href="#" aria-label="Anuh Collections home">
          <span className="brand-mark">A</span>
          <span>
            <strong>Anuh</strong>
            <small>COLLECTIONS</small>
          </span>
        </a>

        <form className="search-form" onSubmit={handleSearch}>
          <input
            aria-label="Search jewellery"
            placeholder="Search chains, earrings, rings..."
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
          />
          <button type="submit" aria-label="Search">Search</button>
        </form>

        <div className="header-account">
          {user ? (
            <>
              <span>Hello, {user.fullName}</span>
              <button
                className="orders-trigger"
                type="button"
                onClick={handleLogout}
              >
                Sign out
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setAuthOpen(true)}>
              Sign in / Join
            </button>
          )}

          {user?.role === 'ADMIN' && (
            <>
              <button
                className="orders-trigger"
                type="button"
                onClick={() => setAdminProductsOpen(true)}
              >
                Manage products
              </button>
              <button
                className="orders-trigger"
                type="button"
                onClick={() => setAdminOrdersOpen(true)}
              >
                Manage orders
              </button>
            </>
          )}

          <button
            className="orders-trigger"
            type="button"
            onClick={openOrders}
          >
            My orders
          </button>

          <button
            className="wishlist-trigger"
            type="button"
            onClick={openWishlist}
          >
            Wishlist <span>{wishlist.itemCount || 0}</span>
          </button>

          <button
            className="bag-trigger"
            type="button"
            onClick={() => setCartOpen(true)}
          >
            Bag <span>{cartCount}</span>
          </button>

          {accountMessage && (
            <span className="account-message" role="status">
              {accountMessage}
            </span>
          )}
        </div>
      </header>

      <nav className="main-nav" aria-label="Shop navigation">
        <button
          className={!selectedCategory ? 'nav-item active' : 'nav-item'}
          onClick={() => selectCategory(null)}
        >
          All pieces
        </button>

        {categories.map((category) => (
          <button
            className={
              selectedCategory === category.id
                ? 'nav-item active'
                : 'nav-item'
            }
            key={category.id}
            onClick={() => selectCategory(category.id)}
          >
            {category.name}
          </button>
        ))}
      </nav>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">SMALL DETAILS. BIG FEELINGS.</p>
            <h1>
              Little pieces
              <br />
              <em>of joy.</em>
            </h1>
            <p className="hero-description">
              Discover handmade jewellery and crochet keepsakes, created to
              bring a little colour to every day.
            </p>
            <button className="primary-button" onClick={showProducts}>
              Explore the collection <span aria-hidden="true">→</span>
            </button>
            <div className="hero-promises">
              <span>♡ Made by hand</span>
              <span>✦ Packed with care</span>
            </div>
          </div>

          <div
            className="hero-art"
            aria-label="Anuh Collections handmade jewellery"
          >
            <div className="art-sun" />
            <div className="art-orbit orbit-one" />
            <div className="art-orbit orbit-two" />
            <div className="art-petal petal-one" />
            <div className="art-petal petal-two" />
            <div className="art-petal petal-three" />
            <div className="art-caption">MADE FOR YOUR EVERYDAY</div>
            <div className="art-stamp">ANUH<br />✦</div>
          </div>
        </section>

        <section className="category-section" aria-labelledby="category-title">
          <div>
            <p className="eyebrow">FIND YOUR FAVOURITE</p>
            <h2 id="category-title">Made for every little moment</h2>
          </div>

          <div className="category-list">
            <button
              className={!selectedCategory ? 'category-chip selected' : 'category-chip'}
              onClick={() => setSelectedCategory(null)}
            >
              Everything
            </button>

            {categories.map((category) => (
              <button
                className={
                  selectedCategory === category.id
                    ? 'category-chip selected'
                    : 'category-chip'
                }
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
              >
                <span>{categorySymbol(category.name)}</span>
                {category.name}
              </button>
            ))}
          </div>
        </section>

        <section className="products-section" id="shop-products">
          <div className="section-heading">
            <div>
              <p className="eyebrow">THE ANUH EDIT</p>
              <h2>
                {selectedCategory
                  ? categories.find(
                      (item) => item.id === selectedCategory,
                    )?.name
                  : 'A little something lovely'}
              </h2>
              <p className="section-subtitle">
                {submittedSearch
                  ? `Search results for “${submittedSearch}”`
                  : 'Handpicked pieces for gifting, keeping, and wearing on repeat.'}
              </p>
            </div>

            <label className="sort-control">
              <span>Sort by</span>
              <select
                value={sortOrder}
                onChange={(event) => setSortOrder(event.target.value)}
              >
                <option value="name-asc">Name: A to Z</option>
                <option value="price-asc">Price: Low to high</option>
                <option value="price-desc">Price: High to low</option>
              </select>
            </label>
          </div>

          {loading && <p className="status-message">Finding your favourites…</p>}

          {!loading && error && (
            <p className="status-message error-message">{error}</p>
          )}

          {!loading && !error && products.length === 0 && (
            <div className="empty-state">
              <span>✦</span>
              <h3>No pieces found just yet</h3>
              <p>Try another search or choose a different category.</p>
            </div>
          )}

          {!loading && !error && products.length > 0 && (
            <div className="product-grid">
              {products.map((product) => {
                const isSaved = savedProductIds.has(product.id)

                return (
                  <article className="product-card" key={product.id}>
                    <div className="product-image">
                      {product.imageUrl ? (
                        <img src={product.imageUrl} alt={product.name} />
                      ) : (
                        <div className="image-placeholder">
                          <span>{categorySymbol(product.categoryName)}</span>
                          <small>{product.categoryName}</small>
                        </div>
                      )}
                      <span className="handmade-tag">HANDMADE</span>
                      <button
                        className={
                          isSaved
                            ? 'favorite-toggle saved'
                            : 'favorite-toggle'
                        }
                        type="button"
                        aria-label={
                          isSaved
                            ? `Remove ${product.name} from wishlist`
                            : `Save ${product.name} to wishlist`
                        }
                        aria-pressed={isSaved}
                        onClick={() => toggleWishlist(product)}
                      >
                        {isSaved ? '♥' : '♡'}
                      </button>
                    </div>

                    <div className="product-info">
                      <p className="product-category">{product.categoryName}</p>
                      <h3>{product.name}</h3>
                      <p className="product-description">
                        {product.description ||
                          'A special handmade piece from Anuh Collections.'}
                      </p>
                      <div className="product-footer">
                        <strong>{formatPrice(product.price)}</strong>
                        <span className={product.inStock ? 'stock in-stock' : 'stock'}>
                          {product.inStock ? 'In stock' : 'Sold out'}
                        </span>
                      </div>
                      <button
                        className="add-to-bag"
                        type="button"
                        disabled={!product.inStock}
                        onClick={() => addToBag(product)}
                      >
                        {product.inStock ? 'Add to bag' : 'Sold out'}
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>

        <section className="craft-note">
          <span className="craft-symbol">✿</span>
          <div>
            <p className="eyebrow">A LITTLE ABOUT ANUH</p>
            <h2>Made slowly, chosen thoughtfully.</h2>
            <p>
              Every chain, bracelet, pair of earrings, ring, and crochet
              keychain is part of a small collection made with care.
            </p>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <a className="brand footer-brand" href="#">
          <span className="brand-mark">A</span>
          <span>
            <strong>Anuh</strong>
            <small>COLLECTIONS</small>
          </span>
        </a>
        <p>Handmade treasures for everyday moments.</p>
        <small>© {new Date().getFullYear()} Anuh Collections</small>
      </footer>

      {authOpen && (
        <AuthDialog
          onClose={() => {
            setAuthOpen(false)
            setCheckoutRequested(false)
            setPendingWishlistProductId(null)
          }}
          onAuthenticated={handleAuthenticated}
        />
      )}

      {cartOpen && (
        <CartDrawer
          cart={cart}
          isGuest={!user}
          message={cartMessage}
          onClose={() => setCartOpen(false)}
          onChangeQuantity={changeQuantity}
          onRemove={removeFromBag}
          onCheckout={handleCheckout}
        />
      )}

      {wishlistOpen && (
        <WishlistDrawer
          items={wishlist.items}
          message={wishlistMessage}
          onClose={() => setWishlistOpen(false)}
          onRemove={removeFromWishlist}
          onMoveToBag={moveWishlistItemToBag}
        />
      )}

      {ordersOpen && (
        <OrderHistoryDrawer onClose={() => setOrdersOpen(false)} />
      )}

      {checkoutOpen && user && (
        <CheckoutDialog
          customer={user}
          onClose={() => setCheckoutOpen(false)}
          onOrderComplete={handleOrderComplete}
        />
      )}

      {adminProductsOpen && user?.role === 'ADMIN' && (
        <AdminProductsDrawer
          onClose={() => setAdminProductsOpen(false)}
          onProductsChanged={() =>
            setProductsVersion((version) => version + 1)
          }
        />
      )}

      {adminOrdersOpen && user?.role === 'ADMIN' && (
        <AdminOrdersDrawer onClose={() => setAdminOrdersOpen(false)} />
      )}
    </div>
  )
}

export default App