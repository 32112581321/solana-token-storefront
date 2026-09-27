import { Connection, LAMPORTS_PER_SOL, PublicKey, clusterApiUrl } from '@solana/web3.js';

const address = process.env.DEVNET_WALLET;
const requestedSol = Number(process.env.DEVNET_SOL || '0.05');
const rpcUrl = process.env.DEVNET_RPC_URL || clusterApiUrl('devnet');

if (!address) {
  throw new Error('Set DEVNET_WALLET to the public address that should receive devnet SOL.');
}

let wallet;
try {
  wallet = new PublicKey(address);
} catch {
  throw new Error('DEVNET_WALLET must be a valid Solana public key.');
}

if (!Number.isFinite(requestedSol) || requestedSol <= 0 || requestedSol > 0.1) {
  throw new Error('DEVNET_SOL must be greater than 0 and no more than 0.1.');
}

const connection = new Connection(rpcUrl, 'confirmed');
const lamports = Math.round(requestedSol * LAMPORTS_PER_SOL);
const signature = await connection.requestAirdrop(wallet, lamports);

for (let attempt = 0; attempt < 45; attempt += 1) {
  const status = await connection.getSignatureStatus(signature, { searchTransactionHistory: true });
  if (status.value?.err) {
    throw new Error(`Devnet airdrop failed: ${JSON.stringify(status.value.err)}`);
  }
  if (status.value?.confirmationStatus === 'confirmed' || status.value?.confirmationStatus === 'finalized') {
    const balance = await connection.getBalance(wallet, 'confirmed');
    console.log(JSON.stringify({
      network: 'devnet',
      recipient: wallet.toBase58(),
      requestedSol,
      balanceSol: balance / LAMPORTS_PER_SOL,
      signature,
      explorerUrl: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
    }, null, 2));
    process.exit(0);
  }
  await new Promise((resolve) => setTimeout(resolve, 1_000));
}

throw new Error(`Timed out waiting for airdrop ${signature} to confirm.`);
