import { readFile, writeFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createRequests, validateRoadmap } from '../shared/roadmap.ts';

const root = new URL('../', import.meta.url);
const graph = validateRoadmap(JSON.parse(await readFile(new URL('public/roadmap/graph.json', root), 'utf8')));
for (const work of graph.work) {
  for (const path of work.plan.evidence) await access(new URL(path, root));
}
const requests = createRequests(graph);
for (const request of requests) {
  if (Buffer.byteLength(JSON.stringify(request)) > 65536) throw new Error(`Request too large: ${request.id}`);
}
const output = `${JSON.stringify(requests, null, 2)}\n`;
const destination = new URL('public/roadmap/create-requests.json', root);
const args = process.argv.slice(2);
if (args.length > 1 || (args.length === 1 && args[0] !== '--write')) throw new Error('Usage: npm run roadmap:export | npm run validate-roadmap');
if (args[0] === '--write') {
  await writeFile(destination, output);
  console.log(`Generated ${requests.length} unsigned create requests: ${fileURLToPath(destination)}`);
} else if (await readFile(destination, 'utf8') !== output) {
  throw new Error('Stale create requests. Run npm run roadmap:export and commit both JSON files.');
}
console.log(`Validated ${graph.work.length} Work definitions, one Arena, ${graph.edges.length} edges and repository evidence. No Devgraph mutations performed.`);
