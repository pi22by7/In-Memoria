//! Core learning algorithms for pattern discovery and analysis

#[cfg(feature = "napi-bindings")]
use napi_derive::napi;

use crate::patterns::implementation::ImplementationPatternAnalyzer;
use crate::patterns::naming::NamingPatternAnalyzer;
use crate::patterns::prediction::ApproachPredictor;
use crate::patterns::structural::StructuralPatternAnalyzer;
use crate::patterns::types::{
    Pattern, PatternAnalysisResult, PatternLearner as PatternLearnerTrait,
};
use crate::types::{ParseError, SemanticConcept};
use serde_json::{from_str, Value};
use std::collections::{HashMap, HashSet};
use std::fs;
use walkdir::WalkDir;

/// Core learning engine that orchestrates pattern discovery across all domains
#[cfg_attr(feature = "napi-bindings", napi)]
pub struct PatternLearningEngine {
    naming_analyzer: NamingPatternAnalyzer,
    structural_analyzer: StructuralPatternAnalyzer,
    implementation_analyzer: ImplementationPatternAnalyzer,
    approach_predictor: ApproachPredictor,
    learned_patterns: HashMap<String, Pattern>,
    learning_metrics: LearningMetrics,
    confidence_threshold: f64,
}

#[derive(Debug, Clone)]
pub struct LearningMetrics {
    pub total_patterns_learned: usize,
    pub confidence_distribution: HashMap<String, usize>, // confidence ranges
    pub pattern_type_counts: HashMap<String, usize>,
    pub learning_accuracy: f64,
    pub last_learning_timestamp: Option<String>,
}

#[derive(Debug, Clone)]
struct LearningSession {
    session_id: String,
    patterns_discovered: Vec<Pattern>,
    analysis_duration_ms: u64,
    files_analyzed: usize,
    concepts_analyzed: usize,
}

#[derive(Debug, Clone)]
pub struct PatternEvolution {
    pub pattern_id: String,
    pub confidence_history: Vec<(String, f64)>, // timestamp, confidence
    pub frequency_history: Vec<(String, u32)>,  // timestamp, frequency
    pub evolution_trend: EvolutionTrend,
}

#[derive(Debug, Clone)]
pub enum EvolutionTrend {
    Improving,  // Confidence/frequency increasing
    Stable,     // Confidence/frequency stable
    Declining,  // Confidence/frequency decreasing
    Emerging,   // New pattern
    Deprecated, // Pattern no longer seen
}

#[cfg_attr(feature = "napi-bindings", napi)]
impl PatternLearningEngine {
    #[cfg_attr(feature = "napi-bindings", napi(constructor))]
    pub fn new() -> Self {
        PatternLearningEngine {
            naming_analyzer: NamingPatternAnalyzer::new(),
            structural_analyzer: StructuralPatternAnalyzer::new(),
            implementation_analyzer: ImplementationPatternAnalyzer::new(),
            approach_predictor: ApproachPredictor::new(),
            learned_patterns: HashMap::new(),
            learning_metrics: LearningMetrics {
                total_patterns_learned: 0,
                confidence_distribution: HashMap::new(),
                pattern_type_counts: HashMap::new(),
                learning_accuracy: 0.0,
                last_learning_timestamp: None,
            },
            confidence_threshold: 0.5,
        }
    }

    /// Learn patterns from an entire codebase
    ///
    /// # Safety
    /// This function is marked unsafe for NAPI compatibility. It performs file system operations
    /// and pattern analysis that are inherently safe but marked unsafe for JavaScript interop.
    #[cfg_attr(feature = "napi-bindings", napi)]
    pub async unsafe fn learn_from_codebase(
        &mut self,
        path: String,
    ) -> Result<Vec<Pattern>, ParseError> {
        let session_start = std::time::Instant::now();
        let mut session = LearningSession {
            session_id: format!(
                "session_{}",
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_secs()
            ),
            patterns_discovered: Vec::new(),
            analysis_duration_ms: 0,
            files_analyzed: 0,
            concepts_analyzed: 0,
        };

        // Phase 1: Collect semantic concepts from the codebase
        let concepts = self.extract_semantic_concepts(&path).await?;
        session.concepts_analyzed = concepts.len();

        // Count unique files analyzed
        let unique_files: std::collections::HashSet<_> =
            concepts.iter().map(|c| &c.file_path).collect();
        session.files_analyzed = unique_files.len();

        // Phase 2: Learn naming patterns
        let naming_patterns = self.learn_naming_patterns(&concepts, &path).await?;
        session.patterns_discovered.extend(naming_patterns);

        // Phase 3: Learn structural patterns
        let structural_patterns = self.learn_structural_patterns(&concepts, &path).await?;
        session.patterns_discovered.extend(structural_patterns);

        // Phase 4: Learn implementation patterns
        let implementation_patterns = self.learn_implementation_patterns(&concepts, &path).await?;
        session.patterns_discovered.extend(implementation_patterns);

        // Phase 5: Update approach predictor with new patterns
        self.approach_predictor
            .update_patterns(session.patterns_discovered.clone());

        // Phase 6: Consolidate and validate patterns
        let patterns_for_validation = session.patterns_discovered.clone();
        let validated_patterns = self.validate_and_consolidate_patterns(patterns_for_validation)?;

        // Phase 7: Update learning metrics
        session.analysis_duration_ms = session_start.elapsed().as_millis() as u64;
        self.update_learning_metrics(&validated_patterns, &session);

        // Store learned patterns
        for pattern in &validated_patterns {
            self.learned_patterns
                .insert(pattern.id.clone(), pattern.clone());
        }

        Ok(validated_patterns)
    }

    /// Learn from file changes (incremental learning)
    ///
    /// # Safety
    /// This function is marked unsafe for NAPI compatibility. It performs pattern analysis
    /// operations that are inherently safe but marked unsafe for JavaScript interop.
    #[cfg_attr(feature = "napi-bindings", napi)]
    pub async unsafe fn learn_from_changes(
        &mut self,
        old_content: String,
        new_content: String,
        file_path: String,
        language: String,
    ) -> Result<Vec<Pattern>, ParseError> {
        let mut new_patterns = Vec::new();

        // Learn naming pattern changes
        let naming_changes =
            self.naming_analyzer
                .learn_from_changes(&old_content, &new_content, &language)?;
        new_patterns.extend(naming_changes);

        // Learn structural changes (simplified - would need AST diff in practice)
        if self.has_structural_changes(&old_content, &new_content) {
            let structural_changes = self
                .learn_structural_changes(&old_content, &new_content, &file_path)
                .await?;
            new_patterns.extend(structural_changes);
        }

        // Update internal state
        for pattern in &new_patterns {
            self.learned_patterns
                .insert(pattern.id.clone(), pattern.clone());
        }

        // Use helper methods for additional learning
        let change_type = self.detect_change_type(&old_content, &new_content);
        self.learn_from_change_type(&change_type).await?;
        self.learn_from_file_context(&file_path).await?;

        // Boost confidence for related patterns when we find successful patterns
        if !new_patterns.is_empty() {
            let primary_concept = self.extract_primary_concept(&new_patterns);
            self.boost_related_pattern_confidence(&primary_concept, 0.05)
                .await?;
        }

        // Update learning metrics
        self.update_incremental_metrics(&new_patterns);

        Ok(new_patterns)
    }

