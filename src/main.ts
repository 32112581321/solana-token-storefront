import QRCode from 'qrcode';
import './styles.css';
import {
  decodeInventorySnapshot,
  decodeReservationResponse,
  type InventorySnapshot,
  type ReservationResponse,
} from '../shared/inventory-contracts';
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
import { connectWallet, type WalletName, type WalletSession } from './wallets';

const root = document.querySelector<HTMLDivElement>('#app')!;
if (!root) throw new Error('Missing #app root.');

interface AppState {
  cart: CartLine[];
  catalog: Catalog;
  config: StorefrontConfig;
  intent: PaymentIntent | null;
  inventory: Map<string, number> | null;
  reservation: ReservationResponse | null;
  reservationError: string | null;
  reservationPending: boolean;
  wallet: WalletSession | null;
  walletBusy: string | null;
  walletError: string | null;
  receipt: { signature: string; reference: string; amount: string; status: string } | null;
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

function isServiceMode(config: StorefrontConfig): boolean {
  return config.inventory?.mode === 'service';
}

function inventoryLimit(state: AppState, sku: string): number {
  return state.inventory?.get(sku) ?? (isServiceMode(state.config) ? 0 : Number.POSITIVE_INFINITY);
}

function renderProductCard(product: Product, symbol: string, inventory: Map<string, number> | null): string {
  const variants = product.variants.filter((variant) => variant.available && (inventory?.get(variant.sku) ?? 1) > 0);
  const options = variants.map((variant) => `<option value="${escapeHtml(variant.sku)}">
    ${escapeHtml(displayVariant(product, variant))} — ${escapeHtml(variant.tokenAmount)} ${escapeHtml(symbol)}${inventory ? ` · ${inventory.get(variant.sku) ?? 0} left` : ''}
  </option>`).join('');
  const firstVariant = variants[0];
  return `<article class="product-card" data-product-card="${escapeHtml(product.id)}">
    <div class="product-image">
      <img src="${escapeHtml(product.images[0]?.src ?? '')}" alt="${escapeHtml(product.images[0]?.alt ?? product.name)}" loading="lazy">
      <span class="product-badge">${variants.length ? 'Available' : 'Out of stock'}</span>
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

function renderShell(config: StorefrontConfig, catalog: Catalog, inventory: Map<string, number> | null): void {
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
        <a href="./case-study.html">Case study</a>
        <a href="./roadmap.html">Roadmap</a>
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
            <a class="button button-secondary" href="./case-study.html">Read the campaign case study</a>
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
            <div><dt>Inventory</dt><dd>${isServiceMode(config) ? 'Locally tracked' : 'Static catalog'}</dd></div>
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
        <div class="product-grid" data-product-grid>${active.map((product) => renderProductCard(product, symbol, inventory)).join('')}</div>
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
      <span><a href="./case-study.html">Hypothetical campaign case study</a> · <a href="./roadmap.html">Public roadmap</a> · Forkable storefront</span>
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
            <button type="button" data-increment="${escapeHtml(line.sku)}" aria-label="Increase quantity" ${line.quantity >= inventoryLimit(state, line.sku) ? 'disabled' : ''}>+</button>
          </div>
        </div>
        <button class="remove-button" type="button" data-remove="${escapeHtml(line.sku)}">Remove</button>
      </article>`).join('')}</div>
      <div class="cart-summary">
        <div><span>Exact merchandise total</span><strong>${escapeHtml(total)} ${escapeHtml(symbol)}</strong></div>
        <p>${isServiceMode(state.config) ? 'Stock will be reserved before the payment request is created. No delivery information is collected.' : 'No shipping, tax, order, or fulfillment is created in static mode.'}</p>
        <button class="button button-primary checkout-button" type="button" data-proceed-checkout ${state.reservationPending ? 'disabled' : ''}>${state.reservationPending ? 'Reserving inventory…' : 'Continue to devnet payment'}</button>
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

  if (isServiceMode(state.config) && state.reservationPending) {
    container.innerHTML = `${summary}<div class="checkout-notice"><strong>Reserving inventory…</strong><p>The local service is checking stock and creating an expiring order snapshot.</p></div>`;
    return;
  }
  if (isServiceMode(state.config) && state.reservationError) {
    container.innerHTML = `${summary}<div class="checkout-notice warning"><strong>Inventory reservation failed.</strong><p>${escapeHtml(state.reservationError)}</p><p>Update the cart or try checkout again.</p></div>`;
    return;
  }
  if (state.reservation && Date.parse(state.reservation.expiresAt) <= Date.now() && !state.receipt && !state.walletBusy) {
    state.reservationError = 'This reservation expired. Continue from the cart to reserve again before paying.';
    await renderCheckout(state);
    return;
  }
  if (isServiceMode(state.config) && !state.reservation) {
    container.innerHTML = `${summary}<div class="checkout-notice"><strong>Inventory service is ready.</strong><p>Continue from the cart to reserve stock and generate a payment request. No QR is issued before a reservation succeeds.</p></div>`;
    return;
  }

  const intent = isServiceMode(state.config)
    ? {
      cartFingerprint: cartFingerprint(state.cart),
      reference: state.reservation!.reference,
      memo: state.reservation!.memo,
    }
    : (isPaymentIntentCurrent(state.intent, state.cart)
      ? state.intent!
      : createPaymentIntent(state.cart, state.config.payment.memoPrefix));
  state.intent = intent;
  const fingerprint = cartFingerprint(state.cart);
  const reservation = state.reservation;
  const url = reservation
    ? `solana:${reservation.recipient}?${new URLSearchParams({
      amount: reservation.amount,
      'spl-token': reservation.token.mint,
      reference: reservation.reference,
      label: reservation.label,
      message: reservation.message,
      memo: reservation.memo,
    }).toString()}`
    : buildSolanaPayUrl(state.config, amount, intent, itemCount);
  const orderDetails = reservation
    ? `<small>Order: <code>${escapeHtml(reservation.id)}</code> · Reserved until ${escapeHtml(new Date(reservation.expiresAt).toLocaleTimeString())}</small>`
    : '';
  const boundary = reservation
    ? '<div class="checkout-notice warning"><strong>Payment is not automatic fulfillment.</strong><p>The merchant must reconcile the finalized devnet transaction from the local CLI before stock becomes fulfillment-pending.</p></div>'
    : '<div class="checkout-notice warning"><strong>No success state is shown.</strong><p>This static template cannot verify settlement or trigger fulfillment.</p></div>';
  const allowHandoff = !state.walletBusy && !state.receipt;
  container.innerHTML = `${summary}<div class="checkout-ready">${walletPanel(state, amount)}
    ${allowHandoff ? `<details class="wallet-alternative"><summary>Alternative: Solana Pay QR / wallet link</summary><p>This URI cannot select a network. Only use a compatible wallet already set to <strong>devnet</strong>. MetaMask users should use Connect MetaMask above.</p><div class="qr-frame"><span>Preparing QR…</span></div><a class="button button-secondary" href="${escapeHtml(url)}" data-wallet-link>Open wallet</a></details>` : ''}
    <div class="checkout-actions"><a class="button button-secondary" href="https://explorer.solana.com/address/${escapeHtml(state.config.payment.token.mint)}?cluster=devnet" target="_blank" rel="noreferrer">Inspect devnet mint</a><a class="button button-secondary" href="./devnet-proof.json" target="_blank" rel="noreferrer" data-devnet-proof>View verified test transfer</a></div>${orderDetails}<small>Reference: <code>${escapeHtml(intent.reference)}</code></small>${boundary}</div>`;

  if (!allowHandoff) return;
  try {
    const dataUrl = await QRCode.toDataURL(url, { width: 320, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#120d0b', light: '#fffaf0' } });
    if (fingerprint !== cartFingerprint(state.cart) || state.intent?.reference !== intent.reference || state.walletBusy || state.receipt) return;
    const frame = container.querySelector<HTMLElement>('.qr-frame');
    if (frame) frame.innerHTML = `<img src="${dataUrl}" alt="Solana Pay QR code for ${escapeHtml(amount)} ${escapeHtml(symbol)} on devnet">`;
  } catch {
    const frame = container.querySelector<HTMLElement>('.qr-frame');
    if (frame) frame.textContent = 'QR generation failed. Use the wallet link instead.';
  }
}

function walletPanel(state: AppState, amount: string): string {
  const busy = state.walletBusy;
  const receipt = state.receipt;
  return `<section class="wallet-panel" aria-label="Connected wallet checkout">
    <h3>Approve a test payment in your wallet</h3>
    <p>Use a desktop browser with Phantom or MetaMask installed. In Phantom, enable Settings → Developer Settings → Testnet Mode and select Solana Devnet. MetaMask mobile does not support Solana devnet.</p>
    ${state.wallet ? `<p>Connected to ${state.wallet.name} · Solana devnet<br><code class="wallet-address">${escapeHtml(state.wallet.address)}</code></p>
      <div class="checkout-actions"><button class="button button-primary" type="button" data-pay-wallet ${busy || receipt ? 'disabled' : ''}>Pay ${escapeHtml(amount)} ${escapeHtml(state.config.payment.token.symbol)} on devnet</button><button class="button button-secondary" type="button" data-disconnect-wallet ${busy ? 'disabled' : ''}>Disconnect</button></div>`
    : `<div class="checkout-actions"><button class="button button-primary" type="button" data-connect-wallet="Phantom" ${busy || receipt ? 'disabled' : ''}>Connect Phantom</button><button class="button button-secondary" type="button" data-connect-wallet="MetaMask" ${busy || receipt ? 'disabled' : ''}>Connect MetaMask</button></div>`}
    <p class="wallet-status" role="status">${escapeHtml(busy ?? '')}</p>
    ${state.walletError ? `<p class="checkout-notice warning" role="alert">${escapeHtml(state.walletError)}</p>` : ''}
    ${receipt ? `<div class="checkout-notice" data-transaction-receipt><strong>${escapeHtml(receipt.status)}</strong><p>${escapeHtml(receipt.amount)} ${escapeHtml(state.config.payment.token.symbol)} · Solana devnet. This is not an order or fulfillment confirmation. Do not pay again before checking this transaction.</p><a href="https://explorer.solana.com/tx/${escapeHtml(receipt.signature)}?cluster=devnet" target="_blank" rel="noreferrer">Inspect this transaction on devnet</a><code class="wallet-address">${escapeHtml(receipt.signature)}</code></div>` : ''}
    <details><summary>Need test SOL or TEST DRU?</summary><p>You need tokens of the exact mint shown above, plus at least 0.01 devnet SOL for fees and account rent. Give the demo operator your connected public Solana address to request test tokens. Never share a seed phrase or private key.</p><p><a href="https://faucet.solana.com/" target="_blank" rel="noreferrer">Devnet SOL faucet</a> · <a href="https://phantom.com/" target="_blank" rel="noreferrer">Install Phantom</a> · <a href="https://metamask.io/" target="_blank" rel="noreferrer">Install MetaMask</a></p><p>Do not buy or send real SOL or mainnet DRU for this test. Connecting does not authorize payment; review the separate signing prompt.</p></details>
  </section>`;
}

function walletError(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error && error.code === 4001) return 'Request declined in your wallet. Nothing was submitted by this storefront.';
  return error instanceof Error ? error.message : 'Wallet request failed. Check your extension and devnet settings.';
}

