//! Implementation pattern recognition for design patterns

#[cfg(feature = "napi-bindings")]
use napi_derive::napi;

use crate::patterns::types::{Pattern, PatternExample, ImplementationPattern, PatternExtractor};
use crate::types::{ParseError, LineRange, SemanticConcept};
use std::collections::HashMap;
use regex::Regex;
use walkdir::WalkDir;
use std::fs;

/// Analyzer for detecting implementation patterns (design patterns)
#[cfg_attr(feature = "napi-bindings", napi)]
pub struct ImplementationPatternAnalyzer {
    patterns: HashMap<String, ImplementationPattern>,
    pattern_signatures: HashMap<String, PatternSignature>,
}

#[derive(Debug, Clone)]
struct PatternSignature {
    required_methods: Vec<String>,
    optional_methods: Vec<String>,
    class_characteristics: Vec<String>,
    code_patterns: Vec<String>,
    confidence_threshold: f64,
}

#[derive(Debug, Clone)]
struct PatternMatch {
    pattern_name: String,
    confidence: f64,
    evidence: Vec<String>,
    location: String,
}

#[cfg_attr(feature = "napi-bindings", napi)]
impl ImplementationPatternAnalyzer {
    #[cfg_attr(feature = "napi-bindings", napi(constructor))]
    pub fn new() -> Self {
        let mut analyzer = ImplementationPatternAnalyzer {
            patterns: HashMap::new(),
            pattern_signatures: HashMap::new(),
        };
        analyzer.initialize_pattern_signatures();
        analyzer
    }

    /// Initialize signatures for common design patterns
    fn initialize_pattern_signatures(&mut self) {
        // Singleton Pattern
        self.pattern_signatures.insert("Singleton".to_string(), PatternSignature {
            required_methods: vec!["getInstance".to_string()],
            optional_methods: vec!["constructor".to_string(), "__construct".to_string()],
            class_characteristics: vec!["static_instance".to_string(), "private_constructor".to_string()],
            code_patterns: vec![
                r"private\s+static\s+\w*instance".to_string(),
                r"getInstance\(\)".to_string(),
                r"private\s+\w*\(\)".to_string(), // private constructor
            ],
            confidence_threshold: 0.7,
        });

        // Factory Pattern
        self.pattern_signatures.insert("Factory".to_string(), PatternSignature {
            required_methods: vec!["create".to_string(), "make".to_string(), "build".to_string()],
            optional_methods: vec!["factory".to_string()],
            class_characteristics: vec!["creator".to_string(), "product".to_string()],
            code_patterns: vec![
                r"create\w*\(\)".to_string(),
                r"make\w*\(\)".to_string(),
                r"Factory".to_string(),
            ],
            confidence_threshold: 0.6,
        });

        // Observer Pattern
        self.pattern_signatures.insert("Observer".to_string(), PatternSignature {
            required_methods: vec!["notify".to_string(), "update".to_string(), "subscribe".to_string()],
            optional_methods: vec!["unsubscribe".to_string(), "addListener".to_string(), "removeListener".to_string()],
            class_characteristics: vec!["subject".to_string(), "observer".to_string(), "listeners".to_string()],
            code_patterns: vec![
                r"notify\w*\(\)".to_string(),
                r"update\(\)".to_string(),
                r"subscribe\(\)".to_string(),
                r"addEventListener".to_string(),
            ],
            confidence_threshold: 0.7,
        });

        // Builder Pattern
        self.pattern_signatures.insert("Builder".to_string(), PatternSignature {
            required_methods: vec!["build".to_string(), "with".to_string(), "set".to_string()],
            optional_methods: vec!["create".to_string(), "builder".to_string()],
            class_characteristics: vec!["builder".to_string(), "director".to_string()],
            code_patterns: vec![
                r"\.with\w+\(".to_string(),
                r"\.set\w+\(".to_string(),
                r"\.build\(\)".to_string(),
                r"Builder".to_string(),
            ],
            confidence_threshold: 0.6,
        });

        // Strategy Pattern
        self.pattern_signatures.insert("Strategy".to_string(), PatternSignature {
            required_methods: vec!["execute".to_string(), "apply".to_string(), "process".to_string()],
            optional_methods: vec!["strategy".to_string(), "algorithm".to_string()],
            class_characteristics: vec!["strategy".to_string(), "context".to_string()],
            code_patterns: vec![
                r"execute\(\)".to_string(),
                r"Strategy".to_string(),
                r"setStrategy\(".to_string(),
            ],
            confidence_threshold: 0.6,
        });

        // Dependency Injection Pattern
        self.pattern_signatures.insert("DependencyInjection".to_string(), PatternSignature {
            required_methods: vec!["inject".to_string(), "provide".to_string(), "register".to_string()],
            optional_methods: vec!["bind".to_string(), "container".to_string()],
            class_characteristics: vec!["injector".to_string(), "container".to_string(), "provider".to_string()],
            code_patterns: vec![
                r"@inject".to_string(),
                r"@Injectable".to_string(),
                r"container\.get\(".to_string(),
                r"DI".to_string(),
            ],
            confidence_threshold: 0.7,
        });

        // Decorator Pattern
        self.pattern_signatures.insert("Decorator".to_string(), PatternSignature {
            required_methods: vec!["wrap".to_string(), "decorate".to_string()],
            optional_methods: vec!["unwrap".to_string()],
            class_characteristics: vec!["decorator".to_string(), "wrapper".to_string()],
            code_patterns: vec![
                r"@\w+".to_string(), // Decorator syntax
                r"Decorator".to_string(),
                r"wrap\(".to_string(),
            ],
            confidence_threshold: 0.6,
        });

        // Command Pattern
        self.pattern_signatures.insert("Command".to_string(), PatternSignature {
            required_methods: vec!["execute".to_string(), "undo".to_string()],
            optional_methods: vec!["redo".to_string(), "command".to_string()],
            class_characteristics: vec!["command".to_string(), "invoker".to_string(), "receiver".to_string()],
            code_patterns: vec![
                r"execute\(\)".to_string(),
                r"undo\(\)".to_string(),
                r"Command".to_string(),
            ],
            confidence_threshold: 0.7,
        });

        // Adapter Pattern
        self.pattern_signatures.insert("Adapter".to_string(), PatternSignature {
            required_methods: vec!["adapt".to_string(), "convert".to_string()],
            optional_methods: vec!["wrap".to_string()],
            class_characteristics: vec!["adapter".to_string(), "adaptee".to_string()],
            code_patterns: vec![
                r"Adapter".to_string(),
                r"adapt\(".to_string(),
            ],
            confidence_threshold: 0.6,
        });
    }

