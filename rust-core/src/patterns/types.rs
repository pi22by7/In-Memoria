//! Core type definitions for pattern learning and analysis

#[cfg(feature = "napi-bindings")]
use napi_derive::napi;
use serde::{Deserialize, Serialize};
use crate::types::{LineRange, ParseError};

// Simple error type for when napi is not available (from original implementation)
#[derive(Debug)]
pub struct SimpleError {
    pub message: String,
}

impl SimpleError {
    pub fn from_reason<S: Into<String>>(message: S) -> Self {
        Self {
            message: message.into(),
        }
    }
}

impl std::fmt::Display for SimpleError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.message)
    }
}

impl std::error::Error for SimpleError {}

// Conditional type aliases - use proper napi::Result when available (from original implementation)
#[cfg(feature = "napi-bindings")]
pub type ApiResult<T> = napi::Result<T>;

#[cfg(not(feature = "napi-bindings"))]
pub type ApiResult<T> = Result<T, SimpleError>;

/// Core pattern representation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "napi-bindings", napi(object))]
pub struct Pattern {
    pub id: String,
    pub pattern_type: String,
    pub description: String,
    pub frequency: u32,
    pub confidence: f64,
    pub examples: Vec<PatternExample>,
    pub contexts: Vec<String>,
}

/// Example of a pattern occurrence
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "napi-bindings", napi(object))]
pub struct PatternExample {
    pub code: String,
    pub file_path: String,
    pub line_range: LineRange,
}

/// Result of pattern analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "napi-bindings", napi(object))]
pub struct PatternAnalysisResult {
    pub detected: Vec<String>,
    pub violations: Vec<String>,
    pub recommendations: Vec<String>,
    pub learned: Option<Vec<Pattern>>,
}

/// Prediction of coding approach based on patterns
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "napi-bindings", napi(object))]
pub struct ApproachPrediction {
    pub approach: String,
    pub confidence: f64,
    pub reasoning: String,
    pub patterns: Vec<String>,
    pub complexity: String,
}

/// Naming pattern information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NamingPattern {
    pub pattern_type: String, // camelCase, PascalCase, snake_case, etc.
    pub frequency: u32,
    pub contexts: Vec<String>, // function, class, variable, constant
    pub confidence: f64,
}

/// Structural pattern information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StructuralPattern {
    pub pattern_type: String, // MVC, layered, modular, etc.
    pub frequency: u32,
    pub characteristics: Vec<String>,
    pub confidence: f64,
}

/// Implementation pattern information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImplementationPattern {
    pub pattern_type: String, // singleton, factory, observer, etc.
    pub frequency: u32,
    pub code_signatures: Vec<String>,
    pub confidence: f64,
}

/// Problem complexity levels for approach prediction
#[derive(Debug, Clone, PartialEq)]
pub enum ProblemComplexity {
    Low,
    Medium,
    High,
}

impl std::fmt::Display for ProblemComplexity {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ProblemComplexity::Low => write!(f, "low"),
            ProblemComplexity::Medium => write!(f, "medium"),
            ProblemComplexity::High => write!(f, "high"),
        }
    }
}

/// Generated approach recommendation
#[derive(Debug, Clone)]
pub struct GeneratedApproach {
    pub description: String,
    pub confidence: f64,
    pub reasoning: String,
}

/// Trait for components that can extract patterns
pub trait PatternExtractor {
    fn extract_patterns(&self, path: &str) -> Result<Vec<Pattern>, ParseError>;
}

/// Trait for components that can analyze patterns
pub trait PatternAnalyzer {
    fn analyze_patterns(&self, patterns: &[Pattern]) -> Result<PatternAnalysisResult, ParseError>;
}

/// Trait for components that can learn from data
pub trait PatternLearner {
    fn learn_from_data(&mut self, data: &str) -> Result<Vec<Pattern>, ParseError>;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pattern_creation() {
        let pattern = Pattern {
            id: "test_pattern".to_string(),
            pattern_type: "naming".to_string(),
            description: "Test pattern".to_string(),
            frequency: 5,
            confidence: 0.8,
            examples: vec![],
            contexts: vec!["test".to_string()],
        };

        assert_eq!(pattern.id, "test_pattern");
        assert_eq!(pattern.pattern_type, "naming");
        assert_eq!(pattern.frequency, 5);
        assert_eq!(pattern.confidence, 0.8);
    }

    #[test]
    fn test_pattern_example() {
        let example = PatternExample {
            code: "function test() {}".to_string(),
            file_path: "test.js".to_string(),
            line_range: LineRange { start: 1, end: 1 },
        };

        assert_eq!(example.code, "function test() {}");
        assert_eq!(example.file_path, "test.js");
        assert_eq!(example.line_range.start, 1);
    }

    #[test]
    fn test_problem_complexity_display() {
        assert_eq!(format!("{}", ProblemComplexity::Low), "low");
        assert_eq!(format!("{}", ProblemComplexity::Medium), "medium");
        assert_eq!(format!("{}", ProblemComplexity::High), "high");
    }

    #[test]
    fn test_naming_pattern() {
        let naming = NamingPattern {
            pattern_type: "camelCase".to_string(),
            frequency: 10,
            contexts: vec!["function".to_string()],
            confidence: 0.9,
        };

        assert_eq!(naming.pattern_type, "camelCase");
        assert_eq!(naming.frequency, 10);
        assert_eq!(naming.confidence, 0.9);
    }

    #[test]
    fn test_structural_pattern() {
        let structural = StructuralPattern {
            pattern_type: "MVC".to_string(),
            frequency: 5,
            characteristics: vec!["model".to_string(), "view".to_string(), "controller".to_string()],
            confidence: 0.85,
        };

        assert_eq!(structural.pattern_type, "MVC");
        assert_eq!(structural.frequency, 5);
        assert_eq!(structural.characteristics.len(), 3);
    }

    #[test]
    fn test_implementation_pattern() {
        let implementation = ImplementationPattern {
            pattern_type: "singleton".to_string(),
            frequency: 3,
            code_signatures: vec!["getInstance()".to_string()],
            confidence: 0.95,
        };

        assert_eq!(implementation.pattern_type, "singleton");
        assert_eq!(implementation.frequency, 3);
        assert!(implementation.code_signatures.contains(&"getInstance()".to_string()));
    }
}