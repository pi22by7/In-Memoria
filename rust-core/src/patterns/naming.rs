//! Naming pattern analysis and recognition

#[cfg(feature = "napi-bindings")]
use napi_derive::napi;

use crate::patterns::types::{Pattern, PatternExample, NamingPattern, PatternExtractor};
use crate::types::{ParseError, LineRange, SemanticConcept};
use std::collections::HashMap;
use walkdir::WalkDir;
use std::fs;
use regex::Regex;

/// Analyzer for detecting and learning naming conventions
#[cfg_attr(feature = "napi-bindings", napi)]
pub struct NamingPatternAnalyzer {
    patterns: HashMap<String, NamingPattern>,
    naming_rules: HashMap<String, Vec<NamingRule>>,
}

#[derive(Debug, Clone)]
struct NamingRule {
    rule_type: String,
    pattern: String,
    confidence_weight: f64,
}

#[cfg_attr(feature = "napi-bindings", napi)]
impl NamingPatternAnalyzer {
    #[cfg_attr(feature = "napi-bindings", napi(constructor))]
    pub fn new() -> Self {
        let mut analyzer = NamingPatternAnalyzer {
            patterns: HashMap::new(),
            naming_rules: HashMap::new(),
        };
        analyzer.initialize_rules();
        analyzer
    }

    /// Initialize common naming pattern rules
    fn initialize_rules(&mut self) {
        // JavaScript/TypeScript naming rules
        let js_rules = vec![
            NamingRule {
                rule_type: "camelCase".to_string(),
                pattern: r"^[a-z][a-zA-Z0-9]*$".to_string(),
                confidence_weight: 0.9,
            },
            NamingRule {
                rule_type: "PascalCase".to_string(),
                pattern: r"^[A-Z][a-zA-Z0-9]*$".to_string(),
                confidence_weight: 0.9,
            },
            NamingRule {
                rule_type: "CONSTANT_CASE".to_string(),
                pattern: r"^[A-Z][A-Z0-9_]*$".to_string(),
                confidence_weight: 0.8,
            },
        ];
        self.naming_rules.insert("javascript".to_string(), js_rules.clone());
        self.naming_rules.insert("typescript".to_string(), js_rules);

        // Rust naming rules
        let rust_rules = vec![
            NamingRule {
                rule_type: "snake_case".to_string(),
                pattern: r"^[a-z][a-z0-9_]*$".to_string(),
                confidence_weight: 0.9,
            },
            NamingRule {
                rule_type: "PascalCase".to_string(),
                pattern: r"^[A-Z][a-zA-Z0-9]*$".to_string(),
                confidence_weight: 0.9,
            },
            NamingRule {
                rule_type: "SCREAMING_SNAKE_CASE".to_string(),
                pattern: r"^[A-Z][A-Z0-9_]*$".to_string(),
                confidence_weight: 0.8,
            },
        ];
        self.naming_rules.insert("rust".to_string(), rust_rules);

        // Python naming rules
        let python_rules = vec![
            NamingRule {
                rule_type: "snake_case".to_string(),
                pattern: r"^[a-z][a-z0-9_]*$".to_string(),
                confidence_weight: 0.9,
            },
            NamingRule {
                rule_type: "PascalCase".to_string(),
                pattern: r"^[A-Z][a-zA-Z0-9]*$".to_string(),
                confidence_weight: 0.8,
            },
            NamingRule {
                rule_type: "CONSTANT_CASE".to_string(),
                pattern: r"^[A-Z][A-Z0-9_]*$".to_string(),
                confidence_weight: 0.8,
            },
        ];
        self.naming_rules.insert("python".to_string(), python_rules);
    }