    /// Analyze semantic concepts for implementation patterns
    pub fn analyze_concepts(&mut self, concepts: &[SemanticConcept]) -> Result<Vec<Pattern>, ParseError> {
        let mut detected_patterns = Vec::new();
        let pattern_matches = self.detect_patterns_in_concepts(concepts)?;
        
        for pattern_match in pattern_matches {
            if pattern_match.confidence >= self.pattern_signatures
                .get(&pattern_match.pattern_name)
                .map(|s| s.confidence_threshold)
                .unwrap_or(0.5) {
                
                let examples = self.create_examples_for_pattern(&pattern_match, concepts);
                
                let pattern = Pattern {
                    id: format!("implementation_{}", pattern_match.pattern_name.to_lowercase()),
                    pattern_type: "implementation".to_string(),
                    description: format!(
                        "{} pattern detected with {:.1}% confidence",
                        pattern_match.pattern_name,
                        pattern_match.confidence * 100.0
                    ),
                    frequency: pattern_match.evidence.len() as u32,
                    confidence: pattern_match.confidence,
                    examples,
                    contexts: vec!["design_pattern".to_string()],
                };
                
                detected_patterns.push(pattern);
                
                // Store in internal patterns
                let impl_pattern = ImplementationPattern {
                    pattern_type: pattern_match.pattern_name.clone(),
                    frequency: pattern_match.evidence.len() as u32,
                    code_signatures: pattern_match.evidence.clone(),
                    confidence: pattern_match.confidence,
                };
                self.patterns.insert(pattern_match.pattern_name.clone(), impl_pattern);
            }
        }
        
        Ok(detected_patterns)
    }

