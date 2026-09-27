# From token checkout to merchant settlement

Draft for community discussion · 27 September 2026 · **Not implemented or approved.**

[Community proposal](../COMMUNITY_PROPOSAL.md) · [Roadmap contract](ROADMAP.md) · [Public roadmap](https://32112581321.github.io/solana-token-storefront/roadmap.html)

This is a proposal for a community contribution, not a solicitation for deposits, an investment offer, a promised return, or an approved arrangement with the creator or merchant. No settlement vault, contributor deposit flow, automated conversion, merchant integration, or buyback/burn exists in this release. Do not send real assets to the demo. Mainnet cannot be enabled by changing a configuration field.

## 1. Purpose and current boundary

There is no need to add cryptocurrency to sell a shirt. The experiment is specifically to create a useful way to spend the community token. Good products, clear prices, reliable delivery, and willing buyers matter more than token mechanics. Existing holders spending tokens is not necessarily new buying demand; merchant conversions can offset customer purchases. Neither sales nor burns imply token appreciation.

Today the static storefront sends a devnet token payment directly to the configured merchant recipient. Its optional localhost inventory service reserves stock and supports manual payment reconciliation. The public Pages site does not run that service. Submission is not a verified order, and neither mode places an order with the original merchant. Wallet integration has automated mock coverage and a developer-signed devnet transaction proof; actual Phantom and MetaMask extension approval rehearsals remain an explicit roadmap task.

The proposed extension would connect three separate systems:

| System | Responsibility | What it does not do |
| --- | --- | --- |
| Merchant connector | Authoritative products, stock, landed price, pending orders, delivery and refund state | Manufacture a merchant relationship or pay fiat merely by marking an order paid |
| Settlement reserve and controller | Budget USDC for approved merchant obligations, bound DRU exposure, reconcile payouts | Guarantee principal, returns, liquidity, or eliminate conversion costs |
| Exchange route | Execute approved DRU/USDC swaps within explicit limits | Know when merchandise ships, which refunds are owed, or how much reserve is safe |

A reserve controller is not an AMM. Start by evaluating existing executable swap routes; a custom AMM adds another risk surface and is not required by this design. DRU route availability, depth, and usable execution prices have not been verified.

## 2. Connect to actual merchandise, with permission

The reference store appears to use WooCommerce, but that observation establishes neither API access nor a commercial agreement. The creator may only have a vendor account. The store operator must approve API access, inventory authority, accounting, customer support, and the payment method. Do not automate consumer checkout, reuse someone else's credentials, or create production orders as a demonstration. PAID is an unverified integration candidate, not an existing capability of this repository.

Proposed order flow:

1. Map each local SKU to merchant-approved product and variation IDs. Fetch authoritative availability, shipping regions, shipping charges, tax, discounts, and payable amount. Reference catalog prices are not binding supplier quotes.
2. Collect delivery data in a secured private service with consent, retention rules, and access controls. Never put customer data in Git, public roadmap JSON, transaction memos, or chain logs.
3. Create an expiring pending order/stock hold in the merchant's **staging** store first. Correlate internal order ID, merchant ID, quote ID, and unique payment reference. Freeze the exact quote and reserve the USDC obligation before offering payment.
4. Quote the DRU amount from a bounded, executable route with fees and a short expiry, not an easily manipulated spot price. Use integer minor units, explicit decimal rounding, mint/network checks, price-impact and liquidity limits. Reject stale quotes or an insufficient reserve.
5. Verify the customer's finalized token transfer independently on the service: correct network, mint, recipient, amount, reference, and permitted transaction semantics. A screenshot, wallet callback, or transaction submission is not settlement proof. Reject replay and duplicate order crediting.
6. Pay the merchant through an agreed USDC or fiat rail and verify the payout outcome. Only then transition the merchant order through its approved paid/fulfillment workflow. Retrying an unknown outcome must query/reconcile the existing payout, not create a second payment.
7. Consume authenticated webhooks, verify important state against the API, and reconcile regularly. Handle expired holds, late/partial/duplicate payments, stock changes, delivery failures, cancellations, and refunds as explicit states. A merchant outage pauses new commitments.

WooCommerce's [Orders API](https://developer.woocommerce.com/docs/apis/rest-api/v3/orders/) supports order records and product/variation IDs. Its paid flag changes order state; it does **not** execute a bank/card transfer. An authorized payment integration must use the merchant's completion and stock-handling rules, described in the [payment gateway documentation](https://developer.woocommerce.com/docs/features/payments/payment-gateway-api/). Store API secrets belong only in the operator's private service, not a static bundle.

If the merchant requires USD rather than USDC, an agreed payment provider/off-ramp and accounting reconciliation are necessary. A token transfer, cross-chain bridge, or order-status API alone cannot pay that fiat invoice. Refund terms must specify the currency, amount basis, conversion costs, responsible party, and deadlines before checkout.

## 3. USDC working capital, not magical staking yield

Proposed funding flow: contributors supply USDC working capital; customers pay DRU; the reserve pays merchant obligations in the agreed settlement asset; bounded DRU conversions replenish USDC. The capital provider is taking settlement and token-inventory risk. Calling the deposit “staking” does not create validator rewards or make it risk-free.

If both assets and the merchant settlement endpoint are on Solana, a cross-chain bridge is unnecessary. Circle's [CCTP](https://developers.circle.com/cctp) is a possible native-USDC burn/mint transport **only if a later merchant rail needs another supported chain**; it is not a fiat off-ramp or an order connector. Bridging remains optional and deferred. In-flight transfers must not be counted as spendable on both chains, and failures need finality, replay, and recovery procedures.

For a first implementation, use a simulator, then mock devnet assets and an operator-funded capped staging reserve. Do not add public community deposits until the custody design, economics, loss allocation, withdrawal policy, security review, and applicable legal/tax obligations are resolved.

### Reserve policy

Define distinct, non-overlapping obligations. A starting policy to simulate is:

```text
reserve floor = committed unpaid merchant obligations
              + refund / fee contingency
              + stressed additional payouts during replenishment delay

target reserve = reserve floor + a calibrated operating buffer

free withdrawal capacity = max(liquid settled USDC - reserve floor, 0)
```

The stressed-payout term excludes orders already counted as committed. The formula is a planning model, not a proven safe calibration. The controller should count finalized, accessible USDC conservatively, separately record every liability, and never count DRU inventory as liquid USDC. Borrowed capital and contributor deposits are liabilities/capital, not revenue.

Above the target: allow bounded batching, subject to a maximum DRU holding period and exposure cap. At the replenishment trigger: request executable swap quotes and refill toward the target if price impact, slippage, and liquidity pass policy. At or below the protected floor, or when quotes/rails are unavailable: stop new unbacked orders, preserve committed obligations, and escalate. Use hysteresis so small balance changes do not trigger constant tiny swaps. Admission must reserve each new order atomically; concurrent orders cannot spend the same USDC twice.

The objective is to minimize capital tied up and execution costs **subject to** solvency, customer obligations, latency, and exposure limits. The smallest possible reserve and the fewest conversions conflict. A larger batch can have worse price impact than several small ones. A reserve can delay DRU selling; it does not remove the eventual need to replenish unless genuine external revenue or risk capital covers the gap. Fewer swap transactions does not mean fewer DRU tokens sold.

[Jupiter's swap API](https://developers.jup.ag/docs/swap) is an implementation candidate for route discovery/execution, not a promise that this token has adequate liquidity. Simulations should compare per-order conversion, timed batches, and reserve-threshold replenishment under the same demand and price paths.

## 4. Why would people contribute capital?

Proposed incentive: a clearly disclosed share of **realized net settlement fees** or a creator-approved merchandise margin, denominated and accounted for in USDC. The creator must agree any margin contribution; fees affect checkout economics and may reduce conversion. No rate, allocation, lock period, or contributor rights have been approved.

Do not fund rewards with new deposits, count unrealized DRU appreciation as distributable income, or advertise an APY based on token emissions. A period with no safely distributable earnings pays nothing. Distributions must leave customer obligations, agreed reserves, and any required loss-buffer restoration fully funded.

One possible allocation rule to test:

```text
contributor distribution = realized distributable fee pool
                         × contributor eligible capital-time
                         ÷ total eligible capital-time
```

For example, a 100 USDC distributable fee pool and a 10% eligible capital-time share produce 10 USDC for that period. This is arithmetic, not a return forecast. Terms must define when capital becomes eligible, valuation after losses, queued withdrawals, rounding, and protection against deposits immediately before distribution. A deposit cap tied to actual working-capital needs avoids raising unnecessary idle capital. Merchandise perks or early access are optional alternatives, with costs explicitly budgeted.

### Principal, losses, and exits

If USDC is paid out and replaced economically by unsold DRU, the vault's assets are now a mix of USDC and risky DRU inventory. A receipt/share cannot honestly promise immediate redemption at the original one-USDC value. The design must specify conservative net-asset valuation after liabilities, liquidity haircuts, realized losses, and fair deposit/redemption pricing. Write down losses before processing exits so early withdrawals do not leave the entire loss to remaining contributors. An alternative operator-debt structure still has operator credit risk; it is not guaranteed principal.

An operator-funded first-loss buffer could absorb losses before contributor capital, up to its disclosed funded capacity. It is not insurance or an unlimited guarantee. Specify the complete loss waterfall and who bears losses once that buffer is exhausted. Never promise a backstop that has not actually been funded.

Publish exit notice/cooldown rules, queue order, liquidity limits, any gates, pro-rata loss treatment, and emergency authority before deposits. Demonstrate a withdrawal run under stressed demand. Do not imply that smart contracts can always unwind illiquid DRU, reverse merchant payments, or refund instantly.

## 5. Keep three pots separate

| Pot | What it represents | Allowed use under this proposal |
| --- | --- | --- |
| Customer obligations and vault capital | Committed payouts, refunds, operating reserves, contributor claims | Settlement and capital management under agreed terms; never discretionary burns |
| Contributor earnings | Realized net fee/margin allocation, after losses and required reserves | Distribute under agreed capital-provider terms; may be zero |
| Community profit budget | Creator-approved share of positive distributable merchandise profit | Community-selected uses under an explicit charter |

Avoid double counting: a settlement fee allocated to contributors is a campaign cost before calculating the community share, not the same profit distributed twice. Token ownership alone does not grant a claim on the vault or creator's business. Any future contributor claim would arise from a **separate** reviewed agreement or mechanism.

The community could select product development, software, grants, retained reserves, or buyback/burn **only from the available community budget**. A direct burn of DRU already held is not a market buyback. Neither action promises a price increase. Voting needs eligibility, snapshot/weighting, quorum, conflicts, time limits, execution authority, and public receipts. This release implements none of those treasury actions.

## 6. Release gates and ownership still to agree

The [machine-readable roadmap](../public/roadmap/graph.json) is the maintained task list. Its ordering is a proposal, not approval or delivery dates. Before any live funds or real orders:

- Creator and store operator approve rights, API access, supplier terms, payment rails, accounting, delivery, refunds, and accountable operators.
- Define legal structure, custody/control, contributor rights, jurisdiction and eligibility, applicable compliance/tax treatment, privacy, disclosures, and promoter compensation. Obtain qualified legal advice; do not assume that calling this a community vault exempts it from financial-services obligations.
- Threat-model contract/service roles, mint permissions, key custody, multisig/timelocks, upgrade powers, oracle/quote manipulation, and emergency pause/recovery. Commission independent security review; current tests are not an audit.
- Authenticate and rate-limit public endpoints; reconcile chain, merchant, reserve, and bank/provider ledgers idempotently. Test backups, key recovery, monitoring, payout failures, and a clear customer-support escalation path.
- Stress DRU drawdowns, vanished liquidity, large price impact, USDC depeg/freeze, RPC outages, merchant/off-ramp outages, optional bridge delays, demand spikes, refunds, and contributor exits. Set measurable stop conditions before an operator-funded capped rehearsal.
- Publish truthful reports: assets by mint, liquid reserve, obligations, exposure and valuation policy, actual fills/costs, losses, earned fees, payouts, withdrawal queue, orders fulfilled/refunded, and governance receipts. Protect customer and contributor private information.

Only a separately approved capped pilot should follow those gates. Community deposits are a later decision, not a prerequisite for improving this demo. No mainnet vault address or deposit button should be published while these gates remain open.

## Open decisions

Who is the merchant of record? Will the merchant accept USDC? Which party bears conversion and refund risk? What are the real gross margins and order volumes? Who supplies and owns a first-loss buffer? What valuation and redemption rights are legally and operationally supportable? What fee can buyers tolerate? Who can pause or upgrade the system? Is a pooled vault justified compared with a small operator-funded reserve?

Useful community contributions now are design review, wallet testing, a reserve simulator, merchant introductions with consent, and reviewable code. **This document asks for feedback, not funds.**
