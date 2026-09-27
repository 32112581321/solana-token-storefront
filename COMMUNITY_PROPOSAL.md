# A community contribution: give the token a use at the merch counter

**Draft for token-holder discussion · 27 September 2026**

[Read the README](README.md) · [Try the demo](https://32112581321.github.io/solana-token-storefront/) · [Run it yourself](USER_MANUAL.md)

[Settlement vault design](docs/SETTLEMENT_VAULT_PROPOSAL.md) · [Public roadmap](https://32112581321.github.io/solana-token-storefront/roadmap.html) · [Repo graph & maintenance](docs/ROADMAP.md)

## The contribution

I built a forkable Solana merchandise storefront and am offering the code as a community contribution. My proposal is to test a simple idea together: make good merchandise available for the community token, then let token holders help choose how a creator-approved share of the resulting profit is used.

There is no commercial requirement to add a token to a merchandise checkout. The purpose here is specifically to create another reason to use it. That only has value if the merchandise is appealing and the buying experience works. A token payment requirement also adds friction, especially for someone who has never used a wallet.

The contribution is available now as an open-source devnet prototype. I am asking for feedback, volunteer testing, and a conversation with the creator about whether a small pilot would be useful. This draft does not request a treasury payment, token allocation, or transfer to the demo wallet. It does not commit the creator, token holders, or contributors to a launch or continuing support.

## What token holders can try today

The [repository](https://github.com/32112581321/solana-token-storefront) contains all eight reference merchandise products, three original draft concepts, a working cart, exact token prices, and a Solana Pay checkout. A local inventory service adds stock reservations, stored order details, manual devnet payment reconciliation, and fulfillment status.

Anyone can fork the code, set their receiving address and devnet mint, and run it on their computer. Hosting is the operator's choice. The [user manual](USER_MANUAL.md) explains the full local workflow.

The [public demonstration](https://32112581321.github.io/solana-token-storefront/) runs without the inventory service. It produces a devnet payment request, but it does not create a merchandise order or arrange delivery. The [existing transfer proof](public/devnet-proof.json) records one earlier test payment; it does not establish a real sale, a customer order, or approval from the creator.

## What this could test

An appealing, limited merchandise drop could give existing holders a reason to spend tokens and give interested customers a reason to acquire the amount needed for a purchase. Community promoters could direct attention toward specific products, sizes, designs, and delivery expectations.

The question is whether that turns into completed purchases and repeat interest. Spending tokens already held is not necessarily new buying demand, and a merchant may sell received tokens to cover production costs. Merchandise volume alone does not establish net token demand or a price outcome.

A useful contribution can still emerge: reusable software, feedback on wallet checkout, better merchandise ideas, and a record of how the community responds to a real use for the token.

## A proposed pilot

The following is a suggested sequence, not an approved schedule.

| Stage | Proposed work | Evidence needed before proceeding |
| --- | --- | --- |
| Community review | Holders try the catalog, discuss designs, and report friction | A public list of improvements and volunteers |
| Local devnet rehearsal | A merchant and testers run stock reservation, test payment, reconciliation, and exception handling | Matching order and transaction records; known limitations resolved or contained |
| Creator agreement | Confirm product rights, stock or production capacity, operator, costs, support, and proposed community share | A published campaign charter accepted by the creator and operator |
| Limited merchandise pilot | Offer a small, explicitly capped drop once payment and delivery operations are ready | Verified payments, delivery records, customer support, and cost records |
| Public closeout | Reconcile refunds and costs, publish the available community allocation, and run the agreed decision process | A reconciled statement, decision record, and execution receipts |

For the local rehearsal, a starting target could be ten completed test checkouts across at least two variants, plus an oversold attempt and an expired reservation. These are proposed test targets, not reported results.

A later merchandise pilot should cap orders at what the creator can supply. The eight reference products provide a starting catalog; they do not establish stock availability or a supplier relationship.

## A community-directed portion of profit

The creator would choose whether to participate and agree the percentage before taking orders. A suggested discussion starting point is **20% of positive distributable campaign profit**, with 80% retained by the creator/operator under their agreement. These percentages are proposed, not configured in the checkout.

For this proposal, define distributable campaign profit as realized merchandise receipts after refunds, less documented product, packaging, delivery, payment/conversion, promotion, and support costs, and less agreed tax and remaining customer-obligation reserves. The charter must define those categories before sales begin and prevent the same cost from being deducted twice. An unsold token balance should not be treated as spendable cash merely because a screen displays a valuation.

The allocation would be calculated after the campaign books and agreed return window close:

```text
community allocation = max(distributable campaign profit, 0) × agreed share
```

If the campaign has no positive distributable profit, this formula produces no community allocation. Publish when any unused reserve will be reconciled and whether that creates a later allocation.

Here is a deliberately simple illustration, not a sales estimate or a token-price assumption:

| Hypothetical campaign closeout | Reporting-currency value |
| --- | ---: |
| Merchandise receipts after refunds | $3,000 |
| Documented costs and agreed reserves | $2,100 |
| Distributable profit | $900 |
| Community allocation at 20% | $180 |
| Creator/operator remainder | $720 |

Customers would pay in the selected token. These example figures use one reporting currency only to explain the arithmetic. A real report must also show actual token units received, tokens converted, realized proceeds, conversion costs, and any remaining balance. The [interactive case study](https://32112581321.github.io/solana-token-storefront/case-study.html) uses different adjustable assumptions; neither model is a forecast or a commitment.

## How the community could choose

Before a pilot, publish a charter with the creator's agreed percentage, eligible proposals, voting eligibility, balance snapshot date if applicable, vote weighting, quorum, voting window, tie/no-quorum outcome, responsible signers, and an execution deadline. Those rules need an explicit community decision; this repo does not supply a voting system or prove that an existing governance process exists.

Possible uses of the available allocation include commissioning the next design, funding product samples, improving the storefront, supporting a history project, retaining a reserve, or burning tokens. Holders should be able to argue for the use they consider worthwhile, including retaining the funds if no proposal is ready.

Buyback and burn needs precise wording. If the allocation is already held in the community token, burning some of it is a direct burn; it does not require a new market purchase. A buyback would first spend a separately held asset to acquire tokens, followed by a burn. Those are different actions and must not be counted as the same new demand twice.

If a burn is selected, evidence should identify the mint, raw quantity, transaction, and supply reduction. Solana's Token Program provides `Burn` and `BurnChecked` instructions that reduce a token balance and mint supply. A transfer to a supposed “dead wallet” is not the same supply-reducing instruction. See the [official burn documentation](https://solana.com/docs/tokens/basics/burn-tokens). The storefront implements neither buying nor burning, and this proposal makes no promise about their effect on price.

A proposed community treasury could use a separately labeled wallet with multiple signers and publish execution receipts. That arrangement must be created and agreed separately. Under the current code, all checkout tokens go directly to the configured merchant recipient. A later community allocation is a merchant commitment and transfer, not an automatic split or an escrow enforced by this application.

Holding the token would not, under this proposal, grant a dividend, a redemption right, or ownership of the creator's business. The proposed participation concerns the use of an agreed community budget.

## A proposed settlement reserve and contributor incentives

The [expanded design](docs/SETTLEMENT_VAULT_PROPOSAL.md) documents a possible authorized merchant connector and USDC settlement reserve. Customers would pay DRU; a reserve would cover agreed merchant obligations while a bounded controller replenishes USDC through executable swap routes. This is working capital at risk, not automatic staking yield. A reserve can defer conversions, not guarantee that token selling disappears.

Community capital providers would need a reason to participate: for example, a separately agreed share of realized net settlement fees or creator-approved margin. No fixed yield, principal protection, allocation rate, or contributor rights have been promised. Fee eligibility, loss valuation, any funded first-loss buffer, fair withdrawal queues, caps, custody and legal review all precede accepting deposits. Start with a simulator and operator-funded staging tests, not fundraising.

Vault contribution would be distinct from merely holding the token. Any future capital-provider claim requires separately reviewed terms. Contributor rewards must not be counted again as community profit; fees allocated to capital providers are deducted once before the community share. Neither customer obligations nor contributor principal can fund buybacks or burns.

The [roadmap](https://32112581321.github.io/solana-token-storefront/roadmap.html) separates existing devnet code from proposed work and explicit gates. It is stored as [JSON in this repo](public/roadmap/graph.json), not a committed schedule or evidence of creator approval. No deposits, mainnet vault, automatic swaps, or real merchant orders are implemented.

## How supporters could help market the merchandise

Start with the products: actual samples, fit and size information, artwork, price, delivery regions, and a short demonstration of checkout. Community promoters can share their own reasons for wanting the merchandise and invite others to try the local demo.

For a real campaign, give participating promoters the same published facts and distinguish volunteer support from paid promotion or free samples. A small launch window and trackable campaign links can help measure whether attention becomes purchases. Tracking, referral rewards, and affiliate payouts are not built into this repo and would need a separate implementation and budget.

Useful reporting would cover completed and refunded orders, fulfilled units, payment failures, support workload, token units received, realized costs, community allocation, and participation in the agreed decision. Do not report test transactions as customer demand or announce a buyback as an accomplished result before it has happened.

## Responsibilities and remaining work

| Participant | Proposed responsibility |
| --- | --- |
| Creator/rights holder | Approve merchandise use, supply terms, campaign economics, and the community-share commitment |
| Merchant/operator | Run the service, control the receiving wallet, manage stock, reconcile payments, handle delivery and refunds, and publish accounts |
| Token holders | Test, suggest products, review the charter and reports, and participate in the agreed decision process |
| Contributors | Submit improvements and review code; any continuing maintenance arrangement would be agreed separately |
| Community fund signers, if appointed | Execute the approved allocation and publish receipts |

The software is a devnet prototype, not a production launch kit. Payment verification needs further adversarial review; reservations have timing and refresh limitations described in the manual. Customer delivery details, shipping/tax calculations, refunds, public-service protections, and payment monitoring remain work for a real launch. PAID or another merchant settlement system would require an explicit integration; none is assumed here.

Names, designs, product imagery, and reference catalog data belong to their respective rights holders. The code and original concept art are MIT licensed; the exclusions are in [NOTICE.md](NOTICE.md). This contribution is not affiliated with or endorsed by Daily Roman Updates, WBS Apparel, or the token's operators.

## The invitation

Try the storefront, tell us which products you would actually want, and point out where the checkout becomes confusing. If you can test a wallet, improve documentation, review the payment code, or help with merchandise operations, your contribution is useful.

Share feedback through [repository issues](https://github.com/32112581321/solana-token-storefront/issues) or a pull request. The immediate decision is whether this is worth a community rehearsal and a creator conversation. Any real-money campaign, profit commitment, or treasury action would be a separate, explicit decision with the necessary people involved.