    /// Detect anti-patterns in implementation
    pub fn detect_antipatterns(&self, concepts: &[SemanticConcept]) -> Vec<String> {
        let mut antipatterns = Vec::new();
        
        antipatterns.extend(self.detect_god_object_antipattern(concepts));
        antipatterns.extend(self.detect_spaghetti_code_antipattern(concepts));
        antipatterns.extend(self.detect_copy_paste_antipattern(concepts));
        antipatterns.extend(self.detect_magic_number_antipattern(concepts));
        antipatterns.extend(self.detect_long_parameter_list_antipattern(concepts));
        
        antipatterns
    }

    /// Generate recommendations based on detected patterns
    pub fn generate_recommendations(&self, concepts: &[SemanticConcept]) -> Vec<String> {
        let mut recommendations = Vec::new();
        
        // Check for missing patterns that could be beneficial
        if self.should_suggest_singleton(concepts) {
            recommendations.push("Consider using Singleton pattern for global state management".to_string());
        }
        
        if self.should_suggest_factory(concepts) {
            recommendations.push("Consider using Factory pattern for object creation complexity".to_string());
        }
        
        if self.should_suggest_observer(concepts) {
            recommendations.push("Consider using Observer pattern for event handling".to_string());
        }
        
        if self.should_suggest_strategy(concepts) {
            recommendations.push("Consider using Strategy pattern to reduce conditional complexity".to_string());
        }
        
        if self.should_suggest_dependency_injection(concepts) {
            recommendations.push("Consider using Dependency Injection for better testability".to_string());
        }
        
        // Anti-pattern recommendations
        let antipatterns = self.detect_antipatterns(concepts);
        if !antipatterns.is_empty() {
            recommendations.push("Address detected anti-patterns to improve code quality".to_string());
        }
        
        if recommendations.is_empty() {
            recommendations.push("Implementation patterns look good! Consider documenting design decisions".to_string());
        }
        
        recommendations
    }

    /// Analyze code files for pattern signatures
    pub fn analyze_code_files(&mut self, path: &str) -> Result<Vec<Pattern>, ParseError> {
        let mut detected_patterns = Vec::new();
        
        for entry in WalkDir::new(path).into_iter().filter_map(|e| e.ok()) {
            if entry.file_type().is_file() {
                let file_path = entry.path();
                if let Some(extension) = file_path.extension().and_then(|s| s.to_str()) {
                    if matches!(extension.to_lowercase().as_str(), "js" | "ts" | "jsx" | "tsx" | "rs" | "py" | "java" | "cs" | "cpp" | "c") {
                        if let Ok(content) = fs::read_to_string(file_path) {
                            let patterns = self.detect_patterns_in_code(&content, file_path.to_string_lossy().as_ref())?;
                            detected_patterns.extend(patterns);
                        }
                    }
                }
            }
        }
        
        Ok(detected_patterns)
    }

    /// Detect patterns in concepts using semantic analysis
    fn detect_patterns_in_concepts(&self, concepts: &[SemanticConcept]) -> Result<Vec<PatternMatch>, ParseError> {
        let mut pattern_matches = Vec::new();
        
        for (pattern_name, signature) in &self.pattern_signatures {
            let mut evidence = Vec::new();
            let mut confidence_scores = Vec::new();
            
            // Check for required methods in concepts
            let method_matches = self.find_method_matches(concepts, &signature.required_methods);
            evidence.extend(method_matches.iter().map(|m| format!("Method: {}", m)));
            
            if !method_matches.is_empty() {
                confidence_scores.push(0.4 * (method_matches.len() as f64 / signature.required_methods.len() as f64));
            }
            
            // Check for optional methods (bonus confidence)
            if !signature.optional_methods.is_empty() {
                let optional_matches = self.find_method_matches(concepts, &signature.optional_methods);
                evidence.extend(optional_matches.iter().map(|m| format!("Optional Method: {}", m)));
                
                if !optional_matches.is_empty() {
                    // Optional methods provide a confidence boost but aren't required
                    confidence_scores.push(0.15 * (optional_matches.len() as f64 / signature.optional_methods.len() as f64));
                }
            }
            
            // Check for class characteristics
            let class_matches = self.find_class_characteristic_matches(concepts, &signature.class_characteristics);
            evidence.extend(class_matches.iter().map(|c| format!("Characteristic: {}", c)));
            
            if !class_matches.is_empty() {
                confidence_scores.push(0.3 * (class_matches.len() as f64 / signature.class_characteristics.len() as f64));
            }
            
            // Check naming patterns
            let naming_matches = self.find_naming_pattern_matches(concepts, pattern_name);
            evidence.extend(naming_matches.iter().map(|n| format!("Naming: {}", n)));
            
            if !naming_matches.is_empty() {
                confidence_scores.push(0.3);
            }
            
            let total_confidence: f64 = confidence_scores.iter().sum();
            
            if total_confidence >= signature.confidence_threshold && !evidence.is_empty() {
                pattern_matches.push(PatternMatch {
                    pattern_name: pattern_name.clone(),
                    confidence: total_confidence,
                    evidence,
                    location: "multiple_concepts".to_string(),
                });
            }
        }
        
        Ok(pattern_matches)
    }

