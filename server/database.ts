import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type {
  InventorySnapshot,
  OrderStatus,
  ReservationRequest,
  ReservationResponse,
} from '../shared/inventory-contracts.js';
import { formatMinorUnits, parseMinorUnits, type RuntimeFiles } from './config.js';

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

interface OrderRow {
  id: string;
  status: OrderStatus;
  created_at: string;
  expires_at: string;
  amount_minor_units: string;
  token_symbol: string;
  token_mint: string;
  token_decimals: number;
  recipient: string;
  reference: string;
  label: string;
  message: string;
  memo: string;
  payment_signature: string | null;
}

interface OrderLineRow {
  sku: string;
  quantity: number;
  unit_amount_minor: string;
}

interface InventoryRow {
  sku: string;
  on_hand: number;
  reserved: number;
  revision: number;
}

function encodeBase58(bytes: Uint8Array): string {
  let value = 0n;
  for (const byte of bytes) value = (value * 256n) + BigInt(byte);
  let encoded = '';
  while (value > 0n) {
    encoded = `${BASE58_ALPHABET[Number(value % 58n)]}${encoded}`;
    value /= 58n;
  }
  let leadingZeroes = 0;
  while (leadingZeroes < bytes.length && bytes[leadingZeroes] === 0) leadingZeroes += 1;
  return `${'1'.repeat(leadingZeroes)}${encoded}`;
}

function iso(date: Date): string {
  return date.toISOString();
}

export class InventoryDatabase {
  readonly db: DatabaseSync;

