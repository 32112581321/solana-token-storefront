import { getWallets } from '@wallet-standard/app';
import type { StorefrontConfig } from './domain/types';

export const DEVNET_CHAIN = 'solana:devnet';
export const DEVNET_CAIP_CHAIN = 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1';
export const DEVNET_RPC = 'https://api.devnet.solana.com';
type Wallet = ReturnType<ReturnType<typeof getWallets>['get']>[number];
type Account = Wallet['accounts'][number];
export type WalletName = 'Phantom' | 'MetaMask';
export interface WalletSession {
  name: WalletName;
  address: string;
  sign(transaction: Uint8Array): Promise<Uint8Array>;
  disconnect(): Promise<void>;
}

// Initialize discovery before the user clicks; extensions can register asynchronously.
const registry = getWallets();
let metamask: Promise<import('@metamask/connect-solana').SolanaClient> | undefined;

function devnetChain(chains: readonly string[]): typeof DEVNET_CHAIN | typeof DEVNET_CAIP_CHAIN | undefined {
  return chains.includes(DEVNET_CHAIN) ? DEVNET_CHAIN
    : chains.includes(DEVNET_CAIP_CHAIN) ? DEVNET_CAIP_CHAIN : undefined;
}

export async function connectWallet(
  name: WalletName,
  config: StorefrontConfig,
  onInvalidated: () => void,
): Promise<WalletSession> {
  if (!window.isSecureContext) throw new Error('Wallets require HTTPS or localhost. Do not open the HTML file directly.');
  if (name === 'MetaMask' && /Android|iPhone|iPad/i.test(navigator.userAgent)) {
    throw new Error('MetaMask Solana devnet requires its desktop browser extension. Mobile supports mainnet only.');
  }
  let wallet = registry.get().find((candidate) => candidate.name === name && devnetChain(candidate.chains));
  if (name === 'MetaMask' && !wallet) {
    const { hasExtension } = await import('@metamask/connect-multichain');
    if (!await hasExtension()) throw new Error('MetaMask desktop extension was not detected. Install or enable it in this browser, unlock it, and reload. Mobile QR connections do not support Solana devnet.');
    const { createSolanaClient } = await import('@metamask/connect-solana');
    metamask ??= createSolanaClient({
      dapp: { name: config.storefront.name, url: window.location.href },
      api: { supportedNetworks: { devnet: config.payment.rpcUrl ?? DEVNET_RPC } },
      analytics: { enabled: false },
    }).catch((error: unknown) => { metamask = undefined; throw error; });
    wallet = (await metamask).getWallet();
  }
  if (!wallet) throw new Error(`Open this page in a browser with the ${name} extension installed and unlocked, then retry. In-app preview browsers may not have extensions.`);

  const connect = wallet.features['standard:connect'] as { connect(): Promise<{ accounts: readonly Account[] }> } | undefined;
  const signer = wallet.features['solana:signTransaction'] as {
    signTransaction(input: { account: Account; chain: string; transaction: Uint8Array }): Promise<readonly { signedTransaction: Uint8Array }[]>;
  } | undefined;
  if (!connect || !signer) throw new Error(`Update ${name}: Solana transaction signing is required.`);
  const { accounts } = await connect.connect();
  const account = accounts.find((entry) => devnetChain(entry.chains) && entry.features.includes('solana:signTransaction'));
  if (!account) throw new Error(`Enable Solana devnet in ${name} and reconnect. An Ethereum or mainnet-only account cannot pay here.`);
  const chain = devnetChain(account.chains)!;
  let active = true;
  const events = wallet.features['standard:events'] as {
    on(event: 'change', listener: (change: { accounts?: readonly Account[]; chains?: readonly string[] }) => void): () => void;
  } | undefined;
  const unsubscribe = events?.on('change', () => {
    // Fail closed on account/network changes, even while a signing prompt is open.
    if (!active) return;
    active = false;
    onInvalidated();
  });
  return {
    name,
    address: account.address,
    async sign(transaction) {
      if (!active) throw new Error('Wallet account or network changed. Reconnect before paying.');
      const result = await signer.signTransaction({ account, chain, transaction });
      if (!active) throw new Error('Wallet account or network changed; transaction was not submitted.');
      if (!result[0]) throw new Error('The wallet did not return a signed transaction.');
      return result[0].signedTransaction;
    },
    async disconnect() {
      active = false;
      unsubscribe?.();
      const feature = wallet.features['standard:disconnect'] as { disconnect(): Promise<void> } | undefined;
      await feature?.disconnect();
    },
  };
}
