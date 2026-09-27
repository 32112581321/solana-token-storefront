import { test, expect, type Page } from '@playwright/test';
import { Keypair, Transaction } from '@solana/web3.js';
import { address, type ReadonlyUint8Array } from '@solana/kit';
import { AccountState, getMintEncoder, getTokenEncoder, TOKEN_PROGRAM_ADDRESS, findAssociatedTokenPda } from '@solana-program/token';
import configJson from '../public/storefront.config.json' with { type: 'json' };
import { DEVNET_GENESIS } from '../src/domain/transaction';
import { encodeBase58 } from '../src/domain/solana';

const buyer = Keypair.fromSeed(new Uint8Array(32).fill(7)); // Mock-only deterministic key.
const blockhash = Keypair.fromSeed(new Uint8Array(32).fill(8)).publicKey.toBase58();
// Keep payment fixtures independent of a fork owner's edited recipient/mint/decimals.
const config = { ...configJson, payment: {
  ...configJson.payment, enabled: true, network: 'devnet',
  recipient: '8YRJP9pHJJtcDqX29hwGKmCmvBwmcyoCaKmFnyk43UNL',
  token: { symbol: 'TEST DRU', mint: 'FAM2TEFYrRXFVQ8W16SkPwaeZyWPcLnjieiTMYvc6Kpw', decimals: 6 },
  blockedMints: ['14kH2osUyEJnqBZ7yFK4pLKJGuPZU4pr1enhi2ZLEmRw'],
} };
const configFixture = { ...config, inventory: { mode: 'static' }, payment: { ...config.payment, rpcUrl: 'https://rpc.test.invalid' } };
type Failure = 'wrong-cluster' | 'no-tokens' | 'no-sol' | 'reject' | 'changed-message' | 'send-timeout' | 'account-change' | 'expired-blockhash' | 'mainnet-account';

