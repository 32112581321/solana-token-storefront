# User manual

[README](README.md) · [Community proposal](COMMUNITY_PROPOSAL.md) · [Public demo](https://32112581321.github.io/solana-token-storefront/)

This manual covers the current devnet prototype. You can browse the demonstration, run your own copy, or operate the optional inventory service locally. Test purchases do not order real merchandise.

## Contents

- [Try the demonstration](#try-the-demonstration)
- [Run a local copy](#run-a-local-copy)
- [Configure your store](#configure-your-store)
- [Edit products and prices](#edit-products-and-prices)
- [Run inventory locally](#run-inventory-locally)
- [Rehearse a devnet payment](#rehearse-a-devnet-payment)
- [Merchant operations](#merchant-operations)
- [Data and backups](#data-and-backups)
- [Hosting your fork](#hosting-your-fork)
- [Troubleshooting](#troubleshooting)
- [Maintainer checks](#maintainer-checks)

## Try the demonstration

Open the [public storefront](https://32112581321.github.io/solana-token-storefront/). Choose a product variant, select **Add to cart**, and adjust or remove items in the cart drawer. The three design concepts are drafts and cannot be purchased.

Selecting **Continue to devnet payment** shows an exact token total and **Connect Phantom / Connect MetaMask** buttons. Connect, then select **Pay … on devnet** to review the transaction in your wallet. Connecting alone does not send anything. A Solana Pay QR and **Open wallet** link remain under **Alternative** for compatible wallets. The public demo uses static mode: it neither reserves stock nor stores an order.

`TEST DRU` is a disposable token on Solana **devnet**, a development network. Devnet and Solana's separately named testnet are different clusters; use devnet for this project. See the [Solana cluster documentation](https://solana.com/docs/references/clusters).

For an actual test transfer you need a compatible wallet set to devnet, tokens of the exact configured mint, and devnet SOL for transaction fees. There is no token faucet inside the storefront. The operator must arrange test tokens for participants. Neither a token with the same symbol nor real mainnet DRU can substitute for the configured mint.

The page's **View verified test transfer** link opens a historical test record. It does not confirm payment of your current cart.

### Phantom and MetaMask checkout

1. Open the storefront over HTTPS or localhost in a normal desktop browser with your chosen extension installed and unlocked. An embedded preview browser may not have access to your wallet extension.
2. In Phantom, open **Settings → Developer Settings → Testnet Mode**, then use **Solana Devnet**, not Solana Testnet. See [Phantom's testnet guide](https://docs.phantom.com/developer-powertools/testnet-mode).
3. MetaMask uses its native Solana account, not its Ethereum `0x` address. Use a current **desktop extension**; [MetaMask documents Solana devnet/testnet as extension-only](https://docs.metamask.io/metamask-connect/solana/quickstart/javascript/). Its mobile app is not supported for this devnet flow. Do not use the SDK's mobile QR fallback for this test.
4. Add merchandise, continue to checkout, and choose **Connect Phantom** or **Connect MetaMask**. Approve the connection. Copy the public Solana address shown and ask the operator for TEST DRU; get devnet SOL from the [Solana faucet](https://faucet.solana.com/). The faucet supplies SOL, not this custom token. Keep at least 0.01 devnet SOL for fees and token-account rent.
5. Choose **Pay … on devnet**. The page checks the RPC's devnet genesis hash, mint program/decimals, token balance and SOL balance, and simulates the exact transfer before opening the signing prompt. It supports classic SPL tokens, not Token-2022, and spends from the buyer's associated token account.
6. In the wallet, review the exact mint, amount and recipient. The transaction contains an idempotent receiving-token-account creation, an exact token transfer with a reference, and a memo. It grants no spending allowance. Decline anything unexpected.
7. After approval, the storefront submits the unchanged signed transaction to the verified devnet endpoint and shows its signature and Explorer link. **Submitted is not paid, settled, ordered, or fulfilled.** The merchant must still reconcile service-mode orders. Network failure during submission is ambiguous: check the displayed signature before another attempt.

The reference, wallet session and receipt live in memory. Save the signature before refreshing. There is no global duplicate-payment protection in static mode; a reload or a changed cart is a new opportunity to pay. QR links cannot enforce a wallet's network, so use the direct connection buttons for this test. Wallet extensions may display unverified-token/domain warnings; do not disable their security checks or approve a transaction you do not understand.

### Send test assets to a browser wallet (operator only)

If you control the disposable `.devnet/payer.json` created by bootstrap and it holds the configured test token, run:

```sh
npm run devnet:fund -- TESTER_PUBLIC_SOLANA_ADDRESS 100
```

Replace the placeholder with the connected buyer's **public** address. This sends 100 tokens of your configured devnet mint **plus 0.02 devnet SOL** from the local demo payer in one transaction. It checks devnet identity, rejects the mainnet DRU mint, caps each token grant at 1,000, and prints a public transaction receipt. It does not mint more tokens or expose keys to the browser. A fresh fork does not contain the upstream payer's keys; bootstrap your own setup and configure its mint, or ask the upstream operator for a grant. Do not import the shared demo payer into a personal wallet.

## Run a local copy

You need Node.js 22.12 or newer, npm, and a browser. Git is optional if you download a release. Use `node --version` to check Node. Run all commands below from the repository directory unless stated otherwise.

### Download a release

Open [v1.0.0-devnet.2 on GitHub Releases](https://github.com/32112581321/solana-token-storefront/releases/tag/v1.0.0-devnet.2). The downloads are publicly hosted on GitHub.

| Download | Use it for |
| --- | --- |
| `solana-token-storefront-v1.0.0-devnet.2-source.zip` | The full editable project, including the storefront, local inventory service, scripts, tests, manual, and proposal |
| `solana-token-storefront-v1.0.0-devnet.2-static.zip` | An already built storefront for a static web server; includes documentation under `docs/`, but does not run the inventory service |
| `SHA256SUMS.txt` | Checking that your downloaded ZIPs match the released bytes |

For the source bundle, extract the ZIP and open a terminal inside `solana-token-storefront-v1.0.0-devnet.2`. Run:

```sh
npm ci
npm run validate-config
npm run dev
```

Follow the rest of this manual to configure your own wallet or start inventory. No local database, signing keys, or installed dependencies are distributed. The ZIP is a source project, not a desktop installer.

For the static bundle, extract it and serve the contents of its `solana-token-storefront-v1.0.0-devnet.2-static` folder. If Python 3 is installed, a local preview from inside that folder is:

```sh
python3 -m http.server --bind 127.0.0.1 8080
```

Then open `http://127.0.0.1:8080/`. To host it elsewhere, upload that folder's contents, including `index.html`, `assets/`, `images/`, and the public JSON files. Do not open the HTML directly from the filesystem. Edit the root-level `storefront.config.json` and `catalog.json` for the static bundle; the source bundle uses the `public/` paths throughout this manual.

The release is labeled a **prerelease** because it is a devnet prototype. Its configuration still points to the public demo's test recipient until you change it. The accompanying release notes describe the operational limits.

To check integrity on macOS or Linux, keep both ZIPs and `SHA256SUMS.txt` in one folder and use `shasum -a 256 -c SHA256SUMS.txt` or `sha256sum -c SHA256SUMS.txt`. On Windows, use PowerShell's `Get-FileHash` with `-Algorithm SHA256` and compare the result with the file. Checksums verify the downloaded bytes against the published files; they are not a security audit.

### Clone the source

To try the upstream copy:

```sh
git clone https://github.com/32112581321/solana-token-storefront.git
cd solana-token-storefront
npm ci
npm run validate-config
npm run dev
```

Vite prints a URL, normally `http://127.0.0.1:5173/`. Open that URL; do not open `index.html` directly from the filesystem. Stop the server with Ctrl+C when finished.

To own your changes, first select **Fork** on the [GitHub repository](https://github.com/32112581321/solana-token-storefront), then clone the URL of your fork instead of the upstream URL. You do not need a hosting account to run locally.

`localhost` and `127.0.0.1` mean the computer opening the address. Sharing a localhost link does not make your server available on someone else's computer. A local trial can run on one computer; a public shop needs an operator-managed, reachable service. Installation and chain verification also require internet access.

## Configure your store

Edit [public/storefront.config.json](public/storefront.config.json). Keep the existing structure and `schemaVersion: 1`.

| Field | What to enter |
| --- | --- |
| `storefront` | Your name, short name, tagline, description, disclosure, and six-digit theme colors |
| `payment.enabled` | `false` to browse without generating payment requests; `true` after configuring payment |
| `payment.network` | Always `"devnet"` in this version |
| `payment.rpcUrl` | Optional public browser-accessible devnet RPC; defaults to `https://api.devnet.solana.com`. HTTPS, or HTTP localhost for a local proxy; never a secret API key. The direct checkout verifies devnet identity. |
| `payment.recipient` | The public receiving wallet you control, not a token account address |
| `payment.token.symbol` | Display text, up to 12 characters |
| `payment.token.mint` | The exact mint address of your devnet token |
| `payment.token.decimals` | The mint's actual precision, an integer from 0 through 9 |
| `payment.label` | The store label displayed by a compatible wallet |
| `payment.memoPrefix` | 2–24 uppercase letters, numbers, or hyphens, such as `STORE-DEV` |
| `payment.blockedMints` | Addresses that must not be used for this checkout; retain the supplied mainnet reference exclusion |
| `inventory.mode` | `"static"` for a standalone page or `"service"` for tracked inventory |
| `inventory.serviceUrl` | The inventory API base URL, required in service mode |
| `inventory.reservationMinutes` | Reservation duration, 1–120 minutes; defaults to 15 |

Addresses and RPC URLs are public configuration. Never enter seed phrases, private keys, or secret RPC credentials in this file. Use a browser-safe, origin-restricted endpoint if the public RPC is rate-limited. Configuration validation checks syntax, not chain state. Direct wallet checkout additionally checks the mint and decimals on devnet before signing; QR-only users must verify them independently. Existing schema-version-1 files without `rpcUrl` remain compatible.

The upstream recipient is `8YRJP9pHJJtcDqX29hwGKmCmvBwmcyoCaKmFnyk43UNL`; its mint is `FAM2TEFYrRXFVQ8W16SkPwaeZyWPcLnjieiTMYvc6Kpw` with six decimals. Cloning the repo gives you neither control of that wallet nor access to its test tokens. Replace both with your own test setup when appropriate.

The user-supplied mainnet reference `14kH2osUyEJnqBZ7yFK4pLKJGuPZU4pr1enhi2ZLEmRw` is included as a blocked mint. This version has no supported mainnet configuration.

For a browse-only copy, set `payment.enabled` to `false` and use static inventory. For a local inventory rehearsal, use valid payment settings with `payment.enabled: true` and replace the `inventory` object with:

```json
{
  "mode": "service",
  "serviceUrl": "http://127.0.0.1:8787",
  "reservationMinutes": 15
}
```

This is the value of the existing `inventory` property, not a complete configuration file. Update the storefront disclaimer to reflect a test that stores local reservations—for example, “Unofficial devnet rehearsal. Test orders are recorded locally; no real goods are sold or shipped.”

After edits, run `npm run validate-config`, restart the inventory service if it is running, and reload the browser. The service reads its configuration and catalog at startup.

### Create a disposable test setup

For developers without their own devnet mint, the repo includes:

```sh
npm run devnet:bootstrap
```

This is an active test script, not a read-only setup check. It generates or reuses local keypairs in `.devnet/`, requests devnet SOL when needed, creates or reuses a six-decimal mint, mints test tokens when needed, and sends 30 test tokens to its generated merchant wallet. It writes `.devnet/last-proof.json` and prints the public transaction details. The balance check in this script uses confirmed commitment; the inventory CLI separately requests finalized transactions.

The script does not edit your public config. Copy its public recipient and mint into your config, with `decimals: 6`, if using that setup. Tokens initially belong to the script's payer; run `devnet:fund` above to give your browser wallet test assets.

If the airdrop fails, the script prints the payer's public address. Use an available devnet faucet or an already funded devnet test wallet, then rerun. Do not purchase devnet tokens or fund the address on mainnet. Bootstrap, funding, direct checkout and CLI reconciliation check the RPC's genesis hash and reject a non-devnet endpoint.

The `.devnet/` directory contains signing material and is ignored by Git. Do not copy it into a public directory or commit it. The checked-in `public/devnet-proof.json` is a separate historical artifact and is not rewritten by bootstrap.

## Edit products and prices

Edit [public/catalog.json](public/catalog.json), preserving `schemaVersion: 1`.

Each product has a unique `id` and `slug`, a name, description, `active` or `draft` status, local images, option groups, and variants. Each variant has a globally unique SKU, selected option values, an exact `tokenAmount` string, and an `available` flag. Active products require variants; drafts stay visible without entering checkout.

For example, a variant can look like this when its product declares an option group named `size` containing `M`:

```json
{
  "sku": "COMMUNITY-TEE-M",
  "options": { "size": "M" },
  "tokenAmount": "30",
  "displayPrice": "Optional reference copy",
  "available": true
}
```

`"30"` means 30 units of the configured token. It does not mean $30, and there is no exchange-rate feed or automatic repricing. `displayPrice` is text only. With six token decimals, `"0.125"` corresponds to 125,000 minor units; all payment totals use integer arithmetic.

Put images in `public/images/` and refer to them as `./images/your-file.png`, with useful alt text. Remote product images and outbound shop URLs are rejected. Read [NOTICE.md](NOTICE.md) before reusing the reference images and designs.

In static mode, `available: true` is only a catalog flag. In service mode, the server also checks counted stock. New SKUs start with zero stock. Keep SKUs stable once they have order history and use `available: false` to withdraw a variant rather than reusing its SKU for a different item.

Validate your changes, restart the service, and reload the storefront. Existing reservation snapshots retain their original prices; changing a JSON price does not rewrite them.

## Run inventory locally

The optional inventory service—sometimes called the sidecar—is a second Node process. It stores stock and order records in SQLite. It does not need wallet signing keys.

After configuring service mode and enabled devnet payment, initialize the database and receive stock:

```sh
npm run inventory:admin -- init
npm run inventory:admin -- receive DRU-IST-TANK-S 10 "Opening test stock"
npm run inventory:admin -- list
```

Use a SKU from your actual catalog. The starter currently contains 37 active, available SKUs across eight products. `init` adds missing SKUs at zero and preserves existing counts; `receive` adds to stock each time you run it.

Start the service in terminal A:

```sh
npm run inventory:serve
```

Start the storefront in terminal B, from the same repository:

```sh
npm run dev
```

Keep both running. The default inventory address is `http://127.0.0.1:8787`; opening its `/health` endpoint should show `{"status":"ok","schemaVersion":1}`. Open Vite's URL to shop. Service mode fails to start if inventory cannot be fetched, and a checkout reservation performs a fresh server-side stock check.

The three stock columns mean:

| Column | Meaning |
| --- | --- |
| `onHand` | Unsold stock recorded in the ledger; verified sales have already been deducted |
| `reserved` | Units held by unexpired checkout reservations |
| `available` | Stock that can still be reserved, normally `onHand − reserved` |

The ledger's `onHand` is not a count of all physical goods still sitting on a shelf: paid, unshipped goods have already left this number.

## Rehearse a devnet payment

Have the operator and tester ready together. This version requires manual reconciliation while the reservation is still valid.

1. Load the local storefront, choose an in-stock variant, and add it to the cart.
2. Select **Continue to devnet payment** once. The service creates an order snapshot and reserves the requested units. A successful response supplies the QR and wallet link.
3. Save the order ID and expiry shown on the page. The order ID is different from the Solana reference and transaction signature.
4. Connect Phantom or MetaMask and select **Pay … on devnet**. Check the receiving wallet, exact mint, and total before approving. The transaction preserves the service's reference and memo. A compatible Solana Pay wallet remains an alternative.
5. Give the operator the order ID and transaction signature. Do not supply a seed phrase or private key.
6. The operator runs the reconciliation command below before the reservation expires. Once the transaction is finalized and matches, the CLI reports `fulfillment_pending` and stock is deducted.

The Solana Pay request itself does not select the wallet network. Its fields follow the [Solana Pay specification](https://solana.com/docs/tools/solana-pay/specification/version1); a manually entered token transfer may omit the correlation fields that this service requires.

### Current timing and refresh behavior

- Reconciliation uses the time the CLI runs to decide whether the reservation is still valid. Even a payment sent before expiry can become an `exception` if it is reconciled afterward.
- The page removes expired payment controls and checks expiry again after signing, before direct submission. It cannot revoke a QR you already scanned or guarantee confirmation before expiry. No verified success state is shown.
- Only the cart's SKU/quantity pairs survive refresh. A reservation ID is not restored into the browser; save it before paying. The operator can still find it in `orders`.
- Continue reuses an unexpired reservation for the same cart. Cart editing is paused during reservation creation and wallet requests. Changing the cart attempts to cancel its previous unpaid reservation; once submission has been attempted, the order is left for the merchant to reconcile instead. A failed cancellation leaves stock held until expiry.
- Stock shown on product cards is a startup snapshot. Reload to see newly received stock; the reservation endpoint is authoritative if another buyer took the last unit.

Reservations are released lazily when inventory is read, a reservation is created, or payment is reconciled. There is no scheduled expiry worker or automatic payment watcher. Listing orders alone does not refresh expired statuses; run `list` to trigger inventory expiry processing.

## Merchant operations

Use the same repository directory and database path for the API and CLI. All administrative commands are local terminal operations.

```sh
npm run inventory:admin -- help
npm run inventory:admin -- list
npm run inventory:admin -- receive DRU-IST-TANK-S 5 "New test stock"
npm run inventory:admin -- adjust DRU-IST-TANK-S -1 "Damaged unit"
npm run inventory:admin -- orders
```

Adjustments require a reason and a nonzero integer. Count carefully: a negative adjustment can conflict with reservations already held. Pause a SKU and resolve active holds before reducing reserved stock. The CLI does not yet provide a reservation-aware stock reconciliation workflow.

To verify payment, replace both placeholders below with the saved order ID and the actual devnet signature:

```sh
npm run inventory:admin -- reconcile ORDER_ID DEVNET_SIGNATURE
```

The verifier requests a finalized transaction, checks it succeeded, looks for the order reference and exact memo, and compares the recipient's token balance increase with the expected mint and raw amount. It then commits the inventory change in SQLite. Signature reuse is constrained by a unique database field. This is prototype verification; it has not been presented as an independently audited payment processor.

The result is recorded locally, not pushed into a browser success screen. Once the operator has actually completed the agreed delivery task, they can record that explicitly:

```sh
npm run inventory:admin -- fulfill ORDER_ID
```

During a test, this marks a simulated delivery. It does not purchase a label, send a supplier an order, or ship anything.

| Status | What the operator should understand |
| --- | --- |
| `reserved` | A checkout hold exists; payment has not been verified by the service |
| `expired` | The hold expired and stock is available again |
| `cancelled` | A hold was released, normally after a cart change |
| `fulfillment_pending` | Reconciliation succeeded and stock was deducted; delivery remains the operator's job |
| `fulfilled` | The operator explicitly recorded fulfillment |
| `exception` | A matching payment was reconciled after the reservation was no longer active; stock was not automatically sold |

An `exception` needs manual investigation. There is no refund command, no automatic stock reassignment, and no CLI transition that resolves it into a normal paid order. A failed verification also does not prove that no funds moved—wrong amounts or missing memos can require manual investigation. Do not ask a tester to pay again until the first transaction has been checked.

Payments go directly to the configured receiving wallet's token account. The repo does not route them through PAID, deduct a store platform fee, or calculate a community profit allocation. Those would be separate arrangements and integrations.

## Data and backups

| Location | Contents |
| --- | --- |
| Browser `localStorage` | Versioned SKU/quantity cart lines; no saved order ID or delivery details |
| `public/storefront.config.json` and `public/catalog.json` | Public store settings, recipient/mint, prices, and catalog |
| `.inventory/storefront.sqlite` | Local stock, order snapshots, inventory events, and reconciled transaction signatures |
| `.inventory-build/` | Generated server JavaScript; rebuildable |
| `.devnet/` | Local test keys and bootstrap output, if bootstrap was run |
| `public/devnet-proof.json` | Historical public test proof, not a live ledger |

The database and `.devnet/` are ignored by Git. They are not backed up by pushing your repository. The application does not request customer names, email addresses, or delivery information. Keep delivery records outside public config, transaction memos, and GitHub issues.

The storefront persists only versioned SKU/quantity cart data. MetaMask Connect may separately store its own connection/session metadata. Its analytics are disabled in this integration. Wallet secrets remain in the extension; the application receives a public address and signed transaction. Connecting also involves the wallet vendor's software and services.

For a simple local backup, stop the inventory server with Ctrl+C and ensure no CLI process is writing, then copy the entire `.inventory/` directory to private backup storage. Include any SQLite `-wal` and `-shm` files that exist; copying only the main file while a process is writing can miss committed data. Use SQLite-aware backup tooling if continuous operation is required. Restore with all writers stopped, then run `list` and `orders` to check the restored ledger.

Do not delete the database as a routine reset while payments or orders exist. It is the record that associates payments with stock and protects against signature reuse within that store.

### Environment variables

| Variable | Purpose | Default |
| --- | --- | --- |
| `STOREFRONT_DB_PATH` | SQLite file used by API and CLI | `.inventory/storefront.sqlite` |
| `STOREFRONT_INVENTORY_PORT` | API port | `8787` |
| `STOREFRONT_ALLOWED_ORIGIN` | Comma-separated browser origins | `http://127.0.0.1:5173`, `http://127.0.0.1:4173`, `http://127.0.0.1:4174`, `http://localhost:5173` |
| `STOREFRONT_CONFIG_PATH` | Alternative public configuration path for the service | `public/storefront.config.json` |
| `STOREFRONT_CATALOG_PATH` | Alternative catalog path for the service | `public/catalog.json` |
| `SOLANA_RPC_URL` | Reconciliation RPC endpoint; must be devnet | Solana's public devnet endpoint |
| `DEVNET_RPC_URL` | Bootstrap script RPC override; must be devnet | Solana's public devnet endpoint |

There is no automatic `.env` file loader in the Node service. Set variables in your shell or process manager. Keep server and browser catalog/payment settings consistent if using alternate files.

## Hosting your fork

For a local demonstration, keep using `npm run dev`. For a static website, build:

```sh
npm ci
npm run build
```

Publish only `dist/`. Production assets use relative paths so repository subpaths work. `npm run preview` lets you inspect that build locally.

| Static host | Build command | Output | Setup note |
| --- | --- | --- | --- |
| GitHub Pages | `npm ci && npm run build` | `dist` | Adapt the repository restriction in `.github/workflows/pages.yml`; use GitHub Actions as the Pages source |
| Cloudflare Pages | `npm ci && npm run build` | `dist` | Choose a Node version compatible with the project's minimum |
| Netlify | `npm ci && npm run build` | `dist` | Publish the generated static directory |
| Vercel | `npm ci && npm run build` | `dist` | Use a static/Vite build configuration |
| Self-hosted | `npm ci && npm run build` | `dist` | Serve the output with a static web server |

Static mode needs no functions, database, or secrets. Forks do not deploy through the upstream workflow unless their owner changes its repository restriction and enables hosting.

Service mode also needs a running Node process and durable storage. The included API binds only to `127.0.0.1`; to make it remotely accessible, the operator must configure a reverse proxy on that machine, HTTPS, the allowed storefront origin, and a public `inventory.serviceUrl`. The static frontend and API can be hosted separately. A visitor's `127.0.0.1` is their own computer, not the merchant's server.

Install the full dependency set on a service host: TypeScript and the Solana libraries used by the CLI are currently listed under development dependencies. `npm ci --omit=dev` will not support the documented service commands.

The service has no authentication, rate limiting, or abuse controls on its public reservation/order endpoints; CORS is not authentication. A public production operator must address those gaps, payment verification review, availability/monitoring, refunds, and delivery operations before accepting real orders. This manual's supported path is a local devnet rehearsal. The repository does not automatically deploy the service.

## Troubleshooting

| Symptom | Check or action |
| --- | --- |
| Node reports an unknown SQLite option or module | Use Node 22.12 or newer and reinstall with `npm ci`. Experimental SQLite notices on the supported Node 22 release are expected. |
| Storefront will not start | Read the displayed configuration error; run `npm run validate-config` from the repo root. |
| Failed inventory fetch | Start the service, open `/health`, and check `inventory.serviceUrl` and the allowed browser origin. |
| Vite chose a different port | Use its printed URL and add that exact origin to `STOREFRONT_ALLOWED_ORIGIN`, then restart the service. |
| Products are out of stock | Run `list`, receive the exact active SKU, and reload the storefront. Initialization intentionally creates zero stock. |
| Reservation failed despite a visible item | Another hold may have consumed stock. Check `list`, wait for abandoned holds to expire, and reload. |
| Wallet link does nothing | Use a wallet that supports Solana Pay transfer requests and devnet, or scan its QR on a supported device. |
| Phantom is not detected | Open the page in the desktop browser where the extension is installed, unlock it, and retry. Embedded preview browsers may not expose extensions. |
| MetaMask mobile cannot connect | Solana devnet is extension-only in MetaMask. Use its desktop extension and native Solana account. |
| RPC fails or is rate-limited | Retry later or configure a public browser-safe devnet RPC in `payment.rpcUrl`; CLI reconciliation uses `SOLANA_RPC_URL` separately. Do not expose secret RPC keys. |
| Submission outcome unknown | Save and inspect the shown signature on devnet Explorer. Do not immediately retry or refresh and pay again. |
| Wallet shows no test tokens | Match the mint and network; ask the operator to fund your test wallet. Bootstrap only funds its generated payer. |
| Finalized transaction not found | Check the network/signature and allow finalization time. If the hold expires meanwhile, handle the result as an exception. |
| Reference, memo, or amount mismatch | Inspect the original transaction. Do not fulfill or resend payment based on the page or a screenshot. |
| Order remains `reserved` after paying | There is no watcher. Run the CLI reconciliation while the hold is active. |
| Order became `exception` | Reconciliation occurred after cancellation/expiry. Investigate and resolve manually; there is no automatic refund. |
| Refresh lost checkout details | Only the cart is persisted in the browser. The operator can recover the order ID with `orders`. |

For a bug report, include Node version, browser/wallet version, static or service mode, reproduction steps, and the error text. Share only the public transaction information needed for the investigation; do not post local key files or database backups.

## Maintainer checks

After implementation changes, the complete check sequence is:

```sh
npm run validate-config
npm run typecheck
npm run inventory:typecheck
npm test
npm run test:inventory
npm run build
npx playwright install chromium
npm run test:e2e
```

`validate-config` validates the current public config, catalog, and local image files. The browser smoke suite targets the starter DRU catalog, so a fork that replaces product names, SKUs, counts, or layout should adapt those fixtures. The historical transfer proof is tested separately from your current payment settings.

The code, SQLite tests, and browser tests are available for inspection. Passing them is useful evidence for development; it does not certify readiness to handle public mainnet orders.

Wallet browser tests use Wallet Standard mocks and a simulated RPC; they verify real serialized/signable transaction bytes, not installed extensions. A separate **opt-in, network-mutating** smoke test sends one base unit from `.devnet/payer.json` using the same builder: `DEVNET_WALLET_SMOKE=1 npx vitest run tests/devnet-wallet-live.test.ts`. Never enable it in CI; the standard suite skips it. Test actual extension approvals separately before inviting users.

The current MetaMask dependency tree has an npm advisory through its transitive `uuid` dependency (GHSA-w5hq-g745-h8pq). Local tooling also retains the Solana-library advisories disclosed in the previous release. Run `npm audit` for current details; this is an unaudited devnet preview, not a security-certified payment system.
