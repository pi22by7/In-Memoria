//! Pattern learning and analysis modules
//!
//! This module provides comprehensive pattern recognition and learning capabilities
//! across multiple domains: naming conventions, structural patterns, implementation
//! patterns, and approach prediction.

// Core types and traits
pub mod types;

// Specialized pattern analyzers
pub mod naming;
pub mod structural;
pub mod implementation;
pub mod prediction;
pub mod learning;

// Re-export main types and analyzers
pub use types::*;
pub use naming::NamingPatternAnalyzer;
pub use structural::StructuralPatternAnalyzer;
pub use implementation::ImplementationPatternAnalyzer;
pub use prediction::ApproachPredictor;
pub use learning::PatternLearningEngine;

// Legacy compatibility - re-export the main pattern learning functionality
// through the new modular engine
#[cfg(feature = "napi-bindings")]
use napi_derive::napi;

/// Legacy PatternLearner for backwards compatibility
#[derive(Default)]
#[cfg_attr(feature = "napi-bindings", napi)]
pub struct PatternLearner {
    engine: PatternLearningEngine,
}

#[cfg_attr(feature = "napi-bindings", napi)]
impl PatternLearner {
    #[cfg_attr(feature = "napi-bindings", napi(constructor))]
    pub fn new() -> Self {
        PatternLearner {
            engine: PatternLearningEngine::new(),
        }
    }

    /// Learn patterns from an entire codebase
    /// 
    /// # Safety
    /// This function is marked unsafe for NAPI compatibility. It performs file system operations
    /// and pattern analysis that are inherently safe but marked unsafe for JavaScript interop.
    #[cfg_attr(feature = "napi-bindings", napi)]
    pub async unsafe fn learn_from_codebase(&mut self, path: String) -> Result<Vec<Pattern>, crate::types::ParseError> {
        self.engine.learn_from_codebase(path).await
    }

    /// Extract patterns from a specific path
    /// 
    /// # Safety
    /// This function is marked unsafe for NAPI compatibility. It performs file system operations
    /// and pattern analysis that are inherently safe but marked unsafe for JavaScript interop.
    #[cfg_attr(feature = "napi-bindings", napi)]
    pub async unsafe fn extract_patterns(&self, path: String) -> Result<Vec<Pattern>, crate::types::ParseError> {
        // Use the learning engine to extract patterns
        let naming_analyzer = NamingPatternAnalyzer::new();
        let structural_analyzer = StructuralPatternAnalyzer::new();
        let implementation_analyzer = ImplementationPatternAnalyzer::new();
        
        let mut all_patterns = Vec::new();
        
        // Extract patterns from each analyzer
        all_patterns.extend(naming_analyzer.extract_patterns(&path)?);
        all_patterns.extend(structural_analyzer.extract_patterns(&path)?);
        all_patterns.extend(implementation_analyzer.extract_patterns(&path)?);
        
        Ok(all_patterns)
    }

    /// Analyze file changes to identify patterns (original signature)
    /// 
    /// # Safety
    /// This function is marked unsafe due to NAPI bindings requirements.
    /// It should only be called from properly initialized JavaScript contexts.
    #[cfg_attr(feature = "napi-bindings", napi)]
    pub async unsafe fn analyze_file_change(
        &self,
        change_data: String,
    ) -> Result<PatternAnalysisResult, crate::types::ParseError> {
        self.analyze_file_change_internal(change_data).await
    }

    /// Internal implementation for analyze_file_change (from original)
    pub async fn analyze_file_change_internal(
        &self,
        change_data: String,
    ) -> Result<PatternAnalysisResult, crate::types::ParseError> {
        // Parse the change data (would be JSON in real implementation)
        let detected = self.detect_patterns_in_change(&change_data)?;
        let violations = self.detect_pattern_violations(&change_data)?;
        let recommendations = self.generate_recommendations(&detected, &violations)?;

        Ok(PatternAnalysisResult {
            detected,
            violations,
            recommendations,
            learned: None, // Would contain newly learned patterns
        })
    }