async function setup(page: Page, name: 'Phantom' | 'MetaMask', failure?: Failure) {
  const signedRequests: { bytes: number[]; chain: string }[] = [];
  const broadcasts: Transaction[] = [];
  const chain = name === 'Phantom' ? 'solana:devnet' : 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1';
  await page.exposeFunction('testWalletSign', (bytes: number[], requestedChain: string) => {
    signedRequests.push({ bytes, chain: requestedChain });
    const transaction = Transaction.from(bytes);
    if (failure === 'changed-message') transaction.instructions[1]!.data.writeBigUInt64LE(1n, 1);
    transaction.partialSign(buyer);
    return [...transaction.serialize()];
  });
  await page.addInitScript(({ name, buyerAddress, key, chain, failure }) => {
    const account = { address: buyerAddress, publicKey: new Uint8Array(key), chains: [failure === 'mainnet-account' ? 'solana:mainnet' : chain], features: ['solana:signTransaction'] };
    let onChange: (() => void) | undefined;
    const wallet = {
      name, version: '1.0.0', icon: 'data:image/svg+xml,<svg/>', chains: [chain], accounts: [account],
      features: {
        'standard:connect': { version: '1.0.0', connect: async () => ({ accounts: [account] }) },
        'standard:disconnect': { version: '1.0.0', disconnect: async () => undefined },
        'standard:events': { version: '1.0.0', on: (_event: string, listener: () => void) => { onChange = listener; return () => { onChange = undefined; }; } },
        'solana:signTransaction': { version: '1.0.0', supportedTransactionVersions: ['legacy'], signTransaction: async (request: { transaction: Uint8Array; chain: string }) => {
          if (failure === 'reject') throw Object.assign(new Error('User declined'), { code: 4001 });
          const sign = (window as unknown as { testWalletSign: (bytes: number[], chain: string) => Promise<number[]> }).testWalletSign;
          const signed = await sign([...request.transaction], request.chain);
          if (failure === 'account-change') onChange?.();
          return [{ signedTransaction: new Uint8Array(signed) }];
        } },
      },
    };
    window.addEventListener('wallet-standard:app-ready', (event) => {
      (event as CustomEvent<{ register: (wallet: unknown) => void }>).detail.register(wallet);
    });
  }, { name, buyerAddress: buyer.publicKey.toBase58(), key: [...buyer.publicKey.toBytes()], chain, failure });
  await page.route('**/storefront.config.json', (route) => route.fulfill({ json: configFixture }));
  const mint = address(config.payment.token.mint);
  const [source] = await findAssociatedTokenPda({ mint, owner: address(buyer.publicKey.toBase58()), tokenProgram: TOKEN_PROGRAM_ADDRESS });
  const mintData = getMintEncoder().encode({ decimals: 6, supply: 10_000_000_000n, isInitialized: true, mintAuthority: null, freezeAuthority: null });
  const tokenData = getTokenEncoder().encode({ mint, owner: address(buyer.publicKey.toBase58()), amount: 1_000_000_000n, delegate: null, state: AccountState.Initialized, isNative: null, delegatedAmount: 0n, closeAuthority: null });
  const account = (bytes: ReadonlyUint8Array) => ({ data: [Buffer.from(bytes).toString('base64'), 'base64'], owner: TOKEN_PROGRAM_ADDRESS, executable: false, lamports: 2_039_280, rentEpoch: 0, space: bytes.length });
  const ctx = (value: unknown) => ({ context: { slot: 1 }, value });
  await page.route('https://rpc.test.invalid/', async (route) => {
    const { method, params, id } = route.request().postDataJSON() as { method: string; params: unknown[]; id: number };
    let result: unknown;
    switch (method) {
      case 'getGenesisHash': result = failure === 'wrong-cluster' ? '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp' : DEVNET_GENESIS; break;
      case 'getAccountInfo': result = ctx(params[0] === mint ? account(mintData) : params[0] === source && failure !== 'no-tokens' ? account(tokenData) : null); break;
      case 'getLatestBlockhash': result = ctx({ blockhash, lastValidBlockHeight: 100 }); break;
      case 'getBalance': result = ctx(failure === 'no-sol' ? 0 : 1_000_000_000); break;
      case 'simulateTransaction': result = ctx({ err: null, logs: [], unitsConsumed: 7000 }); break;
      case 'getBlockHeight': result = failure === 'expired-blockhash' ? 101 : 1; break;
      case 'sendTransaction': {
        const tx = Transaction.from(Buffer.from(params[0] as string, 'base64'));
        broadcasts.push(tx);
        expect(tx.verifySignatures()).toBe(true);
        if (failure === 'send-timeout') { await route.abort('failed'); return; }
        result = encodeBase58(tx.signature!);
        break;
      }
      default: throw new Error(`Unexpected RPC call ${method}`);
    }
    await route.fulfill({ json: { jsonrpc: '2.0', id, result } });
  });
  await page.goto('/');
  await page.locator('[data-product-card]').first().getByRole('button', { name: 'Add to cart' }).click();
  await page.getByRole('button', { name: 'Continue to devnet payment' }).click();
  await page.getByRole('button', { name: `Connect ${name}` }).click();
  return { signedRequests, broadcasts, chain };
}

for (const name of ['Phantom', 'MetaMask'] as const) {
  test(`${name} Wallet Standard signs exact devnet transfer and shows submission, not paid`, async ({ page }) => {
    const { signedRequests, broadcasts, chain } = await setup(page, name);
    await expect(page.getByText(`Connected to ${name} · Solana devnet`)).toBeVisible();
    const request = new URL((await page.locator('[data-wallet-link]').getAttribute('href'))!);
    await page.getByRole('button', { name: 'Pay 30 TEST DRU on devnet' }).click();
    await expect(page.getByText('Transaction submitted to devnet.', { exact: true })).toBeVisible();
    expect(signedRequests).toHaveLength(1);
    expect(signedRequests[0]!.chain).toBe(chain);
    expect(broadcasts).toHaveLength(1);
    const tx = broadcasts[0]!;
    expect(tx.instructions[1]!.data.readBigUInt64LE(1)).toBe(30_000_000n);
    expect(tx.instructions[1]!.keys[4]!.pubkey.toBase58()).toBe(request.searchParams.get('reference'));
    expect(tx.instructions[2]!.data.toString()).toBe(request.searchParams.get('memo'));
    expect(tx.instructions[0]!.keys[2]!.pubkey.toBase58()).toBe(config.payment.recipient);
    await expect(page.getByRole('button', { name: 'Pay 30 TEST DRU on devnet' })).toBeDisabled();
    await expect(page.locator('[data-wallet-link]')).toHaveCount(0);
    await expect(page.locator('[data-transaction-receipt] a')).toHaveAttribute('href', /cluster=devnet$/);
    await expect(page.getByText('No success state is shown.')).toBeVisible();
    expect(await page.evaluate(() => Object.keys(localStorage))).toEqual(['solana-token-storefront:cart:v1']);
  });
}