    /// Detect patterns in code using regex patterns
    fn detect_patterns_in_code(&self, code: &str, file_path: &str) -> Result<Vec<Pattern>, ParseError> {
        let mut detected_patterns = Vec::new();
        
        for (pattern_name, signature) in &self.pattern_signatures {
            let mut evidence = Vec::new();
            let mut confidence = 0.0;
            
            // Check code patterns using regex
            for code_pattern in &signature.code_patterns {
                if let Ok(regex) = Regex::new(code_pattern) {
                    let matches: Vec<_> = regex.find_iter(code).collect();
                    if !matches.is_empty() {
                        evidence.extend(matches.iter().map(|m| format!("Code pattern: {}", m.as_str())));
                        confidence += 0.2;
                    }
                }
            }
            
            // Check for method names in the code
            for method in &signature.required_methods {
                if code.contains(method) {
                    evidence.push(format!("Method found: {}", method));
                    confidence += 0.2;
                }
            }
            
            if confidence >= signature.confidence_threshold && !evidence.is_empty() {
                let examples = vec![PatternExample {
                    code: evidence.join(", "),
                    file_path: file_path.to_string(),
                    line_range: LineRange { start: 1, end: 1 },
                }];
                
                detected_patterns.push(Pattern {
                    id: format!("implementation_{}", pattern_name.to_lowercase()),
                    pattern_type: "implementation".to_string(),
                    description: format!("{} pattern detected in code", pattern_name),
                    frequency: evidence.len() as u32,
                    confidence,
                    examples,
                    contexts: vec!["code_analysis".to_string()],
                });
            }
        }
        
        Ok(detected_patterns)
    }

    /// Find method matches in concepts
    fn find_method_matches(&self, concepts: &[SemanticConcept], required_methods: &[String]) -> Vec<String> {
        let mut matches = Vec::new();
        
        for concept in concepts {
            if concept.concept_type == "method" || concept.concept_type == "function" {
                for required_method in required_methods {
                    if concept.name.to_lowercase().contains(&required_method.to_lowercase()) ||
                       self.is_method_variant(&concept.name, required_method) {
                        matches.push(concept.name.clone());
                        break;
                    }
                }
            }
        }
        
        matches
    }

    /// Find class characteristic matches
    fn find_class_characteristic_matches(&self, concepts: &[SemanticConcept], characteristics: &[String]) -> Vec<String> {
        let mut matches = Vec::new();
        
        for concept in concepts {
            for characteristic in characteristics {
                if concept.name.to_lowercase().contains(&characteristic.to_lowercase()) ||
                   concept.concept_type.to_lowercase().contains(&characteristic.to_lowercase()) ||
                   concept.metadata.values().any(|v| v.to_lowercase().contains(&characteristic.to_lowercase())) {
                    matches.push(characteristic.clone());
                }
            }
        }
        
        matches
    }

    /// Find naming pattern matches
    fn find_naming_pattern_matches(&self, concepts: &[SemanticConcept], pattern_name: &str) -> Vec<String> {
        let mut matches = Vec::new();
        let pattern_lower = pattern_name.to_lowercase();
        
        for concept in concepts {
            if concept.name.to_lowercase().contains(&pattern_lower) ||
               concept.file_path.to_lowercase().contains(&pattern_lower) {
                matches.push(concept.name.clone());
            }
        }
        
        matches
    }

