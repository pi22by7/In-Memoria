import { nanoid } from 'nanoid';
import { Logger } from '../utils/logger.js';
import type { SQLiteDatabase } from '../storage/sqlite-db.js';
import type { SemanticEngine } from '../engines/semantic-engine.js';
import type { PatternEngine } from '../engines/pattern-engine.js';
import { NamingConventions } from '../utils/naming-conventions.js';



export interface PatternViolation {
  id: string;
  type: string;
  pattern: {
    id: string;
    type: string;
    content: any;
    confidence: number;
  };
  severity: 'low' | 'medium' | 'high';
  message: string;
  location?: {
    line: number;
    column: number;
    endLine: number;
    endColumn: number;
  };
  codeSnippet: string;
  expectedPattern: string;
  actualPattern: string;
  suggestedFix?: string;
  confidence: number;
}

export interface ComplianceReport {
  passed: boolean;
  violations: PatternViolation[];
  warnings: PatternViolation[];
  suggestions: PatternViolation[];
  overallScore: number; // 0-100
  checkDurationMs: number;
}

export interface CheckOptions {
  severityThreshold?: 'low' | 'medium' | 'high';
  includeWarnings?: boolean;
  includeSuggestions?: boolean;
  autoFix?: boolean;
}

const SEVERITY_THRESHOLDS = {
  high: 0.85, // Only alert if 85%+ confident
  medium: 0.70, // Alert if 70%+ confident
  low: 0.50, // Alert if 50%+ confident
};

const PATTERN_FREQUENCY_THRESHOLD = 5; // Must see pattern 5+ times

/**
 * Pattern conflict detection service - detects when code violates learned patterns
 */
export class PatternConflictDetector {
  private db: SQLiteDatabase;
  private semanticEngine: SemanticEngine;
  private patternEngine: PatternEngine;
  private projectId: string;

  constructor(
    db: SQLiteDatabase,
    semanticEngine: SemanticEngine,
    patternEngine: PatternEngine,
    projectId: string
  ) {
    this.db = db;
    this.semanticEngine = semanticEngine;
    this.patternEngine = patternEngine;
    this.projectId = projectId;
  }

  /**
   * Check code compliance against learned patterns
   */
  async checkCompliance(
    code: string,
    filePath: string,
    options: CheckOptions = {}
  ): Promise<ComplianceReport> {
    const startTime = Date.now();
    const {
      severityThreshold = 'medium',
      includeWarnings = true,
      includeSuggestions = true,
    } = options;

    const violations: PatternViolation[] = [];
    const warnings: PatternViolation[] = [];
    const suggestions: PatternViolation[] = [];

    try {
      // Get learned patterns for this project
      const patterns = await this.getLearnedPatterns();

      // Check naming patterns
      const namingViolations = await this.checkNamingPatterns(
        code,
        filePath,
        patterns.naming
      );
      this.categorizeViolations(
        namingViolations,
        severityThreshold,
        violations,
        warnings,
        suggestions
      );

      // Check structural patterns
      const structuralViolations = await this.checkStructuralPatterns(
        code,
        filePath,
        patterns.structural
      );
      this.categorizeViolations(
        structuralViolations,
        severityThreshold,
        violations,
        warnings,
        suggestions
      );

      // Check implementation patterns
      const implementationViolations = await this.checkImplementationPatterns(
        code,
        filePath,
        patterns.implementation
      );
      this.categorizeViolations(
        implementationViolations,
        severityThreshold,
        violations,
        warnings,
        suggestions
      );

      // Calculate overall score
      const totalChecks = violations.length + warnings.length + suggestions.length;
      const overallScore = totalChecks === 0 ? 100 : Math.max(0, 100 - violations.length * 20 - warnings.length * 10 - suggestions.length * 5);

      // Save violations to database
      for (const violation of violations) {
        await this.saveViolation(violation, filePath);
      }

      const report: ComplianceReport = {
        passed: violations.length === 0,
        violations,
        warnings: includeWarnings ? warnings : [],
        suggestions: includeSuggestions ? suggestions : [],
        overallScore,
        checkDurationMs: Date.now() - startTime,
      };

      Logger.debug(
        `Pattern compliance check completed in ${report.checkDurationMs}ms: ` +
          `${violations.length} violations, ${warnings.length} warnings, ${suggestions.length} suggestions`
      );

      return report;
    } catch (error) {
      Logger.error('Pattern compliance check failed:', error);
      throw error;
    }
  }

