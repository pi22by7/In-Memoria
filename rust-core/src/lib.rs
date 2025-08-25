#![deny(clippy::all)]

#[cfg(feature = "napi-bindings")]
use napi_derive::napi;

pub mod ast_parser;
pub mod pattern_learning;
pub mod semantic;

// Re-export the main structs
pub use ast_parser::AstParser;
pub use pattern_learning::PatternLearner;
pub use semantic::SemanticAnalyzer;

#[cfg(feature = "napi-bindings")]
#[napi]
pub fn init_core() -> String {
    "In Memoria Rust Core initialized".to_string()
}
