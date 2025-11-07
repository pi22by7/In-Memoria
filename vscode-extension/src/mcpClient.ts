import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import * as vscode from 'vscode';

export interface ProjectBlueprint {
  techStack: string[];
  entryPoints: Record<string, string>;
  keyDirectories: Record<string, string>;
  architecture: string;
  featureMap?: Record<string, string[]>;
  learningStatus?: {
    hasIntelligence: boolean;
    isStale: boolean;
    conceptsStored: number;
    patternsStored: number;
    recommendation: string;
    message: string;
  };
}

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

export interface CodingApproachPrediction {
  approach: string;
  confidence: number;
  reasoning: string;
  suggestedPatterns: string[];
  estimatedComplexity: 'low' | 'medium' | 'high';
  fileRouting?: {
    intendedFeature: string;
    targetFiles: string[];
    workType: string;
    suggestedStartPoint: string;
    confidence: number;
    reasoning: string;
  };
}

export interface IntelligenceMetrics {
  totalConcepts: number;
  totalPatterns: number;
  totalFiles: number;
  avgComplexity: number;
  languageDistribution: Record<string, number>;
  lastLearned?: Date;
}

export interface AIInsight {
  insightId: string;
  insightType: string;
  insightContent: Record<string, any>;
  confidenceScore: number;
  sourceAgent: string;
  validationStatus: 'pending' | 'validated' | 'rejected';
  impactPrediction: Record<string, any>;
  createdAt: Date;
}

export class InMemoriaClient {
  private client?: Client;
  private transport?: StdioClientTransport;
  private connected = false;

  async connect(): Promise<void> {
    try {
      const config = vscode.workspace.getConfiguration('inMemoria');
      const serverCommand = config.get<string>('serverCommand', 'npx in-memoria server');

      // Parse command and args
      const [command, ...args] = serverCommand.split(' ');

      this.transport = new StdioClientTransport({
        command,
        args
      });

      this.client = new Client(
        {
          name: 'in-memoria-vscode',
          version: '0.1.0'
        },
        {
          capabilities: {}
        }
      );

      await this.client.connect(this.transport);
      this.connected = true;
    } catch (error: any) {
      this.connected = false;
      if (error.code === 'ENOENT') {
        throw new Error('In Memoria server command not found. Install with: npm install -g in-memoria');
      }
      throw new Error(`Failed to connect to In Memoria server: ${error.message}`);
    }
  }

  disconnect(): void {
    if (this.client && this.transport) {
      this.client.close();
      this.connected = false;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  async getProjectBlueprint(path?: string): Promise<ProjectBlueprint> {
    if (!this.client) {
      throw new Error('Not connected to In Memoria server');
    }

    const response = await this.client.callTool({
      name: 'get_project_blueprint',
      arguments: {
        path,
        includeFeatureMap: true
      }
    });

    if (response.content && response.content.length > 0) {
      const content = response.content[0];
      if (content.type === 'text') {
        return JSON.parse(content.text);
      }
    }

    throw new Error('Invalid response from get_project_blueprint');
  }

  async getSemanticInsights(query?: string, conceptType?: string, limit = 20): Promise<{
    insights: SemanticInsight[];
    totalAvailable: number;
  }> {
    if (!this.client) {
      throw new Error('Not connected to In Memoria server');
    }

    const response = await this.client.callTool({
      name: 'get_semantic_insights',
      arguments: {
        query,
        conceptType,
        limit
      }
    });

    if (response.content && response.content.length > 0) {
      const content = response.content[0];
      if (content.type === 'text') {
        return JSON.parse(content.text);
      }
    }

    throw new Error('Invalid response from get_semantic_insights');
  }

  async getPatternRecommendations(problemDescription: string): Promise<{
    recommendations: PatternRecommendation[];
    reasoning: string;
    relatedFiles?: string[];
  }> {
    if (!this.client) {
      throw new Error('Not connected to In Memoria server');
    }

    const response = await this.client.callTool({
      name: 'get_pattern_recommendations',
      arguments: {
        problemDescription,
        includeRelatedFiles: true
      }
    });

    if (response.content && response.content.length > 0) {
      const content = response.content[0];
      if (content.type === 'text') {
        return JSON.parse(content.text);
      }
    }

    throw new Error('Invalid response from get_pattern_recommendations');
  }

  async getDeveloperProfile(includeWorkContext = true): Promise<DeveloperProfile> {
    if (!this.client) {
      throw new Error('Not connected to In Memoria server');
    }

    const response = await this.client.callTool({
      name: 'get_developer_profile',
      arguments: {
        includeRecentActivity: true,
        includeWorkContext
      }
    });

    if (response.content && response.content.length > 0) {
      const content = response.content[0];
      if (content.type === 'text') {
        return JSON.parse(content.text);
      }
    }

    throw new Error('Invalid response from get_developer_profile');
  }

  async predictCodingApproach(problemDescription: string): Promise<CodingApproachPrediction> {
    if (!this.client) {
      throw new Error('Not connected to In Memoria server');
    }

    const response = await this.client.callTool({
      name: 'predict_coding_approach',
      arguments: {
        problemDescription,
        includeFileRouting: true
      }
    });

    if (response.content && response.content.length > 0) {
      const content = response.content[0];
      if (content.type === 'text') {
        return JSON.parse(content.text);
      }
    }

    throw new Error('Invalid response from predict_coding_approach');
  }

  async getIntelligenceMetrics(): Promise<IntelligenceMetrics> {
    if (!this.client) {
      throw new Error('Not connected to In Memoria server');
    }

    const response = await this.client.callTool({
      name: 'get_intelligence_metrics',
      arguments: {}
    });

    if (response.content && response.content.length > 0) {
      const content = response.content[0];
      if (content.type === 'text') {
        return JSON.parse(content.text);
      }
    }

    throw new Error('Invalid response from get_intelligence_metrics');
  }

  async learnCodebase(path: string, force = false): Promise<{
    success: boolean;
    conceptsLearned: number;
    patternsLearned: number;
    insights: string[];
    timeElapsed: number;
  }> {
    if (!this.client) {
      throw new Error('Not connected to In Memoria server');
    }

    const response = await this.client.callTool({
      name: 'learn_codebase_intelligence',
      arguments: {
        path,
        force
      }
    });

    if (response.content && response.content.length > 0) {
      const content = response.content[0];
      if (content.type === 'text') {
        return JSON.parse(content.text);
      }
    }

    throw new Error('Invalid response from learn_codebase_intelligence');
  }

  async searchCodebase(query: string, type: 'semantic' | 'text' | 'pattern' = 'semantic'): Promise<any> {
    if (!this.client) {
      throw new Error('Not connected to In Memoria server');
    }

    const response = await this.client.callTool({
      name: 'search_codebase',
      arguments: {
        query,
        type,
        limit: 20
      }
    });

    if (response.content && response.content.length > 0) {
      const content = response.content[0];
      if (content.type === 'text') {
        return JSON.parse(content.text);
      }
    }

    throw new Error('Invalid response from search_codebase');
  }
}
