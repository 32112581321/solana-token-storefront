import { expect, test } from '@playwright/test';
import graph from '../public/roadmap/graph.json' with { type: 'json' };

test('links the released roadmap from storefront and case study', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('link', { name: 'Roadmap', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('A roadmap.Not a promise.');
  await expect(page.getByText('No vault deposits accepted.', { exact: false })).toBeVisible();
  await expect(page.locator('.task-card')).toHaveCount(19);
  await expect(page.getByRole('link', { name: 'Download graph JSON' })).toHaveAttribute('href', './roadmap/graph.json');
  await expect(page.locator('a[href^="solana:"]')).toHaveCount(0);
  await page.getByRole('navigation', { name: 'Roadmap navigation' }).getByRole('link', { name: 'Case study' }).click();
  await page.getByRole('navigation', { name: 'Case study navigation' }).getByRole('link', { name: 'Roadmap', exact: true }).click();
  await expect(page.locator('.task-card')).toHaveCount(19);
});

test('filters, searches, follows dependencies and exposes evidence with a keyboard', async ({ page }) => {
  await page.goto('/roadmap.html');
  await page.getByRole('combobox', { name: 'Delivery', exact: true }).selectOption('implemented');
  await expect(page.locator('.task-card')).toHaveCount(3);
  await expect(page.getByRole('status')).toHaveText('3 of 19 tasks shown');
  const details = page.locator('#sts-storefront summary');
  await details.focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#sts-storefront').getByRole('link', { name: 'src/main.ts' })).toBeVisible();
  await page.getByRole('button', { name: 'Reset filters' }).click();
  await page.getByLabel('Find work').fill('no-such-task');
  await expect(page.getByText('No matching work.', { exact: false })).toBeVisible();
  await page.getByLabel('Find work').fill('Rehearse both real wallet extensions');
  await expect(page.locator('.task-card')).toHaveCount(1);
  await page.locator('#sts-wallet-rehearsal').getByRole('link', { name: 'Phantom and MetaMask integration' }).click();
  await expect(page.locator('#sts-wallet-code')).toBeFocused();
  await expect(page.locator('#sts-wallet-code details')).toHaveAttribute('open', '');
  await expect(page.getByLabel('Find work')).toHaveValue('');
  await expect(page.locator('.task-card')).toHaveCount(19);
});

test('renders the authored data, escapes content and fails closed on incompatible graphs', async ({ page }) => {
  const changed = structuredClone(graph);
  changed.work.find(work => work.id === 'sts-reserve-simulator')!.title = '<img src=x onerror=alert(1)> unsafe title';
  await page.route('**/roadmap/graph.json', route => route.fulfill({ json: changed }));
  await page.goto('/roadmap.html');
  await expect(page.locator('#sts-reserve-simulator h4')).toHaveText('<img src=x onerror=alert(1)> unsafe title');
  await expect(page.locator('#sts-reserve-simulator img')).toHaveCount(0);
  changed.schema = 'unrecognized';
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('did not pass validation');
  await expect(page.locator('.task-card')).toHaveCount(0);
});

test('handles unavailable graph without showing fabricated progress', async ({ page }) => {
  await page.route('**/roadmap/graph.json', route => route.fulfill({ status: 503, body: 'Unavailable' }));
  await page.goto('/roadmap.html');
  await expect(page.getByRole('heading', { name: 'Roadmap unavailable' })).toBeVisible();
  await expect(page.locator('.roadmap-overview')).toHaveCount(0);
});

test('keeps the roadmap usable on narrow screens and task deep links', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/roadmap.html#sts-contributor-terms');
  await expect(page.locator('#sts-contributor-terms')).toBeFocused();
  await expect(page.locator('#sts-contributor-terms details')).toHaveAttribute('open', '');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('combobox', { name: 'Delivery', exact: true }).selectOption('gated');
  await expect(page.locator('.task-card')).toHaveCount(6);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
