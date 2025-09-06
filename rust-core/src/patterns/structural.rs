//! Structural pattern detection and analysis

#[cfg(feature = "napi-bindings")]
use napi_derive::napi;

use crate::patterns::types::{Pattern, PatternExample, StructuralPattern, PatternExtractor};
use crate::types::{ParseError, SemanticConcept, LineRange};
use std::collections::{HashMap, HashSet};
use walkdir::WalkDir;
use std::fs;
use std::path::Path;

/// Analyzer for detecting architectural and structural patterns
#[cfg_attr(feature = "napi-bindings", napi)]
pub struct StructuralPatternAnalyzer {
    patterns: HashMap<String, StructuralPattern>,
    architecture_signatures: HashMap<String, ArchitectureSignature>,
}

#[derive(Debug, Clone)]
struct ArchitectureSignature {
    pattern_name: String,
    required_components: Vec<String>,
    directory_structure: Vec<String>,
    file_patterns: Vec<String>,
    confidence_threshold: f64,
}

#[derive(Debug, Clone)]
struct DirectoryAnalysis {
    path: String,
    subdirectories: Vec<String>,
    file_types: HashMap<String, usize>,
    depth: usize,
}

#[cfg_attr(feature = "napi-bindings", napi)]
impl StructuralPatternAnalyzer {
    #[cfg_attr(feature = "napi-bindings", napi(constructor))]
    pub fn new() -> Self {
        let mut analyzer = StructuralPatternAnalyzer {
            patterns: HashMap::new(),
            architecture_signatures: HashMap::new(),
        };
        analyzer.initialize_signatures();
        analyzer
    }

    /// Initialize common architectural pattern signatures
    fn initialize_signatures(&mut self) {
        // MVC Pattern
        self.architecture_signatures.insert("MVC".to_string(), ArchitectureSignature {
            pattern_name: "Model-View-Controller".to_string(),
            required_components: vec!["model".to_string(), "view".to_string(), "controller".to_string()],
            directory_structure: vec!["models/".to_string(), "views/".to_string(), "controllers/".to_string()],
            file_patterns: vec!["*Controller.*".to_string(), "*Model.*".to_string(), "*View.*".to_string()],
            confidence_threshold: 0.7,
        });

        // Clean Architecture
        self.architecture_signatures.insert("Clean".to_string(), ArchitectureSignature {
            pattern_name: "Clean Architecture".to_string(),
            required_components: vec!["domain".to_string(), "application".to_string(), "infrastructure".to_string(), "presentation".to_string()],
            directory_structure: vec!["domain/".to_string(), "application/".to_string(), "infrastructure/".to_string(), "presentation/".to_string()],
            file_patterns: vec!["*Service.*".to_string(), "*Repository.*".to_string(), "*UseCase.*".to_string()],
            confidence_threshold: 0.8,
        });

        // Layered Architecture
        self.architecture_signatures.insert("Layered".to_string(), ArchitectureSignature {
            pattern_name: "Layered Architecture".to_string(),
            required_components: vec!["api".to_string(), "service".to_string(), "data".to_string()],
            directory_structure: vec!["api/".to_string(), "service/".to_string(), "data/".to_string()],
            file_patterns: vec!["*Api.*".to_string(), "*Service.*".to_string(), "*Repository.*".to_string()],
            confidence_threshold: 0.6,
        });

        // Microservices
        self.architecture_signatures.insert("Microservices".to_string(), ArchitectureSignature {
            pattern_name: "Microservices Architecture".to_string(),
            required_components: vec!["service".to_string(), "gateway".to_string()],
            directory_structure: vec!["services/".to_string(), "gateway/".to_string()],
            file_patterns: vec!["*Service.*".to_string(), "docker*".to_string(), "*Gateway.*".to_string()],
            confidence_threshold: 0.7,
        });

        // Modular Monolith
        self.architecture_signatures.insert("Modular".to_string(), ArchitectureSignature {
            pattern_name: "Modular Architecture".to_string(),
            required_components: vec!["modules".to_string(), "shared".to_string()],
            directory_structure: vec!["modules/".to_string(), "shared/".to_string()],
            file_patterns: vec!["mod.*".to_string(), "index.*".to_string()],
            confidence_threshold: 0.5,
        });

        // Event-Driven Architecture
        self.architecture_signatures.insert("EventDriven".to_string(), ArchitectureSignature {
            pattern_name: "Event-Driven Architecture".to_string(),
            required_components: vec!["events".to_string(), "handlers".to_string(), "publishers".to_string()],
            directory_structure: vec!["events/".to_string(), "handlers/".to_string()],
            file_patterns: vec!["*Event.*".to_string(), "*Handler.*".to_string(), "*Publisher.*".to_string()],
            confidence_threshold: 0.7,
        });
    }

