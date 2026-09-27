import QRCode from 'qrcode';
import './styles.css';
import { formatTokenAmount } from './domain/amount';
import {
  addCartLine,
  CART_STORAGE_KEY,
  cartFingerprint,
  cartTotalUnits,
  readPersistedCart,
  resolveCart,
  serializeCart,
  setCartQuantity,
} from './domain/cart';
import { buildSolanaPayUrl, createPaymentIntent, isPaymentIntentCurrent } from './domain/payment';
import { shortAddress } from './domain/solana';
import type { CartLine, Catalog, PaymentIntent, Product, ProductVariant, StorefrontConfig } from './domain/types';
import { validateCatalog, validateStorefrontConfig } from './domain/validation';

const root = document.querySelector<HTMLDivElement>('#app')!;
if (!root) throw new Error('Missing #app root.');

interface AppState {
  cart: CartLine[];
  catalog: Catalog;
  config: StorefrontConfig;
  intent: PaymentIntent | null;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character] ?? character);
}

function displayVariant(product: Product, variant: ProductVariant): string {
  if (product.optionGroups.length === 0) return product.name;
  return product.optionGroups
    .map((group) => `${group.label}: ${variant.options[group.id] ?? '—'}`)
    .join(' · ');
}

async function loadJson(path: string): Promise<unknown> {
  const response = await fetch(path, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}.`);
  return response.json();
}

function renderFatal(errors: string[]): void {
  root.innerHTML = `<main class="fatal-shell">
    <section class="fatal-card" role="alert">
      <p class="eyebrow">Configuration required</p>
      <h1>The storefront could not start.</h1>
      <p>Fix these public configuration errors and reload:</p>
      <ul>${errors.map((error) => `<li>${escapeHtml(error)}</li>`).join('')}</ul>
      <code>npm run validate-config</code>
    </section>
  </main>`;
}

function renderProductCard(product: Product, symbol: string): string {
  const variants = product.variants.filter((variant) => variant.available);
  const options = variants.map((variant) => `<option value="${escapeHtml(variant.sku)}">
    ${escapeHtml(displayVariant(product, variant))} — ${escapeHtml(variant.tokenAmount)} ${escapeHtml(symbol)}
  </option>`).join('');
  const firstVariant = variants[0];
  return `<article class="product-card" data-product-card="${escapeHtml(product.id)}">
    <div class="product-image">
      <img src="${escapeHtml(product.images[0]?.src ?? '')}" alt="${escapeHtml(product.images[0]?.alt ?? product.name)}" loading="lazy">
      <span class="product-badge">Available</span>
    </div>
    <div class="product-info">
      <p class="product-kicker">Token-native merchandise</p>
      <h3>${escapeHtml(product.name)}</h3>
      <p class="product-description">${escapeHtml(product.description)}</p>
      <div class="price-row">
        <strong data-product-price>${escapeHtml(firstVariant?.tokenAmount ?? '—')} ${escapeHtml(symbol)}</strong>
        <span>${escapeHtml(firstVariant?.displayPrice ?? '')}</span>
      </div>
      <label class="variant-field">
        <span>${product.optionGroups.length === 1 ? escapeHtml(product.optionGroups[0]?.label ?? 'Option') : 'Variant'}</span>
        <select data-variant-select="${escapeHtml(product.id)}" ${variants.length ? '' : 'disabled'}>${options}</select>
      </label>
      <button class="add-to-cart" type="button" data-add-product="${escapeHtml(product.id)}" ${variants.length ? '' : 'disabled'}>
        Add to cart
      </button>
    </div>
  </article>`;
}

function renderDraftCard(product: Product): string {
  return `<article class="draft-card">
    <div class="product-image">
      <img src="${escapeHtml(product.images[0]?.src ?? '')}" alt="${escapeHtml(product.images[0]?.alt ?? product.name)}" loading="lazy">
      <span class="product-badge">Draft concept</span>
    </div>
    <div class="product-info">
      <h3>${escapeHtml(product.name)}</h3>
      <p class="product-description">${escapeHtml(product.description)}</p>
      <span class="not-for-sale">Not available to add</span>
    </div>
  </article>`;
}

function renderShell(config: StorefrontConfig, catalog: Catalog): void {
  const active = catalog.products.filter((product) => product.status === 'active');
  const drafts = catalog.products.filter((product) => product.status === 'draft');
  const symbol = config.payment.token.symbol;
  document.title = `${config.storefront.name} — token storefront`;
  document.documentElement.style.setProperty('--wine', config.storefront.theme.accent);
  document.documentElement.style.setProperty('--paper', config.storefront.theme.background);

  root.innerHTML = `
    <div class="proposal-bar" role="note"><strong>DEVNET DEMONSTRATION.</strong> ${escapeHtml(config.storefront.disclaimer)}</div>
    <header class="site-header">
      <a class="brand" href="#top" aria-label="${escapeHtml(config.storefront.name)} home">
        <span class="brand-mark" aria-hidden="true">${escapeHtml(config.storefront.shortName)}</span>
        <span>${escapeHtml(config.storefront.name)}</span>
      </a>
      <nav aria-label="Primary navigation">
        <a href="#catalog">Catalog</a>
        <a href="#checkout">Checkout</a>
        <button class="cart-button" type="button" data-open-cart aria-label="Open cart">Cart <span data-cart-count>0</span></button>
      </nav>
    </header>
    <main id="top">
      <section class="hero">
        <div class="hero-copy">
          <p class="eyebrow">Forkable commerce on Solana devnet</p>
          <h1>${escapeHtml(config.storefront.tagline)}</h1>
          <p class="hero-lede">${escapeHtml(config.storefront.description)}</p>
          <div class="hero-actions">
            <a class="button button-primary" href="#catalog">Shop the catalog</a>
            <button class="button button-secondary" type="button" data-open-cart>Review cart</button>
          </div>
        </div>
        <aside class="token-card" aria-label="Payment configuration">
          <div class="token-coin" aria-hidden="true"><span>${escapeHtml(symbol)}</span></div>
          <p class="eyebrow">Selected payment token</p>
          <h2>${escapeHtml(symbol)}</h2>
          <dl>
            <div><dt>Network</dt><dd>Solana devnet</dd></div>
            <div><dt>Pricing</dt><dd>Per SKU</dd></div>
            <div><dt>Checkout</dt><dd>${config.payment.enabled ? 'Configured' : 'Fork owner setup'}</dd></div>
          </dl>
        </aside>
      </section>
      <section class="how-strip" aria-label="Storefront flow">
        <p><b>01</b> Select a real SKU</p><span aria-hidden="true">→</span>
        <p><b>02</b> Build a persistent cart</p><span aria-hidden="true">→</span>
        <p><b>03</b> Review exact token total</p><span aria-hidden="true">→</span>
        <p><b>04</b> Hand off to a wallet</p>
      </section>
      <section class="catalog-section" id="catalog">
        <div class="section-heading">
          <div><p class="eyebrow">Complete starter catalog</p><h2>Choose your issue.</h2></div>
          <p>Each selection resolves to a concrete variant and token-native price. Nothing here redirects to another storefront.</p>
        </div>
        <div class="product-grid" data-product-grid>${active.map((product) => renderProductCard(product, symbol)).join('')}</div>
      </section>
      <section class="draft-section" id="concepts">
        <div class="section-heading">
          <div><p class="eyebrow">Non-purchasable drafts</p><h2>Ideas for the next drop.</h2></div>
          <p>Draft products are part of the catalog ontology but cannot enter the cart until a fork owner adds variants and marks them active.</p>
        </div>
        <div class="draft-grid">${drafts.map(renderDraftCard).join('')}</div>
      </section>
      <section class="checkout-section" id="checkout" aria-labelledby="checkout-title">
        <div class="checkout-panel">
          <div class="checkout-steps" aria-hidden="true"><span class="active">Cart</span><i></i><span>Exact total</span><i></i><span>Wallet</span></div>
          <p class="eyebrow">Solana Pay handoff</p>
          <h2 id="checkout-title">Pay with ${escapeHtml(symbol)} on devnet.</h2>
          <div data-checkout-content></div>
        </div>
      </section>
    </main>
    <footer>
      <p>${escapeHtml(config.storefront.disclaimer)}</p>
      <span>Forkable storefront · no hosted service included</span>
    </footer>
    <div class="drawer-backdrop" data-drawer-backdrop hidden></div>
    <aside class="cart-drawer" data-cart-drawer aria-labelledby="cart-title" aria-hidden="true">
      <div class="drawer-header">
        <div><p class="eyebrow">Your selection</p><h2 id="cart-title">Cart</h2></div>
        <button class="icon-button" type="button" data-close-cart aria-label="Close cart">×</button>
      </div>
      <div data-cart-content></div>
    </aside>
    <div class="visually-hidden" aria-live="polite" data-announcer></div>
  `;
}

function renderCart(state: AppState): void {
  const resolved = resolveCart(state.cart, state.catalog, state.config.payment.token.decimals);
  const count = resolved.reduce((total, line) => total + line.quantity, 0);
  const total = formatTokenAmount(cartTotalUnits(resolved), state.config.payment.token.decimals);
  const symbol = state.config.payment.token.symbol;
  document.querySelectorAll<HTMLElement>('[data-cart-count]').forEach((element) => { element.textContent = count.toString(); });

  const content = document.querySelector<HTMLElement>('[data-cart-content]');
  if (!content) return;
  if (resolved.length === 0) {
    content.innerHTML = `<div class="empty-cart"><p>Your cart is empty.</p><button class="button button-secondary" type="button" data-close-cart>Browse the catalog</button></div>`;
  } else {
    content.innerHTML = `<div class="cart-items">${resolved.map((line) => `
      <article class="cart-item">
        <img src="${escapeHtml(line.product.images[0]?.src ?? '')}" alt="">
        <div class="cart-item-copy">
          <h3>${escapeHtml(line.product.name)}</h3>
          <p>${escapeHtml(displayVariant(line.product, line.variant))}</p>
          <strong>${escapeHtml(formatTokenAmount(line.unitsTotal, state.config.payment.token.decimals))} ${escapeHtml(symbol)}</strong>
          <div class="quantity-control" aria-label="Quantity for ${escapeHtml(line.product.name)}">
            <button type="button" data-decrement="${escapeHtml(line.sku)}" aria-label="Decrease quantity">−</button>
            <span aria-label="Quantity">${line.quantity}</span>
            <button type="button" data-increment="${escapeHtml(line.sku)}" aria-label="Increase quantity">+</button>
          </div>
        </div>
        <button class="remove-button" type="button" data-remove="${escapeHtml(line.sku)}">Remove</button>
      </article>`).join('')}</div>
      <div class="cart-summary">
        <div><span>Exact merchandise total</span><strong>${escapeHtml(total)} ${escapeHtml(symbol)}</strong></div>
        <p>No shipping, tax, order, or fulfillment is created by this template.</p>
        <button class="button button-primary checkout-button" type="button" data-proceed-checkout>Continue to devnet payment</button>
      </div>`;
  }
  void renderCheckout(state);
}

async function renderCheckout(state: AppState): Promise<void> {
  const container = document.querySelector<HTMLElement>('[data-checkout-content]');
  if (!container) return;
  const resolved = resolveCart(state.cart, state.catalog, state.config.payment.token.decimals);
  const totalUnits = cartTotalUnits(resolved);
  const amount = formatTokenAmount(totalUnits, state.config.payment.token.decimals);
  const symbol = state.config.payment.token.symbol;
  const itemCount = resolved.reduce((sum, line) => sum + line.quantity, 0);

  if (resolved.length === 0) {
    container.innerHTML = `<div class="checkout-notice"><strong>Add a product first.</strong><p>Your exact token total and payment request will appear here.</p></div>`;
    return;
  }

  const summary = `<div class="quote-preview">
    <span>Items</span><strong>${itemCount}</strong>
    <span>Exact total</span><strong>${escapeHtml(amount)} ${escapeHtml(symbol)}</strong>
    <span>Network</span><strong>Solana devnet</strong>
    <span>Receiving wallet</span><strong>${escapeHtml(shortAddress(state.config.payment.recipient))}</strong>
    <span>Token mint</span><strong>${escapeHtml(shortAddress(state.config.payment.token.mint))}</strong>
  </div>`;

  if (!state.config.payment.enabled) {
    container.innerHTML = `${summary}<div class="checkout-notice warning"><strong>Checkout is intentionally disabled.</strong><p>The fork owner must set <code>payment.recipient</code>, <code>payment.token.mint</code>, and <code>payment.enabled</code> in <code>public/storefront.config.json</code>.</p></div>`;
    return;
  }

  const intent = isPaymentIntentCurrent(state.intent, state.cart)
    ? state.intent!
    : createPaymentIntent(state.cart, state.config.payment.memoPrefix);
  state.intent = intent;
  const fingerprint = cartFingerprint(state.cart);
  const url = buildSolanaPayUrl(state.config, amount, intent, itemCount);
  container.innerHTML = `${summary}<div class="checkout-ready"><p>Scan with a compatible wallet or open the wallet link on this device. Confirm that the wallet is connected to <strong>devnet</strong>.</p><div class="qr-frame"><span>Preparing QR…</span></div><div class="checkout-actions"><a class="button button-primary" href="${escapeHtml(url)}" data-wallet-link>Open wallet</a><a class="button button-secondary" href="https://explorer.solana.com/address/${escapeHtml(state.config.payment.token.mint)}?cluster=devnet" target="_blank" rel="noreferrer">Inspect devnet mint</a></div><small>Reference: <code>${escapeHtml(intent.reference)}</code></small><div class="checkout-notice warning"><strong>No success state is shown.</strong><p>This static template cannot verify settlement or trigger fulfillment.</p></div></div>`;

  try {
    const dataUrl = await QRCode.toDataURL(url, { width: 320, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#120d0b', light: '#fffaf0' } });
    if (fingerprint !== cartFingerprint(state.cart)) return;
    const frame = container.querySelector<HTMLElement>('.qr-frame');
    if (frame) frame.innerHTML = `<img src="${dataUrl}" alt="Solana Pay QR code for ${escapeHtml(amount)} ${escapeHtml(symbol)} on devnet">`;
  } catch {
    const frame = container.querySelector<HTMLElement>('.qr-frame');
    if (frame) frame.textContent = 'QR generation failed. Use the wallet link instead.';
  }
}

function openCart(): void {
  const drawer = document.querySelector<HTMLElement>('[data-cart-drawer]');
  const backdrop = document.querySelector<HTMLElement>('[data-drawer-backdrop]');
  drawer?.classList.add('open');
  drawer?.setAttribute('aria-hidden', 'false');
  if (backdrop) backdrop.hidden = false;
  document.body.classList.add('drawer-open');
  drawer?.querySelector<HTMLButtonElement>('[data-close-cart]')?.focus();
}

function closeCart(): void {
  const drawer = document.querySelector<HTMLElement>('[data-cart-drawer]');
  const backdrop = document.querySelector<HTMLElement>('[data-drawer-backdrop]');
  drawer?.classList.remove('open');
  drawer?.setAttribute('aria-hidden', 'true');
  if (backdrop) backdrop.hidden = true;
  document.body.classList.remove('drawer-open');
}

function persistAndRender(state: AppState): void {
  state.intent = null;
  localStorage.setItem(CART_STORAGE_KEY, serializeCart(state.cart));
  renderCart(state);
}

function bindInteractions(state: AppState): void {
  document.addEventListener('change', (event) => {
    const select = (event.target as Element).closest<HTMLSelectElement>('[data-variant-select]');
    if (!select) return;
    const product = state.catalog.products.find((item) => item.id === select.dataset.variantSelect);
    const variant = product?.variants.find((item) => item.sku === select.value);
    const card = select.closest<HTMLElement>('[data-product-card]');
    const price = card?.querySelector<HTMLElement>('[data-product-price]');
    if (price && variant) price.textContent = `${variant.tokenAmount} ${state.config.payment.token.symbol}`;
  });

  document.addEventListener('click', (event) => {
    const target = event.target as Element;
    const productButton = target.closest<HTMLButtonElement>('[data-add-product]');
    if (productButton) {
      const product = state.catalog.products.find((item) => item.id === productButton.dataset.addProduct);
      const select = document.querySelector<HTMLSelectElement>(`[data-variant-select="${CSS.escape(productButton.dataset.addProduct ?? '')}"]`);
      const variant = product?.variants.find((item) => item.sku === select?.value && item.available);
      if (product && variant && product.status === 'active') {
        state.cart = addCartLine(state.cart, variant.sku);
        persistAndRender(state);
        const announcer = document.querySelector<HTMLElement>('[data-announcer]');
        if (announcer) announcer.textContent = `${product.name} added to cart.`;
        openCart();
      }
    }

    const increment = target.closest<HTMLButtonElement>('[data-increment]');
    if (increment) {
      const line = state.cart.find((item) => item.sku === increment.dataset.increment);
      if (line) state.cart = setCartQuantity(state.cart, line.sku, line.quantity + 1);
      persistAndRender(state);
    }
    const decrement = target.closest<HTMLButtonElement>('[data-decrement]');
    if (decrement) {
      const line = state.cart.find((item) => item.sku === decrement.dataset.decrement);
      if (line) state.cart = setCartQuantity(state.cart, line.sku, line.quantity - 1);
      persistAndRender(state);
    }
    const remove = target.closest<HTMLButtonElement>('[data-remove]');
    if (remove) {
      state.cart = state.cart.filter((item) => item.sku !== remove.dataset.remove);
      persistAndRender(state);
    }
    if (target.closest('[data-open-cart]')) openCart();
    if (target.closest('[data-close-cart]') || target.matches('[data-drawer-backdrop]')) closeCart();
    if (target.closest('[data-proceed-checkout]')) {
      closeCart();
      document.querySelector('#checkout')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeCart();
  });
}

async function start(): Promise<void> {
  try {
    const [configValue, catalogValue] = await Promise.all([
      loadJson('./storefront.config.json'),
      loadJson('./catalog.json'),
    ]);
    const configResult = validateStorefrontConfig(configValue);
    if (!configResult.data) {
      renderFatal(configResult.errors);
      return;
    }
    const catalogResult = validateCatalog(catalogValue, configResult.data.payment.token.decimals);
    if (!catalogResult.data) {
      renderFatal(catalogResult.errors);
      return;
    }

    const state: AppState = {
      cart: readPersistedCart(localStorage.getItem(CART_STORAGE_KEY)),
      catalog: catalogResult.data,
      config: configResult.data,
      intent: null,
    };
    const validSkus = new Set(state.catalog.products.flatMap((product) => product.variants.map((variant) => variant.sku)));
    state.cart = state.cart.filter((line) => validSkus.has(line.sku));
    localStorage.setItem(CART_STORAGE_KEY, serializeCart(state.cart));
    renderShell(state.config, state.catalog);
    bindInteractions(state);
    renderCart(state);
  } catch (error) {
    renderFatal([error instanceof Error ? error.message : 'Unknown startup error.']);
  }
}

void start();
