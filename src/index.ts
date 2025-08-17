#!/usr/bin/env node

import { runServer } from './mcp-server/server.js';
import { FileWatcher } from './watchers/file-watcher.js';
import { ChangeAnalyzer } from './watchers/change-analyzer.js';
import { SemanticEngine } from './engines/semantic-engine.js';
import { PatternEngine } from './engines/pattern-engine.js';
import { SQLiteDatabase } from './storage/sqlite-db.js';
import { SemanticVectorDB } from './storage/vector-db.js';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'server':
      console.log('Starting Code Cartographer MCP Server...');
      await runServer();
      break;

    case 'watch':
      const watchPath = args[1] || process.cwd();
      await startWatcher(watchPath);
      break;

    case 'learn':
      const learnPath = args[1] || process.cwd();
      await learnCodebase(learnPath);
      break;

    case 'analyze':
      const analyzePath = args[1] || process.cwd();
      await analyzeCodebase(analyzePath);
      break;

    case 'init':
      const initPath = args[1] || process.cwd();
      await initializeProject(initPath);
      break;

    default:
      showHelp();
      break;
  }
}

async function startWatcher(path: string): Promise<void> {
  console.log(`Starting file watcher for: ${path}`);

  // Initialize components
  const database = new SQLiteDatabase('./code-cartographer.db');
  const vectorDB = new SemanticVectorDB(process.env.OPENAI_API_KEY);
  const semanticEngine = new SemanticEngine(database, vectorDB);
  const patternEngine = new PatternEngine(database);
  const analyzer = new ChangeAnalyzer(semanticEngine, patternEngine, database);

  // Setup file watcher
  const watcher = new FileWatcher({
    patterns: [
      `${path}/**/*.ts`,
      `${path}/**/*.tsx`,
      `${path}/**/*.js`,
      `${path}/**/*.jsx`,
      `${path}/**/*.py`,
      `${path}/**/*.rs`,
      `${path}/**/*.go`,
      `${path}/**/*.java`
    ],
    includeContent: true
  });

  // Handle file changes
  watcher.on('file:change', async (change) => {
    console.log(`File changed: ${change.path} (${change.type})`);

    try {
      const analysis = await analyzer.analyzeChange(change);
      console.log(`Analysis complete: ${analysis.intelligence.insights.join(', ')}`);
    } catch (error) {
      console.error(`Analysis failed: ${error}`);
    }
  });

  watcher.on('watcher:error', (error) => {
    console.error(`Watcher error: ${error}`);
  });

  watcher.startWatching();
  console.log('File watcher started. Press Ctrl+C to stop.');

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nStopping file watcher...');
    watcher.stopWatching();
    database.close();
    process.exit(0);
  });
}

async function learnCodebase(path: string): Promise<void> {
  console.log(`Learning from codebase: ${path}`);

  const database = new SQLiteDatabase('./code-cartographer.db');
  const vectorDB = new SemanticVectorDB(process.env.OPENAI_API_KEY);
  const semanticEngine = new SemanticEngine(database, vectorDB);
  const patternEngine = new PatternEngine(database);

  try {
    console.log('Extracting semantic concepts...');
    const concepts = await semanticEngine.learnFromCodebase(path);
    console.log(`Learned ${concepts.length} semantic concepts`);

    console.log('Learning coding patterns...');
    const patterns = await patternEngine.learnFromCodebase(path);
    console.log(`Learned ${patterns.length} coding patterns`);

    console.log('Learning complete! Intelligence stored for future sessions.');
  } catch (error) {
    console.error(`Learning failed: ${error}`);
  } finally {
    database.close();
  }
}

