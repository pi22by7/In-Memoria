#![deny(clippy::all)]

// Note: napi-bindings are excluded during tests (not(test)) to avoid linker errors
// when running `cargo test`. NAPI bindings require Node.js runtime which isn't
// available in the test environment. Integration tests should use the built library.
#[cfg(all(feature = "napi-bindings", not(test)))]
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

#[cfg(all(feature = "napi-bindings", not(test)))]
#[napi]
pub fn init_core() -> String {
    "In Memoria Rust Core initialized".to_string()
}
