# Repository roadmap and Devgraph compatibility

The single authored source is [`public/roadmap/graph.json`](../public/roadmap/graph.json). The [released roadmap page](https://32112581321.github.io/solana-token-storefront/roadmap.html), browser validator, CLI, and tests all use that file and the same [`shared/roadmap.ts`](../shared/roadmap.ts) contract. There is no private Devgraph connection, wallet request, or backend requirement on the roadmap page.

## Contract and ownership

`solana-token-storefront.roadmap.v1` is an explicitly **repository-owned planning envelope**, not a native Devgraph export, ontology fork, signed operation, or claim that these records exist on a host. `authority: repository-planning` and `syncState: not-imported` make that boundary machine-readable. Only public project content is included. No signer, API secret, private host URL, customer data, or local machine paths belong here.

Canonical vocabulary is pinned to Devgraph ontology **0.6.0**, bundle digest `11d670a57b2052b4de00509559d081b524bf953c6da2544a25f33976857f8f4f`, [published bundle](https://zenith-research.ca/ontology/v0.6.0), and [upstream authority](https://github.com/ZenithResearch/devgraph). The validator rejects a changed pin rather than silently interpreting a different ontology. The constant records the inspected canonical release; validation compares that pin locally, not a network download or a cryptographic attestation of the whole upstream bundle.

| JSON field | Meaning |
| --- | --- |
| `schema`, `authority`, `syncState` | Versioned repo envelope and explicit non-imported state |
| `ontology` | Canonical version, digest, and base URL |
| `arena` | Proposed independent Arena definition; no fabricated runtime version or timestamps |
| `work[]` | Stable ID, one of the five Work kinds, title, description, `status: draft`, and separate `plan` annotations |
| `work[].plan` | Website stage, delivery annotation, acceptance checks, and safe repo-relative evidence paths |
| `stages[]` | Presentation grouping only; not a new ontology class or lifecycle |
| `edges[]` | Explicit source, relation, and target IDs |
| `updatedAt`, `title`, `disclaimer` | Public presentation metadata; date is not a live-sync heartbeat |

The five Work kinds are `Proposal`, `Initiative`, `Project`, `Issue`, and `Task`. The hierarchy uses stored `HAS_CHILD` edges for Initiative → Project → Issue → Task (the ontology's general containment vocabulary is `CONTAINS`). `DEPENDS_ON` means **source depends on target**. No Repository, Release, Phase, or WorkRequest runtime nodes are invented.

`Arena` is separate from Work. Its only direct edge here is `CONTAINS_WORK` to the parentless Initiative. Descendants inherit that Arena; do not duplicate direct memberships on Projects, Issues, or child Tasks. A Proposal is not an Arena member and requires Decision provenance for eventual acceptance. The planning Proposal remains unaccepted.

### Delivery is not acceptance

This profile deliberately supports only `status: draft` for the unsigned initial definitions. Canonical Devgraph lifecycle values are `draft`, `review`, `accepted`, and `archived`; this document does not redefine them. `implemented`, `next`, `planned`, and `gated` live only under `plan.delivery`. They are editorial delivery annotations, not Work API status values:

- **Implemented:** scoped code exists with repository evidence, not a security certification or a production launch.
- **Next:** a suggested next contribution, not an assignment or an in-progress claim.
- **Planned:** proposed work without a delivery promise.
- **Gated:** requires a stated approval, review, access, or other prerequisite; not a live Devgraph blocker record.

There are no deadline promises or percent-complete estimates. The page counts leaf Tasks only, never aggregates plus their children. Actual extension approvals remain distinct from mocked integration tests. Implemented items cannot depend on unimplemented items. Optional cross-chain work is not a prerequisite for a same-chain pilot.

## Maintain the roadmap

1. Edit the graph JSON: keep IDs stable, update descriptions/checks, add or change dependencies, and set `updatedAt` when content changes. A fork may rename the Arena and prefix all IDs consistently to avoid collisions in a shared host. Do not rename existing imported IDs casually.
2. Update evidence paths and the narrative proposal when scope changes. Mark work implemented only with honest scoped evidence. Never infer creator approval from a code merge.
3. Run `npm run roadmap:export` to regenerate [`public/roadmap/create-requests.json`](../public/roadmap/create-requests.json). This is a deterministic **array of individual unsigned request envelopes**, not a bulk-import endpoint.
4. Run `npm run validate-roadmap`, `npm test`, `npm run build`, and `npm run test:e2e`. Review the page at `/roadmap.html` via `npm run dev`.
5. Commit authored and generated JSON together with the docs/tests. Main-branch Pages builds include them at relative paths, including repository-subpath hosting. Forks must configure their own host as described in the manual.

`validate-roadmap` checks closed fields, pin/schema versions, IDs, hierarchy, direct Arena rules, duplicate/dangling edges, dependency cycles, implemented evidence, evidence file existence, and deterministic request freshness. It is not a test that a host contains those nodes. Unknown schemas/fields fail closed; changing this contract requires updating the producer, shared validator, browser, fixtures, export, and documentation in one change. Existing storefront and inventory JSON contracts are unchanged.

## Optional, authorized Devgraph import

No import or live Work mutation is performed by `roadmap:export`, CI, or the website. You do not need Devgraph installed to fork, edit, test, build, or host this project. Native request conformance can additionally be checked against a locally installed matching Devgraph runtime before importing; portable CI checks our deterministic mapping and invariants.

During v1.0.0-devnet.3 preparation, all 32 generated create envelopes were additionally accepted by the installed Devgraph `WorkRequest.from_json` / `ArenaRequest.from_json` parsers against the inspected 0.6.0 contract. This was an offline parse check, not a signed write, import, or authority check. Graph relationships remain proposed edges that require fresh runtime versions to apply.

The generated array has one exact `devgraph.arena-request.v1` create envelope and one exact `devgraph.work-request.v1` create envelope per Work definition. Each contains only `schema`, `operation`, `kind`, `id`, `expected_version: null`, and `payload`. Public notes and checks are mapped to the description; website annotations are not passed as unknown API fields. Creation materializes draft status. The pack does not accept proposals, create relationships, or guess positive versions.

An operator who explicitly chooses to import must:

1. Verify the local host is healthy and uses a compatible pinned ontology. Inspect existing IDs with supported read commands; do not blindly overwrite a collision. Use the private CLI's saved signer/receiver policy with the necessary Work/Arena permissions. Do not commit credentials or change grants merely to make an import run.
2. Copy **one request object at a time** into a private, absolute-path JSON file (mode `0600`), with its own private idempotency-key file. Review the exact target, content, and authority before signing. The whole array is not accepted by a native route.
3. For the Arena object, use `devgraph arena create --request-file /absolute/private/request.json --idempotency-key-file /absolute/private/key`. For Work objects, use `devgraph work create` with the same file flags. Confirm returned IDs/versions/receipts. A pending event receipt is not evidence that the underlying graph mutation failed; reconcile before retrying. Retrying uncertain identical writes must reuse the identical payload and idempotency key.
4. Apply the authored edges separately using fresh read state: `HAS_CHILD` maps to Work `parent.set` on the **child**; `DEPENDS_ON` maps to Work `dependency.add` on its **source**; `CONTAINS_WORK` maps to Arena `member.set` on the **Work root**. Read actual current versions for every touched endpoint and existing parent/Arena. Non-create operations require those versions, previous-parent or previous-Arena references where applicable, and correct authority. Relationships increment endpoint versions, including relationship no-ops; never hardcode version 1 for a sequence.
5. Confirm parentage, dependencies, and effective Arena through supported query routes. Proposal acceptance, status changes, Decisions, and later content sync are separate reviewed operations. Archive by default instead of deleting work. Never access Neo4j directly.

The public graph remains a repo planning view after a private import; it must not be relabeled as a live export without a new reviewed sync contract. Record private host receipts and mappings outside this public repo. Future synchronization must reconcile conflicts, IDs, versions, and non-destructive archival explicitly, not silently let Git overwrite live work.

This is Work/Arena compatibility, not a claim of full `ZenithRepository` filesystem conformance, network admission, ownership, authorization, or ontology endorsement. A repository can be referenced by ExternalLink/Artifact evidence in a future authorized integration without creating a forbidden Repository runtime node.