    /// Analyze naming patterns from semantic concepts
    pub fn analyze_concepts(&mut self, concepts: &[SemanticConcept], language: &str) -> Result<Vec<Pattern>, ParseError> {
        let mut detected_patterns: HashMap<String, (u32, Vec<PatternExample>)> = HashMap::new();

        // Get naming rules for the language
        let rules = self.naming_rules.get(language).cloned().unwrap_or_else(|| {
            // Default to common patterns
            vec![
                NamingRule {
                    rule_type: "mixed".to_string(),
                    pattern: r".*".to_string(),
                    confidence_weight: 0.3,
                },
            ]
        });

        // Analyze each concept's name
        for concept in concepts {
            let name = &concept.name;
            
            for rule in &rules {
                if let Ok(regex) = Regex::new(&rule.pattern) {
                    if regex.is_match(name) {
                        let pattern_key = format!("{}_{}", rule.rule_type, self.get_context_type(&concept.concept_type));
                        
                        let example = PatternExample {
                            code: format!("{} {}", concept.concept_type, name),
                            file_path: concept.file_path.clone(),
                            line_range: concept.line_range.clone(),
                        };

                        let entry = detected_patterns.entry(pattern_key.clone()).or_insert((0, Vec::new()));
                        entry.0 += 1;
                        entry.1.push(example);

                        // Update internal naming pattern storage
                        let naming_pattern = NamingPattern {
                            pattern_type: rule.rule_type.clone(),
                            frequency: entry.0,
                            contexts: vec![self.get_context_type(&concept.concept_type)],
                            confidence: rule.confidence_weight,
                        };
                        self.patterns.insert(pattern_key, naming_pattern);
                        break;
                    }
                }
            }
        }

        // Convert to Pattern objects
        let mut patterns = Vec::new();
        for (pattern_key, (frequency, examples)) in detected_patterns {
            if let Some(naming_pattern) = self.patterns.get(&pattern_key) {
                let confidence = self.calculate_confidence(frequency, examples.len(), naming_pattern.confidence);
                
                patterns.push(Pattern {
                    id: format!("naming_{}", pattern_key),
                    pattern_type: "naming".to_string(),
                    description: format!(
                        "{} naming pattern for {} (used {} times)",
                        naming_pattern.pattern_type,
                        naming_pattern.contexts.join(", "),
                        frequency
                    ),
                    frequency,
                    confidence,
                    examples,
                    contexts: vec![language.to_string()],
                });
            }
        }

        Ok(patterns)
    }

    /// Detect violations of established naming patterns
    pub fn detect_violations(&self, concepts: &[SemanticConcept], language: &str) -> Vec<String> {
        let mut violations = Vec::new();
        
        // Get dominant patterns for this language/context
        let dominant_patterns = self.get_dominant_patterns(language);
        
        for concept in concepts {
            let context = self.get_context_type(&concept.concept_type);
            let expected_pattern = dominant_patterns.get(&context);
            
            if let Some(pattern) = expected_pattern {
                if !self.matches_pattern(&concept.name, &pattern.pattern_type) {
                    violations.push(format!(
                        "Naming violation in {}: '{}' should follow {} pattern (found in {}:{})",
                        concept.file_path,
                        concept.name,
                        pattern.pattern_type,
                        concept.file_path,
                        concept.line_range.start
                    ));
                }
            }
        }
        
        violations
    }

    /// Generate naming recommendations based on learned patterns
    pub fn generate_recommendations(&self, language: &str) -> Vec<String> {
        let mut recommendations = Vec::new();
        let dominant_patterns = self.get_dominant_patterns(language);
        
        for (context, pattern) in dominant_patterns {
            if pattern.confidence > 0.7 {
                recommendations.push(format!(
                    "Use {} for {} names (confidence: {:.2})",
                    pattern.pattern_type,
                    context,
                    pattern.confidence
                ));
            }
        }
        
        if recommendations.is_empty() {
            recommendations.push("Consider establishing consistent naming conventions".to_string());
        }
        
        recommendations
    }

    /// Learn naming patterns from file changes
    pub fn learn_from_changes(&mut self, old_code: &str, new_code: &str, language: &str) -> Result<Vec<Pattern>, ParseError> {
        // This is a simplified implementation - in practice you'd use AST diffing
        let old_names = self.extract_names_from_code(old_code, language);
        let new_names = self.extract_names_from_code(new_code, language);
        
        // Find newly introduced names
        let mut new_patterns = Vec::new();
        for name in &new_names {
            if !old_names.contains(name) {
                if let Some(pattern_type) = self.classify_name(name, language) {
                    // Update frequency and create pattern
                    let pattern_key = format!("{}_{}", pattern_type, "unknown");
                    
                    let entry = self.patterns.entry(pattern_key.clone()).or_insert(NamingPattern {
                        pattern_type: pattern_type.clone(),
                        frequency: 0,
                        contexts: vec!["unknown".to_string()],
                        confidence: 0.5,
                    });
                    entry.frequency += 1;
                    
                    new_patterns.push(Pattern {
                        id: format!("naming_{}", pattern_key),
                        pattern_type: "naming".to_string(),
                        description: format!("Detected {} pattern", pattern_type),
                        frequency: entry.frequency,
                        confidence: entry.confidence,
                        examples: vec![],
                        contexts: vec![language.to_string()],
                    });
                }
            }
        }
        
        Ok(new_patterns)
    }

