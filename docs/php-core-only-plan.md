# PHP Core-Only Trim Plan (2025-11-07)

Maintainer request on PR [#18](https://github.com/pi22by7/In-Memoria/pull/18) asks for a lean landing of the PHP extractor work before telemetry/monitoring collateral. This file documents the agreement so future sessions keep the branch focused.

## Goal

Produce a new branch (working name: `feat/php-core-only`) derived from `feat/php-minimal` that only contains the minimum viable PHP support:

- **Keep**
  - Rust core PHP extractor + language registry refactors
  - TypeScript wiring that exposes PHP support through the MCP server/CLI
  - `sandbox-php-sample/` fixture needed for smoke tests
  - README + CHANGELOG updates describing PHP support at a high level
- **Remove (for follow-up PRs)**
  - `docs/releases/`, `docs/ops/`, `docs/benchmarks/`
  - Telemetry/demo scripts under `scripts/`
  - `tests/fixtures/php/` real-world fixture snapshots
  - New `.github/workflows/` entries tied to telemetry/monitoring

Target outcome: a ~500 line diff showing just the core runtime/compiler work.

## Execution Steps

1. **Prep**
   - Ensure clean tree, fetch latest upstream refs.
   - Branch from `feat/php-minimal` → `feat/php-core-only`, tag original head for safekeeping.

2. **Scope Inventory**
   - Use `git diff --name-only upstream/main...` to map touched files.
   - Classify into Keep/Remove buckets above; log edge cases (e.g., shared helper scripts).

3. **Prune Docs & Workflows**
   - Delete requested doc directories and telemetry workflows.
   - Update README/CHANGELOG references so they only mention surviving assets.

4. **Trim Scripts & Fixtures**
   - Remove telemetry/benchmark scripts plus `tests/fixtures/php/`.
   - Keep `sandbox-php-sample/` so future smoke tests have a lightweight fixture even without the full harness.

5. **Sanity + Tests**
   - Run `npm run build`, `npm test`, `cargo test -p in-memoria-core`, and the sandbox PHP integration check to ensure core support still works without the removed collateral.

6. **Review & PR**
   - Confirm diff scope (~500 LOC) and absence of stray references (use `rg docs/benchmarks` etc.).
   - Push branch and open a fresh PR referencing maintainer guidance, noting that telemetry/monitoring will follow separately.

Keep this document until the trimmed PR merges; it provides the canonical intent if new contributors join mid-process.

## Status (2025-11-07)

- Scope verification complete: telemetry docs/scripts/workflows/fixtures remain removed, and only the PHP extractor, registry wiring, TypeScript integration, sandbox sample, and README/CHANGELOG updates persist.
- `npm run build` / `npm test` pass; `cargo test -p in-memoria-core` compiles but still reports the pre-existing framework detector, Python extractor, fallback parser, and SQL extractor failures (non-blocking for this PR).
- Release checklist updated to note that tool-usage reviews rely on manual dashboards until telemetry tooling returns in the follow-up PR.
