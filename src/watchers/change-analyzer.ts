import { EventEmitter } from 'eventemitter3';
import { FileChange } from './file-watcher.js';
import { SemanticEngine } from '../engines/semantic-engine.js';
import { PatternEngine } from '../engines/pattern-engine.js';
import { SQLiteDatabase } from '../storage/sqlite-db.js';

export interface ChangeAnalysis {
  change: FileChange;
  impact: {
    scope: 'file' | 'module' | 'project';
    confidence: number;
    affectedConcepts: string[];
    suggestedActions: string[];
  };
  patterns: {
    detected: string[];
    violations: string[];
    recommendations: string[];
  };
  intelligence: {
    conceptsUpdated: number;
    patternsLearned: number;
    insights: string[];
  };
  timestamp: Date;
}

export interface AnalyzerOptions {
  enableRealTimeAnalysis: boolean;
  enablePatternLearning: boolean;
  batchSize: number;
  analysisDelay: number;
}

export class ChangeAnalyzer extends EventEmitter {
  private analysisQueue: FileChange[] = [];
  private analyzing = false;
  private batchTimer: NodeJS.Timeout | null = null;

  constructor(
    private semanticEngine: SemanticEngine,
    private patternEngine: PatternEngine,
    private database: SQLiteDatabase,
    private options: AnalyzerOptions = {
      enableRealTimeAnalysis: true,
      enablePatternLearning: true,
      batchSize: 5,
      analysisDelay: 1000
    }
  ) {
    super();
  }

  async analyzeChange(change: FileChange): Promise<ChangeAnalysis> {
    if (!this.options.enableRealTimeAnalysis) {
      return this.createMinimalAnalysis(change);
    }

    // Add to queue for batch processing
    this.analysisQueue.push(change);
    
    // Schedule batch processing
    this.scheduleBatchAnalysis();

    // For immediate response, perform lightweight analysis
    return await this.performLightweightAnalysis(change);
  }

  async analyzeBatch(changes: FileChange[]): Promise<ChangeAnalysis[]> {
    const analyses: ChangeAnalysis[] = [];

    for (const change of changes) {
      const analysis = await this.performFullAnalysis(change);
      analyses.push(analysis);
    }

    // Cross-file impact analysis
    if (changes.length > 1) {
      await this.performCrossFileAnalysis(analyses);
    }

    return analyses;
  }

  private scheduleBatchAnalysis(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }

