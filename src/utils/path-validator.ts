import { existsSync } from 'fs';
import { resolve, isAbsolute } from 'path';
import { Logger } from './logger.js';

/**
 * Utility class for validating and resolving project paths
 * Used across MCP tools to ensure consistent path handling
 */
export class PathValidator {
  /**
   * Validate and resolve a path for tool usage
   * @param path - The path to validate
   * @param context - Context for error messages (e.g., tool name)
   * @returns Resolved absolute path
   * @throws Error if path is invalid
   */
  static validateProjectPath(path: string | undefined, context: string): string {
    // If no path provided, use cwd but warn
    if (!path) {
      const cwd = process.cwd();
      Logger.warn(
        `⚠️  Warning: No path provided to ${context}.\n` +
        `   Using current directory: ${cwd}\n` +
        '   This may not be the intended project directory in MCP context.\n' +
        '   Please provide an explicit path parameter to avoid issues.'
      );
      return cwd;
    }

    // Resolve to absolute path
    const absolutePath = isAbsolute(path) ? path : resolve(process.cwd(), path);

    // Check if path exists
    if (!existsSync(absolutePath)) {
      throw new Error(
        `Invalid path for ${context}: ${absolutePath}\n` +
        'Path does not exist. Please provide a valid project directory path.'
      );
    }

    return absolutePath;
  }

  /**
   * Check if a path looks like a project root
   * (contains package.json, .git, or other project markers)
   * @param path - The path to check
   * @returns true if path looks like a project root
   */
  static looksLikeProjectRoot(path: string): boolean {
    const markers = [
      'package.json',      // Node.js/JavaScript
      'Cargo.toml',        // Rust
      'go.mod',            // Go
      'requirements.txt',  // Python (pip)
      'pyproject.toml',    // Python (modern)
      '.git',              // Git repository
      'pom.xml',           // Java (Maven)
      'build.gradle',      // Java/Kotlin (Gradle)
      'composer.json',     // PHP
      'Gemfile',           // Ruby
      'CMakeLists.txt',    // C/C++
      'Makefile'           // Generic
    ];

    return markers.some(marker => {
      try {
        return existsSync(resolve(path, marker));
      } catch {
        return false;
      }
    });
  }

  /**
   * Validate path and warn if it doesn't look like a project root
   * @param path - The path to validate
   * @param context - Context for error messages
   * @returns Validated absolute path
   */
  static validateAndWarnProjectPath(path: string | undefined, context: string): string {
    const validatedPath = this.validateProjectPath(path, context);

    if (!this.looksLikeProjectRoot(validatedPath)) {
      Logger.warn(
        `⚠️  Warning: ${validatedPath} doesn't look like a project root.\n` +
        '   No package.json, Cargo.toml, .git, or other project markers found.\n' +
        '   Make sure you\'re pointing to the correct directory.\n' +
        `   Tool: ${context}`
      );
    }

    return validatedPath;
  }

  /**
   * Get a human-readable description of what's at the path
   * @param path - The path to describe
   * @returns Description string
   */
  static describePath(path: string): string {
    if (!existsSync(path)) {
      return 'Path does not exist';
    }

    const markers = [];
    
    if (existsSync(resolve(path, 'package.json'))) {
      markers.push('Node.js project');
    }
    if (existsSync(resolve(path, 'Cargo.toml'))) {
      markers.push('Rust project');
    }
    if (existsSync(resolve(path, '.git'))) {
      markers.push('Git repository');
    }
    if (existsSync(resolve(path, 'pyproject.toml')) || existsSync(resolve(path, 'requirements.txt'))) {
      markers.push('Python project');
    }
    if (existsSync(resolve(path, 'go.mod'))) {
      markers.push('Go project');
    }

    if (markers.length === 0) {
      return 'Directory (no project markers detected)';
    }

    return markers.join(', ');
  }
}
