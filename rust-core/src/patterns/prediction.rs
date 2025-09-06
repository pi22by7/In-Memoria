//! Approach prediction based on learned patterns and context

#[cfg(feature = "napi-bindings")]
use napi_derive::napi;

use crate::patterns::types::{ApproachPrediction, ProblemComplexity, GeneratedApproach, Pattern};
use crate::types::{ParseError, SemanticConcept};
use std::collections::{HashMap, HashSet};
use serde_json::{Value, from_str};

/// Predictor for suggesting coding approaches based on patterns and context
#[cfg_attr(feature = "napi-bindings", napi)]
pub struct ApproachPredictor {
    learned_patterns: HashMap<String, Pattern>,
    approach_templates: HashMap<String, ApproachTemplate>,
    context_weights: HashMap<String, f64>,
    historical_approaches: Vec<HistoricalApproach>,
}

#[derive(Debug, Clone)]
struct ApproachTemplate {
    name: String,
    description: String,
    complexity_suitability: Vec<ProblemComplexity>,
    required_patterns: Vec<String>,
    preferred_patterns: Vec<String>,
    technologies: Vec<String>,
    confidence_base: f64,
    // Fields accessed by update_templates_from_history
    confidence: f64,
    patterns: Vec<String>,
}

#[derive(Debug, Clone)]
struct HistoricalApproach {
    problem_description: String,
    approach_taken: String,
    patterns_used: Vec<String>,
    success_rating: f64,
    complexity: ProblemComplexity,
    context: HashMap<String, String>,
}

#[derive(Debug, Clone)]
struct ProblemContext {
    domain: String,
    scale: String,
    performance_requirements: String,
    maintainability_requirements: String,
    team_size: String,
    timeline: String,
    existing_patterns: Vec<String>,
    technologies: Vec<String>,
}

#[cfg_attr(feature = "napi-bindings", napi)]
impl ApproachPredictor {
    #[cfg_attr(feature = "napi-bindings", napi(constructor))]
    pub fn new() -> Self {
        let mut predictor = ApproachPredictor {
            learned_patterns: HashMap::new(),
            approach_templates: HashMap::new(),
            context_weights: HashMap::new(),
            historical_approaches: Vec::new(),
        };
        predictor.initialize_approach_templates();
        predictor.initialize_context_weights();
        predictor
    }

    /// Predict the best approach for a given problem description
    #[cfg_attr(feature = "napi-bindings", napi)]
    pub fn predict_approach(&self, problem_description: String, context_data: Option<String>) -> Result<ApproachPrediction, ParseError> {
        let complexity = self.analyze_problem_complexity(&problem_description);
        let context = self.parse_context_data(context_data.as_deref())?;
        let available_patterns = self.extract_available_patterns(&context);
        
        let candidates = self.generate_approach_candidates(&problem_description, &complexity, &context, &available_patterns);
        let best_approach = self.select_best_approach(candidates, &context);
        
        Ok(ApproachPrediction {
            approach: best_approach.description.clone(),
            confidence: best_approach.confidence,
            reasoning: self.generate_reasoning(&best_approach, &complexity, &context),
            patterns: self.extract_recommended_patterns(&best_approach),
            complexity: complexity.to_string(),
        })
    }

    /// Learn from historical approach data
    pub fn learn_from_approaches(&mut self, approach_data: &str) -> Result<bool, ParseError> {
        let historical_data: Value = from_str(approach_data)
            .map_err(|e| ParseError::from_reason(format!("Failed to parse approach data: {}", e)))?;
        
        if let Some(approaches) = historical_data.as_array() {
            for approach_value in approaches {
                if let Ok(historical_approach) = self.parse_historical_approach(approach_value) {
                    self.historical_approaches.push(historical_approach);
                    
                    // Update approach templates based on successful patterns
                    self.update_templates_from_history();
                }
            }
            Ok(true)
        } else {
            Ok(false)
        }
    }

    /// Update predictor with new pattern information
    pub fn update_patterns(&mut self, patterns: Vec<Pattern>) {
        for pattern in patterns {
            self.learned_patterns.insert(pattern.id.clone(), pattern);
        }
        
        // Recalculate approach template confidence based on new patterns
        self.recalculate_template_confidence();
    }