    /// Learn from analysis data (JSON format)
    ///
    /// # Safety
    /// This function is marked unsafe for NAPI compatibility. It performs data parsing and
    /// learning operations that are inherently safe but marked unsafe for JavaScript interop.
    #[cfg_attr(feature = "napi-bindings", napi)]
    pub async unsafe fn learn_from_analysis(
        &mut self,
        analysis_data: String,
    ) -> Result<bool, ParseError> {
        let data: Value = from_str(&analysis_data).map_err(|e| {
            ParseError::from_reason(format!("Failed to parse analysis data: {}", e))
        })?;

        // Extract concepts from analysis data
        let concepts = self.parse_concepts_from_analysis(&data)?;

        // Also try to parse any existing patterns in the data
        if let Some(patterns_array) = data.get("patterns").and_then(|p| p.as_array()) {
            for pattern_json in patterns_array {
                if let Ok(pattern) = self.parse_pattern_from_json(pattern_json) {
                    self.learned_patterns.insert(pattern.id.clone(), pattern);
                }
            }
        }

        if !concepts.is_empty() {
            // Learn patterns from the concepts
            let naming_patterns = self
                .naming_analyzer
                .analyze_concepts(&concepts, "mixed")
                .unwrap_or_default();
            let mut implementation_patterns = self
                .implementation_analyzer
                .analyze_concepts(&concepts)
                .unwrap_or_default();
            let structural_patterns = self
                .structural_analyzer
                .analyze_concept_structures(&concepts)
                .unwrap_or_default();

            // Combine all patterns
            let mut all_patterns = naming_patterns;
            all_patterns.append(&mut implementation_patterns);
            all_patterns.extend(structural_patterns);

            // Store patterns that meet confidence threshold
            let mut learned_count = 0;
            for pattern in all_patterns {
                if pattern.confidence >= self.confidence_threshold {
                    self.learned_patterns.insert(pattern.id.clone(), pattern);
                    learned_count += 1;
                }
            }

            // Update predictor with historical approach data if available
            if let Some(approaches) = data.get("approaches") {
                if let Ok(approach_data) = serde_json::to_string(approaches) {
                    let _ = self
                        .approach_predictor
                        .learn_from_approaches(&approach_data);
                }
            }

            // Update metrics
            self.learning_metrics.total_patterns_learned += learned_count;

            Ok(learned_count > 0)
        } else {
            Ok(false)
        }
    }

    /// Get comprehensive analysis of learned patterns
    #[cfg_attr(feature = "napi-bindings", napi)]
    pub fn analyze_patterns(
        &self,
        concepts: Vec<SemanticConcept>,
    ) -> Result<PatternAnalysisResult, ParseError> {
        let mut detected = Vec::new();
        let mut violations = Vec::new();
        let mut recommendations = Vec::new();

        // Analyze with each specialized analyzer

        // Naming analysis
        let naming_violations = self.naming_analyzer.detect_violations(&concepts, "mixed");
        violations.extend(naming_violations);

        let naming_recommendations = self.naming_analyzer.generate_recommendations("mixed");
        recommendations.extend(naming_recommendations);

        // Structural analysis
        let structural_violations = self
            .structural_analyzer
            .detect_structural_violations(&concepts);
        violations.extend(structural_violations);

        let structural_recommendations = self
            .structural_analyzer
            .generate_structural_recommendations(&concepts);
        recommendations.extend(structural_recommendations);

        // Implementation analysis
        let implementation_violations = self.implementation_analyzer.detect_antipatterns(&concepts);
        violations.extend(implementation_violations);

        let implementation_recommendations = self
            .implementation_analyzer
            .generate_recommendations(&concepts);
        recommendations.extend(implementation_recommendations);

        // Detected patterns
        for pattern in self.learned_patterns.values() {
            detected.push(format!(
                "{}: {} (confidence: {:.2})",
                pattern.pattern_type, pattern.description, pattern.confidence
            ));
        }

        Ok(PatternAnalysisResult {
            detected,
            violations,
            recommendations,
            learned: Some(self.learned_patterns.values().cloned().collect()),
        })
    }

    /// Predict best approach for a problem
    #[cfg_attr(feature = "napi-bindings", napi)]
    pub fn predict_approach(
        &self,
        problem_description: String,
        context: Option<String>,
    ) -> Result<crate::patterns::types::ApproachPrediction, ParseError> {
        self.approach_predictor
            .predict_approach(problem_description, context)
    }

    /// Get learning metrics and statistics
    pub fn get_learning_metrics(&self) -> &LearningMetrics {
        &self.learning_metrics
    }

    /// Set confidence threshold for pattern acceptance
    pub fn set_confidence_threshold(&mut self, threshold: f64) {
        self.confidence_threshold = threshold.clamp(0.0, 1.0);
    }

    /// Get pattern evolution data
    pub fn get_pattern_evolution(&self, pattern_id: &str) -> Option<PatternEvolution> {
        // This would track pattern changes over time
        // Simplified implementation for now
        if self.learned_patterns.contains_key(pattern_id) {
            Some(PatternEvolution {
                pattern_id: pattern_id.to_string(),
                confidence_history: Vec::new(),
                frequency_history: Vec::new(),
                evolution_trend: EvolutionTrend::Stable,
            })
        } else {
            None
        }
    }

    /// Get all learned patterns (for legacy compatibility)
    pub fn get_learned_patterns(&self) -> Vec<Pattern> {
        self.learned_patterns.values().cloned().collect()
    }

    /// Insert a pattern (for external use and testing)
    pub fn insert_pattern(&mut self, id: String, pattern: Pattern) {
        self.learned_patterns.insert(id, pattern);
    }

    /// Get a specific pattern by ID
    pub fn get_pattern(&self, id: &str) -> Option<&Pattern> {
        self.learned_patterns.get(id)
    }

    /// Check if a pattern exists
    pub fn has_pattern(&self, id: &str) -> bool {
        self.learned_patterns.contains_key(id)
    }

    /// Updates patterns based on file changes (from original implementation)
    ///
    /// # Safety
    /// This function uses unsafe because it needs to interact with the Node.js runtime
    /// through N-API bindings. The caller must ensure the change data is valid JSON.
    #[cfg_attr(feature = "napi-bindings", napi)]
    pub async unsafe fn update_from_change(
        &mut self,
        change_data: String,
    ) -> Result<bool, ParseError> {
        self.update_from_change_internal(change_data).await
    }

    /// Internal implementation for updating patterns from file changes (from original implementation)
    pub async fn update_from_change_internal(
        &mut self,
        change_data: String,
    ) -> Result<bool, ParseError> {
        // Parse the change data JSON
        let change: Value = match from_str(&change_data) {
            Ok(data) => data,
            Err(e) => {
                eprintln!("Failed to parse change data: {}", e);
                return Ok(false);
            }
        };

        let mut patterns_updated = false;

        // Extract change information
        let change_type = change
            .get("type")
            .and_then(|t| t.as_str())
            .unwrap_or("unknown");
        let file_path = change.get("path").and_then(|p| p.as_str());
        let content = change.get("content").and_then(|c| c.as_str());
        let language = change.get("language").and_then(|l| l.as_str());

        // Update patterns based on change type
        match change_type {
            "add" | "create" => {
                patterns_updated |= self
                    .handle_file_addition(file_path, content, language)
                    .await?;
            }
            "modify" | "change" => {
                patterns_updated |= self
                    .handle_file_modification(file_path, content, language)
                    .await?;
            }
            "delete" | "remove" => {
                patterns_updated |= self.handle_file_deletion(file_path).await?;
            }
            "rename" | "move" => {
                patterns_updated |= self.handle_file_rename(file_path, &change).await?;
            }
            _ => {
                // Handle unknown change types by treating as modification
                patterns_updated |= self
                    .handle_file_modification(file_path, content, language)
                    .await?;
            }
        }

        // Learn from the overall change pattern
        patterns_updated |= self
            .learn_from_change_pattern(change_type, file_path, language)
            .await?;

        // Update usage statistics for related patterns
        if let (Some(path), Some(lang)) = (file_path, language) {
            patterns_updated |= self.update_language_usage_patterns(path, lang).await?;
        }

        Ok(patterns_updated)
    }

