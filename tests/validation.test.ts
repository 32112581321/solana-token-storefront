import { describe, expect, it } from 'vitest';
import { validateCatalog, validateStorefrontConfig } from '../src/domain/validation';

const validConfig = {
  schemaVersion: 1,
  storefront: {
    name: 'Store', shortName: 'S', tagline: 'Tagline', description: 'Description', disclaimer: 'Disclaimer',
    theme: { accent: '#6f1717', background: '#eee6d4' },
  },
  payment: {
    enabled: false, network: 'devnet', recipient: '',
    token: { symbol: 'TEST', mint: '', decimals: 6 },
    label: 'Store test', memoPrefix: 'STORE-DEV',
    blockedMints: ['14kH2osUyEJnqBZ7yFK4pLKJGuPZU4pr1enhi2ZLEmRw'],
  },
};

const validCatalog = {
  schemaVersion: 1,
  products: [{
    id: 'shirt', slug: 'shirt', name: 'Shirt', description: 'A shirt', status: 'active',
    images: [{ src: './images/products/shirt.png', alt: 'A shirt' }],
    optionGroups: [{ id: 'size', label: 'Size', values: ['S'] }],
    variants: [{ sku: 'SHIRT-S', options: { size: 'S' }, tokenAmount: '10', available: true }],
  }],
};

describe('public configuration validation', () => {
  it('allows a valid disabled starter configuration', () => {
    expect(validateStorefrontConfig(validConfig).errors).toEqual([]);
    expect(validateCatalog(validCatalog, 6).errors).toEqual([]);
  });

  it('rejects the known blocked mainnet mint', () => {
    const changed = structuredClone(validConfig);
    changed.payment.token.mint = changed.payment.blockedMints[0] ?? '';
    changed.payment.recipient = '11111111111111111111111111111111';
    changed.payment.enabled = true;
    expect(validateStorefrontConfig(changed).errors).toContain('payment.token.mint is blocked for this devnet storefront.');
  });

  it('rejects remote images and shop links', () => {
    const changed = structuredClone(validCatalog);
    changed.products[0]!.images[0]!.src = 'https://example.com/shirt.png';
    Object.assign(changed.products[0]!, { href: 'https://example.com/product' });
    const errors = validateCatalog(changed, 6).errors.join(' ');
    expect(errors).toContain('must be a local path');
    expect(errors).toContain('must not link to another shop');
  });
});
