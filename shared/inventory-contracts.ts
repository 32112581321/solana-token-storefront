export type InventoryMode = 'static' | 'service';

export interface InventoryServiceConfig {
  mode: InventoryMode;
  serviceUrl?: string;
  reservationMinutes?: number;
}

export interface InventoryItemSnapshot {
  sku: string;
  onHand: number;
  reserved: number;
  available: number;
  revision: number;
}

export interface InventorySnapshot {
  schemaVersion: 1;
  generatedAt: string;
  items: InventoryItemSnapshot[];
}

export interface ReservationLineRequest {
  sku: string;
  quantity: number;
}

export interface ReservationRequest {
  schemaVersion: 1;
  cartVersion: 1;
  lines: ReservationLineRequest[];
}

export type OrderStatus =
  | 'reserved'
  | 'expired'
  | 'cancelled'
  | 'fulfillment_pending'
  | 'fulfilled'
  | 'exception';

export interface ReservationLine extends ReservationLineRequest {
  unitAmountMinor: string;
}

export interface ReservationResponse {
  schemaVersion: 1;
  id: string;
  status: OrderStatus;
  createdAt: string;
  expiresAt: string;
  lines: ReservationLine[];
  amountMinorUnits: string;
  amount: string;
  token: {
    symbol: string;
    mint: string;
    decimals: number;
  };
  recipient: string;
  reference: string;
  label: string;
  message: string;
  memo: string;
  paymentSignature?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isIntegerString(value: unknown): value is string {
  return typeof value === 'string' && /^(0|[1-9]\d*)$/.test(value);
}

export function decodeInventorySnapshot(value: unknown): InventorySnapshot {
  if (!isRecord(value) || value.schemaVersion !== 1 || !isNonEmptyString(value.generatedAt) || !Array.isArray(value.items)) {
    throw new Error('Inventory service returned an invalid snapshot envelope.');
  }
  for (const item of value.items) {
    if (!isRecord(item)
      || !isNonEmptyString(item.sku)
      || !isNonNegativeInteger(item.onHand)
      || !isNonNegativeInteger(item.reserved)
      || !isNonNegativeInteger(item.available)
      || !isNonNegativeInteger(item.revision)
      || Number(item.available) !== Math.max(0, Number(item.onHand) - Number(item.reserved))) {
      throw new Error('Inventory service returned an invalid item snapshot.');
    }
  }
  return value as unknown as InventorySnapshot;
}

const ORDER_STATUSES = new Set<OrderStatus>([
  'reserved',
  'expired',
  'cancelled',
  'fulfillment_pending',
  'fulfilled',
  'exception',
]);

export function decodeReservationResponse(value: unknown): ReservationResponse {
  if (!isRecord(value)
    || value.schemaVersion !== 1
    || !isNonEmptyString(value.id)
    || typeof value.status !== 'string'
    || !ORDER_STATUSES.has(value.status as OrderStatus)
    || !isNonEmptyString(value.createdAt)
    || !isNonEmptyString(value.expiresAt)
    || !Array.isArray(value.lines)
    || !isIntegerString(value.amountMinorUnits)
    || !isNonEmptyString(value.amount)
    || !isRecord(value.token)
    || !isNonEmptyString(value.token.symbol)
    || !isNonEmptyString(value.token.mint)
    || !isNonNegativeInteger(value.token.decimals)
    || !isNonEmptyString(value.recipient)
    || !isNonEmptyString(value.reference)
    || !isNonEmptyString(value.label)
    || !isNonEmptyString(value.message)
    || !isNonEmptyString(value.memo)
    || (value.paymentSignature !== undefined && !isNonEmptyString(value.paymentSignature))) {
    throw new Error('Inventory service returned an invalid reservation envelope.');
  }
  for (const line of value.lines) {
    if (!isRecord(line)
      || !isNonEmptyString(line.sku)
      || !isPositiveInteger(line.quantity)
      || !isIntegerString(line.unitAmountMinor)) {
      throw new Error('Inventory service returned an invalid reservation line.');
    }
  }
  return value as unknown as ReservationResponse;
}
