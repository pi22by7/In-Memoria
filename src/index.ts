#!/usr/bin/env node

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { runServer } from './mcp-server/server.js';
import { FileWatcher } from './watchers/file-watcher.js';
import { ChangeAnalyzer } from './watchers/change-analyzer.js';
import { SemanticEngine } from './engines/semantic-engine.js';
import { PatternEngine } from './engines/pattern-engine.js';
import { SQLiteDatabase } from './storage/sqlite-db.js';
import { SemanticVectorDB } from './storage/vector-db.js';
import { InteractiveSetup } from './cli/interactive-setup.js';
import { DebugTools } from './cli/debug-tools.js';
import { config } from './config/config.js';

function getVersion(): string {
  try {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const packagePath = join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
    return packageJson.version;
  } catch (error) {
    return 'unknown';
  }
}

function showVersion(): void {
  const version = getVersion();
  console.log(`In Memoria v${version}`);
  console.log('Persistent Intelligence Infrastructure for AI Agents');
  console.log('https://github.com/pi22by7/in-memoria');
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  // Handle version flags
  if (args.includes('--version') || args.includes('-v')) {
    showVersion();
    return;
  }

  switch (command) {
    case 'version':
    case '--version':
    case '-v':
      showVersion();
      break;
    case 'server':
      console.log('Starting In Memoria MCP Server...');
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

    case 'setup':
      if (args[1] === '--interactive') {
        const setup = new InteractiveSetup();
        await setup.run();
      } else {
        showHelp();
      }
      break;

    case 'debug':
    case 'check':
      const debugPath = args.find(arg => !arg.startsWith('--')) || process.cwd();
      const debugOptions = {
        verbose: args.includes('--verbose'),
        checkDatabase: !args.includes('--no-database'),
        checkIntelligence: !args.includes('--no-intelligence'),
        checkFileSystem: !args.includes('--no-filesystem'),
        validateData: args.includes('--validate'),
        performance: args.includes('--performance')
      };

      const debugTools = new DebugTools(debugOptions);
      await debugTools.runDiagnostics(debugPath);
      break;

    default:
      showHelp();
      break;
  }
}

async function startWatcher(path: string): Promise<void> {
  console.log(`Starting file watcher for: ${path}`);

  // Initialize components
  const database = new SQLiteDatabase(config.getDatabasePath(path));
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

  const database = new SQLiteDatabase(config.getDatabasePath(path));
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
    // Clean up all resources to prevent hanging
    try {
      await vectorDB.close();
    } catch (error) {
      console.warn('Warning: Failed to close vector database:', error);
    }

    // Clean up semantic engine resources
    semanticEngine.cleanup();

    database.close();
    // console.debug("database closed");

    // Force process exit to ensure cleanup of any remaining resources
    process.exit(0);
  }
}

async function analyzeCodebase(path: string): Promise<void> {
  console.log(`Analyzing codebase: ${path}`);

  const database = new SQLiteDatabase(config.getDatabasePath(path));
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
    const cyclomaticComplexity = analysis.complexity?.cyclomatic ?? 0;
    const cognitiveComplexity = analysis.complexity?.cognitive ?? 0;
    console.log(`Complexity: Cyclomatic=${cyclomaticComplexity.toFixed(1)}, Cognitive=${cognitiveComplexity.toFixed(1)}`);

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
    // Clean up all resources to prevent hanging
    try {
      await vectorDB.close();
    } catch (error) {
      console.warn('Warning: Failed to close vector database:', error);
    }

    // Clean up semantic engine resources
    semanticEngine.cleanup();

    database.close();
  }
}

async function initializeProject(path: string): Promise<void> {
  console.log(`Initializing In Memoria for project: ${path}`);

  // Create .in-memoria directory
  const { mkdirSync, writeFileSync, existsSync } = await import('fs');
  const { join } = await import('path');

  const configDir = join(path, '.in-memoria');
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }

  // Create default configuration
  const defaultConfig = {
    version: "0.4.6",
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
    if (!gitignoreContent.includes('in-memoria.db')) {
      appendFileSync(gitignorePath, '\n# In Memoria\nin-memoria.db\n.in-memoria/cache/\n');
    }
  }

  console.log('✅ In Memoria initialized!');
  console.log(`Configuration saved to: ${configPath}`);
  console.log('\nNext steps:');
  console.log('1. Run `in-memoria learn` to learn from your codebase');
  console.log('2. Run `in-memoria server` to start the MCP server');
  console.log('3. Run `in-memoria watch` to monitor file changes');
}

function showHelp(): void {
  console.log(`
In Memoria - Persistent Intelligence Infrastructure for AI Agents

Usage: in-memoria <command> [options]

Commands:
  server                    Start the MCP server for AI agent integration
  setup --interactive       Interactive setup wizard (recommended for first time)
  check [path] [options]    Run diagnostics and troubleshooting
  watch [path]             Start file watcher for real-time intelligence updates
  learn [path]             Learn from codebase and build intelligence
  analyze [path]           Analyze codebase and show insights
  init [path]              Initialize In Memoria for a project (basic)
  version, --version, -v    Show version information

Diagnostic Options (for 'check' command):
  --verbose                Show detailed diagnostic information
  --validate               Validate intelligence data consistency
  --performance            Analyze performance characteristics
  --no-database            Skip database diagnostics
  --no-intelligence        Skip intelligence diagnostics
  --no-filesystem          Skip filesystem diagnostics

Examples:
  in-memoria setup --interactive    # Recommended for first-time setup
  in-memoria server
  in-memoria check --verbose       # Full diagnostics with details
  in-memoria check --validate      # Check data integrity
  in-memoria watch ./src
  in-memoria learn ./my-project
  in-memoria analyze ./src
  in-memoria init

Environment Variables:
  OPENAI_API_KEY           OpenAI API key for enhanced vector embeddings (optional)

For more information, visit: https://github.com/pi22by7/in-memoria
`);
}
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
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});