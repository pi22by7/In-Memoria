import { PatternLearner, BlueprintAnalyzer } from '../rust-bindings.js';
import { SQLiteDatabase, DeveloperPattern } from '../storage/sqlite-db.js';
import { FileChange } from '../watchers/file-watcher.js';
import { CircuitBreaker, createRustAnalyzerCircuitBreaker } from '../utils/circuit-breaker.js';
import { nanoid } from 'nanoid';

export interface PatternExtractionResult {
  type: string;
  description: string;
  frequency: number;
}

export interface PatternAnalysisResult {
  detected: string[];
  violations: string[];
  recommendations: string[];
  learned?: Array<{
    id: string;
    type: string;
    content: Record<string, any>;
    frequency: number;
    confidence: number;
  }>;
}

export interface RelevantPattern {
  patternId: string;
  patternType: string;
  patternContent: Record<string, any>;
  frequency: number;
  contexts: string[];
  examples: Array<{ code: string }>;
  confidence: number;
}

export class PatternEngine {
  private rustLearner: InstanceType<typeof PatternLearner>;
  private rustCircuitBreaker: CircuitBreaker;

  constructor(private database: SQLiteDatabase) {
    this.rustLearner = new PatternLearner();
    this.rustCircuitBreaker = createRustAnalyzerCircuitBreaker();
  }

  async extractPatterns(path: string): Promise<PatternExtractionResult[]> {
    try {
      const patterns = await this.rustLearner.extractPatterns(path);
      return patterns.map((p: any) => ({
        type: p.patternType,
        description: p.description,
        frequency: p.frequency
      }));
    } catch (error) {
      console.error('Pattern extraction error:', error);
      return this.fallbackPatternExtraction(path);
    }
  }

  async analyzeFilePatterns(filePath: string, content: string): Promise<Array<{
    type: string;
    description: string;
    confidence: number;
  }>> {
    try {
      // Use the change analysis to detect patterns in the file
      const change = {
        type: 'change' as const,
        path: filePath,
        content,
        language: this.detectLanguage(filePath),
        hash: this.generateContentHash(content)
      };

      const analysis = await this.analyzeFileChange(change);
      
      return analysis.detected.map(patternType => {
        const pattern = this.getPatternByType(patternType);
        return {
          type: patternType,
          description: pattern?.description || `${patternType} pattern detected`,
          confidence: pattern?.confidence || 0.7
        };
      });
    } catch (error) {
      console.error('File pattern analysis error:', error);
      return this.fallbackFilePatternAnalysis(content, filePath);
    }
  }