    /// Check if a method name is a variant of a required method
    fn is_method_variant(&self, method_name: &str, required_method: &str) -> bool {
        let method_lower = method_name.to_lowercase();
        let required_lower = required_method.to_lowercase();
        
        // Check for common variants
        match required_lower.as_str() {
            "getinstance" => method_lower.contains("getinstance") || method_lower.contains("instance"),
            "create" => method_lower.contains("create") || method_lower.contains("new") || method_lower.contains("make"),
            "notify" => method_lower.contains("notify") || method_lower.contains("emit") || method_lower.contains("trigger"),
            "update" => method_lower.contains("update") || method_lower.contains("refresh") || method_lower.contains("change"),
            "build" => method_lower.contains("build") || method_lower.contains("construct") || method_lower.contains("assemble"),
            _ => method_lower.contains(&required_lower),
        }
    }

    /// Create examples for detected patterns
    fn create_examples_for_pattern(&self, pattern_match: &PatternMatch, concepts: &[SemanticConcept]) -> Vec<PatternExample> {
        let mut examples = Vec::new();
        
        // Find concepts that contributed to this pattern match
        for concept in concepts.iter().take(3) { // Limit to first 3 examples
            if concept.name.to_lowercase().contains(&pattern_match.pattern_name.to_lowercase()) ||
               pattern_match.evidence.iter().any(|e| e.contains(&concept.name)) {
                examples.push(PatternExample {
                    code: format!("{} {}", concept.concept_type, concept.name),
                    file_path: concept.file_path.clone(),
                    line_range: concept.line_range.clone(),
                });
            }
        }
        
        if examples.is_empty() {
            // Fallback example
            examples.push(PatternExample {
                code: pattern_match.evidence.first().cloned().unwrap_or_else(|| "Pattern detected".to_string()),
                file_path: pattern_match.location.clone(),
                line_range: LineRange { start: 1, end: 1 },
            });
        }
        
        examples
    }

    // Anti-pattern detection methods
    fn detect_god_object_antipattern(&self, concepts: &[SemanticConcept]) -> Vec<String> {
        let mut antipatterns = Vec::new();
        let mut class_method_counts: HashMap<String, usize> = HashMap::new();
        
        for concept in concepts {
            if concept.concept_type == "class" {
                let method_count = concepts.iter()
                    .filter(|c| c.concept_type == "method" && c.file_path == concept.file_path)
                    .count();
                class_method_counts.insert(concept.name.clone(), method_count);
                
                if method_count > 20 {
                    antipatterns.push(format!(
                        "God Object anti-pattern: Class '{}' has {} methods ({}:{})",
                        concept.name, method_count, concept.file_path, concept.line_range.start
                    ));
                }
            }
        }
        
        antipatterns
    }

    fn detect_spaghetti_code_antipattern(&self, concepts: &[SemanticConcept]) -> Vec<String> {
        let mut antipatterns = Vec::new();
        
        // Check for functions with too many dependencies
        for concept in concepts {
            if concept.concept_type == "function" || concept.concept_type == "method" {
                let dependency_count = concept.relationships.len();
                if dependency_count > 15 {
                    antipatterns.push(format!(
                        "Spaghetti Code: Function '{}' has {} dependencies ({}:{})",
                        concept.name, dependency_count, concept.file_path, concept.line_range.start
                    ));
                }
            }
        }
        
        antipatterns
    }

    fn detect_copy_paste_antipattern(&self, concepts: &[SemanticConcept]) -> Vec<String> {
        let mut antipatterns = Vec::new();
        let mut similar_names: HashMap<String, Vec<&SemanticConcept>> = HashMap::new();
        
        // Group concepts by similar names
        for concept in concepts {
            let name_base = self.extract_name_base(&concept.name);
            similar_names.entry(name_base).or_default().push(concept);
        }
        
        // Check for potential copy-paste patterns
        for (base_name, group) in similar_names {
            if group.len() > 3 && base_name.len() > 3 {
                let names: Vec<String> = group.iter().map(|c| c.name.clone()).collect();
                antipatterns.push(format!(
                    "Potential Copy-Paste: {} similar functions found: {}",
                    group.len(),
                    names.join(", ")
                ));
            }
        }
        
        antipatterns
    }

