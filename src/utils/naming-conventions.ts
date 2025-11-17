/**
 * Naming Convention Utilities
 *
 * Provides utilities for converting identifiers between different naming conventions.
 * Extracted from pattern-conflict-detector.ts and quick-fix-generator.ts to eliminate duplication.
 */

export type NamingConvention =
  | 'camelCase'
  | 'PascalCase'
  | 'snake_case'
  | 'SCREAMING_SNAKE_CASE'
  | 'kebab-case';

export class NamingConventions {
  /**
   * Convert identifier name between naming conventions
   *
   * @example
   * convert('myVariableName', 'snake_case') // => 'my_variable_name'
   * convert('my-variable-name', 'PascalCase') // => 'MyVariableName'
   */
  static convert(name: string, targetConvention: NamingConvention | string): string {
    // Split name into words
    const words = name
      .replace(/([A-Z])/g, ' $1')
      .replace(/[_-]/g, ' ')
      .trim()
      .toLowerCase()
      .split(/\s+/);

    switch (targetConvention) {
      case 'camelCase':
        return words[0] + words.slice(1).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
      case 'PascalCase':
        return words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
      case 'snake_case':
        return words.join('_');
      case 'SCREAMING_SNAKE_CASE':
        return words.join('_').toUpperCase();
      case 'kebab-case':
        return words.join('-');
      default:
        return name;
    }
  }

  /**
   * Detect the naming convention of an identifier
   *
   * @example
   * detect('myVariable') // => 'camelCase'
   * detect('MyClass') // => 'PascalCase'
   * detect('my_variable') // => 'snake_case'
   */
  static detect(name: string): NamingConvention | 'mixed' | 'unknown' {
    if (!name || name.length === 0) return 'unknown';

    // Check for specific patterns
    if (/^[a-z][a-zA-Z0-9]*$/.test(name)) return 'camelCase';
    if (/^[A-Z][a-zA-Z0-9]*$/.test(name)) return 'PascalCase';
    if (/^[a-z][a-z0-9_]*$/.test(name)) return 'snake_case';
    if (/^[A-Z][A-Z0-9_]*$/.test(name)) return 'SCREAMING_SNAKE_CASE';
    if (/^[a-z][a-z0-9-]*$/.test(name)) return 'kebab-case';

    return 'mixed';
  }

  /**
   * Check if a name follows a specific naming convention
   */
  static matches(name: string, convention: NamingConvention): boolean {
    return this.detect(name) === convention;
  }
}
