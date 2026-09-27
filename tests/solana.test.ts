import { describe, expect, it } from 'vitest';
import { buildSolanaPayUrl, createPaymentIntent, isPaymentIntentCurrent } from '../src/domain/payment';
import { createReference, isSolanaAddress } from '../src/domain/solana';
import type { StorefrontConfig } from '../src/domain/types';

const config: StorefrontConfig = {
  schemaVersion: 1,
  storefront: {
    name: 'Test Store', shortName: 'TS', tagline: 'Test', description: 'Test', disclaimer: 'Test',
    theme: { accent: '#6f1717', background: '#eee6d4' },
  },
  payment: {
    enabled: true,
    network: 'devnet',
    recipient: '11111111111111111111111111111111',
    token: { symbol: 'TEST', mint: 'So11111111111111111111111111111111111111112', decimals: 6 },
    label: 'Test store', memoPrefix: 'TEST-DEV', blockedMints: ['14kH2osUyEJnqBZ7yFK4pLKJGuPZU4pr1enhi2ZLEmRw'],
  },
};

describe('Solana payment primitives', () => {
  it('validates 32-byte base58 public keys', () => {
    expect(isSolanaAddress('11111111111111111111111111111111')).toBe(true);
    expect(isSolanaAddress('14kH2osUyEJnqBZ7yFK4pLKJGuPZU4pr1enhi2ZLEmRw')).toBe(true);
    expect(isSolanaAddress('not-a-wallet')).toBe(false);
  });

  it('creates a valid unique-reference public key', () => {
    const reference = createReference(new Uint8Array(32).fill(7));
    expect(isSolanaAddress(reference)).toBe(true);
  });

  it('invalidates a payment intent after cart changes', () => {
    const intent = createPaymentIntent([{ sku: 'SKU-A', quantity: 1 }], 'TEST-DEV', new Uint8Array(32).fill(7));
    expect(isPaymentIntentCurrent(intent, [{ sku: 'SKU-A', quantity: 1 }])).toBe(true);
    expect(isPaymentIntentCurrent(intent, [{ sku: 'SKU-A', quantity: 2 }])).toBe(false);
  });

  it('encodes the exact Solana Pay transfer request', () => {
    const intent = createPaymentIntent([{ sku: 'SKU-A', quantity: 1 }], 'TEST-DEV', new Uint8Array(32).fill(7));
    const url = new URL(buildSolanaPayUrl(config, '30.5', intent, 1));
    expect(url.protocol).toBe('solana:');
    expect(url.pathname).toBe(config.payment.recipient);
    expect(url.searchParams.get('amount')).toBe('30.5');
    expect(url.searchParams.get('spl-token')).toBe(config.payment.token.mint);
    expect(url.searchParams.get('reference')).toBe(intent.reference);
    expect(url.searchParams.get('memo')).toBe(intent.memo);
  });
});