    fn detect_magic_number_antipattern(&self, concepts: &[SemanticConcept]) -> Vec<String> {
        let mut antipatterns = Vec::new();
        
        // This is a simplified check - in practice you'd analyze the actual code
        for concept in concepts {
            if concept.concept_type == "constant" {
                // Check if it's a meaningful constant name or just a number
                if concept.name.chars().all(|c| c.is_numeric() || c == '.' || c == '_') {
                    antipatterns.push(format!(
                        "Magic Number: Constant '{}' should have a descriptive name ({}:{})",
                        concept.name, concept.file_path, concept.line_range.start
                    ));
                }
            }
        }
        
        antipatterns
    }

    fn detect_long_parameter_list_antipattern(&self, concepts: &[SemanticConcept]) -> Vec<String> {
        let mut antipatterns = Vec::new();
        
        for concept in concepts {
            if concept.concept_type == "function" || concept.concept_type == "method" {
                if let Some(params) = concept.metadata.get("parameters") {
                    if let Ok(param_count) = params.parse::<usize>() {
                        if param_count > 5 {
                            antipatterns.push(format!(
                                "Long Parameter List: Function '{}' has {} parameters ({}:{})",
                                concept.name, param_count, concept.file_path, concept.line_range.start
                            ));
                        }
                    }
                }
            }
        }
        
        antipatterns
    }

    // Recommendation helper methods
    fn should_suggest_singleton(&self, concepts: &[SemanticConcept]) -> bool {
        // Check for global state or configuration management
        let has_global_state = concepts.iter().any(|c| 
            c.name.to_lowercase().contains("config") ||
            c.name.to_lowercase().contains("settings") ||
            c.name.to_lowercase().contains("global")
        );
        
        let has_singleton = self.patterns.contains_key("Singleton");
        has_global_state && !has_singleton
    }

    fn should_suggest_factory(&self, concepts: &[SemanticConcept]) -> bool {
        // Check for complex object creation
        let creation_complexity = concepts.iter()
            .filter(|c| c.concept_type == "constructor" || c.name.to_lowercase().contains("new"))
            .count();
            
        let has_factory = self.patterns.contains_key("Factory");
        creation_complexity > 3 && !has_factory
    }

    fn should_suggest_observer(&self, concepts: &[SemanticConcept]) -> bool {
        // Check for event handling patterns
        let has_events = concepts.iter().any(|c|
            c.name.to_lowercase().contains("event") ||
            c.name.to_lowercase().contains("listener") ||
            c.name.to_lowercase().contains("callback")
        );
        
        let has_observer = self.patterns.contains_key("Observer");
        has_events && !has_observer
    }

    fn should_suggest_strategy(&self, concepts: &[SemanticConcept]) -> bool {
        // Check for conditional complexity
        let has_complex_conditionals = concepts.iter().any(|c|
            c.metadata.get("body").is_some_and(|body|
                body.matches("if").count() > 5 || body.matches("switch").count() > 1
            )
        );
        
        let has_strategy = self.patterns.contains_key("Strategy");
        has_complex_conditionals && !has_strategy
    }

    fn should_suggest_dependency_injection(&self, concepts: &[SemanticConcept]) -> bool {
        // Check for tight coupling
        let high_coupling_count = concepts.iter()
            .filter(|c| c.relationships.len() > 8)
            .count();
            
        let has_di = self.patterns.contains_key("DependencyInjection");
        high_coupling_count > 2 && !has_di
    }

    /// Extract base name for similarity detection
    fn extract_name_base(&self, name: &str) -> String {
        // Remove common suffixes and prefixes
        let mut base = name.to_lowercase();
        
        // Remove numbers at the end
        while base.chars().last().is_some_and(|c| c.is_numeric()) {
            base.pop();
        }
        
        // Remove common suffixes
        for suffix in &["test", "impl", "service", "controller", "handler"] {
            if base.ends_with(suffix) {
                base = base[..base.len() - suffix.len()].to_string();
                break;
            }
        }
        
        base
    }
}

impl PatternExtractor for ImplementationPatternAnalyzer {
    fn extract_patterns(&self, path: &str) -> Result<Vec<Pattern>, ParseError> {
        let mut analyzer = self.clone();
        analyzer.analyze_code_files(path)
    }
}

impl Clone for ImplementationPatternAnalyzer {
    fn clone(&self) -> Self {
        ImplementationPatternAnalyzer {
            patterns: self.patterns.clone(),
            pattern_signatures: self.pattern_signatures.clone(),
        }
    }
}