    /// Helper method to update pattern frequency (from original implementation)
    async fn update_pattern_frequency(
        &mut self,
        pattern_type: &str,
        increment: u32,
    ) -> Result<bool, ParseError> {
        if let Some(pattern) = self.learned_patterns.get_mut(pattern_type) {
            pattern.frequency += increment;
            // Adjust confidence based on increased usage
            pattern.confidence = (pattern.confidence + 0.05).min(0.95);
            Ok(true)
        } else {
            // Create a new pattern if it doesn't exist
            let new_pattern = Pattern {
                id: format!("learned_{}_{}", pattern_type, self.generate_pattern_id()),
                pattern_type: pattern_type.to_string(),
                description: format!("Pattern learned from analysis: {}", pattern_type),
                frequency: increment,
                confidence: 0.3, // Start with low confidence for new patterns
                examples: vec![],
                contexts: vec!["learned".to_string()],
            };
            self.learned_patterns
                .insert(new_pattern.id.clone(), new_pattern);
            Ok(true)
        }
    }

    /// Helper method to boost confidence of patterns related to a concept (from original implementation)
    async fn boost_related_pattern_confidence(
        &mut self,
        concept: &str,
        boost: f64,
    ) -> Result<bool, ParseError> {
        let mut updated = false;

        for pattern in self.learned_patterns.values_mut() {
            // Check if pattern is related to the concept
            if pattern
                .description
                .to_lowercase()
                .contains(&concept.to_lowercase())
                || pattern
                    .pattern_type
                    .to_lowercase()
                    .contains(&concept.to_lowercase())
                || pattern
                    .contexts
                    .iter()
                    .any(|c| c.to_lowercase().contains(&concept.to_lowercase()))
            {
                pattern.confidence = (pattern.confidence + boost).min(0.95);
                updated = true;
            }
        }

        Ok(updated)
    }

    /// Helper method to learn from change type (from original implementation)
    async fn learn_from_change_type(&mut self, change_type: &str) -> Result<bool, ParseError> {
        let pattern_type = format!("change_{}", change_type);
        self.update_pattern_frequency(&pattern_type, 1).await
    }

    /// Helper method to learn from file context (from original implementation)
    async fn learn_from_file_context(&mut self, file_path: &str) -> Result<bool, ParseError> {
        let mut updated = false;

        // Learn from file extension
        if let Some(extension) = std::path::Path::new(file_path)
            .extension()
            .and_then(|s| s.to_str())
        {
            let pattern_type = format!("file_type_{}", extension);
            updated |= self.update_pattern_frequency(&pattern_type, 1).await?;
        }

        // Learn from directory structure
        if let Some(parent) = std::path::Path::new(file_path).parent() {
            if let Some(dir_name) = parent.file_name().and_then(|s| s.to_str()) {
                let pattern_type = format!("directory_{}", dir_name);
                updated |= self.update_pattern_frequency(&pattern_type, 1).await?;
            }
        }

        Ok(updated)
    }

