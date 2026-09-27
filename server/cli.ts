import { resolve } from 'node:path';
import { loadRuntimeFiles } from './config.js';
import { InventoryDatabase } from './database.js';
import { verifyFinalizedPayment } from './solana.js';

const runtime = loadRuntimeFiles();
const databasePath = resolve(process.env.STOREFRONT_DB_PATH ?? '.inventory/storefront.sqlite');
const database = new InventoryDatabase(databasePath, runtime);
const [command = 'help', ...args] = process.argv.slice(2);

function requireArg(value: string | undefined, label: string): string {
  if (!value) throw new Error(`${label} is required.`);
  return value;
}

function printHelp(): void {
  console.log(`Inventory and order CLI

  npm run inventory:admin -- init
  npm run inventory:admin -- list
  npm run inventory:admin -- receive <SKU> <QUANTITY> [REASON]
  npm run inventory:admin -- adjust <SKU> <SIGNED_QUANTITY> <REASON>
  npm run inventory:admin -- orders
  npm run inventory:admin -- reconcile <ORDER_ID> <DEVNET_SIGNATURE>
  npm run inventory:admin -- fulfill <ORDER_ID>`);
}

try {
  switch (command) {
    case 'init':
      console.log(`Initialized ${runtime.variants.size} SKUs in ${databasePath}. Stock starts at zero.`);
      break;
    case 'list':
      console.table(database.getInventory().items);
      break;
    case 'receive': {
      const sku = requireArg(args[0], 'SKU');
      const quantity = Number(requireArg(args[1], 'quantity'));
      if (!Number.isInteger(quantity) || quantity < 1) throw new Error('Receive quantity must be a positive integer.');
      database.changeStock(sku, quantity, args.slice(2).join(' ') || 'Stock received');
      console.log(`Received ${quantity} unit(s) of ${sku}.`);
      break;
    }
    case 'adjust': {
      const sku = requireArg(args[0], 'SKU');
      const quantity = Number(requireArg(args[1], 'signed quantity'));
      database.changeStock(sku, quantity, requireArg(args.slice(2).join(' '), 'reason'));
      console.log(`Adjusted ${sku} by ${quantity}.`);
      break;
    }
    case 'orders':
      console.table(database.listOrders().map((order) => ({
        id: order.id,
        status: order.status,
        amount: `${order.amount} ${order.token.symbol}`,
        expiresAt: order.expiresAt,
        signature: order.paymentSignature ?? '',
      })));
      break;
    case 'reconcile': {
      const orderId = requireArg(args[0], 'order ID');
      const signature = requireArg(args[1], 'devnet signature');
      const order = database.getOrder(orderId);
      if (!order) throw new Error(`Unknown order: ${orderId}`);
      const proof = await verifyFinalizedPayment(order, signature);
      const status = database.markPaid(orderId, signature);
      console.log(JSON.stringify({ orderId, status, ...proof }, null, 2));
      break;
    }
    case 'fulfill':
      database.fulfill(requireArg(args[0], 'order ID'));
      console.log(`Order ${args[0]} marked fulfilled.`);
      break;
    default:
      printHelp();
      if (command !== 'help') process.exitCode = 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  database.close();
}