    /// Predict approach based on existing codebase analysis
    pub fn predict_from_codebase(&self, concepts: &[SemanticConcept], problem_description: &str) -> Result<ApproachPrediction, ParseError> {
        let context = self.analyze_codebase_context(concepts);
        let existing_patterns = self.identify_existing_patterns(concepts);
        let complexity = self.analyze_problem_complexity(problem_description);
        
        // Generate candidates that align with existing codebase patterns
        let candidates = self.generate_contextual_candidates(problem_description, &complexity, &context, &existing_patterns);
        let best_approach = self.select_best_approach(candidates, &context);
        
        Ok(ApproachPrediction {
            approach: best_approach.description.clone(),
            confidence: best_approach.confidence,
            reasoning: self.generate_contextual_reasoning(&best_approach, &existing_patterns, &context),
            patterns: existing_patterns,
            complexity: complexity.to_string(),
        })
    }

    /// Generate multiple approach alternatives
    pub fn generate_alternatives(&self, problem_description: &str, context_data: Option<&str>, count: usize) -> Result<Vec<ApproachPrediction>, ParseError> {
        let complexity = self.analyze_problem_complexity(problem_description);
        let context = self.parse_context_data(context_data)?;
        let available_patterns = self.extract_available_patterns(&context);
        
        let mut candidates = self.generate_approach_candidates(problem_description, &complexity, &context, &available_patterns);
        
        // Sort by confidence and take top N
        candidates.sort_by(|a, b| b.confidence.partial_cmp(&a.confidence).unwrap_or(std::cmp::Ordering::Equal));
        candidates.truncate(count);
        
        let alternatives: Result<Vec<_>, _> = candidates.into_iter()
            .map(|approach| Ok(ApproachPrediction {
                approach: approach.description.clone(),
                confidence: approach.confidence,
                reasoning: self.generate_reasoning(&approach, &complexity, &context),
                patterns: self.extract_recommended_patterns(&approach),
                complexity: complexity.to_string(),
            }))
            .collect();
            
        alternatives
    }

    /// Initialize approach templates
    fn initialize_approach_templates(&mut self) {
        // Microservices Architecture
        self.approach_templates.insert("microservices".to_string(), ApproachTemplate {
            name: "Microservices Architecture".to_string(),
            description: "Decompose into loosely coupled, independently deployable services".to_string(),
            complexity_suitability: vec![ProblemComplexity::Medium, ProblemComplexity::High],
            required_patterns: vec!["service_boundaries".to_string(), "api_gateway".to_string()],
            preferred_patterns: vec!["event_driven".to_string(), "database_per_service".to_string()],
            technologies: vec!["docker".to_string(), "kubernetes".to_string(), "rest_api".to_string()],
            confidence_base: 0.8,
            confidence: 0.8,
            patterns: vec!["service_boundaries".to_string(), "api_gateway".to_string()],
        });

        // Monolithic Architecture  
        self.approach_templates.insert("monolith".to_string(), ApproachTemplate {
            name: "Modular Monolith".to_string(),
            description: "Single deployable unit with clear internal module boundaries".to_string(),
            complexity_suitability: vec![ProblemComplexity::Low, ProblemComplexity::Medium],
            required_patterns: vec!["layered_architecture".to_string()],
            preferred_patterns: vec!["dependency_injection".to_string(), "domain_driven_design".to_string()],
            technologies: vec!["mvc".to_string(), "orm".to_string()],
            confidence_base: 0.7,
            confidence: 0.7,
            patterns: vec!["layered_architecture".to_string()],
        });

        // Event-Driven Architecture
        self.approach_templates.insert("event_driven".to_string(), ApproachTemplate {
            name: "Event-Driven Architecture".to_string(),
            description: "Asynchronous communication through events and message queues".to_string(),
            complexity_suitability: vec![ProblemComplexity::Medium, ProblemComplexity::High],
            required_patterns: vec!["event_sourcing".to_string(), "publisher_subscriber".to_string()],
            preferred_patterns: vec!["saga_pattern".to_string(), "cqrs".to_string()],
            technologies: vec!["message_queue".to_string(), "event_store".to_string()],
            confidence_base: 0.75,
            confidence: 0.75,
            patterns: vec!["event_sourcing".to_string(), "publisher_subscriber".to_string()],
        });

        // Serverless Architecture
        self.approach_templates.insert("serverless".to_string(), ApproachTemplate {
            name: "Serverless Architecture".to_string(),
            description: "Function-based architecture with managed infrastructure".to_string(),
            complexity_suitability: vec![ProblemComplexity::Low, ProblemComplexity::Medium],
            required_patterns: vec!["function_as_service".to_string()],
            preferred_patterns: vec!["api_gateway".to_string(), "event_triggers".to_string()],
            technologies: vec!["aws_lambda".to_string(), "azure_functions".to_string(), "api_gateway".to_string()],
            confidence_base: 0.6,
            confidence: 0.6,
            patterns: vec!["function_as_service".to_string()],
        });

        // Clean Architecture
        self.approach_templates.insert("clean_architecture".to_string(), ApproachTemplate {
            name: "Clean Architecture".to_string(),
            description: "Dependency inversion with clear separation of concerns".to_string(),
            complexity_suitability: vec![ProblemComplexity::Medium, ProblemComplexity::High],
            required_patterns: vec!["dependency_inversion".to_string(), "use_cases".to_string()],
            preferred_patterns: vec!["repository_pattern".to_string(), "domain_entities".to_string()],
            technologies: vec!["dependency_injection".to_string(), "testing_framework".to_string()],
            confidence_base: 0.85,
            confidence: 0.85,
            patterns: vec!["dependency_inversion".to_string(), "use_cases".to_string()],
        });

        // CRUD Application
        self.approach_templates.insert("crud".to_string(), ApproachTemplate {
            name: "CRUD Application".to_string(),
            description: "Simple Create, Read, Update, Delete operations with standard patterns".to_string(),
            complexity_suitability: vec![ProblemComplexity::Low],
            required_patterns: vec!["mvc".to_string(), "repository".to_string()],
            preferred_patterns: vec!["validation".to_string(), "orm".to_string()],
            technologies: vec!["database".to_string(), "web_framework".to_string()],
            confidence_base: 0.9,
            confidence: 0.9,
            patterns: vec!["mvc".to_string(), "repository".to_string()],
        });
    }