    /// Analyze structural patterns from codebase organization
    pub fn analyze_codebase_structure(&mut self, path: &str) -> Result<Vec<Pattern>, ParseError> {
        let directory_analysis = self.analyze_directory_structure(path)?;
        let file_analysis = self.analyze_file_patterns(path)?;
        
        let mut detected_patterns = Vec::new();
        
        // Check each architectural signature
        for (pattern_key, signature) in &self.architecture_signatures {
            let confidence = self.calculate_structure_confidence(
                &directory_analysis,
                &file_analysis,
                signature,
            );
            
            if confidence >= signature.confidence_threshold {
                let examples = self.collect_structure_examples(path, signature)?;
                let example_count = examples.len() as u32;
                
                let pattern = Pattern {
                    id: format!("structural_{}", pattern_key),
                    pattern_type: "structural".to_string(),
                    description: format!(
                        "{} detected with {:.1}% confidence",
                        signature.pattern_name,
                        confidence * 100.0
                    ),
                    frequency: example_count,
                    confidence,
                    examples,
                    contexts: vec!["architecture".to_string()],
                };
                
                detected_patterns.push(pattern);
                
                // Store in internal patterns
                let structural_pattern = StructuralPattern {
                    pattern_type: signature.pattern_name.clone(),
                    frequency: example_count,
                    characteristics: signature.required_components.clone(),
                    confidence,
                };
                self.patterns.insert(pattern_key.clone(), structural_pattern);
            }
        }
        
        Ok(detected_patterns)
    }

    /// Analyze concepts for structural relationships
    pub fn analyze_concept_structures(&mut self, concepts: &[SemanticConcept]) -> Result<Vec<Pattern>, ParseError> {
        let mut detected_patterns = Vec::new();
        
        // Analyze file organization patterns
        let file_organization = self.analyze_file_organization(concepts);
        
        // Analyze dependency patterns
        let dependency_patterns = self.analyze_dependency_patterns(concepts);
        
        // Analyze naming structure patterns
        let naming_structure = self.analyze_naming_structure_patterns(concepts);
        
        detected_patterns.extend(file_organization);
        detected_patterns.extend(dependency_patterns);
        detected_patterns.extend(naming_structure);
        
        Ok(detected_patterns)
    }

    /// Detect violations of structural patterns
    pub fn detect_structural_violations(&self, concepts: &[SemanticConcept]) -> Vec<String> {
        let mut violations = Vec::new();
        
        // Check for common structural anti-patterns
        violations.extend(self.detect_god_object_violations(concepts));
        violations.extend(self.detect_circular_dependency_violations(concepts));
        violations.extend(self.detect_layer_violations(concepts));
        violations.extend(self.detect_coupling_violations(concepts));
        
        violations
    }

    /// Generate structural recommendations
    pub fn generate_structural_recommendations(&self, concepts: &[SemanticConcept]) -> Vec<String> {
        let mut recommendations = Vec::new();
        
        // File organization recommendations
        let file_metrics = self.calculate_file_metrics(concepts);
        if file_metrics.avg_concepts_per_file > 20.0 {
            recommendations.push("Consider breaking down large files into smaller, more focused modules".to_string());
        }
        
        if file_metrics.max_concepts_per_file > 50 {
            recommendations.push(format!(
                "One file contains {} concepts - consider splitting this monolithic file", 
                file_metrics.max_concepts_per_file
            ));
        }
        
        if file_metrics.total_files < 5 && concepts.len() > 100 {
            recommendations.push(format!(
                "Only {} files for {} concepts - consider better separation of concerns", 
                file_metrics.total_files, concepts.len()
            ));
        }
        
        // Coupling recommendations
        let coupling_metrics = self.calculate_coupling_metrics(concepts);
        if coupling_metrics.high_coupling_count > 5 {
            recommendations.push("Reduce tight coupling between components using dependency injection or interfaces".to_string());
        }
        
        // Layer separation recommendations
        if self.has_layer_violations(concepts) {
            recommendations.push("Establish clear layer boundaries and enforce dependency directions".to_string());
        }
        
        // Modularity recommendations
        let modularity_score = self.calculate_modularity_score(concepts);
        if modularity_score < 0.6 {
            recommendations.push("Consider refactoring into more modular components with clear responsibilities".to_string());
        }
        
        if recommendations.is_empty() {
            recommendations.push("Structural patterns look good! Consider documenting architectural decisions".to_string());
        }
        
        recommendations
    }

