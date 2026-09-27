import './case-study.css';

interface Scenario {
  impressions: number;
  clickRate: number;
  conversionRate: number;
  orderValue: number;
  profitMargin: number;
  communityShare: number;
}

const scenarios: Record<string, Scenario> = {
  measured: {
    impressions: 600_000,
    clickRate: 0.8,
    conversionRate: 2.2,
    orderValue: 38,
    profitMargin: 30,
    communityShare: 20,
  },
  campaign: {
    impressions: 1_200_000,
    clickRate: 1.4,
    conversionRate: 3.8,
    orderValue: 42,
    profitMargin: 37,
    communityShare: 30,
  },
  breakout: {
    impressions: 2_500_000,
    clickRate: 1.8,
    conversionRate: 4.6,
    orderValue: 46,
    profitMargin: 40,
    communityShare: 35,
  },
};

const root = document.querySelector<HTMLDivElement>('#case-study');
if (!root) throw new Error('Missing #case-study root.');

root.innerHTML = `
  <div class="study-notice" role="note">
    <strong>Hypothetical case study.</strong> Illustrative assumptions only—no actual campaign, partnerships, sales, token returns, or community vote are represented.
  </div>
  <header class="study-header">
    <a class="study-brand" href="./" aria-label="Return to DRU Supply Office">
      <span class="study-brand-mark" aria-hidden="true">DRU</span>
      <span>Community Commerce Lab</span>
    </a>
    <nav aria-label="Case study navigation">
      <a href="#model">Model</a>
      <a href="#playbook">Playbook</a>
      <a href="#guardrails">Guardrails</a>
      <a href="./roadmap.html">Roadmap</a>
      <a class="nav-cta" href="./">View storefront</a>
    </nav>
  </header>

  <main id="main">
    <section class="study-hero">
      <div class="study-hero-copy">
        <p class="study-kicker">A 30-day community commerce scenario</p>
        <h1>Turn a merch drop into a <em>community ritual.</em></h1>
        <p class="study-lede">What if every shirt, mug, and hat were purchased in the community token—and a disclosed share of real campaign profit went back to a vote?</p>
        <div class="study-actions">
          <a class="study-button study-button-gold" href="#model">Open the live model</a>
          <a class="study-button study-button-ghost" href="#playbook">See the campaign loop</a>
        </div>
      </div>
      <aside class="brief-card" aria-label="Modeled campaign brief">
        <div class="brief-topline"><span>Illustrative brief</span><span>30 days</span></div>
        <p class="brief-number">265K</p>
        <p class="brief-label">existing creator audience</p>
        <dl>
          <div><dt>Distribution</dt><dd>Creator + aligned crypto promoters</dd></div>
          <div><dt>Checkout</dt><dd>100% community token</dd></div>
          <div><dt>Merchandise</dt><dd>Eight-product capsule</dd></div>
          <div><dt>Community share</dt><dd>Published before launch</dd></div>
        </dl>
        <p class="brief-footnote">Audience count is public context. The campaign inputs below are adjustable assumptions, not reported results.</p>
      </aside>
    </section>

    <section class="thesis-section" aria-labelledby="thesis-title">
      <div class="section-intro">
        <p class="study-kicker">The thesis</p>
        <h2 id="thesis-title">Merch can give the token a job.</h2>
        <p>The product is not a promise that the token will appreciate. It is a simple reason to acquire and use it: buy something the community already understands.</p>
      </div>
      <div class="thesis-grid">
        <article><span>01</span><h3>Attention becomes action</h3><p>Aligned promoters send qualified buyers to one time-boxed drop instead of vague token awareness.</p></article>
        <article><span>02</span><h3>Action becomes proof</h3><p>Orders, fulfilled units, and token-denominated GMV are measurable signals of real utility.</p></article>
        <article><span>03</span><h3>Profit becomes participation</h3><p>A predeclared share of campaign profit funds a transparent menu of community choices.</p></article>
      </div>
    </section>

    <section class="model-section" id="model" aria-labelledby="model-title">
      <div class="model-heading">
        <div>
          <p class="study-kicker">Interactive campaign model</p>
          <h2 id="model-title">A well-marketed month.</h2>
        </div>
        <p>Start with the campaign case, then move any assumption. Revenue is shown in USD-equivalent value only to keep the model legible; checkout would collect the configured token amount.</p>
      </div>

      <div class="preset-row" aria-label="Scenario presets">
        <button type="button" data-scenario="measured">Measured</button>
        <button class="active" type="button" data-scenario="campaign">Campaign case</button>
        <button type="button" data-scenario="breakout">Breakout</button>
      </div>

      <div class="result-grid" aria-live="polite" aria-atomic="true">
        <article><p>Store visits</p><strong data-result="visits">16,800</strong><span>from tracked campaign links</span></article>
        <article><p>Orders</p><strong data-result="orders">638</strong><span>completed purchases</span></article>
        <article class="result-featured"><p>Merchandise revenue</p><strong data-result="revenue">$26,813</strong><span>before product cost, fees, and tax</span></article>
        <article><p>Community pool</p><strong data-result="community">$2,976</strong><span>from modeled campaign profit</span></article>
      </div>

      <div class="model-workbench">
        <form class="assumption-panel" aria-label="Campaign assumptions">
          <div class="assumption-heading"><h3>Change the assumptions</h3><button type="button" data-reset>Reset campaign case</button></div>
          <label>
            <span><b>Qualified impressions</b><output data-output="impressions">1.2M</output></span>
            <input data-input="impressions" type="range" min="100000" max="5000000" step="50000" value="1200000">
            <small>Aggregate views across the creator and promoter network—not unique people.</small>
          </label>
          <label>
            <span><b>Tracked-link click rate</b><output data-output="clickRate">1.4%</output></span>
            <input data-input="clickRate" type="range" min="0.2" max="3" step="0.1" value="1.4">
            <small>The share of impressions that become storefront visits.</small>
          </label>
          <label>
            <span><b>Store conversion</b><output data-output="conversionRate">3.8%</output></span>
            <input data-input="conversionRate" type="range" min="1" max="8" step="0.1" value="3.8">
            <small>Higher than a broad apparel baseline because this assumes qualified, campaign-native traffic.</small>
          </label>
          <label>
            <span><b>Average order value</b><output data-output="orderValue">$42</output></span>
            <input data-input="orderValue" type="range" min="20" max="100" step="1" value="42">
            <small>Token value at the quoted checkout rate; shipping excluded.</small>
          </label>
          <label>
            <span><b>Campaign profit margin</b><output data-output="profitMargin">37%</output></span>
            <input data-input="profitMargin" type="range" min="10" max="60" step="1" value="37">
            <small>After manufacturing, fulfillment, refunds, payment operations, and campaign costs; before tax.</small>
          </label>
          <label>
            <span><b>Community share of profit</b><output data-output="communityShare">30%</output></span>
            <input data-input="communityShare" type="range" min="0" max="60" step="1" value="30">
            <small>Published before launch and calculated only after the campaign books close.</small>
          </label>
        </form>

        <aside class="waterfall-panel" aria-labelledby="waterfall-title">
          <p class="study-kicker">Where the modeled revenue goes</p>
          <h3 id="waterfall-title">Campaign waterfall</h3>
          <div class="waterfall-total"><span>Merchandise revenue</span><strong data-result="waterfallRevenue">$26,813</strong></div>
          <div class="waterfall-track" aria-hidden="true">
            <i data-bar="costs"></i><i data-bar="retained"></i><i data-bar="community"></i>
          </div>
          <dl class="waterfall-list">
            <div><dt><i class="key key-costs"></i>Costs and operations</dt><dd data-result="costs">$16,892</dd></div>
            <div><dt><i class="key key-retained"></i>Creator-retained profit</dt><dd data-result="retained">$6,945</dd></div>
            <div><dt><i class="key key-community"></i>Community-directed pool</dt><dd data-result="communityDetail">$2,976</dd></div>
          </dl>
          <div class="model-callout">
            <strong data-result="summary">638 modeled customers create a $2,976 community decision.</strong>
            <p>No token-price outcome is assumed.</p>
          </div>
        </aside>
      </div>
    </section>

    <section class="allocation-section" aria-labelledby="allocation-title">
      <div class="allocation-copy">
        <p class="study-kicker">Example community ballot</p>
        <h2 id="allocation-title">Let buyers help choose what happens next.</h2>
        <p>The campaign closes, real costs are reconciled, and the promised community share is moved to a publicly labeled wallet. Token holders then choose among bounded options.</p>
        <div class="allocation-note"><strong>Illustrative split only.</strong> A real ballot could use ranked choice, quorum rules, a multisig, and an independent execution window.</div>
      </div>
      <div class="ballot-card">
        <div class="ballot-ring" aria-label="Example allocation: 50 percent buyback and burn, 30 percent next community drop, 20 percent history grant"><span>100%</span><small>published</small></div>
        <ol>
          <li><span class="ballot-swatch burn"></span><div><strong>50% · Buyback + burn</strong><p>Purchase tokens in the open market and send them to an unrecoverable address, with transaction receipts. This does not guarantee price appreciation.</p></div></li>
          <li><span class="ballot-swatch drop"></span><div><strong>30% · Fund the next drop</strong><p>Commission a community-selected design, prototype it, and publish its production budget.</p></div></li>
          <li><span class="ballot-swatch grant"></span><div><strong>20% · History grant</strong><p>Support a creator, archive, restoration effort, or educational project selected by the community.</p></div></li>
        </ol>
      </div>
    </section>

    <section class="playbook-section" id="playbook" aria-labelledby="playbook-title">
      <div class="section-intro inverse">
        <p class="study-kicker">Campaign playbook</p>
        <h2 id="playbook-title">Close the loop in public.</h2>
        <p>Promoters can create attention. Trust comes from publishing the rules before the first order and the receipts after the last.</p>
      </div>
      <ol class="timeline">
        <li><span>01</span><div><h3>Publish the covenant</h3><p>Products, token price policy, campaign dates, profit definition, community percentage, refund treatment, and vote rules.</p></div></li>
        <li><span>02</span><div><h3>Equip the promoter network</h3><p>Give aligned crypto promoters a media kit, unique tracked link, product samples, approved facts, and a ban on return promises.</p></div></li>
        <li><span>03</span><div><h3>Run a finite drop</h3><p>Use a 72-hour launch window inside a 30-day campaign. Quote exact token totals and disclose when rates can change.</p></div></li>
        <li><span>04</span><div><h3>Fulfill before celebrating</h3><p>Verify finalized payments, protect customer information, resolve exceptions, and ship the physical products.</p></div></li>
        <li><span>05</span><div><h3>Close the books</h3><p>Report orders, refunds, realized token value, costs, profit, and the precise amount entering the community pool.</p></div></li>
        <li><span>06</span><div><h3>Vote, execute, prove</h3><p>Run the declared ballot, execute from a labeled wallet or multisig, and publish transaction and grant receipts.</p></div></li>
      </ol>
    </section>

    <section class="scorecard-section" aria-labelledby="scorecard-title">
      <div class="section-intro">
        <p class="study-kicker">The honest scorecard</p>
        <h2 id="scorecard-title">Measure commerce—not candles.</h2>
        <p>The case is working when customers receive products and the community can audit what happened. Token price is not a campaign KPI.</p>
      </div>
      <div class="scorecard-grid">
        <article><strong>Orders</strong><p>Verified, non-refunded purchases</p></article>
        <article><strong>Fulfillment rate</strong><p>Orders shipped correctly and on time</p></article>
        <article><strong>Token GMV</strong><p>Actual token units collected and realized value</p></article>
        <article><strong>New buyers</strong><p>First-time merchandise customers and wallets</p></article>
        <article><strong>Repeat rate</strong><p>Customers who return for the next drop</p></article>
        <article><strong>Participation</strong><p>Eligible community members who vote</p></article>
      </div>
    </section>

    <section class="guardrail-section" id="guardrails" aria-labelledby="guardrail-title">
      <p class="study-kicker">Guardrails before mainnet</p>
      <h2 id="guardrail-title">This is a commercial experiment, not an investment product.</h2>
      <div class="guardrail-grid">
        <p><strong>No return language.</strong> Never suggest that buying merchandise, holding the token, or burning supply creates profit for a buyer.</p>
        <p><strong>No fake certainty.</strong> Disclose volatile pricing, campaign assumptions, operational costs, conflicts, promoter compensation, and vote limits.</p>
        <p><strong>No static fulfillment.</strong> A production launch needs verified settlement, replay protection, inventory, refunds, tax, shipping, support, and protected customer data.</p>
        <p><strong>Get local advice.</strong> Counsel should review token, promotion, consumer-protection, tax, sanctions, privacy, and sweepstakes implications before launch.</p>
      </div>
      <p class="legal-note">This page is an unofficial concept, not affiliated with or endorsed by Daily Roman Updates or WBS Apparel. Figures are illustrative, not forecasts or financial advice. “Buyback + burn” is shown only as one possible governance option and is not a recommendation or promise of market impact.</p>
    </section>
  </main>

  <footer class="study-footer">
    <div><span class="study-brand-mark" aria-hidden="true">DRU</span><p>Community Commerce Lab<br><small>Open-source scenario · September 2026</small></p></div>
    <nav aria-label="Footer navigation"><a href="./">Storefront</a><a href="./roadmap.html">Roadmap</a><a href="#model">Model</a><a href="#guardrails">Disclosures</a></nav>
  </footer>
`;

const numberFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

function compact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value % 1_000 === 0 ? 0 : 1)}K`;
  return numberFormatter.format(value);
}

function getInput(name: keyof Scenario): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>(`[data-input="${name}"]`);
  if (!input) throw new Error(`Missing ${name} input.`);
  return input;
}

function setText(selector: string, value: string): void {
  document.querySelectorAll<HTMLElement>(selector).forEach((element) => {
    element.textContent = value;
  });
}

function readScenario(): Scenario {
  return {
    impressions: Number(getInput('impressions').value),
    clickRate: Number(getInput('clickRate').value),
    conversionRate: Number(getInput('conversionRate').value),
    orderValue: Number(getInput('orderValue').value),
    profitMargin: Number(getInput('profitMargin').value),
    communityShare: Number(getInput('communityShare').value),
  };
}

function renderModel(): void {
  const scenario = readScenario();
  const visits = scenario.impressions * scenario.clickRate / 100;
  const orders = visits * scenario.conversionRate / 100;
  const revenue = orders * scenario.orderValue;
  const campaignProfit = revenue * scenario.profitMargin / 100;
  const community = campaignProfit * scenario.communityShare / 100;
  const retained = campaignProfit - community;
  const costs = revenue - campaignProfit;

  setText('[data-output="impressions"]', compact(scenario.impressions));
  setText('[data-output="clickRate"]', `${scenario.clickRate.toFixed(1)}%`);
  setText('[data-output="conversionRate"]', `${scenario.conversionRate.toFixed(1)}%`);
  setText('[data-output="orderValue"]', currencyFormatter.format(scenario.orderValue));
  setText('[data-output="profitMargin"]', `${scenario.profitMargin}%`);
  setText('[data-output="communityShare"]', `${scenario.communityShare}%`);
  setText('[data-result="visits"]', numberFormatter.format(visits));
  setText('[data-result="orders"]', numberFormatter.format(orders));
  setText('[data-result="revenue"], [data-result="waterfallRevenue"]', currencyFormatter.format(revenue));
  setText('[data-result="community"], [data-result="communityDetail"]', currencyFormatter.format(community));
  setText('[data-result="costs"]', currencyFormatter.format(costs));
  setText('[data-result="retained"]', currencyFormatter.format(retained));
  setText('[data-result="summary"]', `${numberFormatter.format(orders)} modeled customers create a ${currencyFormatter.format(community)} community decision.`);

  const costBar = document.querySelector<HTMLElement>('[data-bar="costs"]');
  const retainedBar = document.querySelector<HTMLElement>('[data-bar="retained"]');
  const communityBar = document.querySelector<HTMLElement>('[data-bar="community"]');
  if (costBar) costBar.style.width = `${100 - scenario.profitMargin}%`;
  if (retainedBar) retainedBar.style.width = `${scenario.profitMargin * (1 - scenario.communityShare / 100)}%`;
  if (communityBar) communityBar.style.width = `${scenario.profitMargin * scenario.communityShare / 100}%`;
}

function applyScenario(name: string): void {
  const scenario = scenarios[name];
  if (!scenario) return;
  (Object.keys(scenario) as Array<keyof Scenario>).forEach((key) => {
    getInput(key).value = String(scenario[key]);
  });
  document.querySelectorAll<HTMLButtonElement>('[data-scenario]').forEach((button) => {
    button.classList.toggle('active', button.dataset.scenario === name);
  });
  renderModel();
}

document.querySelectorAll<HTMLInputElement>('[data-input]').forEach((input) => {
  input.addEventListener('input', () => {
    document.querySelectorAll<HTMLButtonElement>('[data-scenario]').forEach((button) => button.classList.remove('active'));
    renderModel();
  });
});

document.querySelectorAll<HTMLButtonElement>('[data-scenario]').forEach((button) => {
  button.addEventListener('click', () => applyScenario(button.dataset.scenario ?? 'campaign'));
});

document.querySelector<HTMLButtonElement>('[data-reset]')?.addEventListener('click', () => applyScenario('campaign'));

renderModel();