    /// Initialize context weights for decision making
    fn initialize_context_weights(&mut self) {
        self.context_weights.insert("performance".to_string(), 0.25);
        self.context_weights.insert("scalability".to_string(), 0.2);
        self.context_weights.insert("maintainability".to_string(), 0.2);
        self.context_weights.insert("team_experience".to_string(), 0.15);
        self.context_weights.insert("timeline".to_string(), 0.1);
        self.context_weights.insert("budget".to_string(), 0.1);
    }

    /// Analyze problem complexity from description
    fn analyze_problem_complexity(&self, problem_description: &str) -> ProblemComplexity {
        let description_lower = problem_description.to_lowercase();
        
        let high_complexity_indicators = [
            "distributed", "microservices", "real-time", "high-throughput", "scalable",
            "multiple systems", "complex business rules", "enterprise", "multi-tenant",
            "event-driven", "asynchronous", "concurrent", "parallel processing",
        ];
        
        let medium_complexity_indicators = [
            "api", "database", "user management", "authentication", "integration",
            "business logic", "workflows", "reporting", "analytics", "modular",
        ];
        
        let high_score = high_complexity_indicators.iter()
            .filter(|&indicator| description_lower.contains(indicator))
            .count();
            
        let medium_score = medium_complexity_indicators.iter()
            .filter(|&indicator| description_lower.contains(indicator))
            .count();
        
        if high_score >= 2 || description_lower.len() > 500 {
            ProblemComplexity::High
        } else if medium_score >= 2 || high_score >= 1 || description_lower.len() > 200 {
            ProblemComplexity::Medium
        } else {
            ProblemComplexity::Low
        }
    }

    /// Parse context data from JSON string
    fn parse_context_data(&self, context_data: Option<&str>) -> Result<ProblemContext, ParseError> {
        let default_context = ProblemContext {
            domain: "general".to_string(),
            scale: "medium".to_string(),
            performance_requirements: "standard".to_string(),
            maintainability_requirements: "high".to_string(),
            team_size: "small".to_string(),
            timeline: "months".to_string(),
            existing_patterns: Vec::new(),
            technologies: Vec::new(),
        };
        
        if let Some(data) = context_data {
            let parsed: Value = from_str(data)
                .map_err(|e| ParseError::from_reason(format!("Failed to parse context: {}", e)))?;
            
            Ok(ProblemContext {
                domain: parsed.get("domain").and_then(|v| v.as_str()).unwrap_or("general").to_string(),
                scale: parsed.get("scale").and_then(|v| v.as_str()).unwrap_or("medium").to_string(),
                performance_requirements: parsed.get("performance").and_then(|v| v.as_str()).unwrap_or("standard").to_string(),
                maintainability_requirements: parsed.get("maintainability").and_then(|v| v.as_str()).unwrap_or("high").to_string(),
                team_size: parsed.get("team_size").and_then(|v| v.as_str()).unwrap_or("small").to_string(),
                timeline: parsed.get("timeline").and_then(|v| v.as_str()).unwrap_or("months").to_string(),
                existing_patterns: parsed.get("existing_patterns")
                    .and_then(|v| v.as_array())
                    .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
                    .unwrap_or_default(),
                technologies: parsed.get("technologies")
                    .and_then(|v| v.as_array())
                    .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
                    .unwrap_or_default(),
            })
        } else {
            Ok(default_context)
        }
    }