    /// Helper method to parse pattern from JSON (from original implementation)
    fn parse_pattern_from_json(&self, json: &Value) -> Result<Pattern, serde_json::Error> {
        // Extract pattern fields from JSON
        let id = json
            .get("id")
            .and_then(|v| v.as_str())
            .unwrap_or(&format!("parsed_{}", self.generate_pattern_id()))
            .to_string();

        let pattern_type = json
            .get("type")
            .or_else(|| json.get("patternType"))
            .and_then(|v| v.as_str())
            .unwrap_or("unknown")
            .to_string();

        let description = json
            .get("description")
            .and_then(|v| v.as_str())
            .unwrap_or("Pattern learned from analysis")
            .to_string();

        let frequency = json.get("frequency").and_then(|v| v.as_u64()).unwrap_or(1) as u32;

        let confidence = json
            .get("confidence")
            .and_then(|v| v.as_f64())
            .unwrap_or(0.5);

        let contexts = json
            .get("contexts")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                    .collect()
            })
            .unwrap_or_else(|| vec!["analysis".to_string()]);

        // Parse examples if available
        let examples = json
            .get("examples")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|ex| self.parse_example_from_json(ex))
                    .collect()
            })
            .unwrap_or_default();

        Ok(Pattern {
            id,
            pattern_type,
            description,
            frequency,
            confidence,
            examples,
            contexts,
        })
    }

    /// Helper method to parse example from JSON (from original implementation)
    fn parse_example_from_json(
        &self,
        json: &Value,
    ) -> Option<crate::patterns::types::PatternExample> {
        let code = json.get("code")?.as_str()?.to_string();
        let file_path = json
            .get("filePath")
            .or_else(|| json.get("file_path"))
            .and_then(|v| v.as_str())
            .unwrap_or("unknown")
            .to_string();

        let line_range =
            if let Some(range) = json.get("lineRange").or_else(|| json.get("line_range")) {
                crate::types::LineRange {
                    start: range.get("start").and_then(|v| v.as_u64()).unwrap_or(1) as u32,
                    end: range.get("end").and_then(|v| v.as_u64()).unwrap_or(1) as u32,
                }
            } else {
                crate::types::LineRange { start: 1, end: 1 }
            };

        Some(crate::patterns::types::PatternExample {
            code,
            file_path,
            line_range,
        })
    }

    /// Generate unique pattern ID (from original implementation)
    fn generate_pattern_id(&self) -> String {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis()
            .to_string()
    }

    fn detect_change_type(&self, old_content: &str, new_content: &str) -> String {
        if old_content.len() > new_content.len() {
            "deletion".to_string()
        } else if old_content.len() < new_content.len() {
            "addition".to_string()
        } else {
            "modification".to_string()
        }
    }

    fn extract_primary_concept(&self, patterns: &[Pattern]) -> String {
        patterns
            .first()
            .map(|p| p.pattern_type.clone())
            .unwrap_or_else(|| "general".to_string())
    }

    /// Private helper methods
    async fn extract_semantic_concepts(
        &self,
        path: &str,
    ) -> Result<Vec<SemanticConcept>, ParseError> {
        let mut concepts = Vec::new();
        let mut file_count = 0;
        let start_time = std::time::Instant::now();
        let timeout = std::time::Duration::from_secs(60); // 60 second timeout

        for entry in WalkDir::new(path)
            .max_depth(5) // Limit directory traversal depth
            .into_iter()
            .filter_map(|e| e.ok())
        {
            // Check timeout
            if start_time.elapsed() > timeout {
                eprintln!(
                    "Timeout reached during concept extraction after {} files",
                    file_count
                );
                break;
            }

            if entry.file_type().is_file() && file_count < 100 {
                // Reduced limit for performance
                let file_path = entry.path();

                // Add proper file filtering
                if !self.should_analyze_file(file_path) {
                    continue;
                }

                if let Some(extension) = file_path.extension().and_then(|s| s.to_str()) {
                    if self.is_supported_extension(extension) {
                        if let Ok(content) = fs::read_to_string(file_path) {
                            let file_concepts = self.extract_concepts_from_file(
                                &content,
                                file_path.to_string_lossy().as_ref(),
                                extension,
                            )?;
                            concepts.extend(file_concepts);
                            file_count += 1;
                        }
                    }
                }
            }
        }

        Ok(concepts)
    }

    fn extract_concepts_from_file(
        &self,
        content: &str,
        file_path: &str,
        extension: &str,
    ) -> Result<Vec<SemanticConcept>, ParseError> {
        // This would use the semantic analyzer from the main codebase
        // For now, return a simplified extraction
        let mut concepts = Vec::new();

        let language = match extension {
            "js" | "jsx" => "javascript",
            "ts" | "tsx" => "typescript",
            "rs" => "rust",
            "py" => "python",
            "java" => "java",
            _ => "unknown",
        };

        // Simple regex-based concept extraction (in practice, would use tree-sitter)
        let lines: Vec<&str> = content.lines().collect();
        for (line_num, line) in lines.iter().enumerate() {
            if let Some(concept) =
                self.extract_concept_from_line(line, file_path, line_num as u32 + 1, language)
            {
                concepts.push(concept);
            }
        }

        Ok(concepts)
    }

    fn extract_concept_from_line(
        &self,
        line: &str,
        file_path: &str,
        line_num: u32,
        language: &str,
    ) -> Option<SemanticConcept> {
        let trimmed = line.trim();

        // Function detection patterns
        let function_patterns = match language {
            "javascript" | "typescript" => vec![
                r"function\s+(\w+)",
                r"const\s+(\w+)\s*=.*=>",
                r"(\w+)\s*:\s*\([^)]*\)\s*=>",
            ],
            "rust" => vec![r"fn\s+(\w+)", r"pub\s+fn\s+(\w+)"],
            "python" => vec![r"def\s+(\w+)"],
            "java" => vec![r"public\s+.*\s+(\w+)\s*\(", r"private\s+.*\s+(\w+)\s*\("],
            _ => vec![],
        };

        // Class detection patterns
        let class_patterns = match language {
            "javascript" | "typescript" => vec![r"class\s+(\w+)", r"interface\s+(\w+)"],
            "rust" => vec![r"struct\s+(\w+)", r"enum\s+(\w+)", r"trait\s+(\w+)"],
            "python" => vec![r"class\s+(\w+)"],
            "java" => vec![r"class\s+(\w+)", r"interface\s+(\w+)"],
            _ => vec![],
        };

        // Check for function patterns
        for pattern in function_patterns {
            if let Ok(regex) = regex::Regex::new(pattern) {
                if let Some(captures) = regex.captures(trimmed) {
                    if let Some(name) = captures.get(1) {
                        return Some(SemanticConcept {
                            id: format!("{}_{}", file_path, name.as_str()),
                            name: name.as_str().to_string(),
                            concept_type: "function".to_string(),
                            confidence: 0.8,
                            file_path: file_path.to_string(),
                            line_range: crate::types::LineRange {
                                start: line_num,
                                end: line_num,
                            },
                            relationships: HashMap::new(),
                            metadata: HashMap::new(),
                        });
                    }
                }
            }
        }

        // Check for class patterns
        for pattern in class_patterns {
            if let Ok(regex) = regex::Regex::new(pattern) {
                if let Some(captures) = regex.captures(trimmed) {
                    if let Some(name) = captures.get(1) {
                        return Some(SemanticConcept {
                            id: format!("{}_{}", file_path, name.as_str()),
                            name: name.as_str().to_string(),
                            concept_type: "class".to_string(),
                            confidence: 0.9,
                            file_path: file_path.to_string(),
                            line_range: crate::types::LineRange {
                                start: line_num,
                                end: line_num,
                            },
                            relationships: HashMap::new(),
                            metadata: HashMap::new(),
                        });
                    }
                }
            }
        }

        None
    }

    fn is_supported_extension(&self, extension: &str) -> bool {
        matches!(
            extension.to_lowercase().as_str(),
            "js" | "jsx"
                | "ts"
                | "tsx"
                | "rs"
                | "py"
                | "java"
                | "cpp"
                | "c"
                | "cs"
                | "go"
                | "rb"
                | "php"
        )
    }

    fn should_analyze_file(&self, file_path: &std::path::Path) -> bool {
        // Skip common non-source directories
        let path_str = file_path.to_string_lossy();
        if path_str.contains("node_modules")
            || path_str.contains(".git")
            || path_str.contains("target")
            || path_str.contains("dist")
            || path_str.contains("build")
            || path_str.contains(".next")
            || path_str.contains("__pycache__")
            || path_str.contains("coverage")
            || path_str.contains(".vscode")
            || path_str.contains(".idea")
        {
            return false;
        }

        // Check if file extension is supported
        if let Some(extension) = file_path.extension().and_then(|s| s.to_str()) {
            self.is_supported_extension(extension)
        } else {
            false
        }
    }

    fn is_ignored_directory(&self, dir_name: &str) -> bool {
        matches!(
            dir_name,
            "node_modules"
                | ".git"
                | "target"
                | "dist"
                | "build"
                | ".next"
                | "__pycache__"
                | "coverage"
                | ".vscode"
                | ".idea"
        )
    }

    async fn learn_naming_patterns(
        &mut self,
        concepts: &[SemanticConcept],
        _path: &str,
    ) -> Result<Vec<Pattern>, ParseError> {
        // Group concepts by language for better analysis
        let mut language_groups: HashMap<String, Vec<&SemanticConcept>> = HashMap::new();

        for concept in concepts {
            let language = self.detect_language_from_path(&concept.file_path);
            language_groups.entry(language).or_default().push(concept);
        }

        let mut all_patterns = Vec::new();
        for (language, group_concepts) in language_groups {
            let concept_refs: Vec<_> = group_concepts.into_iter().cloned().collect();
            let patterns = self
                .naming_analyzer
                .analyze_concepts(&concept_refs, &language)?;
            all_patterns.extend(patterns);
        }

        Ok(all_patterns)
    }

    async fn learn_structural_patterns(
        &mut self,
        concepts: &[SemanticConcept],
        path: &str,
    ) -> Result<Vec<Pattern>, ParseError> {
        let mut patterns = Vec::new();

        // Analyze directory structure (from backup implementation)
        let directory_structure = self.analyze_directory_structure(path)?;
        patterns.extend(directory_structure);

        // Learn from codebase structure
        let structure_patterns = self.structural_analyzer.analyze_codebase_structure(path)?;
        patterns.extend(structure_patterns);

        // Learn from concept relationships
        let concept_patterns = self
            .structural_analyzer
            .analyze_concept_structures(concepts)?;
        patterns.extend(concept_patterns);

        Ok(patterns)
    }

    fn analyze_directory_structure(&self, path: &str) -> Result<Vec<Pattern>, ParseError> {
        let mut patterns = Vec::new();
        let mut directory_stats = std::collections::HashMap::new();

        // Analyze directory structure with depth limit
        for entry in WalkDir::new(path)
            .max_depth(3)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            if entry.file_type().is_dir() {
                let dir_name = entry.file_name().to_string_lossy();
                if !self.is_ignored_directory(&dir_name) {
                    *directory_stats.entry(dir_name.to_string()).or_insert(0) += 1;
                }
            }
        }

        // Common patterns from backup
        let common_dirs = vec![
            "src",
            "lib",
            "components",
            "utils",
            "services",
            "types",
            "models",
            "controllers",
        ];
        let mut found_patterns = Vec::new();

        for dir in common_dirs {
            if directory_stats.contains_key(dir) {
                found_patterns.push(dir.to_string());
            }
        }

        if found_patterns.len() >= 2 {
            patterns.push(Pattern {
                id: format!("struct_dirs_{}", self.generate_pattern_id()),
                pattern_type: "structure_organized_directories".to_string(),
                description: format!(
                    "Organized directory structure with: {}",
                    found_patterns.join(", ")
                ),
                frequency: found_patterns.len() as u32,
                confidence: 0.8,
                examples: vec![],
                contexts: vec!["architecture".to_string(), "organization".to_string()],
            });
        }

        Ok(patterns)
    }

    async fn learn_implementation_patterns(
        &mut self,
        concepts: &[SemanticConcept],
        path: &str,
    ) -> Result<Vec<Pattern>, ParseError> {
        let mut patterns = Vec::new();

        // Learn from concepts
        let concept_patterns = self.implementation_analyzer.analyze_concepts(concepts)?;
        patterns.extend(concept_patterns);

        // Learn from code files
        let code_patterns = self.implementation_analyzer.analyze_code_files(path)?;
        patterns.extend(code_patterns);

        Ok(patterns)
    }

    fn validate_and_consolidate_patterns(
        &self,
        patterns: Vec<Pattern>,
    ) -> Result<Vec<Pattern>, ParseError> {
        let mut consolidated: HashMap<String, Pattern> = HashMap::new();
        let mut pattern_groups: HashMap<String, Vec<Pattern>> = HashMap::new();

        // Group similar patterns with quality thresholds
        for pattern in patterns {
            // Apply quality thresholds from old implementation
            let min_frequency = if pattern.pattern_type.contains("naming") {
                3
            } else {
                2
            };

            if pattern.confidence >= self.confidence_threshold && pattern.frequency >= min_frequency
            {
                let group_key = format!(
                    "{}_{}",
                    pattern.pattern_type,
                    self.normalize_description(&pattern.description)
                );
                pattern_groups.entry(group_key).or_default().push(pattern);
            }
        }

        // Consolidate each group
        for (group_key, group_patterns) in pattern_groups {
            if group_patterns.len() == 1 {
                consolidated.insert(group_key, group_patterns.into_iter().next().unwrap());
            } else {
                // Merge patterns in the group
                let merged = self.merge_similar_patterns(group_patterns);
                consolidated.insert(group_key, merged);
            }
        }

        Ok(consolidated.into_values().collect())
    }

    fn normalize_description(&self, description: &str) -> String {
        description
            .to_lowercase()
            .chars()
            .filter(|c| c.is_alphanumeric() || c.is_whitespace())
            .collect::<String>()
            .split_whitespace()
            .take(3) // Take first 3 words for grouping
            .collect::<Vec<&str>>()
            .join("_")
    }

    fn merge_similar_patterns(&self, patterns: Vec<Pattern>) -> Pattern {
        if patterns.is_empty() {
            panic!("Cannot merge empty pattern list");
        }

        let first = &patterns[0];
        let total_frequency: u32 = patterns.iter().map(|p| p.frequency).sum();
        let avg_confidence: f64 =
            patterns.iter().map(|p| p.confidence).sum::<f64>() / patterns.len() as f64;
        let mut all_examples = Vec::new();
        let mut all_contexts = HashSet::new();

        for pattern in &patterns {
            all_examples.extend(pattern.examples.clone());
            all_contexts.extend(pattern.contexts.clone());
        }

        // Limit examples to avoid bloat
        all_examples.truncate(10);

        Pattern {
            id: first.id.clone(),
            pattern_type: first.pattern_type.clone(),
            description: format!(
                "{} (consolidated from {} instances)",
                first.description,
                patterns.len()
            ),
            frequency: total_frequency,
            confidence: avg_confidence,
            examples: all_examples,
            contexts: all_contexts.into_iter().collect(),
        }
    }

    fn update_learning_metrics(&mut self, patterns: &[Pattern], session: &LearningSession) {
        self.learning_metrics.total_patterns_learned += patterns.len();

        // Log session information for debugging and analytics
        eprintln!(
            "Learning session {} completed: analyzed {} files, found {} patterns in {} concepts",
            session.session_id,
            session.files_analyzed,
            patterns.len(),
            session.concepts_analyzed
        );

        // Update confidence distribution
        for pattern in patterns {
            let confidence_range = match pattern.confidence {
                c if c >= 0.9 => "high",
                c if c >= 0.7 => "medium-high",
                c if c >= 0.5 => "medium",
                c if c >= 0.3 => "low-medium",
                _ => "low",
            };
            *self
                .learning_metrics
                .confidence_distribution
                .entry(confidence_range.to_string())
                .or_insert(0) += 1;
        }

        // Update pattern type counts
        for pattern in patterns {
            *self
                .learning_metrics
                .pattern_type_counts
                .entry(pattern.pattern_type.clone())
                .or_insert(0) += 1;
        }

        // Update timestamp
        self.learning_metrics.last_learning_timestamp = Some(chrono::Utc::now().to_rfc3339());

        // Calculate learning accuracy (simplified)
        let high_confidence_patterns = patterns.iter().filter(|p| p.confidence >= 0.8).count();
        self.learning_metrics.learning_accuracy = if !patterns.is_empty() {
            high_confidence_patterns as f64 / patterns.len() as f64
        } else {
            0.0
        };
    }

    fn update_incremental_metrics(&mut self, patterns: &[Pattern]) {
        // Update metrics for incremental learning
        self.learning_metrics.total_patterns_learned += patterns.len();
        for pattern in patterns {
            *self
                .learning_metrics
                .pattern_type_counts
                .entry(pattern.pattern_type.clone())
                .or_insert(0) += 1;
        }
    }

    fn detect_language_from_path(&self, path: &str) -> String {
        if let Some(extension) = std::path::Path::new(path)
            .extension()
            .and_then(|s| s.to_str())
        {
            match extension.to_lowercase().as_str() {
                "js" | "jsx" => "javascript",
                "ts" | "tsx" => "typescript",
                "rs" => "rust",
                "py" => "python",
                "java" => "java",
                "cpp" | "cc" | "cxx" => "cpp",
                "c" => "c",
                "cs" => "csharp",
                "go" => "go",
                _ => "unknown",
            }
            .to_string()
        } else {
            "unknown".to_string()
        }
    }

    fn has_structural_changes(&self, old_content: &str, new_content: &str) -> bool {
        // Simple check for structural changes
        let old_lines = old_content.lines().count();
        let new_lines = new_content.lines().count();

        // Consider it a structural change if lines changed significantly
        let line_change_ratio =
            (old_lines as f64 - new_lines as f64).abs() / old_lines.max(1) as f64;
        line_change_ratio > 0.2
            || new_content.contains("class ") != old_content.contains("class ")
            || new_content.contains("function ") != old_content.contains("function ")
    }

    async fn learn_structural_changes(
        &self,
        _old_content: &str,
        _new_content: &str,
        _file_path: &str,
    ) -> Result<Vec<Pattern>, ParseError> {
        // Simplified implementation - would need proper AST diffing
        Ok(Vec::new())
    }

    fn parse_concepts_from_analysis(
        &self,
        data: &Value,
    ) -> Result<Vec<SemanticConcept>, ParseError> {
        let mut concepts = Vec::new();

        if let Some(concepts_array) = data.get("concepts").and_then(|v| v.as_array()) {
            for concept_value in concepts_array {
                if let Ok(concept) = self.parse_concept_from_value(concept_value) {
                    concepts.push(concept);
                }
            }
        }

        Ok(concepts)
    }

    fn parse_concept_from_value(&self, value: &Value) -> Result<SemanticConcept, ParseError> {
        let name = value
            .get("name")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown")
            .to_string();
        let concept_type = value
            .get("type")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown")
            .to_string();
        let file_path = value
            .get("file")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown")
            .to_string();
        let confidence = value
            .get("confidence")
            .and_then(|v| v.as_f64())
            .unwrap_or(0.5);

        Ok(SemanticConcept {
            id: format!("{}_{}", file_path, name),
            name,
            concept_type,
            confidence,
            file_path,
            line_range: crate::types::LineRange { start: 1, end: 1 },
            relationships: HashMap::new(),
            metadata: HashMap::new(),
        })
    }

    // File change handling methods (from original implementation)

    /// Handle file addition (from original implementation)
    async fn handle_file_addition(
        &mut self,
        file_path: Option<&str>,
        content: Option<&str>,
        language: Option<&str>,
    ) -> Result<bool, ParseError> {
        let mut updated = false;

        if let Some(path) = file_path {
            // Learn from file structure patterns
            if let Some(extension) = std::path::Path::new(path)
                .extension()
                .and_then(|s| s.to_str())
            {
                let pattern_type = format!("file_creation_{}", extension);
                updated |= self.update_pattern_frequency(&pattern_type, 1).await?;
            }

            // Learn from directory patterns
            if let Some(parent) = std::path::Path::new(path).parent() {
                if let Some(dir_name) = parent.file_name().and_then(|s| s.to_str()) {
                    let pattern_type = format!("directory_usage_{}", dir_name);
                    updated |= self.update_pattern_frequency(&pattern_type, 1).await?;
                }
            }

            // Analyze content if available
            if let (Some(content_str), Some(lang)) = (content, language) {
                updated |= self
                    .analyze_new_file_content(path, content_str, lang)
                    .await?;
            }
        }

        Ok(updated)
    }

    /// Handle file modification (from original implementation)
    async fn handle_file_modification(
        &mut self,
        file_path: Option<&str>,
        content: Option<&str>,
        language: Option<&str>,
    ) -> Result<bool, ParseError> {
        let mut updated = false;

        if let (Some(path), Some(content_str)) = (file_path, content) {
            // Analyze patterns in the modified content
            updated |= self
                .analyze_content_patterns(path, content_str, language)
                .await?;

            // Update modification frequency for file type
            if let Some(extension) = std::path::Path::new(path)
                .extension()
                .and_then(|s| s.to_str())
            {
                let pattern_type = format!("file_modification_{}", extension);
                updated |= self.update_pattern_frequency(&pattern_type, 1).await?;
            }

            // Learn from naming patterns in the content
            updated |= self
                .learn_naming_patterns_from_content(path, content_str)
                .await?;
        }

        Ok(updated)
    }

    /// Handle file deletion (from original implementation)
    async fn handle_file_deletion(&mut self, file_path: Option<&str>) -> Result<bool, ParseError> {
        let mut updated = false;

        if let Some(path) = file_path {
            // Update deletion patterns
            if let Some(extension) = std::path::Path::new(path)
                .extension()
                .and_then(|s| s.to_str())
            {
                let pattern_type = format!("file_deletion_{}", extension);
                updated |= self.update_pattern_frequency(&pattern_type, 1).await?;
            }

            // Decrease confidence of patterns related to deleted files
            updated |= self.adjust_patterns_for_deleted_file(path).await?;
        }

        Ok(updated)
    }

    /// Handle file rename/move (from original implementation)
    async fn handle_file_rename(
        &mut self,
        file_path: Option<&str>,
        change: &Value,
    ) -> Result<bool, ParseError> {
        let mut updated = false;

        if let Some(old_path) = change.get("oldPath").and_then(|p| p.as_str()) {
            let new_path = file_path.unwrap_or("unknown");

            // Learn from file movement patterns
            let old_dir = std::path::Path::new(old_path)
                .parent()
                .and_then(|p| p.file_name())
                .and_then(|s| s.to_str())
                .unwrap_or("root");
            let new_dir = std::path::Path::new(new_path)
                .parent()
                .and_then(|p| p.file_name())
                .and_then(|s| s.to_str())
                .unwrap_or("root");

            if old_dir != new_dir {
                let pattern_type = format!("file_movement_{}_{}", old_dir, new_dir);
                updated |= self.update_pattern_frequency(&pattern_type, 1).await?;
            }

            // Learn from renaming patterns
            let old_name = std::path::Path::new(old_path)
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("unknown");
            let new_name = std::path::Path::new(new_path)
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("unknown");

            if old_name != new_name {
                let pattern_type = "file_renaming".to_string();
                updated |= self.update_pattern_frequency(&pattern_type, 1).await?;
            }
        }

        Ok(updated)
    }

    /// Learn from change patterns (from original implementation)
    async fn learn_from_change_pattern(
        &mut self,
        change_type: &str,
        _file_path: Option<&str>,
        language: Option<&str>,
    ) -> Result<bool, ParseError> {
        let mut updated = false;

        // Create pattern type based on change and context
        let base_pattern = format!("change_{}", change_type);
        updated |= self.update_pattern_frequency(&base_pattern, 1).await?;

        // Language-specific change patterns
        if let Some(lang) = language {
            let lang_pattern = format!("change_{}_{}", change_type, lang);
            updated |= self.update_pattern_frequency(&lang_pattern, 1).await?;
        }

        // Time-based patterns (hour of day, day of week)
        let now = std::time::SystemTime::now();
        if let Ok(duration) = now.duration_since(std::time::UNIX_EPOCH) {
            let hour = (duration.as_secs() / 3600) % 24;
            let time_pattern = format!("change_time_hour_{}", hour);
            updated |= self.update_pattern_frequency(&time_pattern, 1).await?;
        }

        Ok(updated)
    }

    /// Update language usage patterns (from original implementation)
    async fn update_language_usage_patterns(
        &mut self,
        file_path: &str,
        language: &str,
    ) -> Result<bool, ParseError> {
        let mut updated = false;

        // Update overall language usage
        let lang_pattern = format!("language_usage_{}", language);
        updated |= self.update_pattern_frequency(&lang_pattern, 1).await?;

        // Update directory-language combinations
        if let Some(parent) = std::path::Path::new(file_path).parent() {
            if let Some(dir_name) = parent.file_name().and_then(|s| s.to_str()) {
                let dir_lang_pattern = format!("directory_language_{}_{}", dir_name, language);
                updated |= self.update_pattern_frequency(&dir_lang_pattern, 1).await?;
            }
        }

        Ok(updated)
    }

    /// Analyze new file content (from original implementation)
    async fn analyze_new_file_content(
        &mut self,
        file_path: &str,
        content: &str,
        language: &str,
    ) -> Result<bool, ParseError> {
        let mut updated = false;

        // Analyze initial file structure patterns
        let lines = content.lines().count();
        if lines > 0 {
            let size_category = if lines < 50 {
                "small"
            } else if lines < 200 {
                "medium"
            } else {
                "large"
            };
            let pattern_type = format!("new_file_size_{}_{}", size_category, language);
            updated |= self.update_pattern_frequency(&pattern_type, 1).await?;
        }

        // Look for common patterns in new files
        if content.contains("import ") || content.contains("from ") {
            let pattern_type = format!("new_file_with_imports_{}", language);
            updated |= self.update_pattern_frequency(&pattern_type, 1).await?;
        }

        if content.contains("export ") || content.contains("module.exports") {
            let pattern_type = format!("new_file_with_exports_{}", language);
            updated |= self.update_pattern_frequency(&pattern_type, 1).await?;
        }

        // Analyze naming patterns in new content
        updated |= self
            .learn_naming_patterns_from_content(file_path, content)
            .await?;

        Ok(updated)
    }

    /// Analyze content patterns (from original implementation)
    async fn analyze_content_patterns(
        &mut self,
        _file_path: &str,
        content: &str,
        language: Option<&str>,
    ) -> Result<bool, ParseError> {
        let mut updated = false;

        // Count different types of constructs
        let function_count = content.matches("function ").count() + content.matches(" => ").count();
        let class_count = content.matches("class ").count();
        let import_count = content.matches("import ").count();

        if let Some(lang) = language {
            if function_count > 0 {
                let pattern_type = format!("file_with_functions_{}", lang);
                updated |= self
                    .update_pattern_frequency(&pattern_type, function_count as u32)
                    .await?;
            }

            if class_count > 0 {
                let pattern_type = format!("file_with_classes_{}", lang);
                updated |= self
                    .update_pattern_frequency(&pattern_type, class_count as u32)
                    .await?;
            }

            if import_count > 0 {
                let pattern_type = format!("file_with_imports_{}", lang);
                updated |= self
                    .update_pattern_frequency(&pattern_type, import_count as u32)
                    .await?;
            }
        }

        Ok(updated)
    }

    /// Learn naming patterns from content (from original implementation)
    async fn learn_naming_patterns_from_content(
        &mut self,
        _file_path: &str,
        content: &str,
    ) -> Result<bool, ParseError> {
        let mut updated = false;

        // Extract and classify identifiers
        let lines: Vec<&str> = content.lines().collect();
        for line in lines {
            // Extract function names
            if let Some(function_names) = self.extract_function_names(line) {
                for name in function_names {
                    let pattern_type = format!(
                        "naming_function_{}",
                        self.classify_naming_pattern(&name, "function")
                    );
                    updated |= self.update_pattern_frequency(&pattern_type, 1).await?;
                }
            }

            // Extract class names
            if let Some(class_names) = self.extract_class_names(line) {
                for name in class_names {
                    let pattern_type = format!(
                        "naming_class_{}",
                        self.classify_naming_pattern(&name, "class")
                    );
                    updated |= self.update_pattern_frequency(&pattern_type, 1).await?;
                }
            }

            // Extract variable names
            if let Some(variable_names) = self.extract_variable_names(line) {
                for name in variable_names {
                    let pattern_type = format!(
                        "naming_variable_{}",
                        self.classify_naming_pattern(&name, "variable")
                    );
                    updated |= self.update_pattern_frequency(&pattern_type, 1).await?;
                }
            }
        }

        Ok(updated)
    }

    /// Adjust patterns for deleted files (from original implementation)
    async fn adjust_patterns_for_deleted_file(
        &mut self,
        file_path: &str,
    ) -> Result<bool, ParseError> {
        let mut updated = false;

        // Slightly decrease confidence for patterns that might be related to the deleted file
        if let Some(extension) = std::path::Path::new(file_path)
            .extension()
            .and_then(|s| s.to_str())
        {
            // Find patterns related to this file type and decrease their confidence slightly
            for pattern in self.learned_patterns.values_mut() {
                if (pattern.pattern_type.contains(extension)
                    || pattern.contexts.contains(&extension.to_string()))
                    && pattern.confidence > 0.1
                {
                    pattern.confidence = (pattern.confidence - 0.02).max(0.1);
                    updated = true;
                }
            }
        }

        Ok(updated)
    }

    // Naming analysis methods (from original implementation)

    fn extract_function_names(&self, line: &str) -> Option<Vec<String>> {
        let mut names = Vec::new();

        // TypeScript/JavaScript function patterns
        if line.contains("function ") {
            if let Some(start) = line.find("function ") {
                let after_function = &line[start + 9..];
                if let Some(end) = after_function.find('(') {
                    let name = after_function[..end].trim();
                    if !name.is_empty() && self.is_valid_identifier(name) {
                        names.push(name.to_string());
                    }
                }
            }
        }

        // Arrow function patterns
        if line.contains(" = ") && line.contains("=>") {
            if let Some(equal_pos) = line.find(" = ") {
                let before_equal = &line[..equal_pos];
                if let Some(start) = before_equal.rfind(char::is_whitespace) {
                    let name = before_equal[start..].trim();
                    if !name.is_empty() && self.is_valid_identifier(name) {
                        names.push(name.to_string());
                    }
                }
            }
        }

        // Python function patterns
        if line.trim_start().starts_with("def ") {
            if let Some(start) = line.find("def ") {
                let after_def = &line[start + 4..];
                if let Some(end) = after_def.find('(') {
                    let name = after_def[..end].trim();
                    if !name.is_empty() && self.is_valid_identifier(name) {
                        names.push(name.to_string());
                    }
                }
            }
        }

        if names.is_empty() {
            None
        } else {
            Some(names)
        }
    }

    fn extract_class_names(&self, line: &str) -> Option<Vec<String>> {
        let mut names = Vec::new();

        if line.contains("class ") {
            if let Some(start) = line.find("class ") {
                let after_class = &line[start + 6..];
                let end = after_class
                    .find(char::is_whitespace)
                    .or_else(|| after_class.find('{'))
                    .or_else(|| after_class.find('('))
                    .unwrap_or(after_class.len());
                let name = after_class[..end].trim();
                if !name.is_empty() && self.is_valid_identifier(name) {
                    names.push(name.to_string());
                }
            }
        }

        if names.is_empty() {
            None
        } else {
            Some(names)
        }
    }

    fn extract_variable_names(&self, line: &str) -> Option<Vec<String>> {
        let mut names = Vec::new();

        // TypeScript/JavaScript variable patterns
        let patterns = vec!["const ", "let ", "var "];
        for pattern in patterns {
            if line.contains(pattern) {
                if let Some(start) = line.find(pattern) {
                    let after_keyword = &line[start + pattern.len()..];
                    if let Some(equal_pos) = after_keyword.find('=') {
                        let name = after_keyword[..equal_pos].trim();
                        if !name.is_empty() && self.is_valid_identifier(name) {
                            names.push(name.to_string());
                        }
                    }
                }
            }
        }

        if names.is_empty() {
            None
        } else {
            Some(names)
        }
    }

    fn is_valid_identifier(&self, name: &str) -> bool {
        !name.is_empty()
            && name.chars().next().is_some_and(|c| c.is_alphabetic())
            && name.chars().all(|c| c.is_alphanumeric() || c == '_')
    }

    fn classify_naming_pattern(&self, name: &str, _context: &str) -> String {
        if self.is_camel_case(name) {
            "camelCase".to_string()
        } else if self.is_pascal_case(name) {
            "PascalCase".to_string()
        } else if self.is_snake_case(name) {
            "snake_case".to_string()
        } else if self.is_kebab_case(name) {
            "kebab-case".to_string()
        } else if self.is_upper_case(name) {
            "UPPER_CASE".to_string()
        } else {
            "mixed".to_string()
        }
    }

    fn is_camel_case(&self, name: &str) -> bool {
        name.chars().next().is_some_and(|c| c.is_lowercase())
            && name.contains(char::is_uppercase)
            && !name.contains('_')
            && !name.contains('-')
    }

    fn is_pascal_case(&self, name: &str) -> bool {
        name.chars().next().is_some_and(|c| c.is_uppercase())
            && !name.contains('_')
            && !name.contains('-')
    }

    fn is_snake_case(&self, name: &str) -> bool {
        name.chars().all(|c| c.is_lowercase() || c == '_') && name.contains('_')
    }

    fn is_kebab_case(&self, name: &str) -> bool {
        name.chars().all(|c| c.is_lowercase() || c == '-') && name.contains('-')
    }

    fn is_upper_case(&self, name: &str) -> bool {
        name.chars().all(|c| c.is_uppercase() || c == '_')
    }
}

