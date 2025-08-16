use napi_derive::napi;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[napi(object)]
pub struct Pattern {
    pub id: String,
    pub pattern_type: String,
    pub description: String,
    pub frequency: u32,
    pub confidence: f64,
    pub examples: Vec<PatternExample>,
    pub contexts: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[napi(object)]
pub struct PatternExample {
    pub code: String,
    pub file_path: String,
    pub line_range: LineRange,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[napi(object)]
pub struct LineRange {
    pub start: u32,
    pub end: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[napi(object)]
pub struct PatternAnalysisResult {
    pub detected: Vec<String>,
    pub violations: Vec<String>,
    pub recommendations: Vec<String>,
    pub learned: Option<Vec<Pattern>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[napi(object)]
pub struct ApproachPrediction {
    pub approach: String,
    pub confidence: f64,
    pub reasoning: String,
    pub patterns: Vec<String>,
    pub complexity: String,
}

#[napi]
pub struct PatternLearner {
    patterns: HashMap<String, Pattern>,
    naming_patterns: HashMap<String, NamingPattern>,
    structural_patterns: HashMap<String, StructuralPattern>,
    implementation_patterns: HashMap<String, ImplementationPattern>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct NamingPattern {
    pattern_type: String, // camelCase, PascalCase, snake_case, etc.
    frequency: u32,
    contexts: Vec<String>, // function, class, variable, constant
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct StructuralPattern {
    pattern_type: String, // MVC, layered, modular, etc.
    frequency: u32,
    characteristics: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ImplementationPattern {
    pattern_type: String, // singleton, factory, observer, etc.
    frequency: u32,
    code_signatures: Vec<String>,
}

#[napi]
impl PatternLearner {
    #[napi(constructor)]
    pub fn new() -> Self {
        PatternLearner {
            patterns: HashMap::new(),
            naming_patterns: HashMap::new(),
            structural_patterns: HashMap::new(),
            implementation_patterns: HashMap::new(),
        }
    }

    #[napi]
    pub async unsafe fn learn_from_codebase(&mut self, path: String) -> napi::Result<Vec<Pattern>> {
        let mut learned_patterns = Vec::new();

        // Learn different types of patterns
        learned_patterns.extend(self.learn_naming_patterns(&path).await?);
        learned_patterns.extend(self.learn_structural_patterns(&path).await?);
        learned_patterns.extend(self.learn_implementation_patterns(&path).await?);

        // Store learned patterns
        for pattern in &learned_patterns {
            self.patterns.insert(pattern.id.clone(), pattern.clone());
        }

        Ok(learned_patterns)
    }

    #[napi]
    pub async fn extract_patterns(&self, _path: String) -> napi::Result<Vec<Pattern>> {
        // Extract patterns from a specific path
        let mut patterns = Vec::new();

        // Analyze files in the path and extract patterns
        // This is a simplified implementation
        patterns.push(Pattern {
            id: format!("pattern_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis()),
            pattern_type: "naming_convention".to_string(),
            description: "Consistent camelCase usage for functions".to_string(),
            frequency: 15,
            confidence: 0.85,
            examples: vec![
                PatternExample {
                    code: "function calculateTotal() {}".to_string(),
                    file_path: "src/utils.ts".to_string(),
                    line_range: LineRange { start: 10, end: 10 },
                }
            ],
            contexts: vec!["typescript".to_string(), "function".to_string()],
        });

        Ok(patterns)
    }

    #[napi]
    pub async fn analyze_file_change(&self, change_data: String) -> napi::Result<PatternAnalysisResult> {
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

    #[napi]
    pub async fn find_relevant_patterns(
        &self,
        problem_description: String,
        current_file: Option<String>,
        selected_code: Option<String>,
    ) -> napi::Result<Vec<Pattern>> {
        let mut relevant_patterns = Vec::new();

        // Analyze problem description for keywords
        let keywords = self.extract_keywords(&problem_description);
        
        // Find patterns matching the context
        for pattern in self.patterns.values() {
            let relevance_score = self.calculate_pattern_relevance(
                pattern,
                &keywords,
                &current_file,
                &selected_code,
            );

            if relevance_score > 0.5 {
                relevant_patterns.push(pattern.clone());
            }
        }

        // Sort by relevance and confidence
        relevant_patterns.sort_by(|a, b| {
            let score_a = a.confidence * a.frequency as f64;
            let score_b = b.confidence * b.frequency as f64;
            score_b.partial_cmp(&score_a).unwrap_or(std::cmp::Ordering::Equal)
        });

        Ok(relevant_patterns.into_iter().take(5).collect())
    }

    #[napi]
    pub async fn predict_approach(
        &self,
        problem_description: String,
        context: HashMap<String, String>,
    ) -> napi::Result<ApproachPrediction> {
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
            patterns: relevant_patterns.into_iter().map(|p| p.pattern_type).collect(),
            complexity: complexity.to_string(),
        };

        Ok(prediction)
    }

    #[napi]
    pub async unsafe fn learn_from_analysis(&mut self, _analysis_data: String) -> napi::Result<bool> {
        // Learn from change analysis results
        // This would update pattern frequencies and discover new patterns
        Ok(true)
    }

    #[napi]
    pub async unsafe fn update_from_change(&mut self, _change_data: String) -> napi::Result<bool> {
        // Update patterns based on file changes
        Ok(true)
    }

    async fn learn_naming_patterns(&mut self, _path: &str) -> napi::Result<Vec<Pattern>> {
        // Analyze naming conventions in the codebase
        let mut patterns = Vec::new();

        // Example: Learn camelCase pattern for functions
        let pattern = Pattern {
            id: format!("pattern_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis()),
            pattern_type: "naming_camelCase_function".to_string(),
            description: "Functions use camelCase naming convention".to_string(),
            frequency: 25,
            confidence: 0.9,
            examples: vec![],
            contexts: vec!["function".to_string(), "typescript".to_string()],
        };

        patterns.push(pattern);
        Ok(patterns)
    }

    async fn learn_structural_patterns(&mut self, _path: &str) -> napi::Result<Vec<Pattern>> {
        // Analyze structural patterns in the codebase
        let mut patterns = Vec::new();

        // Example: Learn modular structure pattern
        let pattern = Pattern {
            id: format!("pattern_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis()),
            pattern_type: "structure_modular".to_string(),
            description: "Code organized in modular structure with clear separation".to_string(),
            frequency: 12,
            confidence: 0.75,
            examples: vec![],
            contexts: vec!["architecture".to_string()],
        };

        patterns.push(pattern);
        Ok(patterns)
    }

    async fn learn_implementation_patterns(&mut self, _path: &str) -> napi::Result<Vec<Pattern>> {
        // Analyze implementation patterns in the codebase
        let mut patterns = Vec::new();

        // Example: Learn factory pattern usage
        let pattern = Pattern {
            id: format!("pattern_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis()),
            pattern_type: "implementation_factory".to_string(),
            description: "Factory pattern used for object creation".to_string(),
            frequency: 8,
            confidence: 0.65,
            examples: vec![],
            contexts: vec!["design_pattern".to_string(), "typescript".to_string()],
        };

        patterns.push(pattern);
        Ok(patterns)
    }

    fn detect_patterns_in_change(&self, _change_data: &str) -> napi::Result<Vec<String>> {
        // Detect which patterns are present in the change
        Ok(vec!["naming_camelCase_function".to_string()])
    }

    fn detect_pattern_violations(&self, _change_data: &str) -> napi::Result<Vec<String>> {
        // Detect violations of established patterns
        Ok(vec![])
    }

    fn generate_recommendations(
        &self,
        _detected: &[String],
        _violations: &[String],
    ) -> napi::Result<Vec<String>> {
        // Generate recommendations based on detected patterns and violations
        Ok(vec!["Consider using consistent naming convention".to_string()])
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

        for pattern in self.patterns.values() {
            for keyword in keywords {
                if pattern.description.to_lowercase().contains(keyword) ||
                   pattern.pattern_type.to_lowercase().contains(keyword) {
                    matching_patterns.push(pattern.clone());
                    break;
                }
            }
        }

        matching_patterns
    }

    fn estimate_problem_complexity(
        &self,
        problem_description: &str,
        _context: &HashMap<String, String>,
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
            relevant_patterns.iter()
                .map(|p| p.confidence)
                .sum::<f64>() / relevant_patterns.len() as f64
        };

        let description = match complexity {
            ProblemComplexity::Low => "Use simple, direct implementation following established patterns",
            ProblemComplexity::Medium => "Break down into smaller components, apply relevant design patterns",
            ProblemComplexity::High => "Design comprehensive solution with multiple layers and patterns",
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

#[derive(Debug)]
enum ProblemComplexity {
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

struct GeneratedApproach {
    description: String,
    confidence: f64,
    reasoning: String,
}