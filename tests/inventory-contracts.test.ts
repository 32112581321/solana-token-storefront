import { describe, expect, it } from 'vitest';
import { decodeInventorySnapshot, decodeReservationResponse } from '../shared/inventory-contracts';

describe('inventory service contracts', () => {
  it('decodes a consistent inventory snapshot', () => {
    expect(decodeInventorySnapshot({
      schemaVersion: 1,
      generatedAt: '2026-01-01T00:00:00.000Z',
      items: [{ sku: 'SKU-1', onHand: 3, reserved: 1, available: 2, revision: 4 }],
    }).items[0]?.available).toBe(2);
    expect(() => decodeInventorySnapshot({
      schemaVersion: 1,
      generatedAt: '2026-01-01T00:00:00.000Z',
      items: [{ sku: 'SKU-1', onHand: 3, reserved: 1, available: 3, revision: 4 }],
    })).toThrow(/invalid item/);
  });

  it('rejects malformed reservation amounts and lines', () => {
    const reservation = {
      schemaVersion: 1,
      id: 'order-1',
      status: 'reserved',
      createdAt: '2026-01-01T00:00:00.000Z',
      expiresAt: '2026-01-01T00:15:00.000Z',
      lines: [{ sku: 'SKU-1', quantity: 1, unitAmountMinor: '2500000' }],
      amountMinorUnits: '2500000',
      amount: '2.5',
      token: { symbol: 'TEST', mint: 'mint', decimals: 6 },
      recipient: 'recipient',
      reference: 'reference',
      label: 'Store',
      message: '1 item from Store',
      memo: 'TEST-reference',
    };
    expect(decodeReservationResponse(reservation).status).toBe('reserved');
    expect(() => decodeReservationResponse({ ...reservation, amountMinorUnits: 2_500_000 })).toThrow(/invalid reservation envelope/);
  });
});