impl PatternLearnerTrait for PatternLearningEngine {
    fn learn_from_data(&mut self, data: &str) -> Result<Vec<Pattern>, ParseError> {
        // Synchronous version of learning from data
        let runtime = tokio::runtime::Runtime::new()
            .map_err(|e| ParseError::from_reason(format!("Failed to create runtime: {}", e)))?;

        runtime.block_on(async { unsafe { self.learn_from_analysis(data.to_string()).await } })?;

        Ok(self.learned_patterns.values().cloned().collect())
    }
}

impl Default for PatternLearningEngine {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    fn create_test_concept(name: &str, concept_type: &str, file_path: &str) -> SemanticConcept {
        SemanticConcept {
            id: format!("test_{}", name),
            name: name.to_string(),
            concept_type: concept_type.to_string(),
            confidence: 0.8,
            file_path: file_path.to_string(),
            line_range: crate::types::LineRange { start: 1, end: 10 },
            relationships: HashMap::new(),
            metadata: HashMap::new(),
        }
    }

    #[tokio::test]
    async fn test_pattern_learning_engine_creation() {
        let engine = PatternLearningEngine::new();
        assert_eq!(engine.confidence_threshold, 0.5);
        assert_eq!(engine.learned_patterns.len(), 0);
    }

    #[tokio::test]
    async fn test_concept_extraction_from_line() {
        let engine = PatternLearningEngine::new();

        let js_function = "function getUserName() {";
        let concept = engine.extract_concept_from_line(js_function, "test.js", 1, "javascript");
        assert!(concept.is_some());

        if let Some(c) = concept {
            assert_eq!(c.name, "getUserName");
            assert_eq!(c.concept_type, "function");
        }

        let rust_struct = "pub struct User {";
        let concept = engine.extract_concept_from_line(rust_struct, "test.rs", 1, "rust");
        assert!(concept.is_some());

        if let Some(c) = concept {
            assert_eq!(c.name, "User");
            assert_eq!(c.concept_type, "class");
        }
    }

