import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { join, relative, resolve } from 'path';
import { getLogger } from '../utils/logger.js';

const execAsync = promisify(exec);
const logger = getLogger();

export interface GitChange {
  type: 'added' | 'modified' | 'deleted' | 'renamed';
  path: string;
  oldPath?: string;  // For renames
  commitSha?: string;
  commitMessage?: string;
  timestamp?: number;
}

export interface GitCommit {
  sha: string;
  message: string;
  author: string;
  email: string;
  timestamp: number;
  filesChanged: string[];
}

export interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  staged: string[];
  modified: string[];
  untracked: string[];
}

/**
 * Service for integrating with Git repositories.
 * Provides change detection, commit tracking, and repository monitoring.
 */
export class GitIntegrationService {
  private repoPath: string;
  private isRepo: boolean = false;

  constructor(repoPath: string) {
    this.repoPath = resolve(repoPath);
  }

  /**
   * Initialize and verify this is a git repository
   */
  async initialize(): Promise<boolean> {
    this.isRepo = await this.isGitRepository(this.repoPath);
    if (!this.isRepo) {
      logger.debug(`Not a git repository: ${this.repoPath}`);
    }
    return this.isRepo;
  }

  /**
   * Check if a path is a git repository
   */
  async isGitRepository(path: string): Promise<boolean> {
    try {
      const gitDir = join(path, '.git');
      if (!existsSync(gitDir)) {
        return false;
      }

      const { stdout } = await execAsync('git rev-parse --is-inside-work-tree', {
        cwd: path,
      });
      return stdout.trim() === 'true';
    } catch (error) {
      return false;
    }
  }

  /**
   * Get the repository root path
   */
  async getRepositoryRoot(): Promise<string | null> {
    if (!this.isRepo) return null;

    try {
      const { stdout } = await execAsync('git rev-parse --show-toplevel', {
        cwd: this.repoPath,
      });
      return stdout.trim();
    } catch (error) {
      logger.error('Failed to get repository root:', error);
      return null;
    }
  }

  /**
   * Get files changed since a specific commit, branch, or tag
   */
  async getChangedFiles(since?: string): Promise<GitChange[]> {
    if (!this.isRepo) {
      logger.warn('Not a git repository, cannot get changed files');
      return [];
    }

    try {
      // If no 'since' provided, get uncommitted changes
      if (!since) {
        return this.getUncommittedChanges();
      }

      // Get changes between since and HEAD
      const { stdout } = await execAsync(
        `git diff --name-status ${since}...HEAD`,
        { cwd: this.repoPath }
      );

      return this.parseGitDiffOutput(stdout);
    } catch (error) {
      logger.error('Failed to get changed files:', error);
      return [];
    }
  }

  /**
   * Get uncommitted changes (staged and unstaged)
   */
  async getUncommittedChanges(): Promise<GitChange[]> {
    if (!this.isRepo) return [];

    try {
      // Get staged changes
      const { stdout: stagedOutput } = await execAsync(
        'git diff --name-status --cached',
        { cwd: this.repoPath }
      );

      // Get unstaged changes
      const { stdout: unstagedOutput } = await execAsync(
        'git diff --name-status',
        { cwd: this.repoPath }
      );

      // Get untracked files
      const { stdout: untrackedOutput } = await execAsync(
        'git ls-files --others --exclude-standard',
        { cwd: this.repoPath }
      );

      const changes: GitChange[] = [];

      // Parse staged and unstaged
      changes.push(...this.parseGitDiffOutput(stagedOutput));
      changes.push(...this.parseGitDiffOutput(unstagedOutput));

      // Parse untracked
      const untrackedFiles = untrackedOutput
        .split('\n')
        .filter(line => line.trim())
        .map(path => ({
          type: 'added' as const,
          path: path.trim(),
        }));

      changes.push(...untrackedFiles);

      // Deduplicate by path (prefer staged over unstaged)
      const uniqueChanges = new Map<string, GitChange>();
      for (const change of changes) {
        if (!uniqueChanges.has(change.path)) {
          uniqueChanges.set(change.path, change);
        }
      }

      return Array.from(uniqueChanges.values());
    } catch (error) {
      logger.error('Failed to get uncommitted changes:', error);
      return [];
    }
  }

  /**
   * Parse git diff --name-status output
   */
  private parseGitDiffOutput(output: string): GitChange[] {
    const changes: GitChange[] = [];
    const lines = output.split('\n').filter(line => line.trim());

    for (const line of lines) {
      const parts = line.split('\t');
      if (parts.length < 2) continue;

      const status = parts[0];
      const path = parts[1];
      const oldPath = parts[2]; // For renames

      let type: GitChange['type'];
      if (status.startsWith('A')) {
        type = 'added';
      } else if (status.startsWith('M')) {
        type = 'modified';
      } else if (status.startsWith('D')) {
        type = 'deleted';
      } else if (status.startsWith('R')) {
        type = 'renamed';
      } else {
        continue; // Skip unknown status
      }

      changes.push({
        type,
        path,
        oldPath: type === 'renamed' ? oldPath : undefined,
      });
    }

    return changes;
  }

