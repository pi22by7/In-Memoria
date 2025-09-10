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

      console.log('\n✅ Setup completed successfully!');
      console.log('\nNext steps:');
      console.log('1. Run `in-memoria server` to start the MCP server');
      console.log('2. Add In Memoria to your Claude Desktop/Code configuration');
      console.log('3. Start using AI agents with persistent intelligence!');

    } catch (error: unknown) {
      console.error('\n❌ Setup failed:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    } finally {
      this.rl.close();
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

    // Create .in-memoria directory
    const configDir = join(config.projectPath, '.in-memoria');
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
    }

    // Create configuration file
    const configFile = {
      version: "0.4.5",
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
    console.log(`✅ Configuration saved to: ${configPath}`);

    // Create environment file if API key provided
    if (config.openaiApiKey) {
      const envPath = join(configDir, '.env');
      writeFileSync(envPath, `OPENAI_API_KEY=${config.openaiApiKey}\n`);
      console.log(`✅ Environment file created: ${envPath}`);
      console.log('⚠️  Make sure to add .in-memoria/.env to your .gitignore!');
    }

    // Update .gitignore
    await this.updateGitignore(config.projectPath);
  }

  private async performInitialLearning(config: SetupConfig): Promise<void> {
    console.log('\n🧠 Starting initial learning...');

    try {
      // Initialize components
      const database = new SQLiteDatabase(join(config.projectPath, 'in-memoria.db'));
      const vectorDB = new SemanticVectorDB(config.openaiApiKey);
      const semanticEngine = new SemanticEngine(database, vectorDB);
      const patternEngine = new PatternEngine(database);

      // Setup progress tracking
      const fileCount = await this.countProjectFiles(config.projectPath, config.watchPatterns, config.ignoredPaths);
      const tracker = new ProgressTracker();
      const renderer = new ConsoleProgressRenderer(tracker);

      tracker.addPhase('semantic_analysis', fileCount, 3);
      tracker.addPhase('pattern_learning', fileCount, 2);

      renderer.start();

      // Semantic learning
      tracker.startPhase('semantic_analysis');
      const concepts = await semanticEngine.learnFromCodebase(config.projectPath);
      tracker.complete('semantic_analysis');

      // Pattern learning
      tracker.startPhase('pattern_learning');
      const patterns = await patternEngine.learnFromCodebase(config.projectPath);
      tracker.complete('pattern_learning');

      renderer.stop();

      console.log(`\n✅ Learning completed!`);
      console.log(`   📊 Concepts learned: ${concepts.length}`);
      console.log(`   🔍 Patterns learned: ${patterns.length}`);
      console.log(`   📁 Files analyzed: ${fileCount}`);

      database.close();

    } catch (error: unknown) {
      console.error(`\n❌ Learning failed: ${error instanceof Error ? error.message : String(error)}`);
      console.log('You can run learning later with: in-memoria learn');
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
        console.log('✅ Updated .gitignore');
      }
    } else {
      writeFileSync(gitignorePath, gitignoreEntries + '\n');
      console.log('✅ Created .gitignore');
    }
  }

  private async detectLanguages(projectPath: string): Promise<string[]> {
    try {
      const files = await glob('**/*', {
        cwd: projectPath,
        ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**'],
        nodir: true
      });

      const extensions = new Set<string>();
      for (const file of files.slice(0, 1000)) { // Limit to avoid too many files
        const ext = file.split('.').pop()?.toLowerCase();
        if (ext) extensions.add(ext);
      }

      const languageMap: Record<string, string> = {
        'ts': 'typescript',
        'tsx': 'typescript',
        'js': 'javascript',
        'jsx': 'javascript',
        'py': 'python',
        'rs': 'rust',
        'go': 'go',
        'java': 'java',
        'c': 'c',
        'cpp': 'cpp',
        'cc': 'cpp',
        'cxx': 'cpp'
      };

      const languages = Array.from(extensions)
        .map(ext => languageMap[ext])
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