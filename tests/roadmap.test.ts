import { access, readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import authored from '../public/roadmap/graph.json';
import { createRequests, isEvidencePath, validateRoadmap } from '../shared/roadmap';

const clone = () => structuredClone(authored);

describe('repository roadmap contract', () => {
  it('validates the single authored graph and all local evidence', async () => {
    const graph = validateRoadmap(authored);
    expect(graph.work.filter(work => work.kind === 'Task')).toHaveLength(19);
    expect(graph.work.filter(work => work.plan.delivery === 'implemented')).toHaveLength(3);
    for (const work of graph.work) for (const path of work.plan.evidence) {
      await expect(access(new URL(`../${path}`, import.meta.url))).resolves.toBeUndefined();
    }
  });

  it('rejects changed schema, ontology pin, runtime authority, fields and Work status', () => {
    for (const mutate of [
      (g: ReturnType<typeof clone>) => { g.schema = 'v2'; },
      (g: ReturnType<typeof clone>) => { g.ontology.bundleDigest = '0'.repeat(64); },
      (g: ReturnType<typeof clone>) => { g.syncState = 'synced'; },
      (g: ReturnType<typeof clone>) => { Object.assign(g, { signer: 'not-allowed' }); },
      (g: ReturnType<typeof clone>) => { g.work[0]!.status = 'accepted'; },
      (g: ReturnType<typeof clone>) => { g.work[0]!.kind = 'Repository'; },
      (g: ReturnType<typeof clone>) => { g.updatedAt = '2026-02-30'; },
    ]) { const graph = clone(); mutate(graph); expect(() => validateRoadmap(graph)).toThrow(); }
  });

  it('rejects duplicate IDs, unknown references, wrong hierarchy and multiple parents', () => {
    let graph = clone(); graph.work.push(graph.work[0]!);
    expect(() => validateRoadmap(graph)).toThrow(/duplicate node/);
    graph = clone(); graph.edges.push({ from: 'sts-storefront', relation: 'DEPENDS_ON', to: 'missing' });
    expect(() => validateRoadmap(graph)).toThrow(/dangling/);
    graph = clone(); graph.edges.push({ from: 'sts-commerce-initiative', relation: 'HAS_CHILD', to: 'sts-storefront' });
    expect(() => validateRoadmap(graph)).toThrow(/parents/);
    graph = clone(); graph.edges.push({ from: 'sts-reserve-issue', relation: 'HAS_CHILD', to: 'sts-storefront' });
    expect(() => validateRoadmap(graph)).toThrow(/parents/);
  });

  it('enforces separate Arena direct membership and disallows inherited membership edges', () => {
    for (const to of ['sts-settlement-proposal', 'sts-foundation-project', 'sts-storefront']) {
      const graph = clone(); graph.edges.push({ from: graph.arena.id, relation: 'CONTAINS_WORK', to });
      expect(() => validateRoadmap(graph)).toThrow(/Arena/);
    }
  });

  it('rejects duplicate edges, cycles and self-dependencies', () => {
    let graph = clone(); graph.edges.push(graph.edges[0]!);
    expect(() => validateRoadmap(graph)).toThrow(/duplicate/);
    graph = clone(); graph.edges.push({ from: 'sts-reserve-simulator', relation: 'DEPENDS_ON', to: 'sts-reserve-controller' });
    expect(() => validateRoadmap(graph)).toThrow(/cycle/);
    graph = clone(); graph.edges.push({ from: 'sts-reserve-simulator', relation: 'DEPENDS_ON', to: 'sts-reserve-simulator' });
    expect(() => validateRoadmap(graph)).toThrow(/self/);
  });

  it('requires evidence and completed dependencies for implemented work', () => {
    let graph = clone(); graph.work.find(work => work.id === 'sts-storefront')!.plan.evidence = [];
    expect(() => validateRoadmap(graph)).toThrow(/evidence/);
    graph = clone(); graph.edges.push({ from: 'sts-storefront', relation: 'DEPENDS_ON', to: 'sts-wallet-rehearsal' });
    expect(() => validateRoadmap(graph)).toThrow(/unmet dependency/);
  });

  it('rejects URL, traversal, hidden and unsafe evidence paths', () => {
    for (const path of ['https://evil.test/file', '../secrets', '.devnet/payer.json', '/etc/passwd', 'docs//file', 'docs/a?x=y', 'docs/%2e%2e/file']) expect(isEvidencePath(path)).toBe(false);
    const graph = clone(); graph.work[0]!.plan.evidence = ['https://evil.test/file'];
    expect(() => validateRoadmap(graph)).toThrow(/evidence/);
  });

  it('exports only exact closed, unsigned native create envelopes and matches the committed pack', async () => {
    const requests = createRequests(validateRoadmap(authored));
    expect(requests).toHaveLength(32);
    expect(requests[0]!.schema).toBe('devgraph.arena-request.v1');
    for (const request of requests) {
      expect(Object.keys(request).sort()).toEqual(['expected_version', 'id', 'kind', 'operation', 'payload', 'schema']);
      expect(Object.keys(request.payload).sort()).toEqual(['description', 'id', 'title']);
      expect(request.expected_version).toBeNull();
      expect(request.operation).toBe('create');
      expect(request.payload.id).toBe(request.id);
      expect(Buffer.byteLength(JSON.stringify(request))).toBeLessThanOrEqual(65536);
    }
    const checkedIn = await readFile(new URL('../public/roadmap/create-requests.json', import.meta.url), 'utf8');
    expect(checkedIn).toBe(`${JSON.stringify(requests, null, 2)}\n`);
  });

  it('keeps risky future functionality gated and optional bridge work off the critical path', () => {
    const graph = validateRoadmap(authored);
    for (const id of ['sts-merchant-consent', 'sts-contributor-terms', 'sts-security-review', 'sts-live-launch-decision']) {
      expect(graph.work.find(work => work.id === id)!.plan.delivery).toBe('gated');
    }
    expect(graph.work.find(work => work.id === 'sts-wallet-rehearsal')!.plan.delivery).toBe('next');
    expect(graph.edges.filter(edge => edge.relation === 'DEPENDS_ON' && edge.to === 'sts-cross-chain')).toEqual([]);
    expect(JSON.stringify(graph)).not.toMatch(/wbsapparel\.shop|\/Users\/|127\.0\.0\.1|PRIVATE KEY/);
  });
});