async function beginWalletConnection(state: AppState, name: WalletName): Promise<void> {
  if (state.walletBusy || state.receipt) return;
  state.walletBusy = `Unlock ${name} and approve the connection. Cart editing is paused while the request is open.`;
  state.walletError = null;
  void renderCheckout(state);
  try {
    const session = await connectWallet(name, state.config, () => {
      state.wallet = null;
      state.walletError = 'Wallet account or network changed. Reconnect before paying.';
      void renderCheckout(state);
    });
    state.wallet = session;
  } catch (error) {
    state.walletError = walletError(error);
  } finally {
    state.walletBusy = null;
    void renderCheckout(state);
  }
}

async function payWithWallet(state: AppState): Promise<void> {
  if (!state.wallet || state.walletBusy || state.receipt || !state.intent || !state.config.payment.enabled) return;
  const session = state.wallet;
  const intent = state.intent;
  const units = cartTotalUnits(resolveCart(state.cart, state.catalog, state.config.payment.token.decimals));
  const assertCurrent = () => {
    if (state.wallet !== session || state.intent?.reference !== intent.reference || !isPaymentIntentCurrent(intent, state.cart)) throw new Error('The wallet or cart changed. Nothing was submitted.');
    if (isServiceMode(state.config) && (!state.reservation || Date.parse(state.reservation.expiresAt) <= Date.now())) throw new Error('Reservation expired. Reserve stock again before paying.');
  };
  state.walletBusy = 'Checking devnet, mint, test balances and transaction simulation…';
  state.walletError = null;
  void renderCheckout(state);
  try {
    assertCurrent();
    const { preparePayment, inspectSignedPayment } = await import('./domain/transaction');
    const prepared = await preparePayment(state.config, session.address, units, intent);
    assertCurrent();
    state.walletBusy = `Review and approve in ${session.name}. Cart editing is paused. Only devnet test tokens will be sent.`;
    void renderCheckout(state);
    const signed = await session.sign(prepared.bytes);
    assertCurrent();
    const inspected = inspectSignedPayment(prepared.bytes, signed);
    const height = await prepared.rpc.getBlockHeight({ commitment: 'confirmed' }).send({ abortSignal: AbortSignal.timeout(20_000) });
    if (height > prepared.lifetime.lastValidBlockHeight) throw new Error('The signing request expired. Nothing was submitted; try again for a fresh blockhash.');
    assertCurrent();
    // Record the signature BEFORE broadcasting. A timeout is ambiguous, never a safe automatic retry.
    state.receipt = { signature: inspected.signature, reference: intent.reference, amount: formatTokenAmount(units, state.config.payment.token.decimals), status: 'Submission in progress—do not pay again.' };
    state.walletBusy = 'Submitting the signed transaction to devnet…';
    void renderCheckout(state);
    const acknowledged = await prepared.rpc.sendTransaction(inspected.wire, { encoding: 'base64', preflightCommitment: 'confirmed', skipPreflight: false, maxRetries: 3n }).send({ abortSignal: AbortSignal.timeout(30_000) });
    if (acknowledged !== inspected.signature) throw new Error('RPC returned an unexpected signature. Inspect the signed transaction before another attempt.');
    state.receipt.status = 'Transaction submitted to devnet.';
  } catch (error) {
    if (state.receipt) state.receipt.status = 'Submission outcome unknown. Check the transaction before trying again.';
    state.walletError = walletError(error);
  } finally {
    state.walletBusy = null;
    void renderCheckout(state);
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
  const cancelledReservation = state.reservation;
  state.intent = null;
  state.reservation = null;
  state.reservationError = null;
  if (cancelledReservation && !state.receipt) void cancelReservation(state, cancelledReservation.id);
  state.receipt = null;
  state.walletError = null;
  localStorage.setItem(CART_STORAGE_KEY, serializeCart(state.cart));
  renderCart(state);
}

function inventoryUrl(config: StorefrontConfig, path: string): string {
  const base = config.inventory?.serviceUrl;
  if (!base) throw new Error('Inventory service URL is not configured.');
  return new URL(path.replace(/^\//, ''), `${base.replace(/\/$/, '')}/`).toString();
}

async function loadInventory(config: StorefrontConfig): Promise<Map<string, number>> {
  const response = await fetch(inventoryUrl(config, '/v1/inventory'), { cache: 'no-store' });
  const value = await response.json() as unknown;
  if (!response.ok) throw new Error(`Inventory service returned HTTP ${response.status}.`);
  const snapshot: InventorySnapshot = decodeInventorySnapshot(value);
  return new Map(snapshot.items.map((item) => [item.sku, item.available]));
}

async function cancelReservation(state: AppState, id: string): Promise<void> {
  try {
    await fetch(inventoryUrl(state.config, `/v1/reservations/${encodeURIComponent(id)}`), { method: 'DELETE' });
  } catch {
    // The short reservation will expire server-side even if the best-effort release fails.
  }
}

function assertReservationMatchesCart(state: AppState, reservation: ReservationResponse): void {
  const resolved = resolveCart(state.cart, state.catalog, state.config.payment.token.decimals);
  const expectedLines = [...resolved].sort((a, b) => a.sku.localeCompare(b.sku));
  const actualLines = [...reservation.lines].sort((a, b) => a.sku.localeCompare(b.sku));
  if (reservation.status !== 'reserved'
    || reservation.recipient !== state.config.payment.recipient
    || reservation.token.mint !== state.config.payment.token.mint
    || reservation.token.decimals !== state.config.payment.token.decimals
    || reservation.amountMinorUnits !== cartTotalUnits(resolved).toString()
    || actualLines.length !== expectedLines.length
    || actualLines.some((line, index) => line.sku !== expectedLines[index]?.sku || line.quantity !== expectedLines[index]?.quantity)) {
    throw new Error('Inventory service returned a reservation that does not match this cart.');
  }
  if (Date.parse(reservation.expiresAt) <= Date.now()) throw new Error('Inventory service returned an expired reservation.');
}

async function beginCheckout(state: AppState): Promise<void> {
  closeCart();
  document.querySelector('#checkout')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  if (!isServiceMode(state.config)) return;
  if (state.reservationPending || state.walletBusy || state.receipt) return;
  if (state.reservation && !state.reservationError && Date.parse(state.reservation.expiresAt) > Date.now()) return;
  state.reservationPending = true;
  state.reservationError = null;
  await renderCheckout(state);
  renderCart(state);
  try {
    const response = await fetch(inventoryUrl(state.config, '/v1/reservations'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ schemaVersion: 1, cartVersion: 1, lines: state.cart }),
    });
    const value = await response.json() as unknown;
    if (!response.ok) {
      const message = value && typeof value === 'object' && 'error' in value && typeof value.error === 'string'
        ? value.error
        : `Inventory service returned HTTP ${response.status}.`;
      throw new Error(message);
    }
    const reservation = decodeReservationResponse(value);
    assertReservationMatchesCart(state, reservation);
    state.reservation = reservation;
  } catch (error) {
    state.reservationError = error instanceof Error ? error.message : 'Inventory reservation failed.';
  } finally {
    state.reservationPending = false;
    renderCart(state);
  }
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
    const walletButton = target.closest<HTMLButtonElement>('[data-connect-wallet]');
    if (walletButton) void beginWalletConnection(state, walletButton.dataset.connectWallet as WalletName);
    if (target.closest('[data-pay-wallet]')) void payWithWallet(state);
    if (target.closest('[data-disconnect-wallet]') && !state.walletBusy) {
      const session = state.wallet;
      state.wallet = null;
      void session?.disconnect().catch(() => { /* Locally disconnected even if permission revocation fails. */ });
      void renderCheckout(state);
    }
    if ((state.walletBusy || state.reservationPending) && target.closest('[data-add-product], [data-increment], [data-decrement], [data-remove], [data-proceed-checkout]')) return;
    const productButton = target.closest<HTMLButtonElement>('[data-add-product]');
    if (productButton) {
      const product = state.catalog.products.find((item) => item.id === productButton.dataset.addProduct);
      const select = document.querySelector<HTMLSelectElement>(`[data-variant-select="${CSS.escape(productButton.dataset.addProduct ?? '')}"]`);
      const variant = product?.variants.find((item) => item.sku === select?.value && item.available && inventoryLimit(state, item.sku) > 0);
      if (product && variant && product.status === 'active') {
        const current = state.cart.find((line) => line.sku === variant.sku)?.quantity ?? 0;
        if (current >= inventoryLimit(state, variant.sku)) return;
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
      if (line && line.quantity < inventoryLimit(state, line.sku)) state.cart = setCartQuantity(state.cart, line.sku, line.quantity + 1);
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
      void beginCheckout(state);
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

    const inventory = isServiceMode(configResult.data)
      ? await loadInventory(configResult.data)
      : null;
    const state: AppState = {
      cart: readPersistedCart(localStorage.getItem(CART_STORAGE_KEY)),
      catalog: catalogResult.data,
      config: configResult.data,
      intent: null,
      inventory,
      reservation: null,
      reservationError: null,
      reservationPending: false,
      wallet: null,
      walletBusy: null,
      walletError: null,
      receipt: null,
    };
    const validSkus = new Set(state.catalog.products.flatMap((product) => product.variants.map((variant) => variant.sku)));
    state.cart = state.cart
      .filter((line) => validSkus.has(line.sku) && inventoryLimit(state, line.sku) > 0)
      .map((line) => ({ ...line, quantity: Math.min(line.quantity, inventoryLimit(state, line.sku)) }));
    localStorage.setItem(CART_STORAGE_KEY, serializeCart(state.cart));
    renderShell(state.config, state.catalog, state.inventory);
    bindInteractions(state);
    renderCart(state);
    window.setInterval(() => {
      if (state.reservation && !state.reservationError && !state.receipt && !state.walletBusy && Date.parse(state.reservation.expiresAt) <= Date.now()) void renderCheckout(state);
    }, 1_000);
  } catch (error) {
    renderFatal([error instanceof Error ? error.message : 'Unknown startup error.']);
  }
}

void start();