    /// Get the dominant patterns for a language
    fn get_dominant_patterns(&self, language: &str) -> HashMap<String, &NamingPattern> {
        let mut dominant: HashMap<String, &NamingPattern> = HashMap::new();
        
        for (key, pattern) in &self.patterns {
            if key.contains(language) || pattern.contexts.contains(&language.to_string()) {
                let parts: Vec<&str> = key.split('_').collect();
                if parts.len() >= 2 {
                    let context = parts[parts.len() - 1];
                    
                    // Use the pattern with highest confidence for each context
                    match dominant.get(context) {
                        Some(existing) if existing.confidence < pattern.confidence => {
                            dominant.insert(context.to_string(), pattern);
                        }
                        None => {
                            dominant.insert(context.to_string(), pattern);
                        }
                        _ => {}
                    }
                }
            }
        }
        
        dominant
    }

    /// Check if a name matches a pattern type
    fn matches_pattern(&self, name: &str, pattern_type: &str) -> bool {
        match pattern_type {
            "camelCase" => {
                let regex = Regex::new(r"^[a-z][a-zA-Z0-9]*$").unwrap();
                regex.is_match(name)
            }
            "PascalCase" => {
                let regex = Regex::new(r"^[A-Z][a-zA-Z0-9]*$").unwrap();
                regex.is_match(name)
            }
            "snake_case" => {
                let regex = Regex::new(r"^[a-z][a-z0-9_]*$").unwrap();
                regex.is_match(name)
            }
            "CONSTANT_CASE" | "SCREAMING_SNAKE_CASE" => {
                let regex = Regex::new(r"^[A-Z][A-Z0-9_]*$").unwrap();
                regex.is_match(name)
            }
            _ => true, // Unknown patterns are considered matches
        }
    }

    /// Get context type from concept type
    fn get_context_type(&self, concept_type: &str) -> String {
        match concept_type {
            "class" | "interface" | "struct" => "type".to_string(),
            "function" | "method" => "function".to_string(),
            "variable" | "field" => "variable".to_string(),
            "constant" => "constant".to_string(),
            _ => "unknown".to_string(),
        }
    }

    /// Calculate confidence score for a pattern
    fn calculate_confidence(&self, frequency: u32, examples_count: usize, base_confidence: f64) -> f64 {
        let frequency_boost = (frequency as f64).log10().min(0.3);
        let examples_boost = (examples_count as f64 / 10.0).min(0.2);
        (base_confidence + frequency_boost + examples_boost).min(1.0)
    }

    /// Extract names from code (simplified implementation)
    fn extract_names_from_code(&self, code: &str, language: &str) -> Vec<String> {
        let mut names = Vec::new();
        
        match language {
            "javascript" | "typescript" => {
                // Simple regex-based extraction for demo
                let patterns = [
                    r"function\s+([a-zA-Z_][a-zA-Z0-9_]*)",
                    r"const\s+([a-zA-Z_][a-zA-Z0-9_]*)",
                    r"let\s+([a-zA-Z_][a-zA-Z0-9_]*)",
                    r"var\s+([a-zA-Z_][a-zA-Z0-9_]*)",
                    r"class\s+([a-zA-Z_][a-zA-Z0-9_]*)",
                ];
                
                for pattern_str in &patterns {
                    if let Ok(regex) = Regex::new(pattern_str) {
                        for captures in regex.captures_iter(code) {
                            if let Some(name) = captures.get(1) {
                                names.push(name.as_str().to_string());
                            }
                        }
                    }
                }
            }
            "rust" => {
                let patterns = [
                    r"fn\s+([a-zA-Z_][a-zA-Z0-9_]*)",
                    r"struct\s+([a-zA-Z_][a-zA-Z0-9_]*)",
                    r"enum\s+([a-zA-Z_][a-zA-Z0-9_]*)",
                    r"let\s+([a-zA-Z_][a-zA-Z0-9_]*)",
                    r"const\s+([A-Z_][A-Z0-9_]*)",
                ];
                
                for pattern_str in &patterns {
                    if let Ok(regex) = Regex::new(pattern_str) {
                        for captures in regex.captures_iter(code) {
                            if let Some(name) = captures.get(1) {
                                names.push(name.as_str().to_string());
                            }
                        }
                    }
                }
            }
            _ => {} // Add more languages as needed
        }
        
        names
    }