for (const [failure, message] of [
  ['wrong-cluster', 'RPC is not Solana devnet'], ['no-tokens', 'Not enough TEST DRU'],
  ['no-sol', 'Keep at least 0.01 devnet SOL'], ['reject', 'Request declined'],
  ['changed-message', 'Wallet changed the payment'], ['account-change', 'account or network changed'],
  ['expired-blockhash', 'signing request expired'],
] as const) {
  test(`fails closed: ${failure}`, async ({ page }) => {
    const { broadcasts } = await setup(page, 'Phantom', failure);
    await page.getByRole('button', { name: 'Pay 30 TEST DRU on devnet' }).click();
    await expect(page.getByRole('alert')).toContainText(message);
    expect(broadcasts).toHaveLength(0);
    await expect(page.locator('[data-transaction-receipt]')).toHaveCount(0);
  });
}

test('an ambiguous send preserves signature and blocks another payment', async ({ page }) => {
  await setup(page, 'Phantom', 'send-timeout');
  await page.getByRole('button', { name: 'Pay 30 TEST DRU on devnet' }).click();
  await expect(page.getByText('Submission outcome unknown.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pay 30 TEST DRU on devnet' })).toBeDisabled();
  await expect(page.locator('[data-transaction-receipt] a')).toHaveAttribute('href', /\/tx\/.+\?cluster=devnet/);
});

test('a mainnet-only wallet account cannot connect for payment', async ({ page }) => {
  const { signedRequests, broadcasts } = await setup(page, 'MetaMask', 'mainnet-account');
  await expect(page.getByRole('alert')).toContainText('Enable Solana devnet');
  await expect(page.locator('[data-pay-wallet]')).toHaveCount(0);
  expect(signedRequests).toHaveLength(0);
  expect(broadcasts).toHaveLength(0);
});

test('missing Phantom gives actionable instructions, not a fake connection', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-product-card]').first().getByRole('button', { name: 'Add to cart' }).click();
  await page.getByRole('button', { name: 'Continue to devnet payment' }).click();
  await page.getByRole('button', { name: 'Connect Phantom' }).click();
  await expect(page.getByRole('alert')).toContainText('extension installed and unlocked');
  await expect(page.locator('[data-pay-wallet]')).toHaveCount(0);
});

test('the actual MetaMask SDK detects a missing extension without a mobile fallback', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-product-card]').first().getByRole('button', { name: 'Add to cart' }).click();
  await page.getByRole('button', { name: 'Continue to devnet payment' }).click();
  await page.getByRole('button', { name: 'Connect MetaMask' }).click();
  await expect(page.getByRole('alert')).toContainText('desktop extension was not detected');
  await expect(page.getByRole('button', { name: 'Connect MetaMask' })).toBeEnabled();
  await expect(page.locator('[data-pay-wallet]')).toHaveCount(0);
});

test('wallet controls fit mobile and work with keyboard activation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page, 'Phantom');
  const pay = page.getByRole('button', { name: 'Pay 30 TEST DRU on devnet' });
  await expect(pay).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await pay.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Transaction submitted to devnet.', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('changing the cart preserves connection but replaces the payment reference', async ({ page }) => {
  await setup(page, 'Phantom');
  const first = await page.locator('[data-wallet-link]').getAttribute('href');
  await page.getByRole('button', { name: 'Open cart' }).click();
  await page.getByRole('button', { name: 'Increase quantity' }).click();
  await page.getByRole('button', { name: 'Continue to devnet payment' }).click();
  const second = await page.locator('[data-wallet-link]').getAttribute('href');
  expect(new URL(first!).searchParams.get('reference')).not.toBe(new URL(second!).searchParams.get('reference'));
  await page.getByRole('button', { name: 'Pay 60 TEST DRU on devnet' }).click();
  await expect(page.getByText('Transaction submitted to devnet.', { exact: true })).toBeVisible();
});
