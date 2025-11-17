import { Logger } from '../utils/logger.js';
import type { GlobalDatabase, GlobalPattern, PatternAggregation } from '../storage/global-db.js';
import { StringSimilarity } from '../utils/string-similarity.js';



interface PatternOccurrence {
  projectId: string;
  frequency: number;
  confidence: number;
  patternData: any;
}

/**
 * Pattern aggregator - aggregates patterns across multiple projects
 */
export class PatternAggregator {
  private globalDb: GlobalDatabase;

  constructor(globalDb: GlobalDatabase) {
    this.globalDb = globalDb;
  }

  /**
   * Aggregate patterns across all projects
   */
  async aggregatePatterns(): Promise<void> {
    const startTime = Date.now();

    try {
      // Get all patterns
      const allPatterns = this.globalDb.getGlobalPatterns({ limit: 10000 });

      // Group patterns by signature
      const patternGroups = this.groupPatternsBySignature(allPatterns);

      let aggregated = 0;

      // Aggregate each group
      for (const [signature, patterns] of patternGroups.entries()) {
        const aggregation = this.aggregatePatternGroup(signature, patterns);
        this.globalDb.upsertPatternAggregation(aggregation);
        aggregated++;
      }

      Logger.info(
        `Pattern aggregation completed in ${Date.now() - startTime}ms: ${aggregated} patterns aggregated`
      );
    } catch (error) {
      Logger.error('Pattern aggregation failed:', error);
      throw error;
    }
  }

  /**
   * Aggregate a specific pattern group
   */
  private aggregatePatternGroup(
    signature: string,
    patterns: GlobalPattern[]
  ): Omit<PatternAggregation, 'id' | 'createdAt' | 'updatedAt'> {
    const occurrences: PatternOccurrence[] = [];

    // Collect occurrences from all patterns
    for (const pattern of patterns) {
      for (const projectId of pattern.sourceProjects) {
        occurrences.push({
          projectId,
          frequency: pattern.totalFrequency,
          confidence: pattern.confidence,
          patternData: pattern.patternData,
        });
      }
    }

    // Calculate aggregated confidence
    const aggregatedConfidence = this.calculateAggregatedConfidence(occurrences);

    // Calculate consensus score
    const consensusScore = this.calculateConsensusScore(patterns);

    return {
      patternSignature: signature,
      category: patterns[0]?.category || 'unknown',
      occurrences,
      aggregatedConfidence,
      consensusScore,
    };
  }

  /**
   * Group patterns by signature (normalized pattern key)
   */
  private groupPatternsBySignature(
    patterns: GlobalPattern[]
  ): Map<string, GlobalPattern[]> {
    const groups = new Map<string, GlobalPattern[]>();

    for (const pattern of patterns) {
      const signature = this.generatePatternSignature(pattern);

      if (!groups.has(signature)) {
        groups.set(signature, []);
      }

      groups.get(signature)!.push(pattern);
    }

    return groups;
  }

  /**
   * Generate normalized pattern signature
   */
  private generatePatternSignature(pattern: GlobalPattern): string {
    // Create a normalized key for the pattern
    const key: Record<string, string> = {
      category: pattern.category,
      subcategory: pattern.subcategory || '',
      language: pattern.language || 'any',
    };

    // Extract key features from pattern data
    const data = pattern.patternData;

    if (data.convention) {
      key['convention'] = data.convention;
    }

    if (data.pattern) {
      key['pattern'] = data.pattern;
    }

    if (data.category) {
      key['patternCategory'] = data.category;
    }

    // Sort keys for consistency
    const sortedKey = Object.keys(key)
      .sort()
      .map((k) => `${k}:${key[k]}`)
      .join('|');

    return sortedKey;
  }

  /**
   * Calculate aggregated confidence
   */
  private calculateAggregatedConfidence(occurrences: PatternOccurrence[]): number {
    if (occurrences.length === 0) return 0;

    // Average confidence across all occurrences
    const avgConfidence =
      occurrences.reduce((sum, o) => sum + o.confidence, 0) / occurrences.length;

    // Boost confidence based on number of projects
    const projectCount = new Set(occurrences.map((o) => o.projectId)).size;
    const projectBoost = Math.log(projectCount + 1) / Math.log(10); // Logarithmic boost

    // Combine average confidence with project boost
    const boostedConfidence = avgConfidence * (1 + projectBoost * 0.2);

    return Math.min(1.0, boostedConfidence);
  }

  /**
   * Calculate consensus score (how consistent the pattern is across projects)
   */
  calculateConsensusScore(patterns: GlobalPattern[]): number {
    if (patterns.length === 0) return 0;
    if (patterns.length === 1) return 1.0;

    // Extract pattern details
    const patternDetails = patterns.map((p) => p.patternData);

    // Calculate similarity between patterns
    let totalSimilarity = 0;
    let comparisons = 0;

    for (let i = 0; i < patternDetails.length; i++) {
      for (let j = i + 1; j < patternDetails.length; j++) {
        totalSimilarity += this.calculatePatternSimilarity(
          patternDetails[i],
          patternDetails[j]
        );
        comparisons++;
      }
    }

    if (comparisons === 0) return 1.0;

    return totalSimilarity / comparisons;
  }

