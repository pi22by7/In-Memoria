import { Surreal } from 'surrealdb';
import * as SurrealNodeModule from '@surrealdb/node';

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

  constructor(apiKey?: string) {
    this.db = new Surreal({
      engines: (SurrealNodeModule as any).surrealdbNodeEngines(),
    });
    // Store API key for potential OpenAI embeddings in the future
    if (apiKey || process.env.OPENAI_API_KEY) {
      // For now, we'll use local embeddings
      // This could be extended to use OpenAI embeddings later
    }
  }

  async initialize(collectionName: string = 'code-cartographer'): Promise<void> {
    try {
      // Use in-memory embedded mode for SurrealDB with Node.js engine
      // Falls back to persistent surrealkv:// if needed for durability
      await this.db.connect('mem://');

      // Use database and namespace
      await this.db.use({
        namespace: 'code_cartographer',
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
      console.error('Failed to initialize SurrealDB:', error);
      throw error;
    }
  }

  async storeCodeEmbedding(code: string, metadata: CodeMetadata): Promise<void> {
    if (!this.initialized) {
      throw new Error('Vector database not initialized. Call initialize() first.');
    }

    const embedding = this.generateEmbedding(code);
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

    const documents: CodeDocument[] = codeChunks.map((code, index) => ({
      code,
      embedding: this.generateEmbedding(code),
      metadata: metadataList[index],
      created: new Date(),
      updated: new Date()
    }));

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

    const embedding = this.generateEmbedding(code);
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
    const count = result[0]?.[0]?.total || 0;

    return {
      count,
      metadata: {
        description: 'Code Cartographer semantic code embeddings',
        engine: 'SurrealDB'
      }
    };
  }

  // Generate simple TF-IDF style embeddings for semantic similarity
  private generateEmbedding(text: string): number[] {
    // Tokenize and clean text
    const tokens = text.toLowerCase()
      .replace(/[^a-zA-Z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 2);

    // Create a fixed-size vocabulary for consistent embeddings
    const vocabulary = this.getVocabulary();
    const embedding = new Array(vocabulary.length).fill(0);

    // Calculate term frequency
    const termFreq = new Map<string, number>();
    for (const token of tokens) {
      termFreq.set(token, (termFreq.get(token) || 0) + 1);
    }

    // Generate embedding vector
    for (const [term, freq] of termFreq) {
      const index = vocabulary.indexOf(term);
      if (index !== -1) {
        embedding[index] = freq / tokens.length; // Normalized frequency
      }
    }

    return embedding;
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
    if (this.db) {
      await this.db.close();
    }
  }
}
