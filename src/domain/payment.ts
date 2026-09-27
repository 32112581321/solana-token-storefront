import { cartFingerprint } from './cart';
import { createReference } from './solana';
import type { CartLine, PaymentIntent, StorefrontConfig } from './types';

export function createPaymentIntent(
  lines: CartLine[],
  memoPrefix: string,
  randomBytes?: Uint8Array,
): PaymentIntent {
  const reference = createReference(randomBytes);
  return {
    cartFingerprint: cartFingerprint(lines),
    reference,
    memo: `${memoPrefix}-${reference.slice(0, 12)}`,
  };
}

export function isPaymentIntentCurrent(intent: PaymentIntent | null, lines: CartLine[]): boolean {
  return Boolean(intent && intent.cartFingerprint === cartFingerprint(lines));
}

export function buildSolanaPayUrl(
  config: StorefrontConfig,
  amount: string,
  intent: PaymentIntent,
  itemCount: number,
): string {
  const query = new URLSearchParams({
    amount,
    'spl-token': config.payment.token.mint,
    reference: intent.reference,
    label: config.payment.label,
    message: `${itemCount} item${itemCount === 1 ? '' : 's'} from ${config.storefront.name}`,
    memo: intent.memo,
  });
  return `solana:${config.payment.recipient}?${query.toString()}`;
}