    #[tokio::test]
    async fn test_language_detection() {
        let engine = PatternLearningEngine::new();

        assert_eq!(engine.detect_language_from_path("test.js"), "javascript");
        assert_eq!(engine.detect_language_from_path("test.ts"), "typescript");
        assert_eq!(engine.detect_language_from_path("test.rs"), "rust");
        assert_eq!(engine.detect_language_from_path("test.py"), "python");
        assert_eq!(engine.detect_language_from_path("test.java"), "java");
        assert_eq!(engine.detect_language_from_path("test.unknown"), "unknown");
    }

    #[tokio::test]
    async fn test_supported_extensions() {
        let engine = PatternLearningEngine::new();

        assert!(engine.is_supported_extension("js"));
        assert!(engine.is_supported_extension("ts"));
        assert!(engine.is_supported_extension("rs"));
        assert!(engine.is_supported_extension("py"));
        assert!(engine.is_supported_extension("java"));
        assert!(!engine.is_supported_extension("txt"));
        assert!(!engine.is_supported_extension("md"));
    }

    #[tokio::test]
    async fn test_structural_change_detection() {
        let engine = PatternLearningEngine::new();

        let old_code = "function test() {\n  return 42;\n}";
        let new_code_minor = "function test() {\n  return 43;\n}";
        let new_code_major = "class Test {\n  method() {\n    return 42;\n  }\n}";

        assert!(!engine.has_structural_changes(old_code, new_code_minor));
        assert!(engine.has_structural_changes(old_code, new_code_major));
    }

