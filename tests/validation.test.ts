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

  it('keeps old static configurations compatible and validates service mode', () => {
    expect(validateStorefrontConfig(validConfig).errors).toEqual([]);
    const service = structuredClone(validConfig) as typeof validConfig & {
      inventory: { mode: string; serviceUrl?: string; reservationMinutes: number };
    };
    service.inventory = { mode: 'service', reservationMinutes: 15 };
    expect(validateStorefrontConfig(service).errors).toContain('inventory.serviceUrl is required in service mode.');
    service.inventory.serviceUrl = 'http://127.0.0.1:8787';
    expect(validateStorefrontConfig(service).errors).toEqual([]);
  });

  it('rejects the known blocked mainnet mint', () => {
    const changed = structuredClone(validConfig);
    changed.payment.token.mint = changed.payment.blockedMints[0] ?? '';
    changed.payment.recipient = '11111111111111111111111111111111';
    changed.payment.enabled = true;
    expect(validateStorefrontConfig(changed).errors).toContain('payment.token.mint is blocked for this devnet storefront.');
    changed.payment.blockedMints = [];
    expect(validateStorefrontConfig(changed).errors).toContain('payment.token.mint is blocked for this devnet storefront.');
  });

  it('accepts old configurations and validates an optional public RPC URL', () => {
    for (const rpcUrl of ['https://api.devnet.solana.com', 'http://127.0.0.1:8899']) {
      expect(validateStorefrontConfig({ ...validConfig, payment: { ...validConfig.payment, rpcUrl } }).errors).toEqual([]);
    }
    for (const rpcUrl of ['', 'http://remote.example', 'https://user:password@example.com', 'javascript:alert(1)', 'https://example.com/#secret']) {
      expect(validateStorefrontConfig({ ...validConfig, payment: { ...validConfig.payment, rpcUrl } }).errors.join()).toContain('payment.rpcUrl');
    }
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
