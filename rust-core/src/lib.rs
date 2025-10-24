#![deny(clippy::all)]

#[cfg(feature = "napi-bindings")]
use napi_derive::napi;
// Core modules  
pub mod types;
pub mod parsing;
pub mod extractors;
pub mod analysis;
pub mod patterns;

// Legacy modules (will be removed in future versions)
// pattern_learning has been fully ported to the patterns module

// Re-export core types and main structs for easy access
pub use types::*;
pub use analysis::{SemanticAnalyzer, ComplexityAnalyzer, RelationshipLearner, FrameworkDetector, BlueprintAnalyzer};
pub use parsing::{ParserManager, TreeWalker, FallbackExtractor};
pub use patterns::{
    PatternLearningEngine, NamingPatternAnalyzer, StructuralPatternAnalyzer, 
    ImplementationPatternAnalyzer, ApproachPredictor
};

// Legacy re-exports (for backwards compatibility) 
pub use parsing::ParserManager as AstParser; // Backwards compatibility alias
pub use patterns::PatternLearner;
pub use patterns::PatternLearningEngine as LegacyPatternLearner;

#[cfg(feature = "napi-bindings")]
#[napi]
pub fn init_core() -> String {
    "In Memoria Rust Core initialized".to_string()
}