  private detectLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      'ts': 'typescript',
      'tsx': 'typescript', 
      'js': 'javascript',
      'jsx': 'javascript',
      'py': 'python',
      'rs': 'rust',
      'go': 'go',
      'java': 'java'
    };
    return languageMap[ext || ''] || 'unknown';
  }

  private generateContentHash(content: string): string {
    // Simple hash function for content
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(16);
  }

  private getPatternByType(patternType: string): { description: string; confidence: number } | null {
    const patternDescriptions: Record<string, { description: string; confidence: number }> = {
      'camelCase_function_naming': { description: 'Functions use camelCase naming convention', confidence: 0.8 },
      'PascalCase_class_naming': { description: 'Classes use PascalCase naming convention', confidence: 0.8 },
      'snake_case_naming': { description: 'Variables use snake_case naming convention', confidence: 0.7 },
      'testing': { description: 'Testing pattern with describe/it blocks', confidence: 0.9 },
      'api_design': { description: 'RESTful API design pattern', confidence: 0.7 },
      'dependency_injection': { description: 'Dependency injection pattern detected', confidence: 0.8 },
      'factory': { description: 'Factory pattern for object creation', confidence: 0.8 },
      'singleton': { description: 'Singleton pattern implementation', confidence: 0.9 },
      'observer': { description: 'Observer pattern for event handling', confidence: 0.7 }
    };
    
    return patternDescriptions[patternType] || null;
  }

  private fallbackFilePatternAnalysis(content: string, filePath: string): Array<{
    type: string;
    description: string;
    confidence: number;
  }> {
    const patterns: Array<{ type: string; description: string; confidence: number }> = [];
    
    // Check for naming conventions
    if (/function\s+[a-z][a-zA-Z]*/.test(content)) {
      patterns.push({
        type: 'camelCase_function_naming',
        description: 'Functions use camelCase naming convention',
        confidence: 0.8
      });
    }
    
    if (/class\s+[A-Z][a-zA-Z]*/.test(content)) {
      patterns.push({
        type: 'PascalCase_class_naming', 
        description: 'Classes use PascalCase naming convention',
        confidence: 0.8
      });
    }
    
    // Check for testing patterns
    if (/describe|it|test|expect/.test(content)) {
      patterns.push({
        type: 'testing',
        description: 'Testing pattern with describe/it blocks',
        confidence: 0.9
      });
    }
    
    // Check for API patterns
    if (/app\.(get|post|put|delete)/.test(content) || /router\.(get|post|put|delete)/.test(content)) {
      patterns.push({
        type: 'api_design',
        description: 'RESTful API design pattern',
        confidence: 0.7
      });
    }
    
    // Check for dependency injection
    if (/constructor\([^)]*private/.test(content) || /@Injectable/.test(content)) {
      patterns.push({
        type: 'dependency_injection',
        description: 'Dependency injection pattern detected',
        confidence: 0.8
      });
    }
    
    return patterns;
  }

  async learnFromCodebase(path: string, progressCallback?: (current: number, total: number, message: string) => void): Promise<Array<{
    id: string;
    type: string;
    content: Record<string, any>;
    frequency: number;
    confidence: number;
    contexts: string[];
    examples: Array<{ code: string }>;
  }>> {
    try {
      if (progressCallback) {
        progressCallback(1, 100, 'Starting pattern analysis...');
      }
      
      // Create a progress indicator while Rust code runs
      let progressInterval: NodeJS.Timeout | null = null;
      let currentProgress = 1;
      
      if (progressCallback) {
        progressInterval = setInterval(() => {
          // Simulate progress while waiting (max 90%)
          if (currentProgress < 90) {
            currentProgress += 2;
            progressCallback(currentProgress, 100, 'Analyzing code patterns...');
          }
        }, 1000); // Update every second
      }
      
      let patterns: any[];
      try {
        patterns = await this.rustLearner.learnFromCodebase(path);
      } finally {
        // CRITICAL: Clear interval to prevent hanging
        if (progressInterval !== null) {
          clearInterval(progressInterval);
        }
      }
      
      if (progressCallback) {
        progressCallback(90, 100, `Extracted ${patterns.length} patterns, storing...`);
      }
      
      const result = patterns.map((p: any) => ({
        id: p.id,
        type: p.patternType,
        content: { description: p.description },
        frequency: p.frequency,
        confidence: p.confidence,
        contexts: p.contexts,
        examples: p.examples.map((ex: any) => ({ code: ex.code }))
      }));

      // Store patterns in database with progress updates
      const totalPatterns = result.length;
      let storedPatterns = 0;
      
      for (const pattern of result) {
        this.database.insertDeveloperPattern({
          patternId: pattern.id,
          patternType: pattern.type,
          patternContent: pattern.content,
          frequency: pattern.frequency,
          contexts: pattern.contexts,
          examples: pattern.examples,
          confidence: pattern.confidence
        });
        
        storedPatterns++;
        // Report every 5 patterns or at completion
        if (progressCallback && totalPatterns > 0 && (storedPatterns % 5 === 0 || storedPatterns === totalPatterns)) {
          const progress = 90 + Math.floor((storedPatterns / totalPatterns) * 10);
          progressCallback(progress, 100, `Stored ${storedPatterns}/${totalPatterns} patterns`);
        }
      }

      console.log(`✅ Pattern learning completed: ${result.length} patterns discovered`);
      return result;
    } catch (error) {
      console.error('❌ Pattern learning failed:', error);
      console.warn('🔄 Pattern learning degraded to basic regex detection:');
      console.warn('   • Advanced ML pattern detection unavailable');
      console.warn('   • Rust pattern learning engine not accessible');
      console.warn('   • Using simple heuristic-based pattern detection');
      console.warn(`   • Analysis quality significantly reduced for: ${path}`);
      
      if (progressCallback) {
        progressCallback(100, 100, 'Pattern learning failed (degraded mode)');
      }
      
      // Return empty array but with clear warning that this is a degraded state
      return [];
    }
  }

  async analyzeFileChange(change: FileChange): Promise<PatternAnalysisResult> {
    try {
      const changeData = JSON.stringify({
        type: change.type,
        path: change.path,
        content: change.content,
        language: change.language
      });

      const analysis = await this.rustLearner.analyzeFileChange(changeData);
      
      return {
        detected: analysis.detected,
        violations: analysis.violations,
        recommendations: analysis.recommendations,
        learned: analysis.learned?.map((p: any) => ({
          id: p.id,
          type: p.patternType,
          content: { description: p.description },
          frequency: p.frequency,
          confidence: p.confidence
        }))
      };
    } catch (error) {
      console.error('File change analysis error:', error);
      return this.fallbackChangeAnalysis(change);
    }
  }

  async findRelevantPatterns(
    problemDescription: string,
    currentFile?: string,
    selectedCode?: string
  ): Promise<RelevantPattern[]> {
    // console.error(`\n🔍 findRelevantPatterns called`);
    // console.error(`   problemDescription: "${problemDescription}"`);
    // console.error(`   currentFile: ${currentFile || 'undefined'}`);
    // console.error(`   selectedCode: ${selectedCode ? `${selectedCode.length} chars` : 'undefined'}`);

    // Get all patterns from database
    const dbPatterns = this.database.getDeveloperPatterns();
    // console.error(`   Retrieved ${dbPatterns.length} patterns from database`);

    if (dbPatterns.length === 0) {
      // console.error(`   ⚠️  No patterns in database, returning empty array`);
      return [];
    }

    // Extract keywords from problem description
    const keywords = this.extractKeywords(problemDescription.toLowerCase());
    // console.error(`   Extracted keywords: ${keywords.join(', ')}`);

    // Score each pattern based on relevance
    const scoredPatterns = dbPatterns.map(pattern => {
      let score = 0;
      const patternContent = JSON.stringify(pattern.patternContent).toLowerCase();
      const patternType = pattern.patternType.toLowerCase();

      // Match keywords in pattern content and type
      for (const keyword of keywords) {
        if (patternType.includes(keyword)) score += 0.3;
        if (patternContent.includes(keyword)) score += 0.2;
      }

      // Boost score based on pattern confidence and frequency
      score += pattern.confidence * 0.3;
      score += Math.min(pattern.frequency / 10, 1.0) * 0.2;

      return { pattern, score };
    });

    // Filter patterns with score above threshold and sort by score
    const relevantPatterns = scoredPatterns
      .filter(({ score }) => score > 0.3)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10) // Limit to top 10 patterns
      .map(({ pattern, score }) => {
        // console.error(`   ✓ Pattern "${pattern.patternType}" scored ${score.toFixed(2)}`);

        return {
          patternId: pattern.patternId,
          patternType: pattern.patternType,
          patternContent: pattern.patternContent,
          frequency: pattern.frequency,
          contexts: pattern.contexts,
          examples: pattern.examples.map(ex => ({ code: ex.code })),
          confidence: pattern.confidence
        };
      });

    // console.error(`   Found ${relevantPatterns.length} relevant patterns\n`);
    return relevantPatterns;
  }

  private extractKeywords(text: string): string[] {
    // Remove common stop words and extract meaningful keywords
    const stopWords = new Set(['a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could',
      'to', 'from', 'in', 'on', 'at', 'by', 'for', 'with', 'about', 'as', 'of', 'and', 'or', 'but']);

    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove punctuation
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word));
  }

  async predictApproach(
    problemDescription: string,
    context: Record<string, any>
  ): Promise<{
    approach: string;
    confidence: number;
    reasoning: string;
    patterns: string[];
    complexity: 'low' | 'medium' | 'high';
  }> {
    try {
      // Convert context values to strings for Rust binding
      const stringContext: Record<string, string> = {};
      for (const [key, value] of Object.entries(context)) {
        stringContext[key] = typeof value === 'string' ? value : JSON.stringify(value);
      }

      const prediction = await this.rustLearner.predictApproach(problemDescription, stringContext);
      
      return {
        approach: prediction.approach,
        confidence: prediction.confidence,
        reasoning: prediction.reasoning,
        patterns: prediction.patterns,
        complexity: prediction.complexity as 'low' | 'medium' | 'high'
      };
    } catch (error) {
      console.error('Approach prediction error:', error);
      return this.fallbackApproachPrediction(problemDescription);
    }
  }

  async learnFromAnalysis(analysisData: any): Promise<void> {
    try {
      await this.rustLearner.learnFromAnalysis(JSON.stringify(analysisData));
      
      // Update local pattern database based on analysis
      if (analysisData.patterns && analysisData.patterns.detected) {
        for (const patternType of analysisData.patterns.detected) {
          const existingPatterns = this.database.getDeveloperPatterns(patternType);
          
          if (existingPatterns.length > 0) {
            // Increment frequency of detected pattern
            const pattern = existingPatterns[0];
            this.database.insertDeveloperPattern({
              ...pattern,
              frequency: pattern.frequency + 1,
              confidence: Math.min(1.0, pattern.confidence + 0.05)
            });
          } else {
            // Create new pattern entry
            this.database.insertDeveloperPattern({
              patternId: nanoid(),
              patternType,
              patternContent: { 
                description: `Pattern detected in ${analysisData.change?.path || 'unknown file'}`,
                detectedAt: new Date().toISOString()
              },
              frequency: 1,
              contexts: [analysisData.change?.language || 'unknown'],
              examples: [],
              confidence: 0.3
            });
          }
        }
      }
    } catch (error) {
      console.error('Failed to learn from analysis:', error);
    }
  }

  async updateFromChange(change: FileChange): Promise<void> {
    try {
      const changeData = JSON.stringify({
        type: change.type,
        path: change.path,
        content: change.content,
        language: change.language,
        hash: change.hash
      });

      await this.rustLearner.updateFromChange(changeData);
      
      // Update pattern usage statistics
      await this.updatePatternUsageStats(change);
    } catch (error) {
      console.error('Failed to update from change:', error);
    }
  }

  async getPatternsByType(patternType: string): Promise<DeveloperPattern[]> {
    return this.database.getDeveloperPatterns(patternType);
  }

  async getAllPatterns(): Promise<DeveloperPattern[]> {
    return this.database.getDeveloperPatterns();
  }

  async getPatternStatistics(): Promise<{
    totalPatterns: number;
    byType: Record<string, number>;
    mostUsed: DeveloperPattern[];
    recentlyUsed: DeveloperPattern[];
  }> {
    const allPatterns = this.database.getDeveloperPatterns();
    
    const byType: Record<string, number> = {};
    for (const pattern of allPatterns) {
      byType[pattern.patternType] = (byType[pattern.patternType] || 0) + 1;
    }

    const mostUsed = allPatterns
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10);

    const recentlyUsed = allPatterns
      .sort((a, b) => b.lastSeen.getTime() - a.lastSeen.getTime())
      .slice(0, 10);

    return {
      totalPatterns: allPatterns.length,
      byType,
      mostUsed,
      recentlyUsed
    };
  }

  private fallbackPatternExtraction(path: string): PatternExtractionResult[] {
    // Pattern extraction using TypeScript analysis
    return [
      {
        type: 'naming_convention',
        description: 'Consistent naming convention detected',
        frequency: 1
      }
    ];
  }

  private fallbackChangeAnalysis(change: FileChange): PatternAnalysisResult {
    const detected: string[] = [];
    const violations: string[] = [];
    const recommendations: string[] = [];

    // Simple pattern detection based on file content
    if (change.content) {
      // Check for naming conventions
      if (/function\s+[a-z][a-zA-Z]*/.test(change.content)) {
        detected.push('camelCase_function_naming');
      }
      
      if (/class\s+[A-Z][a-zA-Z]*/.test(change.content)) {
        detected.push('PascalCase_class_naming');
      }

      // Check for potential violations
      if (/function\s+[A-Z]/.test(change.content)) {
        violations.push('function_naming_violation');
        recommendations.push('Use camelCase for function names');
      }
    }

    return { detected, violations, recommendations };
  }

  private fallbackRelevantPatterns(problemDescription: string): RelevantPattern[] {
    // Simple keyword-based pattern matching
    const patterns: RelevantPattern[] = [];
    
    if (problemDescription.toLowerCase().includes('test')) {
      patterns.push({
        patternId: 'test_pattern',
        patternType: 'testing',
        patternContent: { description: 'Testing pattern recommendation' },
        frequency: 5,
        contexts: ['testing'],
        examples: [{ code: 'describe("test", () => { it("should work", () => {}) })' }],
        confidence: 0.6
      });
    }

    if (problemDescription.toLowerCase().includes('api') || problemDescription.toLowerCase().includes('endpoint')) {
      patterns.push({
        patternId: 'api_pattern',
        patternType: 'api_design',
        patternContent: { description: 'RESTful API pattern' },
        frequency: 8,
        contexts: ['api', 'rest'],
        examples: [{ code: 'app.get("/api/resource", (req, res) => {})' }],
        confidence: 0.7
      });
    }

    return patterns;
  }

  private fallbackApproachPrediction(problemDescription: string): {
    approach: string;
    confidence: number;
    reasoning: string;
    patterns: string[];
    complexity: 'low' | 'medium' | 'high';
  } {
    const wordCount = problemDescription.split(' ').length;
    const complexity = wordCount < 10 ? 'low' : wordCount < 25 ? 'medium' : 'high';
    
    return {
      approach: 'Iterative development with testing',
      confidence: 0.5,
      reasoning: 'Based on problem description length and common patterns',
      patterns: ['testing', 'iterative_development'],
      complexity
    };
  }

  private async updatePatternUsageStats(change: FileChange): Promise<void> {
    if (!change.content || !change.language) return;

    // Track usage of different patterns based on file content
    const patterns = this.database.getDeveloperPatterns();
    
    for (const pattern of patterns) {
      // Check if pattern is used in the changed file
      if (this.isPatternUsedInContent(pattern, change.content, change.language)) {
        // Update last seen time
        this.database.insertDeveloperPattern({
          ...pattern,
          frequency: pattern.frequency + 1
        });
      }
    }
  }

  private isPatternUsedInContent(
    pattern: DeveloperPattern,
    content: string,
    language: string
  ): boolean {
    // Simple heuristic to check if a pattern is used in content
    if (!pattern.contexts.includes(language)) return false;

    // Check for pattern-specific indicators
    switch (pattern.patternType) {
      case 'camelCase_function_naming':
        return /function\s+[a-z][a-zA-Z]*/.test(content);
      case 'PascalCase_class_naming':
        return /class\s+[A-Z][a-zA-Z]*/.test(content);
      case 'testing':
        return /describe|it|test|expect/.test(content);
      default:
        return false;
    }
  }

  /**
   * Build feature map using Rust analyzer with TypeScript fallback
   * Uses CircuitBreaker pattern for graceful degradation
   */
  async buildFeatureMap(projectPath: string): Promise<Array<{
    id: string;
    featureName: string;
    primaryFiles: string[];
    relatedFiles: string[];
    dependencies: string[];
  }>> {
    // Rust implementation
    const rustImplementation = async () => {
      const featureMaps = await BlueprintAnalyzer.buildFeatureMap(projectPath);

      return featureMaps.map((fm: any) => ({
        id: fm.id,
        featureName: fm.featureName || fm.feature_name, // Try camelCase first, fallback to snake_case
        primaryFiles: fm.primaryFiles || fm.primary_files,
        relatedFiles: fm.relatedFiles || fm.related_files,
        dependencies: fm.dependencies,
      }));
    };

    // TypeScript fallback implementation
    const fallbackImplementation = async () => {
      const { access } = await import('fs/promises');
      const { join, relative, resolve } = await import('path');
      const { constants } = await import('fs');

      const featureMap: Array<{
        id: string;
        featureName: string;
        primaryFiles: string[];
        relatedFiles: string[];
        dependencies: string[];
      }> = [];

      try {
        // Validate projectPath
        const resolvedProject = resolve(projectPath);

        const featurePatterns: Record<string, { patterns: string[]; directories: string[] }> = {
          'authentication': {
            patterns: ['**/auth/**', '**/authentication/**', '**/login*', '**/signup*', '**/register*'],
            directories: ['auth', 'authentication']
          },
          'api': {
            patterns: ['**/api/**', '**/routes/**', '**/endpoints/**', '**/controllers/**'],
            directories: ['api', 'routes', 'endpoints', 'controllers']
          },
          'database': {
            patterns: ['**/db/**', '**/database/**', '**/models/**', '**/schemas/**', '**/migrations/**'],
            directories: ['db', 'database', 'models', 'schemas', 'migrations', 'storage']
          },
          'ui-components': {
            patterns: ['**/components/**', '**/ui/**'],
            directories: ['components', 'ui']
          },
          'views': {
            patterns: ['**/views/**', '**/pages/**', '**/screens/**'],
            directories: ['views', 'pages', 'screens']
          },
          'services': {
            patterns: ['**/services/**', '**/api-clients/**'],
            directories: ['services', 'api-clients']
          },
          'utilities': {
            patterns: ['**/utils/**', '**/helpers/**', '**/lib/**'],
            directories: ['utils', 'helpers', 'lib']
          },
          'testing': {
            patterns: ['**/*.test.*', '**/*.spec.*', '**/tests/**', '**/__tests__/**'],
            directories: ['tests', '__tests__', 'test']
          },
          'configuration': {
            patterns: ['**/config/**', '**/.config/**', '**/settings/**'],
            directories: ['config', '.config', 'settings']
          },
          'middleware': {
            patterns: ['**/middleware/**', '**/middlewares/**'],
            directories: ['middleware', 'middlewares']
          }
        };

        for (const [featureName, { directories }] of Object.entries(featurePatterns)) {
          const primaryFiles: string[] = [];
          const relatedFiles: string[] = [];

          for (const dir of directories) {
            const fullPath = join(projectPath, 'src', dir);
            const altPath = join(projectPath, dir);

            for (const checkPath of [fullPath, altPath]) {
              const resolved = resolve(checkPath);

              // Path validation
              if (!resolved.startsWith(resolvedProject)) {
                continue;
              }

              try {
                await access(resolved, constants.F_OK);
                const files = await this.collectFilesInDirectory(resolved, projectPath, 5);

                if (files.length > 0) {
                  primaryFiles.push(...files.slice(0, Math.ceil(files.length / 2)));
                  relatedFiles.push(...files.slice(Math.ceil(files.length / 2)));
                }
              } catch {
                // Directory doesn't exist, skip it
                continue;
              }
            }
          }

          if (primaryFiles.length > 0) {
            featureMap.push({
              id: nanoid(),
              featureName,
              primaryFiles: [...new Set(primaryFiles)],
              relatedFiles: [...new Set(relatedFiles)],
              dependencies: []
            });
          }
        }

        return featureMap;
      } catch (error) {
        console.error('⚠️  Feature mapping error:', error instanceof Error ? error.message : 'Unknown error');
        console.warn('   Feature map may be incomplete');
        return [];
      }
    };

    // Use CircuitBreaker to try Rust first, fall back to TypeScript
    return this.rustCircuitBreaker.execute(
      rustImplementation,
      fallbackImplementation
    );
  }

  /**
   * Collect files from directory (async with depth limit)
   * @param dirPath - Directory to collect files from
   * @param projectPath - Project root path (for relative path calculation)
   * @param maxDepth - Maximum recursion depth
   * @param currentDepth - Current depth (for internal recursion tracking)
   */
  private async collectFilesInDirectory(
    dirPath: string,
    projectPath: string,
    maxDepth: number = 5,
    currentDepth: number = 0
  ): Promise<string[]> {
    // Prevent infinite recursion
    if (currentDepth >= maxDepth) {
      return [];
    }

    const { readdir } = await import('fs/promises');
    const { join, relative } = await import('path');
    const files: string[] = [];

    try {
      const entries = await readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dirPath, entry.name);

        if (entry.isDirectory()) {
          if (!['node_modules', '.git', 'dist', 'build', '.next', '__pycache__', 'venv'].includes(entry.name)) {
            const nestedFiles = await this.collectFilesInDirectory(
              fullPath,
              projectPath,
              maxDepth,
              currentDepth + 1
            );
            files.push(...nestedFiles);
          }
        } else if (entry.isFile()) {
          const ext = entry.name.split('.').pop()?.toLowerCase();
          if (['ts', 'tsx', 'js', 'jsx', 'py', 'rs', 'go', 'java'].includes(ext || '')) {
            files.push(relative(projectPath, fullPath));
          }
        }
      }
    } catch {
      // Ignore errors for individual directories (permission issues, etc.)
    }

    return files;
  }

  /**
   * Route request to files with confidence scoring
   * Returns files ranked by relevance with confidence indicators
   */
  async routeRequestToFiles(
    problemDescription: string,
    projectPath: string
  ): Promise<{
    intendedFeature: string;
    targetFiles: string[];
    workType: 'feature' | 'bugfix' | 'refactor' | 'test';
    suggestedStartPoint: string;
    confidence: number; // 0.0 to 1.0
    reasoning: string; // Why this routing was chosen
  } | null> {
    try {
      const featureMaps = this.database.getFeatureMaps(projectPath);

      // Debug to stderr (visible in MCP logs)
      // console.error(`🔍 Debug routeRequestToFiles: projectPath=${projectPath}, featureMaps=${featureMaps.length}`);
      // if (featureMaps.length > 0) {
      //   console.error(`🔍 Feature names: ${featureMaps.map(f => f.featureName).join(', ')}`);
      // }

      if (featureMaps.length === 0) {
        // console.error('⚠️  No feature maps found - run learning first');
        return null;
      }

      const lowerDesc = problemDescription.toLowerCase();

      // Determine work type (affects confidence slightly)
      let workType: 'feature' | 'bugfix' | 'refactor' | 'test' = 'feature';
      if (lowerDesc.includes('fix') || lowerDesc.includes('bug') || lowerDesc.includes('error')) {
        workType = 'bugfix';
      } else if (lowerDesc.includes('refactor') || lowerDesc.includes('improve') || lowerDesc.includes('optimize')) {
        workType = 'refactor';
      } else if (lowerDesc.includes('test') || lowerDesc.includes('spec')) {
        workType = 'test';
      }

      // Keyword matching with scoring
      const keywordGroups: Record<string, string[]> = {
        'authentication': ['auth', 'login', 'signup', 'register', 'password', 'session'],
        'api': ['api', 'endpoint', 'route', 'controller', 'rest', 'graphql'],
        'database': ['database', 'db', 'model', 'schema', 'migration', 'query', 'sql'],
        'ui-components': ['component', 'ui', 'button', 'form', 'input', 'widget'],
        'views': ['view', 'page', 'screen', 'template', 'layout'],
        'services': ['service', 'client', 'provider', 'manager'],
        'utilities': ['util', 'helper', 'function', 'library'],
        'testing': ['test', 'spec', 'mock', 'fixture', 'assertion'],
        'configuration': ['config', 'setting', 'environment', 'variable'],
        'middleware': ['middleware', 'interceptor', 'guard', 'filter']
      };

      // Calculate match scores for each feature
      const featureScores: Array<{ feature: typeof featureMaps[0]; score: number; matchedKeywords: string[] }> = [];

      for (const feature of featureMaps) {
        const featureKeywords = keywordGroups[feature.featureName] || [];
        const matchedKeywords: string[] = [];
        let score = 0;

        for (const keyword of featureKeywords) {
          if (lowerDesc.includes(keyword)) {
            matchedKeywords.push(keyword);
            // Weight longer keywords more heavily
            score += keyword.length / 10;
          }
        }

        // Also check direct feature name match
        if (lowerDesc.includes(feature.featureName.replace('-', ' '))) {
          score += 1.0; // Strong boost for direct name match
          matchedKeywords.push(feature.featureName);
        }

        if (score > 0) {
          featureScores.push({ feature, score, matchedKeywords });
        }
      }

      // Sort by score (highest first)
      featureScores.sort((a, b) => b.score - a.score);

      if (featureScores.length > 0) {
        const best = featureScores[0];
        const allFiles = [...best.feature.primaryFiles, ...best.feature.relatedFiles];

        // Calculate confidence based on:
        // 1. Match score strength (0-1)
        // 2. Number of matched keywords (more = higher confidence)
        // 3. File count (more files = lower confidence per file)
        const maxPossibleScore = 3.0; // Tuned based on typical keyword counts
        const scoreConfidence = Math.min(best.score / maxPossibleScore, 1.0);
        const keywordBoost = Math.min(best.matchedKeywords.length * 0.15, 0.3);
        const fileCountPenalty = allFiles.length > 20 ? 0.1 : 0; // Penalize very large features

        const confidence = Math.min(Math.max(scoreConfidence + keywordBoost - fileCountPenalty, 0.3), 0.95);

        return {
          intendedFeature: best.feature.featureName,
          targetFiles: allFiles.slice(0, 5),
          workType,
          suggestedStartPoint: best.feature.primaryFiles[0] || allFiles[0],
          confidence,
          reasoning: `Matched keywords: ${best.matchedKeywords.join(', ')}. Found ${allFiles.length} relevant files.`
        };
      }

      // Fallback: return first feature with low confidence
      if (featureMaps.length > 0) {
        const firstFeature = featureMaps[0];
        const allFiles = [...firstFeature.primaryFiles, ...firstFeature.relatedFiles];

        return {
          intendedFeature: firstFeature.featureName,
          targetFiles: allFiles.slice(0, 5),
          workType,
          suggestedStartPoint: firstFeature.primaryFiles[0],
          confidence: 0.2, // Low confidence for fallback
          reasoning: 'No keyword matches found. Suggesting most common feature as fallback.'
        };
      }

      console.warn('⚠️  Could not route request - no features available');
      return null;
    } catch (error) {
      console.error('⚠️  Request routing error:', error instanceof Error ? error.message : 'Unknown error');
      console.warn('   Routing failed. Check if feature maps exist.');
      return null;
    }
  }

  async findFilesUsingPatterns(
    patterns: RelevantPattern[],
    projectPath: string
  ): Promise<string[]> {
    const files: string[] = [];

    try {
      const allFileIntel = this.database.getFeatureMaps(projectPath);

      for (const feature of allFileIntel) {
        for (const pattern of patterns) {
          const patternType = pattern.patternType.toLowerCase();

          if (feature.featureName.includes('test') && patternType.includes('test')) {
            files.push(...feature.primaryFiles);
          } else if (feature.featureName.includes('api') && patternType.includes('api')) {
            files.push(...feature.primaryFiles);
          }
        }
      }

      return [...new Set(files)].slice(0, 10);
    } catch (error) {
      console.error('Error finding files using patterns:', error);
      return [];
    }
  }
}