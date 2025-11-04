# PHP Integration Benchmarks

> **Note:** Commands use `bunx`. If Bun is not installed, replace with `npx`; the automation scripts auto-detect and fall back to `npx` when invoked directly.

## Metric Capture (2025-11-03)

| Metric | PHP (`sandbox-php-sample`) | Python baseline (`sandbox-python-sample`) | Δ |
| --- | --- | --- | --- |
| Concept query time | 1 ms | 1 ms | 0 ms (parity) |
| Pattern query time | 1 ms | 1 ms | 0 ms (parity) |
| Concepts recorded | 5 | 5 | 0 (fixture-aligned) |

- Commands  
  1. `bunx tsx scripts/capture-performance-status.ts sandbox-php-sample tmp/metrics/php-smoke.json`  
  2. `bunx tsx scripts/capture-performance-status.ts sandbox-python-sample tmp/metrics/python-smoke.json`  
  3. `bunx tsx scripts/compare-language-metrics.ts tmp/metrics/php-smoke.json tmp/metrics/python-smoke.json 10`

- Result: PHP and Python sandbox fixtures now return identical concept counts and query timings; nightly telemetry thresholds use ≥5 concepts and ≤10 ms concept queries.

Fixtures referenced: see `docs/benchmarks/fixtures.md`.

## QA Harness

- Command: `npm run test:php-integration`
- Script: `scripts/php-integration-check.ts`
- Output: per-fixture metrics in `tmp/metrics/*.json` and aggregate report `tmp/metrics/php-integration-report.json`
- Fixture coverage: sandbox PHP sample, Laravel demo, Symfony demo, WordPress demo, and Python baseline

## Real-world Fixture Smoke (2025-11-04)

| Fixture (root) | Commit | PHP concepts | Concept query time | Notes |
| --- | --- | --- | --- | --- |
| Symfony Demo (`.`) | b388edaa15a6b41de9ec066b3ced1c878717dd60 | 8 | 1 ms | Curated subset covering controllers, services, event subscribers. |
| Koel (`app`) | 6cf7420f52060d668b1747d74b5f319e328f61c9 | 4 | 1 ms | Focused sample of models, API controller, and services. |
| WooCommerce (`includes`) | 627c9189ae6553fc4b16d1497904a0c4e0b4c018 | 3 | 1 ms | Trimmed classes mirroring product + admin hooks. |
| Elementor (`core/modules`) | 5fb99ad0ba7f44dab437116b0249d63265f2ec3c | 2 | 1 ms | Minimal plugin bootstrap + form module. |
| phpMyAdmin (`libraries/src`) | 57aee0f7021fe714b24196416e00e82d4d33c92f | 3 | 1 ms | Lightweight server status controller/service pair. |

Run selectively with `npm run test:php-integration -- --group realworld --fixture <name>`; fixtures and roots are defined in `tests/fixtures/realworld/fixtures.json`.

> **Note:** The fixtures are curated snapshots sized for repository distribution; they capture representative patterns rather than full upstream histories.

## MCP Evidence (2025-10-30)

- `docs/benchmarks/php-mcp/laravel-demo/` contains `project-structure.json`, `performance.json`, `developer-profile.json`, and `search.json` captured via `bunx tsx scripts/dump-php-mcp.ts tests/fixtures/php/laravel-demo docs/benchmarks/php-mcp/laravel-demo controller`.
- Use these artifacts to verify PHP-specific metrics (composer namespaces, `% typed methods`, search coverage) when auditing MCP responses.