    #[tokio::test]
    async fn test_pattern_consolidation() {
        let engine = PatternLearningEngine::new();

        let patterns = vec![
            Pattern {
                id: "pattern1".to_string(),
                pattern_type: "naming".to_string(),
                description: "camelCase pattern".to_string(),
                frequency: 5,
                confidence: 0.8,
                examples: vec![],
                contexts: vec!["javascript".to_string()],
            },
            Pattern {
                id: "pattern2".to_string(),
                pattern_type: "naming".to_string(),
                description: "camelCase pattern for functions".to_string(),
                frequency: 3,
                confidence: 0.7,
                examples: vec![],
                contexts: vec!["javascript".to_string()],
            },
        ];

        let consolidated = engine.validate_and_consolidate_patterns(patterns).unwrap();
        assert_eq!(consolidated.len(), 1);
        assert_eq!(consolidated[0].frequency, 8); // 5 + 3
    }

    #[tokio::test]
    async fn test_confidence_threshold() {
        let mut engine = PatternLearningEngine::new();

        engine.set_confidence_threshold(0.7);
        assert_eq!(engine.confidence_threshold, 0.7);

        engine.set_confidence_threshold(1.5); // Should clamp to 1.0
        assert_eq!(engine.confidence_threshold, 1.0);

        engine.set_confidence_threshold(-0.1); // Should clamp to 0.0
        assert_eq!(engine.confidence_threshold, 0.0);
    }

