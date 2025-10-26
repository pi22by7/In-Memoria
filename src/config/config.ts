/**
 * Configuration management for In Memoria
 * Centralizes all configuration with proper defaults and validation
 */

import { join } from 'path';
import { existsSync } from 'fs';
import { Logger } from '../utils/logger.js';

export interface InMemoriaConfig {
  // Database configuration - always relative to analyzed project
  database: {
    filename: string;
    path?: string; // Optional override for project path
    connectionPoolSize?: number;
    busyTimeout?: number;
  };
  
  // Performance configuration
  performance: {
    batchSize: number;
    maxConcurrentFiles: number;
    fileOperationTimeout: number;
    cacheSize: number;
  };
  
  // API configuration
  api: {
    openaiApiKey?: string;
    requestTimeout: number;
    rateLimitRequests: number;
    rateLimitWindow: number; // in milliseconds
  };
  
  // Analysis configuration
  analysis: {
    supportedLanguages: string[];
    maxFileSize: number; // in bytes
    skipDirectories: string[];
    skipFilePatterns: string[];
  };
  
  // Logging configuration
  logging: {
    level: 'error' | 'warn' | 'info' | 'debug';
    enablePerformanceLogging: boolean;
  };
}

const DEFAULT_CONFIG: InMemoriaConfig = {
  database: {
    filename: 'in-memoria.db', // Standardized filename as per your requirement
    connectionPoolSize: 10,
    busyTimeout: 30000
  },
  
  performance: {
    batchSize: 50,
    maxConcurrentFiles: 10,
    fileOperationTimeout: 30000,
    cacheSize: 1000
  },
  
  api: {
    openaiApiKey: process.env.OPENAI_API_KEY,
    requestTimeout: 30000,
    rateLimitRequests: 50,
    rateLimitWindow: 60000 // 1 minute
  },
  
  analysis: {
    supportedLanguages: [
      'javascript', 'typescript', 'python', 'rust', 'go', 'java', 
      'cpp', 'c', 'csharp', 'svelte', 'sql'
    ],
    maxFileSize: 5 * 1024 * 1024, // 5MB
    skipDirectories: [
      'node_modules', '.git', '.vscode', '.idea', 'dist', 'build', 
      'target', '__pycache__', '.next', '.nuxt'
    ],
    skipFilePatterns: [
      '*.log', '*.tmp', '*.cache', '*.lock', '*.map', '*.min.js',
      '*.bundle.js', '*.chunk.js'
    ]
  },
  
  logging: {
    level: 'info',
    enablePerformanceLogging: false
  }
};

export class ConfigManager {
  private static instance: ConfigManager;
  private config: InMemoriaConfig;
  
  private constructor() {
    this.config = { ...DEFAULT_CONFIG };
    this.loadFromEnvironment();
  }
  
  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }
  
  getConfig(): InMemoriaConfig {
    return { ...this.config };
  }
  
  /**
   * Get database path for a specific project
   * Always places the database within the analyzed project directory
   */
  getDatabasePath(projectPath?: string): string {
    const basePath = projectPath || process.cwd();
    const filename = this.config.database.filename;
    
    // Warn if filename contains path separators (indicates misconfiguration)
    if (filename.includes('/') || filename.includes('\\')) {
      Logger.warn(
        '⚠️  Warning: IN_MEMORIA_DB_FILENAME contains path separators.\n' +
        `   Current: "${filename}"\n` +
        '   This may cause issues. Consider using a simple filename.\n' +
        `   The database directory is determined by the project path: ${basePath}\n` +
        '   Example: Set IN_MEMORIA_DB_FILENAME="in-memoria.db" instead of a path.'
      );
    }
    
    const dbPath = join(basePath, filename);
    Logger.info(`📁 Database path resolved to: ${dbPath}`);
    return dbPath;
  }
  
  /**
   * Update configuration at runtime
   */
  updateConfig(partial: Partial<InMemoriaConfig>): void {
    this.config = { ...this.config, ...partial };
  }
  
  /**
   * Validate configuration for common issues
   */
  validateConfig(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Validate performance settings
    if (this.config.performance.batchSize <= 0) {
      errors.push('performance.batchSize must be greater than 0');
    }
    
    if (this.config.performance.maxConcurrentFiles <= 0) {
      errors.push('performance.maxConcurrentFiles must be greater than 0');
    }
    
    // Validate API settings
    if (this.config.api.rateLimitRequests <= 0) {
      errors.push('api.rateLimitRequests must be greater than 0');
    }
    
    // Validate analysis settings
    if (this.config.analysis.maxFileSize <= 0) {
      errors.push('analysis.maxFileSize must be greater than 0');
    }
    
    // Validate database filename
    if (!this.config.database.filename || this.config.database.filename.trim() === '') {
      errors.push('database.filename cannot be empty');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Load configuration from environment variables
   */
  private loadFromEnvironment(): void {
    // Database configuration
    if (process.env.IN_MEMORIA_DB_FILENAME) {
      this.config.database.filename = process.env.IN_MEMORIA_DB_FILENAME;
    }
    
    // Performance configuration
    if (process.env.IN_MEMORIA_BATCH_SIZE) {
      this.config.performance.batchSize = parseInt(process.env.IN_MEMORIA_BATCH_SIZE, 10);
    }
    
    if (process.env.IN_MEMORIA_MAX_CONCURRENT) {
      this.config.performance.maxConcurrentFiles = parseInt(process.env.IN_MEMORIA_MAX_CONCURRENT, 10);
    }
    
    // API configuration
    if (process.env.OPENAI_API_KEY) {
      this.config.api.openaiApiKey = process.env.OPENAI_API_KEY;
    }
    
    if (process.env.IN_MEMORIA_REQUEST_TIMEOUT) {
      this.config.api.requestTimeout = parseInt(process.env.IN_MEMORIA_REQUEST_TIMEOUT, 10);
    }
    
    // Logging configuration
    if (process.env.IN_MEMORIA_LOG_LEVEL) {
      const level = process.env.IN_MEMORIA_LOG_LEVEL.toLowerCase();
      if (['error', 'warn', 'info', 'debug'].includes(level)) {
        this.config.logging.level = level as any;
      }
    }
    
    if (process.env.IN_MEMORIA_PERFORMANCE_LOGGING === 'true') {
      this.config.logging.enablePerformanceLogging = true;
    }
  }
  
  /**
   * Get environment-specific configuration hints
   */
  getConfigurationHelp(): string[] {
    return [
      'Environment Variables:',
      '  IN_MEMORIA_DB_FILENAME - Database filename (default: in-memoria.db)',
      '  IN_MEMORIA_BATCH_SIZE - File processing batch size (default: 50)',
      '  IN_MEMORIA_MAX_CONCURRENT - Max concurrent file operations (default: 10)',
      '  IN_MEMORIA_REQUEST_TIMEOUT - API request timeout in ms (default: 30000)',
      '  IN_MEMORIA_LOG_LEVEL - Logging level: error|warn|info|debug (default: info)',
      '  IN_MEMORIA_PERFORMANCE_LOGGING - Enable performance logging (default: false)',
      '  OPENAI_API_KEY - OpenAI API key for enhanced features',
      '',
      'Note: Database is always created within the analyzed project directory'
    ];
  }
}

// Export singleton instance
export const config = ConfigManager.getInstance();