import { Logger } from '../utils/logger.js';
import type { PatternViolation } from './pattern-conflict-detector.js';
import { NamingConventions } from '../utils/naming-conventions.js';

export interface QuickFix {
  description: string;
  code: string;
  confidence: number;
  patternId: string;
  edits: CodeEdit[];
}

export interface CodeEdit {
  range: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
  newText: string;
}

/**
 * Quick fix generator - generates code fixes for pattern violations
 */
export class QuickFixGenerator {
  /**
   * Generate fix for a pattern violation
   */
  async generateFix(violation: PatternViolation): Promise<QuickFix | null> {
    try {
      switch (violation.type) {
        case 'naming_convention':
          return this.generateNamingFix(violation);

        case 'error_handling':
          return this.generateErrorHandlingFix(violation);

        case 'import_organization':
          return this.generateImportOrganizationFix(violation);

        case 'file_location':
          return this.generateFileLocationFix(violation);

        case 'async_pattern':
          return this.generateAsyncPatternFix(violation);

        default:
          Logger.debug(`No fix generator for violation type: ${violation.type}`);
          return null;
      }
    } catch (error) {
      Logger.error('Failed to generate fix:', error);
      return null;
    }
  }

  /**
   * Generate naming convention fix
   */
  private generateNamingFix(violation: PatternViolation): QuickFix {
    const suggestedName = violation.suggestedFix || violation.expectedPattern;

    return {
      description: `Rename to '${suggestedName}' to match ${violation.expectedPattern} convention`,
      code: suggestedName,
      confidence: violation.confidence,
      patternId: violation.pattern.id,
      edits: [
        {
          range: {
            start: {
              line: violation.location?.line || 0,
              column: violation.location?.column || 0,
            },
            end: {
              line: violation.location?.endLine || 0,
              column: violation.location?.endColumn || 0,
            },
          },
          newText: suggestedName,
        },
      ],
    };
  }