    /// Extract available patterns from context
    fn extract_available_patterns(&self, context: &ProblemContext) -> Vec<String> {
        let mut patterns = context.existing_patterns.clone();
        
        // Infer patterns from technologies
        for tech in &context.technologies {
            match tech.to_lowercase().as_str() {
                "react" | "vue" | "angular" => patterns.push("component_based".to_string()),
                "express" | "fastapi" | "spring" => patterns.push("mvc".to_string()),
                "docker" | "kubernetes" => patterns.push("containerization".to_string()),
                "redis" | "rabbitmq" | "kafka" => patterns.push("event_driven".to_string()),
                "graphql" => patterns.push("api_gateway".to_string()),
                _ => {}
            }
        }
        
        patterns.extend(self.learned_patterns.keys().cloned());
        patterns.sort();
        patterns.dedup();
        patterns
    }

    /// Generate approach candidates
    fn generate_approach_candidates(
        &self,
        problem_description: &str,
        complexity: &ProblemComplexity,
        context: &ProblemContext,
        available_patterns: &[String],
    ) -> Vec<GeneratedApproach> {
        let mut candidates = Vec::new();
        
        for template in self.approach_templates.values() {
            if template.complexity_suitability.contains(complexity) {
                let confidence = self.calculate_template_confidence(template, context, available_patterns);
                
                if confidence > 0.3 {
                    candidates.push(GeneratedApproach {
                        description: format!("{}: {}", template.name, template.description),
                        confidence,
                        reasoning: self.generate_template_reasoning(template, context, available_patterns),
                    });
                }
            }
        }
        
        // Add custom approaches based on historical data
        candidates.extend(self.generate_historical_candidates(problem_description, complexity, context));
        
        candidates
    }

    /// Calculate confidence for a template
    fn calculate_template_confidence(
        &self,
        template: &ApproachTemplate,
        context: &ProblemContext,
        available_patterns: &[String],
    ) -> f64 {
        let mut confidence = template.confidence_base;
        
        // Adjust for required patterns availability
        let required_available = template.required_patterns.iter()
            .filter(|&pattern| available_patterns.contains(pattern))
            .count() as f64;
        let required_ratio = if template.required_patterns.is_empty() { 
            1.0 
        } else { 
            required_available / template.required_patterns.len() as f64 
        };
        confidence *= required_ratio;
        
        // Boost for preferred patterns
        let preferred_available = template.preferred_patterns.iter()
            .filter(|&pattern| available_patterns.contains(pattern))
            .count() as f64;
        let preferred_boost = preferred_available * 0.1;
        confidence += preferred_boost;
        
        // Adjust for context factors
        confidence *= self.calculate_context_multiplier(template, context);
        
        confidence.min(1.0)
    }

    /// Calculate context multiplier
    fn calculate_context_multiplier(&self, template: &ApproachTemplate, context: &ProblemContext) -> f64 {
        let mut multiplier = 1.0;
        
        // Scale considerations
        match (template.name.as_str(), context.scale.as_str()) {
            ("Microservices Architecture", "large") => multiplier *= 1.2,
            ("Microservices Architecture", "small") => multiplier *= 0.7,
            ("Modular Monolith", "small") | ("Modular Monolith", "medium") => multiplier *= 1.1,
            ("CRUD Application", "small") => multiplier *= 1.3,
            ("CRUD Application", "large") => multiplier *= 0.5,
            _ => {}
        }
        
        // Performance considerations
        if context.performance_requirements == "high" {
            match template.name.as_str() {
                "Event-Driven Architecture" => multiplier *= 1.1,
                "Serverless Architecture" => multiplier *= 0.8,
                _ => {}
            }
        }
        
        // Team size considerations
        if context.team_size == "large" && template.name == "Clean Architecture" {
            multiplier *= 1.2;
        }

        // Domain-specific adjustments
        match (template.name.as_str(), context.domain.as_str()) {
            ("Microservices Architecture", "enterprise") => multiplier *= 1.15,
            ("CRUD Application", "prototype") => multiplier *= 1.2,
            ("Event-Driven Architecture", "real_time") => multiplier *= 1.3,
            ("Serverless Architecture", "prototype") => multiplier *= 1.1,
            ("Clean Architecture", "long_term_project") => multiplier *= 1.2,
            _ => {}
        }

        // Maintainability requirements
        match context.maintainability_requirements.as_str() {
            "high" => {
                match template.name.as_str() {
                    "Clean Architecture" => multiplier *= 1.25,
                    "Modular Monolith" => multiplier *= 1.1,
                    _ => {}
                }
            },
            "low" => {
                match template.name.as_str() {
                    "CRUD Application" => multiplier *= 1.1,
                    "Serverless Architecture" => multiplier *= 1.05,
                    _ => {}
                }
            },
            _ => {}
        }

        // Timeline considerations
        match context.timeline.as_str() {
            "urgent" | "short" => {
                match template.name.as_str() {
                    "CRUD Application" => multiplier *= 1.3,
                    "Serverless Architecture" => multiplier *= 1.15,
                    "Microservices Architecture" => multiplier *= 0.7, // Complex to implement quickly
                    _ => {}
                }
            },
            "long_term" | "ongoing" => {
                match template.name.as_str() {
                    "Clean Architecture" => multiplier *= 1.2,
                    "Microservices Architecture" => multiplier *= 1.1,
                    "CRUD Application" => multiplier *= 0.8, // Less suitable for long-term
                    _ => {}
                }
            },
            _ => {}
        }
        
        multiplier
    }

