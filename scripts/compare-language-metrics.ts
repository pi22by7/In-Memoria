import { readFileSync } from 'fs';
import { resolve } from 'path';

function loadMetrics(path: string) {
  const resolved = resolve(process.cwd(), path);
  return JSON.parse(readFileSync(resolved, 'utf-8'));
}

function percentDelta(a: number, b: number): number {
  if (b === 0) {
    return a === 0 ? 0 : Infinity;
  }
  return Math.abs(a - b) / b * 100;
}

async function main(): Promise<void> {
  const [phpPath, pythonPath, thresholdArg] = process.argv.slice(2);
  if (!phpPath || !pythonPath) {
    console.error('Usage: bunx tsx scripts/compare-language-metrics.ts <php-json> <python-json> [thresholdPercent=10]');
    process.exit(1);
  }

  const threshold = thresholdArg ? Number(thresholdArg) : 10;

  const php = loadMetrics(phpPath);
  const python = loadMetrics(pythonPath);

  const phpConcepts = php.performance?.intelligence?.conceptsByLanguage?.php ?? 0;
  const pythonConcepts = python.performance?.intelligence?.conceptsByLanguage?.python ?? 0;

  if (phpConcepts === 0) {
    console.error('❌ PHP metrics missing: conceptsByLanguage.php is zero.');
    process.exit(1);
  }
  if (pythonConcepts === 0) {
    console.error('❌ Baseline metrics missing: conceptsByLanguage.python is zero.');
    process.exit(1);
  }

  const phpQuery = php.performance?.database?.queryPerformance ?? {};
  const pythonQuery = python.performance?.database?.queryPerformance ?? {};

  const phpConceptMs = phpQuery.conceptsMs ?? 0;
  const pythonConceptMs = pythonQuery.conceptsMs ?? 1;
  const phpPatternMs = phpQuery.patternsMs ?? 0;
  const pythonPatternMs = pythonQuery.patternsMs ?? 1;

  const conceptMsDelta = percentDelta(phpConceptMs, pythonConceptMs);
  const patternMsDelta = percentDelta(phpPatternMs, pythonPatternMs);

  const failures: string[] = [];

  if (conceptMsDelta > threshold && Math.abs(phpConceptMs - pythonConceptMs) > 1) {
    failures.push(`Concept query delta ${conceptMsDelta.toFixed(2)}% exceeds ${threshold}%`);
  }

  if (patternMsDelta > threshold && Math.abs(phpPatternMs - pythonPatternMs) > 1) {
    failures.push(`Pattern query delta ${patternMsDelta.toFixed(2)}% exceeds ${threshold}%`);
  }

  if (failures.length > 0) {
    console.error('❌ Metric comparison failed:\n - ' + failures.join('\n - '));
    process.exit(1);
  }

  console.log('✅ Metric comparison passed.');
  console.log(` • PHP concept queries: ${phpConceptMs} ms`);
  console.log(` • Python concept queries: ${pythonConceptMs} ms`);
  console.log(` • PHP pattern queries: ${phpPatternMs} ms`);
  console.log(` • Python pattern queries: ${pythonPatternMs} ms`);
  console.log(` • Threshold: ±${threshold}%`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
