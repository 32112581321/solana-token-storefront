# Solana Token Storefront

A community contribution for token holders: an open-source merchandise storefront that gives a selected Solana token something practical to do.

The idea is straightforward. Offer merchandise people want, let them pay with the community token, and explore whether the creator would dedicate a disclosed portion of campaign profit to community-selected projects. Using a token is optional from a commerce perspective; the reason for this experiment is to give the community another way to use it.

**Status: working devnet prototype, offered for community review.** The repository includes a storefront, a local inventory and order service, and documentation for anyone who wants to fork it. The community profit allocation, voting, and buyback/burn ideas are proposals; they are not implemented or agreed commitments.

| Start here | What you will find |
| --- | --- |
| [Community proposal](COMMUNITY_PROPOSAL.md) | The contribution, the case for a trial, proposed profit allocation, and ways token holders can participate |
| [User manual](USER_MANUAL.md) | Local setup, wallet configuration, inventory, devnet checkout, merchant operations, hosting, and troubleshooting |
| [Browse the demonstration](https://32112581321.github.io/solana-token-storefront/) | Eight DRU reference products, variants, cart, and a devnet wallet handoff |
| [Explore the campaign case study](https://32112581321.github.io/solana-token-storefront/case-study.html) | Adjustable, hypothetical campaign assumptions; not actual sales or a forecast |

## What is included

- Eight active Daily Roman Updates reference products and three original, non-purchasable design concepts, with local images.
- Variant selection, visible **Add to cart** controls, quantity changes, and a cart that survives refresh.
- Prices stored as decimal strings and totaled using integer token units.
- Solana Pay QR codes and wallet links with recipient, mint, exact amount, reference, and memo.
- An optional Node/SQLite service for stock, expiring reservations, order snapshots, manual payment reconciliation, and fulfillment status.
- A merchant CLI and automated configuration, unit, inventory, and browser checks.

The implementation uses Vite, vanilla TypeScript, HTML, and CSS. The optional service uses Node's built-in SQLite support.

## Try it on your computer

Install Git and Node.js 22.12 or newer, then run:

```sh
git clone https://github.com/32112581321/solana-token-storefront.git
cd solana-token-storefront
npm ci
npm run validate-config
npm run dev
```

Open the local URL printed by Vite, normally `http://127.0.0.1:5173/`. Browse products and try the cart. No deployment is necessary for this local trial. Internet access is still needed for installation and Solana transactions.

The checked-in configuration uses the upstream demo's receiving wallet and a disposable `TEST DRU` devnet mint. **Fork owners must set their own receiving wallet before collecting any test payments intended for them.** See the [configuration instructions](USER_MANUAL.md#configure-your-store).

## Choose how to run it

| Mode | What runs | What checkout does |
| --- | --- | --- |
| `static` — default | The storefront on localhost or a static host | Generates a wallet request; does not reserve stock or verify an order |
| `service` — optional | The storefront plus the local Node/SQLite process | Reserves stock before generating the request; the merchant later reconciles payment using the CLI |

The public GitHub Pages demo uses `static` mode. The service is included in the repo for the fork owner to run. It is not hosted by GitHub Pages.

To try inventory locally, follow the [manual](USER_MANUAL.md#run-inventory-locally), set `inventory.mode` to `service`, and initialize stock:

```sh
npm run inventory:admin -- init
npm run inventory:admin -- receive DRU-IST-TANK-S 10 "Opening test stock"
npm run inventory:serve
```

Keep that terminal running and run `npm run dev` in another terminal in the same repository. The manual explains reconciliation and the current reservation timing limitations.

## Where payments go

The wallet request sends the configured token directly to a token account belonging to `payment.recipient`. The application does not custody the payment, take a platform percentage, or split proceeds automatically. Network fees are separate. PAID integration, treasury transfers, voting, buybacks, and burns are not implemented in this repository.

The [recorded devnet proof](public/devnet-proof.json) documents an earlier 30 `TEST DRU` transfer to the demo recipient. It is historical evidence of that test, not a receipt for a visitor's current cart or an inventory order.

## Scope and attribution

This is an independent contribution, not an official DRU or WBS Apparel store, an approved token initiative, or an offer to ship goods. Devnet tokens have no monetary value. The user-supplied mainnet reference mint is blocked in the starter; a real mainnet launch requires further implementation and review, not a configuration switch.

The service does not collect delivery details, calculate shipping or tax, process refunds, or send products. The storefront does not display a verified payment-success screen. The [proposal](COMMUNITY_PROPOSAL.md) describes a possible creator-approved pilot after those operational gaps are addressed.

Code and original concept artwork are [MIT licensed](LICENSE.md). Third-party names, designs, catalog data, and product imagery are excluded; see [NOTICE.md](NOTICE.md). Reuse of that material requires the relevant rights holder's permission.

## Contribute

Token holders can try the demo, report a confusing step, suggest merchandise they would actually buy, improve the code, or help review the proposed community allocation. Forking the repo does not require owning tokens. This proposal requests feedback and participation; it does not request a token transfer or a treasury allocation.

Use [GitHub Issues](https://github.com/32112581321/solana-token-storefront/issues) for discussion and pull requests for changes. Include reproduction steps for bugs and keep wallet secrets and customer information out of public reports.

For code changes, run the checks relevant to your change. The full verification sequence is documented in the [manual](USER_MANUAL.md#maintainer-checks). A fork owner chooses and operates their own hosting; the repo does not automatically publish forks.
