import { useEffect, useState } from 'react'
import preparedStock from './data/preparedStock.json'
import './AdminProductsDrawer.css'

const emptyProduct = {
  sku: '',
  name: '',
  slug: '',
  description: '',
  price: '',
  stockQuantity: '',
  imageUrl: '',
  categoryId: '',
}

function formatPrice(price) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number(price) || 0)
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

function AdminProductsDrawer({ onClose, onProductsChanged }) {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [form, setForm] = useState(emptyProduct)
  const [editingId, setEditingId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [importingStock, setImportingStock] = useState(false)
  const [stockImportResult, setStockImportResult] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function loadData() {
    setLoading(true)
    setError('')

    try {
      const params = new URLSearchParams({
        page: '0',
        size: '100',
        sortBy: 'name',
        direction: 'asc',
      })

      const [productsResponse, categoriesResponse] = await Promise.all([
        fetch(`/api/v1/products?${params.toString()}`, {
          credentials: 'include',
        }),
        fetch('/api/v1/categories', {
          credentials: 'include',
        }),
      ])

      const productsResult = await readResponse(productsResponse)
      const categoriesResult = await readResponse(categoriesResponse)

      if (!productsResponse.ok) {
        throw new Error(
          productsResult.detail ||
            productsResult.message ||
            'Could not load products.',
        )
      }

      if (!categoriesResponse.ok) {
        throw new Error(
          categoriesResult.detail ||
            categoriesResult.message ||
            'Could not load categories.',
        )
      }

      const productList = Array.isArray(productsResult)
        ? productsResult
        : productsResult.content ?? []

      setProducts(productList)
      setCategories(Array.isArray(categoriesResult) ? categoriesResult : [])
    } catch (requestError) {
      setError(
        requestError.message ||
          'Could not connect to the shop. Check that the backend is running.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  function updateField(event) {
    const { name, value } = event.target

    setForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  function startEditing(product) {
    setEditingId(product.id)
    setMessage('')
    setError('')
    setForm({
      sku: product.sku || '',
      name: product.name || '',
      slug: product.slug || '',
      description: product.description || '',
      price: String(product.price ?? ''),
      stockQuantity: String(product.stockQuantity ?? ''),
      imageUrl: product.imageUrl || '',
      categoryId: String(product.categoryId ?? ''),
    })

    document
      .querySelector('.admin-products-panel')
      ?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function resetForm() {
    setEditingId(null)
    setForm(emptyProduct)
    setError('')
    setMessage('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')

    try {
      const csrfHeader = await getCsrfHeader()
      const payload = {
        sku: form.sku.trim(),
        name: form.name.trim(),
        slug: form.slug.trim(),
        description: form.description.trim() || null,
        price: Number(form.price),
        stockQuantity: Number(form.stockQuantity),
        imageUrl: form.imageUrl.trim() || null,
        categoryId: Number(form.categoryId),
      }

      const response = await fetch(
        editingId
          ? `/api/v1/admin/products/${editingId}`
          : '/api/v1/admin/products',
        {
          method: editingId ? 'PUT' : 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...csrfHeader,
          },
          body: JSON.stringify(payload),
        },
      )

      const result = await readResponse(response)

      if (!response.ok) {
        throw new Error(
          result.detail ||
            result.message ||
            `Could not ${editingId ? 'update' : 'create'} the product.`,
        )
      }

      setMessage(editingId ? 'Product updated.' : 'Product created.')
      setForm(emptyProduct)
      setEditingId(null)
      await loadData()
      onProductsChanged()
    } catch (requestError) {
      setError(requestError.message || 'Could not save this product.')
    } finally {
      setSaving(false)
    }
  }

  async function archiveProduct(product) {
    const confirmed = window.confirm(
      `Archive "${product.name}"? It will no longer appear in the shop.`,
    )

    if (!confirmed) return

    setError('')
    setMessage('')

    try {
      const csrfHeader = await getCsrfHeader()
      const response = await fetch(
        `/api/v1/admin/products/${product.id}`,
        {
          method: 'DELETE',
          credentials: 'include',
          headers: csrfHeader,
        },
      )

      if (!response.ok) {
        const result = await readResponse(response)
        throw new Error(
          result.detail || result.message || 'Could not archive this product.',
        )
      }

      setMessage('Product archived and removed from the active shop.')
      await loadData()
      onProductsChanged()
    } catch (requestError) {
      setError(requestError.message || 'Could not archive this product.')
    }
  }

  async function importPreparedStock() {
    setError('')
    setMessage('')
    setStockImportResult('')

    const categoryIds = new Set(categories.map((category) => Number(category.id)))
    const missingCategories = [...new Set(
      preparedStock
        .map((product) => product.categoryId)
        .filter((categoryId) => !categoryIds.has(categoryId)),
    )]

    if (missingCategories.length > 0) {
      setError(
        'Your shop is missing one or more product categories. Refresh the page and check that Rings, Earrings, Tulip Chains, and Bracelets exist.',
      )
      return
    }

    const existingSkus = new Set(
      products.map((product) => String(product.sku || '').toUpperCase()),
    )
    const productsToCreate = preparedStock.filter(
      (product) => !existingSkus.has(product.sku.toUpperCase()),
    )

    if (productsToCreate.length === 0) {
      setStockImportResult('All prepared products are already in the shop.')
      return
    }

    const confirmed = window.confirm(
      `Add ${productsToCreate.length} separate products to the shop now? Each listing starts with stock quantity 1. This will create active products in your shop database.`,
    )

    if (!confirmed) return

    setImportingStock(true)
    let added = 0
    let failed = 0
    const failures = []

    for (let index = 0; index < productsToCreate.length; index += 1) {
      const product = productsToCreate[index]
      setStockImportResult(`Adding product ${index + 1} of ${productsToCreate.length}: ${product.name}`)

      try {
        const csrfHeader = await getCsrfHeader()
        const response = await fetch('/api/v1/admin/products', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...csrfHeader,
          },
          body: JSON.stringify({
            sku: product.sku,
            name: product.name,
            slug: product.slug,
            description: product.description,
            price: product.price,
            stockQuantity: product.stockQuantity,
            imageUrl: product.imageUrl,
            categoryId: product.categoryId,
          }),
        })

        const result = await readResponse(response)
        if (!response.ok) {
          throw new Error(
            result.detail || result.message || `Server returned ${response.status}`,
          )
        }

        added += 1
      } catch (requestError) {
        failed += 1
        failures.push(`${product.name}: ${requestError.message || 'Could not add it.'}`)
      }
    }

    await loadData()
    onProductsChanged()
    setImportingStock(false)

    const summary = `Added ${added} products${failed ? `; ${failed} could not be added` : ''}.`
    setStockImportResult(
      failures.length ? `${summary} ${failures.slice(0, 3).join(' | ')}` : summary,
    )
  }

  return (
    <div className="admin-products-overlay" onMouseDown={onClose}>
      <aside
        className="admin-products-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-products-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="admin-products-header">
          <div>
            <p className="admin-products-eyebrow">ANUH ADMIN</p>
            <h2 id="admin-products-title">Manage products</h2>
            <p>Add a product or update your active shop listings.</p>
          </div>

          <button
            className="admin-products-close"
            type="button"
            onClick={onClose}
            aria-label="Close product management"
          >
            ×
          </button>
        </header>

        <section className="prepared-stock-section">
          <div>
            <p className="admin-products-eyebrow">YOUR PHOTOS, ONE LISTING PER DESIGN</p>
            <h3>Prepared stock</h3>
            <p className="prepared-stock-copy">
              {preparedStock.length} separate listings are ready with their own photos and prices. One stock unit means one item, one pair of earrings, or one complete set as shown in its photo.
            </p>
            <p className="prepared-stock-counts">
              20 necklaces and sets · 22 bracelets and bangles · 21 earring pairs
            </p>
          </div>
          <button
            className="admin-primary-button prepared-stock-button"
            type="button"
            onClick={importPreparedStock}
            disabled={loading || importingStock || categories.length === 0}
          >
            {importingStock ? 'Adding prepared stock…' : 'Add prepared stock'}
          </button>
          {stockImportResult && (
            <p className="admin-products-alert success" role="status">
              {stockImportResult}
            </p>
          )}
          <p className="prepared-stock-note">
            The ring tray photos from earlier messages aren’t available in the project files, so those rings are not included in this batch.
          </p>
        </section>

        <section className="admin-product-form-section">
          <h3>{editingId ? 'Edit product' : 'Add a product'}</h3>
          <p className="admin-products-help">
            SKU is your internal stock code. Slug is the product name used in
            its web address; use lowercase words separated by hyphens.
          </p>

          {error && <p className="admin-products-alert error">{error}</p>}
          {message && <p className="admin-products-alert success">{message}</p>}

          <form className="admin-product-form" onSubmit={handleSubmit}>
            <label>
              SKU
              <input
                name="sku"
                value={form.sku}
                onChange={updateField}
                placeholder="TULIP-CHAIN-001"
                required
                maxLength="50"
              />
            </label>

            <label>
              Product name
              <input
                name="name"
                value={form.name}
                onChange={updateField}
                placeholder="Tulip bead chain"
                required
                maxLength="150"
              />
            </label>

            <label>
              Slug
              <input
                name="slug"
                value={form.slug}
                onChange={updateField}
                placeholder="tulip-bead-chain"
                required
                maxLength="180"
              />
            </label>

            <label>
              Category
              <select
                name="categoryId"
                value={form.categoryId}
                onChange={updateField}
                required
              >
                <option value="">Choose a category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="admin-product-form-row">
              <label>
                Price (₹)
                <input
                  name="price"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.price}
                  onChange={updateField}
                  placeholder="499.00"
                  required
                />
              </label>

              <label>
                Stock quantity
                <input
                  name="stockQuantity"
                  type="number"
                  min="0"
                  step="1"
                  value={form.stockQuantity}
                  onChange={updateField}
                  placeholder="5"
                  required
                />
              </label>
            </div>

            <label>
              Product image URL
              <input
                name="imageUrl"
                type="url"
                value={form.imageUrl}
                onChange={updateField}
                placeholder="https://example.com/product-photo.jpg"
              />
            </label>

            <label>
              Description
              <textarea
                name="description"
                value={form.description}
                onChange={updateField}
                placeholder="Describe the materials, size, and handmade details."
                rows="3"
                maxLength="2000"
              />
            </label>

            <div className="admin-product-form-actions">
              {editingId && (
                <button
                  className="admin-secondary-button"
                  type="button"
                  onClick={resetForm}
                  disabled={saving}
                >
                  Cancel edit
                </button>
              )}
              <button
                className="admin-primary-button"
                type="submit"
                disabled={saving || categories.length === 0}
              >
                {saving
                  ? 'Saving…'
                  : editingId
                    ? 'Save changes'
                    : 'Create product'}
              </button>
            </div>
          </form>
        </section>

        <section className="admin-product-list-section">
          <div className="admin-product-list-heading">
            <div>
              <h3>Active products</h3>
              <p>{products.length} currently shown in the shop</p>
            </div>
            <button
              className="admin-refresh-button"
              type="button"
              onClick={loadData}
              disabled={loading}
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <p className="admin-products-empty">Loading products…</p>
          ) : products.length === 0 ? (
            <p className="admin-products-empty">
              No active products yet. Use the form above to add your first one.
            </p>
          ) : (
            <div className="admin-product-list">
              {products.map((product) => (
                <article className="admin-product-row" key={product.id}>
                  <div className="admin-product-row-main">
                    <strong>{product.name}</strong>
                    <span>
                      {product.sku} · {product.categoryName || 'Category'}
                    </span>
                    <small>
                      {formatPrice(product.price)} · Stock:{' '}
                      {product.stockQuantity ?? (product.inStock ? 'Available' : 0)}
                    </small>
                  </div>

                  <div className="admin-product-row-actions">
                    <button
                      type="button"
                      onClick={() => startEditing(product)}
                    >
                      Edit
                    </button>
                    <button
                      className="archive-button"
                      type="button"
                      onClick={() => archiveProduct(product)}
                    >
                      Archive
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </aside>
    </div>
  )
}

export default AdminProductsDrawer
