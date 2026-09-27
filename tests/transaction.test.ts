import { describe, expect, it } from 'vitest';
import { Keypair, Transaction } from '@solana/web3.js';
import { blockhash, getTransactionEncoder } from '@solana/kit';
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import configJson from '../public/storefront.config.json';
import { assertDevnetPayment, buildPaymentTransaction, inspectSignedPayment, MAINNET_DRU, MEMO_PROGRAM } from '../src/domain/transaction';
import type { StorefrontConfig } from '../src/domain/types';

const config: StorefrontConfig = { ...configJson, payment: {
  ...configJson.payment, enabled: true, network: 'devnet',
  recipient: '8YRJP9pHJJtcDqX29hwGKmCmvBwmcyoCaKmFnyk43UNL',
  token: { symbol: 'TEST DRU', mint: 'FAM2TEFYrRXFVQ8W16SkPwaeZyWPcLnjieiTMYvc6Kpw', decimals: 6 },
  blockedMints: [MAINNET_DRU],
} } as StorefrontConfig;
const buyer = Keypair.fromSeed(new Uint8Array(32).fill(7)); // Deterministic test fixture, never funded.
const reference = Keypair.fromSeed(new Uint8Array(32).fill(8)).publicKey.toBase58();
const intent = { reference, memo: 'DRU-DEV-EXACT', cartFingerprint: 'fixture' };
const lifetime = { blockhash: blockhash(reference), lastValidBlockHeight: 123n };

describe('wallet payment transaction', () => {
  it('encodes an exact SPL transfer, recipient ATA, reference, memo and sole buyer signer', async () => {
    const amount = 9_007_199_254_740_993n;
    const built = await buildPaymentTransaction(config, buyer.publicKey.toBase58(), amount, intent, lifetime);
    const wire = new Uint8Array(getTransactionEncoder().encode(built.transaction));
    const tx = Transaction.from(wire);
    expect(tx.feePayer?.toBase58()).toBe(buyer.publicKey.toBase58());
    expect(tx.signatures).toHaveLength(1);
    expect(tx.instructions).toHaveLength(3);
    const transfer = tx.instructions[1]!;
    expect(transfer.programId.equals(TOKEN_PROGRAM_ID)).toBe(true);
    expect(transfer.data[0]).toBe(12); // TransferChecked, not an approval or delegate.
    expect(transfer.data.readBigUInt64LE(1)).toBe(amount);
    expect(transfer.data[9]).toBe(6);
    expect(transfer.keys[1]!.pubkey.toBase58()).toBe(config.payment.token.mint);
    expect(transfer.keys[2]!.pubkey.toBase58()).toBe(built.destination);
    expect(transfer.keys[4]!.pubkey.toBase58()).toBe(reference);
    expect(transfer.keys[4]!.isSigner).toBe(false);
    expect(transfer.keys[4]!.isWritable).toBe(false);
    expect(tx.instructions[0]!.keys[2]!.pubkey.toBase58()).toBe(config.payment.recipient);
    expect(tx.instructions[2]!.programId.toBase58()).toBe(MEMO_PROGRAM);
    expect(tx.instructions[2]!.data.toString()).toBe(intent.memo);
    expect(built.source).toBe(getAssociatedTokenAddressSync(transfer.keys[1]!.pubkey, buyer.publicKey).toBase58());
    tx.partialSign(buyer);
    const inspected = inspectSignedPayment(wire, tx.serialize());
    expect(inspected.signature.length).toBeGreaterThan(80);
  });

  it('rejects unsigned and wallet-modified transactions before broadcasting', async () => {
    const built = await buildPaymentTransaction(config, buyer.publicKey.toBase58(), 30_000_000n, intent, lifetime);
    const wire = new Uint8Array(getTransactionEncoder().encode(built.transaction));
    expect(() => inspectSignedPayment(wire, wire)).toThrow();
    const changed = Transaction.from(wire);
    changed.instructions[1]!.data.writeBigUInt64LE(1n, 1);
    changed.partialSign(buyer);
    expect(() => inspectSignedPayment(wire, changed.serialize())).toThrow('changed the payment');
  });

  it('blocks disabled/mainnet requests, removed exclusions, self-payments and invalid amounts', async () => {
    expect(() => assertDevnetPayment({ ...config, payment: { ...config.payment, enabled: false } }, 1n)).toThrow();
    expect(() => assertDevnetPayment({ ...config, payment: { ...config.payment, token: { ...config.payment.token, mint: MAINNET_DRU }, blockedMints: [] } }, 1n)).toThrow('blocked');
    for (const amount of [0n, -1n, 2n ** 64n]) expect(() => assertDevnetPayment(config, amount)).toThrow('64-bit');
    await expect(buildPaymentTransaction(config, config.payment.recipient, 1n, intent, lifetime)).rejects.toThrow('different');
  });
});
