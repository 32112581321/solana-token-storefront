import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { RuntimeFiles } from './config.js';
import { InventoryDatabase } from './database.js';

const runtime: RuntimeFiles = {
  storefrontName: 'Test Store',
  payment: {
    enabled: true,
    network: 'devnet',
    recipient: '8YRJP9pHJJtcDqX29hwGKmCmvBwmcyoCaKmFnyk43UNL',
    token: {
      symbol: 'TEST',
      mint: 'FAM2TEFYrRXFVQ8W16SkPwaeZyWPcLnjieiTMYvc6Kpw',
      decimals: 6,
    },
    label: 'Test Store',
    memoPrefix: 'TEST-DEV',
    blockedMints: [],
  },
  reservationMinutes: 15,
  variants: new Map([['SKU-1', { sku: 'SKU-1', tokenAmount: '2.5' }]]),
};

describe('inventory ledger', () => {
  it('prevents overselling and releases cancelled reservations', () => {
    const database = new InventoryDatabase(':memory:', runtime);
    database.changeStock('SKU-1', 2, 'Initial stock');
    const reservation = database.createReservation({
      schemaVersion: 1,
      cartVersion: 1,
      lines: [{ sku: 'SKU-1', quantity: 2 }],
    });
    assert.equal(reservation.amountMinorUnits, '5000000');
    assert.equal(database.getInventory().items[0]?.available, 0);
    assert.throws(() => database.createReservation({
      schemaVersion: 1,
      cartVersion: 1,
      lines: [{ sku: 'SKU-1', quantity: 1 }],
    }), /0 available/);
    assert.equal(database.cancelReservation(reservation.id), true);
    assert.equal(database.getInventory().items[0]?.available, 2);
    database.close();
  });

  it('commits stock only after a verified-payment transition', () => {
    const database = new InventoryDatabase(':memory:', runtime);
    database.changeStock('SKU-1', 3, 'Initial stock');
    const reservation = database.createReservation({
      schemaVersion: 1,
      cartVersion: 1,
      lines: [{ sku: 'SKU-1', quantity: 2 }],
    });
    assert.equal(database.markPaid(reservation.id, 'test-signature'), 'fulfillment_pending');
    assert.equal(database.getInventory().items[0]?.onHand, 1);
    assert.equal(database.getOrder(reservation.id)?.status, 'fulfillment_pending');
    database.fulfill(reservation.id);
    assert.equal(database.getOrder(reservation.id)?.status, 'fulfilled');
    database.close();
  });

  it('expires reservations without changing on-hand stock', () => {
    const database = new InventoryDatabase(':memory:', runtime);
    const start = new Date('2026-01-01T00:00:00.000Z');
    database.changeStock('SKU-1', 1, 'Initial stock', start);
    const reservation = database.createReservation({
      schemaVersion: 1,
      cartVersion: 1,
      lines: [{ sku: 'SKU-1', quantity: 1 }],
    }, start);
    const later = new Date('2026-01-01T00:16:00.000Z');
    assert.equal(database.getInventory(later).items[0]?.available, 1);
    assert.equal(database.getOrder(reservation.id)?.status, 'expired');
    database.close();
  });
});