    /// Select best approach from candidates
    fn select_best_approach(&self, mut candidates: Vec<GeneratedApproach>, _context: &ProblemContext) -> GeneratedApproach {
        candidates.sort_by(|a, b| b.confidence.partial_cmp(&a.confidence).unwrap_or(std::cmp::Ordering::Equal));
        
        candidates.into_iter().next().unwrap_or_else(|| GeneratedApproach {
            description: "Standard layered architecture with clear separation of concerns".to_string(),
            confidence: 0.5,
            reasoning: "Default approach when no specific patterns are identified".to_string(),
        })
    }

    /// Generate reasoning for an approach
    fn generate_reasoning(&self, approach: &GeneratedApproach, complexity: &ProblemComplexity, context: &ProblemContext) -> String {
        let mut reasoning = vec![
            format!("Problem complexity: {}", complexity),
            format!("Approach confidence: {:.1}%", approach.confidence * 100.0),
        ];
        
        reasoning.push(approach.reasoning.clone());
        
        if context.performance_requirements == "high" {
            reasoning.push("High performance requirements favor this approach".to_string());
        }
        
        if context.scale == "large" {
            reasoning.push("Large scale requirements support this architectural choice".to_string());
        }
        
        reasoning.join(". ")
    }

    /// Generate contextual reasoning based on existing codebase
    fn generate_contextual_reasoning(&self, approach: &GeneratedApproach, existing_patterns: &[String], context: &ProblemContext) -> String {
        let mut reasoning = vec![
            approach.reasoning.clone(),
            format!("Existing codebase patterns: {}", existing_patterns.join(", ")),
        ];
        
        if !existing_patterns.is_empty() {
            reasoning.push("Recommendation aligns with existing architectural patterns".to_string());
        }
        
        reasoning.push(format!("Context scale: {}, team size: {}", context.scale, context.team_size));
        
        reasoning.join(". ")
    }

    /// Extract recommended patterns from approach
    fn extract_recommended_patterns(&self, approach: &GeneratedApproach) -> Vec<String> {
        let mut patterns = Vec::new();
        
        // Extract patterns mentioned in the approach description
        for template in self.approach_templates.values() {
            if approach.description.contains(&template.name) {
                patterns.extend(template.required_patterns.clone());
                patterns.extend(template.preferred_patterns.clone());
                break;
            }
        }
        
        patterns.sort();
        patterns.dedup();
        patterns
    }

    /// Additional helper methods for historical data and codebase analysis
    fn parse_historical_approach(&self, value: &Value) -> Result<HistoricalApproach, ParseError> {
        let problem = value.get("problem").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let approach = value.get("approach").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let success = value.get("success").and_then(|v| v.as_f64()).unwrap_or(0.5);
        let complexity_str = value.get("complexity").and_then(|v| v.as_str()).unwrap_or("medium");
        
        let complexity = match complexity_str {
            "low" => ProblemComplexity::Low,
            "high" => ProblemComplexity::High,
            _ => ProblemComplexity::Medium,
        };
        
        Ok(HistoricalApproach {
            problem_description: problem,
            approach_taken: approach,
            patterns_used: Vec::new(),
            success_rating: success,
            complexity,
            context: HashMap::new(),
        })
    }