  /**
   * Get current commit information
   */
  async getCurrentCommit(): Promise<GitCommit | null> {
    if (!this.isRepo) return null;

    try {
      const { stdout } = await execAsync(
        'git log -1 --pretty=format:"%H%n%s%n%an%n%ae%n%ct"',
        { cwd: this.repoPath }
      );

      const lines = stdout.split('\n');
      if (lines.length < 5) return null;

      return {
        sha: lines[0],
        message: lines[1],
        author: lines[2],
        email: lines[3],
        timestamp: parseInt(lines[4]) * 1000,
        filesChanged: [],
      };
    } catch (error) {
      logger.error('Failed to get current commit:', error);
      return null;
    }
  }

  /**
   * Get commit history with file changes
   */
  async getCommitHistory(limit: number = 10): Promise<GitCommit[]> {
    if (!this.isRepo) return [];

    try {
      const { stdout } = await execAsync(
        `git log -${limit} --pretty=format:"%H|%s|%an|%ae|%ct" --name-only`,
        { cwd: this.repoPath }
      );

      return this.parseGitLogOutput(stdout);
    } catch (error) {
      logger.error('Failed to get commit history:', error);
      return [];
    }
  }

  /**
   * Parse git log output
   */
  private parseGitLogOutput(output: string): GitCommit[] {
    const commits: GitCommit[] = [];
    const blocks = output.split('\n\n').filter(block => block.trim());

    for (const block of blocks) {
      const lines = block.split('\n');
      if (lines.length < 1) continue;

      const [sha, message, author, email, timestamp] = lines[0].split('|');
      const filesChanged = lines.slice(1).filter(line => line.trim());

      commits.push({
        sha,
        message,
        author,
        email,
        timestamp: parseInt(timestamp) * 1000,
        filesChanged,
      });
    }

    return commits;
  }

  /**
   * Get file content at a specific commit
   */
  async getFileAtCommit(filePath: string, commitSha: string): Promise<string | null> {
    if (!this.isRepo) return null;

    try {
      const { stdout } = await execAsync(
        `git show ${commitSha}:${filePath}`,
        { cwd: this.repoPath }
      );
      return stdout;
    } catch (error) {
      logger.debug(`File not found at commit ${commitSha}: ${filePath}`);
      return null;
    }
  }

  /**
   * Get git status
   */
  async getStatus(): Promise<GitStatus | null> {
    if (!this.isRepo) return null;

    try {
      // Get branch name
      const { stdout: branchOutput } = await execAsync(
        'git rev-parse --abbrev-ref HEAD',
        { cwd: this.repoPath }
      );
      const branch = branchOutput.trim();

      // Get ahead/behind count
      let ahead = 0;
      let behind = 0;
      try {
        const { stdout: revListOutput } = await execAsync(
          `git rev-list --left-right --count ${branch}...origin/${branch}`,
          { cwd: this.repoPath }
        );
        const [behindStr, aheadStr] = revListOutput.trim().split('\t');
        ahead = parseInt(aheadStr) || 0;
        behind = parseInt(behindStr) || 0;
      } catch {
        // No remote tracking branch
      }

      // Get file statuses
      const { stdout: statusOutput } = await execAsync(
        'git status --porcelain',
        { cwd: this.repoPath }
      );

      const staged: string[] = [];
      const modified: string[] = [];
      const untracked: string[] = [];

      const lines = statusOutput.split('\n').filter(line => line.trim());
      for (const line of lines) {
        const status = line.substring(0, 2);
        const file = line.substring(3);

        if (status[0] !== ' ' && status[0] !== '?') {
          staged.push(file);
        }
        if (status[1] !== ' ') {
          modified.push(file);
        }
        if (status === '??') {
          untracked.push(file);
        }
      }

      return {
        branch,
        ahead,
        behind,
        staged,
        modified,
        untracked,
      };
    } catch (error) {
      logger.error('Failed to get git status:', error);
      return null;
    }
  }

  /**
   * Get changes between two commits
   */
  async getChangesBetween(
    fromCommit: string,
    toCommit: string = 'HEAD'
  ): Promise<GitChange[]> {
    if (!this.isRepo) return [];

    try {
      const { stdout } = await execAsync(
        `git diff --name-status ${fromCommit}...${toCommit}`,
        { cwd: this.repoPath }
      );

      return this.parseGitDiffOutput(stdout);
    } catch (error) {
      logger.error('Failed to get changes between commits:', error);
      return [];
    }
  }

