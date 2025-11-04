# PHP Telemetry Verification (feat/php-minimal)

- **Workflow:** `php-telemetry.yml` run [19059203216](https://github.com/KnotFalse/In-Memoria/actions/runs/19059203216) (`workflow_dispatch`, 2025-11-04T05:50:42Z).
- **Binary override fix:** commit `7092d2f` (`fix: honor native binding override in loader`).
- **Artifacts:** 
  - CI telemetry snapshot → `tmp/release/php-telemetry/php-sandbox.ci-19059203216.json`
  - CI run log → `tmp/release/php-telemetry/php-telemetry-19059203216.log`
  - Local sandbox baseline → `tmp/release/php-telemetry/php-sandbox.local-baseline.json`

## Metrics

| Source | PHP Concepts | Concept Query (ms) | Notes |
| --- | --- | --- | --- |
| CI (sandbox) | 40 | 0 | Rerun operates on warmed DB, easily above ≥5 gate |
| Local sandbox | 5 | 1 | Fresh learn from sandbox-php-sample fixture |

## Verification Steps

1. Build & test locally before push:  
   `CI=true IN_MEMORIA_DEBUG_PHP=1 IN_MEMORIA_FORCE_NPX=1 npm run test:php-integration -- --group synthetic --fixture sandbox-php-sample`
2. Trigger telemetry workflow against `feat/php-minimal`:  
   `gh workflow run php-telemetry.yml --ref feat/php-minimal --repo KnotFalse/In-Memoria`
3. After success, download artifact and log (stored under `tmp/release/php-telemetry/` as above).

## Reviewer Guidance

- Confirm loader change in `src/rust-bindings.ts` is present (ensures override honored).
- Inspect `php-sandbox.ci-19059203216.json` for ≥5 PHP concepts and concept latency ≤10 ms.
- Cross-check that CI log contains `[PHP DEBUG]` entries for entry/processing/skipped paths, proving instrumentation executed on runners.