    fn update_templates_from_history(&mut self) {
        // Collect template descriptions first to avoid borrowing conflicts
        let template_descriptions: Vec<(String, String)> = self.approach_templates
            .iter()
            .map(|(name, template)| (name.clone(), template.description.clone()))
            .collect();

        // Analyze historical approaches to update template confidence based on success ratings
        for historical in &self.historical_approaches {
            // Use problem_description for internal consistency check
            let problem_approach_alignment = self.calculate_approach_similarity(&historical.problem_description, &historical.approach_taken);
            
            // Find templates that match this historical approach's patterns
            for (template_name, template_desc) in &template_descriptions {
                let approach_similarity = self.calculate_approach_similarity(&historical.approach_taken, template_desc);
                let problem_match_bonus = self.calculate_approach_similarity(&historical.problem_description, template_desc) * 0.3;
                // Factor in how well the problem aligned with the chosen approach
                let alignment_bonus = problem_approach_alignment * 0.1;
                let total_similarity = approach_similarity + problem_match_bonus + alignment_bonus;
                
                if total_similarity > 0.6 {  // Similar approaches
                    if let Some(template) = self.approach_templates.get_mut(template_name) {
                        // Check if template complexity matches historical complexity
                        let complexity_match = template.complexity_suitability.contains(&historical.complexity);
                        let complexity_bonus = if complexity_match { 0.1 } else { -0.05 };
                        
                        // Adjust confidence based on historical success and complexity matching
                        let base_adjustment = (historical.success_rating - 0.5) * 0.2;
                        let final_adjustment = base_adjustment + complexity_bonus;
                        template.confidence = (template.confidence + final_adjustment).clamp(0.1, 1.0);
                        
                        // Add patterns from successful approaches
                        if historical.success_rating > 0.7 {
                            for pattern in &historical.patterns_used {
                                if !template.patterns.contains(pattern) {
                                    template.patterns.push(pattern.clone());
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    fn calculate_approach_similarity(&self, approach1: &str, approach2: &str) -> f64 {
        // Simple similarity calculation based on common words
        let approach1_lower = approach1.to_lowercase();
        let approach2_lower = approach2.to_lowercase();
        let words1: HashSet<&str> = approach1_lower.split_whitespace().collect();
        let words2: HashSet<&str> = approach2_lower.split_whitespace().collect();
        
        let intersection = words1.intersection(&words2).count();
        let union = words1.union(&words2).count();
        
        if union == 0 { 0.0 } else { intersection as f64 / union as f64 }
    }

    fn recalculate_template_confidence(&mut self) {
        // Recalculate base confidence based on available patterns
        // Implementation depends on specific requirements
    }

    fn analyze_codebase_context(&self, concepts: &[SemanticConcept]) -> ProblemContext {
        let mut technologies = HashSet::new();
        let mut patterns = HashSet::new();
        
        // Extract technologies and patterns from file paths and names
        for concept in concepts {
            if concept.file_path.contains("test") {
                technologies.insert("testing".to_string());
            }
            if concept.file_path.contains("api") {
                patterns.insert("api".to_string());
            }
            if concept.name.contains("Service") {
                patterns.insert("service_layer".to_string());
            }
            if concept.name.contains("Repository") {
                patterns.insert("repository".to_string());
            }
        }
        
        let scale = if concepts.len() > 100 {
            "large"
        } else if concepts.len() > 50 {
            "medium"
        } else {
            "small"
        };
        
        // Use historical approaches to inform context decisions
        let mut maintainability = "high".to_string();
        let mut domain = "existing_codebase".to_string();
        let mut timeline = "ongoing".to_string();
        
        // Learn from successful historical approaches with similar complexity
        for historical in &self.historical_approaches {
            if historical.success_rating > 0.7 {  // Only learn from successful approaches
                if let Some(hist_domain) = historical.context.get("domain") {
                    domain = hist_domain.clone();
                }
                if let Some(hist_maint) = historical.context.get("maintainability") {
                    maintainability = hist_maint.clone();
                }
                if let Some(hist_timeline) = historical.context.get("timeline") {
                    timeline = hist_timeline.clone();
                }
            }
        }

        ProblemContext {
            domain,
            scale: scale.to_string(),
            performance_requirements: "standard".to_string(),
            maintainability_requirements: maintainability,
            team_size: "medium".to_string(),
            timeline,
            existing_patterns: patterns.into_iter().collect(),
            technologies: technologies.into_iter().collect(),
        }
    }

    fn identify_existing_patterns(&self, concepts: &[SemanticConcept]) -> Vec<String> {
        let mut patterns = Vec::new();
        
        // Identify patterns based on concept analysis
        let has_controllers = concepts.iter().any(|c| c.name.contains("Controller"));
        let has_services = concepts.iter().any(|c| c.name.contains("Service"));
        let has_repositories = concepts.iter().any(|c| c.name.contains("Repository"));
        
        if has_controllers && has_services {
            patterns.push("mvc".to_string());
        }
        if has_repositories {
            patterns.push("repository_pattern".to_string());
        }
        if has_services {
            patterns.push("service_layer".to_string());
        }
        
        patterns
    }

    fn generate_contextual_candidates(
        &self,
        problem_description: &str,
        complexity: &ProblemComplexity,
        context: &ProblemContext,
        existing_patterns: &[String],
    ) -> Vec<GeneratedApproach> {
        self.generate_approach_candidates(problem_description, complexity, context, existing_patterns)
    }

    fn generate_historical_candidates(
        &self,
        _problem_description: &str,
        _complexity: &ProblemComplexity,
        _context: &ProblemContext,
    ) -> Vec<GeneratedApproach> {
        // Generate candidates based on historical success patterns
        Vec::new() // Simplified for now
    }

    fn generate_template_reasoning(&self, template: &ApproachTemplate, context: &ProblemContext, available_patterns: &[String]) -> String {
        let mut reasoning = vec![template.description.clone()];
        
        let pattern_match_count = template.required_patterns.iter()
            .filter(|&p| available_patterns.contains(p))
            .count();
        
        if pattern_match_count > 0 {
            reasoning.push(format!("Matches {} existing patterns", pattern_match_count));
        }
        
        if template.technologies.iter().any(|t| context.technologies.contains(t)) {
            reasoning.push("Aligns with existing technology stack".to_string());
        }
        
        reasoning.join(", ")
    }
}

impl Default for ApproachPredictor {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    #[test]
    fn test_approach_predictor_creation() {
        let predictor = ApproachPredictor::new();
        assert!(!predictor.approach_templates.is_empty());
        assert!(!predictor.context_weights.is_empty());
    }

    #[test]
    fn test_problem_complexity_analysis() {
        let predictor = ApproachPredictor::new();
        
        let simple_problem = "Create a basic user registration form";
        assert!(matches!(predictor.analyze_problem_complexity(simple_problem), ProblemComplexity::Low));
        
        let medium_problem = "Build an API for user management with authentication and database integration";
        assert!(matches!(predictor.analyze_problem_complexity(medium_problem), ProblemComplexity::Medium));
        
        let complex_problem = "Design a distributed microservices architecture for real-time high-throughput event processing with multiple systems integration";
        assert!(matches!(predictor.analyze_problem_complexity(complex_problem), ProblemComplexity::High));
    }

    #[test]
    fn test_approach_prediction() {
        let predictor = ApproachPredictor::new();
        
        let simple_problem = "Create a basic CRUD application for managing tasks";
        let prediction = predictor.predict_approach(simple_problem.to_string(), None).unwrap();
        
        assert!(!prediction.approach.is_empty());
        assert!(prediction.confidence > 0.0);
        assert!(prediction.confidence <= 1.0);
        assert_eq!(prediction.complexity, "low");
    }

    #[test]
    fn test_context_data_parsing() {
        let predictor = ApproachPredictor::new();
        
        let context_json = r#"{
            "domain": "e-commerce",
            "scale": "large",
            "performance": "high",
            "team_size": "large",
            "technologies": ["react", "node", "mongodb"]
        }"#;
        
        let context = predictor.parse_context_data(Some(context_json)).unwrap();
        assert_eq!(context.domain, "e-commerce");
        assert_eq!(context.scale, "large");
        assert_eq!(context.performance_requirements, "high");
        assert!(context.technologies.contains(&"react".to_string()));
    }

    #[test]
    fn test_approach_alternatives_generation() {
        let predictor = ApproachPredictor::new();
        
        let problem = "Build a scalable web application for handling user data";
        let alternatives = predictor.generate_alternatives(problem, None, 3).unwrap();
        
        assert!(!alternatives.is_empty());
        assert!(alternatives.len() <= 3);
        
        // Alternatives should be sorted by confidence
        for window in alternatives.windows(2) {
            assert!(window[0].confidence >= window[1].confidence);
        }
    }

    #[test]
    fn test_pattern_extraction() {
        let predictor = ApproachPredictor::new();
        let context = ProblemContext {
            domain: "web".to_string(),
            scale: "medium".to_string(),
            performance_requirements: "standard".to_string(),
            maintainability_requirements: "high".to_string(),
            team_size: "small".to_string(),
            timeline: "months".to_string(),
            existing_patterns: vec!["mvc".to_string()],
            technologies: vec!["react".to_string(), "express".to_string()],
        };
        
        let patterns = predictor.extract_available_patterns(&context);
        assert!(patterns.contains(&"mvc".to_string()));
        assert!(patterns.contains(&"component_based".to_string()));
    }

    #[test]
    fn test_template_confidence_calculation() {
        let predictor = ApproachPredictor::new();
        
        let template = &predictor.approach_templates["microservices"];
        let context = ProblemContext {
            domain: "web".to_string(),
            scale: "large".to_string(),
            performance_requirements: "high".to_string(),
            maintainability_requirements: "high".to_string(),
            team_size: "large".to_string(),
            timeline: "months".to_string(),
            existing_patterns: vec!["service_boundaries".to_string()],
            technologies: vec!["docker".to_string()],
        };
        let available_patterns = vec!["service_boundaries".to_string(), "api_gateway".to_string()];
        
        let confidence = predictor.calculate_template_confidence(template, &context, &available_patterns);
        assert!(confidence > template.confidence_base);
    }

    #[test]
    fn test_codebase_context_analysis() {
        let predictor = ApproachPredictor::new();
        
        let concepts = vec![
            SemanticConcept {
                id: "1".to_string(),
                name: "UserController".to_string(),
                concept_type: "class".to_string(),
                confidence: 0.8,
                file_path: "controllers/UserController.js".to_string(),
                line_range: crate::types::LineRange { start: 1, end: 50 },
                relationships: HashMap::new(),
                metadata: HashMap::new(),
            },
            SemanticConcept {
                id: "2".to_string(),
                name: "UserService".to_string(),
                concept_type: "class".to_string(),
                confidence: 0.8,
                file_path: "services/UserService.js".to_string(),
                line_range: crate::types::LineRange { start: 1, end: 30 },
                relationships: HashMap::new(),
                metadata: HashMap::new(),
            },
        ];
        
        let context = predictor.analyze_codebase_context(&concepts);
        assert_eq!(context.scale, "small");
        assert!(context.existing_patterns.contains(&"service_layer".to_string()));
    }

    #[test]
    fn test_existing_pattern_identification() {
        let predictor = ApproachPredictor::new();
        
        let concepts = vec![
            SemanticConcept {
                id: "1".to_string(),
                name: "UserController".to_string(),
                concept_type: "class".to_string(),
                confidence: 0.8,
                file_path: "UserController.js".to_string(),
                line_range: crate::types::LineRange { start: 1, end: 50 },
                relationships: HashMap::new(),
                metadata: HashMap::new(),
            },
            SemanticConcept {
                id: "2".to_string(),
                name: "UserRepository".to_string(),
                concept_type: "class".to_string(),
                confidence: 0.8,
                file_path: "UserRepository.js".to_string(),
                line_range: crate::types::LineRange { start: 1, end: 30 },
                relationships: HashMap::new(),
                metadata: HashMap::new(),
            },
        ];
        
        let patterns = predictor.identify_existing_patterns(&concepts);
        assert!(patterns.contains(&"mvc".to_string()));
        assert!(patterns.contains(&"repository_pattern".to_string()));
    }

    #[test]
    fn test_complexity_suitability_matching() {
        let predictor = ApproachPredictor::new();
        
        // Test that CRUD template is suitable for low complexity
        let crud_template = &predictor.approach_templates["crud"];
        assert!(crud_template.complexity_suitability.contains(&ProblemComplexity::Low));
        
        // Test that microservices template is suitable for high complexity
        let microservices_template = &predictor.approach_templates["microservices"];
        assert!(microservices_template.complexity_suitability.contains(&ProblemComplexity::High));
    }

    #[test]
    fn test_prediction_from_codebase() {
        let predictor = ApproachPredictor::new();
        
        let concepts = vec![
            SemanticConcept {
                id: "1".to_string(),
                name: "UserService".to_string(),
                concept_type: "class".to_string(),
                confidence: 0.8,
                file_path: "services/UserService.js".to_string(),
                line_range: crate::types::LineRange { start: 1, end: 30 },
                relationships: HashMap::new(),
                metadata: HashMap::new(),
            },
        ];
        
        let problem = "Add new feature to manage user profiles";
        let prediction = predictor.predict_from_codebase(&concepts, problem).unwrap();
        
        assert!(!prediction.approach.is_empty());
        assert!(prediction.confidence > 0.0);
        assert!(!prediction.patterns.is_empty());
    }
}