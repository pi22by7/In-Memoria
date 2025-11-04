import { writeFileSync } from 'fs';
import { resolve, join } from 'path';

import { SQLiteDatabase } from '../src/storage/sqlite-db.js';
import { SemanticVectorDB } from '../src/storage/vector-db.js';
import { SemanticEngine } from '../src/engines/semantic-engine.js';
import { PatternEngine } from '../src/engines/pattern-engine.js';
import { MonitoringTools } from '../src/mcp-server/tools/monitoring-tools.js';

export async function capturePerformanceStatus(projectPath: string) {
  const databasePath = join(projectPath, 'in-memoria.db');
  const database = new SQLiteDatabase(databasePath);
  const vectorDB = new SemanticVectorDB(process.env.OPENAI_API_KEY);
  const semanticEngine = new SemanticEngine(database, vectorDB);
  const patternEngine = new PatternEngine(database);
  const monitoringTools = new MonitoringTools(semanticEngine, patternEngine, database, databasePath);

  try {
    const status = await monitoringTools.getPerformanceStatus({ runBenchmark: false });
    return status;
  } finally {
    semanticEngine.cleanup();
    await vectorDB.close();
    database.close();
  }
}

async function main(): Promise<void> {
  const [targetPath, outputPath] = process.argv.slice(2);
  if (!targetPath || !outputPath) {
    console.error('Usage: bunx tsx scripts/capture-performance-status.ts <project-path> <output-json>');
    process.exit(1);
  }

  const projectPath = resolve(process.cwd(), targetPath);
  const resolvedOutputPath = resolve(process.cwd(), outputPath);

  const status = await capturePerformanceStatus(projectPath);
  writeFileSync(resolvedOutputPath, JSON.stringify(status, null, 2), 'utf-8');
  console.log(`Wrote performance metrics to ${resolvedOutputPath}`);
}

if (process.argv[1] && process.argv[1].includes('capture-performance-status')) {
  main().catch(error => {
    console.error(error);
    process.exit(1);
  });
}
