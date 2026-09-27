import { expect, test } from '@playwright/test';

const enabledConfig = {
  schemaVersion: 1,
  storefront: {
    name: 'DRU Supply Office', shortName: 'DRU', tagline: 'Wear the history. Spend the token.',
    description: 'Test storefront', disclaimer: 'Devnet test only.',
    theme: { accent: '#6f1717', background: '#eee6d4' },
  },
  payment: {
    enabled: true,
    network: 'devnet',
    recipient: '11111111111111111111111111111111',
    token: { symbol: 'TEST DRU', mint: 'So11111111111111111111111111111111111111112', decimals: 6 },
    label: 'DRU Supply Office test', memoPrefix: 'DRU-DEV',
    blockedMints: ['14kH2osUyEJnqBZ7yFK4pLKJGuPZU4pr1enhi2ZLEmRw'],
  },
};

test('offers explicit commerce controls without outbound store links', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Add to cart' })).toHaveCount(8);
  await expect(page.getByText('Not available to add')).toHaveCount(3);
  await expect(page.locator('a[href*="wbsapparel.shop"]')).toHaveCount(0);
  await expect(page.locator('img[src^="http"]')).toHaveCount(0);
});

test('selects a variant, persists the cart, and supports keyboard closing', async ({ page }) => {
  await page.goto('/');
  const firstCard = page.locator('[data-product-card]').first();
  await firstCard.locator('select').selectOption('DRU-IST-TANK-M');
  await firstCard.getByRole('button', { name: 'Add to cart' }).click();
  await expect(page.locator('[data-cart-count]')).toHaveText('1');
  await expect(page.locator('[data-cart-drawer]')).toHaveAttribute('aria-hidden', 'false');
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-cart-drawer]')).toHaveAttribute('aria-hidden', 'true');
  await page.reload();
  await expect(page.locator('[data-cart-count]')).toHaveText('1');
  await page.getByRole('button', { name: 'Open cart' }).click();
  await page.getByRole('button', { name: 'Increase quantity' }).click();
  await expect(page.locator('[data-cart-count]')).toHaveText('2');
});

test('fails closed when payment configuration is disabled', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-product-card]').first().getByRole('button', { name: 'Add to cart' }).click();
  await page.getByRole('button', { name: 'Continue to devnet payment' }).click();
  await expect(page.getByText('Checkout is intentionally disabled.')).toBeVisible();
  await expect(page.locator('[data-wallet-link]')).toHaveCount(0);
  await expect(page.locator('.qr-frame')).toHaveCount(0);
});

test('creates an exact devnet QR and wallet handoff when configured', async ({ page }) => {
  await page.route('**/storefront.config.json', async (route) => {
    await route.fulfill({ json: enabledConfig });
  });
  await page.goto('/');
  await page.locator('[data-product-card]').first().getByRole('button', { name: 'Add to cart' }).click();
  await page.getByRole('button', { name: 'Continue to devnet payment' }).click();
  const walletLink = page.locator('[data-wallet-link]');
  await expect(walletLink).toBeVisible();
  const href = await walletLink.getAttribute('href');
  expect(href).toContain('solana:11111111111111111111111111111111?');
  expect(href).toContain('amount=30');
  expect(href).toContain('spl-token=So11111111111111111111111111111111111111112');
  expect(href).toContain('reference=');
  await expect(page.locator('.qr-frame img')).toBeVisible();
  await expect(page.getByText('No success state is shown.')).toBeVisible();
});

test('keeps the shopping flow usable on a phone viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const firstAdd = page.locator('[data-product-card]').first().getByRole('button', { name: 'Add to cart' });
  await expect(firstAdd).toBeVisible();
  await firstAdd.click();
  await expect(page.locator('[data-cart-drawer]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue to devnet payment' })).toBeVisible();
});

test('presents an adjustable and clearly hypothetical campaign case study', async ({ page }) => {
  await page.goto('/case-study.html');
  await expect(page.getByRole('heading', { name: 'Turn a merch drop into a community ritual.' })).toBeVisible();
  await expect(page.getByText('Hypothetical case study.')).toBeVisible();
  await expect(page.getByText('No token-price outcome is assumed.')).toBeVisible();
  await expect(page.locator('[data-result="revenue"]')).toHaveText('$26,813');
  await page.locator('[data-input="impressions"]').fill('2500000');
  await expect(page.locator('[data-result="revenue"]')).toHaveText('$55,860');
  await expect(page.getByText('This is a commercial experiment, not an investment product.')).toBeVisible();
});
