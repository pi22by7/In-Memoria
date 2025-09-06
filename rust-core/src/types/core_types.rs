//! Core type definitions for semantic analysis

#[cfg(feature = "napi-bindings")]
use napi_derive::napi;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "napi-bindings", napi(object))]
pub struct SemanticConcept {
    pub id: String,
    pub name: String,
    pub concept_type: String,
    pub confidence: f64,
    pub file_path: String,
    pub line_range: LineRange,
    pub relationships: HashMap<String, String>,
    pub metadata: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "napi-bindings", napi(object))]
pub struct LineRange {
    pub start: u32,
    pub end: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "napi-bindings", napi(object))]
pub struct CodebaseAnalysisResult {
    pub languages: Vec<String>,
    pub frameworks: Vec<String>,
    pub complexity: ComplexityMetrics,
    pub concepts: Vec<SemanticConcept>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "napi-bindings", napi(object))]
pub struct ComplexityMetrics {
    pub cyclomatic_complexity: f64,
    pub cognitive_complexity: f64,
    pub function_count: u32,
    pub class_count: u32,
    pub file_count: u32,
    pub avg_functions_per_file: f64,
    pub avg_lines_per_concept: f64,
    pub max_nesting_depth: u32,
}

// AST-related types from ast_parser.rs
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "napi-bindings", napi(object))]
pub struct AstNode {
    pub node_type: String,
    pub text: String,
    pub start_line: u32,
    pub end_line: u32,
    pub start_column: u32,
    pub end_column: u32,
    pub children: Vec<AstNode>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "napi-bindings", napi(object))]
pub struct ParseResult {
    pub language: String,
    pub tree: AstNode,
    pub errors: Vec<String>,
    pub symbols: Vec<Symbol>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "napi-bindings", napi(object))]
pub struct Symbol {
    pub name: String,
    pub symbol_type: String,
    pub line: u32,
    pub column: u32,
    pub scope: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_concept(name: &str, concept_type: &str) -> SemanticConcept {
        SemanticConcept {
            id: format!("test_{}", name),
            name: name.to_string(),
            concept_type: concept_type.to_string(),
            confidence: 0.8,
            file_path: "test.ts".to_string(),
            line_range: LineRange { start: 1, end: 1 },
            relationships: HashMap::new(),
            metadata: HashMap::new(),
        }
    }

    #[test]
    fn test_semantic_concept_creation() {
        let concept = create_test_concept("TestClass", "class");
        
        assert_eq!(concept.name, "TestClass");
        assert_eq!(concept.concept_type, "class");
        assert_eq!(concept.confidence, 0.8);
        assert_eq!(concept.file_path, "test.ts");
        assert_eq!(concept.line_range.start, 1);
        assert_eq!(concept.line_range.end, 1);
    }

    #[test]
    fn test_line_range() {
        let range = LineRange { start: 10, end: 20 };
        assert_eq!(range.start, 10);
        assert_eq!(range.end, 20);
    }

    #[test]
    fn test_concept_relationships() {
        let mut concept = create_test_concept("UserService", "class");
        concept.relationships.insert("implements".to_string(), "IUserService".to_string());
        concept.relationships.insert("extends".to_string(), "BaseService".to_string());

        assert_eq!(
            concept.relationships.get("implements"),
            Some(&"IUserService".to_string())
        );
        assert_eq!(
            concept.relationships.get("extends"),
            Some(&"BaseService".to_string())
        );
        assert_eq!(concept.relationships.len(), 2);
    }

    #[test]
    fn test_concept_metadata() {
        let mut concept = create_test_concept("calculateTotal", "function");
        concept.metadata.insert("visibility".to_string(), "public".to_string());
        concept.metadata.insert("async".to_string(), "false".to_string());
        concept.metadata.insert("parameters".to_string(), "2".to_string());

        assert_eq!(
            concept.metadata.get("visibility"),
            Some(&"public".to_string())
        );
        assert_eq!(concept.metadata.get("async"), Some(&"false".to_string()));
        assert_eq!(concept.metadata.get("parameters"), Some(&"2".to_string()));
    }

