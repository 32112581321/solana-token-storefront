import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { ReservationRequest } from '../shared/inventory-contracts.js';
import { InventoryDatabase } from './database.js';

const DEFAULT_ORIGINS = [
  'http://127.0.0.1:5173',
  'http://127.0.0.1:4173',
  'http://127.0.0.1:4174',
  'http://localhost:5173',
];

function send(response: ServerResponse, status: number, value: unknown): void {
  const body = JSON.stringify(value);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  });
  response.end(body);
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 64 * 1024) throw new Error('Request body exceeds 64 KiB.');
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}

export function createInventoryServer(database: InventoryDatabase) {
  const configuredOrigins = process.env.STOREFRONT_ALLOWED_ORIGIN
    ?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const allowedOrigins = new Set(configuredOrigins?.length ? configuredOrigins : DEFAULT_ORIGINS);

  return createServer(async (request, response) => {
    const origin = request.headers.origin;
    if (origin && allowedOrigins.has(origin)) {
      response.setHeader('access-control-allow-origin', origin);
      response.setHeader('vary', 'Origin');
      response.setHeader('access-control-allow-methods', 'GET, POST, DELETE, OPTIONS');
      response.setHeader('access-control-allow-headers', 'content-type');
    }
    if (request.method === 'OPTIONS') {
      response.writeHead(origin && !allowedOrigins.has(origin) ? 403 : 204);
      response.end();
      return;
    }
    if (origin && !allowedOrigins.has(origin)) {
      send(response, 403, { error: 'Origin is not allowed.' });
      return;
    }

    const url = new URL(request.url ?? '/', 'http://inventory.local');
    try {
      if (request.method === 'GET' && url.pathname === '/health') {
        send(response, 200, { status: 'ok', schemaVersion: 1 });
        return;
      }
      if (request.method === 'GET' && url.pathname === '/v1/inventory') {
        send(response, 200, database.getInventory());
        return;
      }
      if (request.method === 'POST' && url.pathname === '/v1/reservations') {
        const body = await readJson(request) as ReservationRequest;
        send(response, 201, database.createReservation(body));
        return;
      }
      const orderMatch = /^\/v1\/orders\/([0-9a-f-]+)$/.exec(url.pathname);
      if (request.method === 'GET' && orderMatch?.[1]) {
        const order = database.getOrder(orderMatch[1]);
        send(response, order ? 200 : 404, order ?? { error: 'Order not found.' });
        return;
      }
      const reservationMatch = /^\/v1\/reservations\/([0-9a-f-]+)$/.exec(url.pathname);
      if (request.method === 'DELETE' && reservationMatch?.[1]) {
        const cancelled = database.cancelReservation(reservationMatch[1]);
        send(response, cancelled ? 200 : 409, cancelled ? { status: 'cancelled' } : { error: 'Reservation cannot be cancelled.' });
        return;
      }
      send(response, 404, { error: 'Not found.' });
    } catch (error) {
      send(response, 400, { error: error instanceof Error ? error.message : 'Request failed.' });
    }
  });
}
