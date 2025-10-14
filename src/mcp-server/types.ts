import { z } from 'zod';

// Core analysis types
export const CodebaseAnalysisSchema = z.object({
  path: z.string(),
  languages: z.array(z.string()),
  frameworks: z.array(z.string()),
  complexity: z.object({
    cyclomatic: z.number(),
    cognitive: z.number(),
    lines: z.number()
  }),
  concepts: z.array(z.object({
    name: z.string(),
    type: z.string(),
    confidence: z.number()
  })),
  patterns: z.array(z.object({
    type: z.string(),
    description: z.string(),
    frequency: z.number()
  }))
});

export const SearchQuerySchema = z.object({
  query: z.string(),
  type: z.enum(['semantic', 'text', 'pattern']).optional(),
  language: z.string().optional(),
  limit: z.number().min(1).max(100).optional().default(10)
});

export const CodingContextSchema = z.object({
  currentFile: z.string().optional(),
  selectedCode: z.string().optional(),
  problemDescription: z.string(),
  preferences: z.record(z.string(), z.any()).optional()
});

export const DocOptionsSchema = z.object({
  format: z.enum(['markdown', 'html', 'json']).default('markdown'),
  includeExamples: z.boolean().default(true),
  includeArchitecture: z.boolean().default(true),
  outputPath: z.string().optional()
});

export const AIInsightsSchema = z.object({
  type: z.enum(['bug_pattern', 'optimization', 'refactor_suggestion', 'best_practice']),
  content: z.record(z.string(), z.any()),
  confidence: z.number().min(0).max(1),
  sourceAgent: z.string(),
  impactPrediction: z.record(z.string(), z.any()).optional()
});

// Type exports
export type CodebaseAnalysis = z.infer<typeof CodebaseAnalysisSchema>;
export type SearchQuery = z.infer<typeof SearchQuerySchema>;
export type CodingContext = z.infer<typeof CodingContextSchema>;
export type DocOptions = z.infer<typeof DocOptionsSchema>;
export type AIInsights = z.infer<typeof AIInsightsSchema>;

// Response types
export interface SemanticInsight {
  concept: string;
  relationships: string[];
  usage: {
    frequency: number;
    contexts: string[];
  };
  evolution: {
    firstSeen: Date;
    lastModified: Date;
    changeCount: number;
  };
}

export interface PatternRecommendation {
  pattern: string;
  description: string;
  confidence: number;
  examples: string[];
  reasoning: string;
}

export interface CodingApproachPrediction {
  approach: string;
  confidence: number;
  reasoning: string;
  suggestedPatterns: string[];
  estimatedComplexity: 'low' | 'medium' | 'high';
}

export interface DeveloperProfile {
  preferredPatterns: PatternRecommendation[];
  codingStyle: {
    namingConventions: Record<string, string>;
    structuralPreferences: string[];
    testingApproach: string;
  };
  expertiseAreas: string[];
  recentFocus: string[];
  currentWork?: {
    lastFeature?: string;
    currentFiles: string[];
    pendingTasks: string[];
    recentDecisions: Array<{ key: string; value: string; reasoning?: string }>;
  };
}

export interface ProjectBlueprint {
  techStack: string[];
  entryPoints: Record<string, string>;
  keyDirectories: Record<string, string>;
  architecture: string;
  featureMap?: Record<string, string[]>;
}

export interface EntryPointDetectionResult {
  id: string;
  type: 'web' | 'api' | 'cli' | 'worker';
  filePath: string;
  description?: string;
  framework?: string;
}

export interface KeyDirectoryInfo {
  id: string;
  path: string;
  type: string;
  fileCount: number;
  description?: string;
}

export const ProjectBlueprintSchema = z.object({
  path: z.string().optional(),
  includeFeatureMap: z.boolean().default(true)
});