async function analyzeCodebase(path: string): Promise<void> {
  console.log(`Analyzing codebase: ${path}`);

  const database = new SQLiteDatabase('./code-cartographer.db');
  const vectorDB = new SemanticVectorDB(process.env.OPENAI_API_KEY);
  const semanticEngine = new SemanticEngine(database, vectorDB);
  const patternEngine = new PatternEngine(database);

  try {
    const analysis = await semanticEngine.analyzeCodebase(path);
    const patterns = await patternEngine.extractPatterns(path);

    // Also get stored intelligence from previous learning sessions
    const storedConcepts = database.getSemanticConcepts();
    const storedPatterns = database.getDeveloperPatterns();

    console.log('\n=== Codebase Analysis Results ===');
    console.log(`Languages: ${analysis.languages.join(', ')}`);
    console.log(`Frameworks: ${analysis.frameworks.join(', ')}`);
    console.log(`Fresh concepts found: ${analysis.concepts.length}`);
    console.log(`Stored concepts available: ${storedConcepts.length}`);
    console.log(`Fresh patterns found: ${patterns.length}`);
    console.log(`Stored patterns available: ${storedPatterns.length}`);
    console.log(`Complexity: Cyclomatic=${analysis.complexity.cyclomatic.toFixed(1)}, Cognitive=${analysis.complexity.cognitive.toFixed(1)}`);

    // Show fresh concepts from current analysis
    if (analysis.concepts.length > 0) {
      console.log('\nFresh Concepts (from current analysis):');
      analysis.concepts.slice(0, 5).forEach(concept => {
        console.log(`  - ${concept.name} (${concept.type}) - confidence: ${(concept.confidence * 100).toFixed(1)}%`);
      });
    }

    // Show some stored concepts from learning
    if (storedConcepts.length > 0) {
      console.log('\nStored Concepts (from learning):');
      storedConcepts.slice(0, 5).forEach(concept => {
        console.log(`  - ${concept.conceptName} (${concept.conceptType}) - confidence: ${(concept.confidenceScore * 100).toFixed(1)}%`);
      });
    }

    // Show fresh patterns
    if (patterns.length > 0) {
      console.log('\nFresh Patterns:');
      patterns.slice(0, 5).forEach(pattern => {
        console.log(`  - ${pattern.type}: ${pattern.description} (frequency: ${pattern.frequency})`);
      });
    }

    // Show stored patterns
    if (storedPatterns.length > 0) {
      console.log('\nStored Patterns (from learning):');
      storedPatterns.slice(0, 5).forEach(pattern => {
        const description = pattern.patternContent?.description || 'Pattern learned from code';
        console.log(`  - ${pattern.patternType}: ${description} (frequency: ${pattern.frequency})`);
      });
    }
  } catch (error) {
    console.error(`Analysis failed: ${error}`);
  } finally {
    database.close();
  }
}

async function initializeProject(path: string): Promise<void> {
  console.log(`Initializing Code Cartographer for project: ${path}`);

  // Create .code-cartographer directory
  const { mkdirSync, writeFileSync, existsSync } = await import('fs');
  const { join } = await import('path');

  const configDir = join(path, '.code-cartographer');
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }

  // Create default configuration
  const defaultConfig = {
    version: "1.0.0",
    intelligence: {
      enableRealTimeAnalysis: true,
      enablePatternLearning: true,
      vectorEmbeddings: process.env.OPENAI_API_KEY ? true : false
    },
    watching: {
      patterns: [
        "**/*.ts",
        "**/*.tsx",
        "**/*.js",
        "**/*.jsx",
        "**/*.py",
        "**/*.rs",
        "**/*.go",
        "**/*.java"
      ],
      ignored: [
        "**/node_modules/**",
        "**/.git/**",
        "**/dist/**",
        "**/build/**",
        "**/target/**"
      ],
      debounceMs: 500
    },
    mcp: {
      serverPort: 3000,
      enableAllTools: true
    }
  };

  const configPath = join(configDir, 'config.json');
  writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));

  // Create gitignore entry
  const gitignorePath = join(path, '.gitignore');
  if (existsSync(gitignorePath)) {
    const { readFileSync, appendFileSync } = await import('fs');
    const gitignoreContent = readFileSync(gitignorePath, 'utf-8');
    if (!gitignoreContent.includes('code-cartographer.db')) {
      appendFileSync(gitignorePath, '\n# Code Cartographer\ncode-cartographer.db\n.code-cartographer/cache/\n');
    }
  }

  console.log('✅ Code Cartographer initialized!');
  console.log(`Configuration saved to: ${configPath}`);
  console.log('\nNext steps:');
  console.log('1. Run `code-cartographer learn` to learn from your codebase');
  console.log('2. Run `code-cartographer server` to start the MCP server');
  console.log('3. Run `code-cartographer watch` to monitor file changes');
}

function showHelp(): void {
  console.log(`
Code Cartographer - Persistent Intelligence Infrastructure for AI Agents

Usage: code-cartographer <command> [options]

Commands:
  server                    Start the MCP server for AI agent integration
  watch [path]             Start file watcher for real-time intelligence updates
  learn [path]             Learn from codebase and build intelligence
  analyze [path]           Analyze codebase and show insights
  init [path]              Initialize Code Cartographer for a project

Examples:
  code-cartographer server
  code-cartographer watch ./src
  code-cartographer learn ./my-project
  code-cartographer analyze ./src
  code-cartographer init

Environment Variables:
  OPENAI_API_KEY           OpenAI API key for enhanced vector embeddings (optional)
  CHROMA_HOST             ChromaDB host (default: http://localhost:8000)

For more information, visit: https://github.com/pi22by7/Code-Cartographer
`);
}

// Handle unhandled errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Run the CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}