    /// Classify a name into a pattern type
    fn classify_name(&self, name: &str, language: &str) -> Option<String> {
        if let Some(rules) = self.naming_rules.get(language) {
            for rule in rules {
                if let Ok(regex) = Regex::new(&rule.pattern) {
                    if regex.is_match(name) {
                        return Some(rule.rule_type.clone());
                    }
                }
            }
        }
        None
    }
}

impl PatternExtractor for NamingPatternAnalyzer {
    fn extract_patterns(&self, path: &str) -> Result<Vec<Pattern>, ParseError> {
        let mut all_patterns = Vec::new();
        
        for entry in WalkDir::new(path).into_iter().filter_map(|e| e.ok()) {
            if entry.file_type().is_file() {
                let file_path = entry.path();
                if let Some(extension) = file_path.extension().and_then(|s| s.to_str()) {
                    let language = match extension.to_lowercase().as_str() {
                        "js" | "jsx" => "javascript",
                        "ts" | "tsx" => "typescript", 
                        "rs" => "rust",
                        "py" => "python",
                        _ => continue,
                    };
                    
                    if let Ok(content) = fs::read_to_string(file_path) {
                        let names = self.extract_names_from_code(&content, language);
                        
                        for name in names {
                            if let Some(pattern_type) = self.classify_name(&name, language) {
                                all_patterns.push(Pattern {
                                    id: format!("naming_{}_{}", pattern_type, name),
                                    pattern_type: "naming".to_string(),
                                    description: format!("{} naming pattern", pattern_type),
                                    frequency: 1,
                                    confidence: 0.7,
                                    examples: vec![PatternExample {
                                        code: name,
                                        file_path: file_path.to_string_lossy().to_string(),
                                        line_range: LineRange { start: 1, end: 1 },
                                    }],
                                    contexts: vec![language.to_string()],
                                });
                            }
                        }
                    }
                }
            }
        }
        
        Ok(all_patterns)
    }
}

impl Default for NamingPatternAnalyzer {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::SemanticConcept;
    use std::collections::HashMap;

    fn create_test_concept(name: &str, concept_type: &str, file_path: &str) -> SemanticConcept {
        SemanticConcept {
            id: format!("test_{}", name),
            name: name.to_string(),
            concept_type: concept_type.to_string(),
            confidence: 0.8,
            file_path: file_path.to_string(),
            line_range: LineRange { start: 1, end: 1 },
            relationships: HashMap::new(),
            metadata: HashMap::new(),
        }
    }

    #[test]
    fn test_naming_pattern_analyzer_creation() {
        let analyzer = NamingPatternAnalyzer::new();
        assert!(!analyzer.patterns.is_empty() || !analyzer.naming_rules.is_empty());
    }

    #[test]
    fn test_camel_case_detection() {
        let mut analyzer = NamingPatternAnalyzer::new();
        let concepts = vec![
            create_test_concept("getUserName", "function", "test.js"),
            create_test_concept("userName", "variable", "test.js"),
        ];

        let patterns = analyzer.analyze_concepts(&concepts, "javascript").unwrap();
        assert!(!patterns.is_empty());
        
        let camel_case_patterns: Vec<_> = patterns.iter()
            .filter(|p| p.description.contains("camelCase"))
            .collect();
        assert!(!camel_case_patterns.is_empty());
    }

    #[test]
    fn test_snake_case_detection() {
        let mut analyzer = NamingPatternAnalyzer::new();
        let concepts = vec![
            create_test_concept("get_user_name", "function", "test.rs"),
            create_test_concept("user_name", "variable", "test.rs"),
        ];

        let patterns = analyzer.analyze_concepts(&concepts, "rust").unwrap();
        assert!(!patterns.is_empty());
        
        let snake_case_patterns: Vec<_> = patterns.iter()
            .filter(|p| p.description.contains("snake_case"))
            .collect();
        assert!(!snake_case_patterns.is_empty());
    }

