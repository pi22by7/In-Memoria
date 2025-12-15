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
import { Logger } from './utils/logger.js';

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

  // Check critical environment variables for crash safety
  if (!process.env.SURREAL_SYNC_DATA) {
    Logger.warn('⚠️  SURREAL_SYNC_DATA not set. Setting to "true" for crash safety.');
    Logger.warn('⚠️  To silence this warning, set: export SURREAL_SYNC_DATA=true');
    process.env.SURREAL_SYNC_DATA = 'true';
  }

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
      // Set MCP server mode BEFORE any logging
      process.env.MCP_SERVER = 'true';

      // Accept optional path argument to set working directory
      // If no path provided, server runs globally and tools receive project paths
      const serverArgs = args.slice(1);
      const serverPath = serverArgs.find(arg => !arg.startsWith('-'));

      if (serverPath) {
        const { resolve } = await import('path');
        const { existsSync } = await import('fs');
        const resolvedPath = resolve(serverPath);

        if (!existsSync(resolvedPath)) {
          console.error(`❌ Error: Path does not exist: ${resolvedPath}`);
          console.error(`   Tried: ${serverPath}`);
          console.error('   Please provide a valid project directory path as argument.');
          process.exit(1);
        }

        Logger.info(`📂 Working directory: ${resolvedPath}`);
        process.chdir(resolvedPath);
      }

      Logger.info(`🚀 Starting In Memoria MCP Server`);
      await runServer();
      break;

    case 'watch':
      const watchArgs = args.slice(1);
      const watchPath = watchArgs.find(arg => !arg.startsWith('-')) || process.cwd();
      await startWatcher(watchPath);
      break;

    case 'learn':
      const learnArgs = args.slice(1);
      const learnPath = learnArgs.find(arg => !arg.startsWith('-')) || process.cwd();
      await learnCodebase(learnPath);
      break;

    case 'analyze':
      const analyzeArgs = args.slice(1);
      const analyzePath = analyzeArgs.find(arg => !arg.startsWith('-')) || process.cwd();
      await analyzeCodebase(analyzePath);
      break;

    case 'init':
      const initArgs = args.slice(1);
      const initPath = initArgs.find(arg => !arg.startsWith('-')) || process.cwd();
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
      const checkArgs = args.slice(1);
      const debugPath = checkArgs.find(arg => !arg.startsWith('-')) || process.cwd();
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

    case 'run':
      const toolName = args[1];
      
      if (!toolName || toolName === '--help' || toolName === '-h' || toolName === 'help') {
        console.log('Usage: in-memoria run <tool_name> [options]');
        console.log('\nAvailable MCP Tools:');
        try {
          const { VALIDATION_SCHEMAS } = await import('./mcp-server/validation.js');
          Object.keys(VALIDATION_SCHEMAS).forEach(name => console.log(`  - ${name}`));
        } catch (e) {
          console.error('  (Error loading tool list)');
        }
        process.exit(0);
      }

      try {
        const { VALIDATION_SCHEMAS } = await import('./mcp-server/validation.js');
        if (toolName in VALIDATION_SCHEMAS) {
          const toolArgs = args.slice(2);
          await executeTool(toolName, toolArgs);
        } else {
          console.error(`❌ Error: Unknown tool '${toolName}'`);
          console.log('Available tools:');
          Object.keys(VALIDATION_SCHEMAS).forEach(name => console.log(`  - ${name}`));
          process.exit(1);
        }
      } catch (e) {
        console.error(`❌ Error loading tools: ${(e as Error).message}`);
        process.exit(1);
      }
      break;

    default:
      showHelp();
      break;
  }
}

async function executeTool(toolName: string, args: string[]): Promise<void> {
  const { CodeCartographerMCP } = await import('./mcp-server/server.js');
  const server = new CodeCartographerMCP();
  
  // Parse arguments
  const toolArgs = parseToolArgs(args);
  
  try {
    // Initialize components (db, etc.)
    await server.initializeForTesting();
    
    // Execute
    const result = await server.routeToolCall(toolName, toolArgs);
    
    // Output
    console.log(JSON.stringify(result, null, 2));
  } catch (error: any) {
     console.error(`❌ Tool execution failed: ${error.message}`);
     process.exit(1);
  } finally {
     await server.stop(); 
  }
}

function parseToolArgs(args: string[]): Record<string, any> {
  const parsed: Record<string, any> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const nextArg = args[i + 1];
      
      if (nextArg && !nextArg.startsWith('--')) {
        // It's a key-value pair
        parsed[key] = parseValue(nextArg);
        i++; // Skip next arg
      } else {
        // It's a boolean flag
        parsed[key] = true;
      }
    }
  }
  return parsed;
}

