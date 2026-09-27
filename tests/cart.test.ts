import { describe, expect, it } from 'vitest';
import { addCartLine, cartFingerprint, readPersistedCart, serializeCart, setCartQuantity } from '../src/domain/cart';

describe('cart state', () => {
  it('adds, increments, decrements, and removes SKU lines', () => {
    let lines = addCartLine([], 'SKU-A');
    lines = addCartLine(lines, 'SKU-A');
    expect(lines).toEqual([{ sku: 'SKU-A', quantity: 2 }]);
    lines = setCartQuantity(lines, 'SKU-A', 1);
    expect(lines[0]?.quantity).toBe(1);
    expect(setCartQuantity(lines, 'SKU-A', 0)).toEqual([]);
  });

  it('round-trips only the versioned minimal cart payload', () => {
    const serialized = serializeCart([{ sku: 'SKU-A', quantity: 2 }]);
    expect(readPersistedCart(serialized)).toEqual([{ sku: 'SKU-A', quantity: 2 }]);
    expect(readPersistedCart('{"version":2,"lines":[]}')).toEqual([]);
  });

  it('produces a stable fingerprint independent of line order', () => {
    expect(cartFingerprint([{ sku: 'B', quantity: 1 }, { sku: 'A', quantity: 2 }]))
      .toBe(cartFingerprint([{ sku: 'A', quantity: 2 }, { sku: 'B', quantity: 1 }]));
  });
});
