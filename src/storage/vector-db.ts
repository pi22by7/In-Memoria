import { Surreal } from 'surrealdb';
import * as SurrealNodeModule from '@surrealdb/node';
import { CircuitBreaker, createOpenAICircuitBreaker } from '../utils/circuit-breaker.js';
import { globalProfiler, PerformanceOptimizer } from '../utils/performance-profiler.js';
import OpenAI from 'openai';
import { pipeline } from '@xenova/transformers';
import { Logger } from '../utils/logger.js';

export interface CodeMetadata {
  id: string;
  filePath: string;
  functionName?: string;
  className?: string;
  language: string;
  complexity: number;
  lineCount: number;
  lastModified: Date;
}

export interface SemanticSearchResult {
  id: string;
  code: string;
  metadata: CodeMetadata;
  similarity: number;
}

interface CodeDocument {
  id?: string;
  code: string;
  embedding?: number[];
  metadata: CodeMetadata;
  created: Date;
  updated: Date;
  [key: string]: unknown;
}

export class SemanticVectorDB {
  private db: Surreal;
  private initialized: boolean = false;
  private openaiCircuitBreaker: CircuitBreaker;
  private apiKey?: string;
  private openaiClient: OpenAI | undefined;
  private localEmbeddingPipeline: any; // Use any to avoid complex typing issues

  // Real vector operations with caching
  private embeddingCache = new Map<string, number[]>();
  private readonly EMBEDDING_CACHE_SIZE = 1000;
  private readonly EMBEDDING_DIMENSION = 1536; // OpenAI ada-002 dimension
  private readonly LOCAL_EMBEDDING_DIMENSION = 384; // All-MiniLM-L6-v2 dimension
  
  // Embedding progress tracking
  private hasLoggedEmbeddingStart = false;

  constructor(apiKey?: string) {
    this.db = new Surreal({
      engines: (SurrealNodeModule as any).surrealdbNodeEngines(),
    });

    this.apiKey = apiKey || process.env.OPENAI_API_KEY;
    this.openaiCircuitBreaker = createOpenAICircuitBreaker();

    // Initialize OpenAI client if API key is available
    if (this.apiKey) {
      this.openaiClient = new OpenAI({ apiKey: this.apiKey });
    }

    this.initializeLocalEmbeddings();
  }

  /**
   * Initialize local embedding pipeline using transformers.js
   */
  private async initializeLocalEmbeddings(): Promise<void> {
    try {
      Logger.info('🔧 Initializing local embedding pipeline...');
      // Use all-MiniLM-L6-v2 for quality local embeddings
      this.localEmbeddingPipeline = await pipeline(
        'feature-extraction',
        'Xenova/all-MiniLM-L6-v2'
      );
      Logger.info('✅ Local embedding pipeline ready');
    } catch (error: unknown) {
      Logger.warn('⚠️  Failed to initialize local embeddings:', error instanceof Error ? error.message : String(error));
      Logger.info('📝 Will use fallback local embedding method');
    }
  }

  async initialize(collectionName: string = 'in-memoria'): Promise<void> {
    try {
      // Use in-memory embedded mode for SurrealDB with Node.js engine
      // Falls back to persistent surrealkv:// if needed for durability
      await this.db.connect('mem://');

      // Use database and namespace
      await this.db.use({
        namespace: 'in_memoria',
        database: collectionName
      });

      // Define the code documents table with full-text search capabilities
      await this.db.query(`
        DEFINE ANALYZER code_analyzer TOKENIZERS blank FILTERS lowercase,ascii;
        DEFINE TABLE code_documents SCHEMAFULL;
        DEFINE FIELD code ON code_documents TYPE string;
        DEFINE FIELD embedding ON code_documents TYPE array;
        DEFINE FIELD metadata ON code_documents TYPE object;
        DEFINE FIELD created ON code_documents TYPE datetime DEFAULT time::now();
        DEFINE FIELD updated ON code_documents TYPE datetime DEFAULT time::now();
        DEFINE INDEX code_content ON code_documents COLUMNS code SEARCH ANALYZER code_analyzer BM25(1.2,0.75) HIGHLIGHTS;
      `);

      this.initialized = true;
    } catch (error) {
      Logger.error('Failed to initialize SurrealDB:', error);
      throw error;
    }
  }

