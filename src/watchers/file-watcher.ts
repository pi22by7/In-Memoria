import * as chokidar from 'chokidar';
import { EventEmitter } from 'eventemitter3';
import { createHash } from 'crypto';
import { readFileSync, statSync } from 'fs';
import { join, extname } from 'path';

export interface FileChange {
  type: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir';
  path: string;
  stats?: {
    size: number;
    mtime: Date;
    isDirectory: boolean;
  };
  content?: string;
  hash?: string;
  language?: string;
}

export interface WatcherOptions {
  patterns: string[];
  ignored?: string[];
  debounceMs?: number;
  includeContent?: boolean;
  persistent?: boolean;
}

export class FileWatcher extends EventEmitter {
  private watcher: chokidar.FSWatcher | null = null;
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private fileHashes: Map<string, string> = new Map();
  private options: Required<WatcherOptions>;

  constructor(options: WatcherOptions) {
    super();
    
    this.options = {
      patterns: options.patterns,
      ignored: options.ignored || [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
        '**/.next/**',
        '**/target/**',
        '**/*.log'
      ],
      debounceMs: options.debounceMs || 500,
      includeContent: options.includeContent ?? true,
      persistent: options.persistent ?? true
    };
  }

  startWatching(): void {
    if (this.watcher) {
      this.stopWatching();
    }

    this.watcher = chokidar.watch(this.options.patterns, {
      ignored: this.options.ignored,
      ignoreInitial: false,
      persistent: this.options.persistent,
      followSymlinks: false,
      atomic: true,
      alwaysStat: true,
      depth: undefined,
      interval: 100,
      binaryInterval: 300,
      usePolling: false,
      awaitWriteFinish: {
        stabilityThreshold: 200,
        pollInterval: 100
      }
    });

    this.setupEventHandlers();
    this.emit('watcher:started', { patterns: this.options.patterns });
  }

  stopWatching(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }

    // Clear all debounce timers
    this.debounceTimers.forEach(timer => clearTimeout(timer));
    this.debounceTimers.clear();