  /**
   * Check naming pattern compliance
   */
  private async checkNamingPatterns(
    code: string,
    filePath: string,
    patterns: any[]
  ): Promise<PatternViolation[]> {
    const violations: PatternViolation[] = [];

    // Extract identifiers from code
    const identifiers = this.extractIdentifiers(code);

    for (const pattern of patterns) {
      if (pattern.frequency < PATTERN_FREQUENCY_THRESHOLD) {
        continue; // Skip low-frequency patterns
      }

      const patternData = JSON.parse(pattern.pattern_content);

      // Check variable naming
      if (patternData.category === 'variable_naming') {
        for (const identifier of identifiers.variables) {
          const violation = this.checkNamingConvention(
            identifier,
            patternData,
            pattern,
            'variable'
          );
          if (violation) {
            violations.push(violation);
          }
        }
      }

      // Check function naming
      if (patternData.category === 'function_naming') {
        for (const identifier of identifiers.functions) {
          const violation = this.checkNamingConvention(
            identifier,
            patternData,
            pattern,
            'function'
          );
          if (violation) {
            violations.push(violation);
          }
        }
      }

      // Check class naming
      if (patternData.category === 'class_naming') {
        for (const identifier of identifiers.classes) {
          const violation = this.checkNamingConvention(
            identifier,
            patternData,
            pattern,
            'class'
          );
          if (violation) {
            violations.push(violation);
          }
        }
      }
    }

    return violations;
  }

  /**
   * Check naming convention for an identifier
   */
  private checkNamingConvention(
    identifier: { name: string; line: number; column: number },
    patternData: any,
    pattern: any,
    type: string
  ): PatternViolation | null {
    const expectedConvention = patternData.convention; // e.g., "camelCase", "PascalCase", "snake_case"
    const actualConvention = NamingConventions.detect(identifier.name);

    if (actualConvention !== expectedConvention) {
      const suggestedName = NamingConventions.convert(
        identifier.name,
        expectedConvention
      );

      return {
        id: nanoid(),
        type: 'naming_convention',
        pattern: {
          id: pattern.pattern_id,
          type: pattern.pattern_type,
          content: patternData,
          confidence: pattern.confidence,
        },
        severity: this.calculateSeverity(pattern.confidence),
        message: `${type.charAt(0).toUpperCase() + type.slice(1)} '${identifier.name}' uses ${actualConvention}, but you typically use ${expectedConvention} (${Math.round(pattern.confidence * 100)}% confidence)`,
        location: {
          line: identifier.line,
          column: identifier.column,
          endLine: identifier.line,
          endColumn: identifier.column + identifier.name.length,
        },
        codeSnippet: identifier.name,
        expectedPattern: expectedConvention,
        actualPattern: actualConvention,
        suggestedFix: suggestedName,
        confidence: pattern.confidence,
      };
    }

    return null;
  }

  /**
   * Check structural pattern compliance
   */
  private async checkStructuralPatterns(
    code: string,
    filePath: string,
    patterns: any[]
  ): Promise<PatternViolation[]> {
    const violations: PatternViolation[] = [];

    for (const pattern of patterns) {
      if (pattern.frequency < PATTERN_FREQUENCY_THRESHOLD) {
        continue;
      }

      const patternData = JSON.parse(pattern.pattern_content);

      // Check file location patterns
      if (patternData.category === 'file_location') {
        const expectedLocation = patternData.expected_location;
        const actualLocation = this.getFileLocation(filePath);

        if (!actualLocation.includes(expectedLocation)) {
          violations.push({
            id: nanoid(),
            type: 'file_location',
            pattern: {
              id: pattern.pattern_id,
              type: pattern.pattern_type,
              content: patternData,
              confidence: pattern.confidence,
            },
            severity: this.calculateSeverity(pattern.confidence),
            message: `File location '${actualLocation}' doesn't match typical pattern '${expectedLocation}' (${Math.round(pattern.confidence * 100)}% confidence)`,
            codeSnippet: filePath,
            expectedPattern: expectedLocation,
            actualPattern: actualLocation,
            suggestedFix: `Move to ${expectedLocation}`,
            confidence: pattern.confidence,
          });
        }
      }

      // Check module organization patterns
      if (patternData.category === 'module_organization') {
        // Check if imports are organized as expected
        const imports = this.extractImports(code);
        const expectedOrder = patternData.import_order || [];

        // Simplified check - in real implementation, would be more sophisticated
        if (expectedOrder.length > 0) {
          const actualOrder = this.categorizeImports(imports);
          if (JSON.stringify(actualOrder) !== JSON.stringify(expectedOrder)) {
            violations.push({
              id: nanoid(),
              type: 'import_organization',
              pattern: {
                id: pattern.pattern_id,
                type: pattern.pattern_type,
                content: patternData,
                confidence: pattern.confidence,
              },
              severity: 'low',
              message: `Import organization doesn't match typical pattern (${Math.round(pattern.confidence * 100)}% confidence)`,
              codeSnippet: imports.join('\n'),
              expectedPattern: expectedOrder.join(', '),
              actualPattern: actualOrder.join(', '),
              confidence: pattern.confidence,
            });
          }
        }
      }
    }

    return violations;
  }

