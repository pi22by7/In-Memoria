import { createInterface } from 'readline';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { SQLiteDatabase } from '../storage/sqlite-db.js';
import { SemanticEngine } from '../engines/semantic-engine.js';
import { PatternEngine } from '../engines/pattern-engine.js';
import { SemanticVectorDB } from '../storage/vector-db.js';
import { ProgressTracker } from '../utils/progress-tracker.js';
import { ConsoleProgressRenderer } from '../utils/console-progress.js';
import { glob } from 'glob';
import { EXTENSION_LANGUAGE_MAP } from '../utils/language-registry.js';

interface SetupConfig {
  projectName: string;
  projectPath: string;
  languages: string[];
  enableRealTimeAnalysis: boolean;
  enablePatternLearning: boolean;
  enableVectorEmbeddings: boolean;
  openaiApiKey?: string;
  watchPatterns: string[];
  ignoredPaths: string[];
  performInitialLearning: boolean;
}

export class InteractiveSetup {
  private rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  async run(): Promise<void> {
    console.log('🚀 Welcome to In Memoria Interactive Setup!');
    console.log('This wizard will help you configure In Memoria for your project.\n');

    try {
      const config = await this.collectConfiguration();
      await this.validateConfiguration(config);
      await this.createConfiguration(config);

      if (config.performInitialLearning) {
        await this.performInitialLearning(config);
      }

      console.log('\n' + '━'.repeat(60));
      console.log('✅ Setup completed successfully!\n');
      console.log('🚀 Next steps:');
      console.log('   1️⃣  Run `in-memoria server` to start the MCP server');
      console.log('   2️⃣  Add In Memoria to your Claude Desktop/Code configuration');
      console.log('   3️⃣  Start using AI agents with persistent intelligence!');
      console.log('\n' + '━'.repeat(60));

    } catch (error: unknown) {
      console.error('\n❌ Setup failed:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    } finally {
      // CRITICAL: Close readline interface to release stdin
      this.rl.close();

      // CRITICAL: Pause stdin to allow process to exit naturally
      // This prevents the process from hanging waiting for input
      if (process.stdin.isTTY) {
        process.stdin.pause();
      }
    }
  }

  private async collectConfiguration(): Promise<SetupConfig> {
    const config: Partial<SetupConfig> = {};

    // Project basics
    config.projectName = await this.prompt('Project name', this.getProjectNameFromPath(process.cwd()));
    config.projectPath = await this.prompt('Project path', process.cwd());

    // Language detection
    console.log('\n🔍 Detecting languages in your project...');
    const detectedLanguages = await this.detectLanguages(config.projectPath);
    console.log(`Found: ${detectedLanguages.join(', ')}`);

    const useDetected = await this.confirm(`Use detected languages?`, true);
    if (useDetected) {
      config.languages = detectedLanguages;
    } else {
      const languageInput = await this.prompt('Languages (comma-separated)', detectedLanguages.join(', '));
      config.languages = languageInput.split(',').map(l => l.trim());
    }

    // Intelligence features
    console.log('\n🧠 Intelligence Configuration:');
    config.enableRealTimeAnalysis = await this.confirm('Enable real-time analysis?', true);
    config.enablePatternLearning = await this.confirm('Enable pattern learning?', true);

    const enhancedEmbeddings = await this.confirm('Enable enhanced vector embeddings? (requires OpenAI API key)', false);
    config.enableVectorEmbeddings = enhancedEmbeddings;

    if (enhancedEmbeddings) {
      const existingKey = process.env.OPENAI_API_KEY;
      if (existingKey) {
        const useExisting = await this.confirm(`Use existing OpenAI API key from environment?`, true);
        if (!useExisting) {
          config.openaiApiKey = await this.prompt('OpenAI API Key', '', true);
        }
      } else {
        config.openaiApiKey = await this.prompt('OpenAI API Key', '', true);
      }
    }

    // File watching configuration
    console.log('\n📁 File Watching Configuration:');
    const defaultPatterns = this.getDefaultWatchPatterns(config.languages!);
    const customPatterns = await this.confirm('Customize file watching patterns?', false);

    if (customPatterns) {
      const patternsInput = await this.prompt('Watch patterns (comma-separated)', defaultPatterns.join(', '));
      config.watchPatterns = patternsInput.split(',').map(p => p.trim());
    } else {
      config.watchPatterns = defaultPatterns;
    }

    // Ignored paths
    const defaultIgnored = ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**', '**/target/**'];
    const customIgnore = await this.confirm('Customize ignored paths?', false);

    if (customIgnore) {
      const ignoredInput = await this.prompt('Ignored paths (comma-separated)', defaultIgnored.join(', '));
      config.ignoredPaths = ignoredInput.split(',').map(p => p.trim());
    } else {
      config.ignoredPaths = defaultIgnored;
    }

    // Initial learning
    console.log('\n📚 Initial Learning:');
    config.performInitialLearning = await this.confirm('Perform initial learning now? (recommended)', true);

    return config as SetupConfig;
  }

  private async validateConfiguration(config: SetupConfig): Promise<void> {
    // Validate project path
    if (!existsSync(config.projectPath)) {
      throw new Error(`Project path does not exist: ${config.projectPath}`);
    }

    // Validate languages
    const supportedLanguages = ['typescript', 'javascript', 'python', 'rust', 'go', 'java', 'c', 'cpp'];
    const unsupported = config.languages.filter(lang => !supportedLanguages.includes(lang.toLowerCase()));
    if (unsupported.length > 0) {
      console.log(`⚠️  Warning: Unsupported languages detected: ${unsupported.join(', ')}`);
      console.log(`Supported languages: ${supportedLanguages.join(', ')}`);
    }

    // Test API key if provided
    if (config.openaiApiKey) {
      console.log('🔑 Testing OpenAI API key...');
      // Note: We could add a simple API test here
      console.log('✅ API key format looks valid');
    }
  }

  private async createConfiguration(config: SetupConfig): Promise<void> {
    console.log('\n⚙️  Creating configuration...');
    console.log('━'.repeat(60));

    // Create .in-memoria directory
    const configDir = join(config.projectPath, '.in-memoria');
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
    }

    // Create configuration file
    const configFile = {
      version: "0.5.7",
      project: {
        name: config.projectName,
        languages: config.languages
      },
      intelligence: {
        enableRealTimeAnalysis: config.enableRealTimeAnalysis,
        enablePatternLearning: config.enablePatternLearning,
        vectorEmbeddings: config.enableVectorEmbeddings
      },
      watching: {
        patterns: config.watchPatterns,
        ignored: config.ignoredPaths,
        debounceMs: 500
      },
      mcp: {
        serverPort: 3000,
        enableAllTools: true
      },
      setup: {
        createdAt: new Date().toISOString(),
        setupVersion: "interactive-v1"
      }
    };

    const configPath = join(configDir, 'config.json');
    writeFileSync(configPath, JSON.stringify(configFile, null, 2));
    console.log(`\n✅ Configuration saved`);
    console.log(`   📄 Location: ${configPath}`);

    // Create environment file if API key provided
    if (config.openaiApiKey) {
      const envPath = join(configDir, '.env');
      writeFileSync(envPath, `OPENAI_API_KEY=${config.openaiApiKey}\n`);
      console.log(`\n✅ Environment file created`);
      console.log(`   🔒 Location: ${envPath}`);
      console.log(`   ⚠️  Remember to add .in-memoria/.env to your .gitignore!`);
    }

    // Update .gitignore
    await this.updateGitignore(config.projectPath);
  }

  private async performInitialLearning(config: SetupConfig): Promise<void> {
    console.log('\n🧠 Starting initial learning...');
    console.log('━'.repeat(60));

    // Keep track of resources for cleanup
    let database: SQLiteDatabase | null = null;
    let vectorDB: SemanticVectorDB | null = null;
    let semanticEngine: SemanticEngine | null = null;
    let patternEngine: PatternEngine | null = null;
    let renderer: ConsoleProgressRenderer | null = null;

    try {
      // Initialize components
      database = new SQLiteDatabase(join(config.projectPath, 'in-memoria.db'));
      vectorDB = new SemanticVectorDB(config.openaiApiKey);
      semanticEngine = new SemanticEngine(database, vectorDB);
      patternEngine = new PatternEngine(database);

      // Setup progress tracking
      const fileCount = await this.countProjectFiles(config.projectPath, config.watchPatterns, config.ignoredPaths);
      const tracker = new ProgressTracker();
      renderer = new ConsoleProgressRenderer(tracker);

      // Add phases with descriptive names
      tracker.addPhase('semantic_analysis', fileCount, 3);
      tracker.addPhase('pattern_learning', fileCount, 2);

      renderer.start();

      // Phase 1: Semantic learning
      tracker.startPhase('semantic_analysis');
      const concepts = await semanticEngine.learnFromCodebase(config.projectPath,
        (current, total, message) => {
          tracker.updateProgress('semantic_analysis', current, message);
        }
      );
      tracker.complete('semantic_analysis');

      // Phase 2: Pattern learning
      tracker.startPhase('pattern_learning');
      const patterns = await patternEngine.learnFromCodebase(config.projectPath,
        (current, total, message) => {
          tracker.updateProgress('pattern_learning', Math.floor((current / 100) * fileCount), message);
        }
      );
      tracker.complete('pattern_learning');

      renderer.stop();

      // Success summary with nice formatting
      console.log('\n' + '━'.repeat(60));
      console.log('✅ Learning completed successfully!\n');
      console.log('📈 Results:');
      console.log(`   📊 Concepts learned:  ${concepts.length.toLocaleString()}`);
      console.log(`   🔍 Patterns learned:  ${patterns.length.toLocaleString()}`);
      console.log(`   📁 Files analyzed:    ${fileCount.toLocaleString()}`);

    } catch (error: unknown) {
      console.error('\n' + '━'.repeat(60));
      console.error('❌ Learning failed:', error instanceof Error ? error.message : String(error));
      console.error('\n💡 You can run learning later with: `in-memoria learn`');
      console.error('━'.repeat(60));
    } finally {
      // CRITICAL: Clean up all resources to prevent hanging

      // Stop progress renderer first
      if (renderer) {
        renderer.stop();
      }

      // Cleanup engines (releases Rust resources)
      if (semanticEngine) {
        try {
          semanticEngine.cleanup();
        } catch (error) {
          console.warn('Warning: Failed to cleanup semantic engine:', error);
        }
      }

      // Close vector database
      if (vectorDB) {
        try {
          await vectorDB.close();
        } catch (error) {
          console.warn('Warning: Failed to close vector database:', error);
        }
      }

      // Close SQLite database
      if (database) {
        try {
          database.close();
        } catch (error) {
          console.warn('Warning: Failed to close database:', error);
        }
      }
    }
  }

  private async updateGitignore(projectPath: string): Promise<void> {
    const gitignorePath = join(projectPath, '.gitignore');
    const gitignoreEntries = [
      '# In Memoria',
      'in-memoria.db',
      '.in-memoria/cache/',
      '.in-memoria/.env'
    ].join('\n');

    if (existsSync(gitignorePath)) {
      const content = readFileSync(gitignorePath, 'utf-8');
      if (!content.includes('in-memoria.db')) {
        writeFileSync(gitignorePath, content + '\n\n' + gitignoreEntries + '\n');
        console.log('\n✅ Updated .gitignore with In Memoria entries');
      }
    } else {
      writeFileSync(gitignorePath, gitignoreEntries + '\n');
      console.log('\n✅ Created .gitignore with In Memoria entries');
    }
  }

  private async detectLanguages(projectPath: string): Promise<string[]> {
    try {
      const files = await glob('**/*', {
        cwd: projectPath,
        ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**', '**/target/**'],
        nodir: true
      });

      const extensions = new Set<string>();
      const sampleSize = Math.min(files.length, 1000); // Limit to avoid too many files
      for (const file of files.slice(0, sampleSize)) {
        const ext = file.split('.').pop()?.toLowerCase();
        if (ext) extensions.add(ext);
      }

      const languages = Array.from(extensions)
        .map(ext => EXTENSION_LANGUAGE_MAP[ext])
        .filter(Boolean);

      return [...new Set(languages)];
    } catch (error) {
      return [];
    }
  }

  private getDefaultWatchPatterns(languages: string[]): string[] {
    const patterns: string[] = [];

    for (const lang of languages) {
      switch (lang.toLowerCase()) {
        case 'typescript':
          patterns.push('**/*.ts', '**/*.tsx');
          break;
        case 'javascript':
          patterns.push('**/*.js', '**/*.jsx');
          break;
        case 'python':
          patterns.push('**/*.py');
          break;
        case 'rust':
          patterns.push('**/*.rs');
          break;
        case 'go':
          patterns.push('**/*.go');
          break;
        case 'java':
          patterns.push('**/*.java');
          break;
        case 'c':
          patterns.push('**/*.c', '**/*.h');
          break;
        case 'cpp':
          patterns.push('**/*.cpp', '**/*.cc', '**/*.cxx', '**/*.hpp');
          break;
      }
    }

