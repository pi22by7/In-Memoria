import { z } from 'zod';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

// Input validation schemas for all MCP tools
export const AnalyzeCodebaseSchema = z.object({
  path: z.string().min(1, 'Path is required')
});

export const GetFileContentSchema = z.object({
  path: z.string().min(1, 'Path is required')
});

export const GetProjectStructureSchema = z.object({
  path: z.string().min(1, 'Path is required'),
  maxDepth: z.number().int().min(1).max(10).optional().default(5)
});

export const SearchCodebaseSchema = z.object({
  query: z.string().min(1, 'Query is required'),
  type: z.enum(['semantic', 'text', 'pattern']).optional().default('text'),
  language: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional().default(20)
});

export const GenerateDocumentationSchema = z.object({
  path: z.string().min(1, 'Path is required'),
  format: z.enum(['markdown', 'html', 'json']).optional().default('markdown'),
  includeArchitecture: z.boolean().optional().default(true),
  includeExamples: z.boolean().optional().default(true),
  outputPath: z.string().optional()
});

export const LearnCodebaseIntelligenceSchema = z.object({
  path: z.string().min(1, 'Path is required'),
  force: z.boolean().optional().default(false)
});

export const GetSemanticInsightsSchema = z.object({
  query: z.string().optional(),
  conceptType: z.string().optional(),
  limit: z.number().int().min(1).max(50).optional().default(10)
});

export const GetPatternRecommendationsSchema = z.object({
  problemDescription: z.string().min(1, 'Problem description is required'),
  currentFile: z.string().optional(),
  selectedCode: z.string().optional(),
  preferences: z.record(z.string(), z.any()).optional()
});

export const PredictCodingApproachSchema = z.object({
  problemDescription: z.string().min(1, 'Problem description is required'),
  context: z.record(z.string(), z.any()).optional()
});

export const GetDeveloperProfileSchema = z.object({
  includeRecentActivity: z.boolean().optional().default(true)
});

export const ContributeInsightsSchema = z.object({
  type: z.enum(['bug_pattern', 'optimization', 'refactor_suggestion', 'best_practice']),
  content: z.record(z.string(), z.any()),
  confidence: z.number().min(0).max(1),
  sourceAgent: z.string().min(1, 'Source agent identifier is required'),
  impactPrediction: z.record(z.string(), z.any()).optional()
});

// Automation Tool Schemas
export const AutoLearnIfNeededSchema = z.object({
  path: z.string().optional(),
  force: z.boolean().optional().default(false),
  includeProgress: z.boolean().optional().default(true),
  skipLearning: z.boolean().optional().default(false),
  includeSetupSteps: z.boolean().optional().default(false)
});

export const GetLearningStatusSchema = z.object({
  path: z.string().optional()
});

export const QuickSetupSchema = z.object({
  path: z.string().optional(),
  skipLearning: z.boolean().optional().default(false)
});

// Monitoring Tool Schemas
export const GetSystemStatusSchema = z.object({
  includeMetrics: z.boolean().optional().default(true),
  includeDiagnostics: z.boolean().optional().default(false)
});

export const GetIntelligenceMetricsSchema = z.object({
  includeBreakdown: z.boolean().optional().default(true)
});

export const GetPerformanceStatusSchema = z.object({
  runBenchmark: z.boolean().optional().default(false)
});

// Validation function
export function validateInput(schema: z.ZodSchema<any>, input: any, toolName: string): any {
  try {
    return schema.parse(input);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid input for ${toolName}: ${errorMessages}`
      );
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Validation error for ${toolName}: ${(error as Error).message}`
    );
  }
}

// Tool name to schema mapping
export const VALIDATION_SCHEMAS = {
  'analyze_codebase': AnalyzeCodebaseSchema,
  'get_file_content': GetFileContentSchema,
  'get_project_structure': GetProjectStructureSchema,
  'search_codebase': SearchCodebaseSchema,
  'generate_documentation': GenerateDocumentationSchema,
  'learn_codebase_intelligence': LearnCodebaseIntelligenceSchema,
  'get_semantic_insights': GetSemanticInsightsSchema,
  'get_pattern_recommendations': GetPatternRecommendationsSchema,
  'predict_coding_approach': PredictCodingApproachSchema,
  'get_developer_profile': GetDeveloperProfileSchema,
  'contribute_insights': ContributeInsightsSchema,
  'auto_learn_if_needed': AutoLearnIfNeededSchema,
  'get_learning_status': GetLearningStatusSchema,
  'quick_setup': QuickSetupSchema,
  'get_system_status': GetSystemStatusSchema,
  'get_intelligence_metrics': GetIntelligenceMetricsSchema,
  'get_performance_status': GetPerformanceStatusSchema
} as const;