    #[test]
    fn test_codebase_analysis_result() {
        let analysis = CodebaseAnalysisResult {
            languages: vec!["typescript".to_string(), "javascript".to_string()],
            frameworks: vec!["react".to_string(), "express".to_string()],
            complexity: ComplexityMetrics {
                cyclomatic_complexity: 15.0,
                cognitive_complexity: 22.0,
                function_count: 10,
                class_count: 5,
                file_count: 3,
                avg_functions_per_file: 3.33,
                avg_lines_per_concept: 50.0,
                max_nesting_depth: 4,
            },
            concepts: vec![
                create_test_concept("UserService", "class"),
                create_test_concept("getUser", "function"),
            ],
        };

        assert_eq!(analysis.languages.len(), 2);
        assert_eq!(analysis.frameworks.len(), 2);
        assert_eq!(analysis.concepts.len(), 2);
        assert!(analysis.languages.contains(&"typescript".to_string()));
        assert!(analysis.frameworks.contains(&"react".to_string()));
    }

    #[test]
    fn test_complexity_metrics() {
        let metrics = ComplexityMetrics {
            cyclomatic_complexity: 10.5,
            cognitive_complexity: 15.2,
            function_count: 8,
            class_count: 3,
            file_count: 2,
            avg_functions_per_file: 4.0,
            avg_lines_per_concept: 37.5,
            max_nesting_depth: 3,
        };

        assert_eq!(metrics.cyclomatic_complexity, 10.5);
        assert_eq!(metrics.cognitive_complexity, 15.2);
        assert_eq!(metrics.function_count, 8);
        assert_eq!(metrics.class_count, 3);
    }

    #[test]
    fn test_concept_confidence_bounds() {
        let mut concept = create_test_concept("test", "function");

        // Test valid confidence values
        concept.confidence = 0.0;
        assert!(concept.confidence >= 0.0 && concept.confidence <= 1.0);

        concept.confidence = 1.0;
        assert!(concept.confidence >= 0.0 && concept.confidence <= 1.0);

        concept.confidence = 0.75;
        assert!(concept.confidence >= 0.0 && concept.confidence <= 1.0);
    }

    #[test]
    fn test_multiple_concept_types() {
        let concepts = vec![
            create_test_concept("UserService", "class"),
            create_test_concept("IUserService", "interface"),
            create_test_concept("getUser", "function"),
            create_test_concept("userId", "variable"),
            create_test_concept("UserType", "type"),
        ];

        let types: Vec<&str> = concepts.iter().map(|c| c.concept_type.as_str()).collect();
        assert!(types.contains(&"class"));
        assert!(types.contains(&"interface"));
        assert!(types.contains(&"function"));
        assert!(types.contains(&"variable"));
        assert!(types.contains(&"type"));
    }

    #[test]
    fn test_concept_hierarchy() {
        let mut parent_concept = create_test_concept("UserService", "class");
        let mut method_concept = create_test_concept("getUser", "function");

        // Simulate parent-child relationship
        method_concept
            .relationships
            .insert("parent".to_string(), parent_concept.id.clone());
        parent_concept
            .relationships
            .insert("methods".to_string(), method_concept.id.clone());

        assert_eq!(
            method_concept.relationships.get("parent"),
            Some(&parent_concept.id)
        );
        assert_eq!(
            parent_concept.relationships.get("methods"),
            Some(&method_concept.id)
        );
    }

    #[test]
    fn test_concept_serialization() {
        let concept = create_test_concept("TestFunction", "function");
        
        // Test that the concept can be serialized and deserialized
        let serialized = serde_json::to_string(&concept).expect("Should serialize");
        let deserialized: SemanticConcept = serde_json::from_str(&serialized).expect("Should deserialize");
        
        assert_eq!(concept.name, deserialized.name);
        assert_eq!(concept.concept_type, deserialized.concept_type);
        assert_eq!(concept.confidence, deserialized.confidence);
    }
}