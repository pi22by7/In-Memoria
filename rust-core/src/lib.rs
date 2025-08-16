#![deny(clippy::all)]

use napi_derive::napi;

pub mod semantic;
pub mod pattern_learning;
pub mod ast_parser;

// Re-export the main structs
pub use semantic::SemanticAnalyzer;
pub use pattern_learning::PatternLearner;
pub use ast_parser::AstParser;

#[napi]
pub fn init_core() -> String {
  "Code Cartographer Rust Core initialized".to_string()
}