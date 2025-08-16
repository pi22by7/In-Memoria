import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';

// Simple local vector storage implementation
// This provides semantic search without requiring external APIs
class LocalVectorStore {
  private vectors: Map<string, { embedding: number[], metadata: any, document: string }> = new Map();
  private storePath: string;
  
  constructor(storePath: string = './vector-store.json') {
    this.storePath = storePath;
    this.loadFromDisk();
  }
  
  async add(data: { documents: string[], metadatas: any[], ids: string[] }) {
    for (let i = 0; i < data.documents.length; i++) {
      const embedding = this.generateEmbedding(data.documents[i]);
      this.vectors.set(data.ids[i], {
        embedding,
        metadata: data.metadatas[i],
        document: data.documents[i]
      });
    }
    this.saveToDisk();
  }
  
  async query(params: { queryTexts: string[], nResults: number, where?: any }) {
    const queryEmbedding = this.generateEmbedding(params.queryTexts[0]);
    const results: Array<{ id: string, distance: number, document: string, metadata: any }> = [];
    
    for (const [id, data] of this.vectors) {
      // Apply filters if specified
      if (params.where) {
        let matches = true;
        for (const [key, value] of Object.entries(params.where)) {
          if (data.metadata[key] !== value) {
            matches = false;
            break;
          }
        }
        if (!matches) continue;
      }
      
      const distance = this.cosineSimilarity(queryEmbedding, data.embedding);
      results.push({ id, distance, document: data.document, metadata: data.metadata });
    }
    
    // Sort by similarity (lower distance = higher similarity)
    results.sort((a, b) => a.distance - b.distance);
    const topResults = results.slice(0, params.nResults);
    
    return {
      documents: [topResults.map(r => r.document)],
      metadatas: [topResults.map(r => r.metadata)],
      distances: [topResults.map(r => r.distance)],
      ids: [topResults.map(r => r.id)]
    };
  }
  
  async update(params: { ids: string[], documents: string[], metadatas: any[] }) {
    for (let i = 0; i < params.ids.length; i++) {
      const embedding = this.generateEmbedding(params.documents[i]);
      this.vectors.set(params.ids[i], {
        embedding,
        metadata: params.metadatas[i],
        document: params.documents[i]
      });
    }
    this.saveToDisk();
  }
  
  async delete(params: { ids?: string[], where?: any }) {
    if (params.ids) {
      for (const id of params.ids) {
        this.vectors.delete(id);
      }
    } else if (params.where) {
      const toDelete: string[] = [];
      for (const [id, data] of this.vectors) {
        let matches = true;
        for (const [key, value] of Object.entries(params.where)) {
          if (data.metadata[key] !== value) {
            matches = false;
            break;
          }
        }
        if (matches) toDelete.push(id);
      }
      for (const id of toDelete) {
        this.vectors.delete(id);
      }
    }
    this.saveToDisk();
  }
  
  async count() {
    return this.vectors.size;
  }
  
  // Simple TF-IDF based embedding generation
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
    // Common programming terms vocabulary (this could be expanded)
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
  
  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    if (normA === 0 || normB === 0) return 1; // Maximum distance for zero vectors
    
    return 1 - (dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))); // Convert similarity to distance
  }
  
  private loadFromDisk() {
    try {
      if (fs.existsSync(this.storePath)) {
        const data = JSON.parse(fs.readFileSync(this.storePath, 'utf8'));
        this.vectors = new Map(data.vectors || []);
      }
    } catch (error) {
      console.warn('Failed to load vector store from disk:', error);
      this.vectors = new Map();
    }
  }
  
  private saveToDisk() {
    try {
      const data = {
        vectors: Array.from(this.vectors.entries()),
        lastSaved: new Date().toISOString()
      };
      fs.writeFileSync(this.storePath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.warn('Failed to save vector store to disk:', error);
    }
  }
}

class LocalVectorCollection {
  private store: LocalVectorStore;
  public metadata: any;
  
  constructor(name: string, metadata: any = {}) {
    this.store = new LocalVectorStore(`./data/${name}-vectors.json`);
    this.metadata = metadata;
  }
  
  async add(data: { documents: string[], metadatas: any[], ids: string[] }) {
    return this.store.add(data);
  }
  
  async query(params: { queryTexts: string[], nResults: number, where?: any }) {
    return this.store.query(params);
  }
  
  async update(params: { ids: string[], documents: string[], metadatas: any[] }) {
    return this.store.update(params);
  }
  
  async delete(params: { ids?: string[], where?: any }) {
    return this.store.delete(params);
  }
  
  async count() {
    return this.store.count();
  }
}

class LocalVectorClient {
  private collections: Map<string, LocalVectorCollection> = new Map();
  
