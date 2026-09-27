# Solana Token Storefront

A forkable, statically hosted commerce template that prices real SKUs in a selected Solana token and hands an exact payment request to a compatible wallet on **devnet**.

The checked-in starter is the complete Daily Roman Updates reference catalog: eight active products plus three original draft concepts. The commerce engine itself is token-agnostic and configured through public JSON files.

The repository also includes `case-study.html`, an interactive and explicitly hypothetical model for a token-only merchandise campaign with a community-directed share of campaign profit. Its figures are adjustable assumptions, not reported results or financial projections.

> [!IMPORTANT]
> This repository is an unofficial demonstration. It does not verify payment, create an order, reserve inventory, collect customer information, calculate shipping or tax, or trigger fulfillment. Test-token transfers can still be irreversible. Do not enable it on mainnet without a real order service, server-side settlement verification, replay protection, and merchant review.

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

## Commands

```sh
npm run dev              # local Vite development server
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

Publish the generated `dist/` directory. The production build uses relative asset paths and requires no serverless functions, environment variables, database, or secrets.

| Host | Build command | Output directory | Notes |
| --- | --- | --- | --- |
| GitHub Pages | `npm ci && npm run build` | `dist` | The included Pages workflow uploads `dist`; repository-subpath hosting is supported. |
| Cloudflare Pages | `npm ci && npm run build` | `dist` | Select the Node 22 runtime. |
| Netlify | `npm ci && npm run build` | `dist` | No functions or redirect rules are required. |
| Vercel | `npm ci && npm run build` | `dist` | Choose Vite or Other; do not add server functions. |
| Self-hosted | `npm ci && npm run build` | `dist` | Serve with any static web server, for example `python3 -m http.server -d dist 8080`. |

After deployment, verify that `storefront.config.json`, `catalog.json`, and all paths under `images/` are publicly readable from the same site. A receiving address cannot be hidden in a client-side storefront and does not need to be secret.

## Production boundary

This template ends when it opens the wallet. It deliberately has no “payment complete” control because a static page cannot prove settlement.

Before physical goods can be sold, the merchant must add an order service that reserves inventory, collects and protects delivery information, computes tax and shipping, verifies the exact mint/recipient/raw amount/reference at finalized commitment, prevents replay, reconciles uncertain outcomes, and releases fulfillment only after verification.

## Attribution and licensing

Source code and original concept artwork are MIT licensed. The DRU/WBS reference catalog and product imagery are included only for an attributed creator handoff and are excluded from the MIT license. Review [`NOTICE.md`](NOTICE.md) and replace or obtain permission for excluded material before an unrelated public or commercial launch.
