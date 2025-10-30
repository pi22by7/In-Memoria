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
import { AutomationTools } from './tools/automation-tools.js';
import { MonitoringTools } from './tools/monitoring-tools.js';
import { SemanticEngine } from '../engines/semantic-engine.js';
import { PatternEngine } from '../engines/pattern-engine.js';
import { SQLiteDatabase } from '../storage/sqlite-db.js';
import { SemanticVectorDB } from '../storage/vector-db.js';
import { validateInput, VALIDATION_SCHEMAS } from './validation.js';
import { config } from '../config/config.js';
import { Logger } from '../utils/logger.js';

export class CodeCartographerMCP {
  private server: Server;
  private database!: SQLiteDatabase;
  private vectorDB!: SemanticVectorDB;
  private semanticEngine!: SemanticEngine;
  private patternEngine!: PatternEngine;
  private coreTools!: CoreAnalysisTools;
  private intelligenceTools!: IntelligenceTools;
  private automationTools!: AutomationTools;
  private monitoringTools!: MonitoringTools;

  constructor() {
    this.server = new Server(
      {
        name: 'in-memoria',
        version: '0.5.6',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private async initializeComponents(): Promise<void> {
    try {
      Logger.info('Initializing In Memoria components...');

      // Initialize storage using configuration management
      // Database path is determined by config based on the analyzed project
      const appConfig = config.getConfig();
      const dbPath = config.getDatabasePath(); // Will use current directory as project path
      Logger.info(`Attempting to initialize database at: ${dbPath}`);

      try {
        this.database = new SQLiteDatabase(dbPath);
        Logger.info('SQLite database initialized successfully');
      } catch (dbError: unknown) {
        Logger.error('Failed to initialize SQLite database:', dbError);
        Logger.error('The MCP server will continue with limited functionality');
        throw new Error(`Database initialization failed: ${dbError instanceof Error ? dbError.message : String(dbError)}`);
      }

      this.vectorDB = new SemanticVectorDB(process.env.OPENAI_API_KEY);
      Logger.info('Vector database initialized');

      // Initialize engines
      this.semanticEngine = new SemanticEngine(this.database, this.vectorDB);
      this.patternEngine = new PatternEngine(this.database);
      Logger.info('Analysis engines initialized');

      // Initialize tool collections
      this.coreTools = new CoreAnalysisTools(this.semanticEngine, this.patternEngine, this.database);
      this.intelligenceTools = new IntelligenceTools(
        this.semanticEngine,
        this.patternEngine,
        this.database,
        this.vectorDB // Pass shared vectorDB instance
      );
      this.automationTools = new AutomationTools(
        this.semanticEngine,
        this.patternEngine,
        this.database
      );
      this.monitoringTools = new MonitoringTools(
        this.semanticEngine,
        this.patternEngine,
        this.database
      );
      Logger.info('Tool collections initialized');

      Logger.info('In Memoria components initialized successfully');
    } catch (error: unknown) {
      Logger.error('Failed to initialize In Memoria components:', error);
      Logger.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace available');
      throw error;
    }
  }

  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          ...this.coreTools.tools,
          ...this.intelligenceTools.tools,
          ...this.automationTools.tools,
          ...this.monitoringTools.tools
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

  public async routeToolCall(name: string, args: any): Promise<any> {
    // Validate input using Zod schemas
    const schema = VALIDATION_SCHEMAS[name as keyof typeof VALIDATION_SCHEMAS];
    if (schema) {
      args = validateInput(schema, args, name);
    }

    // Core Analysis Tools
    switch (name) {
      case 'analyze_codebase':
        return await this.coreTools.analyzeCodebase(args);

      // DEPRECATED (Phase 4): Merged into analyze_codebase - now handles both files and directories
      // case 'get_file_content':
      //   return await this.coreTools.getFileContent(args);

      // DEPRECATED (Phase 4): Merged into get_project_blueprint
      // case 'get_project_structure':
      //   return await this.coreTools.getProjectStructure(args);

      case 'search_codebase':
        return await this.coreTools.searchCodebase(args);

      // DEPRECATED (Phase 4): Not agent-facing, removed from tool list
      // case 'generate_documentation':
      //   return await this.coreTools.generateDocumentation(args);

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

      case 'get_project_blueprint':
        return await this.intelligenceTools.getProjectBlueprint(args);

      // Automation Tools
      case 'auto_learn_if_needed':
        return await this.automationTools.autoLearnIfNeeded(args);

      // DEPRECATED (Phase 4): Merged into get_project_blueprint - returns learning status in blueprint
      // case 'get_learning_status':
      //   return await this.automationTools.getLearningStatus(args);

      // DEPRECATED (Phase 4): Merged into auto_learn_if_needed - same functionality
      // case 'quick_setup':
      //   return await this.automationTools.quickSetup(args);

      // Monitoring Tools
      case 'get_system_status':
        return await this.monitoringTools.getSystemStatus(args);

      case 'get_intelligence_metrics':
        return await this.monitoringTools.getIntelligenceMetrics(args);

      case 'get_performance_status':
        return await this.monitoringTools.getPerformanceStatus(args);

      case 'health_check':
        return await this.monitoringTools.healthCheck(args);

      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${name}`
        );
    }
  }

  async start(): Promise<void> {
    // Set environment variable to indicate MCP server mode
    process.env.MCP_SERVER = 'true';

    await this.initializeComponents();

    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    Logger.info('In Memoria MCP Server started');
  }

  /**
   * Get all registered tools (for testing and introspection)
   */
  getAllTools(): any[] {
    return [
      ...this.coreTools.tools,
      ...this.intelligenceTools.tools,
      ...this.automationTools.tools,
      ...this.monitoringTools.tools
    ];
  }

  /**
   * Initialize components for testing without starting transport
   */
  async initializeForTesting(): Promise<void> {
    await this.initializeComponents();
  }

  async stop(): Promise<void> {
    // Clean up semantic engine resources
    if (this.semanticEngine) {
      this.semanticEngine.cleanup();
    }

    // Close vector database
    if (this.vectorDB) {
      try {
        await this.vectorDB.close();
      } catch (error) {
        console.warn('Warning: Failed to close vector database:', error);
      }
    }

    // Close SQLite database
    if (this.database) {
      this.database.close();
    }

    // Close MCP server
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