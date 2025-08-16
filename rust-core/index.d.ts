export declare class SemanticAnalyzer {
    constructor();
    analyzeCodebase(path: string): Promise<any>;
    analyzeFileContent(filePath: string, content: string): Promise<any[]>;
    learnFromCodebase(path: string): Promise<any[]>;
    updateFromAnalysis(analysisData: string): Promise<boolean>;
    getConceptRelationships(conceptId: string): Promise<string[]>;
}
export declare class PatternLearner {
    constructor();
    learnFromCodebase(path: string): Promise<any[]>;
    extractPatterns(path: string): Promise<any[]>;
    analyzeFileChange(changeData: string): Promise<any>;
    findRelevantPatterns(problemDescription: string, currentFile?: string | null, selectedCode?: string | null): Promise<any[]>;
    predictApproach(problemDescription: string, context: Map<string, string>): Promise<any>;
    learnFromAnalysis(analysisData: string): Promise<boolean>;
    updateFromChange(changeData: string): Promise<boolean>;
}
export declare class AstParser {
    constructor();
    parseCode(code: string, language: string): any;
}
export declare function initCore(): string;
//# sourceMappingURL=index.d.ts.map