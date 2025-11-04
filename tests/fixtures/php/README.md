# PHP QA Fixtures

These lightweight fixtures emulate common PHP ecosystems without bundling vendor code:

- `laravel-demo`: Composer project declaring `laravel/framework`, PSR-4 namespace `App\\` with a sample controller.
- `symfony-demo`: Curated Symfony slice (controllers, services, subscribers) for real-world telemetry without vendoring the full repo.
- `koel`: Laravel-style app (model, API controller, streaming services) distilled from Koel’s structure.
- `woocommerce`: Representative WooCommerce classes and plugin hook wiring.
- `elementor`: Minimal Elementor plugin bootstrap plus form module.
- `phpmyadmin`: Lightweight server status controller/service pair mimicking phpMyAdmin patterns.
- `wordpress-demo`: Minimal plugin file exercising procedural WordPress patterns.

They are used by `scripts/php-integration-check.ts` to validate parser/extractor heuristics and performance instrumentation.
