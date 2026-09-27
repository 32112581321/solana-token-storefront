import {
  AccountRole, address, appendTransactionMessageInstructions, assertIsFullySignedTransaction,
  compileTransaction, createNoopSigner, createSolanaRpc, createTransactionMessage,
  getBase64EncodedWireTransaction, getSignatureFromTransaction, getTransactionDecoder,
  getTransactionEncoder, pipe, setTransactionMessageFeePayer, setTransactionMessageLifetimeUsingBlockhash,
  type Blockhash,
} from '@solana/kit';
import {
  AccountState, fetchMint, fetchMaybeToken, findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstruction, getTransferCheckedInstruction, TOKEN_PROGRAM_ADDRESS,
} from '@solana-program/token';
import { formatTokenAmount } from './amount';
import type { PaymentIntent, StorefrontConfig } from './types';

export const DEVNET_GENESIS = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG';
export const DEFAULT_RPC = 'https://api.devnet.solana.com';
export const MAINNET_DRU = '14kH2osUyEJnqBZ7yFK4pLKJGuPZU4pr1enhi2ZLEmRw';
export const MEMO_PROGRAM = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';
const timeout = () => ({ abortSignal: AbortSignal.timeout(20_000) });

export function assertDevnetPayment(config: StorefrontConfig, units: bigint): void {
  const payment = config.payment;
  if (!payment.enabled || payment.network !== 'devnet') throw new Error('Only enabled devnet payments are allowed.');
  if (payment.token.mint === MAINNET_DRU || payment.blockedMints.includes(payment.token.mint)) throw new Error('This mint is blocked for devnet checkout.');
  if (units <= 0n || units > 18_446_744_073_709_551_615n) throw new Error('Payment amount must fit the SPL token unsigned 64-bit range.');
}

export async function buildPaymentTransaction(
  config: StorefrontConfig, payerAddress: string, units: bigint, intent: PaymentIntent,
  lifetime: { blockhash: Blockhash; lastValidBlockHeight: bigint },
) {
  assertDevnetPayment(config, units);
  const payer = createNoopSigner(address(payerAddress));
  const mint = address(config.payment.token.mint);
  const owner = address(config.payment.recipient);
  if (payer.address === owner) throw new Error('Use a buyer wallet different from the merchant receiving wallet.');
  const [source] = await findAssociatedTokenPda({ mint, owner: payer.address, tokenProgram: TOKEN_PROGRAM_ADDRESS });
  const [destination] = await findAssociatedTokenPda({ mint, owner, tokenProgram: TOKEN_PROGRAM_ADDRESS });
  const transfer = getTransferCheckedInstruction({ source, mint, destination, authority: payer, amount: units, decimals: config.payment.token.decimals });
  const message = pipe(
    createTransactionMessage({ version: 'legacy' }),
    (tx) => setTransactionMessageFeePayer(payer.address, tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash(lifetime, tx),
    (tx) => appendTransactionMessageInstructions([
      getCreateAssociatedTokenIdempotentInstruction({ payer, ata: destination, owner, mint }),
      { ...transfer, accounts: [...transfer.accounts, { address: address(intent.reference), role: AccountRole.READONLY }] },
      { programAddress: address(MEMO_PROGRAM), accounts: [], data: new TextEncoder().encode(intent.memo) },
    ], tx),
  );
  return { transaction: compileTransaction(message), source, destination };
}

export async function preparePayment(config: StorefrontConfig, payerAddress: string, units: bigint, intent: PaymentIntent) {
  assertDevnetPayment(config, units);
  const rpc = createSolanaRpc(config.payment.rpcUrl ?? DEFAULT_RPC);
  if (await rpc.getGenesisHash().send(timeout()) !== DEVNET_GENESIS) throw new Error('RPC is not Solana devnet. Nothing was sent.');
  const mint = await fetchMint(rpc, address(config.payment.token.mint), { commitment: 'confirmed', ...timeout() });
  if (mint.programAddress !== TOKEN_PROGRAM_ADDRESS || !mint.data.isInitialized || mint.data.decimals !== config.payment.token.decimals) {
    throw new Error('Configured mint is not an initialized classic SPL token with the expected decimals on devnet.');
  }
  const { value: lifetime } = await rpc.getLatestBlockhash({ commitment: 'confirmed' }).send(timeout());
  const prepared = await buildPaymentTransaction(config, payerAddress, units, intent, lifetime);
  const source = await fetchMaybeToken(rpc, prepared.source, { commitment: 'confirmed', ...timeout() });
  if (!source.exists || source.data.amount < units) {
    throw new Error(`Not enough ${config.payment.token.symbol}. Ask the demo operator to send at least ${formatTokenAmount(units, config.payment.token.decimals)} tokens of this exact devnet mint to your connected Solana address. Do not buy real DRU.`);
  }
  if (source.programAddress !== TOKEN_PROGRAM_ADDRESS || source.data.owner !== payerAddress || source.data.mint !== mint.address || source.data.state !== AccountState.Initialized) {
    throw new Error('The buyer token account is invalid or frozen.');
  }
  const wire = getBase64EncodedWireTransaction(prepared.transaction);
  const [sol, destination] = await Promise.all([
    rpc.getBalance(address(payerAddress), { commitment: 'confirmed' }).send(timeout()),
    fetchMaybeToken(rpc, prepared.destination, { commitment: 'confirmed', ...timeout() }),
  ]);
  // 0.01 test SOL comfortably covers this fixed instruction set and a new token account.
  // Simulation below is authoritative for the actual fee/rent and account conditions.
  if (sol.value < 10_000_000n) throw new Error('Keep at least 0.01 devnet SOL in the buyer wallet for fees and token-account rent. Use the devnet SOL faucet; do not send mainnet SOL.');
  if (destination.exists && (destination.programAddress !== TOKEN_PROGRAM_ADDRESS || destination.data.owner !== config.payment.recipient || destination.data.mint !== mint.address || destination.data.state !== AccountState.Initialized)) {
    throw new Error('The receiving token account is invalid or frozen.');
  }
  const simulation = await rpc.simulateTransaction(wire, { encoding: 'base64', commitment: 'confirmed', sigVerify: false }).send(timeout());
  if (simulation.value.err) throw new Error('Devnet simulation rejected this transfer. Check test balances, mint and wallet accounts; nothing was sent.');
  return { rpc, transaction: prepared.transaction, bytes: new Uint8Array(getTransactionEncoder().encode(prepared.transaction)), lifetime };
}

export function inspectSignedPayment(unsigned: Uint8Array, signed: Uint8Array) {
  const decoder = getTransactionDecoder();
  const expected = decoder.decode(unsigned);
  const actual = decoder.decode(signed);
  if (actual.messageBytes.length !== expected.messageBytes.length || actual.messageBytes.some((byte, i) => byte !== expected.messageBytes[i])) {
    throw new Error('Wallet changed the payment transaction. Nothing was submitted.');
  }
  assertIsFullySignedTransaction(actual);
  return { signature: getSignatureFromTransaction(actual), wire: getBase64EncodedWireTransaction(actual) };
}