    /// Analyze directory structure recursively
    fn analyze_directory_structure(&self, path: &str) -> Result<Vec<DirectoryAnalysis>, ParseError> {
        let mut analyses = Vec::new();
        
        for entry in WalkDir::new(path).max_depth(5).into_iter().filter_map(|e| e.ok()) {
            if entry.file_type().is_dir() {
                let dir_path = entry.path();
                let mut analysis = DirectoryAnalysis {
                    path: dir_path.to_string_lossy().to_string(),
                    subdirectories: Vec::new(),
                    file_types: HashMap::new(),
                    depth: entry.depth(),
                };
                
                // Analyze immediate children
                if let Ok(entries) = fs::read_dir(dir_path) {
                    for child_entry in entries.filter_map(|e| e.ok()) {
                        if child_entry.file_type().ok().is_some_and(|ft| ft.is_dir()) {
                            if let Some(name) = child_entry.file_name().to_str() {
                                analysis.subdirectories.push(name.to_string());
                            }
                        } else if let Some(extension) = child_entry.path().extension().and_then(|s| s.to_str()) {
                            *analysis.file_types.entry(extension.to_string()).or_insert(0) += 1;
                        }
                    }
                }
                
                analyses.push(analysis);
            }
        }
        
        Ok(analyses)
    }

    /// Analyze file patterns in the codebase
    fn analyze_file_patterns(&self, path: &str) -> Result<HashMap<String, Vec<String>>, ParseError> {
        let mut file_patterns: HashMap<String, Vec<String>> = HashMap::new();
        
        for entry in WalkDir::new(path).into_iter().filter_map(|e| e.ok()) {
            if entry.file_type().is_file() {
                let file_path = entry.path();
                if let Some(file_name) = file_path.file_name().and_then(|n| n.to_str()) {
                    // Categorize files by patterns
                    if file_name.contains("Controller") {
                        file_patterns.entry("controller".to_string()).or_default().push(file_name.to_string());
                    }
                    if file_name.contains("Model") {
                        file_patterns.entry("model".to_string()).or_default().push(file_name.to_string());
                    }
                    if file_name.contains("View") {
                        file_patterns.entry("view".to_string()).or_default().push(file_name.to_string());
                    }
                    if file_name.contains("Service") {
                        file_patterns.entry("service".to_string()).or_default().push(file_name.to_string());
                    }
                    if file_name.contains("Repository") {
                        file_patterns.entry("repository".to_string()).or_default().push(file_name.to_string());
                    }
                    if file_name.contains("Handler") {
                        file_patterns.entry("handler".to_string()).or_default().push(file_name.to_string());
                    }
                }
            }
        }
        
        Ok(file_patterns)
    }

    /// Calculate confidence score for a structural pattern
    fn calculate_structure_confidence(
        &self,
        directory_analysis: &[DirectoryAnalysis],
        file_patterns: &HashMap<String, Vec<String>>,
        signature: &ArchitectureSignature,
    ) -> f64 {
        let mut score = 0.0;
        let mut max_score = 0.0;
        
        // Check directory structure matches
        max_score += 0.4;
        let mut dir_matches = 0;
        let mut depth_penalty = 0.0;
        
        for required_dir in &signature.directory_structure {
            for analysis in directory_analysis {
                if analysis.path.contains(required_dir) || 
                   analysis.subdirectories.iter().any(|d| d.contains(&required_dir.replace("/", ""))) {
                    dir_matches += 1;
                    // Apply depth-based scoring - deeper structures get slight penalty for complexity
                    if analysis.depth > 4 {
                        depth_penalty += 0.1;
                    }
                    break;
                }
            }
        }
        if !signature.directory_structure.is_empty() {
            let base_score = dir_matches as f64 / signature.directory_structure.len() as f64;
            let depth_adjusted_score = (base_score - (depth_penalty / signature.directory_structure.len() as f64)).max(0.0);
            score += 0.4 * depth_adjusted_score;
        }
        
        // Check component existence
        max_score += 0.3;
        let mut component_matches = 0;
        for component in &signature.required_components {
            if file_patterns.contains_key(component) {
                component_matches += 1;
            }
        }
        if !signature.required_components.is_empty() {
            score += 0.3 * (component_matches as f64 / signature.required_components.len() as f64);
        }
        
        // Check file patterns
        max_score += 0.3;
        let mut pattern_matches = 0;
        for pattern in &signature.file_patterns {
            let pattern_key = pattern.replace("*", "").replace(".", "").to_lowercase();
            if file_patterns.keys().any(|k| k.contains(&pattern_key)) {
                pattern_matches += 1;
            }
        }
        if !signature.file_patterns.is_empty() {
            score += 0.3 * (pattern_matches as f64 / signature.file_patterns.len() as f64);
        }
        
        if max_score > 0.0 {
            score / max_score
        } else {
            0.0
        }
    }

