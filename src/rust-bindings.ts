// Import the actual napi-rs generated bindings
import { SemanticAnalyzer as NativeSemanticAnalyzer, PatternLearner as NativePatternLearner, AstParser as NativeAstParser, initCore } from '../index.mjs';

// Re-export the native classes directly
export { NativeSemanticAnalyzer as SemanticAnalyzer, NativePatternLearner as PatternLearner, NativeAstParser as AstParser, initCore };

// Re-export types from the generated definitions
export type {
    SemanticConcept,
    CodebaseAnalysisResult,
    Pattern,
    PatternAnalysisResult,
    ApproachPrediction,
    LineRange,
    ComplexityMetrics,
    ParseResult,
    AstNode,
    Symbol,
    PatternExample
} from '../index.js';