import { readFile } from 'node:fs/promises';
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { createAssociatedTokenAccountIdempotentInstruction, createTransferCheckedInstruction, getAccount, getAssociatedTokenAddressSync, getMint } from '@solana/spl-token';

// Operator-only helper. Never import this file into the browser or publish .devnet/.
const [recipientArg, amount = '100', ...extra] = process.argv.slice(2);
if (!recipientArg || extra.length) throw new Error('Usage: npm run devnet:fund -- PUBLIC_SOLANA_ADDRESS [TOKEN_AMOUNT]. Sends tokens plus 0.02 devnet SOL from the local demo payer.');
const recipient = new PublicKey(recipientArg);
const config = JSON.parse(await readFile(new URL('../public/storefront.config.json', import.meta.url), 'utf8'));
if (config.payment.network !== 'devnet' || config.payment.token.mint === '14kH2osUyEJnqBZ7yFK4pLKJGuPZU4pr1enhi2ZLEmRw' || config.payment.blockedMints.includes(config.payment.token.mint)) throw new Error('Only the configured devnet test mint is allowed.');
const decimals = config.payment.token.decimals;
const match = /^(0|[1-9]\d*)(?:\.(\d+))?$/.exec(amount);
if (!Number.isInteger(decimals) || decimals < 0 || decimals > 9 || !match || (match[2] ?? '').length > decimals) throw new Error('Invalid exact token amount or decimals.');
const units = BigInt(match[1]) * 10n ** BigInt(decimals) + BigInt((match[2] ?? '').padEnd(decimals, '0') || '0');
if (units <= 0n || units > 1_000n * 10n ** BigInt(decimals)) throw new Error('Send between zero (exclusive) and 1,000 test tokens per invocation.');
const connection = new Connection(process.env.DEVNET_RPC_URL || config.payment.rpcUrl || 'https://api.devnet.solana.com', 'confirmed');
if (await connection.getGenesisHash() !== 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG') throw new Error('RPC is not devnet. Nothing was sent.');
let payer;
try {
  payer = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(await readFile(new URL('../.devnet/payer.json', import.meta.url), 'utf8'))));
} catch {
  throw new Error('Local demo payer is unavailable. Run devnet:bootstrap for your own mint and configure its public addresses. Do not request or share another operator’s keys.');
}
if (payer.publicKey.equals(recipient)) throw new Error('Choose a tester wallet different from the local payer.');
const mint = new PublicKey(config.payment.token.mint);
const mintInfo = await getMint(connection, mint);
if (mintInfo.decimals !== decimals) throw new Error('Configured decimals do not match the devnet mint.');
const source = getAssociatedTokenAddressSync(mint, payer.publicKey);
const destination = getAssociatedTokenAddressSync(mint, recipient);
if ((await getAccount(connection, source)).amount < units) throw new Error('Local payer does not hold enough tokens of the configured mint.');
if (await connection.getBalance(payer.publicKey) < 30_000_000) throw new Error('Local payer needs at least 0.03 devnet SOL. Use the devnet faucet.');
const transaction = new Transaction().add(
  createAssociatedTokenAccountIdempotentInstruction(payer.publicKey, destination, recipient, mint),
  createTransferCheckedInstruction(source, mint, destination, payer.publicKey, units, decimals),
  SystemProgram.transfer({ fromPubkey: payer.publicKey, toPubkey: recipient, lamports: 20_000_000 }),
);
const signature = await sendAndConfirmTransaction(connection, transaction, [payer], { commitment: 'confirmed' });
console.log(JSON.stringify({ network: 'devnet', recipient: recipient.toBase58(), mint: mint.toBase58(), tokenAmount: amount, devnetSOL: '0.02', signature, explorer: `https://explorer.solana.com/tx/${signature}?cluster=devnet` }, null, 2));
