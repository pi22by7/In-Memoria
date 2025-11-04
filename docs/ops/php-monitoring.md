# PHP Monitoring Runbook

## Cadence
- **Weekly review (Mondays, 09:00 UTC)** owned by the release rotation engineer.
- Additional ad-hoc checks whenever PHP-related changes land (parsers, watchers, storage).

## Required checks
1. **Telemetry workflow** – Inspect the latest run of `PHP Telemetry` (`.github/workflows/php-telemetry.yml`). Confirm:
   - Job status is green.
   - `php-sandbox.json` artifact shows `success: true`, `performance.database.queryPerformance.conceptsMs ≤ 10`, and `performance.intelligence.conceptsByLanguage.php ≥ 5`.
2. **Harness workflow** – Review the weekly `PHP QA Harness` run for failures. Download `php-integration-report.json` and spot-check concept counts & parse times for all fixtures.
3. **Metrics drift** – Compare the latest report against the previous week. Investigate deltas >10 % in concept counts or parse times; record findings in the session log/Neo4j memory.
4. **Error triage** – If either workflow fails, open an issue and notify the release rotation channel within 1 hour.

## Reproducing locally
```bash
npm run test:php-integration -- --group synthetic --fixture sandbox-php-sample
npm run test:php-integration -- --group realworld
npx tsx scripts/run-php-telemetry.ts --project sandbox-php-sample --max-concepts-ms 10 --min-php-concepts 5
npm run fixtures:update-php -- --with-metrics --fixtures=symfony-demo
```

Log any anomalies in the Neo4j memory graph under the `in-memoria` tag.
