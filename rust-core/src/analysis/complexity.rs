//! Complexity analysis and metrics calculation

#[cfg(feature = "napi-bindings")]
use napi_derive::napi;

use crate::types::{SemanticConcept, ComplexityMetrics};
use std::collections::HashMap;

/// Analyzer for calculating code complexity metrics
#[cfg_attr(feature = "napi-bindings", napi)]
pub struct ComplexityAnalyzer;

#[cfg_attr(feature = "napi-bindings", napi)]
impl ComplexityAnalyzer {
    #[cfg_attr(feature = "napi-bindings", napi(constructor))]
    pub fn new() -> Self {
        ComplexityAnalyzer
    }

    /// Calculate complexity metrics from a set of semantic concepts
    pub fn calculate_complexity(concepts: &Vec<SemanticConcept>) -> ComplexityMetrics {
        let mut function_count = 0;
        let mut class_count = 0;
        let mut file_count = HashMap::new();
        let mut total_lines = 0;
        let mut max_depth = 0;

        for concept in concepts {
            match concept.concept_type.as_str() {
                "function" | "method" | "procedure" => function_count += 1,
                "class" | "interface" | "struct" | "enum" => class_count += 1,
                _ => {}
            }

            // Count unique files
            file_count.insert(&concept.file_path, true);

            // Track line ranges for total lines calculation
            let concept_lines = concept.line_range.end - concept.line_range.start + 1;
            total_lines += concept_lines;

            // Calculate depth from relationships (simplified metric)
            let relationship_depth = concept.relationships.len() as u32;
            if relationship_depth > max_depth {
                max_depth = relationship_depth;
            }
        }

        let file_count = file_count.len() as u32;
        let avg_functions_per_file = if file_count > 0 {
            function_count as f64 / file_count as f64
        } else {
            0.0
        };

        let avg_lines_per_concept = if !concepts.is_empty() {
            total_lines as f64 / concepts.len() as f64
        } else {
            0.0
        };

        ComplexityMetrics {
            cyclomatic_complexity: Self::estimate_cyclomatic_complexity(concepts),
            cognitive_complexity: Self::estimate_cognitive_complexity(concepts),
            function_count,
            class_count,
            file_count,
            avg_functions_per_file,
            avg_lines_per_concept,
            max_nesting_depth: max_depth,
        }
    }

    /// Estimate cyclomatic complexity based on concept analysis
    fn estimate_cyclomatic_complexity(concepts: &Vec<SemanticConcept>) -> f64 {
        let mut total_complexity = 0.0;
        let mut function_count = 0;

        for concept in concepts {
            if concept.concept_type == "function" || concept.concept_type == "method" {
                function_count += 1;
                
                // Base complexity of 1 for each function
                let mut complexity = 1.0;
                
                // Add complexity based on metadata patterns
                if let Some(body) = concept.metadata.get("body") {
                    complexity += Self::count_decision_points(body);
                }
                
                // Factor in confidence - lower confidence might indicate more complex code
                complexity *= 2.0 - concept.confidence;
                
                total_complexity += complexity;
            }
        }

        if function_count > 0 {
            total_complexity / function_count as f64
        } else {
            1.0
        }
    }

    /// Estimate cognitive complexity based on nesting and control flow
    fn estimate_cognitive_complexity(concepts: &Vec<SemanticConcept>) -> f64 {
        let mut total_cognitive = 0.0;
        let mut function_count = 0;

        for concept in concepts {
            if concept.concept_type == "function" || concept.concept_type == "method" {
                function_count += 1;
                
                let mut cognitive = 0.0;
                
                // Base cognitive load
                cognitive += 1.0;
                
                // Add load based on relationships (dependencies increase cognitive load)
                cognitive += concept.relationships.len() as f64 * 0.5;
                
                // Add load based on line span (longer functions are harder to understand)
                let line_span = concept.line_range.end - concept.line_range.start;
                if line_span > 20 {
                    cognitive += (line_span as f64 / 20.0) * 0.3;
                }
                
                total_cognitive += cognitive;
            }
        }

        if function_count > 0 {
            total_cognitive / function_count as f64
        } else {
            1.0
        }
    }