impl Default for ImplementationPatternAnalyzer {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    fn create_test_concept(name: &str, concept_type: &str, file_path: &str) -> SemanticConcept {
        SemanticConcept {
            id: format!("test_{}", name),
            name: name.to_string(),
            concept_type: concept_type.to_string(),
            confidence: 0.8,
            file_path: file_path.to_string(),
            line_range: LineRange { start: 1, end: 10 },
            relationships: HashMap::new(),
            metadata: HashMap::new(),
        }
    }

    #[test]
    fn test_implementation_pattern_analyzer_creation() {
        let analyzer = ImplementationPatternAnalyzer::new();
        assert!(!analyzer.pattern_signatures.is_empty());
        assert!(analyzer.pattern_signatures.contains_key("Singleton"));
        assert!(analyzer.pattern_signatures.contains_key("Factory"));
        assert!(analyzer.pattern_signatures.contains_key("Observer"));
    }

    #[test]
    fn test_singleton_pattern_detection() {
        let mut analyzer = ImplementationPatternAnalyzer::new();
        let concepts = vec![
            create_test_concept("getInstance", "method", "Singleton.js"),
            create_test_concept("SingletonClass", "class", "Singleton.js"),
        ];

        let patterns = analyzer.analyze_concepts(&concepts).unwrap();
        let singleton_pattern = patterns.iter().find(|p| p.id.contains("singleton"));
        assert!(singleton_pattern.is_some());
        
        if let Some(pattern) = singleton_pattern {
            assert_eq!(pattern.pattern_type, "implementation");
            assert!(pattern.confidence > 0.0);
        }
    }

    #[test]
    fn test_factory_pattern_detection() {
        let mut analyzer = ImplementationPatternAnalyzer::new();
        let concepts = vec![
            create_test_concept("createUser", "method", "UserFactory.js"),
            create_test_concept("UserFactory", "class", "UserFactory.js"),
        ];

        let patterns = analyzer.analyze_concepts(&concepts).unwrap();
        let factory_pattern = patterns.iter().find(|p| p.id.contains("factory"));
        assert!(factory_pattern.is_some());
    }

    #[test]
    fn test_observer_pattern_detection() {
        let mut analyzer = ImplementationPatternAnalyzer::new();
        let concepts = vec![
            create_test_concept("notify", "method", "Observable.js"),
            create_test_concept("subscribe", "method", "Observable.js"),
            create_test_concept("update", "method", "Observer.js"),
        ];

        let patterns = analyzer.analyze_concepts(&concepts).unwrap();
        let observer_pattern = patterns.iter().find(|p| p.id.contains("observer"));
        assert!(observer_pattern.is_some());
    }

    #[test]
    fn test_builder_pattern_detection() {
        let mut analyzer = ImplementationPatternAnalyzer::new();
        let concepts = vec![
            create_test_concept("withName", "method", "UserBuilder.js"),
            create_test_concept("setAge", "method", "UserBuilder.js"),
            create_test_concept("build", "method", "UserBuilder.js"),
        ];

        let patterns = analyzer.analyze_concepts(&concepts).unwrap();
        let builder_pattern = patterns.iter().find(|p| p.id.contains("builder"));
        assert!(builder_pattern.is_some());
    }

    #[test]
    fn test_god_object_antipattern_detection() {
        let analyzer = ImplementationPatternAnalyzer::new();
        let mut concepts = vec![create_test_concept("GodClass", "class", "GodClass.js")];
        
        // Add many methods to simulate God Object
        for i in 0..25 {
            concepts.push(create_test_concept(&format!("method{}", i), "method", "GodClass.js"));
        }

        let antipatterns = analyzer.detect_god_object_antipattern(&concepts);
        assert!(!antipatterns.is_empty());
        assert!(antipatterns[0].contains("God Object"));
    }

    #[test]
    fn test_spaghetti_code_antipattern_detection() {
        let analyzer = ImplementationPatternAnalyzer::new();
        let mut concept = create_test_concept("complexFunction", "function", "test.js");
        
        // Add many dependencies to simulate spaghetti code
        for i in 0..20 {
            concept.relationships.insert(format!("depends_{}", i), format!("dependency{}", i));
        }
        
        let concepts = vec![concept];
        let antipatterns = analyzer.detect_spaghetti_code_antipattern(&concepts);
        assert!(!antipatterns.is_empty());
        assert!(antipatterns[0].contains("Spaghetti Code"));
    }