    #[test]
    fn test_pascal_case_detection() {
        let mut analyzer = NamingPatternAnalyzer::new();
        let concepts = vec![
            create_test_concept("UserService", "class", "test.ts"),
            create_test_concept("ApiClient", "class", "test.ts"),
        ];

        let patterns = analyzer.analyze_concepts(&concepts, "typescript").unwrap();
        assert!(!patterns.is_empty());
        
        let pascal_case_patterns: Vec<_> = patterns.iter()
            .filter(|p| p.description.contains("PascalCase"))
            .collect();
        assert!(!pascal_case_patterns.is_empty());
    }

    #[test]
    fn test_violation_detection() {
        let mut analyzer = NamingPatternAnalyzer::new();
        
        // First establish a pattern
        let good_concepts = vec![
            create_test_concept("getUserName", "function", "test.js"),
            create_test_concept("setUserName", "function", "test.js"),
            create_test_concept("userName", "variable", "test.js"),
        ];
        let _ = analyzer.analyze_concepts(&good_concepts, "javascript").unwrap();

        // Then check for violations
        let bad_concepts = vec![
            create_test_concept("get_user_age", "function", "test.js"), // snake_case in JS
        ];
        
        let violations = analyzer.detect_violations(&bad_concepts, "javascript");
        assert!(!violations.is_empty());
    }

    #[test]
    fn test_recommendations_generation() {
        let mut analyzer = NamingPatternAnalyzer::new();
        let concepts = vec![
            create_test_concept("getUserName", "function", "test.js"),
            create_test_concept("setUserName", "function", "test.js"),
            create_test_concept("userName", "variable", "test.js"),
        ];
        let _ = analyzer.analyze_concepts(&concepts, "javascript").unwrap();

        let recommendations = analyzer.generate_recommendations("javascript");
        assert!(!recommendations.is_empty());
    }

    #[test]
    fn test_context_type_mapping() {
        let analyzer = NamingPatternAnalyzer::new();
        
        assert_eq!(analyzer.get_context_type("class"), "type");
        assert_eq!(analyzer.get_context_type("function"), "function");
        assert_eq!(analyzer.get_context_type("variable"), "variable");
        assert_eq!(analyzer.get_context_type("constant"), "constant");
        assert_eq!(analyzer.get_context_type("unknown"), "unknown");
    }

    #[test]
    fn test_pattern_matching() {
        let analyzer = NamingPatternAnalyzer::new();
        
        assert!(analyzer.matches_pattern("camelCase", "camelCase"));
        assert!(analyzer.matches_pattern("PascalCase", "PascalCase"));
        assert!(analyzer.matches_pattern("snake_case", "snake_case"));
        assert!(analyzer.matches_pattern("CONSTANT_CASE", "CONSTANT_CASE"));
        
        assert!(!analyzer.matches_pattern("PascalCase", "camelCase"));
        assert!(!analyzer.matches_pattern("snake_case", "PascalCase"));
    }

    #[test]
    fn test_name_extraction() {
        let analyzer = NamingPatternAnalyzer::new();
        
        let js_code = "function getUserName() { const userName = 'test'; }";
        let names = analyzer.extract_names_from_code(js_code, "javascript");
        assert!(names.contains(&"getUserName".to_string()));
        assert!(names.contains(&"userName".to_string()));
        
        let rust_code = "fn get_user_name() { let user_name = String::new(); }";
        let names = analyzer.extract_names_from_code(rust_code, "rust");
        assert!(names.contains(&"get_user_name".to_string()));
        assert!(names.contains(&"user_name".to_string()));
    }

    #[test]
    fn test_name_classification() {
        let analyzer = NamingPatternAnalyzer::new();
        
        assert_eq!(analyzer.classify_name("camelCase", "javascript"), Some("camelCase".to_string()));
        assert_eq!(analyzer.classify_name("PascalCase", "javascript"), Some("PascalCase".to_string()));
        assert_eq!(analyzer.classify_name("snake_case", "rust"), Some("snake_case".to_string()));
        assert_eq!(analyzer.classify_name("CONSTANT_CASE", "rust"), Some("SCREAMING_SNAKE_CASE".to_string()));
    }
}