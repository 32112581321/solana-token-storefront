import { clusterApiUrl, Connection } from '@solana/web3.js';
import type { ReservationResponse } from '../shared/inventory-contracts.js';

export interface VerifiedPayment {
  signature: string;
  slot: number;
  recipientDeltaMinorUnits: string;
}

export async function verifyFinalizedPayment(
  order: ReservationResponse,
  signature: string,
  rpcUrl = process.env.SOLANA_RPC_URL ?? clusterApiUrl('devnet'),
): Promise<VerifiedPayment> {
  if (!/^[1-9A-HJ-NP-Za-km-z]{64,90}$/.test(signature)) throw new Error('Invalid Solana transaction signature.');
  const connection = new Connection(rpcUrl, 'finalized');
  const transaction = await connection.getParsedTransaction(signature, {
    commitment: 'finalized',
    maxSupportedTransactionVersion: 0,
  });
  if (!transaction) throw new Error('Finalized transaction was not found on devnet.');
  if (transaction.meta?.err) throw new Error('The transaction failed on-chain.');
  if (transaction.transaction.signatures[0] !== signature) throw new Error('Transaction signature mismatch.');

  const accountKeys = transaction.transaction.message.accountKeys.map((account) => account.pubkey.toBase58());
  if (!accountKeys.includes(order.reference)) throw new Error('Transaction does not contain the order reference.');

  const preByIndex = new Map(
    (transaction.meta?.preTokenBalances ?? [])
      .filter((balance) => balance.mint === order.token.mint && balance.owner === order.recipient)
      .map((balance) => [balance.accountIndex, BigInt(balance.uiTokenAmount.amount)]),
  );
  let delta = 0n;
  for (const balance of transaction.meta?.postTokenBalances ?? []) {
    if (balance.mint !== order.token.mint || balance.owner !== order.recipient) continue;
    delta += BigInt(balance.uiTokenAmount.amount) - (preByIndex.get(balance.accountIndex) ?? 0n);
  }
  if (delta !== BigInt(order.amountMinorUnits)) {
    throw new Error(`Recipient token balance changed by ${delta}, expected ${order.amountMinorUnits}.`);
  }

  const memoFound = transaction.transaction.message.instructions.some((instruction) => {
    const parsed = instruction as unknown as { program?: string; parsed?: unknown };
    return parsed.program === 'spl-memo' && parsed.parsed === order.memo;
  });
  if (!memoFound) throw new Error('Transaction does not contain the exact order memo.');

  return {
    signature,
    slot: transaction.slot,
    recipientDeltaMinorUnits: delta.toString(),
  };
}
