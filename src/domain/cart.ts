import { parseTokenAmount } from './amount';
import type { CartLine, Catalog, PersistedCart, ResolvedCartLine } from './types';

export const CART_STORAGE_KEY = 'solana-token-storefront:cart:v1';

export function addCartLine(lines: CartLine[], sku: string): CartLine[] {
  const existing = lines.find((line) => line.sku === sku);
  if (existing) {
    return lines.map((line) => line.sku === sku ? { ...line, quantity: line.quantity + 1 } : line);
  }
  return [...lines, { sku, quantity: 1 }];
}

export function setCartQuantity(lines: CartLine[], sku: string, quantity: number): CartLine[] {
  if (!Number.isInteger(quantity)) return lines;
  if (quantity <= 0) return lines.filter((line) => line.sku !== sku);
  return lines.map((line) => line.sku === sku ? { ...line, quantity } : line);
}

export function resolveCart(lines: CartLine[], catalog: Catalog, decimals: number): ResolvedCartLine[] {
  const products = new Map(catalog.products.map((product) => [product.id, product]));
  const variants = new Map(catalog.products.flatMap((product) => product.variants.map((variant) => [variant.sku, { productId: product.id, variant }] as const)));

  return lines.flatMap((line) => {
    const match = variants.get(line.sku);
    if (!match || line.quantity < 1 || !Number.isInteger(line.quantity)) return [];
    const product = products.get(match.productId);
    if (!product || product.status !== 'active' || !match.variant.available) return [];
    const unitsEach = parseTokenAmount(match.variant.tokenAmount, decimals);
    return [{ ...line, product, variant: match.variant, unitsEach, unitsTotal: unitsEach * BigInt(line.quantity) }];
  });
}

export function cartTotalUnits(lines: ResolvedCartLine[]): bigint {
  return lines.reduce((total, line) => total + line.unitsTotal, 0n);
}

export function cartFingerprint(lines: CartLine[]): string {
  return [...lines]
    .filter((line) => line.quantity > 0)
    .sort((a, b) => a.sku.localeCompare(b.sku))
    .map((line) => `${line.sku}:${line.quantity}`)
    .join('|');
}

export function readPersistedCart(raw: string | null): CartLine[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw) as Partial<PersistedCart>;
    if (value.version !== 1 || !Array.isArray(value.lines)) return [];
    return value.lines.filter((line): line is CartLine => (
      typeof line?.sku === 'string' && Number.isInteger(line.quantity) && line.quantity > 0
    ));
  } catch {
    return [];
  }
}

export function serializeCart(lines: CartLine[]): string {
  return JSON.stringify({ version: 1, lines } satisfies PersistedCart);
}
