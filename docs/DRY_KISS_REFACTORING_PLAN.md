# DRY/KISS Refactoring Plan

## Overview

This document outlines the systematic refactoring of the In-Memoria codebase to eliminate DRY (Don't Repeat Yourself) and KISS (Keep It Simple, Stupid) violations identified in the comprehensive analysis.

**Total Issues Found:** 20 violations (11 high-severity, 7 medium, 2 low)
**Estimated Effort:** 3-4 weeks
**Lines to be Refactored:** ~2,500+ lines
**Lines to be Created:** ~800 lines (new utilities)
**Net Reduction:** ~1,700 lines

---

## Refactoring Phases

### Phase 1: Critical Shared Utilities (Days 1-5)

Extract the most duplicated code into shared utilities to maximize impact.

#### 1.1 Create Intelligence Storage Service (DRY-1) 🔴 PRIORITY 1

**Problem:** 300+ lines duplicated between `learning-service.ts` and `intelligence-tools.ts`

**Solution:** Create `src/services/intelligence-storage.ts`

**New File Structure:**
```typescript
// src/services/intelligence-storage.ts
export class IntelligenceStorageService {
  /**
   * Store learned concepts and patterns in database
   */
  static async storeIntelligence(
    db: SQLiteDatabase,
    path: string,
    concepts: Concept[],
    patterns: Pattern[]
  ): Promise<StorageResult>

  /**
   * Analyze relationships between concepts and patterns
   */
  static async analyzeCodebaseRelationships(
    concepts: Concept[],
    patterns: Pattern[]
  ): Promise<RelationshipAnalysis>

  /**
   * Generate learning insights from analyzed data
   */
  static async generateLearningInsights(
    concepts: Concept[],
    patterns: Pattern[],
    analysis: RelationshipAnalysis
  ): Promise<LearningInsights>

  /**
   * Store project blueprint in database
   */
  static async storeProjectBlueprint(
    path: string,
    analysis: RelationshipAnalysis,
    db: SQLiteDatabase
  ): Promise<void>

  /**
   * Infer architecture pattern from codebase data
   */
  static inferArchitecturePattern(data: {
    concepts: Concept[];
    patterns: Pattern[];
    analysis: RelationshipAnalysis;
  }): ArchitecturePattern

  /**
   * Build semantic index for fast retrieval
   */
  static async buildSemanticIndex(
    concepts: Concept[],
    vectorDb: SemanticVectorDB
  ): Promise<void>
}
```

**Files to Modify:**
- `src/services/learning-service.ts` - Remove duplicated methods, import IntelligenceStorageService
- `src/mcp-server/tools/intelligence-tools.ts` - Remove duplicated methods, import IntelligenceStorageService

**Impact:** ~300 lines removed, ~150 lines created
**Net:** -150 lines

---

#### 1.2 Centralize Language Detection (DRY-3) 🔴 PRIORITY 1

**Problem:** Language detection implemented 4 different ways across codebase

**Solution:** Consolidate all uses to existing `language-registry.ts`

**Enhanced File:**
```typescript
// src/utils/language-registry.ts (enhance existing)
export class LanguageRegistry {
  // ... existing code ...

  /**
   * Detect language from file path extension
   */
  static detectLanguageFromPath(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();

    switch (ext) {
      case 'ts':
      case 'tsx':
        return 'typescript';
      case 'js':
      case 'jsx':
        return 'javascript';
      case 'py':
        return 'python';
      case 'rs':
        return 'rust';
      case 'go':
        return 'go';
      case 'java':
        return 'java';
      case 'c':
      case 'h':
        return 'c';
      case 'cpp':
      case 'hpp':
      case 'cxx':
        return 'cpp';
      case 'cs':
        return 'csharp';
      case 'php':
        return 'php';
      case 'rb':
        return 'ruby';
      case 'swift':
        return 'swift';
      case 'kt':
        return 'kotlin';
      default:
        return 'unknown';
    }
  }

  /**
   * Detect language from pattern content
   */
  static detectLanguageFromPattern(pattern: any): string {
    const content = typeof pattern === 'string'
      ? pattern
      : JSON.stringify(pattern);

    if (content.includes('typescript') || content.includes('.ts')) return 'typescript';
    if (content.includes('javascript') || content.includes('.js')) return 'javascript';
    if (content.includes('python') || content.includes('.py')) return 'python';
    if (content.includes('rust') || content.includes('.rs')) return 'rust';
    if (content.includes('go') || content.includes('.go')) return 'go';

    return 'unknown';
  }
}
```

**Files to Modify:**
- `src/engines/semantic-engine.ts` - Replace inline detection with `LanguageRegistry.detectLanguageFromPath()`
- `src/engines/pattern-engine.ts` - Replace inline detection with `LanguageRegistry.detectLanguageFromPath()`
- `src/services/cross-project-service.ts` - Replace 2 methods with `LanguageRegistry` methods
- `src/mcp-server/tools/monitoring-tools.ts` - Replace inline detection

**Impact:** ~80 lines removed, ~40 lines created
**Net:** -40 lines

---

#### 1.3 Create Naming Convention Utility (DRY-2) 🔴 PRIORITY 1

**Problem:** `convertNamingConvention()` duplicated in 2 files (24 lines each)

**Solution:** Create `src/utils/naming-conventions.ts`

**New File:**
```typescript
// src/utils/naming-conventions.ts
export class NamingConventions {
  /**
   * Convert identifier name between naming conventions
   */
  static convert(name: string, targetConvention: string): string {
    // Detect current convention
    const parts = this.splitIdentifier(name);

    switch (targetConvention) {
      case 'camelCase':
        return this.toCamelCase(parts);
      case 'PascalCase':
        return this.toPascalCase(parts);
      case 'snake_case':
        return this.toSnakeCase(parts);
      case 'kebab-case':
        return this.toKebabCase(parts);
      case 'SCREAMING_SNAKE_CASE':
        return this.toScreamingSnakeCase(parts);
      default:
        return name;
    }
  }

  /**
   * Detect naming convention of identifier
   */
  static detect(name: string): string {
    if (/^[a-z][a-zA-Z0-9]*$/.test(name)) return 'camelCase';
    if (/^[A-Z][a-zA-Z0-9]*$/.test(name)) return 'PascalCase';
    if (/^[a-z][a-z0-9_]*$/.test(name)) return 'snake_case';
    if (/^[a-z][a-z0-9-]*$/.test(name)) return 'kebab-case';
    if (/^[A-Z][A-Z0-9_]*$/.test(name)) return 'SCREAMING_SNAKE_CASE';
    return 'mixed';
  }

  private static splitIdentifier(name: string): string[] {
    // Split by underscores, hyphens, or camelCase
    return name
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[_-]/g, ' ')
      .split(/\s+/)
      .filter(part => part.length > 0)
      .map(part => part.toLowerCase());
  }

  private static toCamelCase(parts: string[]): string {
    if (parts.length === 0) return '';
    return parts[0] + parts.slice(1).map(p =>
      p.charAt(0).toUpperCase() + p.slice(1)
    ).join('');
  }

  private static toPascalCase(parts: string[]): string {
    return parts.map(p =>
      p.charAt(0).toUpperCase() + p.slice(1)
    ).join('');
  }

  private static toSnakeCase(parts: string[]): string {
    return parts.join('_');
  }

  private static toKebabCase(parts: string[]): string {
    return parts.join('-');
  }

  private static toScreamingSnakeCase(parts: string[]): string {
    return parts.map(p => p.toUpperCase()).join('_');
  }
}
```

**Files to Modify:**
- `src/services/pattern-conflict-detector.ts` - Remove `convertNamingConvention()`, import `NamingConventions`
- `src/services/quick-fix-generator.ts` - Remove `convertNamingConvention()`, import `NamingConventions`

**Impact:** ~48 lines removed, ~70 lines created
**Net:** +22 lines (but better organized and tested)

---

#### 1.4 Create File Traversal Utility (DRY-4) 🔴 PRIORITY 2

**Problem:** File counting/traversal logic triplication (~170 lines total)

**Solution:** Create `src/utils/file-traversal.ts`

**New File:**
```typescript
// src/utils/file-traversal.ts
import { promises as fs } from 'fs';
import { join } from 'path';

export interface TraversalOptions {
  maxDepth?: number;
  extensions?: string[];
  ignorePatterns?: string[];
  includeHidden?: boolean;
}

export class FileTraversal {
  /**
   * Standard ignore patterns for common non-code directories
   */
  static readonly STANDARD_IGNORE_PATTERNS = [
    'node_modules',
    '.git',
    'dist',
    'build',
    'out',
    'coverage',
    '.next',
    '.nuxt',
    'target',
    'bin',
    'obj',
    '.cache',
    'tmp',
    'temp',
    'logs',
    '.vscode',
    '.idea',
    'vendor',
  ];

  /**
   * Code file extensions
   */
  static readonly CODE_EXTENSIONS = [
    '.ts', '.tsx', '.js', '.jsx',
    '.py', '.rs', '.go', '.java',
    '.c', '.cpp', '.h', '.hpp',
    '.cs', '.php', '.rb', '.swift', '.kt',
  ];

  /**
   * Count total files and code files in project
   */
  static async countProjectFiles(path: string): Promise<{
    total: number;
    codeFiles: number;
  }> {
    const files = await this.collectFiles(path, {
      ignorePatterns: this.STANDARD_IGNORE_PATTERNS,
    });

    const codeFiles = files.filter(f =>
      this.CODE_EXTENSIONS.some(ext => f.endsWith(ext))
    );

    return {
      total: files.length,
      codeFiles: codeFiles.length,
    };
  }

  /**
   * Recursively collect files matching criteria
   */
  static async collectFiles(
    dirPath: string,
    options: TraversalOptions = {}
  ): Promise<string[]> {
    const {
      maxDepth = Infinity,
      extensions = [],
      ignorePatterns = this.STANDARD_IGNORE_PATTERNS,
      includeHidden = false,
    } = options;

    const files: string[] = [];

    async function traverse(currentPath: string, depth: number) {
      if (depth > maxDepth) return;

      const entries = await fs.readdir(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(currentPath, entry.name);
        const relativePath = fullPath.replace(dirPath, '').replace(/^\//, '');

        // Skip ignored patterns
        if (ignorePatterns.some(pattern => relativePath.includes(pattern))) {
          continue;
        }

        // Skip hidden files if requested
        if (!includeHidden && entry.name.startsWith('.')) {
          continue;
        }

        if (entry.isDirectory()) {
          await traverse(fullPath, depth + 1);
        } else if (entry.isFile()) {
          // Check extension filter
          if (extensions.length === 0 ||
              extensions.some(ext => entry.name.endsWith(ext))) {
            files.push(fullPath);
          }
        }
      }
    }

    await traverse(dirPath, 0);
    return files;
  }

  /**
   * Check if path should be ignored
   */
  static shouldIgnore(path: string, ignorePatterns: string[]): boolean {
    return ignorePatterns.some(pattern => path.includes(pattern));
  }
}
```

**Files to Modify:**
- `src/mcp-server/tools/automation-tools.ts` - Replace file counting logic (lines 568-661)
- `src/engines/semantic-engine.ts` - Replace file collection (lines 756-790)
- `src/engines/pattern-engine.ts` - Replace file collection (lines 790-833)

**Impact:** ~170 lines removed, ~110 lines created
**Net:** -60 lines

---

#### 1.5 Create Simple Utilities (DRY-5, DRY-10)

**hash.ts:**
```typescript
// src/utils/hash.ts
export function simpleHash(str: string, maxLength: number = 16): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  const hashStr = Math.abs(hash).toString(36);
  return hashStr.substring(0, maxLength);
}
```

**string-similarity.ts:**
```typescript
// src/utils/string-similarity.ts
export class StringSimilarity {
  /**
   * Calculate bigram similarity between two strings
   */
  static bigramSimilarity(str1: string, str2: string): number {
    const bigrams1 = this.getBigrams(str1.toLowerCase());
    const bigrams2 = this.getBigrams(str2.toLowerCase());

    if (bigrams1.length === 0 && bigrams2.length === 0) return 1.0;
    if (bigrams1.length === 0 || bigrams2.length === 0) return 0.0;

    const intersection = bigrams1.filter(b => bigrams2.includes(b));
    return (2 * intersection.length) / (bigrams1.length + bigrams2.length);
  }

  private static getBigrams(str: string): string[] {
    const bigrams: string[] = [];
    for (let i = 0; i < str.length - 1; i++) {
      bigrams.push(str.substring(i, i + 2));
    }
    return bigrams;
  }
}
```

**Files to Modify:**
- `src/engines/semantic-engine.ts` - Replace hash function
- `src/engines/pattern-engine.ts` - Replace hash function
- `src/storage/vector-db.ts` - Replace hash function
- `src/services/pattern-aggregator.ts` - Use `StringSimilarity.bigramSimilarity()`

**Impact:** ~45 lines removed, ~40 lines created
**Net:** -5 lines

---

### Phase 2: KISS Simplifications (Days 6-12)

Break down overly complex methods into focused, testable components.

#### 2.1 Simplify SemanticEngine.learnFromCodebase (KISS-1) 🔴 PRIORITY 1

**Problem:** 343-line method handling 6 different concerns

**Refactoring Strategy:**
```typescript
// src/engines/semantic-engine.ts (refactored)
export class SemanticEngine {
  /**
   * Learn from codebase - orchestrates the learning process
   */
  async learnFromCodebase(
    path: string,
    progressCallback?: (progress: number, message: string) => void
  ): Promise<Concept[]> {
    const tracker = this.createProgressTracker(path, progressCallback);

    try {
      tracker.start();

      const concepts = await this.extractConcepts(path, tracker);
      await this.storeConcepts(concepts, tracker);
      await this.indexConcepts(concepts, tracker);

      tracker.complete(concepts.length);
      return concepts;
    } catch (error) {
      tracker.error(error);
      throw error;
    } finally {
      tracker.cleanup();
    }
  }

  /**
   * Extract concepts from files
   */
  private async extractConcepts(
    path: string,
    tracker: ProgressTracker
  ): Promise<Concept[]> {
    const files = await FileTraversal.collectFiles(path, {
      extensions: FileTraversal.CODE_EXTENSIONS,
      ignorePatterns: FileTraversal.STANDARD_IGNORE_PATTERNS,
    });

    tracker.setTotal(files.length);

    const concepts: Concept[] = [];
    for (const file of files) {
      try {
        const fileConcepts = await this.extractFileConceptsSafe(file);
        concepts.push(...fileConcepts);
        tracker.increment(`Processed ${file}`);
      } catch (error) {
        tracker.warn(`Skipped ${file}: ${error.message}`);
      }
    }

    return concepts;
  }

  /**
   * Store concepts in database
   */
  private async storeConcepts(
    concepts: Concept[],
    tracker: ProgressTracker
  ): Promise<void> {
    tracker.setPhase('Storing concepts');

    const batch = this.db.transaction(() => {
      for (const concept of concepts) {
        this.storeConceptInternal(concept);
      }
    });

    batch();
    tracker.increment(`Stored ${concepts.length} concepts`);
  }

  /**
   * Index concepts for semantic search
   */
  private async indexConcepts(
    concepts: Concept[],
    tracker: ProgressTracker
  ): Promise<void> {
    tracker.setPhase('Building semantic index');

    await IntelligenceStorageService.buildSemanticIndex(
      concepts,
      this.vectorDb
    );

    tracker.increment('Index built');
  }

  /**
   * Create progress tracker
   */
  private createProgressTracker(
    path: string,
    callback?: (progress: number, message: string) => void
  ): ProgressTracker {
    return new ProgressTracker(path, callback);
  }
}

/**
 * Progress tracking helper
 */
class ProgressTracker {
  private current = 0;
  private total = 0;
  private phase = 'initializing';
  private startTime = Date.now();

  constructor(
    private path: string,
    private callback?: (progress: number, message: string) => void
  ) {}

  start() {
    this.phase = 'scanning';
    this.report(0, 'Starting learning...');
  }

  setTotal(total: number) {
    this.total = total;
  }

  setPhase(phase: string) {
    this.phase = phase;
  }

  increment(message: string) {
    this.current++;
    const progress = this.total > 0 ? (this.current / this.total) * 100 : 0;
    this.report(progress, message);
  }

  complete(count: number) {
    this.report(100, `Learned ${count} concepts in ${Date.now() - this.startTime}ms`);
  }

  error(error: Error) {
    this.report(0, `Error: ${error.message}`);
  }

  warn(message: string) {
    this.report(this.current / this.total * 100, `Warning: ${message}`);
  }

  cleanup() {
    // Any cleanup needed
  }

  private report(progress: number, message: string) {
    if (this.callback) {
      this.callback(progress, `[${this.phase}] ${message}`);
    }
  }
}
```

**Impact:** 343 lines → ~180 lines
**Net:** -163 lines, much easier to understand and test

---

#### 2.2 Simplify AutomationTools.autoLearnIfNeeded (KISS-2) 🔴 PRIORITY 1

**Problem:** 335-line method with 7+ levels of nesting

**Refactoring Strategy:**
```typescript
// src/mcp-server/tools/automation-tools.ts (refactored)
export class AutomationTools {
  async autoLearnIfNeeded(args: AutoLearnArgs): Promise<AutoLearnResult> {
    const executor = new LearningExecutor(
      args,
      this.db,
      this.semanticEngine,
      this.patternEngine
    );

    return executor.execute();
  }
}

/**
 * Handles auto-learning execution logic
 */
class LearningExecutor {
  private path: string;
  private options: {
    skipLearning: boolean;
    includeSetupSteps: boolean;
    includeProgress: boolean;
  };

  constructor(
    args: AutoLearnArgs,
    private db: SQLiteDatabase,
    private semanticEngine: SemanticEngine,
    private patternEngine: PatternEngine
  ) {
    this.path = args.path || process.cwd();
    this.options = {
      skipLearning: args.skip_learning ?? false,
      includeSetupSteps: args.include_setup_steps ?? false,
      includeProgress: args.include_progress ?? false,
    };
  }

  async execute(): Promise<AutoLearnResult> {
    if (this.options.skipLearning) {
      return this.createSkipResponse();
    }

    const currentData = await this.getCurrentData();
    if (this.isDataFresh(currentData)) {
      return this.createCachedResponse(currentData);
    }

    return this.performLearning();
  }

  private createSkipResponse(): AutoLearnResult {
    return {
      status: 'skipped',
      message: 'Learning skipped as requested',
      needsLearning: false,
    };
  }

  private async getCurrentData(): Promise<LearningData | null> {
    const concepts = this.db.prepare(
      'SELECT COUNT(*) as count FROM semantic_concepts WHERE is_deleted = 0'
    ).get() as { count: number };

    if (concepts.count === 0) return null;

    return {
      conceptCount: concepts.count,
      lastLearned: this.getLastLearnedTimestamp(),
    };
  }

  private isDataFresh(data: LearningData | null): boolean {
    if (!data) return false;

    const daysSinceLastLearning =
      (Date.now() - data.lastLearned) / (1000 * 60 * 60 * 24);

    return daysSinceLastLearning < 7 && data.conceptCount > 10;
  }

  private createCachedResponse(data: LearningData): AutoLearnResult {
    return {
      status: 'current',
      message: `Intelligence is current (${data.conceptCount} concepts)`,
      needsLearning: false,
      conceptCount: data.conceptCount,
    };
  }

  private async performLearning(): Promise<AutoLearnResult> {
    const learner = new LearningPerformer(
      this.path,
      this.db,
      this.semanticEngine,
      this.patternEngine,
      this.options
    );

    return learner.learn();
  }

  private getLastLearnedTimestamp(): number {
    const result = this.db.prepare(
      'SELECT MAX(timestamp) as last FROM learning_deltas'
    ).get() as { last: number | null };

    return result.last || 0;
  }
}

/**
 * Performs the actual learning process
 */
class LearningPerformer {
  private setupSteps: SetupStep[] = [];
  private progressReports: ProgressReport[] = [];

  constructor(
    private path: string,
    private db: SQLiteDatabase,
    private semanticEngine: SemanticEngine,
    private patternEngine: PatternEngine,
    private options: {
      includeSetupSteps: boolean;
      includeProgress: boolean;
    }
  ) {}

  async learn(): Promise<AutoLearnResult> {
    try {
      await this.runSemanticLearning();
      await this.runPatternLearning();

      return this.createSuccessResponse();
    } catch (error) {
      return this.createErrorResponse(error);
    }
  }

  private async runSemanticLearning(): Promise<void> {
    this.addSetupStep('semantic', 'in_progress');

    const concepts = await this.semanticEngine.learnFromCodebase(
      this.path,
      this.createProgressCallback('semantic')
    );

    this.addSetupStep('semantic', 'complete', concepts.length);
  }

  private async runPatternLearning(): Promise<void> {
    this.addSetupStep('patterns', 'in_progress');

    const patterns = await this.patternEngine.learnPatterns(
      this.path,
      this.createProgressCallback('patterns')
    );

    this.addSetupStep('patterns', 'complete', patterns.length);
  }

  private createProgressCallback(phase: string) {
    if (!this.options.includeProgress) return undefined;

    return (progress: number, message: string) => {
      this.progressReports.push({
        phase,
        progress,
        message,
        timestamp: Date.now(),
      });
    };
  }

  private addSetupStep(
    step: string,
    status: 'pending' | 'in_progress' | 'complete' | 'error',
    count?: number
  ) {
    if (!this.options.includeSetupSteps) return;

    this.setupSteps.push({
      step,
      status,
      count,
      timestamp: Date.now(),
    });
  }

  private createSuccessResponse(): AutoLearnResult {
    const conceptCount = this.db.prepare(
      'SELECT COUNT(*) as count FROM semantic_concepts WHERE is_deleted = 0'
    ).get() as { count: number };

    return {
      status: 'learned',
      message: 'Learning completed successfully',
      needsLearning: false,
      conceptCount: conceptCount.count,
      setupSteps: this.options.includeSetupSteps ? this.setupSteps : undefined,
      progress: this.options.includeProgress ? this.progressReports : undefined,
    };
  }

  private createErrorResponse(error: any): AutoLearnResult {
    return {
      status: 'error',
      message: `Learning failed: ${error.message}`,
      needsLearning: true,
      error: error.message,
    };
  }
}
```

**Impact:** 335 lines → ~220 lines (split across multiple focused classes)
**Net:** -115 lines, much more testable

---

#### 2.3 Simplify PatternConflictDetector.checkCompliance (KISS-3)

**Problem:** 172-line method doing too many things

**Refactoring Strategy:**
```typescript
// src/services/pattern-conflict-detector.ts (refactored)
export class PatternConflictDetector {
  async checkCompliance(
    code: string,
    filePath: string,
    options: CheckOptions = {}
  ): Promise<ComplianceReport> {
    const violations: PatternViolation[] = [];

    // Check each aspect separately
    violations.push(...await this.checkNamingCompliance(code, filePath, options));
    violations.push(...await this.checkStructuralCompliance(code, filePath, options));
    violations.push(...await this.checkImplementationCompliance(code, filePath, options));

    // Filter by severity
    const filtered = this.filterBySeverity(violations, options.severityThreshold);

    // Build final report
    return this.buildComplianceReport(filtered, violations.length, options);
  }

  /**
   * Check naming pattern compliance
   */
  private async checkNamingCompliance(
    code: string,
    filePath: string,
    options: CheckOptions
  ): Promise<PatternViolation[]> {
    const violations: PatternViolation[] = [];
    const namingPatterns = this.getNamingPatterns();

    const identifiers = this.extractIdentifiers(code);

    for (const identifier of identifiers) {
      for (const pattern of namingPatterns) {
        const violation = await this.checkNamingPattern(
          identifier,
          pattern,
          filePath
        );

        if (violation) {
          violations.push(violation);
        }
      }
    }

    return violations;
  }

  /**
   * Check structural pattern compliance
   */
  private async checkStructuralCompliance(
    code: string,
    filePath: string,
    options: CheckOptions
  ): Promise<PatternViolation[]> {
    const violations: PatternViolation[] = [];
    const structuralPatterns = this.getStructuralPatterns();

    for (const pattern of structuralPatterns) {
      const violation = await this.checkStructuralPattern(
        code,
        pattern,
        filePath
      );

      if (violation) {
        violations.push(violation);
      }
    }

    return violations;
  }

  /**
   * Check implementation pattern compliance
   */
  private async checkImplementationCompliance(
    code: string,
    filePath: string,
    options: CheckOptions
  ): Promise<PatternViolation[]> {
    const violations: PatternViolation[] = [];
    const implementationPatterns = this.getImplementationPatterns();

    for (const pattern of implementationPatterns) {
      const violation = await this.checkImplementationPattern(
        code,
        pattern,
        filePath
      );

      if (violation) {
        violations.push(violation);
      }
    }

    return violations;
  }

  /**
   * Filter violations by severity threshold
   */
  private filterBySeverity(
    violations: PatternViolation[],
    threshold: 'low' | 'medium' | 'high' = 'medium'
  ): PatternViolation[] {
    const severityOrder = { low: 1, medium: 2, high: 3 };
    const minSeverity = severityOrder[threshold];

    return violations.filter(v =>
      severityOrder[v.severity] >= minSeverity
    );
  }

  /**
   * Build compliance report from violations
   */
  private buildComplianceReport(
    violations: PatternViolation[],
    totalViolations: number,
    options: CheckOptions
  ): ComplianceReport {
    const score = this.calculateComplianceScore(violations, totalViolations);

    return {
      passed: violations.length === 0,
      overallScore: score,
      violations,
      summary: {
        total: violations.length,
        high: violations.filter(v => v.severity === 'high').length,
        medium: violations.filter(v => v.severity === 'medium').length,
        low: violations.filter(v => v.severity === 'low').length,
      },
    };
  }
}
```

**Impact:** 172 lines → ~150 lines (better organized)
**Net:** -22 lines, much more maintainable

---

### Phase 3: Extract Constants and Utilities (Days 13-15)

#### 3.1 Create Constants File (KISS-8)

**New File:**
```typescript
// src/utils/constants.ts

/**
 * Timeout configurations (in milliseconds)
 */
export const TIMEOUTS = {
  /** Cache time-to-live */
  CACHE_TTL_MS: 5 * 60 * 1000,

  /** Learning operation timeout */
  LEARNING_TIMEOUT_MS: 5 * 60 * 1000,

  /** Pattern analysis timeout */
  PATTERN_TIMEOUT_MS: 2 * 60 * 1000,

  /** Default operation timeout */
  DEFAULT_TIMEOUT_MS: 30 * 1000,
} as const;

/**
 * Confidence thresholds for pattern detection
 */
export const CONFIDENCE_THRESHOLDS = {
  /** High confidence threshold */
  HIGH: 0.85,

  /** Medium confidence threshold */
  MEDIUM: 0.70,

  /** Low confidence threshold */
  LOW: 0.50,

  /** Minimum viable confidence */
  MINIMUM: 0.30,
} as const;

/**
 * Vector embedding dimensions
 */
export const VECTOR_DIMENSIONS = {
  /** Local embedding dimension */
  LOCAL: 384,

  /** Maximum vectors in cache */
  CACHE_SIZE: 1000,
} as const;

/**
 * Database limits
 */
export const DB_LIMITS = {
  /** Maximum concepts to return in query */
  MAX_CONCEPTS: 1000,

  /** Maximum patterns to return in query */
  MAX_PATTERNS: 500,

  /** Batch size for insertions */
  BATCH_SIZE: 100,
} as const;

/**
 * Search configuration
 */
export const SEARCH_CONFIG = {
  /** Default search result limit */
  DEFAULT_LIMIT: 20,

  /** Maximum search results */
  MAX_LIMIT: 100,

  /** Minimum similarity score */
  MIN_SIMILARITY: 0.6,
} as const;
```

**Files to Modify:** Replace magic numbers in:
- `src/engines/semantic-engine.ts`
- `src/services/pattern-conflict-detector.ts`
- `src/storage/vector-db.ts`
- `src/mcp-server/tools/automation-tools.ts`

**Impact:** ~30 magic numbers → named constants

---

#### 3.2 Create Timeout Utility (KISS-9)

**New File:**
```typescript
// src/utils/timeout.ts

/**
 * Execute promise with timeout
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message?: string
): Promise<T> {
  let timeoutId: NodeJS.Timeout;

  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error(message || `Operation timed out after ${timeoutMs}ms`)),
          timeoutMs
        );
      }),
    ]);
  } finally {
    clearTimeout(timeoutId!);
  }
}

/**
 * Execute promise with timeout and cleanup callback
 */
export async function withTimeoutAndCleanup<T>(
  promise: Promise<T>,
  timeoutMs: number,
  cleanup: () => void,
  message?: string
): Promise<T> {
  try {
    return await withTimeout(promise, timeoutMs, message);
  } finally {
    cleanup();
  }
}
```

**Files to Modify:**
- `src/mcp-server/tools/automation-tools.ts`
- `src/engines/semantic-engine.ts`

**Impact:** ~40 lines removed, ~25 lines created
**Net:** -15 lines

---

### Phase 4: Lower Priority Improvements (Days 16-18)

#### 4.1 Simplify Vector Embedding Logic (KISS-4)

Extract feature extractors from `SemanticVectorDB`:

```typescript
// src/storage/feature-extractors.ts
export class FeatureExtractors {
  extractStructuralFeatures(code: string): number[] { /* ... */ }
  extractSemanticFeatures(code: string): number[] { /* ... */ }
  extractASTFeatures(code: string): number[] { /* ... */ }
  extractContextFeatures(code: string): number[] { /* ... */ }

  extractAll(code: string): number[] {
    return [
      ...this.extractStructuralFeatures(code),
      ...this.extractSemanticFeatures(code),
      ...this.extractASTFeatures(code),
      ...this.extractContextFeatures(code),
    ];
  }
}
```

**Impact:** 332 lines → ~200 lines
**Net:** -132 lines

---

#### 4.2 Split IntelligenceTools Class (KISS-5)

Break 986-line class into focused classes:

```typescript
// src/mcp-server/tools/learning-tools.ts
export class LearningTools { /* learn, getBlueprint */ }

// src/mcp-server/tools/pattern-tools.ts
export class PatternTools { /* getPatterns, predictApproach */ }

// src/mcp-server/tools/insight-tools.ts
export class InsightTools { /* getInsights, contributeInsights */ }

// src/mcp-server/tools/profile-tools.ts
export class ProfileTools { /* getDeveloperProfile */ }
```

**Impact:** Better organization, easier testing

---

## Testing Strategy

### For Each Refactoring:

1. **Before Refactoring:**
   - Run existing test suite: `npm test`
   - Record baseline results

2. **During Refactoring:**
   - Make changes incrementally
   - Run tests after each major change
   - Ensure no regressions

3. **After Refactoring:**
   - Add unit tests for new utilities
   - Verify all existing tests still pass
   - Run integration tests

### New Test Files:

```
src/__tests__/
├── utils/
│   ├── naming-conventions.test.ts
│   ├── file-traversal.test.ts
│   ├── hash.test.ts
│   ├── string-similarity.test.ts
│   └── timeout.test.ts
└── services/
    └── intelligence-storage.test.ts
```

---

## Success Metrics

### Quantitative:
- **Lines Reduced:** ~1,700 lines
- **Files Created:** 8 new utility files
- **Duplication Removed:** ~600 lines
- **Test Coverage:** Maintain >80%
- **Build Time:** No increase

### Qualitative:
- **Readability:** Methods <100 lines
- **Complexity:** Max nesting depth 3
- **Testability:** All new utilities unit tested
- **Maintainability:** Clear separation of concerns

---

## Risk Mitigation

1. **Break Changes:**
   - Refactor incrementally
   - Keep git history clean with atomic commits
   - Test after each change

2. **Regression:**
   - Run full test suite frequently
   - Manual smoke testing
   - Keep old code temporarily if uncertain

3. **Timeline:**
   - Priority 1 items first (highest impact)
   - Can pause after each phase
   - Each phase is independently valuable

---

## Commit Strategy

**Commit per logical change:**
- ✅ `refactor: extract IntelligenceStorageService to eliminate duplication (DRY-1)`
- ✅ `refactor: centralize language detection in LanguageRegistry (DRY-3)`
- ✅ `refactor: create NamingConventions utility (DRY-2)`
- ✅ `refactor: extract FileTraversal utility (DRY-4)`
- ✅ `refactor: simplify SemanticEngine.learnFromCodebase (KISS-1)`
- ✅ `refactor: simplify AutomationTools.autoLearnIfNeeded (KISS-2)`
- ✅ `refactor: extract constants from magic numbers (KISS-8)`
- ✅ `refactor: create timeout utility (KISS-9)`
- ✅ `test: add unit tests for new utility modules`

---

**Created:** 2025-11-17
**Status:** Ready for implementation
**Estimated Completion:** 3-4 weeks
**Expected Impact:** -1,700 lines, significantly improved maintainability