    /// Collect examples of structural patterns
    fn collect_structure_examples(&self, path: &str, signature: &ArchitectureSignature) -> Result<Vec<PatternExample>, ParseError> {
        let mut examples = Vec::new();
        
        for entry in WalkDir::new(path).max_depth(3).into_iter().filter_map(|e| e.ok()) {
            if entry.file_type().is_dir() {
                let dir_name = entry.file_name().to_string_lossy().to_string();
                
                // Check if directory name matches required components
                for component in &signature.required_components {
                    if dir_name.to_lowercase().contains(&component.to_lowercase()) {
                        examples.push(PatternExample {
                            code: format!("Directory: {}", dir_name),
                            file_path: entry.path().to_string_lossy().to_string(),
                            line_range: LineRange { start: 1, end: 1 },
                        });
                        break;
                    }
                }
            }
        }
        
        // Limit examples to avoid overwhelming output
        examples.truncate(10);
        Ok(examples)
    }

    /// Analyze file organization patterns from concepts
    fn analyze_file_organization(&self, concepts: &[SemanticConcept]) -> Vec<Pattern> {
        let mut patterns = Vec::new();
        let mut file_concept_map: HashMap<String, Vec<&SemanticConcept>> = HashMap::new();
        
        // Group concepts by file
        for concept in concepts {
            file_concept_map.entry(concept.file_path.clone()).or_default().push(concept);
        }
        
        // Check for single responsibility principle violations
        let large_files: Vec<_> = file_concept_map.iter()
            .filter(|(_, concepts)| concepts.len() > 10)
            .collect();
            
        if !large_files.is_empty() {
            patterns.push(Pattern {
                id: "structural_large_files".to_string(),
                pattern_type: "structural".to_string(),
                description: format!("Files with too many concepts detected ({} files)", large_files.len()),
                frequency: large_files.len() as u32,
                confidence: 0.8,
                examples: large_files.into_iter().take(5).map(|(file_path, concepts)| {
                    PatternExample {
                        code: format!("File contains {} concepts", concepts.len()),
                        file_path: file_path.clone(),
                        line_range: LineRange { start: 1, end: 1 },
                    }
                }).collect(),
                contexts: vec!["organization".to_string()],
            });
        }
        
        patterns
    }

    /// Analyze dependency patterns from concepts
    fn analyze_dependency_patterns(&self, concepts: &[SemanticConcept]) -> Vec<Pattern> {
        let mut patterns = Vec::new();
        let mut dependencies: HashMap<String, HashSet<String>> = HashMap::new();
        
        // Build dependency graph from relationships
        for concept in concepts {
            let concept_file = Path::new(&concept.file_path)
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or(&concept.file_path);
                
            for (relationship_type, target) in &concept.relationships {
                if relationship_type.contains("import") || relationship_type.contains("depends") {
                    dependencies.entry(concept_file.to_string()).or_default().insert(target.clone());
                }
            }
        }
        
        // Detect circular dependencies
        let cycles = self.detect_cycles(&dependencies);
        if !cycles.is_empty() {
            patterns.push(Pattern {
                id: "structural_circular_dependencies".to_string(),
                pattern_type: "structural".to_string(),
                description: format!("Circular dependencies detected ({} cycles)", cycles.len()),
                frequency: cycles.len() as u32,
                confidence: 0.9,
                examples: cycles.into_iter().take(3).map(|cycle| {
                    PatternExample {
                        code: format!("Circular dependency: {}", cycle.join(" -> ")),
                        file_path: "multiple_files".to_string(),
                        line_range: LineRange { start: 1, end: 1 },
                    }
                }).collect(),
                contexts: vec!["dependency".to_string()],
            });
        }
        
        patterns
    }