    #[test]
    fn test_copy_paste_antipattern_detection() {
        let analyzer = ImplementationPatternAnalyzer::new();
        let concepts = vec![
            create_test_concept("processUser1", "function", "test.js"),
            create_test_concept("processUser2", "function", "test.js"),
            create_test_concept("processUser3", "function", "test.js"),
            create_test_concept("processUser4", "function", "test.js"),
        ];

        let antipatterns = analyzer.detect_copy_paste_antipattern(&concepts);
        assert!(!antipatterns.is_empty());
        assert!(antipatterns[0].contains("Copy-Paste"));
    }

    #[test]
    fn test_long_parameter_list_detection() {
        let analyzer = ImplementationPatternAnalyzer::new();
        let mut concept = create_test_concept("complexFunction", "function", "test.js");
        concept.metadata.insert("parameters".to_string(), "8".to_string());
        
        let concepts = vec![concept];
        let antipatterns = analyzer.detect_long_parameter_list_antipattern(&concepts);
        assert!(!antipatterns.is_empty());
        assert!(antipatterns[0].contains("Long Parameter List"));
    }

    #[test]
    fn test_method_variant_detection() {
        let analyzer = ImplementationPatternAnalyzer::new();
        
        assert!(analyzer.is_method_variant("getInstance", "getinstance"));
        assert!(analyzer.is_method_variant("createUser", "create"));
        assert!(analyzer.is_method_variant("notifyAll", "notify"));
        assert!(analyzer.is_method_variant("updateState", "update"));
        assert!(analyzer.is_method_variant("buildObject", "build"));
        
        assert!(!analyzer.is_method_variant("randomMethod", "create"));
    }

    #[test]
    fn test_recommendation_generation() {
        let analyzer = ImplementationPatternAnalyzer::new();
        let concepts = vec![
            create_test_concept("GlobalConfig", "class", "config.js"),
            create_test_concept("addEventListener", "function", "events.js"),
        ];

        let recommendations = analyzer.generate_recommendations(&concepts);
        assert!(!recommendations.is_empty());
        
        // Should suggest Singleton for global state
        assert!(recommendations.iter().any(|r| r.contains("Singleton")));
    }

    #[test]
    fn test_name_base_extraction() {
        let analyzer = ImplementationPatternAnalyzer::new();
        
        assert_eq!(analyzer.extract_name_base("processUser1"), "processuser");
        assert_eq!(analyzer.extract_name_base("userServiceImpl"), "user");
        assert_eq!(analyzer.extract_name_base("handleEventTest"), "handleevent");
        assert_eq!(analyzer.extract_name_base("dataController"), "data");
    }

    #[test]
    fn test_pattern_confidence_calculation() {
        let mut analyzer = ImplementationPatternAnalyzer::new();
        let concepts = vec![
            create_test_concept("getInstance", "method", "Singleton.js"),
            create_test_concept("SingletonInstance", "field", "Singleton.js"),
        ];

        let patterns = analyzer.analyze_concepts(&concepts).unwrap();
        
        if let Some(pattern) = patterns.first() {
            assert!(pattern.confidence >= 0.5);
            assert!(pattern.confidence <= 1.0);
        }
    }

    #[test]
    fn test_multiple_pattern_detection() {
        let mut analyzer = ImplementationPatternAnalyzer::new();
        let concepts = vec![
            // Singleton pattern
            create_test_concept("getInstance", "method", "Singleton.js"),
            // Factory pattern
            create_test_concept("createUser", "method", "Factory.js"),
            // Observer pattern
            create_test_concept("notify", "method", "Observer.js"),
            create_test_concept("subscribe", "method", "Observer.js"),
        ];

        let patterns = analyzer.analyze_concepts(&concepts).unwrap();
        assert!(patterns.len() >= 2);
        
        let pattern_names: Vec<String> = patterns.iter().map(|p| p.id.clone()).collect();
        assert!(pattern_names.iter().any(|name| name.contains("singleton") || name.contains("factory") || name.contains("observer")));
    }
}