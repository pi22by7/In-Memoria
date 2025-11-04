import { mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';

import { capturePerformanceStatus } from './capture-performance-status.js';

interface Options {
  projectPath: string;
  outputPath?: string;
  maxConceptsMs: number;
  minPhpConcepts: number;
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  let projectPath = '';
  let outputPath: string | undefined;
  let maxConceptsMs = 5;
  let minPhpConcepts = 5;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--project' && args[i + 1]) {
      projectPath = args[i + 1];
      i += 1;
    } else if (arg === '--output' && args[i + 1]) {
      outputPath = args[i + 1];
      i += 1;
    } else if (arg.startsWith('--max-concepts-ms=')) {
      maxConceptsMs = Number(arg.split('=')[1]);
    } else if (arg === '--max-concepts-ms' && args[i + 1]) {
      maxConceptsMs = Number(args[i + 1]);
      i += 1;
    } else if (arg.startsWith('--min-php-concepts=')) {
      minPhpConcepts = Number(arg.split('=')[1]);
    } else if (arg === '--min-php-concepts' && args[i + 1]) {
      minPhpConcepts = Number(args[i + 1]);
      i += 1;
    }
  }

  if (!projectPath) {
    console.error('Usage: bunx tsx scripts/run-php-telemetry.ts --project <path> [--output file] [--max-concepts-ms N] [--min-php-concepts N]');
    process.exit(1);
  }

  return {
    projectPath: resolve(process.cwd(), projectPath),
    outputPath: outputPath ? resolve(process.cwd(), outputPath) : undefined,
    maxConceptsMs,
    minPhpConcepts
  };
}

async function main(): Promise<void> {
  const options = parseArgs();

  if (process.env.CI === 'true') {
    console.log(`🔧 (telemetry) NAPI override: ${process.env.NAPI_RS_NATIVE_LIBRARY_PATH ?? 'unset'}`);
    console.log(`🔧 (telemetry) IN_MEMORIA_DEBUG_PHP: ${process.env.IN_MEMORIA_DEBUG_PHP ?? 'unset'}`);
  }

  const status = await capturePerformanceStatus(options.projectPath);

  const conceptsMs = status?.performance?.database?.queryPerformance?.conceptsMs;
  const phpConcepts = status?.performance?.intelligence?.conceptsByLanguage?.php ?? 0;
  const success = status?.success ?? false;

  const failures: string[] = [];
  if (!success) {
    failures.push('performance check did not succeed');
  }
  if (typeof conceptsMs === 'number' && conceptsMs > options.maxConceptsMs) {
    failures.push(`concept query time ${conceptsMs}ms exceeds threshold ${options.maxConceptsMs}ms`);
  }
  if (phpConcepts < options.minPhpConcepts) {
    failures.push(`expected at least ${options.minPhpConcepts} PHP concepts, found ${phpConcepts}`);
  }

  if (options.outputPath) {
    mkdirSync(dirname(options.outputPath), { recursive: true });
    writeFileSync(options.outputPath, JSON.stringify(status, null, 2), 'utf-8');
    console.log(`Telemetry written to ${options.outputPath}`);
  }

  if (failures.length > 0) {
    failures.forEach((failure) => console.error(`✖ ${failure}`));
    process.exit(1);
  }

  console.log('✅ PHP telemetry checks passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
