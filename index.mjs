// ES Module wrapper for the CommonJS napi-rs bindings
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const nativeBinding = require('./index.cjs');

export const { SemanticAnalyzer, PatternLearner, AstParser, initCore } = nativeBinding;