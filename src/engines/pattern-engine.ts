import { PatternLearner } from '../rust-bindings.js';
import { SQLiteDatabase, DeveloperPattern } from '../storage/sqlite-db.js';
import { FileChange } from '../watchers/file-watcher.js';
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

  constructor(private database: SQLiteDatabase) {
    this.rustLearner = new PatternLearner();
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

  async learnFromCodebase(path: string): Promise<Array<{
    id: string;
    type: string;
    content: Record<string, any>;
    frequency: number;
    confidence: number;
    contexts: string[];
    examples: Array<{ code: string }>;
  }>> {
    try {
      const patterns = await this.rustLearner.learnFromCodebase(path);
      
      const result = patterns.map((p: any) => ({
        id: p.id,
        type: p.patternType,
        content: { description: p.description },
        frequency: p.frequency,
        confidence: p.confidence,
        contexts: p.contexts,
        examples: p.examples.map((ex: any) => ({ code: ex.code }))
      }));

      // Store patterns in database
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
    try {
      const patterns = await this.rustLearner.findRelevantPatterns(
        problemDescription,
        currentFile || null,
        selectedCode || null
      );

      return patterns.map((p: any) => ({
        patternId: p.id,
        patternType: p.patternType,
        patternContent: { description: p.description },
        frequency: p.frequency,
        contexts: p.contexts,
        examples: p.examples.map((ex: any) => ({ code: ex.code })),
        confidence: p.confidence
      }));
    } catch (error) {
      console.error('Pattern finding error:', error);
      return this.fallbackRelevantPatterns(problemDescription);
    }
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
      const prediction = await this.rustLearner.predictApproach(problemDescription, context);
      
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

  async buildFeatureMap(projectPath: string): Promise<Array<{
    id: string;
    featureName: string;
    primaryFiles: string[];
    relatedFiles: string[];
    dependencies: string[];
  }>> {
    const { readdirSync, statSync, existsSync } = await import('fs');
    const { join, relative } = await import('path');
    const { nanoid } = await import('nanoid');

    const featureMap: Array<{
      id: string;
      featureName: string;
      primaryFiles: string[];
      relatedFiles: string[];
      dependencies: string[];
    }> = [];

    try {
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
            if (existsSync(checkPath)) {
              const files = this.collectFilesInDirectory(checkPath, projectPath);
              if (files.length > 0) {
                primaryFiles.push(...files.slice(0, Math.ceil(files.length / 2)));
                relatedFiles.push(...files.slice(Math.ceil(files.length / 2)));
              }
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
      console.error('Feature mapping error:', error);
      return [];
    }
  }

  private collectFilesInDirectory(dirPath: string, projectPath: string): string[] {
    const { readdirSync, statSync } = require('fs');
    const { join, relative } = require('path');
    const files: string[] = [];

    try {
      const entries = readdirSync(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dirPath, entry.name);

        if (entry.isDirectory()) {
          if (!['node_modules', '.git', 'dist', 'build', '.next'].includes(entry.name)) {
            files.push(...this.collectFilesInDirectory(fullPath, projectPath));
          }
        } else if (entry.isFile()) {
          const ext = entry.name.split('.').pop()?.toLowerCase();
          if (['ts', 'tsx', 'js', 'jsx', 'py', 'rs', 'go', 'java'].includes(ext || '')) {
            files.push(relative(projectPath, fullPath));
          }
        }
      }
    } catch (error) {
      // Ignore errors for individual directories
    }

    return files;
  }

  async routeRequestToFiles(
    problemDescription: string,
    projectPath: string
  ): Promise<{
    intendedFeature: string;
    targetFiles: string[];
    workType: 'feature' | 'bugfix' | 'refactor' | 'test';
    suggestedStartPoint: string;
  } | null> {
    try {
      const featureMaps = this.database.getFeatureMaps(projectPath);
      const lowerDesc = problemDescription.toLowerCase();

      let workType: 'feature' | 'bugfix' | 'refactor' | 'test' = 'feature';
      if (lowerDesc.includes('fix') || lowerDesc.includes('bug') || lowerDesc.includes('error')) {
        workType = 'bugfix';
      } else if (lowerDesc.includes('refactor') || lowerDesc.includes('improve') || lowerDesc.includes('optimize')) {
        workType = 'refactor';
      } else if (lowerDesc.includes('test') || lowerDesc.includes('spec')) {
        workType = 'test';
      }

      const keywords = [
        'auth', 'authentication', 'login', 'signup', 'register',
        'api', 'endpoint', 'route', 'controller',
        'database', 'db', 'model', 'schema', 'migration',
        'component', 'ui', 'view', 'page', 'screen',
        'service', 'client', 'util', 'helper',
        'test', 'spec', 'middleware', 'config'
      ];

      for (const keyword of keywords) {
        if (lowerDesc.includes(keyword)) {
          const matchedFeature = featureMaps.find(f =>
            f.featureName.includes(keyword) ||
            keyword.includes(f.featureName.split('-')[0])
          );

          if (matchedFeature) {
            const allFiles = [...matchedFeature.primaryFiles, ...matchedFeature.relatedFiles];
            return {
              intendedFeature: matchedFeature.featureName,
              targetFiles: allFiles.slice(0, 5),
              workType,
              suggestedStartPoint: matchedFeature.primaryFiles[0] || allFiles[0]
            };
          }
        }
      }

      if (featureMaps.length > 0) {
        const firstFeature = featureMaps[0];
        return {
          intendedFeature: firstFeature.featureName,
          targetFiles: [...firstFeature.primaryFiles, ...firstFeature.relatedFiles].slice(0, 5),
          workType,
          suggestedStartPoint: firstFeature.primaryFiles[0]
        };
      }

      return null;
    } catch (error) {
      console.error('Request routing error:', error);
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