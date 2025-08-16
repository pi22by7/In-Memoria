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
import { readFileSync, statSync, readdirSync, lstatSync } from 'fs';
import { join, relative, extname, basename } from 'path';
import { glob } from 'glob';

export class CoreAnalysisTools {
  constructor(
    private semanticEngine: SemanticEngine,
    private patternEngine: PatternEngine
  ) {}

  get tools(): Tool[] {
    return [
      {
        name: 'analyze_codebase',
        description: 'Perform comprehensive analysis of a codebase including semantic concepts, patterns, and complexity metrics',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the codebase directory to analyze'
            }
          },
          required: ['path']
        }
      },
      {
        name: 'get_file_content',
        description: 'Retrieve the content of a specific file with metadata',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the file to read'
            }
          },
          required: ['path']
        }
      },
      {
        name: 'get_project_structure',
        description: 'Get the hierarchical structure of a project directory',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the project directory'
            },
            maxDepth: {
              type: 'number',
              description: 'Maximum depth to traverse (default: 5)'
            }
          },
          required: ['path']
        }
      },
      {
        name: 'search_codebase',
        description: 'Search the codebase using semantic, text, or pattern-based queries',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query string'
            },
            type: {
              type: 'string',
              enum: ['semantic', 'text', 'pattern'],
              description: 'Type of search to perform'
            },
            language: {
              type: 'string',
              description: 'Filter by programming language'
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
      },
      {
        name: 'generate_documentation',
        description: 'Generate intelligent documentation for the codebase',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the codebase'
            },
            format: {
              type: 'string',
              enum: ['markdown', 'html', 'json'],
              description: 'Output format for documentation'
            },
            includeExamples: {
              type: 'boolean',
              description: 'Include code examples in documentation'
            },
            includeArchitecture: {
              type: 'boolean',
              description: 'Include architectural analysis'
            },
            outputPath: {
              type: 'string',
              description: 'Optional path to save generated documentation'
            }
          },
          required: ['path']
        }
      }
    ];
  }

  async analyzeCodebase(args: { path: string }): Promise<CodebaseAnalysis> {
    try {
      // Perform comprehensive semantic analysis
      const analysis = await this.semanticEngine.analyzeCodebase(args.path);
      
      // Extract and learn patterns
      const patterns = await this.patternEngine.extractPatterns(args.path);
      
      // Enhance with additional insights
      const enhancedAnalysis = {
        path: args.path,
        languages: analysis.languages,
        frameworks: analysis.frameworks,
        complexity: analysis.complexity,
        concepts: analysis.concepts.map(concept => ({
          name: concept.name,
          type: concept.type,
          confidence: concept.confidence
        })),
        patterns: patterns.map(p => ({
          type: p.type,
          description: p.description,
          frequency: p.frequency
        })),
        // Note: Enhanced insights would be available through separate tools
      };
      
      return enhancedAnalysis;
    } catch (error) {
      console.error('Codebase analysis error:', error);
      // Return minimal analysis on error
      return {
        path: args.path,
        languages: ['unknown'],
        frameworks: [],
        complexity: { cyclomatic: 1, cognitive: 1, lines: 0 },
        concepts: [],
        patterns: [],
        // Note: Enhanced insights would be available through separate tools
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
      throw new Error(`Failed to analyze file ${args.path}: ${error}`);
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
    const options = DocOptionsSchema.parse(args);
    const analysis = await this.analyzeCodebase({ path: args.path });
    
    const documentation = await this.buildDocumentation(analysis, options);
    
    return {
      documentation,
      metadata: {
        generatedAt: new Date(),
        format: options.format,
        sections: ['overview', 'architecture', 'patterns', 'concepts']
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
    } catch (error) {
      console.error('Semantic search error:', error);
      return {
        results: [],
        totalFound: 0,
        searchType: 'semantic',
        error: error.message
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
    } catch (error) {
      console.error('Pattern search error:', error);
      return {
        results: [],
        totalFound: 0,
        searchType: 'pattern',
        error: error.message
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
    } catch (error) {
      console.error('Text search error:', error);
      return {
        results: [],
        totalFound: 0,
        searchType: 'text',
        error: error.message
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

  private async buildDocumentation(analysis: CodebaseAnalysis, options: DocOptions): Promise<string> {
    // Implementation for generating documentation based on analysis
    return `# ${analysis.path} Documentation\n\nGenerated documentation content...`;
  }
}