    this.batchTimer = setTimeout(async () => {
      if (this.analysisQueue.length > 0 && !this.analyzing) {
        await this.processBatch();
      }
    }, this.options.analysisDelay);
  }

  private async processBatch(): Promise<void> {
    if (this.analyzing || this.analysisQueue.length === 0) {
      return;
    }

    this.analyzing = true;
    
    try {
      const batch = this.analysisQueue.splice(0, this.options.batchSize);
      const analyses = await this.analyzeBatch(batch);
      
      for (const analysis of analyses) {
        this.emit('analysis:complete', analysis);
        
        // Learn from the changes if enabled
        if (this.options.enablePatternLearning) {
          await this.learnFromChange(analysis);
        }
      }

      this.emit('batch:complete', { 
        count: analyses.length, 
        insights: analyses.flatMap(a => a.intelligence.insights)
      });

    } catch (error) {
      this.emit('analysis:error', { error, batch: this.analysisQueue.length });
    } finally {
      this.analyzing = false;
      
      // Process remaining queue if any
      if (this.analysisQueue.length > 0) {
        this.scheduleBatchAnalysis();
      }
    }
  }

  private async performLightweightAnalysis(change: FileChange): Promise<ChangeAnalysis> {
    const analysis: ChangeAnalysis = {
      change,
      impact: {
        scope: 'file',
        confidence: 0.5,
        affectedConcepts: [],
        suggestedActions: []
      },
      patterns: {
        detected: [],
        violations: [],
        recommendations: []
      },
      intelligence: {
        conceptsUpdated: 0,
        patternsLearned: 0,
        insights: []
      },
      timestamp: new Date()
    };

    // Quick impact assessment based on file type and size
    if (change.language) {
      analysis.impact.scope = this.estimateScope(change);
      analysis.impact.suggestedActions = this.getSuggestedActions(change);
    }

    return analysis;
  }

  private async performFullAnalysis(change: FileChange): Promise<ChangeAnalysis> {
    const analysis = await this.performLightweightAnalysis(change);

    try {
      // Semantic analysis
      if (change.content && change.type !== 'unlink') {
        const concepts = await this.semanticEngine.analyzeFileContent(
          change.path, 
          change.content
        );
        
        analysis.impact.affectedConcepts = concepts.map(c => c.name);
        analysis.intelligence.conceptsUpdated = concepts.length;
      }

      // Pattern analysis
      const patterns = await this.patternEngine.analyzeFileChange(change);
      analysis.patterns.detected = patterns.detected;
      analysis.patterns.violations = patterns.violations;
      analysis.patterns.recommendations = patterns.recommendations;
      analysis.intelligence.patternsLearned = patterns.learned?.length || 0;

      // Impact analysis
      analysis.impact = await this.calculateImpact(change, analysis);

      // Generate insights
      analysis.intelligence.insights = await this.generateInsights(analysis);

    } catch (error) {
      analysis.intelligence.insights.push(`Analysis error: ${error}`);
    }

    return analysis;
  }

  private async performCrossFileAnalysis(analyses: ChangeAnalysis[]): Promise<void> {
    // Analyze relationships between changed files
    const concepts = analyses.flatMap(a => a.impact.affectedConcepts);
    const uniqueConcepts = [...new Set(concepts)];

    // Check for architectural impacts
    if (uniqueConcepts.length > 3) {
      const architecturalImpact = await this.assessArchitecturalImpact(analyses);
      
      for (const analysis of analyses) {
        analysis.impact.scope = 'project';
        analysis.impact.confidence = Math.max(
          analysis.impact.confidence, 
          architecturalImpact.confidence
        );
        analysis.intelligence.insights.push(
          ...architecturalImpact.insights
        );
      }
    }
  }

  private estimateScope(change: FileChange): 'file' | 'module' | 'project' {
    // Configuration files often have project-wide impact
    const projectFiles = ['package.json', 'tsconfig.json', 'Cargo.toml', 'go.mod'];
    if (projectFiles.some(file => change.path.endsWith(file))) {
      return 'project';
    }

    // Test files usually have module scope
    if (change.path.includes('test') || change.path.includes('spec')) {
      return 'module';
    }

    // Index files often have module scope
    if (change.path.endsWith('index.ts') || change.path.endsWith('mod.rs')) {
      return 'module';
    }

    return 'file';
  }

  private getSuggestedActions(change: FileChange): string[] {
    const actions: string[] = [];

    switch (change.type) {
      case 'add':
        actions.push('Update documentation');
        actions.push('Add tests if applicable');
        break;
      case 'change':
        actions.push('Review related tests');
        actions.push('Check for breaking changes');
        break;
      case 'unlink':
        actions.push('Remove related tests');
        actions.push('Update imports/dependencies');
        break;
    }

    if (change.language === 'typescript' || change.language === 'javascript') {
      actions.push('Run type checking');
    }

    return actions;
  }

  private async calculateImpact(
    change: FileChange, 
    analysis: ChangeAnalysis
  ): Promise<ChangeAnalysis['impact']> {
    let confidence = 0.5;
    let scope: 'file' | 'module' | 'project' = 'file';

    // Increase confidence based on concept count
    if (analysis.impact.affectedConcepts.length > 0) {
      confidence += Math.min(0.3, analysis.impact.affectedConcepts.length * 0.1);
    }

    // Adjust scope based on patterns
    if (analysis.patterns.violations.length > 0) {
      scope = 'module';
      confidence += 0.2;
    }

    // Check for dependencies on this file
    const dependents = await this.findDependentFiles(change.path);
    if (dependents.length > 5) {
      scope = 'project';
      confidence += 0.3;
    } else if (dependents.length > 1) {
      scope = 'module';
      confidence += 0.1;
    }

    return {
      scope,
      confidence: Math.min(1.0, confidence),
      affectedConcepts: analysis.impact.affectedConcepts,
      suggestedActions: analysis.impact.suggestedActions
    };
  }

  private async generateInsights(analysis: ChangeAnalysis): Promise<string[]> {
    const insights: string[] = [];

    // Pattern-based insights
    if (analysis.patterns.detected.length > 0) {
      insights.push(`Detected ${analysis.patterns.detected.length} patterns in change`);
    }

    if (analysis.patterns.violations.length > 0) {
      insights.push(`Found ${analysis.patterns.violations.length} pattern violations`);
    }

    // Impact insights
    if (analysis.impact.scope === 'project') {
      insights.push('Change has project-wide impact - consider comprehensive testing');
    }

    // Learning insights
    if (analysis.intelligence.conceptsUpdated > 0) {
      insights.push(`Updated understanding of ${analysis.intelligence.conceptsUpdated} concepts`);
    }

    return insights;
  }

  private async assessArchitecturalImpact(analyses: ChangeAnalysis[]): Promise<{
    confidence: number;
    insights: string[];
  }> {
    const allConcepts = analyses.flatMap(a => a.impact.affectedConcepts);
    const uniqueConcepts = new Set(allConcepts);

    return {
      confidence: Math.min(1.0, uniqueConcepts.size * 0.1),
      insights: [
        `Architectural change detected affecting ${uniqueConcepts.size} concepts`,
        'Consider updating system documentation',
        'Review integration tests'
      ]
    };
  }

  private async findDependentFiles(filePath: string): Promise<string[]> {
    try {
      // Query the database for files that import/depend on the given file
      const concepts = this.database.getSemanticConcepts(filePath);
      const dependentFiles: string[] = [];
      
      // Find files that reference concepts from this file
      for (const concept of concepts) {
        // Get all concepts to find related ones
        const allConcepts = this.database.getSemanticConcepts();
        const relatedConcepts = allConcepts.filter(c => 
          c.conceptName === concept.conceptName && c.filePath !== filePath
        );
        
        dependentFiles.push(...relatedConcepts.map(c => c.filePath));
      }
      
      // Remove duplicates and return
      return [...new Set(dependentFiles)];
    } catch (error) {
      console.warn('Could not find dependent files:', error.message);
      return [];
    }
  }

  private async learnFromChange(analysis: ChangeAnalysis): Promise<void> {
    // Learn new patterns from the change
    if (analysis.patterns.detected.length > 0) {
      await this.patternEngine.learnFromAnalysis(analysis);
    }

    // Update semantic understanding
    if (analysis.intelligence.conceptsUpdated > 0) {
      await this.semanticEngine.updateFromAnalysis(analysis);
    }
  }

  private createMinimalAnalysis(change: FileChange): ChangeAnalysis {
    return {
      change,
      impact: {
        scope: 'file',
        confidence: 0.1,
        affectedConcepts: [],
        suggestedActions: []
      },
      patterns: {
        detected: [],
        violations: [],
        recommendations: []
      },
      intelligence: {
        conceptsUpdated: 0,
        patternsLearned: 0,
        insights: ['Real-time analysis disabled']
      },
      timestamp: new Date()
    };
  }

  // Public control methods
  enableRealTimeAnalysis(): void {
    this.options.enableRealTimeAnalysis = true;
  }

  disableRealTimeAnalysis(): void {
    this.options.enableRealTimeAnalysis = false;
  }

  getQueueSize(): number {
    return this.analysisQueue.length;
  }

  isAnalyzing(): boolean {
    return this.analyzing;
  }

  clearQueue(): void {
    this.analysisQueue = [];
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
  }
}