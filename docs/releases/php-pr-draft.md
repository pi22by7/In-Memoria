# Draft PR: Minimal PHP Language Support

## Overview

- **Target repo:** `pi22by7/in-memoria`
- **Branch:** `feat/php-minimal`
- **Primary commits:**
  - `ea405411` – `feat: add minimal php language support`
  - `7092d2f` – `fix: honor native binding override in loader`

## Summary of Changes

1. **Rust core** – register `tree-sitter-php`, add `PhpExtractor`, extend semantic config, and expose PHP concepts to the analyzer.
2. **TypeScript server** – update language registry, watcher patterns, semantic engine, and MCP tooling to recognize PHP.
3. **Testing & telemetry** – add PHP fixtures (synthetic + curated real-world), harness scripts, GitHub workflow `php-telemetry.yml`, and docs for PHP monitoring.
4. **Loader fix** – ensure `src/rust-bindings.ts` respects `NAPI_RS_NATIVE_LIBRARY_PATH`, unblocking CI telemetry counts.

## Evidence / Testing

- Local harness:  
  `CI=true IN_MEMORIA_DEBUG_PHP=1 IN_MEMORIA_FORCE_NPX=1 npm run test:php-integration -- --group synthetic --fixture sandbox-php-sample`
- GitHub Actions: workflow [`php-telemetry.yml`](https://github.com/KnotFalse/In-Memoria/actions/runs/19059203216) (40 PHP concepts, 0 ms query time).
- Artifacts archived under `tmp/release/php-telemetry/` (CI snapshot, local baselines, capture logs, watcher smoke log).

## Reviewer Checklist

- [ ] Verify loader change in `src/rust-bindings.ts` precedes platform detection.
- [ ] Confirm telemetry artifact contains ≥5 PHP concepts and `conceptsMs ≤ 10`.
- [ ] Spot-check PHP fixtures for licensing notices and trimmed scope.
- [ ] Ensure no unintended dependency or lockfile churn remains.

## Open Questions / Follow-ups

- Should we normalize the CI database prior to the telemetry run to keep concept counts closer to the local baseline (5 vs 40)?
- Do we want a docs callout in README highlighting loader override requirements for contributors?

## Remaining QA Gates
- [x] **Manual MCP verification** – Fresh learn + capture saved at `tmp/release/php-telemetry/php-sandbox.local-smoke-2025-11-04T0610Z.json` (5 concepts, 2 ms).
- [~] **Watcher smoke test** – Watcher starts clean (`tmp/release/php-telemetry/watcher-smoke.log`). Change events fail to surface under WSL2 due to known filesystem notification gaps; note this environment caveat for reviewers (native Linux/macOS runners should emit events).
- [~] **Clean install/build** – `npm ci` failed due to optional native packages missing pinned versions in lock; proceeded with `npm install` then `npm run build` (success). Call out in PR so maintainers know to run `npm install`.
- [ ] **Docs double-check** – README/CHANGELOG appear accurate post-fix; a quick maintainer review still recommended.
- [ ] **Telemetry rerun readiness** – Command snippet prepared below; artifacts already archived.

```bash
gh workflow run php-telemetry.yml --ref feat/php-minimal --repo KnotFalse/In-Memoria
gh run download <run-id> --name php-telemetry --dir tmp/telemetry
```
