import { resolve } from 'node:path';
import { createInventoryServer } from './api.js';
import { loadRuntimeFiles } from './config.js';
import { InventoryDatabase } from './database.js';

const runtime = loadRuntimeFiles();
const databasePath = resolve(process.env.STOREFRONT_DB_PATH ?? '.inventory/storefront.sqlite');
const port = Number(process.env.STOREFRONT_INVENTORY_PORT ?? '8787');
if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error('STOREFRONT_INVENTORY_PORT is invalid.');
const database = new InventoryDatabase(databasePath, runtime);
const server = createInventoryServer(database);

server.listen(port, '127.0.0.1', () => {
  console.log(`Inventory service listening on http://127.0.0.1:${port}`);
  console.log(`SQLite ledger: ${databasePath}`);
});

function shutdown(): void {
  server.close(() => {
    database.close();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