  /**
   * Calculate similarity between two pattern data objects
   */
  private calculatePatternSimilarity(pattern1: any, pattern2: any): number {
    // Simple JSON similarity
    const keys1 = new Set(Object.keys(pattern1));
    const keys2 = new Set(Object.keys(pattern2));

    // Key overlap
    const sharedKeys = new Set([...keys1].filter((k) => keys2.has(k)));
    const keyOverlap = (sharedKeys.size * 2) / (keys1.size + keys2.size);

    // Value similarity for shared keys
    let valueSimilarity = 0;
    let valueComparisons = 0;

    for (const key of sharedKeys) {
      const val1 = pattern1[key];
      const val2 = pattern2[key];

      if (val1 === val2) {
        valueSimilarity += 1;
      } else if (typeof val1 === 'string' && typeof val2 === 'string') {
        // String similarity (simple)
        valueSimilarity += StringSimilarity.jaccardSimilarity(val1, val2);
      } else if (typeof val1 === 'number' && typeof val2 === 'number') {
        // Number similarity
        valueSimilarity += 1 - Math.abs(val1 - val2) / Math.max(Math.abs(val1), Math.abs(val2), 1);
      }

      valueComparisons++;
    }

    const avgValueSimilarity = valueComparisons > 0 ? valueSimilarity / valueComparisons : 0;

    // Combine key overlap and value similarity
    return (keyOverlap + avgValueSimilarity) / 2;
  }

  /**
   * Merge patterns from multiple occurrences
   */
  mergePatterns(patterns: GlobalPattern[]): GlobalPattern {
    if (patterns.length === 0) {
      throw new Error('Cannot merge empty pattern list');
    }

    if (patterns.length === 1) {
      return patterns[0];
    }

    // Take the most common/confident pattern as base
    const sortedPatterns = [...patterns].sort(
      (a, b) => b.projectCount - a.projectCount || b.confidence - a.confidence
    );

    const base = sortedPatterns[0];

    // Merge data
    const mergedData = { ...base.patternData };

    // Aggregate source projects
    const sourceProjects = new Set<string>();
    let totalFrequency = 0;

    for (const pattern of patterns) {
      for (const projectId of pattern.sourceProjects) {
        sourceProjects.add(projectId);
      }
      totalFrequency += pattern.totalFrequency;
    }

    // Calculate merged confidence
    const mergedConfidence = this.calculateAggregatedConfidence(
      patterns.map((p) => ({
        projectId: p.sourceProjects[0] || '',
        frequency: p.totalFrequency,
        confidence: p.confidence,
        patternData: p.patternData,
      }))
    );

    return {
      ...base,
      patternData: mergedData,
      projectCount: sourceProjects.size,
      totalFrequency,
      confidence: mergedConfidence,
      sourceProjects: Array.from(sourceProjects),
    };
  }

  /**
   * Rank patterns by relevance to a project context
   */
  rankPatternsByRelevance(
    patterns: GlobalPattern[],
    context: {
      language?: string;
      frameworks?: string[];
      projectSize?: 'small' | 'medium' | 'large';
    }
  ): GlobalPattern[] {
    return [...patterns].sort((a, b) => {
      let scoreA = 0;
      let scoreB = 0;

      // Language match (high weight)
      if (context.language) {
        if (a.language === context.language) scoreA += 10;
        if (b.language === context.language) scoreB += 10;
      }

      // Project count (medium weight)
      scoreA += a.projectCount * 2;
      scoreB += b.projectCount * 2;

      // Confidence (medium weight)
      scoreA += a.confidence * 5;
      scoreB += b.confidence * 5;

      // Recency (low weight)
      scoreA += (Date.now() - a.lastSeen) / (1000 * 60 * 60 * 24 * 365); // Years
      scoreB += (Date.now() - b.lastSeen) / (1000 * 60 * 60 * 24 * 365);

      return scoreB - scoreA;
    });
  }

  /**
   * Get pattern diff (patterns in project A but not in project B)
   */
  getPatternDiff(
    projectId1: string,
    projectId2: string
  ): {
    onlyInProject1: GlobalPattern[];
    onlyInProject2: GlobalPattern[];
    shared: GlobalPattern[];
  } {
    const patterns1 = this.globalDb.getGlobalPatterns({ limit: 10000 });
    const patterns2 = this.globalDb.getGlobalPatterns({ limit: 10000 });

    const set1 = new Map<string, GlobalPattern>();
    const set2 = new Map<string, GlobalPattern>();

    for (const pattern of patterns1) {
      if (pattern.sourceProjects.includes(projectId1)) {
        const sig = this.generatePatternSignature(pattern);
        set1.set(sig, pattern);
      }
    }

    for (const pattern of patterns2) {
      if (pattern.sourceProjects.includes(projectId2)) {
        const sig = this.generatePatternSignature(pattern);
        set2.set(sig, pattern);
      }
    }

    const onlyInProject1: GlobalPattern[] = [];
    const shared: GlobalPattern[] = [];

    for (const [sig, pattern] of set1.entries()) {
      if (set2.has(sig)) {
        shared.push(pattern);
      } else {
        onlyInProject1.push(pattern);
      }
    }

    const onlyInProject2: GlobalPattern[] = [];
    for (const [sig, pattern] of set2.entries()) {
      if (!set1.has(sig)) {
        onlyInProject2.push(pattern);
      }
    }

    return { onlyInProject1, onlyInProject2, shared };
  }
}