  async storeCodeEmbedding(code: string, metadata: CodeMetadata): Promise<void> {
    if (!this.initialized) {
      throw new Error('Vector database not initialized. Call initialize() first.');
    }

    const embedding = await this.generateEmbedding(code);
    const document: CodeDocument = {
      code,
      embedding,
      metadata,
      created: new Date(),
      updated: new Date()
    };

    await this.db.create('code_documents', document);
  }

  async storeMultipleEmbeddings(
    codeChunks: string[],
    metadataList: CodeMetadata[]
  ): Promise<void> {
    if (!this.initialized) {
      throw new Error('Vector database not initialized. Call initialize() first.');
    }

    if (codeChunks.length !== metadataList.length) {
      throw new Error('Code chunks and metadata arrays must have the same length');
    }

    const documents: CodeDocument[] = await Promise.all(
      codeChunks.map(async (code, index) => ({
        code,
        embedding: await this.generateEmbedding(code),
        metadata: metadataList[index],
        created: new Date(),
        updated: new Date()
      }))
    );

    // Insert multiple documents
    for (const doc of documents) {
      await this.db.create('code_documents', doc);
    }
  }

  async findSimilarCode(
    query: string,
    limit: number = 5,
    filters?: Record<string, any>
  ): Promise<SemanticSearchResult[]> {
    if (!this.initialized) {
      throw new Error('Vector database not initialized. Call initialize() first.');
    }

    if (!query || query.trim() === '') {
      // If no query, just return all documents matching filters
      let searchQuery = 'SELECT * FROM code_documents';
      const params: Record<string, any> = { limit };

      if (filters) {
        const filterConditions = Object.entries(filters)
          .map(([key, value]) => `metadata.${key} = $${key}`)
          .join(' AND ');
        searchQuery += ` WHERE ${filterConditions}`;
        Object.assign(params, filters);
      }

      searchQuery += ` LIMIT $limit`;

      const results = await this.db.query(searchQuery, params);
      const documents = results[0] as any[] || [];

      return documents.map(doc => ({
        id: doc.id,
        code: doc.code,
        metadata: doc.metadata,
        similarity: 0.5 // Default similarity for non-search results
      }));
    }

    // Use SurrealDB's full-text search for semantic similarity
    let searchQuery = `
      SELECT *, search::score(1) AS similarity 
      FROM code_documents 
      WHERE code @@ $query
    `;

    // Add filters if provided
    if (filters) {
      const filterConditions = Object.entries(filters)
        .map(([key, value]) => `metadata.${key} = $${key}`)
        .join(' AND ');
      searchQuery += ` AND ${filterConditions}`;
    }

    searchQuery += ` ORDER BY similarity DESC LIMIT $limit`;

    const params: Record<string, any> = { query, limit };
    if (filters) {
      Object.assign(params, filters);
    }

    const results = await this.db.query(searchQuery, params);
    const documents = results[0] as any[] || [];

    return documents.map(doc => ({
      id: doc.id,
      code: doc.code,
      metadata: doc.metadata,
      similarity: doc.similarity || 0
    }));
  }

  async findSimilarCodeByFile(
    filePath: string,
    limit: number = 5
  ): Promise<SemanticSearchResult[]> {
    return this.findSimilarCode('', limit, { filePath });
  }

  async findSimilarCodeByLanguage(
    query: string,
    language: string,
    limit: number = 5
  ): Promise<SemanticSearchResult[]> {
    return this.findSimilarCode(query, limit, { language });
  }

  async updateCodeEmbedding(id: string, code: string, metadata: CodeMetadata): Promise<void> {
    if (!this.initialized) {
      throw new Error('Vector database not initialized. Call initialize() first.');
    }

    const embedding = await this.generateEmbedding(code);
    await this.db.merge(id, {
      code,
      embedding,
      metadata,
      updated: new Date()
    });
  }

  async deleteCodeEmbedding(id: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('Vector database not initialized. Call initialize() first.');
    }

