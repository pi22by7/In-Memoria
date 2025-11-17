import { getLogger } from '../utils/logger.js';
import type { GlobalDatabase, GlobalProject, GlobalPattern, SyncResult } from '../storage/global-db.js';
import type { SqliteDatabase } from '../storage/sqlite-db.js';
import { PatternAggregator } from './pattern-aggregator.js';
import { nanoid } from 'nanoid';
import { detectLanguageFromPath, detectLanguageFromPattern } from '../utils/language-registry.js';

const logger = getLogger();

export interface ProjectLink {
  id: string;
  name: string;
  path: string;
  linkedAt: number;
  lastSynced?: number;
  patternCount: number;
  conceptCount: number;
}

export interface CrossProjectSearchOptions {
  query: string;
  mode?: 'semantic' | 'text' | 'pattern';
  projectFilter?: string[];
  languageFilter?: string;
  limit?: number;
}

export interface SearchResult {
  projectId: string;
  projectName: string;
  filePath: string;
  match: {
    code: string;
    score: number;
    context: string;
  };
}

export interface PortfolioView {
  projects: Array<{
    id: string;
    name: string;
    path: string;
    primaryLanguage?: string;
    frameworks: string[];
    patternCount: number;
    conceptCount: number;
    lastSynced?: number;
    size: 'small' | 'medium' | 'large';
  }>;
  totalProjects: number;
  totalPatterns: number;
  totalConcepts: number;
  mostUsedLanguages: string[];
  mostUsedFrameworks: string[];
}

/**
 * Cross-project service - manages intelligence across multiple projects
 */
export class CrossProjectService {
  private globalDb: GlobalDatabase;
  private patternAggregator: PatternAggregator;

  constructor(globalDb: GlobalDatabase) {
    this.globalDb = globalDb;
    this.patternAggregator = new PatternAggregator(globalDb);
  }

  /**
   * Link a project to global intelligence
   */
  async linkProject(
    projectPath: string,
    projectDb: SqliteDatabase,
    name?: string,
    description?: string
  ): Promise<ProjectLink> {
    const startTime = Date.now();

    try {
      // Get project metadata from project database
      const metadata = this.getProjectMetadata(projectDb);

      // Link to global database
      const projectId = await this.globalDb.linkProject(projectPath, {
        name: name || metadata.projectName || projectPath.split('/').pop(),
        description: description,
        primaryLanguage: metadata.primaryLanguage,
        frameworks: metadata.frameworks,
      });

      // Initial sync
      await this.syncProject(projectId, projectDb);

      const project = this.globalDb.getProject(projectId);

      if (!project) {
        throw new Error('Failed to link project');
      }

      logger.info(
        `Project linked in ${Date.now() - startTime}ms: ${project.name} (${project.path})`
      );

      return {
        id: project.id,
        name: project.name,
        path: project.path,
        linkedAt: project.linkedAt,
        lastSynced: project.lastSynced,
        patternCount: project.patternCount,
        conceptCount: project.conceptCount,
      };
    } catch (error) {
      logger.error('Failed to link project:', error);
      throw error;
    }
  }

  /**
   * Get all linked projects
   */
  getLinkedProjects(): ProjectLink[] {
    const projects = this.globalDb.getProjectRegistry();

    return projects.map((p) => ({
      id: p.id,
      name: p.name,
      path: p.path,
      linkedAt: p.linkedAt,
      lastSynced: p.lastSynced,
      patternCount: p.patternCount,
      conceptCount: p.conceptCount,
    }));
  }

