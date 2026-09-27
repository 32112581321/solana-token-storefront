import { readFileSync } from 'node:fs';
import { test, expect } from 'vitest';
import { Connection, Keypair, Transaction } from '@solana/web3.js';
import configJson from '../public/storefront.config.json';
import { createReference } from '../src/domain/solana';
import { preparePayment, inspectSignedPayment } from '../src/domain/transaction';
import type { StorefrontConfig } from '../src/domain/types';

// Explicit opt-in: sends ONE base unit of the configured devnet token, never runs in CI.
test.skipIf(process.env.DEVNET_WALLET_SMOKE !== '1')('live devnet accepts the browser transaction builder', async () => {
  const config = configJson as StorefrontConfig;
  const buyer = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(new URL('../.devnet/payer.json', import.meta.url), 'utf8')) as number[]));
  const reference = createReference();
  const prepared = await preparePayment(config, buyer.publicKey.toBase58(), 1n, { reference, cartFingerprint: 'live-smoke', memo: `DRU-DEV-${reference.slice(0, 12)}` });
  const transaction = Transaction.from(prepared.bytes);
  transaction.partialSign(buyer);
  const signed = inspectSignedPayment(prepared.bytes, transaction.serialize());
  await prepared.rpc.sendTransaction(signed.wire, { encoding: 'base64', preflightCommitment: 'confirmed' }).send({ abortSignal: AbortSignal.timeout(30_000) });
  const connection = new Connection(config.payment.rpcUrl ?? 'https://api.devnet.solana.com', 'confirmed');
  let confirmed = false;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const status = (await connection.getSignatureStatus(signed.signature)).value;
    expect(status?.err ?? null).toBeNull();
    if (status?.confirmationStatus === 'confirmed' || status?.confirmationStatus === 'finalized') { confirmed = true; break; }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  expect(confirmed).toBe(true);
  console.log(`Browser-builder devnet proof: https://explorer.solana.com/tx/${signed.signature}?cluster=devnet`);
}, 90_000);
