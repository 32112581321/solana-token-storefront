import './roadmap.css';
import { deliveries, validateRoadmap } from '../shared/roadmap';
import type { Delivery, Roadmap, RoadmapWork } from '../shared/roadmap';

const repo = 'https://github.com/32112581321/solana-token-storefront';
const labels: Record<Delivery, string> = { implemented: 'Implemented', next: 'Next contributions', planned: 'Planned', gated: 'Gated' };
const escape = (text: string) => text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
const root = document.querySelector<HTMLDivElement>('#roadmap')!;

function render(graph: Roadmap) {
  const tasks = graph.work.filter(work => work.kind === 'Task');
  const nodes = new Map(graph.work.map(work => [work.id, work]));
  const proposal = graph.work.find(work => work.kind === 'Proposal');
  root.innerHTML = `
    <div class="roadmap-notice" role="note"><strong>PROPOSAL, NOT A FUNDRAISE.</strong> No vault deposits accepted. No guaranteed returns. No real merchandise orders.</div>
    <header class="roadmap-header"><a class="roadmap-brand" href="./"><span aria-hidden="true">DRU</span>Community Commerce Lab</a>
      <nav aria-label="Roadmap navigation"><a href="./">Storefront</a><a href="./case-study.html">Case study</a><a href="${repo}">Repository ↗</a></nav>
    </header>
    <main id="main">
      <section class="roadmap-hero"><div><p class="roadmap-kicker">Public build ledger · Updated ${escape(graph.updatedAt)}</p>
        <h1>A roadmap.<br><em>Not a promise.</em></h1><p class="roadmap-lede">${escape(graph.title)}. See what exists, what comes next, and what needs approval before anyone puts capital at risk.</p>
        <div class="roadmap-actions"><a class="roadmap-button" href="#work">Explore the work ↓</a><a class="roadmap-button secondary" href="${repo}/blob/main/docs/SETTLEMENT_VAULT_PROPOSAL.md">Read the full proposal ↗</a></div></div>
        <aside class="boundary-card"><p class="roadmap-kicker">The boundary today</p><h2>Test tokens.<br>Real questions.</h2><p>Devnet checkout and local inventory exist. Merchant integration, a settlement vault, contributor rewards, and treasury automation do not.</p><p>Ordinary commerce does not need a token. The experiment is to give this community another way to use one—not to promise its price will rise.</p></aside>
      </section>
      <section class="roadmap-overview" aria-label="Task delivery counts">${deliveries.map(delivery => `<div><strong>${tasks.filter(work => work.plan.delivery === delivery).length}</strong><span>${labels[delivery]}</span></div>`).join('')}</section>
      <div class="roadmap-count-note">Counts refer to scoped tasks, not a percentage complete. “Implemented” is not mainnet readiness. “Next” is a suggested contribution, not a promised date.</div>
      <section class="reserve-brief" aria-labelledby="reserve-title"><div><p class="roadmap-kicker">The proposed settlement model</p><h2 id="reserve-title">Working capital.<br>Not magic yield.</h2><p>A USDC reserve could pay an authorized merchant while DRU receipts are converted under explicit limits. A controller decides when to replenish; an exchange route executes swaps.</p><p>Batching can delay selling, not eliminate it. Smaller reserves and fewer conversions are competing objectives.</p></div>
        <ol><li><strong>Protect obligations first</strong><p>Reserve for merchant payouts, refunds, fees and replenishment delays. Pause new obligations if liquidity is unavailable.</p></li><li><strong>Reward from earned fees</strong><p>Proposed contributor rewards come only from realized net fees or an agreed margin. Principal can lose value; exits may need a queue. No fees means no rewards.</p></li><li><strong>Keep the community budget separate</strong><p>A creator-approved share of positive profit could fund a vote. Customer obligations and contributor capital must never fund discretionary buybacks or burns.</p></li></ol>
      </section>
      <section class="work-section" id="work" aria-labelledby="work-title"><p class="roadmap-kicker">The repository is the source</p><h2 id="work-title">Small steps. Explicit gates.</h2>
        <p>Open a task for acceptance checks and evidence. Stages describe a possible sequence, not an approved schedule. Optional cross-chain work is not required for same-chain settlement.</p>
        <form class="roadmap-filters" role="search"><label>Delivery<select id="delivery"><option value="all">All delivery states</option>${deliveries.map(delivery => `<option value="${delivery}">${labels[delivery]}</option>`).join('')}</select></label><label>Find work<input id="query" type="search" placeholder="Try refunds, wallet, reserve…"></label><button type="reset">Reset filters</button></form>
        <p class="filter-count" role="status" aria-live="polite"></p><div id="task-stages"></div>
      </section>
      <section class="graph-section" aria-labelledby="graph-title"><p class="roadmap-kicker">Portable by design</p><h2 id="graph-title">Fork the code. Keep the plan.</h2><p>${escape(graph.disclaimer)}</p>
        <div class="graph-grid"><div><h3>One graph, two views</h3><p>This page reads the same JSON you can edit in a fork. It contains ${graph.work.length} draft Work definitions, ${graph.edges.length} relationships, and one proposed Arena. No private tracker account is needed.</p><p><strong>Arena:</strong> ${escape(graph.arena.title)}<br><strong>Hierarchy:</strong> Initiative → Project → Issue → Task<br><strong>Proposal:</strong> ${escape(proposal?.title ?? 'Not specified')}</p></div><div><h3>Compatible, not secretly synced</h3><p>Pinned to Devgraph ontology ${escape(graph.ontology.version)}. Work lifecycle status remains <code>draft</code>; delivery labels are separate annotations. These records have not been imported into a Devgraph host. Import requires an authorized operator.</p><p>Nothing on this page connects a wallet, moves funds, accepts the proposal, or changes private work records.</p></div></div>
        <div class="roadmap-actions"><a class="roadmap-button" href="./roadmap/graph.json" download>Download graph JSON</a><a class="roadmap-button secondary" href="./roadmap/create-requests.json" download>Download create requests</a><a href="${repo}/blob/main/docs/ROADMAP.md">Maintainer & import guide ↗</a></div>
      </section>
    </main><footer class="roadmap-footer"><p>Independent community contribution. Feedback and code welcome; funds are not requested.</p><nav aria-label="Footer navigation"><a href="${repo}/issues">Discuss or volunteer ↗</a><a href="./">Back to storefront</a><a href="${repo}/blob/main/NOTICE.md">Rights & attribution</a></nav></footer>`;

  const delivery = root.querySelector<HTMLSelectElement>('#delivery')!;
  const query = root.querySelector<HTMLInputElement>('#query')!;
  const stages = root.querySelector<HTMLDivElement>('#task-stages')!;

  function taskCard(work: RoadmapWork): string {
    const dependencies = graph.edges.filter(edge => edge.relation === 'DEPENDS_ON' && edge.from === work.id).map(edge => nodes.get(edge.to)!);
    return `<article class="task-card" id="${work.id}" tabindex="-1" data-delivery="${work.plan.delivery}"><div class="task-top"><span class="delivery-badge ${work.plan.delivery}">${labels[work.plan.delivery]}</span><code>${work.id}</code></div><h4>${escape(work.title)}</h4><p>${escape(work.description)}</p>
      ${dependencies.length ? `<p class="dependencies"><strong>Depends on:</strong> ${dependencies.map(dependency => `<a href="#${dependency.id}" data-dependency="${dependency.id}">${escape(dependency.title)}</a>`).join(' · ')}</p>` : '<p class="dependencies">No task dependency recorded; acceptance checks still apply.</p>'}
      <details><summary>Acceptance checks & evidence</summary><ul>${work.plan.acceptance.map(check => `<li>${escape(check)}</li>`).join('')}</ul>${work.plan.evidence.length ? `<p class="evidence-label">Repository evidence (not an approval)</p><ul class="evidence">${work.plan.evidence.map(path => `<li><a href="${repo}/blob/main/${escape(path)}">${escape(path)}</a></li>`).join('')}</ul>` : '<p>No completion evidence yet.</p>'}</details></article>`;
  }
  function filter() {
    const term = query.value.trim().toLowerCase();
    const visible = tasks.filter(work => (delivery.value === 'all' || work.plan.delivery === delivery.value) &&
      [work.id, work.title, work.description, ...work.plan.acceptance].join(' ').toLowerCase().includes(term));
    root.querySelector('.filter-count')!.textContent = `${visible.length} of ${tasks.length} tasks shown`;
    stages.innerHTML = visible.length ? graph.stages.map(stage => {
      const stageTasks = visible.filter(work => work.plan.stage === stage.id);
      return stageTasks.length ? `<section class="stage" aria-labelledby="stage-${stage.id}"><div class="stage-intro"><h3 id="stage-${stage.id}">${escape(stage.title)}</h3><p>${escape(stage.summary)}</p></div><div class="task-grid">${stageTasks.map(taskCard).join('')}</div></section>` : '';
    }).join('') : '<p class="empty-roadmap">No matching work. Change your search or reset the filters.</p>';
  }
  delivery.addEventListener('change', filter); query.addEventListener('input', filter);
  root.querySelector('form')!.addEventListener('submit', event => event.preventDefault());
  root.querySelector('form')!.addEventListener('reset', event => { event.preventDefault(); delivery.value = 'all'; query.value = ''; filter(); });
  function focusTask(id: string) {
    if (!tasks.some(work => work.id === id)) return;
    delivery.value = 'all'; query.value = ''; filter();
    const target = document.getElementById(id)!;
    target.querySelector('details')!.open = true;
    target.focus({ preventScroll: true }); target.scrollIntoView({ block: 'start' });
  }
  stages.addEventListener('click', event => {
    const link = (event.target as Element).closest<HTMLAnchorElement>('[data-dependency]');
    if (link) { event.preventDefault(); history.replaceState(null, '', link.hash); focusTask(link.dataset.dependency!); }
  });
  filter();
  window.addEventListener('hashchange', () => focusTask(location.hash.slice(1)));
  if (location.hash) focusTask(location.hash.slice(1));
}

try {
  const response = await fetch('./roadmap/graph.json');
  if (!response.ok) throw new Error('Roadmap unavailable');
  render(validateRoadmap(await response.json()));
} catch {
  root.innerHTML = '<main id="main" class="roadmap-error"><h1>Roadmap unavailable</h1><p role="alert">The roadmap could not be loaded or did not pass validation. No progress claims are shown.</p><p><a href="./">Return to storefront</a> · <a href="https://github.com/32112581321/solana-token-storefront/blob/main/docs/ROADMAP.md">Read the repository guide</a></p></main>';
}
