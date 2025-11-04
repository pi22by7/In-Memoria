# Benchmark Fixtures

| Fixture | Path | Description | Source |
| --- | --- | --- | --- |
| Sandbox PHP Sample | `sandbox-php-sample` | Single-class PHP project used for regression metrics | Local |
| Laravel Demo | `tests/fixtures/php/laravel-demo` | Minimal Laravel-style project with PSR-4 autoload | Local synthetic |
| Symfony Demo | `tests/fixtures/php/symfony-demo` | Minimal Symfony-style project with controller | Local synthetic |
| WordPress Demo | `tests/fixtures/php/wordpress-demo` | WordPress plugin-style fixture exercising procedural patterns | Local synthetic |
| Python Baseline | `sandbox-python-sample` | Minimal Python service used as baseline for metric comparisons | Local synthetic |

Harness command: `npm run test:php-integration` (see `scripts/php-integration-check.ts`).