    this.emit('watcher:stopped');
  }

  isWatching(): boolean {
    return this.watcher !== null;
  }

  getWatchedPaths(): string[] {
    return this.watcher ? this.watcher.getWatched() as any : [];
  }

  addPath(path: string): void {
    if (this.watcher) {
      this.watcher.add(path);
    }
  }

  removePath(path: string): void {
    if (this.watcher) {
      this.watcher.unwatch(path);
    }
  }

  private setupEventHandlers(): void {
    if (!this.watcher) return;

    this.watcher.on('add', (path, stats) => {
      this.handleFileChange('add', path, stats);
    });

    this.watcher.on('change', (path, stats) => {
      this.handleFileChange('change', path, stats);
    });

    this.watcher.on('unlink', (path) => {
      this.handleFileChange('unlink', path);
      this.fileHashes.delete(path);
    });

    this.watcher.on('addDir', (path, stats) => {
      this.handleFileChange('addDir', path, stats);
    });

    this.watcher.on('unlinkDir', (path) => {
      this.handleFileChange('unlinkDir', path);
    });

    this.watcher.on('error', (error) => {
      this.emit('watcher:error', error);
    });

    this.watcher.on('ready', () => {
      this.emit('watcher:ready');
    });
  }

  private handleFileChange(
    type: FileChange['type'], 
    path: string, 
    stats?: any
  ): void {
    // Clear existing debounce timer for this path
    const existingTimer = this.debounceTimers.get(path);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new debounce timer
    const timer = setTimeout(async () => {
      this.debounceTimers.delete(path);
      
      try {
        const change = await this.buildFileChange(type, path, stats);
        
        // Skip if content hasn't actually changed (for change events)
        if (type === 'change' && !this.hasContentChanged(path, change.hash)) {
          return;
        }

        // Update hash for file content tracking
        if (change.hash && !change.stats?.isDirectory) {
          this.fileHashes.set(path, change.hash);
        }

        this.emit('file:change', change);
        this.emit(`file:${type}`, change);
        
        // Emit specific events for different file types
        if (change.language) {
          this.emit(`file:${change.language}:${type}`, change);
        }

      } catch (error) {
        this.emit('watcher:error', {
          message: `Failed to process file change: ${path}`,
          error,
          path,
          type
        });
      }
    }, this.options.debounceMs);

    this.debounceTimers.set(path, timer);
  }

  private async buildFileChange(
    type: FileChange['type'],
    path: string,
    stats?: any
  ): Promise<FileChange> {
    const change: FileChange = { type, path };

    // Add stats if available
    if (stats) {
      change.stats = {
        size: stats.size,
        mtime: stats.mtime,
        isDirectory: stats.isDir()
      };
    }

    // For file operations (not directories), add content and metadata
    if (type !== 'unlinkDir' && type !== 'addDir') {
      try {
        const actualStats = stats || statSync(path);
        
        if (!actualStats.isDirectory()) {
          change.language = this.detectLanguage(path);
          
          if (this.options.includeContent && this.isTextFile(path)) {
            change.content = readFileSync(path, 'utf-8');
            change.hash = this.calculateHash(change.content);
          } else if (!this.options.includeContent) {
            // Calculate hash from file stats for binary files or when content is disabled
            const statsString = `${actualStats.size}-${actualStats.mtime.getTime()}`;
            change.hash = this.calculateHash(statsString);
          }
        }
      } catch (error) {
        // File might have been deleted between stat and read
        if (type !== 'unlink') {
          throw error;
        }
      }
    }

    return change;
  }

  private hasContentChanged(path: string, newHash?: string): boolean {
    if (!newHash) return true;
    
    const oldHash = this.fileHashes.get(path);
    return oldHash !== newHash;
  }

  private detectLanguage(filePath: string): string {
    const ext = extname(filePath).toLowerCase();
    const languageMap: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.py': 'python',
      '.rs': 'rust',
      '.go': 'go',
      '.java': 'java',
      '.cpp': 'cpp',
      '.cc': 'cpp',
      '.cxx': 'cpp',
      '.c': 'c',
      '.h': 'c',
      '.hpp': 'cpp',
      '.cs': 'csharp',
      '.php': 'php',
      '.rb': 'ruby',
      '.swift': 'swift',
      '.kt': 'kotlin',
      '.scala': 'scala',
      '.clj': 'clojure',
      '.hs': 'haskell',
      '.ml': 'ocaml',
      '.fs': 'fsharp',
      '.elm': 'elm',
      '.dart': 'dart',
      '.r': 'r',
      '.jl': 'julia',
      '.lua': 'lua',
      '.pl': 'perl',
      '.sh': 'bash',
      '.ps1': 'powershell',
      '.sql': 'sql',
      '.html': 'html',
      '.css': 'css',
      '.scss': 'scss',
      '.sass': 'sass',
      '.less': 'less',
      '.json': 'json',
      '.xml': 'xml',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.toml': 'toml',
      '.ini': 'ini',
      '.cfg': 'ini',
      '.conf': 'conf',
      '.md': 'markdown',
      '.rst': 'rst',
      '.tex': 'latex'
    };

    return languageMap[ext] || 'unknown';
  }

  private isTextFile(filePath: string): boolean {
    const textExtensions = new Set([
      '.ts', '.tsx', '.js', '.jsx', '.py', '.rs', '.go', '.java',
      '.cpp', '.cc', '.cxx', '.c', '.h', '.hpp', '.cs', '.php',
      '.rb', '.swift', '.kt', '.scala', '.clj', '.hs', '.ml',
      '.fs', '.elm', '.dart', '.r', '.jl', '.lua', '.pl',
      '.sh', '.ps1', '.sql', '.html', '.css', '.scss', '.sass',
      '.less', '.json', '.xml', '.yaml', '.yml', '.toml',
      '.ini', '.cfg', '.conf', '.md', '.rst', '.tex', '.txt',
      '.log', '.gitignore', '.dockerignore', '.editorconfig'
    ]);

    const ext = extname(filePath).toLowerCase();
    return textExtensions.has(ext);
  }

  private calculateHash(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  // Utility methods for advanced filtering
  addIgnorePattern(pattern: string): void {
    if (this.watcher) {
      // Note: chokidar doesn't support dynamic ignore pattern updates
      // This would require restarting the watcher
      console.warn('Dynamic ignore pattern updates require restarting the watcher');
    }
  }

  getFileStats(): {
    totalWatched: number;
    byLanguage: Record<string, number>;
    byType: Record<string, number>;
  } {
    const stats = {
      totalWatched: this.options.patterns.length,
      byLanguage: {} as Record<string, number>,
      byType: {} as Record<string, number>
    };

    // Analyze patterns to determine file types and languages
    this.options.patterns.forEach(pattern => {
      if (pattern.includes('*.ts')) {
        stats.byLanguage['typescript'] = (stats.byLanguage['typescript'] || 0) + 1;
        stats.byType['source'] = (stats.byType['source'] || 0) + 1;
      } else if (pattern.includes('*.js')) {
        stats.byLanguage['javascript'] = (stats.byLanguage['javascript'] || 0) + 1;
        stats.byType['source'] = (stats.byType['source'] || 0) + 1;
      } else if (pattern.includes('*.py')) {
        stats.byLanguage['python'] = (stats.byLanguage['python'] || 0) + 1;
        stats.byType['source'] = (stats.byType['source'] || 0) + 1;
      } else if (pattern.includes('*.rs')) {
        stats.byLanguage['rust'] = (stats.byLanguage['rust'] || 0) + 1;
        stats.byType['source'] = (stats.byType['source'] || 0) + 1;
      } else if (pattern.includes('*.php')) {
        stats.byLanguage['php'] = (stats.byLanguage['php'] || 0) + 1;
        stats.byType['source'] = (stats.byType['source'] || 0) + 1;
      } else {
        stats.byType['other'] = (stats.byType['other'] || 0) + 1;
      }
    });

    return stats;
  }
}