/** Repo planning envelope, not a Devgraph runtime export or signed request. */
export const ONTOLOGY = {
  version: '0.6.0',
  bundleDigest: '11d670a57b2052b4de00509559d081b524bf953c6da2544a25f33976857f8f4f',
  canonicalBaseUrl: 'https://zenith-research.ca/ontology/v0.6.0',
} as const;

export const deliveries = ['implemented', 'next', 'planned', 'gated'] as const;
export type Delivery = typeof deliveries[number];
export type WorkKind = 'Proposal' | 'Initiative' | 'Project' | 'Issue' | 'Task';
export interface RoadmapWork {
  id: string; kind: WorkKind; title: string; description: string;
  // Draft definitions only: delivery evidence is NOT lifecycle acceptance.
  status: 'draft';
  plan: { stage: string; delivery: Delivery; acceptance: string[]; evidence: string[] };
}
export interface Roadmap {
  schema: 'solana-token-storefront.roadmap.v1';
  authority: 'repository-planning'; syncState: 'not-imported';
  updatedAt: string; title: string; disclaimer: string;
  ontology: typeof ONTOLOGY;
  arena: { kind: 'Arena'; id: string; title: string; description: string };
  stages: { id: string; title: string; summary: string }[];
  work: RoadmapWork[];
  edges: { from: string; relation: 'HAS_CHILD' | 'DEPENDS_ON' | 'CONTAINS_WORK'; to: string }[];
}