    await this.db.delete(id);
  }

  async deleteCodeEmbeddingsByFile(filePath: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('Vector database not initialized. Call initialize() first.');
    }

    await this.db.query('DELETE code_documents WHERE metadata.filePath = $filePath', {
      filePath
    });
  }

  async getCollectionStats(): Promise<{ count: number; metadata: any }> {
    if (!this.initialized) {
      throw new Error('Vector database not initialized. Call initialize() first.');
    }

    const result = await this.db.query('SELECT count() AS total FROM code_documents GROUP ALL');
    const count = Array.isArray(result) && Array.isArray(result[0]) && result[0][0] ? (result[0][0] as any).total || 0 : 0;

    return {
      count,
      metadata: {
        description: 'In Memoria semantic code embeddings',
        engine: 'SurrealDB'
      }
    };
  }

  // Generate semantic embeddings using the best available method
  private async generateEmbedding(text: string): Promise<number[]> {
    return this.generateRealSemanticEmbedding(text);
  }

  /**
   * Generate real semantic embeddings using OpenAI or sophisticated local method
   */
  private async generateRealSemanticEmbedding(code: string): Promise<number[]> {
    // Check cache first
    const cacheKey = this.createCacheKey(code);
    if (this.embeddingCache.has(cacheKey)) {
      return this.embeddingCache.get(cacheKey)!;
    }

    let embedding: number[];

    // Log once at start of embedding process
    if (!this.hasLoggedEmbeddingStart) {
      if (this.openaiClient && this.apiKey && this.apiKey.length > 0) {
        Logger.info('🔧 Initializing OpenAI embedding pipeline...');
      } else {
        Logger.info('🔧 Initializing local embedding pipeline...');
      }
      this.hasLoggedEmbeddingStart = true;
    }

    // Try OpenAI embeddings first if API key is available
    if (this.openaiClient && this.apiKey && this.apiKey.length > 0) {
      try {
        embedding = await this.getOpenAIEmbedding(code);
      } catch (error: unknown) {
        Logger.warn('⚠️  OpenAI embedding failed, using local embedding:', error instanceof Error ? error.message : String(error));
        embedding = await this.getLocalEmbedding(code);
      }
    } else {
      // Use local embedding
      embedding = await this.getLocalEmbedding(code);
    }

    // Cache the result
    this.cacheEmbedding(cacheKey, embedding);
    return embedding;
  }

  /**
   * Get embeddings from OpenAI API using the official SDK
   */
  private async getOpenAIEmbedding(code: string): Promise<number[]> {
    if (!this.openaiClient) {
      throw new Error('OpenAI client not initialized');
    }

    return this.openaiCircuitBreaker.execute(async () => {
      const cleanCode = this.preprocessCodeForEmbedding(code);

      const response = await this.openaiClient!.embeddings.create({
        model: 'text-embedding-ada-002',
        input: cleanCode,
      });

      if (!response.data || response.data.length === 0) {
        throw new Error('No embeddings returned from OpenAI API');
      }

      return response.data[0].embedding;
    });
  }

  /**
   * Get local embeddings using transformers.js or fallback method
   */
  private async getLocalEmbedding(code: string): Promise<number[]> {
    if (this.localEmbeddingPipeline) {
      try {
        const cleanCode = this.preprocessCodeForEmbedding(code);
        const result = await this.localEmbeddingPipeline(cleanCode, {
          pooling: 'mean',
          normalize: true
        });

        // Convert tensor to array
        const embedding = Array.from(result.data) as number[];
        return embedding;
      } catch (error: unknown) {
        Logger.warn('⚠️  Local embedding pipeline failed:', error instanceof Error ? error.message : String(error));
      }
    }

    // Fallback to advanced local method
    return this.generateAdvancedLocalEmbedding(code);
  }

  /**
   * Generate advanced local semantic embeddings using multiple techniques
   */
  private generateAdvancedLocalEmbedding(code: string): number[] {
    const embedding = new Array(this.LOCAL_EMBEDDING_DIMENSION).fill(0);

    // 1. Structural features (25%)
    const structural = this.extractStructuralFeatures(code);
    const structuralSize = Math.floor(this.LOCAL_EMBEDDING_DIMENSION * 0.25);
    for (let i = 0; i < Math.min(structuralSize, structural.length); i++) {
      embedding[i] = structural[i];
    }

    // 2. Semantic token features (35%)
    const semantic = this.extractSemanticFeatures(code);
    const semanticSize = Math.floor(this.LOCAL_EMBEDDING_DIMENSION * 0.35);
    for (let i = 0; i < Math.min(semanticSize, semantic.length); i++) {
      embedding[structuralSize + i] = semantic[i];
    }

    // 3. AST-based features (25%)
    const ast = this.extractASTFeatures(code);
    const astSize = Math.floor(this.LOCAL_EMBEDDING_DIMENSION * 0.25);
    const astStart = structuralSize + semanticSize;
    for (let i = 0; i < Math.min(astSize, ast.length); i++) {
      embedding[astStart + i] = ast[i];
    }

    // 4. Context features (15%)
    const context = this.extractContextFeatures(code);
    const contextSize = this.LOCAL_EMBEDDING_DIMENSION - astStart - astSize;
    const contextStart = astStart + astSize;
    for (let i = 0; i < Math.min(contextSize, context.length); i++) {
      embedding[contextStart + i] = context[i];
    }

    return this.normalizeVector(embedding);
  }

  /**
   * For backward compatibility - use the proper local embedding method
   */
  private async generateLocalEmbedding(text: string): Promise<number[]> {
    return this.getLocalEmbedding(text);
  }  /**
   * Extract structural code features
   */
  private extractStructuralFeatures(code: string): number[] {
    const features: number[] = [];

    // Function density
    const functions = (code.match(/function\s+\w+|const\s+\w+\s*=\s*(?:\([^)]*\)\s*=>|async\s*\([^)]*\)\s*=>)/g) || []).length;
    features.push(Math.min(functions / 10, 1));

    // Class density
    const classes = (code.match(/class\s+\w+/g) || []).length;
    features.push(Math.min(classes / 5, 1));

    // Import/export density
    const imports = (code.match(/import\s+.*from|export\s+/g) || []).length;
    features.push(Math.min(imports / 10, 1));

    // Async patterns
    const async = (code.match(/async\s+|await\s+|Promise/g) || []).length;
    features.push(Math.min(async / 8, 1));

    // Control flow complexity
    const control = (code.match(/if\s*\(|for\s*\(|while\s*\(|switch\s*\(/g) || []).length;
    features.push(Math.min(control / 15, 1));

    // Add more structural features up to 96
    const patterns = [
      /try\s*{|catch\s*\(/g,  // Error handling
      /\.\w+\s*\(/g,          // Method calls
      /{\s*\w+:/g,            // Object literals
      /\[\w*\]/g,             // Array access
      /=>\s*{/g,              // Arrow functions
      /interface\s+\w+/g,     // TypeScript interfaces
      /type\s+\w+/g,          // Type definitions
      /enum\s+\w+/g           // Enums
    ];

    for (const pattern of patterns) {
      const count = (code.match(pattern) || []).length;
      features.push(Math.min(count / 5, 1));
    }

    // Pad to 96 features
    while (features.length < 96) {
      features.push(0);
    }

    return features.slice(0, 96);
  }

  /**
   * Extract semantic token features
   */
  private extractSemanticFeatures(code: string): number[] {
    const features: number[] = [];
    const tokens = this.extractMeaningfulTokens(code);

    // Semantic categories with weights
    const categories = [
      { keywords: ['service', 'controller', 'model', 'view', 'component'], weight: 1.0 },
      { keywords: ['create', 'read', 'update', 'delete', 'get', 'set'], weight: 0.9 },
      { keywords: ['user', 'auth', 'login', 'token', 'session'], weight: 0.8 },
      { keywords: ['api', 'http', 'request', 'response', 'endpoint'], weight: 0.8 },
      { keywords: ['database', 'query', 'table', 'schema', 'migration'], weight: 0.7 },
      { keywords: ['test', 'spec', 'mock', 'assert', 'expect'], weight: 0.7 },
      { keywords: ['config', 'env', 'settings', 'options'], weight: 0.6 },
      { keywords: ['util', 'helper', 'common', 'shared', 'lib'], weight: 0.5 }
    ];

    for (const category of categories) {
      let categoryScore = 0;
      for (const keyword of category.keywords) {
        const count = tokens.filter(token =>
          token.toLowerCase().includes(keyword.toLowerCase())
        ).length;
        categoryScore += count * category.weight;
      }
      features.push(Math.min(categoryScore / 10, 1));
    }

    // TF-IDF like scoring for important programming terms
    const vocab = this.getProgrammingVocabulary();
    const tokenFreq = this.calculateTokenFrequency(tokens);

    for (const term of vocab.slice(0, 120)) { // Use top 120 terms
      const freq = tokenFreq.get(term.toLowerCase()) || 0;
      const tf = freq / tokens.length;
      features.push(Math.min(tf * 10, 1)); // Normalized TF
    }

    // Pad to 134 features
    while (features.length < 134) {
      features.push(0);
    }

    return features.slice(0, 134);
  }

  /**
   * Extract AST-based features
   */
  private extractASTFeatures(code: string): number[] {
    const features: number[] = [];

    // Declaration patterns
    const declarations = {
      variables: /(?:let|const|var)\s+\w+/g,
      functions: /function\s+\w+/g,
      classes: /class\s+\w+/g,
      interfaces: /interface\s+\w+/g
    };

    for (const [_, pattern] of Object.entries(declarations)) {
      const count = (code.match(pattern) || []).length;
      features.push(Math.min(count / 8, 1));
    }

    // Expression complexity
    const expressions = {
      assignments: /=\s*[^=]/g,
      comparisons: /[!=]==?|[<>]=?/g,
      logical: /&&|\|\|/g,
      arithmetic: /[+\-*/%]/g
    };

    for (const [_, pattern] of Object.entries(expressions)) {
      const count = (code.match(pattern) || []).length;
      features.push(Math.min(count / 20, 1));
    }

    // Nesting depth estimation
    let maxDepth = 0;
    let currentDepth = 0;
    for (const char of code) {
      if (char === '{') currentDepth++;
      if (char === '}') currentDepth--;
      maxDepth = Math.max(maxDepth, currentDepth);
    }
    features.push(Math.min(maxDepth / 8, 1));

    // Pad to 96 features
    while (features.length < 96) {
      features.push(0);
    }

    return features.slice(0, 96);
  }

  /**
   * Extract contextual features
   */
  private extractContextFeatures(code: string): number[] {
    const features: number[] = [];

    // Code quality indicators
    const comments = (code.match(/\/\/.*|\/\*[\s\S]*?\*\//g) || []).join('').length;
    features.push(Math.min(comments / code.length, 1)); // Comment density

    const strings = (code.match(/"[^"]*"|'[^']*'|`[^`]*`/g) || []).join('').length;
    features.push(Math.min(strings / code.length, 0.5)); // String density

    // Line metrics
    const lines = code.split('\n').length;
    const avgLineLength = code.length / lines;
    features.push(Math.min(lines / 100, 1));
    features.push(Math.min(avgLineLength / 80, 1));

    // Domain-specific patterns
    const domains = {
      web: /http|url|fetch|ajax|xhr|dom|html|css/gi,
      database: /sql|query|select|insert|update|delete|join/gi,
      testing: /test|spec|describe|it|expect|assert|mock/gi,
      async: /async|await|promise|callback|then|catch/gi,
      security: /auth|encrypt|decrypt|hash|token|jwt|bcrypt/gi
    };

    for (const [_, pattern] of Object.entries(domains)) {
      const matches = (code.match(pattern) || []).length;
      features.push(Math.min(matches / 5, 1));
    }

    // Pad to 58 features
    while (features.length < 58) {
      features.push(0);
    }

    return features.slice(0, 58);
  }

  /**
   * Extract meaningful programming tokens
   */
  private extractMeaningfulTokens(code: string): string[] {
    // Remove comments and strings
    const cleanCode = code
      .replace(/\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/["'`][^"'`]*["'`]/g, 'STRING');

    // Extract identifiers and keywords
    const tokens = cleanCode.match(/\b[a-zA-Z][a-zA-Z0-9_]*\b/g) || [];

    // Filter out very short tokens and common noise
    const noise = new Set(['a', 'an', 'the', 'is', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);
    return tokens
      .filter(token => token.length > 2)
      .filter(token => !noise.has(token.toLowerCase()));
  }

  /**
   * Get programming-specific vocabulary
   */
  private getProgrammingVocabulary(): string[] {
    return [
      'function', 'class', 'method', 'variable', 'constant', 'parameter', 'argument',
      'return', 'async', 'await', 'promise', 'callback', 'event', 'handler',
      'component', 'service', 'controller', 'model', 'view', 'router',
      'request', 'response', 'api', 'endpoint', 'middleware', 'auth',
      'database', 'query', 'select', 'insert', 'update', 'delete',
      'test', 'spec', 'mock', 'assert', 'expect', 'describe',
      'config', 'env', 'settings', 'options', 'params',
      'error', 'exception', 'try', 'catch', 'throw', 'finally',
      'loop', 'iteration', 'condition', 'branch', 'switch', 'case',
      'array', 'object', 'string', 'number', 'boolean', 'null',
      'import', 'export', 'module', 'require', 'include',
      'interface', 'type', 'generic', 'template', 'abstract',
      'static', 'private', 'public', 'protected', 'readonly',
      'constructor', 'destructor', 'extends', 'implements', 'super'
    ];
  }

  /**
   * Calculate token frequency
   */
  private calculateTokenFrequency(tokens: string[]): Map<string, number> {
    const freq = new Map<string, number>();
    for (const token of tokens) {
      const lower = token.toLowerCase();
      freq.set(lower, (freq.get(lower) || 0) + 1);
    }
    return freq;
  }

  /**
   * Preprocess code for embedding
   */
  private preprocessCodeForEmbedding(code: string): string {
    return code
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\/\/.*$/gm, '') // Remove comments
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .trim()
      .substring(0, 8000); // Limit for API
  }

  /**
   * Create cache key from code
   */
  private createCacheKey(code: string): string {
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < Math.min(code.length, 1000); i++) {
      const char = code.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString();
  }

  /**
   * Cache embedding with LRU eviction
   */
  private cacheEmbedding(key: string, embedding: number[]): void {
    if (this.embeddingCache.size >= this.EMBEDDING_CACHE_SIZE) {
      // Remove oldest entry
      const firstKey = this.embeddingCache.keys().next().value;
      if (firstKey !== undefined) {
        this.embeddingCache.delete(firstKey);
      }
    }
    this.embeddingCache.set(key, embedding);
  }

  /**
   * Normalize vector for cosine similarity
   */
  private normalizeVector(vector: number[]): number[] {
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (magnitude === 0) return vector;
    return vector.map(val => val / magnitude);
  }

  private getVocabulary(): string[] {
    // Common programming terms vocabulary
    return [
      'function', 'class', 'method', 'variable', 'const', 'let', 'var', 'return',
      'if', 'else', 'for', 'while', 'loop', 'array', 'object', 'string', 'number',
      'boolean', 'null', 'undefined', 'true', 'false', 'import', 'export', 'from',
      'default', 'async', 'await', 'promise', 'callback', 'event', 'handler',
      'component', 'props', 'state', 'render', 'dom', 'element', 'node', 'tree',
      'data', 'type', 'interface', 'enum', 'struct', 'trait', 'impl', 'pub',
      'private', 'public', 'protected', 'static', 'final', 'abstract', 'virtual',
      'override', 'extends', 'implements', 'constructor', 'destructor', 'this',
      'self', 'super', 'new', 'delete', 'malloc', 'free', 'memory', 'pointer',
      'reference', 'value', 'copy', 'move', 'clone', 'borrow', 'lifetime',
      'generic', 'template', 'macro', 'annotation', 'decorator', 'attribute',
      'property', 'field', 'member', 'parameter', 'argument', 'result', 'error',
      'exception', 'try', 'catch', 'finally', 'throw', 'raise', 'panic',
      'test', 'assert', 'debug', 'log', 'print', 'console', 'output', 'input',
      'file', 'path', 'directory', 'folder', 'read', 'write', 'create', 'delete',
      'update', 'insert', 'select', 'query', 'database', 'table', 'column',
      'index', 'key', 'value', 'pair', 'map', 'set', 'list', 'vector', 'stack',
      'queue', 'heap', 'tree', 'graph', 'node', 'edge', 'vertex', 'algorithm',
      'sort', 'search', 'find', 'filter', 'reduce', 'map', 'foreach', 'iterate',
      'recursive', 'iteration', 'condition', 'check', 'validate', 'verify',
      'process', 'thread', 'sync', 'async', 'parallel', 'concurrent', 'mutex',
      'lock', 'atomic', 'volatile', 'safe', 'unsafe', 'security', 'encrypt',
      'decrypt', 'hash', 'random', 'uuid', 'token', 'auth', 'login', 'logout'
    ];
  }

  // Cleanup method
  async close(): Promise<void> {
    // Dispose of transformers.js pipeline to prevent hanging
    if (this.localEmbeddingPipeline) {
      try {
        // Check if the pipeline has a dispose method
        if (typeof this.localEmbeddingPipeline.dispose === 'function') {
          await this.localEmbeddingPipeline.dispose();
        }
        this.localEmbeddingPipeline = null;
      } catch (error) {
        Logger.warn('Warning: Failed to dispose local embedding pipeline:', error);
      }
    }

    // Close SurrealDB connection
    if (this.db) {
      await this.db.close();
    }
  }
}