  /**
   * Get the last commit that modified a file
   */
  async getLastCommitForFile(filePath: string): Promise<GitCommit | null> {
    if (!this.isRepo) return null;

    try {
      const { stdout } = await execAsync(
        `git log -1 --pretty=format:"%H|%s|%an|%ae|%ct" -- ${filePath}`,
        { cwd: this.repoPath }
      );

      if (!stdout.trim()) return null;

      const [sha, message, author, email, timestamp] = stdout.split('|');

      return {
        sha,
        message,
        author,
        email,
        timestamp: parseInt(timestamp) * 1000,
        filesChanged: [filePath],
      };
    } catch (error) {
      logger.error('Failed to get last commit for file:', error);
      return null;
    }
  }

  /**
   * Check if a file is tracked by git
   */
  async isFileTracked(filePath: string): Promise<boolean> {
    if (!this.isRepo) return false;

    try {
      const { stdout } = await execAsync(
        `git ls-files --error-unmatch ${filePath}`,
        { cwd: this.repoPath }
      );
      return stdout.trim() !== '';
    } catch {
      return false;
    }
  }

  /**
   * Get files changed in the last N commits
   */
  async getRecentlyChangedFiles(commitCount: number = 5): Promise<string[]> {
    if (!this.isRepo) return [];

    try {
      const { stdout } = await execAsync(
        `git diff --name-only HEAD~${commitCount}..HEAD`,
        { cwd: this.repoPath }
      );

      return stdout
        .split('\n')
        .filter(line => line.trim())
        .map(line => line.trim());
    } catch (error) {
      logger.error('Failed to get recently changed files:', error);
      return [];
    }
  }

  /**
   * Get file modification statistics
   */
  async getFileStats(filePath: string): Promise<{
    commits: number;
    authors: string[];
    lastModified: number;
  } | null> {
    if (!this.isRepo) return null;

    try {
      const { stdout } = await execAsync(
        `git log --pretty=format:"%an|%ct" -- ${filePath}`,
        { cwd: this.repoPath }
      );

      if (!stdout.trim()) return null;

      const lines = stdout.split('\n').filter(line => line.trim());
      const authors = new Set<string>();
      let lastModified = 0;

      for (const line of lines) {
        const [author, timestamp] = line.split('|');
        authors.add(author);
        const ts = parseInt(timestamp) * 1000;
        if (ts > lastModified) {
          lastModified = ts;
        }
      }

      return {
        commits: lines.length,
        authors: Array.from(authors),
        lastModified,
      };
    } catch (error) {
      logger.error('Failed to get file stats:', error);
      return null;
    }
  }

  /**
   * Watch repository for changes
   * Note: This is a simple polling implementation. For production,
   * consider using a proper file watcher like chokidar.
   */
  async watchRepository(
    callback: (changes: GitChange[]) => void,
    intervalMs: number = 5000
  ): Promise<() => void> {
    if (!this.isRepo) {
      throw new Error('Not a git repository');
    }

    let lastCommitSha = (await this.getCurrentCommit())?.sha || '';
    let isRunning = true;

    const checkForChanges = async () => {
      if (!isRunning) return;

      try {
        const currentCommit = await this.getCurrentCommit();
        const currentSha = currentCommit?.sha || '';

        // Check for new commits
        if (currentSha !== lastCommitSha && lastCommitSha) {
          const changes = await this.getChangesBetween(lastCommitSha, currentSha);
          if (changes.length > 0) {
            callback(changes);
          }
          lastCommitSha = currentSha;
        }

        // Check for uncommitted changes
        const uncommitted = await this.getUncommittedChanges();
        if (uncommitted.length > 0) {
          callback(uncommitted);
        }
      } catch (error) {
        logger.error('Error watching repository:', error);
      }

      if (isRunning) {
        setTimeout(checkForChanges, intervalMs);
      }
    };

    // Start watching
    setTimeout(checkForChanges, intervalMs);

    // Return stop function
    return () => {
      isRunning = false;
    };
  }

  /**
   * Get the relative path from repo root
   */
  async getRelativePath(absolutePath: string): Promise<string | null> {
    const root = await this.getRepositoryRoot();
    if (!root) return null;

    try {
      return relative(root, absolutePath);
    } catch {
      return null;
    }
  }
}

/**
 * Factory function to create a GitIntegrationService
 */
export async function createGitService(repoPath: string): Promise<GitIntegrationService | null> {
  const service = new GitIntegrationService(repoPath);
  const isRepo = await service.initialize();

  if (!isRepo) {
    logger.debug(`Path is not a git repository: ${repoPath}`);
    return null;
  }

  return service;
}