const identifier = /^[a-z0-9](?:[a-z0-9-]{0,254}[a-z0-9])?$/;
const kinds: WorkKind[] = ['Proposal', 'Initiative', 'Project', 'Issue', 'Task'];
const parentKinds: Partial<Record<WorkKind, WorkKind>> = { Project: 'Initiative', Issue: 'Project', Task: 'Issue' };
function fail(message: string): never { throw new Error(`Roadmap: ${message}`); }
function object(value: unknown, fields: string[], context: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${context} must be an object`);
  const record = value as Record<string, unknown>;
  if (Object.keys(record).sort().join('|') !== [...fields].sort().join('|')) fail(`${context} has missing/unknown fields`);
  return record;
}
function text(value: unknown, context: string, max = 4096): asserts value is string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) fail(`invalid ${context}`);
}
function id(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !identifier.test(value)) fail('invalid identifier');
}
function list(value: unknown, context: string): asserts value is unknown[] {
  if (!Array.isArray(value) || value.length > 500) fail(`invalid ${context}`);
}
function strings(value: unknown, context: string): asserts value is string[] {
  list(value, context);
  value.forEach(item => text(item, context));
  if (new Set(value).size !== value.length) fail(`duplicate ${context}`);
}
export function isEvidencePath(value: string): boolean {
  return /^[a-zA-Z0-9_.\/-]+$/.test(value) && !value.startsWith('/') &&
    !value.split('/').some(part => part === '..' || part === '.' || part === '' || part.startsWith('.'));
}

/** Same closed validation is used by the browser, CLI, and CI. Unknown schema fails closed. */
export function validateRoadmap(input: unknown): Roadmap {
  const data = object(input, ['schema', 'authority', 'syncState', 'updatedAt', 'title', 'disclaimer', 'ontology', 'arena', 'stages', 'work', 'edges'], 'root');
  if (data.schema !== 'solana-token-storefront.roadmap.v1' || data.authority !== 'repository-planning' || data.syncState !== 'not-imported') fail('unsupported envelope or authority');
  text(data.title, 'title'); text(data.disclaimer, 'disclaimer');
  if (typeof data.updatedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data.updatedAt) || new Date(data.updatedAt).toISOString().slice(0, 10) !== data.updatedAt) fail('invalid updatedAt');
  const ontology = object(data.ontology, Object.keys(ONTOLOGY), 'ontology');
  for (const key of Object.keys(ONTOLOGY) as (keyof typeof ONTOLOGY)[]) {
    if (ontology[key] !== ONTOLOGY[key]) fail('ontology pin mismatch');
  }
  const arena = object(data.arena, ['id', 'kind', 'title', 'description'], 'arena');
  id(arena.id); text(arena.title, 'arena title'); text(arena.description, 'arena description', 32768);
  if (arena.kind !== 'Arena') fail('invalid arena kind');
  list(data.stages, 'stages'); list(data.work, 'work'); list(data.edges, 'edges');
  if (!data.stages.length || !data.work.length) fail('empty roadmap');
  const stageIds = new Set<string>();
  for (const value of data.stages) {
    const stage = object(value, ['id', 'title', 'summary'], 'stage');
    id(stage.id); text(stage.title, 'stage title'); text(stage.summary, 'stage summary');
    if (stageIds.has(stage.id)) fail('duplicate stage');
    stageIds.add(stage.id);
  }
  const nodes = new Map<string, RoadmapWork>();
  for (const value of data.work) {
    const node = object(value, ['id', 'kind', 'title', 'description', 'status', 'plan'], 'work');
    id(node.id); text(node.title, 'work title'); text(node.description, 'work description', 32768);
    if (!kinds.includes(node.kind as WorkKind) || node.status !== 'draft') fail('invalid Work kind/status; this profile contains unaccepted draft definitions');
    if (nodes.has(node.id) || node.id === arena.id) fail('duplicate node id');
    const plan = object(node.plan, ['stage', 'delivery', 'acceptance', 'evidence'], 'plan');
    if (!stageIds.has(plan.stage as string) || !deliveries.includes(plan.delivery as Delivery)) fail('invalid stage/delivery');
    strings(plan.acceptance, 'acceptance'); strings(plan.evidence, 'evidence');
    if (!plan.acceptance.length) fail('missing acceptance criteria');
    if (plan.evidence.some(path => !isEvidencePath(path))) fail('evidence must be safe repo-relative paths');
    if (plan.delivery === 'implemented' && !plan.evidence.length) fail('implemented work needs evidence');
    nodes.set(node.id, node as unknown as RoadmapWork);
  }
  const seen = new Set<string>();
  const parents = new Map<string, string>();
  const members = new Set<string>();
  const dependencies = new Map<string, string[]>();
  for (const value of data.edges) {
    const edge = object(value, ['from', 'relation', 'to'], 'edge');
    id(edge.from); id(edge.to);
    const key = `${edge.from}|${edge.relation}|${edge.to}`;
    if (edge.from === edge.to || seen.has(key)) fail('self/duplicate edge');
    seen.add(key);
    const target = nodes.get(edge.to);
    if (!target) fail('dangling target');
    if (edge.relation === 'CONTAINS_WORK') {
      if (edge.from !== arena.id || !['Initiative', 'Task'].includes(target.kind) || members.has(edge.to)) fail('invalid direct Arena membership');
      members.add(edge.to);
      continue;
    }
    const source = nodes.get(edge.from);
    if (!source) fail('dangling source');
    if (edge.relation === 'HAS_CHILD') {
      if (parentKinds[target.kind] !== source.kind || parents.has(edge.to)) fail('invalid or multiple Work parents');
      parents.set(edge.to, edge.from);
    } else if (edge.relation === 'DEPENDS_ON') {
      dependencies.set(edge.from, [...(dependencies.get(edge.from) ?? []), edge.to]);
      if (source.plan.delivery === 'implemented' && target.plan.delivery !== 'implemented') fail('implemented work has unmet dependency');
    } else fail('unknown relation');
  }
  for (const member of members) if (parents.has(member)) fail('Arena member has a Work parent');
  for (const node of nodes.values()) {
    if (['Project', 'Issue', 'Task'].includes(node.kind) && !parents.has(node.id) && !members.has(node.id)) fail('orphan work');
  }
  const visited = new Set<string>();
  const active = new Set<string>();
  function visit(node: string) {
    if (active.has(node)) fail('dependency cycle');
    if (visited.has(node)) return;
    active.add(node);
    for (const target of dependencies.get(node) ?? []) visit(target);
    active.delete(node); visited.add(node);
  }
  for (const node of nodes.keys()) visit(node);
  return input as Roadmap;
}

/** Exact closed create envelopes. No guessed versions, lifecycle acceptance, or authority. */
export function createRequests(graph: Roadmap) {
  return [
    { schema: 'devgraph.arena-request.v1', operation: 'create', kind: 'Arena', id: graph.arena.id, expected_version: null,
      payload: { id: graph.arena.id, title: graph.arena.title, description: graph.arena.description } },
    ...graph.work.map(work => ({
      schema: 'devgraph.work-request.v1', operation: 'create', kind: work.kind, id: work.id, expected_version: null,
      payload: { id: work.id, title: work.title, description: `${work.description}\n\nAcceptance criteria:\n${work.plan.acceptance.map(item => `- ${item}`).join('\n')}\n\nRepository evidence: ${work.plan.evidence.join(', ') || 'None yet'}.\nDelivery annotation: ${work.plan.delivery} (not a Devgraph status or approval).` },
    })),
  ];
}
