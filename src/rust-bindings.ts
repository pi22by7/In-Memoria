// Platform-specific binary loading
import { createRequire } from 'module';
import { join } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);

function loadNativeBinary() {
  const { platform, arch } = process;
  
  // Map Node.js platform/arch to our package names
  const platformMap: Record<string, string> = {
    'linux-x64': '@in-memoria/linux-x64',
    'darwin-x64': '@in-memoria/darwin-x64', 
    'darwin-arm64': '@in-memoria/darwin-arm64',
    'win32-x64': '@in-memoria/win32-x64'
  };
  
  const platformKey = `${platform}-${arch}`;
  const packageName = platformMap[platformKey];
  
  if (!packageName) {
    throw new Error(`Unsupported platform: ${platform}-${arch}. Supported platforms: ${Object.keys(platformMap).join(', ')}`);
  }
  
  try {
    // Try to load from the optional dependency
    return require(packageName);
  } catch (error) {
    // Fallback to local development path
    try {
      return require('../rust-core/index.js');
    } catch (fallbackError) {
      throw new Error(
        `Failed to load native binary for ${platformKey}. ` +
        `Please ensure ${packageName} is installed or run 'npm install' to install platform-specific binaries.`
      );
    }
  }
}

const nativeModule = loadNativeBinary();
const {
  SemanticAnalyzer: NativeSemanticAnalyzer,
  PatternLearner: NativePatternLearner,
  AstParser: NativeAstParser,
  BlueprintAnalyzer: NativeBlueprintAnalyzer,
  FrameworkDetector: NativeFrameworkDetector,
  initCore
} = nativeModule;

// Re-export the native classes directly
export {
  NativeSemanticAnalyzer as SemanticAnalyzer,
  NativePatternLearner as PatternLearner,
  NativeAstParser as AstParser,
  NativeBlueprintAnalyzer as BlueprintAnalyzer,
  NativeFrameworkDetector as FrameworkDetector,
  initCore
};

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
} from '../rust-core/index.js';

// Re-export class types for use in TypeScript
export type SemanticAnalyzerType = typeof NativeSemanticAnalyzer;
export type PatternLearnerType = typeof NativePatternLearner;
export type AstParserType = typeof NativeAstParser;
export type BlueprintAnalyzerType = typeof NativeBlueprintAnalyzer;
export type FrameworkDetectorType = typeof NativeFrameworkDetector;