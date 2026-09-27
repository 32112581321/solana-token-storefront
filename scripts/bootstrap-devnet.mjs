import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  Transaction,
  TransactionInstruction,
  clusterApiUrl,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  createMint,
  createTransferCheckedInstruction,
  getAccount,
  getMint,
  getOrCreateAssociatedTokenAccount,
  mintToChecked,
} from '@solana/spl-token';

const DECIMALS = 6;
const PAYMENT_AMOUNT = 30;
const PAYMENT_UNITS = BigInt(PAYMENT_AMOUNT) * 10n ** BigInt(DECIMALS);
const MIN_PAYER_BALANCE = 0.05 * LAMPORTS_PER_SOL;
const MINT_TOP_UP_UNITS = 10_000n * 10n ** BigInt(DECIMALS);
const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
const rpcUrl = process.env.DEVNET_RPC_URL || clusterApiUrl('devnet');
const stateDirectory = resolve(process.cwd(), '.devnet');

await mkdir(stateDirectory, { recursive: true });

async function loadOrCreateKeypair(name) {
  const path = resolve(stateDirectory, `${name}.json`);
  try {
    const bytes = JSON.parse(await readFile(path, 'utf8'));
    return Keypair.fromSecretKey(Uint8Array.from(bytes));
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    const keypair = Keypair.generate();
    await writeFile(path, `${JSON.stringify([...keypair.secretKey])}\n`, { mode: 0o600 });
    return keypair;
  }
}

async function confirmAirdrop(connection, signature) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const status = await connection.getSignatureStatus(signature, { searchTransactionHistory: true });
    if (status.value?.err) throw new Error(`Devnet airdrop failed: ${JSON.stringify(status.value.err)}`);
    if (status.value?.confirmationStatus === 'confirmed' || status.value?.confirmationStatus === 'finalized') return;
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 1_000));
  }
  throw new Error('Timed out waiting for the devnet airdrop to confirm.');
}

async function ensurePayerBalance(connection, payer) {
  let balance = await connection.getBalance(payer.publicKey, 'confirmed');
  if (balance >= MIN_PAYER_BALANCE) return balance;
  const grants = [0.5, 0.1, 0.05];
  let lastError;
  for (const sol of grants) {
    try {
      const signature = await connection.requestAirdrop(payer.publicKey, sol * LAMPORTS_PER_SOL);
      await confirmAirdrop(connection, signature);
      balance = await connection.getBalance(payer.publicKey, 'confirmed');
      if (balance >= MIN_PAYER_BALANCE) return balance;
    } catch (error) {
      lastError = error;
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 1_500));
    }
  }
  throw new Error(
    `Devnet faucet could not fund ${payer.publicKey.toBase58()}. `
    + `Use https://faucet.solana.com/ and rerun this command. Last error: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
}

async function loadOrCreateMint(connection, payer) {
  const mintKeypair = await loadOrCreateKeypair('mint');
  const existing = await connection.getAccountInfo(mintKeypair.publicKey, 'confirmed');
  if (existing) {
    const mint = await getMint(connection, mintKeypair.publicKey, 'confirmed', TOKEN_PROGRAM_ID);
    if (mint.decimals !== DECIMALS) throw new Error(`Existing mint uses ${mint.decimals} decimals; expected ${DECIMALS}.`);
    return mintKeypair.publicKey;
  }
  return createMint(
    connection,
    payer,
    payer.publicKey,
    null,
    DECIMALS,
    mintKeypair,
    { commitment: 'confirmed' },
    TOKEN_PROGRAM_ID,
  );
}

const connection = new Connection(rpcUrl, 'confirmed');
const genesisHash = await connection.getGenesisHash();
if (genesisHash !== 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG') throw new Error('RPC is not Solana devnet. Nothing was sent.');
const payer = await loadOrCreateKeypair('payer');
const merchant = await loadOrCreateKeypair('merchant');
const payerLamports = await ensurePayerBalance(connection, payer);
const mint = await loadOrCreateMint(connection, payer);
const payerTokenAccount = await getOrCreateAssociatedTokenAccount(
  connection,
  payer,
  mint,
  payer.publicKey,
  false,
  'confirmed',
  { commitment: 'confirmed' },
  TOKEN_PROGRAM_ID,
);
const merchantTokenAccount = await getOrCreateAssociatedTokenAccount(
  connection,
  payer,
  mint,
  merchant.publicKey,
  false,
  'confirmed',
  { commitment: 'confirmed' },
  TOKEN_PROGRAM_ID,
);

let payerTokenBalance = (await getAccount(connection, payerTokenAccount.address, 'confirmed', TOKEN_PROGRAM_ID)).amount;
if (payerTokenBalance < PAYMENT_UNITS) {
  await mintToChecked(
    connection,
    payer,
    mint,
    payerTokenAccount.address,
    payer,
    MINT_TOP_UP_UNITS,
    DECIMALS,
    [],
    { commitment: 'confirmed' },
    TOKEN_PROGRAM_ID,
  );
  payerTokenBalance += MINT_TOP_UP_UNITS;
}

const merchantBalanceBefore = (await getAccount(connection, merchantTokenAccount.address, 'confirmed', TOKEN_PROGRAM_ID)).amount;
const reference = Keypair.generate().publicKey;
const transferInstruction = createTransferCheckedInstruction(
  payerTokenAccount.address,
  mint,
  merchantTokenAccount.address,
  payer.publicKey,
  PAYMENT_UNITS,
  DECIMALS,
  [],
  TOKEN_PROGRAM_ID,
);
transferInstruction.keys.push({ pubkey: reference, isSigner: false, isWritable: false });

const memo = `DRU-DEV-${reference.toBase58().slice(0, 12)}`;
const memoInstruction = new TransactionInstruction({
  keys: [],
  programId: MEMO_PROGRAM_ID,
  data: Buffer.from(memo, 'utf8'),
});
const transaction = new Transaction().add(transferInstruction, memoInstruction);
const signature = await sendAndConfirmTransaction(connection, transaction, [payer], {
  commitment: 'confirmed',
});
const transactionDetails = await connection.getTransaction(signature, {
  commitment: 'confirmed',
  maxSupportedTransactionVersion: 0,
});
const merchantBalanceAfter = (await getAccount(connection, merchantTokenAccount.address, 'confirmed', TOKEN_PROGRAM_ID)).amount;

if (merchantBalanceAfter - merchantBalanceBefore !== PAYMENT_UNITS) {
  throw new Error('Verified recipient balance delta does not match the requested payment amount.');
}

const proof = {
  schemaVersion: 1,
  network: 'devnet',
  rpcUrl,
  genesisHash,
  token: {
    symbol: 'TEST DRU',
    mint: mint.toBase58(),
    decimals: DECIMALS,
  },
  payer: payer.publicKey.toBase58(),
  recipient: merchant.publicKey.toBase58(),
  recipientTokenAccount: merchantTokenAccount.address.toBase58(),
  amount: String(PAYMENT_AMOUNT),
  amountMinorUnits: PAYMENT_UNITS.toString(),
  reference: reference.toBase58(),
  memo,
  signature,
  slot: transactionDetails?.slot ?? null,
  recipientBalanceBefore: merchantBalanceBefore.toString(),
  recipientBalanceAfter: merchantBalanceAfter.toString(),
  payerSolBalance: payerLamports / LAMPORTS_PER_SOL,
  verifiedAt: new Date().toISOString(),
  explorerUrl: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
};

await writeFile(resolve(stateDirectory, 'last-proof.json'), `${JSON.stringify(proof, null, 2)}\n`, { mode: 0o600 });
console.log(JSON.stringify(proof, null, 2));
