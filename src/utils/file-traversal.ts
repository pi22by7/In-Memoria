/**
 * File Traversal Utilities
 *
 * Provides utilities for recursively traversing directories, counting files,
 * and collecting file paths with support for ignore patterns.
 *
 * Extracted from automation-tools.ts, semantic-engine.ts, and pattern-engine.ts
 * to eliminate triplication.
 */

import { glob } from 'glob';

export interface TraversalOptions {
  /**
   * Maximum recursion depth (default: unlimited)
   * IMPORTANT: Set this for safety/performance when scanning untrusted directories
   * Recommended: maxDepth=5 for most use cases
   */
  maxDepth?: number;

  /** File extensions to include (e.g., ['ts', 'js', 'py']) */
  extensions?: string[];

  /** Additional patterns to ignore beyond STANDARD_IGNORE_PATTERNS */
  ignorePatterns?: string[];

  /** Whether to include hidden files/directories */
  includeHidden?: boolean;

  /** Use standard ignore patterns (default: true) */
  useStandardIgnores?: boolean;
}

export class FileTraversal {
  /**
   * Standard ignore patterns for common non-code directories
   * Comprehensive list covering most development ecosystems
   */
  static readonly STANDARD_IGNORE_PATTERNS = [
    // Package managers and dependencies
    '**/node_modules/**',
    '**/bower_components/**',
    '**/jspm_packages/**',
    '**/vendor/**',

    // Version control
    '**/.git/**',
    '**/.svn/**',
    '**/.hg/**',

    // Build outputs and artifacts
    '**/dist/**',
    '**/build/**',
    '**/out/**',
    '**/output/**',
    '**/target/**',
    '**/bin/**',
    '**/obj/**',
    '**/Debug/**',
    '**/Release/**',

    // Framework-specific build directories
    '**/.next/**',
    '**/.nuxt/**',
    '**/.svelte-kit/**',
    '**/.vitepress/**',
    '**/_site/**',

    // Static assets and public files
    '**/public/**',
    '**/static/**',
    '**/assets/**',

    // Testing and coverage
    '**/coverage/**',
    '**/.coverage/**',
    '**/htmlcov/**',
    '**/.pytest_cache/**',
    '**/.nyc_output/**',
    '**/nyc_output/**',
    '**/lib-cov/**',

    // Python environments and cache
    '**/__pycache__/**',
    '**/.venv/**',
    '**/venv/**',
    '**/env/**',
    '**/.env/**',

    // Temporary and cache directories
    '**/tmp/**',
    '**/temp/**',
    '**/.tmp/**',
    '**/cache/**',
    '**/.cache/**',
    '**/logs/**',
    '**/.logs/**',

    // Generated/minified files
    '**/*.min.js',
    '**/*.min.css',
    '**/*.bundle.js',
    '**/*.chunk.js',
    '**/*.map',

    // Lock files
    '**/package-lock.json',
    '**/yarn.lock',
    '**/Cargo.lock',
    '**/Gemfile.lock',
    '**/Pipfile.lock',
    '**/poetry.lock',
  ];

  /**
   * Code file extensions
   */
  static readonly CODE_EXTENSIONS = [
    'ts',
    'tsx',
    'js',
    'jsx',
    'py',
    'rs',
    'go',
    'java',
    'c',
    'cpp',
    'h',
    'hpp',
    'cs',
    'php',
    'rb',
    'swift',
    'kt',
    'svelte',
    'vue',
  ];

  /**
   * Count total files and code files in project
   *
   * @param path - Root path to count from
   * @returns Object with total and codeFiles counts
   *
   * @example
   * const { total, codeFiles } = await FileTraversal.countProjectFiles('/path/to/project');
   * console.log(`Found ${codeFiles} code files out of ${total} total files`);
   */
  static async countProjectFiles(
    path: string
  ): Promise<{ total: number; codeFiles: number }> {
    try {
      const allFiles = await glob('**/*', {
        cwd: path,
        ignore: this.STANDARD_IGNORE_PATTERNS,
        nodir: true,
      });

      const codeFiles = allFiles.filter((file) => {
        const ext = file.split('.').pop()?.toLowerCase();
        return ext && this.CODE_EXTENSIONS.includes(ext);
      });

      return {
        total: allFiles.length,
        codeFiles: codeFiles.length,
      };
    } catch (error) {
      return { total: 0, codeFiles: 0 };
    }
  }

  /**
   * Recursively collect files matching criteria
   *
   * @param dirPath - Directory to search
   * @param options - Traversal options
   * @returns Array of file paths
   *
   * @example
   * // Collect all TypeScript files
   * const files = await FileTraversal.collectFiles('/path/to/project', {
   *   extensions: ['ts', 'tsx']
   * });
   *
   * // Collect with custom ignores and depth limit
   * const files = await FileTraversal.collectFiles('/path/to/project', {
   *   extensions: ['js'],
   *   ignorePatterns: ['test', '*.spec.js'],
   *   maxDepth: 5
   * });
   */
  static async collectFiles(
    dirPath: string,
    options: TraversalOptions = {}
  ): Promise<string[]> {
    const {
      extensions = [],
      ignorePatterns = [],
      useStandardIgnores = true,
      maxDepth,
    } = options;

    try {
      // Build combined ignore patterns
      const allIgnores = useStandardIgnores
        ? [...this.STANDARD_IGNORE_PATTERNS, ...ignorePatterns]
        : ignorePatterns;

      // Build glob pattern for extensions
      let pattern = '**/*';
      if (extensions.length > 0) {
        if (extensions.length === 1) {
          pattern = `**/*.${extensions[0]}`;
        } else {
          pattern = `**/*.{${extensions.join(',')}}`;
        }
      }

      const files = await glob(pattern, {
        cwd: dirPath,
        ignore: allIgnores,
        nodir: true,
      });

      // Apply maxDepth filter if specified
      if (maxDepth !== undefined) {
        return files.filter((file) => {
          const depth = file.split('/').length - 1;
          return depth <= maxDepth;
        });
      }

      return files;
    } catch (error) {
      return [];
    }
  }

  /**
   * Check if a path should be ignored based on ignore patterns
   *
   * @param path - Path to check
   * @param ignorePatterns - Patterns to check against
   * @returns True if path should be ignored
   *
   * @example
   * FileTraversal.shouldIgnore('node_modules/foo/bar.js', FileTraversal.STANDARD_IGNORE_PATTERNS);
   * // => true
   */
  static shouldIgnore(path: string, ignorePatterns: string[]): boolean {
    const normalizedPath = path.replace(/\\/g, '/');
    return ignorePatterns.some((pattern) => {
      const regexPattern = pattern
        .replace(/\*\*/g, '.*')
        .replace(/\*/g, '[^/]*')
        .replace(/\//g, '\\/');
      const regex = new RegExp(`^${regexPattern}$`);
      return regex.test(normalizedPath);
    });
  }

  /**
   * Get all code files in a directory
   * Convenience method that combines collectFiles with CODE_EXTENSIONS
   *
   * @param dirPath - Directory to search
   * @param additionalExtensions - Additional extensions beyond CODE_EXTENSIONS
   * @returns Array of code file paths
   *
   * @example
   * const codeFiles = await FileTraversal.collectCodeFiles('/path/to/project');
   */
  static async collectCodeFiles(
    dirPath: string,
    additionalExtensions: string[] = []
  ): Promise<string[]> {
    return this.collectFiles(dirPath, {
      extensions: [...this.CODE_EXTENSIONS, ...additionalExtensions],
    });
  }
}