    /// Analyze naming structure patterns
    fn analyze_naming_structure_patterns(&self, concepts: &[SemanticConcept]) -> Vec<Pattern> {
        let mut patterns = Vec::new();
        let mut namespace_patterns: HashMap<String, u32> = HashMap::new();
        
        // Analyze namespace/module patterns
        for concept in concepts {
            if let Some(namespace) = self.extract_namespace_from_path(&concept.file_path) {
                *namespace_patterns.entry(namespace).or_insert(0) += 1;
            }
        }
        
        if !namespace_patterns.is_empty() {
            let most_common = namespace_patterns.iter()
                .max_by_key(|(_, count)| *count)
                .map(|(ns, count)| (ns.clone(), *count));
                
            if let Some((namespace, count)) = most_common {
                patterns.push(Pattern {
                    id: "structural_namespace_organization".to_string(),
                    pattern_type: "structural".to_string(),
                    description: format!("Consistent namespace organization detected ({})", namespace),
                    frequency: count,
                    confidence: 0.7,
                    examples: vec![PatternExample {
                        code: format!("Namespace pattern: {}", namespace),
                        file_path: "multiple_files".to_string(),
                        line_range: LineRange { start: 1, end: 1 },
                    }],
                    contexts: vec!["organization".to_string()],
                });
            }
        }
        
        patterns
    }

    /// Detect God Object violations
    fn detect_god_object_violations(&self, concepts: &[SemanticConcept]) -> Vec<String> {
        let mut violations = Vec::new();
        let mut class_method_counts: HashMap<String, u32> = HashMap::new();
        
        for concept in concepts {
            if concept.concept_type == "class" || concept.concept_type == "struct" {
                // Count methods in this class
                let method_count = concepts.iter()
                    .filter(|c| c.concept_type == "method" || c.concept_type == "function")
                    .filter(|c| c.file_path == concept.file_path)
                    .filter(|c| c.line_range.start >= concept.line_range.start && c.line_range.end <= concept.line_range.end)
                    .count() as u32;
                    
                class_method_counts.insert(concept.name.clone(), method_count);
                
                if method_count > 20 {
                    violations.push(format!(
                        "Potential God Object: '{}' has {} methods ({}:{})",
                        concept.name,
                        method_count,
                        concept.file_path,
                        concept.line_range.start
                    ));
                }
            }
        }
        
        violations
    }

    /// Detect circular dependency violations
    fn detect_circular_dependency_violations(&self, concepts: &[SemanticConcept]) -> Vec<String> {
        let mut violations = Vec::new();
        let mut dependencies: HashMap<String, HashSet<String>> = HashMap::new();
        
        // Build dependency graph
        for concept in concepts {
            for (rel_type, target) in &concept.relationships {
                if rel_type.contains("depends") || rel_type.contains("import") {
                    dependencies.entry(concept.name.clone()).or_default().insert(target.clone());
                }
            }
        }
        
        // Simple cycle detection
        let cycles = self.detect_cycles(&dependencies);
        for cycle in cycles {
            violations.push(format!(
                "Circular dependency detected: {}",
                cycle.join(" -> ")
            ));
        }
        
        violations
    }

    /// Detect layer violations
    fn detect_layer_violations(&self, concepts: &[SemanticConcept]) -> Vec<String> {
        let mut violations = Vec::new();
        
        // Define layer hierarchy (lower numbers = higher layers)
        let layer_hierarchy = [
            ("presentation", 0),
            ("api", 0),
            ("application", 1),
            ("domain", 2),
            ("infrastructure", 3),
            ("data", 3),
        ].iter().cloned().collect::<HashMap<&str, u32>>();
        
        for concept in concepts {
            let concept_layer = self.determine_layer(&concept.file_path, &layer_hierarchy);
            
            for (rel_type, target) in &concept.relationships {
                if rel_type.contains("depends") || rel_type.contains("import") {
                    // Find target concept to determine its layer
                    if let Some(target_concept) = concepts.iter().find(|c| c.name == *target) {
                        let target_layer = self.determine_layer(&target_concept.file_path, &layer_hierarchy);
                        
                        // Check for violations (higher layer depending on lower layer)
                        if let (Some(concept_level), Some(target_level)) = (concept_layer, target_layer) {
                            if concept_level < target_level {
                                violations.push(format!(
                                    "Layer violation: {} depends on {} (higher layer depending on lower layer)",
                                    concept.name,
                                    target
                                ));
                            }
                        }
                    }
                }
            }
        }
        
        violations
    }

