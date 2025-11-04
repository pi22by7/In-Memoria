# PHP Minimal Support Notes (2025-11-04)

- **Branch:** `feat/php-minimal`
- **Key commits:**  
  - `ea40541` – Minimal PHP language support  
  - `7092d2f` – Respect `NAPI_RS_NATIVE_LIBRARY_PATH` in loader  
  - `b3d3171` – Remove temporary Codex collateral

## Telemetry Verification

- Workflow `php-telemetry.yml` run `19059203216` (2025-11-04T05:50:42Z) passes with 40 PHP concepts, 0 ms query time.
- Local fresh learn on `sandbox-php-sample` returns 5 PHP concepts at ~2 ms after `npx tsx scripts/capture-performance-status.ts sandbox-php-sample tmp/metrics/sandbox-smoke.json`.
- Artifacts retained locally under `tmp/release/php-telemetry/` (CI snapshot, local smoke capture, watcher logs).

## Watcher Smoke Test

- Watcher CLI starts clean in WSL2, but file-change events do not surface due to known WSL2 inotify limitations. Expect normal behavior on native Linux/macOS or GitHub Actions runners.

## Outstanding Follow-ups

- When preparing the upstream PR, attach `php-telemetry` artifact (`php-sandbox.ci-19059203216.json`) and mention local baseline metrics.
- Note the `npm ci` lockfile warning (optional platform packages at 0.5.7). `npm install` + `npm run build` succeed; revisit lockfile update post-merge if desired.
