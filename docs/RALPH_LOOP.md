# RALPH Loop

RALPH is the atomic execution loop for Cadet work. It is intentionally small, repeatable, and verification-heavy.

## Meaning

- **R**oute the next valuable slice
- **A**tomize it into the smallest shippable work packet
- **L**and the code and schema changes
- **P**rove it with deterministic checks
- **H**andoff the result and queue the next slice

## Why this loop exists

Cadet is crossing multiple layers at once:

- Rust runtime
- SpacetimeDB schema
- TypeScript SDK and control planes
- web product UI
- deployment adapters

Without a strict loop, work sprawls across too many boundaries. RALPH keeps each increment reviewable and recoverable.

## Rules

### Route

Pick the next slice by impact, not by novelty.

Good R slices:

- add one reducer + one client call
- add one worker behavior + one verification path
- add one ingress adapter + one normalized event flow
- add one UI surface backed by existing state

Bad R slices:

- “build Cloudflare support”
- “finish the whole agent UI”
- “rewrite the runtime”

### Atomize

A loop should usually touch:

- one behavior
- one validation surface
- one short doc update

Target size:

- 2 to 6 files for normal loops
- 6 to 10 files only when a schema or shared contract changes

### Land

Every loop lands with:

- code
- tests or deterministic validation
- docs if the public shape changed

No loop should end with “the rest will be wired later” unless the partial state is still correct and safe.

### Prove

Every loop needs a copy-paste validation chain.

For Cadet, prefer:

- targeted Vitest first
- targeted Rust crate test/build second
- full workspace gates after integration points move
- SpacetimeDB build whenever schema changes

### Handoff

Close the loop by recording:

- what changed
- what is verified
- what the next smallest slice is

That handoff lives in `SESSION.md` and, when needed, in the phase plan.

## Loop template

```markdown
## Loop X.Y: [Name]

**Route**
- Why this slice matters now

**Atomize**
- Files/modules touched
- Public contracts affected

**Land**
- Concrete implementation outcome

**Prove**
- Exact commands

**Handoff**
- Next loop
- Risks or blockers
```

## Cadet-specific heuristics

- Prefer durable workflow state over temporary route logic.
- Prefer typed manifest policy over prompt-only behavior.
- Prefer vendor-agnostic adapters at the product edge.
- Prefer one canonical event path into SpacetimeDB.
- Prefer browser tasks as durable work items, not inline best-effort side effects.