  /**
   * Generate error handling fix
   */
  private generateErrorHandlingFix(violation: PatternViolation): QuickFix {
    const currentCode = violation.codeSnippet;
    const expectedPattern = violation.expectedPattern;

    let fixedCode = currentCode;

    // Replace console.log/error with logger.error
    if (expectedPattern.includes('logger.error')) {
      fixedCode = currentCode.replace(
        /console\.(log|error|warn)\s*\(/g,
        'logger.error('
      );
    }

    // Add error rethrowing if missing
    if (expectedPattern.includes('throw') && !currentCode.includes('throw')) {
      const lines = fixedCode.split('\n');
      const lastLine = lines[lines.length - 1];

      if (lastLine.trim() === '}') {
        lines.splice(lines.length - 1, 0, '  throw error;');
        fixedCode = lines.join('\n');
      }
    }

    return {
      description: `Update error handling to use ${expectedPattern}`,
      code: fixedCode,
      confidence: violation.confidence,
      patternId: violation.pattern.id,
      edits: [
        {
          range: {
            start: {
              line: violation.location?.line || 0,
              column: violation.location?.column || 0,
            },
            end: {
              line: violation.location?.endLine || 0,
              column: violation.location?.endColumn || 0,
            },
          },
          newText: fixedCode,
        },
      ],
    };
  }

  /**
   * Generate import organization fix
   */
  private generateImportOrganizationFix(violation: PatternViolation): QuickFix {
    const imports = violation.codeSnippet.split('\n');
    const expectedOrder = violation.expectedPattern.split(', ');

    // Categorize imports
    const categorized: { [key: string]: string[] } = {
      framework: [],
      'third-party': [],
      alias: [],
      relative: [],
    };

    for (const imp of imports) {
      if (imp.includes('react') || imp.includes('vue') || imp.includes('angular')) {
        categorized.framework.push(imp);
      } else if (imp.includes('./') || imp.includes('../')) {
        categorized.relative.push(imp);
      } else if (imp.includes('@/')) {
        categorized.alias.push(imp);
      } else {
        categorized['third-party'].push(imp);
      }
    }

    // Reorder based on expected order
    const reordered: string[] = [];
    for (const category of expectedOrder) {
      if (categorized[category]) {
        reordered.push(...categorized[category].sort());
        if (reordered.length > 0) {
          reordered.push(''); // Add blank line between categories
        }
      }
    }

    const fixedCode = reordered.join('\n').trim();

    return {
      description: 'Reorganize imports to match typical pattern',
      code: fixedCode,
      confidence: violation.confidence,
      patternId: violation.pattern.id,
      edits: [
        {
          range: {
            start: { line: violation.location?.line || 0, column: 0 },
            end: {
              line: violation.location?.endLine || 0,
              column: violation.location?.endColumn || 0,
            },
          },
          newText: fixedCode,
        },
      ],
    };
  }

  /**
   * Generate file location fix
   */
  private generateFileLocationFix(violation: PatternViolation): QuickFix {
    const expectedLocation = violation.expectedPattern;
    const currentPath = violation.codeSnippet;
    const fileName = currentPath.split('/').pop() || '';
    const suggestedPath = `${expectedLocation}/${fileName}`;

    return {
      description: `Move file to ${suggestedPath}`,
      code: suggestedPath,
      confidence: violation.confidence,
      patternId: violation.pattern.id,
      edits: [], // File moves are handled differently
    };
  }

  /**
   * Generate async pattern fix
   */
  private generateAsyncPatternFix(violation: PatternViolation): QuickFix {
    const currentCode = violation.codeSnippet;
    const expectedPattern = violation.expectedPattern;

    let fixedCode = currentCode;

    // Wrap function body in try-catch
    if (expectedPattern === 'try-catch' && !currentCode.includes('try')) {
      const lines = fixedCode.split('\n');
      const funcBodyStart = lines.findIndex(line => line.includes('{'));

      if (funcBodyStart >= 0) {
        const indent = lines[funcBodyStart].match(/^\s*/)?.[0] || '';
        const funcBodyEnd = lines.length - 1;

        // Insert try at function start
        lines.splice(funcBodyStart + 1, 0, `${indent}  try {`);

        // Insert catch before function end
        lines.splice(funcBodyEnd, 0, `${indent}  } catch (error) {`);
        lines.splice(funcBodyEnd + 1, 0, `${indent}    logger.error('Error:', error);`);
        lines.splice(funcBodyEnd + 2, 0, `${indent}    throw error;`);
        lines.splice(funcBodyEnd + 3, 0, `${indent}  }`);

        fixedCode = lines.join('\n');
      }
    }

    return {
      description: 'Add try-catch to async function',
      code: fixedCode,
      confidence: violation.confidence,
      patternId: violation.pattern.id,
      edits: [
        {
          range: {
            start: {
              line: violation.location?.line || 0,
              column: violation.location?.column || 0,
            },
            end: {
              line: violation.location?.endLine || 0,
              column: violation.location?.endColumn || 0,
            },
          },
          newText: fixedCode,
        },
      ],
    };
  }

  /**
   * Apply fix to code
   */
  async applyFix(originalCode: string, fix: QuickFix): Promise<string> {
    let modifiedCode = originalCode;
    const lines = modifiedCode.split('\n');

    // Apply edits in reverse order to maintain line numbers
    const sortedEdits = [...fix.edits].sort(
      (a, b) => b.range.start.line - a.range.start.line
    );

    for (const edit of sortedEdits) {
      const startLine = edit.range.start.line - 1; // Convert to 0-based
      const endLine = edit.range.end.line - 1;
      const startCol = edit.range.start.column;
      const endCol = edit.range.end.column;

      if (startLine === endLine) {
        // Single line edit
        const line = lines[startLine];
        lines[startLine] =
          line.substring(0, startCol) + edit.newText + line.substring(endCol);
      } else {
        // Multi-line edit
        const firstLine = lines[startLine].substring(0, startCol);
        const lastLine = lines[endLine].substring(endCol);
        const newContent = firstLine + edit.newText + lastLine;

        lines.splice(startLine, endLine - startLine + 1, newContent);
      }
    }

    modifiedCode = lines.join('\n');
    return modifiedCode;
  }

  /**
   * Preview fix (returns diff)
   */
  async previewFix(originalCode: string, fix: QuickFix): Promise<string> {
    const modifiedCode = await this.applyFix(originalCode, fix);

    // Generate simple diff
    const originalLines = originalCode.split('\n');
    const modifiedLines = modifiedCode.split('\n');

    const diff: string[] = [];
    diff.push(`--- Original`);
    diff.push(`+++ Fixed (${fix.description})`);
    diff.push('');

    for (let i = 0; i < Math.max(originalLines.length, modifiedLines.length); i++) {
      const originalLine = originalLines[i] || '';
      const modifiedLine = modifiedLines[i] || '';

      if (originalLine !== modifiedLine) {
        if (originalLine) {
          diff.push(`- ${originalLine}`);
        }
        if (modifiedLine) {
          diff.push(`+ ${modifiedLine}`);
        }
      } else if (originalLine) {
        diff.push(`  ${originalLine}`);
      }
    }

    return diff.join('\n');
  }

  /**
   * Generate multiple fix options
   */
  async generateFixOptions(violation: PatternViolation): Promise<QuickFix[]> {
    const fixes: QuickFix[] = [];

    const primaryFix = await this.generateFix(violation);
    if (primaryFix) {
      fixes.push(primaryFix);
    }

    // Generate alternative fixes based on violation type
    if (violation.type === 'naming_convention') {
      // Could offer multiple naming conventions
      const alternatives = this.generateAlternativeNamingFixes(violation);
      fixes.push(...alternatives);
    }

    return fixes;
  }

  /**
   * Generate alternative naming fixes
   */
  private generateAlternativeNamingFixes(violation: PatternViolation): QuickFix[] {
    const fixes: QuickFix[] = [];
    const originalName = violation.codeSnippet;

    // Generate fixes for different conventions
    const conventions = ['camelCase', 'PascalCase', 'snake_case'];

    for (const convention of conventions) {
      if (convention !== violation.expectedPattern) {
        const convertedName = NamingConventions.convert(originalName, convention);

        fixes.push({
          description: `Alternative: Use ${convention} convention`,
          code: convertedName,
          confidence: violation.confidence * 0.7, // Lower confidence for alternatives
          patternId: violation.pattern.id,
          edits: [
            {
              range: {
                start: {
                  line: violation.location?.line || 0,
                  column: violation.location?.column || 0,
                },
                end: {
                  line: violation.location?.endLine || 0,
                  column: violation.location?.endColumn || 0,
                },
              },
              newText: convertedName,
            },
          ],
        });
      }
    }

    return fixes;
  }

  /**
   * Batch apply fixes
   */
  async applyFixesBatch(
    code: string,
    fixes: QuickFix[]
  ): Promise<{ code: string; appliedFixes: QuickFix[] }> {
    let modifiedCode = code;
    const appliedFixes: QuickFix[] = [];

    // Sort fixes by position (reverse order to maintain line numbers)
    const sortedFixes = [...fixes].sort((a, b) => {
      const aStart = a.edits[0]?.range.start.line || 0;
      const bStart = b.edits[0]?.range.start.line || 0;
      return bStart - aStart;
    });

    for (const fix of sortedFixes) {
      try {
        modifiedCode = await this.applyFix(modifiedCode, fix);
        appliedFixes.push(fix);
      } catch (error) {
        Logger.error('Failed to apply fix:', error);
      }
    }

    return { code: modifiedCode, appliedFixes };
  }
}