  async getCollection(options: { name: string }) {
    if (!this.collections.has(options.name)) {
      throw new Error(`Collection ${options.name} does not exist`);
    }
    return this.collections.get(options.name)!;
  }
  
  async createCollection(options: { name: string, metadata?: any }) {
    if (this.collections.has(options.name)) {
      return this.collections.get(options.name)!;
    }
    
    // Ensure data directory exists
    const dataDir = './data';
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    const collection = new LocalVectorCollection(options.name, options.metadata);
    this.collections.set(options.name, collection);
    return collection;
  }
}

class LocalEmbeddingFunction {
  // Local embedding function placeholder
}

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

export class SemanticVectorDB {
  private client: LocalVectorClient;
  private collection: LocalVectorCollection | null = null;
  private embeddingFunction: LocalEmbeddingFunction;

  constructor(_apiKey?: string) {
    this.client = new LocalVectorClient();
    this.embeddingFunction = new LocalEmbeddingFunction();
  }

  async initialize(collectionName: string = 'code-cartographer'): Promise<void> {
    try {
      this.collection = await this.client.getCollection({
        name: collectionName
      });
    } catch (error) {
      // Collection doesn't exist, create it
      this.collection = await this.client.createCollection({
        name: collectionName,
        metadata: {
          description: 'Code Cartographer semantic code embeddings'
        }
      });
    }
  }

  async storeCodeEmbedding(code: string, metadata: CodeMetadata): Promise<void> {
    if (!this.collection) {
      throw new Error('Vector database not initialized. Call initialize() first.');
    }

    await this.collection.add({
      documents: [code],
      metadatas: [this.metadataToRecord(metadata)],
      ids: [metadata.id]
    });
  }

  async storeMultipleEmbeddings(
    codeChunks: string[], 
    metadataList: CodeMetadata[]
  ): Promise<void> {
    if (!this.collection) {
      throw new Error('Vector database not initialized. Call initialize() first.');
    }

    if (codeChunks.length !== metadataList.length) {
      throw new Error('Code chunks and metadata arrays must have the same length');
    }

    await this.collection.add({
      documents: codeChunks,
      metadatas: metadataList.map(m => this.metadataToRecord(m)),
      ids: metadataList.map(m => m.id)
    });
  }

  async findSimilarCode(
    query: string, 
    limit: number = 5,
    filters?: Record<string, any>
  ): Promise<SemanticSearchResult[]> {
    if (!this.collection) {
      throw new Error('Vector database not initialized. Call initialize() first.');
    }

    const results = await this.collection.query({
      queryTexts: [query],
      nResults: limit,
      where: filters
    });

    if (!results.documents?.[0] || !results.metadatas?.[0] || !results.distances?.[0]) {
      return [];
    }

    return results.documents[0].map((doc, index) => ({
      id: results.ids![0][index],
      code: doc!,
      metadata: this.recordToMetadata(results.metadatas![0][index]!),
      similarity: 1 - (results.distances![0][index] || 0) // Convert distance to similarity
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
    if (!this.collection) {
      throw new Error('Vector database not initialized. Call initialize() first.');
    }

    await this.collection.update({
      ids: [id],
      documents: [code],
      metadatas: [this.metadataToRecord(metadata)]
    });
  }

  async deleteCodeEmbedding(id: string): Promise<void> {
    if (!this.collection) {
      throw new Error('Vector database not initialized. Call initialize() first.');
    }

    await this.collection.delete({
      ids: [id]
    });
  }

  async deleteCodeEmbeddingsByFile(filePath: string): Promise<void> {
    if (!this.collection) {
      throw new Error('Vector database not initialized. Call initialize() first.');
    }

    await this.collection.delete({
      where: { filePath }
    });
  }

  async getCollectionStats(): Promise<{ count: number; metadata: any }> {
    if (!this.collection) {
      throw new Error('Vector database not initialized. Call initialize() first.');
    }

    const count = await this.collection.count();
    return {
      count,
      metadata: this.collection.metadata
    };
  }

  private metadataToRecord(metadata: CodeMetadata): Record<string, any> {
    return {
      filePath: metadata.filePath,
      functionName: metadata.functionName || null,
      className: metadata.className || null,
      language: metadata.language,
      complexity: metadata.complexity,
      lineCount: metadata.lineCount,
      lastModified: metadata.lastModified.toISOString()
    };
  }

  private recordToMetadata(record: Record<string, any>): CodeMetadata {
    return {
      id: record.id || '',
      filePath: record.filePath || '',
      functionName: record.functionName || undefined,
      className: record.className || undefined,
      language: record.language || 'unknown',
      complexity: record.complexity || 0,
      lineCount: record.lineCount || 0,
      lastModified: new Date(record.lastModified || Date.now())
    };
  }
}