    /// Find patterns relevant to a given problem description (original signature)
    /// 
    /// # Safety
    /// This function is marked unsafe due to NAPI bindings requirements.
    /// It should only be called from properly initialized JavaScript contexts.
    #[cfg_attr(feature = "napi-bindings", napi)]
    pub async unsafe fn find_relevant_patterns(
        &self,
        problem_description: String,
        current_file: Option<String>,
        selected_code: Option<String>,
    ) -> Result<Vec<Pattern>, crate::types::ParseError> {
        self.find_relevant_patterns_internal(problem_description, current_file, selected_code)
            .await
    }

    /// Internal implementation for find_relevant_patterns (from original)
    pub async fn find_relevant_patterns_internal(
        &self,
        problem_description: String,
        current_file: Option<String>,
        selected_code: Option<String>,
    ) -> Result<Vec<Pattern>, crate::types::ParseError> {
        let mut relevant_patterns = Vec::new();

        // Analyze problem description for keywords
        let keywords = self.extract_keywords(&problem_description);

        // Find patterns matching the context using engine's learned patterns
        let learned_patterns = self.engine.get_learned_patterns();
        for pattern in learned_patterns {
            let relevance_score =
                self.calculate_pattern_relevance(&pattern, &keywords, &current_file, &selected_code);

            if relevance_score > 0.5 {
                relevant_patterns.push(pattern);
            }
        }

        // Sort by relevance and confidence
        relevant_patterns.sort_by(|a, b| {
            let score_a = a.confidence * a.frequency as f64;
            let score_b = b.confidence * b.frequency as f64;
            score_b
                .partial_cmp(&score_a)
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        Ok(relevant_patterns.into_iter().take(5).collect())
    }

    /// Predict coding approach based on problem description and context (original signature)
    /// 
    /// # Safety
    /// This function is marked unsafe due to NAPI bindings requirements.
    /// It should only be called from properly initialized JavaScript contexts.
    #[cfg_attr(feature = "napi-bindings", napi)]
    pub async unsafe fn predict_approach(
        &self,
        problem_description: String,
        context: std::collections::HashMap<String, String>,
    ) -> Result<ApproachPrediction, crate::types::ParseError> {
        self.predict_approach_internal(problem_description, context)
            .await
    }

    /// Internal implementation for predict_approach (from original)
    pub async fn predict_approach_internal(
        &self,
        problem_description: String,
        context: std::collections::HashMap<String, String>,
    ) -> Result<ApproachPrediction, crate::types::ParseError> {
        let keywords = self.extract_keywords(&problem_description);
        let relevant_patterns = self.find_patterns_by_keywords(&keywords);

        // Analyze problem complexity
        let complexity = self.estimate_problem_complexity(&problem_description, &context);

        // Generate approach based on learned patterns
        let approach = self.generate_approach(&relevant_patterns, &complexity);

        let prediction = ApproachPrediction {
            approach: approach.description,
            confidence: approach.confidence,
            reasoning: approach.reasoning,
            patterns: relevant_patterns
                .into_iter()
                .map(|p| p.pattern_type)
                .collect(),
            complexity: complexity.to_string(),
        };

        Ok(prediction)
    }

    /// Learn from analysis data
    /// 
    /// # Safety
    /// This function is marked unsafe for NAPI compatibility. It performs data parsing and
    /// learning operations that are inherently safe but marked unsafe for JavaScript interop.
    #[cfg_attr(feature = "napi-bindings", napi)]
    pub async unsafe fn learn_from_analysis(&mut self, analysis_data: String) -> Result<bool, crate::types::ParseError> {
        self.engine.learn_from_analysis(analysis_data).await
    }

    /// Update pattern learner from change data (from original implementation)
    /// 
    /// # Safety
    /// This function is marked unsafe for NAPI compatibility. It performs data parsing and
    /// pattern update operations that are inherently safe but marked unsafe for JavaScript interop.
    #[cfg_attr(feature = "napi-bindings", napi)]
    pub async unsafe fn update_from_change(&mut self, change_data: String) -> Result<bool, crate::types::ParseError> {
        self.engine.update_from_change(change_data).await
    }

    // Helper methods from original implementation

    fn detect_patterns_in_change(&self, _change_data: &str) -> Result<Vec<String>, crate::types::ParseError> {
        // Detect which patterns are present in the change
        Ok(vec!["naming_camelCase_function".to_string()])
    }

    fn detect_pattern_violations(&self, _change_data: &str) -> Result<Vec<String>, crate::types::ParseError> {
        // Detect violations of established patterns
        Ok(vec![])
    }

    fn generate_recommendations(
        &self,
        _detected: &[String],
        _violations: &[String],
    ) -> Result<Vec<String>, crate::types::ParseError> {
        // Generate recommendations based on detected patterns and violations
        Ok(vec![
            "Consider using consistent naming convention".to_string()
        ])
    }

    fn extract_keywords(&self, text: &str) -> Vec<String> {
        // Extract relevant keywords from text
        text.split_whitespace()
            .filter(|word| word.len() > 3)
            .map(|word| word.to_lowercase())
            .collect()
    }

    fn calculate_pattern_relevance(
        &self,
        pattern: &Pattern,
        keywords: &[String],
        _current_file: &Option<String>,
        _selected_code: &Option<String>,
    ) -> f64 {
        // Calculate how relevant a pattern is to the current context
        let mut relevance = 0.0;

        // Check keyword matches
        for keyword in keywords {
            if pattern.description.to_lowercase().contains(keyword) {
                relevance += 0.2;
            }
            if pattern.pattern_type.to_lowercase().contains(keyword) {
                relevance += 0.3;
            }
        }

        // Factor in pattern confidence and frequency
        relevance += pattern.confidence * 0.3;
        relevance += (pattern.frequency as f64 / 100.0) * 0.2;

        relevance.min(1.0)
    }

    fn find_patterns_by_keywords(&self, keywords: &[String]) -> Vec<Pattern> {
        let mut matching_patterns = Vec::new();
        let learned_patterns = self.engine.get_learned_patterns();

        for pattern in learned_patterns {
            for keyword in keywords {
                if pattern.description.to_lowercase().contains(keyword)
                    || pattern.pattern_type.to_lowercase().contains(keyword)
                {
                    matching_patterns.push(pattern);
                    break;
                }
            }
        }

        matching_patterns
    }

    fn estimate_problem_complexity(
        &self,
        problem_description: &str,
        _context: &std::collections::HashMap<String, String>,
    ) -> ProblemComplexity {
        let word_count = problem_description.split_whitespace().count();

        if word_count < 10 {
            ProblemComplexity::Low
        } else if word_count < 30 {
            ProblemComplexity::Medium
        } else {
            ProblemComplexity::High
        }
    }

    fn generate_approach(
        &self,
        relevant_patterns: &[Pattern],
        complexity: &ProblemComplexity,
    ) -> GeneratedApproach {
        let confidence = if relevant_patterns.is_empty() {
            0.3
        } else {
            relevant_patterns.iter().map(|p| p.confidence).sum::<f64>()
                / relevant_patterns.len() as f64
        };

        let description = match complexity {
            ProblemComplexity::Low => {
                "Use simple, direct implementation following established patterns"
            }
            ProblemComplexity::Medium => {
                "Break down into smaller components, apply relevant design patterns"
            }
            ProblemComplexity::High => {
                "Design comprehensive solution with multiple layers and patterns"
            }
        };

        let reasoning = format!(
            "Based on {} relevant patterns and {} complexity assessment",
            relevant_patterns.len(),
            complexity
        );

        GeneratedApproach {
            description: description.to_string(),
            confidence,
            reasoning,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::LineRange;

    #[test]
    fn test_pattern_learner_creation() {
        let learner = PatternLearner::new();
        assert!(learner.engine.get_learning_metrics().total_patterns_learned == 0);
    }

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
    fn test_pattern_analysis_result() {
        let result = PatternAnalysisResult {
            detected: vec!["pattern1".to_string()],
            violations: vec!["violation1".to_string()],
            recommendations: vec!["Use consistent naming".to_string()],
            learned: None,
        };

        assert_eq!(result.detected.len(), 1);
        assert_eq!(result.violations.len(), 1);
        assert_eq!(result.recommendations.len(), 1);
        assert!(result.learned.is_none());
    }

    #[tokio::test]
    async fn test_extract_patterns_internal() {
        let learner = PatternLearner::new();
        let result = unsafe { learner.extract_patterns("/test/path".to_string()).await };
        
        assert!(result.is_ok());
        let patterns = result.unwrap();
        // Should have some patterns from the analyzers
        assert!(!patterns.is_empty());
    }

    #[tokio::test]
    async fn test_analyze_file_change_internal() {
        let learner = PatternLearner::new();
        let change_data = r#"{
            "type": "modify",
            "file": "test.ts",
            "oldPath": "test.ts",
            "newPath": "test.ts"
        }"#.to_string();
        
        let result = learner.analyze_file_change_internal(change_data).await;
        
        assert!(result.is_ok());
        let analysis = result.unwrap();
        assert!(analysis.detected.len() >= 1);
        assert!(analysis.recommendations.len() >= 1);
    }

    #[tokio::test]
    async fn test_find_relevant_patterns_internal() {
        let mut learner = PatternLearner::new();
        
        // Add a test pattern to the engine first
        let pattern = Pattern {
            id: "test_function".to_string(),
            pattern_type: "function".to_string(),
            description: "Function pattern for testing".to_string(),
            frequency: 10,
            confidence: 0.9,
            examples: vec![PatternExample {
                code: "function test() {}".to_string(),
                file_path: "test.ts".to_string(),
                line_range: LineRange { start: 1, end: 1 },
            }],
            contexts: vec!["typescript".to_string()],
        };
        learner.engine.insert_pattern("test_function".to_string(), pattern);
        
        let result = learner.find_relevant_patterns_internal(
            "I need to create a function".to_string(),
            Some("test.ts".to_string()),
            None,
        ).await;
        
        assert!(result.is_ok());
        let patterns = result.unwrap();
        assert!(patterns.len() > 0);
        assert_eq!(patterns[0].pattern_type, "function");
    }

    #[tokio::test]
    async fn test_predict_approach_internal() {
        let mut learner = PatternLearner::new();
        
        // Add test patterns
        let pattern = Pattern {
            id: "api_pattern".to_string(),
            pattern_type: "api".to_string(),
            description: "REST API pattern".to_string(),
            frequency: 15,
            confidence: 0.85,
            examples: vec![PatternExample {
                code: "app.get('/api', handler)".to_string(),
                file_path: "server.js".to_string(),
                line_range: LineRange { start: 10, end: 10 },
            }],
            contexts: vec!["express".to_string()],
        };
        learner.engine.insert_pattern("api_pattern".to_string(), pattern);
        
        let mut context = std::collections::HashMap::new();
        context.insert("framework".to_string(), "express".to_string());
        context.insert("language".to_string(), "javascript".to_string());
        
        let result = learner.predict_approach_internal(
            "Build a REST API endpoint".to_string(),
            context,
        ).await;
        
        assert!(result.is_ok());
        let prediction = result.unwrap();
        assert!(prediction.confidence > 0.0);
        assert!(prediction.patterns.len() > 0);
        assert!(!prediction.approach.is_empty());
    }

    #[tokio::test]
    async fn test_learn_from_analysis() {
        let mut learner = PatternLearner::new();
        let analysis_data = r#"{
            "patterns": {
                "detected": ["service_pattern", "dependency_injection"],
                "learned": []
            },
            "concepts": [
                {
                    "name": "UserService",
                    "type": "class",
                    "patterns": ["service", "dependency_injection"]
                }
            ]
        }"#.to_string();
        
        let result = unsafe { learner.learn_from_analysis(analysis_data).await };
        assert!(result.is_ok());
        let updated = result.unwrap();
        assert!(updated); // Should return true since patterns were updated
    }

    #[tokio::test]
    async fn test_update_from_change() {
        let mut learner = PatternLearner::new();
        
        let change_data = r#"{
            "type": "modify",
            "path": "test.ts",
            "content": "function newName() {}",
            "language": "typescript"
        }"#.to_string();
        
        let result = unsafe { learner.update_from_change(change_data).await };
        assert!(result.is_ok());
        assert!(result.unwrap());
    }

    #[test]
    fn test_extract_keywords() {
        let learner = PatternLearner::new();
        let keywords = learner.extract_keywords("Build a REST API endpoint using Express");
        
        assert!(keywords.contains(&"build".to_string()));
        assert!(keywords.contains(&"rest".to_string()));
        assert!(keywords.contains(&"endpoint".to_string()));
        assert!(keywords.contains(&"using".to_string()));
        assert!(keywords.contains(&"express".to_string()));
    }

    #[test]
    fn test_problem_complexity_estimation() {
        let learner = PatternLearner::new();
        let context = std::collections::HashMap::new();
        
        let low = learner.estimate_problem_complexity("Simple task", &context);
        assert_eq!(low, ProblemComplexity::Low);
        
        let medium = learner.estimate_problem_complexity("Build a REST API with authentication and user management", &context);
        assert_eq!(medium, ProblemComplexity::Medium);
        
        let high = learner.estimate_problem_complexity(
            "Design and implement a comprehensive microservices architecture with distributed caching, message queuing, service discovery, and fault tolerance", 
            &context
        );
        assert_eq!(high, ProblemComplexity::High);
    }

    #[test]
    fn test_pattern_relevance_calculation() {
        let learner = PatternLearner::new();
        let pattern = Pattern {
            id: "test".to_string(),
            pattern_type: "function".to_string(),
            description: "Function pattern for JavaScript development".to_string(),
            frequency: 10,
            confidence: 0.8,
            examples: vec![],
            contexts: vec!["javascript".to_string()],
        };
        
        let keywords = vec!["function".to_string(), "javascript".to_string()];
        let relevance = learner.calculate_pattern_relevance(&pattern, &keywords, &None, &None);
        
        assert!(relevance > 0.5);
    }

    #[test]
    fn test_module_exports() {
        // Test that all main types are accessible
        let _naming = NamingPatternAnalyzer::new();
        let _structural = StructuralPatternAnalyzer::new();
        let _implementation = ImplementationPatternAnalyzer::new();
        let _predictor = ApproachPredictor::new();
        let _engine = PatternLearningEngine::new();
        
        // Test legacy compatibility
        let _legacy = PatternLearner::new();
    }

    #[test]
    fn test_approach_prediction_types() {
        let prediction = ApproachPrediction {
            approach: "Use modular architecture".to_string(),
            confidence: 0.85,
            reasoning: "Based on complexity analysis".to_string(),
            patterns: vec!["modular".to_string()],
            complexity: "medium".to_string(),
        };

        assert_eq!(prediction.approach, "Use modular architecture");
        assert_eq!(prediction.confidence, 0.85);
        assert!(!prediction.reasoning.is_empty());
        assert!(!prediction.patterns.is_empty());
        assert_eq!(prediction.complexity, "medium");
    }

    #[test]
    fn test_pattern_example_creation() {
        let example = PatternExample {
            code: "function calculateTotal() { return 42; }".to_string(),
            file_path: "utils.ts".to_string(),
            line_range: LineRange { start: 15, end: 15 },
        };

        assert!(example.code.contains("function"));
        assert!(example.code.contains("calculateTotal"));
        assert_eq!(example.file_path, "utils.ts");
        assert_eq!(example.line_range.start, 15);
        assert_eq!(example.line_range.end, 15);
    }
}