  /**
   * Check implementation pattern compliance
   */
  private async checkImplementationPatterns(
    code: string,
    filePath: string,
    patterns: any[]
  ): Promise<PatternViolation[]> {
    const violations: PatternViolation[] = [];

    for (const pattern of patterns) {
      if (pattern.frequency < PATTERN_FREQUENCY_THRESHOLD) {
        continue;
      }

      const patternData = JSON.parse(pattern.pattern_content);

      // Check error handling patterns
      if (patternData.category === 'error_handling') {
        const errorHandlers = this.extractErrorHandlers(code);

        for (const handler of errorHandlers) {
          const expectedPattern = patternData.pattern; // e.g., "Logger.error"
          const hasExpectedPattern = handler.code.includes(expectedPattern);

          if (!hasExpectedPattern) {
            violations.push({
              id: nanoid(),
              type: 'error_handling',
              pattern: {
                id: pattern.pattern_id,
                type: pattern.pattern_type,
                content: patternData,
                confidence: pattern.confidence,
              },
              severity: this.calculateSeverity(pattern.confidence),
              message: `Error handling doesn't use typical pattern '${expectedPattern}' (${Math.round(pattern.confidence * 100)}% confidence)`,
              location: handler.location,
              codeSnippet: handler.code,
              expectedPattern: expectedPattern,
              actualPattern: handler.code,
              suggestedFix: this.generateErrorHandlingFix(handler.code, expectedPattern),
              confidence: pattern.confidence,
            });
          }
        }
      }

      // Check async patterns
      if (patternData.category === 'async_pattern') {
        const asyncFunctions = this.extractAsyncFunctions(code);

        for (const func of asyncFunctions) {
          const expectedPattern = patternData.pattern; // e.g., "try-catch"

          if (expectedPattern === 'try-catch' && !func.code.includes('try')) {
            violations.push({
              id: nanoid(),
              type: 'async_pattern',
              pattern: {
                id: pattern.pattern_id,
                type: pattern.pattern_type,
                content: patternData,
                confidence: pattern.confidence,
              },
              severity: 'medium',
              message: `Async function doesn't use try-catch (${Math.round(pattern.confidence * 100)}% confidence)`,
              location: func.location,
              codeSnippet: func.code,
              expectedPattern: expectedPattern,
              actualPattern: 'no try-catch',
              confidence: pattern.confidence,
            });
          }
        }
      }
    }

    return violations;
  }

  /**
   * Categorize violations by severity
   */
  private categorizeViolations(
    violations: PatternViolation[],
    threshold: 'low' | 'medium' | 'high',
    violationsOut: PatternViolation[],
    warningsOut: PatternViolation[],
    suggestionsOut: PatternViolation[]
  ): void {
    const minConfidence = SEVERITY_THRESHOLDS[threshold];

    for (const violation of violations) {
      if (violation.confidence < minConfidence) {
        continue; // Skip low-confidence violations
      }

      if (violation.severity === 'high') {
        violationsOut.push(violation);
      } else if (violation.severity === 'medium') {
        warningsOut.push(violation);
      } else {
        suggestionsOut.push(violation);
      }
    }
  }