  /**
   * Sync a project's patterns and concepts to global database
   */
  async syncProject(projectId: string, projectDb: SqliteDatabase): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      projectId,
      projectName: '',
      patternsAdded: 0,
      patternsUpdated: 0,
      conceptsAdded: 0,
      durationMs: 0,
      status: 'success',
    };

    try {
      const project = this.globalDb.getProject(projectId);
      if (!project) {
        throw new Error(`Project ${projectId} not found`);
      }

      result.projectName = project.name;

      // Sync patterns
      const patterns = this.getProjectPatterns(projectDb);
      for (const pattern of patterns) {
        const globalPatternId = this.globalDb.addGlobalPattern({
          category: pattern.pattern_type,
          patternData: JSON.parse(pattern.pattern_content),
          projectCount: 1,
          totalFrequency: pattern.frequency,
          confidence: pattern.confidence,
          sourceProjects: [projectId],
          language: detectLanguageFromPattern(pattern.pattern_content),
        });

        if (globalPatternId) {
          result.patternsAdded++;
        }
      }

      // Sync concepts
      const concepts = this.getProjectConcepts(projectDb);
      for (const concept of concepts) {
        this.globalDb.addGlobalConcept({
          name: concept.concept_name,
          type: concept.concept_type,
          filePath: concept.file_path,
          projectId,
          language: detectLanguageFromPath(concept.file_path),
          metadata: {
            confidence: concept.confidence_score,
          },
          createdAt: Date.now(),
        });

        result.conceptsAdded++;
      }

      // Update project stats
      this.globalDb.updateProjectStats(projectId, {
        patternCount: result.patternsAdded,
        conceptCount: result.conceptsAdded,
      });

      // Mark as synced
      this.globalDb.markProjectSynced(projectId);

      // Aggregate patterns across all projects
      await this.patternAggregator.aggregatePatterns();

      result.durationMs = Date.now() - startTime;
      logger.info(
        `Project synced in ${result.durationMs}ms: ` +
          `+${result.patternsAdded} patterns, +${result.conceptsAdded} concepts`
      );

      return result;
    } catch (error) {
      result.status = 'failed';
      result.error = error instanceof Error ? error.message : String(error);
      result.durationMs = Date.now() - startTime;

      logger.error('Project sync failed:', error);
      return result;
    }
  }

  /**
   * Sync all linked projects
   */
  async syncAllProjects(projectDatabases: Map<string, SqliteDatabase>): Promise<SyncResult[]> {
    const projects = this.globalDb.getProjectRegistry();
    const results: SyncResult[] = [];

    for (const project of projects) {
      const projectDb = projectDatabases.get(project.path);
      if (!projectDb) {
        logger.warn(`No database found for project ${project.name} at ${project.path}`);
        continue;
      }

      const result = await this.syncProject(project.id, projectDb);
      results.push(result);
    }

    return results;
  }

  /**
   * Get global patterns with filtering
   */
  getGlobalPatterns(options: {
    category?: string;
    minProjectCount?: number;
    minConsensus?: number;
    language?: string;
    limit?: number;
  }): GlobalPattern[] {
    return this.globalDb.getGlobalPatterns(options);
  }

  /**
   * Search across all projects
   */
  async searchAllProjects(options: CrossProjectSearchOptions): Promise<SearchResult[]> {
    const { query, mode = 'text', projectFilter, languageFilter, limit = 20 } = options;

    const results: SearchResult[] = [];

    // Search global concepts
    const concepts = this.globalDb.searchGlobalConcepts({
      query,
      projectIds: projectFilter,
      language: languageFilter,
      limit,
    });

    for (const concept of concepts) {
      const project = this.globalDb.getProject(concept.projectId);
      if (!project) continue;

      results.push({
        projectId: concept.projectId,
        projectName: project.name,
        filePath: concept.filePath,
        match: {
          code: `${concept.type} ${concept.name}`,
          score: 0.9, // TODO: Implement actual scoring
          context: `Found in ${concept.filePath}`,
        },
      });
    }

    // Sort by score
    results.sort((a, b) => b.match.score - a.match.score);

    return results.slice(0, limit);
  }

  /**
   * Get portfolio view (all projects overview)
   */
  getPortfolioView(): PortfolioView {
    const projects = this.globalDb.getProjectRegistry();
    const stats = this.globalDb.getStatistics();

    const portfolioProjects = projects.map((p) => ({
      id: p.id,
      name: p.name,
      path: p.path,
      primaryLanguage: p.primaryLanguage,
      frameworks: p.frameworks,
      patternCount: p.patternCount,
      conceptCount: p.conceptCount,
      lastSynced: p.lastSynced,
      size: this.categorizeProjectSize(p.conceptCount),
    }));

    // Get most used languages
    const mostUsedLanguages = stats.topLanguages.map((l) => l.language);

    // Get most used frameworks
    const frameworkCounts: Map<string, number> = new Map();
    for (const project of projects) {
      for (const framework of project.frameworks) {
        frameworkCounts.set(framework, (frameworkCounts.get(framework) || 0) + 1);
      }
    }

    const mostUsedFrameworks = Array.from(frameworkCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map((e) => e[0]);

    return {
      projects: portfolioProjects,
      totalProjects: stats.activeProjects,
      totalPatterns: stats.totalPatterns,
      totalConcepts: stats.totalConcepts,
      mostUsedLanguages,
      mostUsedFrameworks,
    };
  }

  /**
   * Get project similarity score
   */
  async getProjectSimilarity(projectId1: string, projectId2: string): Promise<number> {
    const project1 = this.globalDb.getProject(projectId1);
    const project2 = this.globalDb.getProject(projectId2);

    if (!project1 || !project2) {
      return 0;
    }

    // Simple similarity based on:
    // 1. Same primary language
    // 2. Shared frameworks
    // 3. Shared patterns (from aggregations)

    let similarity = 0;

    // Language match (30%)
    if (project1.primaryLanguage === project2.primaryLanguage) {
      similarity += 0.3;
    }

    // Framework overlap (30%)
    const frameworks1 = new Set(project1.frameworks);
    const frameworks2 = new Set(project2.frameworks);
    const sharedFrameworks = new Set(
      [...frameworks1].filter((f) => frameworks2.has(f))
    );
    const frameworkSimilarity =
      (sharedFrameworks.size * 2) / (frameworks1.size + frameworks2.size);
    similarity += frameworkSimilarity * 0.3;

    // Pattern overlap (40%) - would need pattern comparison
    // For now, simplified
    similarity += 0.2; // Placeholder

    return Math.min(1.0, similarity);
  }

  // Helper methods

  private getProjectMetadata(projectDb: SqliteDatabase): {
    projectName?: string;
    primaryLanguage?: string;
    frameworks: string[];
  } {
    const metadata = projectDb
      .prepare('SELECT * FROM project_metadata LIMIT 1')
      .get() as any;

    if (!metadata) {
      return { frameworks: [] };
    }

    return {
      projectName: metadata.project_name,
      primaryLanguage: metadata.language_primary,
      frameworks: JSON.parse(metadata.framework_detected || '[]'),
    };
  }

  private getProjectPatterns(projectDb: SqliteDatabase): any[] {
    return projectDb
      .prepare(
        `
      SELECT * FROM developer_patterns
      ORDER BY frequency DESC, confidence DESC
      LIMIT 1000
    `
      )
      .all();
  }

  private getProjectConcepts(projectDb: SqliteDatabase): any[] {
    return projectDb
      .prepare(
        `
      SELECT * FROM semantic_concepts
      WHERE is_deleted = 0
      ORDER BY confidence_score DESC
      LIMIT 10000
    `
      )
      .all();
  }

  private categorizeProjectSize(conceptCount: number): 'small' | 'medium' | 'large' {
    if (conceptCount < 100) return 'small';
    if (conceptCount < 1000) return 'medium';
    return 'large';
  }
}