function parseValue(val: string): any {
  if (val === 'true') return true;
  if (val === 'false') return false;
  const num = Number(val);
  if (!isNaN(num)) return num;
  try {
    if (val.startsWith('{') || val.startsWith('[')) {
        return JSON.parse(val);
    }
  } catch (e) {
    // ignore
  }
  return val;
}

async function startWatcher(path: string): Promise<void> {
  console.log(`Starting file watcher for: ${path}`);

  // Initialize components
  const database = new SQLiteDatabase(config.getDatabasePath(path));
  const vectorDB = new SemanticVectorDB(); // Uses local embeddings only
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
      `${path}/**/*.java`,
      `${path}/**/*.php`,
      `${path}/**/*.phtml`,
      `${path}/**/*.inc`
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
  console.log(`🧠 Starting intelligent learning from: ${path}\n`);

  try {
    // Estimate file count for summary
    const glob = (await import('glob')).glob;
    const files = await glob('**/*.{ts,tsx,js,jsx,py,rs,go,java,c,cpp,svelte,vue,php,phtml,inc}', {
      cwd: path,
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**'],
      nodir: true
    });
    const fileCount = files.length;

    // Use shared learning service
    const { LearningService } = await import('./services/learning-service.js');
    const force = process.argv.includes('--force');

    // Simple milestone-based progress tracking
    let lastLoggedPercent = -1;
    const result = await LearningService.learnFromCodebase(path, {
      force,
      progressCallback: (current: number, total: number, message: string) => {
        // Log at 0%, 25%, 50%, 75%, 100% milestones only
        const percent = Math.floor((current / total) * 100);
        const milestone = Math.floor(percent / 25) * 25;

        if (milestone !== lastLoggedPercent && (milestone === 0 || milestone === 25 || milestone === 50 || milestone === 75 || milestone === 100)) {
          console.log(`   ${milestone}% - ${message}`);
          lastLoggedPercent = milestone;
        }
      }
    });

    // Print insights (including any errors)
    if (result.insights && result.insights.length > 0) {
      console.log('\n📝 Learning Details:');
      result.insights.forEach(insight => console.log(insight));
      console.log('');
    }

    // Check if learning failed
    if (!result.success) {
      console.error('❌ Learning failed - see details above');
      process.exit(1);
    }

    // Print summary
    const separator = '━'.repeat(60);
    console.log(`${separator}`);
    console.log(`📊 Concepts:  ${result.conceptsLearned}`);
    console.log(`🔍 Patterns:  ${result.patternsLearned}`);
    console.log(`🗺️  Features:  ${result.featuresLearned}`);
    console.log(`📁 Files:     ${fileCount}`);
    console.log(`${separator}\n`);
  } catch (error) {
    console.error(`❌ Learning failed: ${error}`);
  } finally {
    // Force process exit to ensure cleanup of any remaining resources
    process.exit(0);
  }
}

async function analyzeCodebase(path: string): Promise<void> {
  console.log(`Analyzing codebase: ${path}`);

  const database = new SQLiteDatabase(config.getDatabasePath(path));
  const vectorDB = new SemanticVectorDB(); // Uses local embeddings only
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
    version: "0.6.0",
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
  run <mcp_tool> [args]    Execute any MCP tool directly (e.g. run health_check)
  version, --version, -v    Show version information

Diagnostic Options (for 'check' command):
  --verbose                Show detailed diagnostic information
  --validate               Validate intelligence data consistency
  --performance            Analyze performance characteristics
  --no-database            Skip database diagnostics
  --no-intelligence        Skip intelligence diagnostics
  --no-filesystem          Skip filesystem diagnostics

Available MCP Tools (partial list):
  run analyze_codebase --path <path>
  run search_codebase --query <query>
  run learn_codebase_intelligence --path <path>
  run get_semantic_insights --query <query>
  run get_project_blueprint --path <path>
  run health_check
  
Examples:
  in-memoria setup --interactive    # Recommended for first-time setup
  in-memoria server
  in-memoria check --verbose       # Full diagnostics with details
  in-memoria check --validate      # Check data integrity
  in-memoria watch ./src
  in-memoria learn ./my-project
  in-memoria run analyze_codebase --path ./src
  in-memoria run search_codebase --query "database connection"

For more information, visit: https://github.com/pi22by7/in-memoria
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
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