  /**
   * Calculate severity based on confidence
   */
  private calculateSeverity(confidence: number): 'low' | 'medium' | 'high' {
    if (confidence >= SEVERITY_THRESHOLDS.high) {
      return 'high';
    } else if (confidence >= SEVERITY_THRESHOLDS.medium) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Get learned patterns from database
   */
  private async getLearnedPatterns(): Promise<{
    naming: any[];
    structural: any[];
    implementation: any[];
  }> {
    const naming = this.db
      .prepare(
        `
      SELECT * FROM developer_patterns
      WHERE pattern_type = 'naming'
      ORDER BY frequency DESC, confidence DESC
    `
      )
      .all();

    const structural = this.db
      .prepare(
        `
      SELECT * FROM developer_patterns
      WHERE pattern_type = 'structural'
      ORDER BY frequency DESC, confidence DESC
    `
      )
      .all();

    const implementation = this.db
      .prepare(
        `
      SELECT * FROM developer_patterns
      WHERE pattern_type = 'implementation'
      ORDER BY frequency DESC, confidence DESC
    `
      )
      .all();

    return { naming, structural, implementation };
  }

  /**
   * Save violation to database
   */
  private async saveViolation(violation: PatternViolation, filePath: string): Promise<void> {
    // Check if exception exists
    if (await this.isExcepted(violation.pattern.id, filePath)) {
      Logger.debug(`Violation excepted for pattern ${violation.pattern.id} in ${filePath}`);
      return;
    }

    this.db
      .prepare(
        `
      INSERT INTO pattern_violations (
        id, project_id, file_path, line_number, column_number,
        violation_type, pattern_id, severity, message,
        code_snippet, suggested_fix, detected_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
      )
      .run(
        violation.id,
        this.projectId,
        filePath,
        violation.location?.line || null,
        violation.location?.column || null,
        violation.type,
        violation.pattern.id,
        violation.severity,
        violation.message,
        violation.codeSnippet,
        violation.suggestedFix || null,
        Date.now()
      );
  }

  /**
   * Check if pattern is excepted for this file
   */
  async isExcepted(patternId: string, filePath: string): Promise<boolean> {
    const exception = this.db
      .prepare(
        `
      SELECT * FROM pattern_exceptions
      WHERE project_id = ? AND pattern_id = ?
        AND (file_path IS NULL OR file_path = ?)
        AND (expires_at IS NULL OR expires_at > ?)
    `
      )
      .get(this.projectId, patternId, filePath, Date.now());

    return exception !== undefined;
  }

  /**
   * Add pattern exception
   */
  async addException(
    patternId: string,
    reason: string,
    filePath?: string,
    expiresAt?: number
  ): Promise<void> {
    this.db
      .prepare(
        `
      INSERT INTO pattern_exceptions (
        id, project_id, pattern_id, file_path, reason, created_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `
      )
      .run(
        nanoid(),
        this.projectId,
        patternId,
        filePath || null,
        reason,
        Date.now(),
        expiresAt || null
      );
  }

  /**
   * Get violation history
   */
  async getViolationHistory(filePath?: string, limit: number = 50): Promise<PatternViolation[]> {
    let query = `
      SELECT v.*, p.pattern_type, p.pattern_content, p.confidence
      FROM pattern_violations v
      LEFT JOIN developer_patterns p ON v.pattern_id = p.pattern_id
      WHERE v.project_id = ?
    `;

    const params: any[] = [this.projectId];

    if (filePath) {
      query += ' AND v.file_path = ?';
      params.push(filePath);
    }

    query += ' ORDER BY v.detected_at DESC LIMIT ?';
    params.push(limit);

    const rows = this.db.prepare(query).all(...params) as any[];

    return rows.map((row) => ({
      id: row.id,
      type: row.violation_type,
      pattern: {
        id: row.pattern_id,
        type: row.pattern_type,
        content: JSON.parse(row.pattern_content || '{}'),
        confidence: row.confidence,
      },
      severity: row.severity,
      message: row.message,
      location: row.line_number
        ? {
            line: row.line_number,
            column: row.column_number,
            endLine: row.line_number,
            endColumn: row.column_number,
          }
        : undefined,
      codeSnippet: row.code_snippet,
      expectedPattern: '',
      actualPattern: '',
      suggestedFix: row.suggested_fix,
      confidence: row.confidence,
    }));
  }

  /**
   * Resolve violation
   */
  async resolveViolation(
    violationId: string,
    resolution: 'accepted_fix' | 'overridden' | 'ignored' | 'pattern_updated'
  ): Promise<void> {
    this.db
      .prepare(
        `
      UPDATE pattern_violations
      SET resolved_at = ?, resolution = ?
      WHERE id = ?
    `
      )
      .run(Date.now(), resolution, violationId);

    // If pattern was updated, adjust confidence
    if (resolution === 'pattern_updated') {
      const violation = this.db
        .prepare('SELECT pattern_id FROM pattern_violations WHERE id = ?')
        .get(violationId) as any;

      if (violation) {
        this.db
          .prepare(
            `
          UPDATE developer_patterns
          SET confidence = confidence * 0.9
          WHERE pattern_id = ?
        `
          )
          .run(violation.pattern_id);
      }
    }
  }

  // Helper methods for pattern extraction

  private extractIdentifiers(code: string): {
    variables: Array<{ name: string; line: number; column: number }>;
    functions: Array<{ name: string; line: number; column: number }>;
    classes: Array<{ name: string; line: number; column: number }>;
  } {
    // Simplified extraction - in real implementation, would use AST
    const variables: any[] = [];
    const functions: any[] = [];
    const classes: any[] = [];

    const lines = code.split('\n');
    lines.forEach((line, lineNum) => {
      // Variables (const, let, var)
      const varMatch = line.match(/(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/);
      if (varMatch) {
        variables.push({ name: varMatch[1], line: lineNum + 1, column: line.indexOf(varMatch[1]) });
      }

      // Functions
      const funcMatch = line.match(/function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/);
      if (funcMatch) {
        functions.push({ name: funcMatch[1], line: lineNum + 1, column: line.indexOf(funcMatch[1]) });
      }

      // Classes
      const classMatch = line.match(/class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/);
      if (classMatch) {
        classes.push({ name: classMatch[1], line: lineNum + 1, column: line.indexOf(classMatch[1]) });
      }
    });

    return { variables, functions, classes };
  }

  private getFileLocation(filePath: string): string {
    const parts = filePath.split('/');
    return parts.slice(0, -1).join('/');
  }

  private extractImports(code: string): string[] {
    const imports: string[] = [];
    const lines = code.split('\n');

    for (const line of lines) {
      if (line.trim().startsWith('import ')) {
        imports.push(line.trim());
      }
    }

    return imports;
  }

  private categorizeImports(imports: string[]): string[] {
    // Simplified categorization
    const categories: string[] = [];
    for (const imp of imports) {
      if (imp.includes('react')) categories.push('framework');
      else if (imp.includes('./') || imp.includes('../')) categories.push('relative');
      else if (imp.includes('@/')) categories.push('alias');
      else categories.push('third-party');
    }
    return [...new Set(categories)];
  }

  private extractErrorHandlers(code: string): Array<{
    code: string;
    location: { line: number; column: number; endLine: number; endColumn: number };
  }> {
    const handlers: any[] = [];
    const lines = code.split('\n');

    let inCatch = false;
    let catchStart = 0;
    let catchCode = '';

    lines.forEach((line, lineNum) => {
      if (line.includes('} catch (')) {
        inCatch = true;
        catchStart = lineNum + 1;
        catchCode = line;
      } else if (inCatch) {
        catchCode += '\n' + line;
        if (line.trim() === '}') {
          inCatch = false;
          handlers.push({
            code: catchCode,
            location: {
              line: catchStart,
              column: 0,
              endLine: lineNum + 1,
              endColumn: line.length,
            },
          });
          catchCode = '';
        }
      }
    });

    return handlers;
  }

  private extractAsyncFunctions(code: string): Array<{
    code: string;
    location: { line: number; column: number; endLine: number; endColumn: number };
  }> {
    const funcs: any[] = [];
    const lines = code.split('\n');

    let inAsync = false;
    let asyncStart = 0;
    let asyncCode = '';
    let braceCount = 0;

    lines.forEach((line, lineNum) => {
      if (line.includes('async ') && (line.includes('function') || line.includes('=>'))) {
        inAsync = true;
        asyncStart = lineNum + 1;
        asyncCode = line;
        braceCount = (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
      } else if (inAsync) {
        asyncCode += '\n' + line;
        braceCount += (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;

        if (braceCount === 0) {
          inAsync = false;
          funcs.push({
            code: asyncCode,
            location: {
              line: asyncStart,
              column: 0,
              endLine: lineNum + 1,
              endColumn: line.length,
            },
          });
          asyncCode = '';
        }
      }
    });

    return funcs;
  }

  private generateErrorHandlingFix(currentCode: string, expectedPattern: string): string {
    // Simple fix generation
    if (expectedPattern.includes('Logger.error')) {
      return currentCode.replace(/console\.(log|error)\(/g, 'Logger.error(');
    }
    return currentCode;
  }
}