  constructor(
    readonly path: string,
    readonly runtime: RuntimeFiles,
  ) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS inventory_items (
        sku TEXT PRIMARY KEY,
        on_hand INTEGER NOT NULL DEFAULT 0 CHECK (on_hand >= 0),
        revision INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        amount_minor_units TEXT NOT NULL,
        token_symbol TEXT NOT NULL,
        token_mint TEXT NOT NULL,
        token_decimals INTEGER NOT NULL,
        recipient TEXT NOT NULL,
        reference TEXT NOT NULL UNIQUE,
        label TEXT NOT NULL,
        message TEXT NOT NULL,
        memo TEXT NOT NULL,
        payment_signature TEXT UNIQUE,
        paid_at TEXT,
        fulfilled_at TEXT
      );
      CREATE TABLE IF NOT EXISTS order_lines (
        order_id TEXT NOT NULL REFERENCES orders(id),
        sku TEXT NOT NULL REFERENCES inventory_items(sku),
        quantity INTEGER NOT NULL CHECK (quantity > 0),
        unit_amount_minor TEXT NOT NULL,
        PRIMARY KEY (order_id, sku)
      );
      CREATE TABLE IF NOT EXISTS inventory_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sku TEXT NOT NULL REFERENCES inventory_items(sku),
        event_type TEXT NOT NULL,
        quantity_delta INTEGER NOT NULL,
        reason TEXT NOT NULL,
        order_id TEXT REFERENCES orders(id),
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS orders_status_expiry ON orders(status, expires_at);
      CREATE INDEX IF NOT EXISTS order_lines_sku ON order_lines(sku);
    `);
    const now = iso(new Date());
    const insert = this.db.prepare('INSERT OR IGNORE INTO inventory_items (sku, on_hand, revision, updated_at) VALUES (?, 0, 0, ?)');
    this.writeTransaction(() => {
      for (const sku of runtime.variants.keys()) insert.run(sku, now);
    });
  }

  close(): void {
    this.db.close();
  }

  private writeTransaction<T>(operation: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = operation();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  private expireInsideTransaction(now: Date): number {
    const timestamp = iso(now);
    const expired = this.db.prepare("SELECT id FROM orders WHERE status = 'reserved' AND expires_at <= ?").all(timestamp) as unknown as Array<{ id: string }>;
    const lines = this.db.prepare('SELECT sku, quantity FROM order_lines WHERE order_id = ?');
    const event = this.db.prepare("INSERT INTO inventory_events (sku, event_type, quantity_delta, reason, order_id, created_at) VALUES (?, 'released', 0, 'Reservation expired', ?, ?)");
    const update = this.db.prepare("UPDATE orders SET status = 'expired' WHERE id = ? AND status = 'reserved'");
    for (const order of expired) {
      update.run(order.id);
      for (const line of lines.all(order.id) as unknown as Array<{ sku: string; quantity: number }>) {
        event.run(line.sku, order.id, timestamp);
      }
    }
    return expired.length;
  }

  expireReservations(now = new Date()): number {
    return this.writeTransaction(() => this.expireInsideTransaction(now));
  }

  getInventory(now = new Date()): InventorySnapshot {
    this.expireReservations(now);
    const rows = this.db.prepare(`
      SELECT i.sku, i.on_hand,
        COALESCE(SUM(CASE WHEN o.status = 'reserved' AND o.expires_at > ? THEN ol.quantity ELSE 0 END), 0) AS reserved,
        i.revision
      FROM inventory_items i
      LEFT JOIN order_lines ol ON ol.sku = i.sku
      LEFT JOIN orders o ON o.id = ol.order_id
      GROUP BY i.sku, i.on_hand, i.revision
      ORDER BY i.sku
    `).all(iso(now)) as unknown as InventoryRow[];
    return {
      schemaVersion: 1,
      generatedAt: iso(now),
      items: rows.map((row) => ({
        sku: row.sku,
        onHand: row.on_hand,
        reserved: row.reserved,
        available: Math.max(0, row.on_hand - row.reserved),
        revision: row.revision,
      })),
    };
  }

  changeStock(sku: string, delta: number, reason: string, now = new Date()): void {
    if (!this.runtime.variants.has(sku)) throw new Error(`Unknown active SKU: ${sku}`);
    if (!Number.isInteger(delta) || delta === 0) throw new Error('Stock change must be a non-zero integer.');
    if (!reason.trim()) throw new Error('A reason is required.');
    this.writeTransaction(() => {
      const current = this.db.prepare('SELECT on_hand FROM inventory_items WHERE sku = ?').get(sku) as unknown as { on_hand: number } | undefined;
      if (!current) throw new Error(`Inventory is not initialized for ${sku}.`);
      if (current.on_hand + delta < 0) throw new Error(`Stock change would make ${sku} negative.`);
      const timestamp = iso(now);
      this.db.prepare('UPDATE inventory_items SET on_hand = on_hand + ?, revision = revision + 1, updated_at = ? WHERE sku = ?')
        .run(delta, timestamp, sku);
      this.db.prepare('INSERT INTO inventory_events (sku, event_type, quantity_delta, reason, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(sku, delta > 0 ? 'received' : 'adjusted', delta, reason.trim(), timestamp);
    });
  }

  createReservation(request: ReservationRequest, now = new Date()): ReservationResponse {
    if (request.schemaVersion !== 1 || request.cartVersion !== 1 || !Array.isArray(request.lines) || request.lines.length === 0) {
      throw new Error('A versioned cart with at least one line is required.');
    }
    const seen = new Set<string>();
    const lines = request.lines.map((line) => {
      if (!line || typeof line.sku !== 'string' || !Number.isInteger(line.quantity) || line.quantity < 1) {
        throw new Error('Every reservation line requires a SKU and positive integer quantity.');
      }
      if (seen.has(line.sku)) throw new Error(`Duplicate reservation SKU: ${line.sku}`);
      seen.add(line.sku);
      const variant = this.runtime.variants.get(line.sku);
      if (!variant) throw new Error(`Unknown active SKU: ${line.sku}`);
      return { ...line, variant };
    });

    const createdAt = iso(now);
    const expiresAt = iso(new Date(now.getTime() + (this.runtime.reservationMinutes * 60_000)));
    const id = randomUUID();
    const reference = encodeBase58(randomBytes(32));
    const memo = `${this.runtime.payment.memoPrefix}-${reference.slice(0, 12)}`;
    const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);
    const message = `${itemCount} item${itemCount === 1 ? '' : 's'} from ${this.runtime.storefrontName}`;
    const orderLines = lines.map((line) => ({
      sku: line.sku,
      quantity: line.quantity,
      unitAmountMinor: parseMinorUnits(line.variant.tokenAmount, this.runtime.payment.token.decimals).toString(),
    }));
    const total = orderLines.reduce((sum, line) => sum + (BigInt(line.unitAmountMinor) * BigInt(line.quantity)), 0n);

    this.writeTransaction(() => {
      this.expireInsideTransaction(now);
      const reservedStatement = this.db.prepare(`
        SELECT COALESCE(SUM(ol.quantity), 0) AS reserved
        FROM order_lines ol JOIN orders o ON o.id = ol.order_id
        WHERE ol.sku = ? AND o.status = 'reserved' AND o.expires_at > ?
      `);
      const stockStatement = this.db.prepare('SELECT on_hand FROM inventory_items WHERE sku = ?');
      for (const line of orderLines) {
        const stock = stockStatement.get(line.sku) as unknown as { on_hand: number } | undefined;
        const reserved = reservedStatement.get(line.sku, createdAt) as unknown as { reserved: number };
        const available = (stock?.on_hand ?? 0) - reserved.reserved;
        if (line.quantity > available) throw new Error(`${line.sku} has ${Math.max(0, available)} available; ${line.quantity} requested.`);
      }
      this.db.prepare(`
        INSERT INTO orders (
          id, status, created_at, expires_at, amount_minor_units, token_symbol, token_mint,
          token_decimals, recipient, reference, label, message, memo
        ) VALUES (?, 'reserved', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        createdAt,
        expiresAt,
        total.toString(),
        this.runtime.payment.token.symbol,
        this.runtime.payment.token.mint,
        this.runtime.payment.token.decimals,
        this.runtime.payment.recipient,
        reference,
        this.runtime.payment.label,
        message,
        memo,
      );
      const insertLine = this.db.prepare('INSERT INTO order_lines (order_id, sku, quantity, unit_amount_minor) VALUES (?, ?, ?, ?)');
      const insertEvent = this.db.prepare("INSERT INTO inventory_events (sku, event_type, quantity_delta, reason, order_id, created_at) VALUES (?, 'reserved', 0, 'Checkout reservation', ?, ?)");
      for (const line of orderLines) {
        insertLine.run(id, line.sku, line.quantity, line.unitAmountMinor);
        insertEvent.run(line.sku, id, createdAt);
      }
    });

    return {
      schemaVersion: 1,
      id,
      status: 'reserved',
      createdAt,
      expiresAt,
      lines: orderLines,
      amountMinorUnits: total.toString(),
      amount: formatMinorUnits(total, this.runtime.payment.token.decimals),
      token: { ...this.runtime.payment.token },
      recipient: this.runtime.payment.recipient,
      reference,
      label: this.runtime.payment.label,
      message,
      memo,
    };
  }

  getOrder(id: string): ReservationResponse | null {
    const row = this.db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as unknown as OrderRow | undefined;
    if (!row) return null;
    const lines = this.db.prepare('SELECT sku, quantity, unit_amount_minor FROM order_lines WHERE order_id = ? ORDER BY sku')
      .all(id) as unknown as OrderLineRow[];
    return {
      schemaVersion: 1,
      id: row.id,
      status: row.status,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      lines: lines.map((line) => ({ sku: line.sku, quantity: line.quantity, unitAmountMinor: line.unit_amount_minor })),
      amountMinorUnits: row.amount_minor_units,
      amount: formatMinorUnits(BigInt(row.amount_minor_units), row.token_decimals),
      token: { symbol: row.token_symbol, mint: row.token_mint, decimals: row.token_decimals },
      recipient: row.recipient,
      reference: row.reference,
      label: row.label,
      message: row.message,
      memo: row.memo,
      ...(row.payment_signature ? { paymentSignature: row.payment_signature } : {}),
    };
  }

  cancelReservation(id: string, now = new Date()): boolean {
    return this.writeTransaction(() => {
      const order = this.getOrder(id);
      if (!order || order.status !== 'reserved') return false;
      const timestamp = iso(now);
      this.db.prepare("UPDATE orders SET status = 'cancelled' WHERE id = ? AND status = 'reserved'").run(id);
      const event = this.db.prepare("INSERT INTO inventory_events (sku, event_type, quantity_delta, reason, order_id, created_at) VALUES (?, 'released', 0, 'Cart changed or checkout cancelled', ?, ?)");
      for (const line of order.lines) event.run(line.sku, id, timestamp);
      return true;
    });
  }

  listOrders(): ReservationResponse[] {
    const rows = this.db.prepare('SELECT id FROM orders ORDER BY created_at DESC').all() as unknown as Array<{ id: string }>;
    return rows.flatMap((row) => {
      const order = this.getOrder(row.id);
      return order ? [order] : [];
    });
  }

  markPaid(id: string, signature: string, now = new Date()): OrderStatus {
    return this.writeTransaction(() => {
      this.expireInsideTransaction(now);
      const order = this.getOrder(id);
      if (!order) throw new Error(`Unknown order: ${id}`);
      if (order.status === 'fulfillment_pending' || order.status === 'fulfilled') {
        if (order.paymentSignature === signature) return order.status;
        throw new Error(`Order is already reconciled to ${order.paymentSignature ?? 'another payment'}.`);
      }
      if (order.status !== 'reserved') {
        this.db.prepare("UPDATE orders SET status = 'exception', payment_signature = ?, paid_at = ? WHERE id = ?")
          .run(signature, iso(now), id);
        return 'exception';
      }
      const event = this.db.prepare("INSERT INTO inventory_events (sku, event_type, quantity_delta, reason, order_id, created_at) VALUES (?, 'sold', ?, 'Verified finalized payment', ?, ?)");
      for (const line of order.lines) {
        const result = this.db.prepare('UPDATE inventory_items SET on_hand = on_hand - ?, revision = revision + 1, updated_at = ? WHERE sku = ? AND on_hand >= ?')
          .run(line.quantity, iso(now), line.sku, line.quantity);
        if (result.changes !== 1) throw new Error(`Cannot commit ${line.sku}; stock is no longer available.`);
        event.run(line.sku, -line.quantity, id, iso(now));
      }
      this.db.prepare("UPDATE orders SET status = 'fulfillment_pending', payment_signature = ?, paid_at = ? WHERE id = ?")
        .run(signature, iso(now), id);
      return 'fulfillment_pending';
    });
  }

  fulfill(id: string, now = new Date()): void {
    const result = this.db.prepare("UPDATE orders SET status = 'fulfilled', fulfilled_at = ? WHERE id = ? AND status = 'fulfillment_pending'")
      .run(iso(now), id);
    if (result.changes !== 1) throw new Error('Only a fulfillment-pending order can be marked fulfilled.');
  }
}