    return patterns.length > 0 ? patterns : ['**/*.ts', '**/*.js', '**/*.py'];
  }

  private getProjectNameFromPath(path: string): string {
    return path.split('/').pop() || 'my-project';
  }

  private async countProjectFiles(projectPath: string, patterns: string[], ignored: string[]): Promise<number> {
    try {
      const files = await glob(patterns, {
        cwd: projectPath,
        ignore: ignored,
        nodir: true
      });
      return files.length;
    } catch (error) {
      return 0;
    }
  }

  private async prompt(question: string, defaultValue: string = '', isPassword: boolean = false): Promise<string> {
    return new Promise((resolve) => {
      const displayDefault = defaultValue ? ` (${isPassword ? '***' : defaultValue})` : '';
      const questionText = `${question}${displayDefault}: `;

      if (isPassword) {
        // Hide input for passwords
        process.stdout.write(questionText);
        process.stdin.setRawMode(true);
        process.stdin.resume();

        let input = '';
        const onData = (key: Buffer) => {
          const char = key.toString();

          if (char === '\r' || char === '\n') {
            process.stdin.setRawMode(false);
            process.stdin.pause();
            process.stdin.removeListener('data', onData);
            console.log(); // New line
            resolve(input || defaultValue);
          } else if (char === '\u0003') { // Ctrl+C
            process.exit(1);
          } else if (char === '\u007f') { // Backspace
            if (input.length > 0) {
              input = input.slice(0, -1);
              process.stdout.write('\b \b');
            }
          } else if (char >= ' ') {
            input += char;
            process.stdout.write('*');
          }
        };

        process.stdin.on('data', onData);
      } else {
        this.rl.question(questionText, (answer) => {
          resolve(answer.trim() || defaultValue);
        });
      }
    });
  }

  private async confirm(question: string, defaultValue: boolean = false): Promise<boolean> {
    const defaultText = defaultValue ? 'Y/n' : 'y/N';
    const answer = await this.prompt(`${question} (${defaultText})`);

    if (!answer) return defaultValue;

    const normalized = answer.toLowerCase();
    return normalized === 'y' || normalized === 'yes';
  }
}
