# Release Checklist

## Project Intelligence
- [ ] Run `npm test -- --run project-intelligence` to ensure blueprint/session tests pass.
- [ ] Render/update ER diagram: `docs/diagrams/project-intelligence-erd.mmd` → export to image if needed.
- [ ] Verify feature toggle behavior:
  - `IN_MEMORIA_DISABLE_PROJECT_INTEL=true npx in-memoria blueprint` should emit disabled warning.
  - Default configuration should generate blueprints successfully.
- [ ] Confirm README/AGENTS references are up to date.

## PHP Sustainment (Core)
- [ ] Run `cargo test --features all-languages` (extractor, parser, and pattern gating).
- [ ] Optionally run a manual smoke test against `sandbox-php-sample/` (learn + basic queries) to confirm the extractor still functions.

## MCP Tool Surface
- [ ] Review dashboard snapshots or local analytics notes for tool usage shifts (telemetry scripts were trimmed for the core-only PHP landing).
- [ ] Capture any consolidation deltas in the RFC/plan if usage patterns changed substantially.

## General
- [ ] `npm run build`
- [ ] `npm test`
- [ ] `rust-core`: `cargo test && cargo clippy`
- [ ] CHANGELOG entry drafted and reviewed.
- [ ] Neo4j memory updated with release summary.