    /// Detect coupling violations
    fn detect_coupling_violations(&self, concepts: &[SemanticConcept]) -> Vec<String> {
        let mut violations = Vec::new();
        let mut coupling_counts: HashMap<String, u32> = HashMap::new();
        
        for concept in concepts {
            let coupling_count = concept.relationships.len() as u32;
            coupling_counts.insert(concept.name.clone(), coupling_count);
            
            if coupling_count > 10 {
                violations.push(format!(
                    "High coupling detected: '{}' has {} dependencies ({}:{})",
                    concept.name,
                    coupling_count,
                    concept.file_path,
                    concept.line_range.start
                ));
            }
        }
        
        violations
    }

    /// Helper methods
    fn extract_namespace_from_path(&self, path: &str) -> Option<String> {
        let path_obj = Path::new(path);
        path_obj.parent()?.file_name()?.to_str().map(String::from)
    }

    fn detect_cycles(&self, dependencies: &HashMap<String, HashSet<String>>) -> Vec<Vec<String>> {
        // Simple DFS-based cycle detection
        let mut cycles = Vec::new();
        let mut visited = HashSet::new();
        let mut path = Vec::new();
        
        for node in dependencies.keys() {
            if !visited.contains(node) {
                Self::dfs_cycle_detection(node, dependencies, &mut visited, &mut path, &mut cycles);
            }
        }
        
        cycles
    }

    fn dfs_cycle_detection(
        node: &str,
        dependencies: &HashMap<String, HashSet<String>>,
        visited: &mut HashSet<String>,
        path: &mut Vec<String>,
        cycles: &mut Vec<Vec<String>>,
    ) {
        if path.contains(&node.to_string()) {
            // Found a cycle
            if let Some(cycle_start) = path.iter().position(|n| n == node) {
                let cycle = path[cycle_start..].to_vec();
                cycles.push(cycle);
            }
            return;
        }
        
        if visited.contains(node) {
            return;
        }
        
        visited.insert(node.to_string());
        path.push(node.to_string());
        
        if let Some(deps) = dependencies.get(node) {
            for dep in deps {
                Self::dfs_cycle_detection(dep, dependencies, visited, path, cycles);
            }
        }
        
        path.pop();
    }

    fn determine_layer(&self, file_path: &str, layer_hierarchy: &HashMap<&str, u32>) -> Option<u32> {
        for (layer_name, level) in layer_hierarchy {
            if file_path.to_lowercase().contains(layer_name) {
                return Some(*level);
            }
        }
        None
    }

    fn calculate_file_metrics(&self, concepts: &[SemanticConcept]) -> FileMetrics {
        let mut file_concept_counts: HashMap<String, u32> = HashMap::new();
        
        for concept in concepts {
            *file_concept_counts.entry(concept.file_path.clone()).or_insert(0) += 1;
        }
        
        let total_concepts = concepts.len() as f64;
        let file_count = file_concept_counts.len() as f64;
        let avg_concepts_per_file = if file_count > 0.0 { total_concepts / file_count } else { 0.0 };
        
        FileMetrics {
            avg_concepts_per_file,
            max_concepts_per_file: file_concept_counts.values().max().copied().unwrap_or(0),
            total_files: file_count as u32,
        }
    }

    fn calculate_coupling_metrics(&self, concepts: &[SemanticConcept]) -> CouplingMetrics {
        let mut high_coupling_count = 0;
        let mut total_coupling = 0;
        
        for concept in concepts {
            let coupling = concept.relationships.len();
            total_coupling += coupling;
            
            if coupling > 8 {
                high_coupling_count += 1;
            }
        }
        
        CouplingMetrics {
            high_coupling_count,
            avg_coupling: if !concepts.is_empty() { total_coupling as f64 / concepts.len() as f64 } else { 0.0 },
        }
    }

    fn has_layer_violations(&self, concepts: &[SemanticConcept]) -> bool {
        !self.detect_layer_violations(concepts).is_empty()
    }

