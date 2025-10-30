import { Tool } from '@modelcontextprotocol/sdk/types.js';
import {
  CodebaseAnalysisSchema,
  SearchQuerySchema,
  DocOptionsSchema,
  type CodebaseAnalysis,
  type SearchQuery,
  type DocOptions
} from '../types.js';
import { SemanticEngine } from '../../engines/semantic-engine.js';
import { PatternEngine } from '../../engines/pattern-engine.js';
import { IntelligenceTools } from './intelligence-tools.js';
import { readFileSync, statSync, readdirSync, lstatSync } from 'fs';
import { join, relative, extname, basename } from 'path';
import { glob } from 'glob';
import { ErrorFactory, MCPErrorUtils, ErrorUtils, InMemoriaError, MCPErrorCode } from '../../utils/error-types.js';

export class CoreAnalysisTools {
  private intelligenceTools: IntelligenceTools;

  constructor(
    private semanticEngine: SemanticEngine,
    private patternEngine: PatternEngine,
    private database: any
  ) {
    this.intelligenceTools = new IntelligenceTools(semanticEngine, patternEngine, database);
  }

  get tools(): Tool[] {
    return [
      {
        name: 'analyze_codebase',
        description: 'One-time analysis of a specific file or directory. Returns AST structure, complexity metrics, and detected patterns for that path only. For project-wide understanding, use get_project_blueprint instead (faster, uses learned intelligence). Use this for deep-dive analysis of a specific file you\'re currently working on.',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to specific file or directory to analyze in detail'
            },
            includeFileContent: {
              type: 'boolean',
              description: 'If true and path is a file, include full file content in response (default: false)'
            }
          },
          required: ['path']
        }
      },
      {
        name: 'search_codebase',
        description: 'Search for code by text matching or patterns. Use "text" type for finding specific strings/keywords in code. Use "pattern" type for regex/AST patterns. Note: For "where should I work?" or "what files to modify?" questions, use predict_coding_approach instead - it provides intelligent file routing without exploration.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query - literal text string or regex pattern depending on type'
            },
            type: {
              type: 'string',
              enum: ['semantic', 'text', 'pattern'],
              description: 'Type of search: "text" for literal string matching, "pattern" for regex/AST patterns, "semantic" for concept-based search'
            },
            language: {
              type: 'string',
              description: 'Filter results by programming language (e.g., "typescript", "rust", "python")'
            },
            limit: {
              type: 'number',
              minimum: 1,
              maximum: 100,
              description: 'Maximum number of results to return'
            }
          },
          required: ['query']
        }
      }
      // DEPRECATED (Phase 4): Not agent-facing, removed from tool list
      // {
      //   name: 'generate_documentation',
      //   description: 'Generate intelligent documentation for the codebase',
      //   inputSchema: {
      //     type: 'object',
      //     properties: {
      //       path: {
      //         type: 'string',
      //         description: 'Path to the codebase'
      //       },
      //       format: {
      //         type: 'string',
      //         enum: ['markdown', 'html', 'json'],
      //         description: 'Output format for documentation'
      //       },
      //       includeExamples: {
      //         type: 'boolean',
      //         description: 'Include code examples in documentation'
      //       },
      //       includeArchitecture: {
      //         type: 'boolean',
      //         description: 'Include architectural analysis'
      //       },
      //       outputPath: {
      //         type: 'string',
      //         description: 'Optional path to save generated documentation'
      //       }
      //     },
      //     required: ['path']
      //   }
      // }
    ];
  }

  async analyzeCodebase(args: { path: string }): Promise<any> {
    // Input validation
    if (!args.path || typeof args.path !== 'string') {
      throw new Error('Path parameter is required and must be a string');
    }
    
    // Sanitize path - prevent path traversal attacks
    const sanitizedPath = args.path.replace(/\.\./g, '');
    if (sanitizedPath !== args.path) {
      throw new Error('Path contains invalid characters');
    }

    try {
      // Check if path is a file or directory
      const stats = statSync(args.path);

      if (stats.isFile()) {
        // FILE ANALYSIS - Token-efficient response focused on concepts
        const content = readFileSync(args.path, 'utf-8');
        const language = this.detectLanguage(args.path);
        const lineCount = content.split('\n').length;

        // Perform semantic analysis
        const semanticConcepts = await this.semanticEngine.analyzeFileContent(args.path, content);
        const patterns = await this.patternEngine.analyzeFilePatterns(args.path, content);
        const complexity = this.calculateDetailedComplexity(content, semanticConcepts);

        return {
          type: 'file',
          path: args.path,
          language,
          lineCount,
          size: stats.size,
          // Token-efficient: Top 10 concepts only
          concepts: semanticConcepts.slice(0, 10).map((c: any) => ({
            name: c.name,
            type: c.type,
            confidence: c.confidence,
            line: c.lineRange?.start || 0
          })),
          // Token-efficient: Top 5 patterns
          patterns: patterns.slice(0, 5).map((p: any) => ({
            type: p.type,
            description: p.description,
            frequency: p.frequency || 1
          })),
          complexity: {
            cyclomatic: complexity.cyclomatic,
            cognitive: complexity.cognitive,
            lines: lineCount
          },
          note: 'For full file content, use a file reading tool. For all concepts, use get_semantic_insights.'
        };
      } else {
        // DIRECTORY ANALYSIS - Token-efficient codebase summary
        const analysis = await this.semanticEngine.analyzeCodebase(args.path);
        const patterns = await this.patternEngine.extractPatterns(args.path);

        return {
          path: args.path,
          type: 'codebase',
          languages: analysis.languages,
          frameworks: analysis.frameworks,
          complexity: analysis.complexity,
          // Token-efficient: Top 15 concepts only
          topConcepts: analysis.concepts.slice(0, 15).map((concept: any) => ({
            name: concept.name,
            type: concept.type,
            confidence: concept.confidence
          })),
          // Token-efficient: Top 10 patterns only
          topPatterns: patterns.slice(0, 10).map((p: any) => ({
            type: p.type,
            description: p.description,
            frequency: p.frequency
          })),
          summary: {
            totalConcepts: analysis.concepts.length,
            totalPatterns: patterns.length,
            note: 'Use get_semantic_insights to explore all concepts. Use get_project_blueprint for structure.'
          }
        };
      }
    } catch (error) {
      console.error('Analysis error:', error);
      return {
        path: args.path,
        languages: [],
        frameworks: [],
        complexity: { cyclomatic: 0, cognitive: 0, lines: 0 },
        concepts: [],
        patterns: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async getFileContent(args: { path: string }): Promise<{
    content: string;
    metadata: {
      size: number;
      lastModified: Date;
      language: string;
      lineCount: number;
      semanticConcepts: Array<{
        name: string;
        type: string;
        confidence: number;
        lineRange: { start: number; end: number };
      }>;
      patterns: Array<{
        type: string;
        description: string;
        confidence: number;
      }>;
      complexity: {
        cyclomatic: number;
        cognitive: number;
        functions: number;
        classes: number;
      };
      dependencies: string[];
      exports: string[];
    }
  }> {
    // Input validation
    if (!args.path || typeof args.path !== 'string') {
      throw new Error('Path parameter is required and must be a string');
    }
    
    // Sanitize path and check for dangerous patterns
    if (args.path.includes('..') || args.path.includes('\0')) {
      throw new Error('Path contains invalid characters');
    }
    
    try {
      const content = readFileSync(args.path, 'utf-8');
      const stats = statSync(args.path);
      const language = this.detectLanguage(args.path);
      const lineCount = content.split('\n').length;

      // Perform semantic analysis using our Rust engine
      const semanticConcepts = await this.semanticEngine.analyzeFileContent(args.path, content);

      // Extract patterns using our pattern engine
      const patterns = await this.patternEngine.analyzeFilePatterns(args.path, content);

      // Calculate detailed complexity metrics
      const complexity = this.calculateDetailedComplexity(content, semanticConcepts);

      // Extract dependencies and exports
      const dependencies = this.extractDependencies(content, language);
      const exports = this.extractExports(content, language);

      return {
        content,
        metadata: {
          size: stats.size,
          lastModified: stats.mtime,
          language,
          lineCount,
          semanticConcepts,
          patterns,
          complexity,
          dependencies,
          exports
        }
      };
    } catch (error) {
      if (error instanceof InMemoriaError) {
        throw error;
      }
      
      // Convert to proper InMemoria error with MCP compliance
      const inMemoriaError = ErrorUtils.fromError(
        error instanceof Error ? error : new Error(String(error)),
        {
          operation: 'file-analysis',
          filePath: args.path,
          component: 'core-analysis-tools'
        }
      );
      
      throw inMemoriaError;
    }
  }

  async getProjectStructure(args: { path: string; maxDepth?: number }): Promise<{
    structure: any;
    summary: {
      totalFiles: number;
      languages: Record<string, number>;
      directories: number;
    }
  }> {
    const structure = await this.buildDirectoryStructure(args.path, args.maxDepth || 5);
    const summary = this.calculateStructureSummary(structure);

    return { structure, summary };
  }

  async searchCodebase(args: SearchQuery): Promise<{
    results: Array<{
      file: string;
      content: string;
      score: number;
      context: string;
    }>;
    totalFound: number;
    searchType: string;
  }> {
    const validatedQuery = SearchQuerySchema.parse(args);

    switch (validatedQuery.type || 'text') {
      case 'semantic':
        return await this.semanticSearch(validatedQuery);
      case 'pattern':
        return await this.patternSearch(validatedQuery);
      default:
        return await this.textSearch(validatedQuery);
    }
  }

  async generateDocumentation(args: { path: string } & Partial<DocOptions>): Promise<{
    documentation: string;
    metadata: {
      generatedAt: Date;
      format: string;
      sections: string[];
    }
  }> {
    // Input validation
    if (!args.path || typeof args.path !== 'string') {
      throw new Error('Path parameter is required and must be a string');
    }
    
    // Sanitize path and check for dangerous patterns
    if (args.path.includes('..') || args.path.includes('\0')) {
      throw new Error('Path contains invalid characters');
    }
    
    const options = DocOptionsSchema.parse(args);

    // Use our intelligent analysis instead of basic codebase analysis
    const intelligentAnalysis = await this.gatherIntelligentAnalysis(args.path);

    const documentation = await this.buildIntelligentDocumentation(intelligentAnalysis, options);

    return {
      documentation,
      metadata: {
        generatedAt: new Date(),
        format: options.format,
        sections: ['overview', 'architecture', 'patterns', 'concepts', 'complexity', 'insights']
      }
    };
  }

  private detectLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      'ts': 'typescript',
      'tsx': 'typescript',
      'js': 'javascript',
      'jsx': 'javascript',
      'py': 'python',
      'rs': 'rust',
      'go': 'go',
      'java': 'java',
      'cpp': 'cpp',
      'cc': 'cpp',
      'cxx': 'cpp',
      'c': 'c',
      'cs': 'csharp',
      'php': 'php',
      'rb': 'ruby',
      'swift': 'swift',
      'kt': 'kotlin',
      'scala': 'scala',
      'clj': 'clojure',
      'hs': 'haskell',
      'elm': 'elm',
      'vue': 'vue',
      'svelte': 'svelte'
    };

    return languageMap[ext || ''] || 'unknown';
  }

  private calculateDetailedComplexity(content: string, semanticConcepts: any[]): {
    cyclomatic: number;
    cognitive: number;
    functions: number;
    classes: number;
  } {
    const lines = content.split('\n');

    // Count functions and classes from semantic concepts
    const functions = semanticConcepts.filter(c => c.type === 'function').length;
    const classes = semanticConcepts.filter(c => c.type === 'class').length;

    // Calculate cyclomatic complexity
    let cyclomatic = 1; // Base complexity
    const complexityKeywords = ['if', 'else', 'while', 'for', 'switch', 'case', 'catch', 'try', '&&', '||', '?'];

    for (const line of lines) {
      for (const keyword of complexityKeywords) {
        if (keyword === '&&' || keyword === '||' || keyword === '?') {
          // Handle special characters that don't need word boundaries
          const matches = line.split(keyword).length - 1;
          cyclomatic += matches;
        } else {
          // Handle regular keywords with word boundaries
          const regex = new RegExp(`\\b${keyword}\\b`, 'g');
          const matches = line.match(regex);
          if (matches) {
            cyclomatic += matches.length;
          }
        }
      }
    }

    // Calculate cognitive complexity (approximation)
    const cognitive = Math.floor(cyclomatic * 1.2) + Math.floor(functions * 0.5);

    return {
      cyclomatic,
      cognitive,
      functions,
      classes
    };
  }

  private extractDependencies(content: string, language: string): string[] {
    const dependencies: string[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      // TypeScript/JavaScript imports
      if (language === 'typescript' || language === 'javascript') {
        if (trimmed.startsWith('import ') && trimmed.includes(' from ')) {
          const match = trimmed.match(/from\s+['"](.*?)['"]/);
          if (match && match[1] && !match[1].startsWith('.')) {
            const pkg = match[1].split('/')[0];
            if (!dependencies.includes(pkg)) {
              dependencies.push(pkg);
            }
          }
        }

        if (trimmed.startsWith('const ') && trimmed.includes('require(')) {
          const match = trimmed.match(/require\(['"](.*?)['"]\)/);
          if (match && match[1] && !match[1].startsWith('.')) {
            const pkg = match[1].split('/')[0];
            if (!dependencies.includes(pkg)) {
              dependencies.push(pkg);
            }
          }
        }
      }

      // Python imports
      if (language === 'python') {
        if (trimmed.startsWith('import ') || trimmed.startsWith('from ')) {
          const match = trimmed.match(/(?:import|from)\s+(\w+)/);
          if (match && match[1] && !dependencies.includes(match[1])) {
            dependencies.push(match[1]);
          }
        }
      }

      // Rust use statements
      if (language === 'rust') {
        if (trimmed.startsWith('use ')) {
          const match = trimmed.match(/use\s+(\w+)/);
          if (match && match[1] && !dependencies.includes(match[1])) {
            dependencies.push(match[1]);
          }
        }
      }
    }

    return dependencies.slice(0, 20); // Limit to prevent overwhelming output
  }

  private extractExports(content: string, language: string): string[] {
    const exports: string[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      // TypeScript/JavaScript exports
      if (language === 'typescript' || language === 'javascript') {
        if (trimmed.startsWith('export ')) {
          // Export function/class/const
          const match = trimmed.match(/export\s+(?:function|class|const|let|var)\s+(\w+)/);
          if (match && match[1] && !exports.includes(match[1])) {
            exports.push(match[1]);
          }

          // Export default
          if (trimmed.includes('export default')) {
            const defaultMatch = trimmed.match(/export\s+default\s+(\w+)/);
            if (defaultMatch && defaultMatch[1] && !exports.includes(defaultMatch[1])) {
              exports.push(defaultMatch[1]);
            }
          }
        }
      }

      // Python exports (functions and classes at module level)
      if (language === 'python') {
        if (trimmed.startsWith('def ') || trimmed.startsWith('class ')) {
          const match = trimmed.match(/(?:def|class)\s+(\w+)/);
          if (match && match[1] && !exports.includes(match[1])) {
            exports.push(match[1]);
          }
        }
      }

      // Rust public items
      if (language === 'rust') {
        if (trimmed.startsWith('pub ')) {
          const match = trimmed.match(/pub\s+(?:fn|struct|enum|trait)\s+(\w+)/);
          if (match && match[1] && !exports.includes(match[1])) {
            exports.push(match[1]);
          }
        }
      }
    }

    return exports.slice(0, 20); // Limit to prevent overwhelming output
  }

  private calculateMaintainabilityIndex(complexity: any): number {
    // Simplified maintainability index calculation
    const volume = Math.log2(complexity.lines || 1);
    const cyclomaticComplexity = complexity.cyclomatic || 1;
    const linesOfCode = complexity.lines || 1;

    // Microsoft maintainability index formula (simplified)
    const maintainabilityIndex = Math.max(0,
      171 - 5.2 * Math.log(volume) - 0.23 * cyclomaticComplexity - 16.2 * Math.log(linesOfCode)
    );

    return Math.round(maintainabilityIndex);
  }

  private assessTechnicalDebt(patterns: any[]): string {
    const violationPatterns = patterns.filter(p =>
      p.pattern_type?.includes('violation') ||
      p.description?.includes('anti-pattern') ||
      p.confidence < 0.5
    );

    const debtScore = violationPatterns.length;

    if (debtScore === 0) return 'low';
    if (debtScore <= 3) return 'medium';
    return 'high';
  }

  private async buildDirectoryStructure(path: string, maxDepth: number, currentDepth = 0): Promise<{
    name: string;
    type: 'file' | 'directory';
    path: string;
    size?: number;
    language?: string;
    lastModified?: Date;
    children?: Array<any>;
  }> {
    try {
      const stats = lstatSync(path);
      const name = basename(path);

      // Skip common ignored directories (but not for root directory)
      if (currentDepth > 0 && this.shouldIgnoreDirectory(name)) {
        return null as any;
      }

      if (stats.isFile()) {
        const language = this.detectLanguage(path);

        return {
          name,
          type: 'file' as const,
          path: relative(process.cwd(), path),
          size: stats.size,
          language,
          lastModified: stats.mtime
        };
      }

      if (stats.isDirectory() && currentDepth < maxDepth) {
        const children: Array<any> = [];

        try {
          const entries = readdirSync(path);

          for (const entry of entries) {
            const entryPath = join(path, entry);
            const child = await this.buildDirectoryStructure(entryPath, maxDepth, currentDepth + 1);

            if (child) {
              children.push(child);
            }
          }
        } catch (error) {
          // Skip directories we can't read
        }

        // Filter out null children and sort
        const validChildren = children.filter(child => child !== null);
        validChildren.sort((a, b) => {
          if (a.type !== b.type) {
            return a.type === 'directory' ? -1 : 1;
          }
          return a.name.localeCompare(b.name);
        });

        return {
          name,
          type: 'directory' as const,
          path: relative(process.cwd(), path),
          children: validChildren
        };
      }

      return null as any;
    } catch (error) {
      // Skip files/directories we can't access
      return null as any;
    }
  }

  private shouldIgnoreDirectory(name: string): boolean {
    const ignoredDirs = [
      'node_modules', '.git', '.svn', '.hg',
      'target', 'dist', 'build', '.next',
      '__pycache__', '.pytest_cache',
      '.vscode', '.idea', '.DS_Store',
      'coverage', '.nyc_output',
      'logs', '*.log'
    ];

    return ignoredDirs.includes(name) || name.startsWith('.');
  }

  private calculateStructureSummary(structure: any): {
    totalFiles: number;
    languages: Record<string, number>;
    directories: number;
    totalSize: number;
    filesByType: Record<string, number>;
    largestFiles: Array<{ name: string; size: number; path: string }>;
    oldestFiles: Array<{ name: string; lastModified: Date; path: string }>;
    newestFiles: Array<{ name: string; lastModified: Date; path: string }>;
  } {
    const summary = {
      totalFiles: 0,
      languages: {} as Record<string, number>,
      directories: 0,
      totalSize: 0,
      filesByType: {} as Record<string, number>,
      largestFiles: [] as Array<{ name: string; size: number; path: string }>,
      oldestFiles: [] as Array<{ name: string; lastModified: Date; path: string }>,
      newestFiles: [] as Array<{ name: string; lastModified: Date; path: string }>
    };

    const allFiles: Array<{ name: string; size: number; path: string; lastModified: Date; language: string }> = [];

    const traverse = (node: any) => {
      if (!node) return;

      if (node.type === 'directory') {
        summary.directories++;
        if (node.children) {
          node.children.forEach(traverse);
        }
      } else if (node.type === 'file') {
        summary.totalFiles++;
        summary.totalSize += node.size || 0;

        // Count by language
        const language = node.language || 'unknown';
        summary.languages[language] = (summary.languages[language] || 0) + 1;

        // Count by file extension
        const ext = extname(node.name).toLowerCase() || 'no-extension';
        summary.filesByType[ext] = (summary.filesByType[ext] || 0) + 1;

        // Collect file info for sorting
        allFiles.push({
          name: node.name,
          size: node.size || 0,
          path: node.path,
          lastModified: new Date(node.lastModified || Date.now()),
          language
        });
      }
    };

    traverse(structure);

    // Sort and get top files by different criteria
    const sortedBySize = [...allFiles].sort((a, b) => b.size - a.size);
    const sortedByAge = [...allFiles].sort((a, b) => a.lastModified.getTime() - b.lastModified.getTime());
    const sortedByRecent = [...allFiles].sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());

    summary.largestFiles = sortedBySize.slice(0, 5).map(f => ({
      name: f.name,
      size: f.size,
      path: f.path
    }));

    summary.oldestFiles = sortedByAge.slice(0, 5).map(f => ({
      name: f.name,
      lastModified: f.lastModified,
      path: f.path
    }));

    summary.newestFiles = sortedByRecent.slice(0, 5).map(f => ({
      name: f.name,
      lastModified: f.lastModified,
      path: f.path
    }));

    return summary;
  }

  private async semanticSearch(query: SearchQuery): Promise<any> {
    try {
      // Get the vector database from semantic engine
      const vectorResults = await this.semanticEngine.searchSemanticallySimilar(
        query.query,
        query.limit || 10
      );

      const results = [];

      for (const result of vectorResults) {
        try {
          // Read the file content for context
          const content = readFileSync(result.filePath, 'utf-8');
          const lines = content.split('\n');

          // Get context around the match (simple approach)
          const contextStart = Math.max(0, 0);
          const contextEnd = Math.min(lines.length, 10);
          const context = lines.slice(contextStart, contextEnd).join('\n');

          results.push({
            file: result.filePath,
            content: result.concept,
            score: result.similarity,
            context: context.substring(0, 200) + (context.length > 200 ? '...' : ''),
            metadata: {
              concept: result.concept,
              similarity: result.similarity,
              type: 'semantic'
            }
          });
        } catch (error) {
          // Skip files that can't be read
          continue;
        }
      }

      return {
        results,
        totalFound: results.length,
        searchType: 'semantic'
      };
    } catch (error: unknown) {
      console.error('Semantic search error:', error);
      return {
        results: [],
        totalFound: 0,
        searchType: 'semantic',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async patternSearch(query: SearchQuery): Promise<any> {
    try {
      // Search for patterns using the pattern engine
      const relevantPatterns = await this.patternEngine.findRelevantPatterns(
        query.query,
        undefined, // currentFile
        undefined  // selectedCode
      );

      const results = [];

      for (const pattern of relevantPatterns) {
        // For each pattern, find files that use this pattern
        for (const example of pattern.examples) {
          try {
            // Search for files containing similar code patterns
            const searchPattern = query.language ?
              `**/*.{${this.getFileExtensionsForLanguage(query.language)}}` :
              '**/*.{ts,tsx,js,jsx,py,rs,go,java}';

            const files = await glob(searchPattern, {
              ignore: ['**/node_modules/**', '**/.git/**', '**/target/**', '**/dist/**'],
              absolute: true
            });

            for (const file of files.slice(0, 10)) { // Limit for performance
              try {
                const content = readFileSync(file, 'utf-8');

                // Simple pattern matching - look for similar code structures
                if (this.matchesPattern(content, pattern.patternType, example.code)) {
                  const lines = content.split('\n');
                  const contextStart = Math.max(0, 0);
                  const contextEnd = Math.min(lines.length, 5);
                  const context = lines.slice(contextStart, contextEnd).join('\n');

                  results.push({
                    file: relative(process.cwd(), file),
                    content: pattern.patternContent.description || pattern.patternType,
                    score: pattern.confidence,
                    context: context.substring(0, 200) + (context.length > 200 ? '...' : ''),
                    metadata: {
                      patternType: pattern.patternType,
                      confidence: pattern.confidence,
                      frequency: pattern.frequency,
                      type: 'pattern'
                    }
                  });
                }
              } catch (error) {
                // Skip files that can't be read
                continue;
              }
            }
          } catch (error) {
            // Skip pattern examples that cause errors
            continue;
          }
        }
      }

      // Remove duplicates and sort by score
      const uniqueResults = results.filter((result, index, arr) =>
        arr.findIndex(r => r.file === result.file) === index
      ).sort((a, b) => b.score - a.score);

      return {
        results: uniqueResults.slice(0, query.limit || 10),
        totalFound: uniqueResults.length,
        searchType: 'pattern'
      };
    } catch (error: unknown) {
      console.error('Pattern search error:', error);
      return {
        results: [],
        totalFound: 0,
        searchType: 'pattern',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async textSearch(query: SearchQuery): Promise<any> {
    try {
      const searchPattern = query.language ?
        `**/*.{${this.getFileExtensionsForLanguage(query.language)}}` :
        '**/*.{ts,tsx,js,jsx,py,rs,go,java,cpp,c,cs,php,rb,swift,kt}';

      const files = await glob(searchPattern, {
        ignore: ['**/node_modules/**', '**/.git/**', '**/target/**', '**/dist/**', '**/build/**'],
        absolute: true
      });

      const results = [];
      const searchRegex = new RegExp(query.query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');

      for (const file of files) {
        try {
          const content = readFileSync(file, 'utf-8');
          const lines = content.split('\n');

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const matches = [...line.matchAll(searchRegex)];

            for (const match of matches) {
              const lineNumber = i + 1;
              const contextStart = Math.max(0, i - 2);
              const contextEnd = Math.min(lines.length, i + 3);
              const context = lines.slice(contextStart, contextEnd)
                .map((l, idx) => {
                  const actualLineNum = contextStart + idx + 1;
                  const marker = actualLineNum === lineNumber ? '>' : ' ';
                  return `${marker} ${actualLineNum}: ${l}`;
                })
                .join('\n');

              // Calculate relevance score based on match context
              const score = this.calculateTextMatchScore(line, match, query.query);

              results.push({
                file: relative(process.cwd(), file),
                content: line.trim(),
                score,
                context,
                metadata: {
                  lineNumber,
                  matchStart: match.index,
                  matchLength: match[0].length,
                  type: 'text'
                }
              });
            }
          }
        } catch (error) {
          // Skip files that can't be read
          continue;
        }
      }

      // Sort by relevance and limit results
      const sortedResults = results
        .sort((a, b) => b.score - a.score)
        .slice(0, query.limit || 20);

      return {
        results: sortedResults,
        totalFound: results.length,
        searchType: 'text'
      };
    } catch (error: unknown) {
      console.error('Text search error:', error);
      return {
        results: [],
        totalFound: 0,
        searchType: 'text',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private getFileExtensionsForLanguage(language: string): string {
    const extensions: Record<string, string> = {
      'typescript': 'ts,tsx',
      'javascript': 'js,jsx',
      'python': 'py',
      'rust': 'rs',
      'go': 'go',
      'java': 'java',
      'cpp': 'cpp,cc,cxx,hpp,h',
      'c': 'c,h',
      'csharp': 'cs',
      'php': 'php',
      'ruby': 'rb',
      'swift': 'swift',
      'kotlin': 'kt'
    };

    return extensions[language.toLowerCase()] || 'ts,js,py,rs';
  }

  private matchesPattern(content: string, patternType: string, exampleCode: string): boolean {
    // Simple pattern matching based on pattern type
    switch (patternType) {
      case 'camelCase_function_naming':
        return /function\s+[a-z][a-zA-Z]*/.test(content);
      case 'PascalCase_class_naming':
        return /class\s+[A-Z][a-zA-Z]*/.test(content);
      case 'testing':
        return /describe|it|test|expect/.test(content);
      case 'api_design':
        return /app\.(get|post|put|delete)|router\.(get|post|put|delete)/.test(content);
      case 'dependency_injection':
        return /constructor\([^)]*private|@Injectable/.test(content);
      case 'factory':
        return /Factory|create\w*\(/.test(content);
      case 'singleton':
        return /getInstance|private\s+static\s+instance/.test(content);
      default:
        // Generic pattern matching - look for similar keywords
        const keywords = exampleCode.match(/\b\w{3,}\b/g) || [];
        return keywords.some(keyword => content.includes(keyword));
    }
  }

  private calculateTextMatchScore(line: string, match: RegExpMatchArray, query: string): number {
    let score = 1.0;

    // Boost score for exact matches
    if (match[0].toLowerCase() === query.toLowerCase()) {
      score += 0.5;
    }

    // Boost score for matches at word boundaries
    if (match.index !== undefined) {
      const beforeChar = line[match.index - 1];
      const afterChar = line[match.index + match[0].length];

      if (!beforeChar || /\W/.test(beforeChar)) score += 0.2;
      if (!afterChar || /\W/.test(afterChar)) score += 0.2;
    }

    // Boost score for matches in function/class names
    if (/(function|class|interface|type)\s/.test(line)) {
      score += 0.3;
    }

    // Boost score for matches in comments
    if (/\/\/|#|<!--/.test(line)) {
      score += 0.1;
    }

    return score;
  }

  private async gatherIntelligentAnalysis(path: string) {
    try {
      // Use our actual intelligent engines
      console.log('🔍 Gathering intelligent analysis...');

      // Get codebase analysis using our semantic engine
      const codebaseAnalysis = await this.semanticEngine.analyzeCodebase(path);

      // Learn from codebase using our engines
      const semanticConcepts = await this.semanticEngine.learnFromCodebase(path);
      const patterns = await this.patternEngine.learnFromCodebase(path);

      // Get pattern analysis for individual patterns
      const patternInsights = await Promise.all(
        patterns.slice(0, 10).map(async pattern => {
          try {
            return await this.patternEngine.findRelevantPatterns(
              `analyze pattern ${pattern.type}`,
              undefined,
              undefined
            );
          } catch (error: unknown) {
            return [];
          }
        })
      );

      return {
        path,
        codebaseAnalysis,
        semanticConcepts,
        patterns,
        patternInsights: patternInsights.flat(),
        analysisTimestamp: new Date()
      };
    } catch (error: unknown) {
      console.error('❌ Intelligence gathering encountered errors:', error);
      console.warn('🔄 Returning degraded analysis results:');
      console.warn('   • Semantic analysis engines unavailable');
      console.warn('   • Pattern detection failed');  
      console.warn('   • Code complexity measurement not possible');
      console.warn('   • Documentation will include limited information');
      console.warn(`   • Analysis reliability severely compromised for: ${path}`);
      
      // Return degraded results but clearly mark them as such
      return {
        path,
        codebaseAnalysis: { 
          languages: ['analysis_failed'], // Clear indicator this is not real data
          frameworks: [], 
          complexity: { 
            cyclomatic: -1,  // Negative indicates "could not measure"
            cognitive: -1,   // vs. 0 which would mean "no complexity" 
            lines: -1 
          },
          concepts: [] 
        },
        semanticConcepts: [],
        patterns: [],
        patternInsights: [],
        analysisTimestamp: new Date(),
        analysisStatus: 'degraded', // Add metadata about analysis quality
        errors: [error instanceof Error ? error.message : String(error)] // Include error details for transparency
      };
    }
  }

  private async buildIntelligentDocumentation(analysis: any, options: DocOptions): Promise<string> {
    const sections: string[] = [];

    // Header with intelligence badge
    const projectName = analysis.path.split('/').pop() || 'Project';
    sections.push(`# ${projectName} - Intelligent Documentation`);
    sections.push(`\n*🤖 Generated on ${analysis.analysisTimestamp.toLocaleString()} by In Memoria AI*`);
    sections.push(`\n*📊 Analysis includes ${analysis.semanticConcepts.length} semantic concepts and ${analysis.patterns.length} patterns*\n`);

    // Table of Contents
    sections.push('## Table of Contents');
    sections.push('- [🔍 Intelligent Overview](#-intelligent-overview)');
    sections.push('- [🏗️ Architecture Intelligence](#-architecture-intelligence)');
    sections.push('- [🔄 Discovered Patterns](#-discovered-patterns)');
    sections.push('- [🧠 Semantic Concepts](#-semantic-concepts)');
    sections.push('- [📈 Complexity Intelligence](#-complexity-intelligence)');
    sections.push('- [🎯 AI Insights](#-ai-insights)');
    if (options.includeExamples) {
      sections.push('- [💡 Usage Examples](#-usage-examples)');
    }
    sections.push('');

    // Intelligent Overview
    sections.push('## 🔍 Intelligent Overview');
    sections.push(await this.generateIntelligentOverview(analysis));
    sections.push('');

    // Architecture Intelligence  
    sections.push('## 🏗️ Architecture Intelligence');
    sections.push(await this.generateArchitectureIntelligence(analysis));
    sections.push('');

    // Discovered Patterns
    sections.push('## 🔄 Discovered Patterns');
    sections.push(await this.generateDiscoveredPatterns(analysis));
    sections.push('');

    // Semantic Concepts
    sections.push('## 🧠 Semantic Concepts');
    sections.push(await this.generateSemanticConcepts(analysis));
    sections.push('');

    // Complexity Intelligence
    sections.push('## 📈 Complexity Intelligence');
    sections.push(await this.generateComplexityIntelligence(analysis));
    sections.push('');

    // AI Insights
    sections.push('## 🎯 AI Insights');
    sections.push(await this.generateRealIntelligentInsights(analysis));
    sections.push('');

    // Usage Examples
    if (options.includeExamples) {
      sections.push('## 💡 Usage Examples');
      sections.push(await this.generateIntelligentExamples(analysis));
      sections.push('');
    }

    return sections.join('\n');
  }

  private async generateOverview(analysis: CodebaseAnalysis): Promise<string> {
    const lines = [
      `This documentation provides an intelligent analysis of the **${analysis.path || 'codebase'}**.`,
      '',
      '### Language Distribution',
      ''
    ];

    // Language breakdown
    if (analysis.languages && analysis.languages.length > 0) {
      for (const lang of analysis.languages) {
        lines.push(`- **${lang}**: Detected in codebase`);
      }
    } else {
      lines.push('- Languages detected through file analysis');
    }

    lines.push('');
    lines.push('### Key Metrics');
    if (analysis.complexity) {
      lines.push(`- **Cyclomatic Complexity**: ${analysis.complexity.cyclomatic || 'N/A'}`);
      lines.push(`- **Cognitive Complexity**: ${analysis.complexity.cognitive || 'N/A'}`);
      lines.push(`- **Total Lines**: ${analysis.complexity.lines || 'N/A'}`);
    } else {
      lines.push('- Complexity metrics will be calculated during analysis');
    }

    // Add architectural insights based on patterns
    if (analysis.patterns && analysis.patterns.length > 0) {
      const hasComponents = analysis.patterns.some(p => p.type?.includes('component'));
      const hasServices = analysis.patterns.some(p => p.type?.includes('service'));
      const hasUtils = analysis.patterns.some(p => p.type?.includes('util'));

      if (hasComponents || hasServices || hasUtils) {
        lines.push('');
        lines.push('### Architecture Style');
        if (hasComponents) lines.push('- Component-based architecture detected');
        if (hasServices) lines.push('- Service-oriented patterns found');
        if (hasUtils) lines.push('- Utility-driven organization identified');
      }
    }

    return lines.join('\n');
  }

  private async generateArchitectureSection(analysis: CodebaseAnalysis): Promise<string> {
    const lines = [
      'This section describes the architectural patterns and structure of the codebase.',
      ''
    ];

    // Directory structure insights
    if (analysis.patterns && analysis.patterns.length > 0) {
      const structuralPatterns = analysis.patterns.filter(p =>
        p.type?.includes('structure') || p.type?.includes('organization'));

      if (structuralPatterns.length > 0) {
        lines.push('### Structural Organization');
        lines.push('');
        for (const pattern of structuralPatterns.slice(0, 5)) {
          const patternName = pattern.type?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Pattern';
          lines.push(`- **${patternName}**: ${pattern.description || 'Structural pattern detected'}`);
        }
        lines.push('');
      }

      // Design patterns
      const designPatterns = analysis.patterns.filter(p =>
        p.type?.includes('implementation') || p.type?.includes('pattern'));

      if (designPatterns.length > 0) {
        lines.push('### Design Patterns');
        lines.push('');
        for (const pattern of designPatterns.slice(0, 5)) {
          const patternName = pattern.type?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Pattern';
          lines.push(`- **${patternName}**: ${pattern.description || 'Design pattern detected'}`);
        }
        lines.push('');
      }
    } else {
      lines.push('### Architecture Analysis');
      lines.push('');
      lines.push('*Architecture patterns will be identified through detailed code analysis.*');
      lines.push('');
    }

    return lines.join('\n');
  }

  private async generatePatternsSection(analysis: CodebaseAnalysis): Promise<string> {
    const lines = [
      'This section analyzes the coding patterns and conventions used throughout the codebase.',
      ''
    ];

    // Group patterns by category
    const patternsByCategory: Record<string, any[]> = {};
    for (const pattern of analysis.patterns) {
      const category = pattern.type.split('_')[0];
      if (!patternsByCategory[category]) patternsByCategory[category] = [];
      patternsByCategory[category].push(pattern);
    }

    // Naming patterns
    if (patternsByCategory.naming) {
      lines.push('### Naming Conventions');
      lines.push('');
      for (const pattern of patternsByCategory.naming) {
        const confidence = (pattern.confidence * 100).toFixed(0);
        lines.push(`- **${pattern.type.replace(/naming_/, '').replace(/_/g, ' ')}**: ${pattern.description} (${confidence}% consistency)`);
      }
      lines.push('');
    }

    // Implementation patterns
    if (patternsByCategory.implementation) {
      lines.push('### Implementation Patterns');
      lines.push('');
      for (const pattern of patternsByCategory.implementation) {
        const confidence = (pattern.confidence * 100).toFixed(0);
        lines.push(`- **${pattern.type.replace(/implementation_/, '').replace(/_/g, ' ')}**: ${pattern.description}`);
        lines.push(`  - Usage confidence: ${confidence}%`);
      }
      lines.push('');
    }

    // Dependency patterns
    if (patternsByCategory.dependency) {
      lines.push('### Dependency Patterns');
      lines.push('');
      for (const pattern of patternsByCategory.dependency) {
        lines.push(`- **${pattern.type.replace(/dependency_/, '').replace(/_/g, ' ')}**: ${pattern.description}`);
      }
      lines.push('');
    }

    // Pattern recommendations
    lines.push('### Pattern Recommendations');
    lines.push('');
    if (analysis.patterns.length > 10) {
      lines.push('✅ **Strong pattern consistency** - The codebase shows consistent use of established patterns.');
    } else if (analysis.patterns.length > 5) {
      lines.push('⚠️ **Moderate pattern usage** - Consider establishing more consistent patterns for better maintainability.');
    } else {
      lines.push('🔴 **Limited pattern detection** - Consider implementing more structured coding patterns.');
    }

    return lines.join('\n');
  }

  private async generateConceptsSection(analysis: CodebaseAnalysis): Promise<string> {
    const lines = [
      'This section provides an overview of the semantic concepts identified in the codebase.',
      ''
    ];

    if (analysis.concepts && analysis.concepts.length > 0) {
      // Group by type
      const conceptsByType: Record<string, any[]> = {};
      for (const concept of analysis.concepts) {
        const type = concept.type || 'unknown';
        if (!conceptsByType[type]) conceptsByType[type] = [];
        conceptsByType[type].push(concept);
      }

      lines.push('### Concept Distribution');
      lines.push('');
      for (const [type, concepts] of Object.entries(conceptsByType)) {
        lines.push(`- **${type.charAt(0).toUpperCase() + type.slice(1)}s**: ${concepts.length} identified`);
      }
      lines.push('');

      // High-confidence concepts
      const highConfidenceConcepts = analysis.concepts
        .filter(c => (c.confidence || 0) > 0.8)
        .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
        .slice(0, 10);

      if (highConfidenceConcepts.length > 0) {
        lines.push('### Key Concepts (High Confidence)');
        lines.push('');
        for (const concept of highConfidenceConcepts) {
          const confidence = ((concept.confidence || 0) * 100).toFixed(0);
          lines.push(`- **${concept.name}** (${concept.type}) - ${confidence}% confidence`);
        }
        lines.push('');
      }
    } else {
      lines.push('*Semantic concepts will be extracted through detailed code analysis.*');
      lines.push('');
    }

    return lines.join('\n');
  }

  private async generateComplexitySection(analysis: CodebaseAnalysis): Promise<string> {
    const lines = [
      'This section analyzes the complexity characteristics of the codebase.',
      ''
    ];

    if (analysis.complexity) {
      lines.push('### Overall Complexity Metrics');
      lines.push(`- **Cyclomatic Complexity**: ${analysis.complexity.cyclomatic || 'N/A'}`);
      lines.push(`- **Cognitive Complexity**: ${analysis.complexity.cognitive || 'N/A'}`);
      lines.push(`- **Total Lines**: ${analysis.complexity.lines || 'N/A'}`);
      lines.push('');

      // Simple recommendations based on available data
      lines.push('### Complexity Assessment');
      const cyclomaticComplexity = analysis.complexity.cyclomatic || 0;
      if (cyclomaticComplexity < 10) {
        lines.push('✅ **Low complexity** - The codebase maintains good simplicity and readability.');
      } else if (cyclomaticComplexity < 30) {
        lines.push('⚠️ **Moderate complexity** - Consider refactoring the most complex functions and classes.');
      } else {
        lines.push('🔴 **High complexity** - Priority refactoring recommended to improve maintainability.');
      }
    } else {
      lines.push('### Complexity Analysis');
      lines.push('*Complexity metrics will be calculated during detailed code analysis.*');
    }

    return lines.join('\n');
  }

  private async generateDependenciesSection(analysis: CodebaseAnalysis): Promise<string> {
    const lines = [
      'This section analyzes the dependency structure and relationships within the codebase.',
      ''
    ];

    lines.push('### Dependency Analysis');
    lines.push('*Dependency analysis will be performed during detailed code scanning.*');
    lines.push('');
    lines.push('**Typical analysis includes:**');
    lines.push('- External package dependencies');
    lines.push('- Internal module relationships');
    lines.push('- Dependency coupling metrics');
    lines.push('- Potential circular dependencies');

    return lines.join('\n');
  }

  private async generateUsageExamples(analysis: CodebaseAnalysis): Promise<string> {
    const lines = [
      'This section provides usage examples based on the identified patterns and concepts.',
      ''
    ];

    lines.push('### Usage Examples');
    lines.push('*Usage examples will be generated based on detected patterns and entry points.*');
    lines.push('');

    if (analysis.patterns && analysis.patterns.length > 0) {
      lines.push('**Detected Patterns:**');
      for (const pattern of analysis.patterns.slice(0, 3)) {
        const patternName = pattern.type?.replace(/_/g, ' ') || 'Pattern';
        lines.push(`- ${patternName}: ${pattern.description || 'Pattern detected'}`);
      }
    } else {
      lines.push('**Pattern-Based Examples:**');
      lines.push('- Examples will be provided based on code analysis');
      lines.push('- Usage patterns will be identified automatically');
      lines.push('- Common architectural patterns will be documented');
    }

    return lines.join('\n');
  }

  // New intelligent documentation generation methods using real data

  private async generateIntelligentOverview(analysis: any): Promise<string> {
    const lines = [
      `This codebase has been analyzed using semantic analysis and pattern recognition.`,
      '# Intelligent Code Analysis',
      '',
      '### 🤖 AI Analysis Summary',
      `- **Languages detected**: ${analysis.codebaseAnalysis.languages.join(', ')}`,
      `- **Semantic concepts extracted**: ${analysis.semanticConcepts.length}`,
      `- **Coding patterns discovered**: ${analysis.patterns.length}`,
      `- **Pattern insights generated**: ${analysis.patternInsights.length}`,
      '',
      '### 📊 Complexity Metrics',
    ];

    if (analysis.codebaseAnalysis.complexity) {
      const complexity = analysis.codebaseAnalysis.complexity;
      lines.push(`- **Cyclomatic Complexity**: ${complexity.cyclomatic}`);
      lines.push(`- **Cognitive Complexity**: ${complexity.cognitive}`);
      lines.push(`- **Total Lines**: ${complexity.lines}`);

      // Intelligence-based recommendations
      if (complexity.cyclomatic > 30) {
        lines.push(`- ⚠️ **AI Recommendation**: High complexity detected - consider refactoring for maintainability`);
      } else if (complexity.cyclomatic > 10) {
        lines.push(`- ✅ **AI Assessment**: Moderate complexity - well-structured codebase`);
      } else {
        lines.push(`- 🎯 **AI Assessment**: Low complexity - excellent code organization`);
      }
    }

    if (analysis.codebaseAnalysis.frameworks && analysis.codebaseAnalysis.frameworks.length > 0) {
      lines.push('');
      lines.push('### 🔧 Detected Frameworks');
      for (const framework of analysis.codebaseAnalysis.frameworks) {
        lines.push(`- ${framework}`);
      }
    }

    return lines.join('\n');
  }

  private async generateArchitectureIntelligence(analysis: any): Promise<string> {
    const lines = [
      'Architectural analysis reveals the following patterns and structures:',
      '## Architecture Intelligence',
      ''
    ];

    // Analyze patterns for architectural insights
    const structuralPatterns = analysis.patterns.filter((p: any) =>
      p.type?.includes('structure') || p.type?.includes('organization'));
    const implementationPatterns = analysis.patterns.filter((p: any) =>
      p.type?.includes('implementation'));

    if (structuralPatterns.length > 0) {
      lines.push('### 🏗️ Structural Patterns (AI-Detected)');
      lines.push('');
      for (const pattern of structuralPatterns) {
        const confidence = ((pattern.confidence || 0) * 100).toFixed(0);
        lines.push(`- **${pattern.type?.replace(/_/g, ' ')}**: ${pattern.description || 'Detected by AI analysis'} (${confidence}% confidence)`);
      }
      lines.push('');
    }

    if (implementationPatterns.length > 0) {
      lines.push('### ⚙️ Implementation Patterns (AI-Detected)');
      lines.push('');
      for (const pattern of implementationPatterns) {
        const confidence = ((pattern.confidence || 0) * 100).toFixed(0);
        lines.push(`- **${pattern.type?.replace(/implementation_/, '').replace(/_/g, ' ')}**: ${pattern.description || 'Pattern detected'} (${confidence}% confidence)`);
      }
      lines.push('');
    }

    // Get real pattern recommendations from intelligence tools
    lines.push('### 🎯 AI Architectural Assessment');
    if (analysis.patterns.length > 10) {
      lines.push('✅ **Strong architectural patterns** - The codebase demonstrates consistent design patterns and organizational structure.');
    } else if (analysis.patterns.length > 5) {
      lines.push('⚠️ **Emerging patterns** - Some architectural patterns detected, consider strengthening consistency.');
    } else {
      lines.push('🔍 **Pattern opportunities** - Consider implementing more structured architectural patterns.');
    }

    return lines.join('\n');
  }

  private async generateDiscoveredPatterns(analysis: any): Promise<string> {
    const lines = [
      'Advanced pattern recognition has identified the following coding patterns:',
      ''
    ];

    if (analysis.patterns.length === 0) {
      lines.push('*No patterns detected yet. Run the learning pipeline to discover patterns.*');
      return lines.join('\n');
    }

    // Group patterns by category
    const patternsByCategory: Record<string, any[]> = {};
    for (const pattern of analysis.patterns) {
      const category = pattern.type?.split('_')[0] || 'other';
      if (!patternsByCategory[category]) patternsByCategory[category] = [];
      patternsByCategory[category].push(pattern);
    }

    // Naming patterns
    if (patternsByCategory.naming) {
      lines.push('### 📝 Naming Conventions (AI-Learned)');
      lines.push('');
      for (const pattern of patternsByCategory.naming) {
        const confidence = ((pattern.confidence || 0) * 100).toFixed(0);
        const frequency = pattern.frequency || 0;
        lines.push(`- **${pattern.type?.replace(/naming_/, '').replace(/_/g, ' ')}**: ${pattern.description || 'Naming pattern'}`);
        lines.push(`  - Frequency: ${frequency} occurrences`);
        lines.push(`  - Consistency: ${confidence}%`);
      }
      lines.push('');
    }

    // Implementation patterns
    if (patternsByCategory.implementation) {
      lines.push('### 🔧 Implementation Patterns (AI-Discovered)');
      lines.push('');
      for (const pattern of patternsByCategory.implementation) {
        const confidence = ((pattern.confidence || 0) * 100).toFixed(0);
        lines.push(`- **${pattern.type?.replace(/implementation_/, '').replace(/_/g, ' ')}**: ${pattern.description || 'Implementation pattern'}`);
        lines.push(`  - AI Confidence: ${confidence}%`);
      }
      lines.push('');
    }

    // Pattern insights
    if (analysis.patternInsights.length > 0) {
      lines.push('### 💡 Pattern Insights (AI-Generated)');
      lines.push('');
      for (const insight of analysis.patternInsights.slice(0, 5)) {
        const confidence = ((insight.confidence || 0) * 100).toFixed(0);
        lines.push(`- **${insight.patternType?.replace(/_/g, ' ')}**: Found in ${insight.frequency || 1} locations (${confidence}% relevance)`);
      }
    }

    return lines.join('\n');
  }

  private async generateSemanticConcepts(analysis: any): Promise<string> {
    const lines = [
      'Semantic analysis using tree-sitter has extracted the following concepts:',
      ''
    ];

    if (analysis.semanticConcepts.length === 0) {
      lines.push('*No semantic concepts extracted yet. The learning pipeline will extract concepts from the codebase.*');
      return lines.join('\n');
    }

    // Group concepts by type
    const conceptsByType: Record<string, any[]> = {};
    for (const concept of analysis.semanticConcepts) {
      const type = concept.type || 'unknown';
      if (!conceptsByType[type]) conceptsByType[type] = [];
      conceptsByType[type].push(concept);
    }

    lines.push('### 📊 Concept Distribution');
    lines.push('');
    for (const [type, concepts] of Object.entries(conceptsByType)) {
      lines.push(`- **${type.charAt(0).toUpperCase() + type.slice(1)}s**: ${concepts.length} identified`);
    }
    lines.push('');

    // High-confidence concepts
    const highConfidenceConcepts = analysis.semanticConcepts
      .filter((c: any) => (c.confidence || 0) > 0.8)
      .sort((a: any, b: any) => (b.confidence || 0) - (a.confidence || 0))
      .slice(0, 10);

    if (highConfidenceConcepts.length > 0) {
      lines.push('### 🎯 High-Confidence Concepts (AI-Verified)');
      lines.push('');
      for (const concept of highConfidenceConcepts) {
        const confidence = ((concept.confidence || 0) * 100).toFixed(0);
        const filePath = concept.filePath?.split('/').pop() || 'unknown';
        lines.push(`- **${concept.name}** (${concept.type}) - ${confidence}% confidence in ${filePath}`);
      }
      lines.push('');
    }

    // Concept relationships
    const conceptsWithRelationships = analysis.semanticConcepts.filter((c: any) =>
      c.relationships && Object.keys(c.relationships).length > 0);

    if (conceptsWithRelationships.length > 0) {
      lines.push('### 🔗 Concept Relationships (AI-Mapped)');
      lines.push('');
      for (const concept of conceptsWithRelationships.slice(0, 5)) {
        const relationshipCount = Object.keys(concept.relationships).length;
        lines.push(`- **${concept.name}**: Connected to ${relationshipCount} other concept${relationshipCount > 1 ? 's' : ''}`);
      }
    }

    return lines.join('\n');
  }

  private async generateComplexityIntelligence(analysis: any): Promise<string> {
    const lines = [
      'Complexity analysis provides the following insights:',
      '## Intelligent Complexity Assessment',
      ''
    ];

    if (analysis.codebaseAnalysis.complexity) {
      const complexity = analysis.codebaseAnalysis.complexity;

      lines.push('### 📈 Complexity Metrics');
      lines.push(`- **Cyclomatic Complexity**: ${complexity.cyclomatic}`);
      lines.push(`- **Cognitive Complexity**: ${complexity.cognitive}`);
      lines.push(`- **Lines of Code**: ${complexity.lines}`);
      lines.push('');

      // Get intelligent complexity recommendations from pattern analysis
      lines.push('### 🤖 AI Complexity Assessment');
      const cyclomaticScore = complexity.cyclomatic || 0;
      const cognitiveScore = complexity.cognitive || 0;

      if (cyclomaticScore < 10 && cognitiveScore < 15) {
        lines.push('✅ **Excellent maintainability** - Low complexity indicates well-structured, readable code');
        lines.push('- Code complexity is well-managed - maintain current practices');
        lines.push('- Code appears to follow single responsibility principle');
      } else if (cyclomaticScore < 30 && cognitiveScore < 50) {
        lines.push('⚠️ **Moderate complexity** - Some areas may benefit from refactoring');
        lines.push('- Consider refactoring complex functions into smaller components');
        lines.push('- Consider extracting helper methods for clarity');
      } else {
        lines.push('🔴 **High complexity detected** - Refactoring recommended for maintainability');
        lines.push('- High complexity detected - prioritize refactoring for maintainability');
        lines.push('- Consider applying design patterns to reduce complexity');
        lines.push('- Break large functions into smaller, focused units');
      }

      // Concept-based complexity insights
      if (analysis.semanticConcepts.length > 0) {
        const avgConceptsPerComplexity = analysis.semanticConcepts.length / (complexity.lines / 100);
        lines.push('');
        lines.push('### 🧠 Semantic Complexity Ratio');
        lines.push(`- **Concept density**: ${avgConceptsPerComplexity.toFixed(2)} concepts per 100 lines`);

        if (avgConceptsPerComplexity > 5) {
          lines.push('- ✅ High semantic richness - good abstraction level');
        } else if (avgConceptsPerComplexity > 2) {
          lines.push('- ⚠️ Moderate semantic density - consider more abstractions');
        } else {
          lines.push('- 🔍 Low semantic density - may benefit from better organization');
        }
      }
    } else {
      lines.push('*Complexity analysis will be available after running the intelligence pipeline.*');
    }

    return lines.join('\n');
  }

  private async generateRealIntelligentInsights(analysis: any): Promise<string> {
    try {
      const lines = [
        'Real-time intelligent insights generated from learned patterns and semantic analysis:',
        ''
      ];

      // Get real semantic insights from intelligence tools
      const semanticInsights = await this.intelligenceTools.getSemanticInsights({ limit: 5 });

      lines.push('### 🧠 Semantic Intelligence');
      if (semanticInsights.insights.length > 0) {
        lines.push(`- **Active concepts**: ${semanticInsights.totalAvailable} concepts in knowledge base`);
        lines.push(`- **Key concepts analyzed**:`);
        for (const insight of semanticInsights.insights) {
          const contexts = insight.usage.contexts.length;
          lines.push(`  - **${insight.concept}**: Used in ${contexts} context${contexts > 1 ? 's' : ''} (confidence: ${insight.usage.frequency}%)`);
        }

        // Analyze concept relationships
        const conceptsWithRelationships = semanticInsights.insights.filter(i => i.relationships.length > 0);
        if (conceptsWithRelationships.length > 0) {
          lines.push(`- **Relationship mapping**: ${conceptsWithRelationships.length} concepts have identified relationships`);
        }
      } else {
        lines.push('- *Run learning pipeline to extract semantic concepts*');
      }
      lines.push('');

      // Get real pattern recommendations
      const patternRecs = await this.intelligenceTools.getPatternRecommendations({
        problemDescription: 'General codebase analysis and pattern consistency',
        currentFile: analysis.path
      });

      lines.push('### 🔍 Pattern Recommendations');
      if (patternRecs.recommendations.length > 0) {
        lines.push(`- **Pattern analysis**: ${patternRecs.recommendations.length} patterns identified for optimization`);
        for (const rec of patternRecs.recommendations.slice(0, 3)) {
          lines.push(`  - **${rec.pattern.split('_').slice(1).join(' ')}**: ${rec.description} (${(rec.confidence * 100).toFixed(0)}% confidence)`);
          lines.push(`    - ${rec.reasoning}`);
        }
        lines.push(`- ${patternRecs.reasoning}`);
      } else {
        lines.push('- *Run learning pipeline to discover pattern recommendations*');
      }
      lines.push('');

      // Get coding approach predictions
      const approach = await this.intelligenceTools.predictCodingApproach({
        problemDescription: 'Evaluate overall codebase architecture and suggest improvements',
        context: {
          'complexity_cyclomatic': analysis.codebaseAnalysis.complexity?.cyclomatic?.toString() || '0',
          'complexity_cognitive': analysis.codebaseAnalysis.complexity?.cognitive?.toString() || '0',
          'patterns_count': analysis.patterns.length.toString(),
          'concepts_count': analysis.semanticConcepts.length.toString()
        }
      });

      lines.push('### 🎯 Intelligent Recommendations');
      lines.push(`- **Suggested approach**: ${approach.approach}`);
      lines.push(`- **Confidence level**: ${(approach.confidence * 100).toFixed(0)}%`);
      lines.push(`- **Estimated complexity**: ${approach.estimatedComplexity}`);
      if (approach.suggestedPatterns.length > 0) {
        lines.push(`- **Recommended patterns**: ${approach.suggestedPatterns.join(', ')}`);
      }
      lines.push(`- **Reasoning**: ${approach.reasoning}`);

      return lines.join('\n');
    } catch (error) {
      // Single fallback for all intelligence failures
      return [
        'Intelligent insights temporarily unavailable.',
        '',
        '### 📊 Basic Analysis',
        `- **Patterns detected**: ${analysis.patterns.length}`,
        `- **Semantic concepts**: ${analysis.semanticConcepts.length}`,
        `- **Complexity score**: ${analysis.codebaseAnalysis.complexity?.cyclomatic || 'N/A'}`,
        '',
        '*Run the learning pipeline to enable full intelligent insights.*'
      ].join('\n');
    }
  }

  private async generateIntelligentExamples(analysis: any): Promise<string> {
    try {
      const lines = [
        'Intelligent usage examples generated from real pattern analysis:',
        ''
      ];

      // Get pattern recommendations for example generation
      const patternRecs = await this.intelligenceTools.getPatternRecommendations({
        problemDescription: 'Generate usage examples based on discovered patterns',
        currentFile: analysis.path
      });

      if (patternRecs.recommendations.length > 0) {
        lines.push('### 🎯 Pattern-Based Examples');
        lines.push('');

        for (const rec of patternRecs.recommendations.slice(0, 3)) {
          if (rec.examples.length > 0) {
            const patternName = rec.pattern.split('_').slice(1).join(' ').replace(/\b\w/g, l => l.toUpperCase());
            lines.push(`#### ${patternName} Pattern`);
            lines.push('```typescript');
            lines.push(`// Real examples from your codebase (${rec.reasoning})`);
            for (const example of rec.examples.slice(0, 2)) {
              lines.push(example);
            }
            lines.push('```');
            lines.push('');
          }
        }
      }

      // Get semantic insights for concept-based examples
      const semanticInsights = await this.intelligenceTools.getSemanticInsights({ limit: 3 });

      if (semanticInsights.insights.length > 0) {
        lines.push('### 🧠 Concept-Based Usage');
        lines.push('');

        for (const insight of semanticInsights.insights) {
          lines.push(`#### ${insight.concept} Usage`);
          lines.push('```typescript');
          lines.push(`// Based on semantic analysis of ${insight.concept}`);
          lines.push(`// Used in ${insight.usage.contexts.length} context(s) with ${insight.usage.frequency}% confidence`);

          // Generate intelligent usage example based on concept
          const conceptType = insight.concept.toLowerCase();
          if (conceptType.includes('engine') || conceptType.includes('service')) {
            lines.push(`const ${insight.concept.toLowerCase()} = new ${insight.concept}();`);
            lines.push(`const result = await ${insight.concept.toLowerCase()}.process(data);`);
          } else if (conceptType.includes('tools') || conceptType.includes('utils')) {
            lines.push(`import { ${insight.concept} } from './path/to/${insight.concept}';`);
            lines.push(`const tools = new ${insight.concept}();`);
          } else {
            lines.push(`// ${insight.concept} implementation patterns discovered`);
            lines.push(`const instance = new ${insight.concept}();`);
          }
          lines.push('```');
          lines.push('');
        }
      }

      if (patternRecs.recommendations.length === 0 && semanticInsights.insights.length === 0) {
        lines.push('### 📚 Learning Required');
        lines.push('*Run the learning pipeline to discover patterns and generate intelligent examples.*');
        lines.push('');
        lines.push('**Available after learning:**');
        lines.push('- Real code examples from your patterns');
        lines.push('- Usage recommendations based on semantic analysis');
        lines.push('- Context-specific implementation guidance');
      }

      return lines.join('\n');
    } catch (error) {
      // Fallback for examples generation
      return [
        'Example generation temporarily unavailable.',
        '',
        '### 📝 Basic Examples',
        '```typescript',
        '// Run learning pipeline to enable intelligent examples',
        'const analysis = await analyzer.analyze(codebase);',
        'const patterns = await patternEngine.discover();',
        '```'
      ].join('\n');
    }
  }
}