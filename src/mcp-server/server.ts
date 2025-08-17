import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

import { CoreAnalysisTools } from './tools/core-analysis.js';
import { IntelligenceTools } from './tools/intelligence-tools.js';
import { SemanticEngine } from '../engines/semantic-engine.js';
import { PatternEngine } from '../engines/pattern-engine.js';
import { SQLiteDatabase } from '../storage/sqlite-db.js';
import { SemanticVectorDB } from '../storage/vector-db.js';

export class CodeCartographerMCP {
  private server: Server;
  private database: SQLiteDatabase;
  private vectorDB: SemanticVectorDB;
  private semanticEngine: SemanticEngine;
  private patternEngine: PatternEngine;
  private coreTools: CoreAnalysisTools;
  private intelligenceTools: IntelligenceTools;

  constructor() {
    this.server = new Server(
      {
        name: 'in-memoria',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.initializeComponents();
    this.setupHandlers();
  }

  private initializeComponents(): void {
    // Initialize storage
    this.database = new SQLiteDatabase('./in-memoria.db');
    this.vectorDB = new SemanticVectorDB(process.env.OPENAI_API_KEY);
    
    // Initialize engines
    this.semanticEngine = new SemanticEngine(this.database, this.vectorDB);
    this.patternEngine = new PatternEngine(this.database);
    
    // Initialize tool collections
    this.coreTools = new CoreAnalysisTools(this.semanticEngine, this.patternEngine, this.database);
    this.intelligenceTools = new IntelligenceTools(
      this.semanticEngine, 
      this.patternEngine, 
      this.database
    );
  }

  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          ...this.coreTools.tools,
          ...this.intelligenceTools.tools
        ]
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        // Route to appropriate tool handler
        const result = await this.routeToolCall(name, args);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });
  }

  private async routeToolCall(name: string, args: any): Promise<any> {
    // Core Analysis Tools
    switch (name) {
      case 'analyze_codebase':
        return await this.coreTools.analyzeCodebase(args);
      
      case 'get_file_content':
        return await this.coreTools.getFileContent(args);
      
      case 'get_project_structure':
        return await this.coreTools.getProjectStructure(args);
      
      case 'search_codebase':
        return await this.coreTools.searchCodebase(args);
      
      case 'generate_documentation':
        return await this.coreTools.generateDocumentation(args);

      // Intelligence Tools
      case 'learn_codebase_intelligence':
        return await this.intelligenceTools.learnCodebaseIntelligence(args);
      
      case 'get_semantic_insights':
        return await this.intelligenceTools.getSemanticInsights(args);
      
      case 'get_pattern_recommendations':
        return await this.intelligenceTools.getPatternRecommendations(args);
      
      case 'predict_coding_approach':
        return await this.intelligenceTools.predictCodingApproach(args);
      
      case 'get_developer_profile':
        return await this.intelligenceTools.getDeveloperProfile(args);
      
      case 'contribute_insights':
        return await this.intelligenceTools.contributeInsights(args);

      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${name}`
        );
    }
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    console.error('Code Cartographer MCP Server started');
  }

  async stop(): Promise<void> {
    this.database.close();
    await this.server.close();
  }
}

// Export for CLI usage
export async function runServer(): Promise<void> {
  const server = new CodeCartographerMCP();
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    await server.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    await server.stop();
    process.exit(0);
  });
  
  await server.start();
}