    fn calculate_modularity_score(&self, concepts: &[SemanticConcept]) -> f64 {
        // Enhanced modularity score based on file organization, coupling, and distribution
        let file_metrics = self.calculate_file_metrics(concepts);
        let coupling_metrics = self.calculate_coupling_metrics(concepts);
        
        // Base file organization score
        let file_score: f64 = if file_metrics.avg_concepts_per_file <= 15.0 { 0.4 } else { 0.1 };
        
        // Penalize files that are too large (monolithic)
        let max_file_penalty: f64 = if file_metrics.max_concepts_per_file > 50 { 0.2 } else { 0.0 };
        
        // Reward reasonable file distribution
        let distribution_bonus: f64 = if file_metrics.total_files >= 3 && 
                                    (concepts.len() as f64 / file_metrics.total_files as f64) < 25.0 { 
                                    0.2 
                                } else { 
                                    0.0 
                                };
        
        let coupling_score: f64 = if coupling_metrics.avg_coupling <= 5.0 { 0.4 } else { 0.1 };
        
        (file_score + distribution_bonus + coupling_score - max_file_penalty).clamp(0.0_f64, 1.0_f64)
    }

}

#[derive(Debug)]
struct FileMetrics {
    avg_concepts_per_file: f64,
    max_concepts_per_file: u32,
    total_files: u32,
}

#[derive(Debug)]
struct CouplingMetrics {
    high_coupling_count: u32,
    avg_coupling: f64,
}

impl PatternExtractor for StructuralPatternAnalyzer {
    fn extract_patterns(&self, path: &str) -> Result<Vec<Pattern>, ParseError> {
        let mut analyzer = self.clone();
        analyzer.analyze_codebase_structure(path)
    }
}

impl Clone for StructuralPatternAnalyzer {
    fn clone(&self) -> Self {
        StructuralPatternAnalyzer {
            patterns: self.patterns.clone(),
            architecture_signatures: self.architecture_signatures.clone(),
        }
    }
}

impl Default for StructuralPatternAnalyzer {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;
    use tempfile::TempDir;
    use std::fs;

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
    fn test_structural_pattern_analyzer_creation() {
        let analyzer = StructuralPatternAnalyzer::new();
        assert!(!analyzer.architecture_signatures.is_empty());
    }

    #[test]
    fn test_mvc_pattern_detection() {
        let temp_dir = TempDir::new().unwrap();
        let base_path = temp_dir.path();
        
        // Create MVC directory structure
        fs::create_dir_all(base_path.join("models")).unwrap();
        fs::create_dir_all(base_path.join("views")).unwrap();
        fs::create_dir_all(base_path.join("controllers")).unwrap();
        
        // Create some files
        fs::write(base_path.join("models/UserModel.js"), "// User model").unwrap();
        fs::write(base_path.join("views/UserView.js"), "// User view").unwrap();
        fs::write(base_path.join("controllers/UserController.js"), "// User controller").unwrap();
        
        let mut analyzer = StructuralPatternAnalyzer::new();
        let patterns = analyzer.analyze_codebase_structure(base_path.to_str().unwrap()).unwrap();
        
        let mvc_pattern = patterns.iter().find(|p| p.id.contains("MVC"));
        assert!(mvc_pattern.is_some());
        
        if let Some(pattern) = mvc_pattern {
            assert!(pattern.confidence >= 0.7);
            assert_eq!(pattern.pattern_type, "structural");
        }
    }

    #[test]
    fn test_god_object_detection() {
        let mut concepts = Vec::new();
        
        // Create a class with many methods (God Object)
        let god_class = create_test_concept("GodClass", "class", "GodClass.js", 1, 100);
        concepts.push(god_class);
        
        // Add many methods to the same file
        for i in 0..25 {
            let method = create_test_concept(
                &format!("method{}", i),
                "method",
                "GodClass.js",
                i * 3 + 2,
                i * 3 + 4,
            );
            concepts.push(method);
        }
        
        let analyzer = StructuralPatternAnalyzer::new();
        let violations = analyzer.detect_god_object_violations(&concepts);
        
        assert!(!violations.is_empty());
        assert!(violations[0].contains("God Object"));
    }

