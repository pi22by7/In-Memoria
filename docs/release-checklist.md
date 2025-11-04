# Release Checklist

## Project Intelligence
- [ ] Run `npm test -- --run project-intelligence` to ensure blueprint/session tests pass.
- [ ] Render/update ER diagram: `docs/diagrams/project-intelligence-erd.mmd` → export to image if needed.
- [ ] Verify feature toggle behavior:
  - `IN_MEMORIA_DISABLE_PROJECT_INTEL=true npx in-memoria blueprint` should emit disabled warning.
  - Default configuration should generate blueprints successfully.
- [ ] Confirm README/AGENTS references are up to date.

## PHP Sustainment
- [ ] Review latest GitHub Actions runs:
  - `PHP Telemetry` workflow success and thresholds.
  - `PHP QA Harness` artifact (`php-integration-report.json`).
- [ ] Run targeted regression checks:
  - `cargo test --features all-languages` (extractor, parser, and pattern gating)
  - `vitest run src/__tests__/php-integration.test.ts`
  - `npm run test:php-integration -- --group synthetic --fixture sandbox-php-sample`
- [ ] Optional: run `npm run fixtures:update-php -- --with-metrics` locally if fixtures moved forward.

## MCP Tool Surface
- [ ] Run `npx tsx scripts/summarize-tool-usage.ts` on staging database to review tool usage shifts.
- [ ] Update consolidation RFC/plan if usage patterns changed substantially.

## General
- [ ] `npm run build`
- [ ] `npm test`
- [ ] `rust-core`: `cargo test && cargo clippy`
- [ ] CHANGELOG entry drafted and reviewed.
- [ ] Neo4j memory updated with release summary.