    /// Count decision points in code (simplified heuristic)
    fn count_decision_points(body: &str) -> f64 {
        let mut count = 0.0;
        
        // Look for common control flow keywords
        for keyword in &["if", "while", "for", "switch", "case", "catch", "&&", "||"] {
            count += body.matches(keyword).count() as f64;
        }
        
        // Ternary operators
        count += body.matches('?').count() as f64;
        
        count
    }
}

impl Default for ComplexityAnalyzer {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::LineRange;
    use std::collections::HashMap;

    fn create_test_concept(name: &str, concept_type: &str, file_path: &str, start: u32, end: u32) -> SemanticConcept {
        SemanticConcept {
            id: format!("test_{}", name),
            name: name.to_string(),
            concept_type: concept_type.to_string(),
            confidence: 0.8,
            file_path: file_path.to_string(),
            line_range: LineRange { start, end },
            relationships: HashMap::new(),
            metadata: HashMap::new(),
        }
    }

    #[test]
    fn test_complexity_analyzer_creation() {
        let _analyzer = ComplexityAnalyzer::new();
        // Constructor should work
    }

    #[test]
    fn test_calculate_basic_complexity() {
        let concepts = vec![
            create_test_concept("test_function", "function", "test.rs", 1, 10),
            create_test_concept("TestClass", "class", "test.rs", 15, 30),
        ];

        let metrics = ComplexityAnalyzer::calculate_complexity(&concepts);
        
        assert_eq!(metrics.function_count, 1);
        assert_eq!(metrics.class_count, 1);
        assert_eq!(metrics.file_count, 1);
        assert!(metrics.cyclomatic_complexity > 0.0);
        assert!(metrics.cognitive_complexity > 0.0);
    }

    #[test]
    fn test_empty_concepts() {
        let concepts = vec![];
        let metrics = ComplexityAnalyzer::calculate_complexity(&concepts);
        
        assert_eq!(metrics.function_count, 0);
        assert_eq!(metrics.class_count, 0);
        assert_eq!(metrics.file_count, 0);
        assert_eq!(metrics.avg_functions_per_file, 0.0);
        assert_eq!(metrics.avg_lines_per_concept, 0.0);
    }

    #[test]
    fn test_multiple_files() {
        let concepts = vec![
            create_test_concept("func1", "function", "file1.rs", 1, 10),
            create_test_concept("func2", "function", "file2.rs", 1, 15),
            create_test_concept("Class1", "class", "file1.rs", 20, 40),
        ];

        let metrics = ComplexityAnalyzer::calculate_complexity(&concepts);
        
        assert_eq!(metrics.function_count, 2);
        assert_eq!(metrics.class_count, 1);
        assert_eq!(metrics.file_count, 2);
        assert_eq!(metrics.avg_functions_per_file, 1.0);
    }

    #[test]
    fn test_complex_function_with_metadata() {
        let mut concept = create_test_concept("complex_func", "function", "test.rs", 1, 50);
        concept.metadata.insert("body".to_string(), "if (x > 0) { while (y < 10) { if (z) return; } }".to_string());
        
        let concepts = vec![concept];
        let metrics = ComplexityAnalyzer::calculate_complexity(&concepts);
        
        // Should have higher complexity due to control flow
        assert!(metrics.cyclomatic_complexity > 1.0);
        assert!(metrics.cognitive_complexity > 1.0);
    }

    #[test]
    fn test_count_decision_points() {
        let body1 = "if (x > 0) return x;";
        assert_eq!(ComplexityAnalyzer::count_decision_points(body1), 1.0);
        
        let body2 = "if (x > 0 && y < 5) { while (z) { for (i = 0; i < 10; i++) {} } }";
        assert!(ComplexityAnalyzer::count_decision_points(body2) >= 4.0);
        
        let body3 = "return x > 0 ? x : -x;";
        assert!(ComplexityAnalyzer::count_decision_points(body3) >= 1.0);
    }

    #[test]
    fn test_relationships_impact_complexity() {
        let mut concept = create_test_concept("connected_func", "function", "test.rs", 1, 20);
        concept.relationships.insert("calls".to_string(), "other_func".to_string());
        concept.relationships.insert("uses".to_string(), "SomeClass".to_string());
        
        let concepts = vec![concept];
        let metrics = ComplexityAnalyzer::calculate_complexity(&concepts);
        
        // Relationships should increase cognitive complexity
        assert!(metrics.cognitive_complexity > 1.0);
        assert_eq!(metrics.max_nesting_depth, 2);
    }
}