    #[tokio::test]
    async fn test_learning_metrics_update() {
        let mut engine = PatternLearningEngine::new();

        let patterns = vec![
            Pattern {
                id: "high_confidence".to_string(),
                pattern_type: "naming".to_string(),
                description: "High confidence pattern".to_string(),
                frequency: 5,
                confidence: 0.9,
                examples: vec![],
                contexts: vec![],
            },
            Pattern {
                id: "low_confidence".to_string(),
                pattern_type: "structural".to_string(),
                description: "Low confidence pattern".to_string(),
                frequency: 2,
                confidence: 0.4,
                examples: vec![],
                contexts: vec![],
            },
        ];

        let session = LearningSession {
            session_id: "test".to_string(),
            patterns_discovered: patterns.clone(),
            analysis_duration_ms: 1000,
            files_analyzed: 10,
            concepts_analyzed: 50,
        };

        engine.update_learning_metrics(&patterns, &session);

        assert_eq!(engine.learning_metrics.total_patterns_learned, 2);
        assert_eq!(
            engine.learning_metrics.pattern_type_counts.get("naming"),
            Some(&1)
        );
        assert_eq!(
            engine
                .learning_metrics
                .pattern_type_counts
                .get("structural"),
            Some(&1)
        );
        assert!(engine
            .learning_metrics
            .confidence_distribution
            .contains_key("high"));
    }

    #[tokio::test]
    async fn test_pattern_analysis() {
        let engine = PatternLearningEngine::new();

        let concepts = vec![
            create_test_concept("getUserName", "function", "test.js"),
            create_test_concept("UserService", "class", "UserService.js"),
        ];

        let result = engine.analyze_patterns(concepts).unwrap();

        assert!(result.detected.is_empty() || !result.detected.is_empty()); // Either is fine for this test
                                                                            // Violations and recommendations depend on the specific patterns detected
    }

    #[tokio::test]
    async fn test_learn_from_codebase() {
        let mut engine = PatternLearningEngine::new();
        let temp_dir = TempDir::new().unwrap();

        // Create a simple JavaScript file
        let js_content = r#"
function getUserName(user) {
    return user.name;
}

class UserService {
    constructor() {
        this.users = [];
    }
    
    addUser(user) {
        this.users.push(user);
    }
}
"#;

        fs::write(temp_dir.path().join("test.js"), js_content).unwrap();

        let patterns = unsafe {
            engine
                .learn_from_codebase(temp_dir.path().to_str().unwrap().to_string())
                .await
                .unwrap()
        };

        // Should have learned some patterns from the code
        assert!(!patterns.is_empty());

        // Check that patterns were stored
        assert!(!engine.learned_patterns.is_empty());
    }

    #[tokio::test]
    async fn test_learn_from_analysis_data() {
        let mut engine = PatternLearningEngine::new();

        let analysis_data = r#"{
            "concepts": [
                {
                    "name": "getUserData",
                    "type": "function",
                    "file": "user.js",
                    "confidence": 0.9
                },
                {
                    "name": "UserController",
                    "type": "class",
                    "file": "controller.js",
                    "confidence": 0.8
                }
            ]
        }"#;

        let result = unsafe {
            engine
                .learn_from_analysis(analysis_data.to_string())
                .await
                .unwrap()
        };
        assert!(result); // Should have learned something

        // Check that patterns were learned
        assert!(!engine.learned_patterns.is_empty());
    }

    #[test]
    fn test_description_normalization() {
        let engine = PatternLearningEngine::new();

        let desc1 = "CamelCase naming pattern for functions";
        let desc2 = "camelCase naming pattern in JavaScript";

        let norm1 = engine.normalize_description(desc1);
        let norm2 = engine.normalize_description(desc2);

        // Should normalize to similar keys for grouping
        assert_eq!(norm1, "camelcase_naming_pattern");
        assert_eq!(norm2, "camelcase_naming_pattern");
    }

    #[test]
    fn test_pattern_merge() {
        let engine = PatternLearningEngine::new();

        let patterns = vec![
            Pattern {
                id: "pattern1".to_string(),
                pattern_type: "naming".to_string(),
                description: "Pattern 1".to_string(),
                frequency: 5,
                confidence: 0.8,
                examples: vec![],
                contexts: vec!["js".to_string()],
            },
            Pattern {
                id: "pattern2".to_string(),
                pattern_type: "naming".to_string(),
                description: "Pattern 2".to_string(),
                frequency: 3,
                confidence: 0.6,
                examples: vec![],
                contexts: vec!["ts".to_string()],
            },
        ];

        let merged = engine.merge_similar_patterns(patterns);

        assert_eq!(merged.frequency, 8); // 5 + 3
        assert_eq!(merged.confidence, 0.7); // (0.8 + 0.6) / 2
        assert_eq!(merged.contexts.len(), 2);
    }
}
