# Solana Token Storefront

A forkable commerce template that prices real SKUs in a selected Solana token and hands an exact payment request to a compatible wallet on **devnet**. It works as a static catalog by default and includes an opt-in local Node/SQLite inventory sidecar for reservations, orders, settlement reconciliation, and fulfillment status.

The checked-in starter is the complete Daily Roman Updates reference catalog: eight active products plus three original draft concepts. The commerce engine itself is token-agnostic and configured through public JSON files.

The repository also includes `case-study.html`, an interactive and explicitly hypothetical model for a token-only merchandise campaign with a community-directed share of campaign profit. Its figures are adjustable assumptions, not reported results or financial projections.

## Live devnet checkout

The upstream demo is configured with a disposable six-decimal `TEST DRU` mint and receiving wallet on Solana devnet. A 30 TEST DRU smoke payment was executed and verified by the recipient token-account balance change:

- [View the transaction in Solana Explorer](https://explorer.solana.com/tx/3MLUvuYppeqJt4DFC6tY1RXxMyznBRTcjmv2vy5bQfsHr925tKqb4PkWh8oisPfX8E4dJR57kqNUDktejE8kMUWz?cluster=devnet)
- [`public/devnet-proof.json`](public/devnet-proof.json) records the public mint, recipient, amount, reference, memo, signature, slot, and verified balance delta.

The test mint and test tokens have no monetary value. Local signing keys are generated under the ignored `.devnet/` directory and are never committed. Fork owners should replace the upstream recipient and mint with their own devnet configuration.

> [!IMPORTANT]
> This repository is an unofficial demonstration. The published GitHub Pages site runs in `static` inventory mode: it does not verify payment, create an order, reserve inventory, collect customer information, calculate shipping or tax, or trigger fulfillment. The optional local sidecar can reserve inventory and manually reconcile a finalized devnet payment, but it still collects no delivery information and never fulfills automatically. Test-token transfers can be irreversible. Do not enable it on mainnet without a production security, legal, tax, privacy, and operations review.

## Fork it

1. Fork `32112581321/solana-token-storefront` on GitHub.
2. Clone your fork.
3. Install Node.js 22.12 or newer.
4. Install dependencies:

   ```sh
   npm ci
   ```

5. Edit [`public/storefront.config.json`](public/storefront.config.json).
6. Edit [`public/catalog.json`](public/catalog.json) and replace images under `public/images/` as needed.
7. Validate everything:

   ```sh
   npm run validate-config
   npm run typecheck
   npm test
   ```

8. Start the local development server:

   ```sh
   npm run dev
   ```

Vite prints the local URL, normally `http://127.0.0.1:5173/`.

That is enough for the static version. Nothing needs to be deployed: a fork owner can run the storefront and the optional inventory service entirely from their own computer.

## Set the receiving address

Wallet addresses and token mint addresses are public identifiers, not secrets. Never add a seed phrase, private key, recovery phrase, or signing key to this repository.

Update the `payment` object in `public/storefront.config.json`:

```json
{
  "enabled": true,
  "network": "devnet",
  "recipient": "YOUR_DEVNET_RECEIVING_WALLET",
  "token": {
    "symbol": "YOUR TOKEN",
    "mint": "YOUR_DEVNET_TOKEN_MINT",
    "decimals": 6
  },
  "label": "Your store — devnet demonstration",
  "memoPrefix": "STORE-DEV",
  "blockedMints": [
    "MAINNET_MINTS_THAT_MUST_NEVER_BE_USED_HERE"
  ]
}
```

Then run `npm run validate-config`. Checkout remains fail-closed until the configuration is valid. The supplied mainnet DRU reference mint, `14kH2osUyEJnqBZ7yFK4pLKJGuPZU4pr1enhi2ZLEmRw`, is blocked in the starter and can never be used as its devnet payment mint.

The Solana Pay URI does not select the wallet's cluster. The customer must explicitly use devnet. The request includes the recipient, exact token amount, token mint, unique reference, label, message, and memo as defined by the [Solana Pay transfer-request specification](https://github.com/solana-foundation/pay/blob/master/SPEC.md).

## Commerce data model

`public/catalog.json` is the public catalog interface:

- `Product` describes identity, copy, status, local images, and option groups.
- `ProductVariant` is a real SKU with selected option values, availability, and an exact `tokenAmount` decimal string.
- `active` products require variants and display **Add to cart**.
- `draft` products are visible concepts and cannot enter the cart.
- `displayPrice` is optional reference copy only; it never affects checkout math.

Token amounts are converted to integer minor units using the configured decimals and summed with `BigInt`. JavaScript floating-point numbers are never used for payment totals.

The persisted cart contains only a version number plus SKU/quantity pairs. No name, email, shipping address, wallet identity, or other customer information is requested or stored.

## Optional local inventory and orders

The repository includes a deliberately small, Gallery-inspired sidecar: the catalog is the merchant-controlled pricebook, checkout creates an immutable order snapshot, inventory changes are recorded in an event ledger, reservations are atomic and expiring, and a payment signature can be committed only once. It is not required for the static demo.

The service uses Node's built-in SQLite support. Its local database lives at `.inventory/storefront.sqlite`, which is ignored by Git. To try it:

1. Change the public config to service mode:

   ```json
   "inventory": {
     "mode": "service",
     "serviceUrl": "http://127.0.0.1:8787",
     "reservationMinutes": 15
   }
   ```

2. Initialize the ledger and add stock using real SKUs from `public/catalog.json`:

   ```sh
   npm run inventory:admin -- init
   npm run inventory:admin -- receive DRU-IST-TANK-S 10 "Opening stock"
   npm run inventory:admin -- list
   ```

3. Run the service in one terminal and Vite in another:

   ```sh
   npm run inventory:serve
   npm run dev
   ```

In service mode, the browser fails closed if the inventory service is unavailable. Out-of-stock variants cannot enter the cart. Continuing to checkout atomically reserves stock, stores a canonical price snapshot, and returns an expiring order ID plus the exact Solana Pay request. Changing the cart releases the old reservation; abandoned reservations expire automatically.

After a customer submits the devnet payment, the merchant reconciles the order from their own terminal using the order ID shown at checkout and the devnet transaction signature:

```sh
npm run inventory:admin -- orders
npm run inventory:admin -- reconcile ORDER_ID DEVNET_SIGNATURE
npm run inventory:admin -- fulfill ORDER_ID
```

Reconciliation fetches the finalized transaction from Solana devnet and requires the exact order reference, memo, token mint, receiving-wallet owner, and recipient token-balance delta. Only then does one SQLite transaction decrement stock and move the order to `fulfillment_pending`. An expired or cancelled order that is nevertheless paid is recorded as an `exception` instead of silently consuming stock. `fulfill` is an explicit merchant action.

This sidecar intentionally has no customer accounts, address form, shipping labels, tax engine, refunds, or automatic payment watcher. For physical merchandise, the merchant must arrange delivery details outside this template and handle exception payments manually.

### Local service settings

The defaults are safe for local development: the API binds to `127.0.0.1:8787`, accepts common local Vite origins, and writes to the ignored `.inventory/` directory.

| Environment variable | Purpose | Default |
| --- | --- | --- |
| `STOREFRONT_INVENTORY_PORT` | Local API port | `8787` |
| `STOREFRONT_DB_PATH` | Durable SQLite file | `.inventory/storefront.sqlite` |
| `STOREFRONT_ALLOWED_ORIGIN` | Comma-separated browser origins | Local Vite origins |
| `STOREFRONT_CONFIG_PATH` | Alternate public config path | `public/storefront.config.json` |
| `STOREFRONT_CATALOG_PATH` | Alternate catalog path | `public/catalog.json` |
| `SOLANA_RPC_URL` | Solana devnet RPC used by reconciliation | Public devnet endpoint |

Back up the SQLite file before and during a real campaign. Never put it in a public web root, commit it to Git, or expose the merchant CLI through an HTTP route.

## Commands

```sh
npm run dev              # local Vite development server
npm run inventory:serve  # local inventory/order API on 127.0.0.1:8787
npm run inventory:admin -- help # merchant inventory/order CLI
npm run test:inventory   # transactional SQLite ledger tests
npm run devnet:bootstrap # create a disposable mint and verify a real devnet token transfer
npm run validate-config  # validate config, catalog, and local images
npm run typecheck        # strict TypeScript check
npm test                 # unit tests
npm run test:e2e         # Playwright browser tests
npm run build            # validate, typecheck, and create dist/
npm run preview          # preview the production build locally
```

## Hosting

The upstream demo is published with the repository's GitHub Pages workflow. The workflow is restricted to `32112581321/solana-token-storefront`, so forks do not publish automatically. Fork owners can remove or update that repository check in `.github/workflows/pages.yml`, enable GitHub Pages with **GitHub Actions** as the source, and run the workflow.

For any host, build the static site with:

```sh
npm ci
npm run build
```

Publish the generated `dist/` directory. In `static` inventory mode, the production build uses relative asset paths and requires no serverless functions, environment variables, database, or secrets.

| Host | Build command | Output directory | Notes |
| --- | --- | --- | --- |
| GitHub Pages | `npm ci && npm run build` | `dist` | The included Pages workflow uploads `dist`; repository-subpath hosting is supported. |
| Cloudflare Pages | `npm ci && npm run build` | `dist` | Select the Node 22 runtime. |
| Netlify | `npm ci && npm run build` | `dist` | No functions or redirect rules are required. |
| Vercel | `npm ci && npm run build` | `dist` | Choose Vite or Other; do not add server functions. |
| Self-hosted | `npm ci && npm run build` | `dist` | Serve with any static web server, for example `python3 -m http.server -d dist 8080`. |

After deployment, verify that `storefront.config.json`, `catalog.json`, and all paths under `images/` are publicly readable from the same site. A receiving address cannot be hidden in a client-side storefront and does not need to be secret.

Service mode is different: GitHub Pages and other static hosts cannot run the Node process or persist SQLite. The fork owner must run the sidecar on a computer they control or deploy it to a persistent Node host, place it behind HTTPS, set `STOREFRONT_ALLOWED_ORIGIN` to the storefront origin, keep the database on durable storage, and point `inventory.serviceUrl` at that API. The repository does not deploy the sidecar automatically.

## Production boundary

In static mode, this template ends when it opens the wallet. It deliberately has no “payment complete” control because a static page cannot prove settlement.

The optional sidecar covers stock reservation, canonical order snapshots, exact finalized devnet verification, replay resistance, and a manual fulfillment gate. Before physical goods can be sold to the public, the merchant still needs a protected delivery-information workflow, shipping and tax policy, refunds, monitoring, authentication for any remotely accessible administrative surface, and operational procedures for uncertain or late payments.

## Attribution and licensing

Source code and original concept artwork are MIT licensed. The DRU/WBS reference catalog and product imagery are included only for an attributed creator handoff and are excluded from the MIT license. Review [`NOTICE.md`](NOTICE.md) and replace or obtain permission for excluded material before an unrelated public or commercial launch.