    #[test]
    fn test_circular_dependency_detection() {
        let mut concepts = Vec::new();
        
        // Create concepts with circular dependencies
        let mut concept_a = create_test_concept("ModuleA", "class", "ModuleA.js", 1, 10);
        concept_a.relationships.insert("depends_on".to_string(), "ModuleB".to_string());
        concepts.push(concept_a);
        
        let mut concept_b = create_test_concept("ModuleB", "class", "ModuleB.js", 1, 10);
        concept_b.relationships.insert("depends_on".to_string(), "ModuleA".to_string());
        concepts.push(concept_b);
        
        let analyzer = StructuralPatternAnalyzer::new();
        let violations = analyzer.detect_circular_dependency_violations(&concepts);
        
        assert!(!violations.is_empty());
        assert!(violations[0].contains("Circular dependency"));
    }

    #[test]
    fn test_high_coupling_detection() {
        let mut concept = create_test_concept("HighlyCoupled", "class", "test.js", 1, 10);
        
        // Add many dependencies
        for i in 0..15 {
            concept.relationships.insert(format!("depends_{}", i), format!("Dependency{}", i));
        }
        
        let concepts = vec![concept];
        let analyzer = StructuralPatternAnalyzer::new();
        let violations = analyzer.detect_coupling_violations(&concepts);
        
        assert!(!violations.is_empty());
        assert!(violations[0].contains("High coupling"));
    }

    #[test]
    fn test_file_organization_analysis() {
        let concepts = vec![
            // Many concepts in one file (violation)
            create_test_concept("Concept1", "class", "large_file.js", 1, 10),
            create_test_concept("Concept2", "class", "large_file.js", 11, 20),
            create_test_concept("Concept3", "function", "large_file.js", 21, 25),
        ];
        
        // Add more concepts to trigger the pattern
        let mut all_concepts = concepts;
        for i in 4..15 {
            all_concepts.push(create_test_concept(
                &format!("Concept{}", i),
                "function",
                "large_file.js",
                i * 5,
                i * 5 + 3,
            ));
        }
        
        let analyzer = StructuralPatternAnalyzer::new();
        let patterns = analyzer.analyze_file_organization(&all_concepts);
        
        let large_file_pattern = patterns.iter().find(|p| p.id.contains("large_files"));
        assert!(large_file_pattern.is_some());
    }

    #[test]
    fn test_namespace_pattern_analysis() {
        let concepts = vec![
            create_test_concept("Service1", "class", "services/UserService.js", 1, 10),
            create_test_concept("Service2", "class", "services/OrderService.js", 1, 10),
            create_test_concept("Service3", "class", "services/PaymentService.js", 1, 10),
        ];
        
        let analyzer = StructuralPatternAnalyzer::new();
        let patterns = analyzer.analyze_naming_structure_patterns(&concepts);
        
        let namespace_pattern = patterns.iter().find(|p| p.id.contains("namespace"));
        assert!(namespace_pattern.is_some());
        
        if let Some(pattern) = namespace_pattern {
            assert!(pattern.description.contains("services"));
        }
    }

    #[test]
    fn test_modularity_score_calculation() {
        let good_concepts = vec![
            create_test_concept("Service1", "class", "service1.js", 1, 10),
            create_test_concept("Service2", "class", "service2.js", 1, 10),
        ];
        
        let bad_concepts = vec![
            create_test_concept("GodClass", "class", "god.js", 1, 10),
        ];
        
        // Add many concepts to the god class file
        let mut all_bad_concepts = bad_concepts;
        for i in 1..25 {
            all_bad_concepts.push(create_test_concept(
                &format!("Method{}", i),
                "method",
                "god.js",
                i * 2,
                i * 2 + 1,
            ));
        }
        
        let analyzer = StructuralPatternAnalyzer::new();
        
        let good_score = analyzer.calculate_modularity_score(&good_concepts);
        let bad_score = analyzer.calculate_modularity_score(&all_bad_concepts);
        
        assert!(good_score > bad_score);
        assert!(good_score >= 0.8);
        assert!(bad_score <= 0.5);
    }

    #[test]
    fn test_layer_violation_detection() {
        let mut presentation_concept = create_test_concept("UI", "class", "presentation/UI.js", 1, 10);
        presentation_concept.relationships.insert("depends_on".to_string(), "DatabaseLayer".to_string());
        
        let data_concept = create_test_concept("DatabaseLayer", "class", "data/Database.js", 1, 10);
        
        let concepts = vec![presentation_concept, data_concept];
        let analyzer = StructuralPatternAnalyzer::new();
        let violations = analyzer.detect_layer_violations(&concepts);
        
        assert!(!violations.is_empty());
        assert!(violations[0].contains("Layer violation"));
    }
}