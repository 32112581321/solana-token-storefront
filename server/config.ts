import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PublicKey } from '@solana/web3.js';

export interface RuntimePaymentConfig {
  enabled: boolean;
  network: 'devnet';
  recipient: string;
  token: {
    symbol: string;
    mint: string;
    decimals: number;
  };
  label: string;
  memoPrefix: string;
  blockedMints: string[];
}

export interface RuntimeVariant {
  sku: string;
  tokenAmount: string;
}

export interface RuntimeFiles {
  storefrontName: string;
  payment: RuntimePaymentConfig;
  reservationMinutes: number;
  variants: Map<string, RuntimeVariant>;
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value as Record<string, unknown>;
}

function string(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${label} must be a non-empty string.`);
  return value;
}

function address(value: unknown, label: string): string {
  const candidate = string(value, label);
  try {
    return new PublicKey(candidate).toBase58();
  } catch {
    throw new Error(`${label} must be a valid Solana address.`);
  }
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

export function parseMinorUnits(value: string, decimals: number): bigint {
  const match = /^(0|[1-9]\d*)(?:\.(\d+))?$/.exec(value);
  if (!match) throw new Error(`Invalid token amount: ${value}`);
  const fraction = match[2] ?? '';
  if (fraction.length > decimals) throw new Error(`${value} exceeds ${decimals} decimal places.`);
  return (BigInt(match[1] ?? '0') * (10n ** BigInt(decimals)))
    + BigInt(fraction.padEnd(decimals, '0') || '0');
}

export function formatMinorUnits(units: bigint, decimals: number): string {
  const scale = 10n ** BigInt(decimals);
  const whole = units / scale;
  if (decimals === 0) return whole.toString();
  const fraction = (units % scale).toString().padStart(decimals, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

export function loadRuntimeFiles(root = process.cwd()): RuntimeFiles {
  const configPath = resolve(process.env.STOREFRONT_CONFIG_PATH ?? resolve(root, 'public/storefront.config.json'));
  const catalogPath = resolve(process.env.STOREFRONT_CATALOG_PATH ?? resolve(root, 'public/catalog.json'));
  const config = record(readJson(configPath), 'storefront.config.json');
  const storefront = record(config.storefront, 'storefront');
  const paymentValue = record(config.payment, 'payment');
  const tokenValue = record(paymentValue.token, 'payment.token');
  const inventory = config.inventory === undefined ? {} : record(config.inventory, 'inventory');
  const decimals = Number(tokenValue.decimals);
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 9) throw new Error('payment.token.decimals must be from 0 through 9.');
  if (paymentValue.network !== 'devnet') throw new Error('The inventory sidecar only supports devnet.');
  const blockedMints = Array.isArray(paymentValue.blockedMints)
    ? paymentValue.blockedMints.map((mint, index) => address(mint, `payment.blockedMints[${index}]`))
    : [];
  const mint = address(tokenValue.mint, 'payment.token.mint');
  if (blockedMints.includes(mint)) throw new Error('The configured payment mint is blocked.');

  const payment: RuntimePaymentConfig = {
    enabled: paymentValue.enabled === true,
    network: 'devnet',
    recipient: address(paymentValue.recipient, 'payment.recipient'),
    token: {
      symbol: string(tokenValue.symbol, 'payment.token.symbol'),
      mint,
      decimals,
    },
    label: string(paymentValue.label, 'payment.label'),
    memoPrefix: string(paymentValue.memoPrefix, 'payment.memoPrefix'),
    blockedMints,
  };
  if (!payment.enabled) throw new Error('The inventory sidecar requires payment.enabled to be true.');

  const reservationMinutes = inventory.reservationMinutes === undefined ? 15 : Number(inventory.reservationMinutes);
  if (!Number.isInteger(reservationMinutes) || reservationMinutes < 1 || reservationMinutes > 120) {
    throw new Error('inventory.reservationMinutes must be from 1 through 120.');
  }

  const catalog = record(readJson(catalogPath), 'catalog.json');
  if (!Array.isArray(catalog.products)) throw new Error('catalog.products must be an array.');
  const variants = new Map<string, RuntimeVariant>();
  for (const productValue of catalog.products) {
    const product = record(productValue, 'catalog product');
    if (product.status !== 'active' || !Array.isArray(product.variants)) continue;
    for (const variantValue of product.variants) {
      const variant = record(variantValue, 'catalog variant');
      if (variant.available !== true) continue;
      const sku = string(variant.sku, 'variant.sku');
      const tokenAmount = string(variant.tokenAmount, 'variant.tokenAmount');
      if (parseMinorUnits(tokenAmount, decimals) <= 0n) throw new Error(`${sku} must have a positive token amount.`);
      if (variants.has(sku)) throw new Error(`Duplicate active SKU: ${sku}`);
      variants.set(sku, { sku, tokenAmount });
    }
  }
  if (variants.size === 0) throw new Error('The catalog has no active, available SKUs.');

  return {
    storefrontName: string(storefront.name, 'storefront.name'),
    payment,
    reservationMinutes,
    variants,
  };
}
