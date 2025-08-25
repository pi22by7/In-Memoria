#[cfg(feature = "napi-bindings")]
use napi_derive::napi;
use serde::{Deserialize, Serialize};

// Simple error type for when napi is not available
#[derive(Debug)]
pub struct SimpleError {
    message: String,
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

// Conditional type aliases - use proper napi::Result when available
#[cfg(feature = "napi-bindings")]
pub type ApiResult<T> = napi::Result<T>;

#[cfg(not(feature = "napi-bindings"))]
pub type ApiResult<T> = Result<T, SimpleError>;

use std::collections::HashMap;
use std::fs;
use std::path::Path;
use walkdir::WalkDir;

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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "napi-bindings", napi(object))]
pub struct PatternExample {
    pub code: String,
    pub file_path: String,
    pub line_range: LineRange,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "napi-bindings", napi(object))]
pub struct LineRange {
    pub start: u32,
    pub end: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "napi-bindings", napi(object))]
pub struct PatternAnalysisResult {
    pub detected: Vec<String>,
    pub violations: Vec<String>,
    pub recommendations: Vec<String>,
    pub learned: Option<Vec<Pattern>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "napi-bindings", napi(object))]
pub struct ApproachPrediction {
    pub approach: String,
    pub confidence: f64,
    pub reasoning: String,
    pub patterns: Vec<String>,
    pub complexity: String,
}

// Temporarily disabled napi export
#[derive(Default)]
#[cfg_attr(feature = "napi-bindings", napi)]
pub struct PatternLearner {
    patterns: HashMap<String, Pattern>,
    #[allow(dead_code)]
    naming_patterns: HashMap<String, NamingPattern>,
    #[allow(dead_code)]
    structural_patterns: HashMap<String, StructuralPattern>,
    #[allow(dead_code)]
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

// Temporarily disabled napi export
#[cfg_attr(feature = "napi-bindings", napi)]
impl PatternLearner {
    #[cfg_attr(feature = "napi-bindings", napi(constructor))]
    pub fn new() -> Self {
        Self::default()
    }

    // napi-exported methods for JavaScript integration
    #[cfg_attr(feature = "napi-bindings", napi)]
    pub async unsafe fn learn_from_codebase(&mut self, path: String) -> ApiResult<Vec<Pattern>> {
        self.learn_from_codebase_internal(path).await
    }

    // Internal implementation that works without napi
    pub async fn learn_from_codebase_internal(&mut self, path: String) -> ApiResult<Vec<Pattern>> {
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

    // Temporarily disabled napi export
    pub async fn extract_patterns_internal(&self, _path: String) -> ApiResult<Vec<Pattern>> {
        // Extract patterns from a specific path
        let mut patterns = Vec::new();

        // Analyze files in the path and extract patterns
        // This is a simplified implementation
        patterns.push(Pattern {
            id: format!(
                "pattern_{}",
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_millis()
            ),
            pattern_type: "naming_convention".to_string(),
            description: "Consistent camelCase usage for functions".to_string(),
            frequency: 15,
            confidence: 0.85,
            examples: vec![PatternExample {
                code: "function calculateTotal() {}".to_string(),
                file_path: "src/utils.ts".to_string(),
                line_range: LineRange { start: 10, end: 10 },
            }],
            contexts: vec!["typescript".to_string(), "function".to_string()],
        });

        Ok(patterns)
    }

    // Temporarily disabled napi export
    pub async fn analyze_file_change_internal(
        &self,
        change_data: String,
    ) -> ApiResult<PatternAnalysisResult> {
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

    // Temporarily disabled napi export
    pub async fn find_relevant_patterns_internal(
        &self,
        problem_description: String,
        current_file: Option<String>,
        selected_code: Option<String>,
    ) -> ApiResult<Vec<Pattern>> {
        let mut relevant_patterns = Vec::new();

        // Analyze problem description for keywords
        let keywords = self.extract_keywords(&problem_description);

        // Find patterns matching the context
        for pattern in self.patterns.values() {
            let relevance_score =
                self.calculate_pattern_relevance(pattern, &keywords, &current_file, &selected_code);

            if relevance_score > 0.5 {
                relevant_patterns.push(pattern.clone());
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

    // Temporarily disabled napi export
    pub async fn predict_approach_internal(
        &self,
        problem_description: String,
        context: HashMap<String, String>,
    ) -> ApiResult<ApproachPrediction> {
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

    /// Updates patterns based on analysis data
    ///
    /// # Safety
    /// This function uses unsafe because it needs to interact with the Node.js runtime
    /// through N-API bindings. The caller must ensure the analysis data is valid JSON.
    // Temporarily disabled napi export
    pub async unsafe fn learn_from_analysis(&mut self, _analysis_data: String) -> ApiResult<bool> {
        // Learn from change analysis results
        // This would update pattern frequencies and discover new patterns
        Ok(true)
    }

    /// Updates patterns based on file changes
    ///
    /// # Safety
    /// This function uses unsafe because it needs to interact with the Node.js runtime
    /// through N-API bindings. The caller must ensure the change data is valid JSON.
    // Temporarily disabled napi export
    pub async unsafe fn update_from_change(&mut self, _change_data: String) -> ApiResult<bool> {
        // Update patterns based on file changes
        Ok(true)
    }

    async fn learn_naming_patterns(&mut self, path: &str) -> ApiResult<Vec<Pattern>> {
        let mut patterns = Vec::new();
        let mut naming_stats = HashMap::new();

        // Scan all files to learn naming patterns
        for entry in WalkDir::new(path).into_iter().filter_map(|e| e.ok()) {
            if entry.file_type().is_file() && self.should_analyze_file(entry.path()) {
                if let Ok(content) = fs::read_to_string(entry.path()) {
                    let file_naming_patterns =
                        self.analyze_naming_in_file(&content, entry.path().to_str().unwrap_or(""));

                    for (pattern_name, examples) in file_naming_patterns {
                        let entry = naming_stats.entry(pattern_name).or_insert_with(Vec::new);
                        entry.extend(examples);
                    }
                }
            }
        }

        // Convert statistics to patterns
        for (pattern_type, examples) in naming_stats {
            if examples.len() >= 3 {
                // Only patterns with multiple examples
                let confidence = self.calculate_naming_confidence(&examples);

                patterns.push(Pattern {
                    id: format!("naming_{}_{}", pattern_type, self.generate_pattern_id()),
                    pattern_type: format!("naming_{}", pattern_type),
                    description: self.describe_naming_pattern(&pattern_type),
                    frequency: examples.len() as u32,
                    confidence,
                    examples: examples.into_iter().take(5).collect(), // Keep top 5 examples
                    contexts: self.infer_naming_contexts(&pattern_type),
                });
            }
        }

        Ok(patterns)
    }

    fn should_analyze_file(&self, file_path: &Path) -> bool {
        // Skip common non-source directories
        let path_str = file_path.to_string_lossy();
        if path_str.contains("node_modules")
            || path_str.contains(".git")
            || path_str.contains("target")
            || path_str.contains("dist")
            || path_str.contains("build")
        {
            return false;
        }

        // Check if file extension is supported
        if let Some(extension) = file_path.extension().and_then(|s| s.to_str()) {
            matches!(
                extension.to_lowercase().as_str(),
                "ts" | "tsx" | "js" | "jsx" | "rs" | "py" | "go" | "java"
            )
        } else {
            false
        }
    }

    fn analyze_naming_in_file(
        &self,
        content: &str,
        file_path: &str,
    ) -> HashMap<String, Vec<PatternExample>> {
        let mut patterns = HashMap::new();
        let lines: Vec<&str> = content.lines().collect();

        for (line_num, line) in lines.iter().enumerate() {
            let line_number = (line_num + 1) as u32;

            // Analyze function names
            if let Some(function_names) = self.extract_function_names(line) {
                for name in function_names {
                    let pattern_type = self.classify_naming_pattern(&name, "function");
                    let examples = patterns
                        .entry(format!("function_{}", pattern_type))
                        .or_insert_with(Vec::new);

                    examples.push(PatternExample {
                        code: line.trim().to_string(),
                        file_path: file_path.to_string(),
                        line_range: LineRange {
                            start: line_number,
                            end: line_number,
                        },
                    });
                }
            }

            // Analyze class names
            if let Some(class_names) = self.extract_class_names(line) {
                for name in class_names {
                    let pattern_type = self.classify_naming_pattern(&name, "class");
                    let examples = patterns
                        .entry(format!("class_{}", pattern_type))
                        .or_insert_with(Vec::new);

                    examples.push(PatternExample {
                        code: line.trim().to_string(),
                        file_path: file_path.to_string(),
                        line_range: LineRange {
                            start: line_number,
                            end: line_number,
                        },
                    });
                }
            }

            // Analyze variable names
            if let Some(variable_names) = self.extract_variable_names(line) {
                for name in variable_names {
                    let pattern_type = self.classify_naming_pattern(&name, "variable");
                    let examples = patterns
                        .entry(format!("variable_{}", pattern_type))
                        .or_insert_with(Vec::new);

                    examples.push(PatternExample {
                        code: line.trim().to_string(),
                        file_path: file_path.to_string(),
                        line_range: LineRange {
                            start: line_number,
                            end: line_number,
                        },
                    });
                }
            }
        }

        patterns
    }

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
            && name.chars().next().unwrap().is_alphabetic()
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
        name.chars().next().unwrap().is_lowercase()
            && name.contains(char::is_uppercase)
            && !name.contains('_')
            && !name.contains('-')
    }

    fn is_pascal_case(&self, name: &str) -> bool {
        name.chars().next().unwrap().is_uppercase() && !name.contains('_') && !name.contains('-')
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

    fn calculate_naming_confidence(&self, examples: &[PatternExample]) -> f64 {
        // Higher confidence for more examples and consistency
        let base_confidence = (examples.len() as f64 / 10.0).min(0.8);
        let consistency_bonus = if examples.len() > 10 { 0.1 } else { 0.0 };

        (base_confidence + consistency_bonus).min(0.95)
    }

    fn describe_naming_pattern(&self, pattern_type: &str) -> String {
        match pattern_type {
            s if s.contains("camelCase") => "Consistent use of camelCase naming".to_string(),
            s if s.contains("PascalCase") => "Consistent use of PascalCase naming".to_string(),
            s if s.contains("snake_case") => "Consistent use of snake_case naming".to_string(),
            s if s.contains("kebab-case") => "Consistent use of kebab-case naming".to_string(),
            s if s.contains("UPPER_CASE") => "Consistent use of UPPER_CASE naming".to_string(),
            _ => "Mixed naming convention pattern".to_string(),
        }
    }

    fn infer_naming_contexts(&self, pattern_type: &str) -> Vec<String> {
        let mut contexts = vec!["naming".to_string()];

        if pattern_type.contains("function") {
            contexts.push("function".to_string());
        }
        if pattern_type.contains("class") {
            contexts.push("class".to_string());
        }
        if pattern_type.contains("variable") {
            contexts.push("variable".to_string());
        }

        contexts
    }

    fn generate_pattern_id(&self) -> String {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis()
            .to_string()
    }

    async fn learn_structural_patterns(&mut self, path: &str) -> ApiResult<Vec<Pattern>> {
        let mut patterns = Vec::new();

        // Analyze directory structure
        let directory_structure = self.analyze_directory_structure(path)?;
        patterns.extend(directory_structure);

        // Analyze file organization patterns
        let file_organization = self.analyze_file_organization(path)?;
        patterns.extend(file_organization);

        // Analyze import/dependency patterns
        let dependency_patterns = self.analyze_dependency_patterns(path)?;
        patterns.extend(dependency_patterns);

        Ok(patterns)
    }

    fn analyze_directory_structure(&self, path: &str) -> ApiResult<Vec<Pattern>> {
        let mut patterns = Vec::new();
        let mut directory_stats = HashMap::new();

        // Analyze directory structure
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

        // Common patterns
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

    fn analyze_file_organization(&self, path: &str) -> ApiResult<Vec<Pattern>> {
        let mut patterns = Vec::new();
        let mut file_types = HashMap::new();

        // Count file types and their locations
        for entry in WalkDir::new(path).into_iter().filter_map(|e| e.ok()) {
            if entry.file_type().is_file() {
                if let Some(extension) = entry.path().extension().and_then(|s| s.to_str()) {
                    let dir = entry
                        .path()
                        .parent()
                        .unwrap_or(Path::new(""))
                        .to_string_lossy();
                    let entry = file_types
                        .entry(extension.to_string())
                        .or_insert_with(HashMap::new);
                    *entry.entry(dir.to_string()).or_insert(0) += 1;
                }
            }
        }

        // Detect co-location patterns
        for (ext, locations) in file_types {
            if locations.len() == 1 && locations.values().next().unwrap() > &3 {
                patterns.push(Pattern {
                    id: format!("org_colocation_{}_{}", ext, self.generate_pattern_id()),
                    pattern_type: format!("organization_colocation_{}", ext),
                    description: format!(
                        "{} files are consistently co-located in specific directories",
                        ext
                    ),
                    frequency: *locations.values().next().unwrap(),
                    confidence: 0.7,
                    examples: vec![],
                    contexts: vec!["organization".to_string(), ext],
                });
            }
        }

        Ok(patterns)
    }

    fn analyze_dependency_patterns(&self, path: &str) -> ApiResult<Vec<Pattern>> {
        let mut patterns = Vec::new();
        let mut import_patterns = HashMap::new();

        // Analyze import statements across files
        for entry in WalkDir::new(path).into_iter().filter_map(|e| e.ok()) {
            if entry.file_type().is_file() && self.should_analyze_file(entry.path()) {
                if let Ok(content) = fs::read_to_string(entry.path()) {
                    let imports = self.extract_imports(&content);
                    for import in imports {
                        *import_patterns.entry(import).or_insert(0) += 1;
                    }
                }
            }
        }

        // Find common import patterns
        let frequent_imports: Vec<_> = import_patterns
            .iter()
            .filter(|(_, &count)| count >= 3)
            .collect();

        if !frequent_imports.is_empty() {
            patterns.push(Pattern {
                id: format!("dep_common_{}", self.generate_pattern_id()),
                pattern_type: "dependency_common_imports".to_string(),
                description: "Consistent use of common dependencies across files".to_string(),
                frequency: frequent_imports.len() as u32,
                confidence: 0.6,
                examples: vec![],
                contexts: vec!["dependencies".to_string(), "imports".to_string()],
            });
        }

        Ok(patterns)
    }

    fn extract_imports(&self, content: &str) -> Vec<String> {
        let mut imports = Vec::new();

        for line in content.lines() {
            let line = line.trim();

            // TypeScript/JavaScript imports
            if line.starts_with("import ") && line.contains(" from ") {
                if let Some(from_pos) = line.rfind(" from ") {
                    let import_path =
                        &line[from_pos + 6..].trim_matches(&[' ', '"', '\'', ';'][..]);
                    if !import_path.starts_with('.') {
                        // External dependencies
                        imports.push(
                            import_path
                                .split('/')
                                .next()
                                .unwrap_or(import_path)
                                .to_string(),
                        );
                    }
                }
            }

            // Python imports
            if line.starts_with("from ") && line.contains(" import ") {
                if let Some(import_pos) = line.find(" import ") {
                    let module = &line[5..import_pos].trim();
                    if !module.starts_with('.') {
                        // External dependencies
                        imports.push(module.split('.').next().unwrap_or(module).to_string());
                    }
                }
            }

            if line.starts_with("import ") && !line.contains(" from ") {
                let module = &line[7..].trim_matches(&[' ', ';'][..]);
                if !module.starts_with('.') {
                    imports.push(module.split('.').next().unwrap_or(module).to_string());
                }
            }
        }

        imports
    }

    fn is_ignored_directory(&self, dir_name: &str) -> bool {
        matches!(
            dir_name,
            "node_modules" | ".git" | "target" | "dist" | "build" | ".next" | "__pycache__"
        )
    }

    async fn learn_implementation_patterns(&mut self, path: &str) -> ApiResult<Vec<Pattern>> {
        let mut patterns = Vec::new();
        let mut implementation_stats = HashMap::new();

        // Analyze files for implementation patterns
        for entry in WalkDir::new(path).into_iter().filter_map(|e| e.ok()) {
            if entry.file_type().is_file() && self.should_analyze_file(entry.path()) {
                if let Ok(content) = fs::read_to_string(entry.path()) {
                    let file_patterns = self.detect_implementation_patterns(
                        &content,
                        entry.path().to_str().unwrap_or(""),
                    );

                    for (pattern_name, examples) in file_patterns {
                        let entry = implementation_stats
                            .entry(pattern_name)
                            .or_insert_with(Vec::new);
                        entry.extend(examples);
                    }
                }
            }
        }

        // Convert detected patterns to Pattern structs
        for (pattern_type, examples) in implementation_stats {
            if examples.len() >= 2 {
                // Patterns need at least 2 examples
                let confidence = self.calculate_implementation_confidence(&pattern_type, &examples);

                patterns.push(Pattern {
                    id: format!("impl_{}_{}", pattern_type, self.generate_pattern_id()),
                    pattern_type: format!("implementation_{}", pattern_type),
                    description: self.describe_implementation_pattern(&pattern_type),
                    frequency: examples.len() as u32,
                    confidence,
                    examples: examples.into_iter().take(3).collect(),
                    contexts: self.infer_implementation_contexts(&pattern_type),
                });
            }
        }

        Ok(patterns)
    }

    fn detect_implementation_patterns(
        &self,
        content: &str,
        file_path: &str,
    ) -> HashMap<String, Vec<PatternExample>> {
        let mut patterns = HashMap::new();
        let lines: Vec<&str> = content.lines().collect();

        for (line_num, line) in lines.iter().enumerate() {
            let line_number = (line_num + 1) as u32;

            // Detect various implementation patterns

            // Singleton pattern
            if self.is_singleton_pattern(line, &lines, line_num) {
                let examples = patterns
                    .entry("singleton".to_string())
                    .or_insert_with(Vec::new);
                examples.push(PatternExample {
                    code: line.trim().to_string(),
                    file_path: file_path.to_string(),
                    line_range: LineRange {
                        start: line_number,
                        end: line_number,
                    },
                });
            }

            // Factory pattern
            if self.is_factory_pattern(line) {
                let examples = patterns
                    .entry("factory".to_string())
                    .or_insert_with(Vec::new);
                examples.push(PatternExample {
                    code: line.trim().to_string(),
                    file_path: file_path.to_string(),
                    line_range: LineRange {
                        start: line_number,
                        end: line_number,
                    },
                });
            }

            // Observer pattern
            if self.is_observer_pattern(line) {
                let examples = patterns
                    .entry("observer".to_string())
                    .or_insert_with(Vec::new);
                examples.push(PatternExample {
                    code: line.trim().to_string(),
                    file_path: file_path.to_string(),
                    line_range: LineRange {
                        start: line_number,
                        end: line_number,
                    },
                });
            }

            // Builder pattern
            if self.is_builder_pattern(line) {
                let examples = patterns
                    .entry("builder".to_string())
                    .or_insert_with(Vec::new);
                examples.push(PatternExample {
                    code: line.trim().to_string(),
                    file_path: file_path.to_string(),
                    line_range: LineRange {
                        start: line_number,
                        end: line_number,
                    },
                });
            }

            // Strategy pattern
            if self.is_strategy_pattern(line) {
                let examples = patterns
                    .entry("strategy".to_string())
                    .or_insert_with(Vec::new);
                examples.push(PatternExample {
                    code: line.trim().to_string(),
                    file_path: file_path.to_string(),
                    line_range: LineRange {
                        start: line_number,
                        end: line_number,
                    },
                });
            }

            // Dependency injection
            if self.is_dependency_injection_pattern(line) {
                let examples = patterns
                    .entry("dependency_injection".to_string())
                    .or_insert_with(Vec::new);
                examples.push(PatternExample {
                    code: line.trim().to_string(),
                    file_path: file_path.to_string(),
                    line_range: LineRange {
                        start: line_number,
                        end: line_number,
                    },
                });
            }
        }

        patterns
    }

    fn is_singleton_pattern(&self, line: &str, _lines: &[&str], _line_num: usize) -> bool {
        line.contains("getInstance")
            || line.contains("private static instance")
            || (line.contains("private") && line.contains("constructor"))
    }

    fn is_factory_pattern(&self, line: &str) -> bool {
        line.contains("Factory")
            || line.contains("create") && (line.contains("function") || line.contains("class"))
            || line.contains("make") && (line.contains("function") || line.contains("class"))
    }

    fn is_observer_pattern(&self, line: &str) -> bool {
        line.contains("addEventListener")
            || line.contains("subscribe")
            || line.contains("observer")
            || line.contains("notify")
            || line.contains("emit")
    }

    fn is_builder_pattern(&self, line: &str) -> bool {
        line.contains("Builder")
            || (line.contains("build") && line.contains("()"))
            || line.contains("with") && line.contains("return this")
    }

    fn is_strategy_pattern(&self, line: &str) -> bool {
        line.contains("Strategy")
            || line.contains("algorithm")
            || (line.contains("execute") && line.contains("interface"))
    }

    fn is_dependency_injection_pattern(&self, line: &str) -> bool {
        line.contains("inject")
            || line.contains("@Injectable")
            || line.contains("constructor(") && line.contains("private")
            || line.contains("dependencies")
    }

    fn calculate_implementation_confidence(
        &self,
        pattern_type: &str,
        examples: &[PatternExample],
    ) -> f64 {
        let base_confidence = match pattern_type {
            "singleton" | "factory" | "builder" => 0.8,
            "observer" | "strategy" => 0.7,
            "dependency_injection" => 0.75,
            _ => 0.6,
        };

        let frequency_bonus = (examples.len() as f64 / 10.0).min(0.15);
        (base_confidence + frequency_bonus).min(0.95)
    }

    fn describe_implementation_pattern(&self, pattern_type: &str) -> String {
        match pattern_type {
            "singleton" => "Singleton pattern for ensuring single instance".to_string(),
            "factory" => "Factory pattern for object creation".to_string(),
            "observer" => "Observer pattern for event handling and notifications".to_string(),
            "builder" => "Builder pattern for constructing complex objects".to_string(),
            "strategy" => "Strategy pattern for algorithm selection".to_string(),
            "dependency_injection" => "Dependency injection for loose coupling".to_string(),
            _ => format!("{} implementation pattern detected", pattern_type),
        }
    }

    fn infer_implementation_contexts(&self, pattern_type: &str) -> Vec<String> {
        let mut contexts = vec!["implementation".to_string(), "design_pattern".to_string()];

        match pattern_type {
            "singleton" => contexts.push("creational".to_string()),
            "factory" | "builder" => contexts.push("creational".to_string()),
            "observer" | "strategy" => contexts.push("behavioral".to_string()),
            "dependency_injection" => contexts.push("architectural".to_string()),
            _ => {}
        }

        contexts
    }

    fn detect_patterns_in_change(&self, _change_data: &str) -> ApiResult<Vec<String>> {
        // Detect which patterns are present in the change
        Ok(vec!["naming_camelCase_function".to_string()])
    }

    fn detect_pattern_violations(&self, _change_data: &str) -> ApiResult<Vec<String>> {
        // Detect violations of established patterns
        Ok(vec![])
    }

    fn generate_recommendations(
        &self,
        _detected: &[String],
        _violations: &[String],
    ) -> ApiResult<Vec<String>> {
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

        for pattern in self.patterns.values() {
            for keyword in keywords {
                if pattern.description.to_lowercase().contains(keyword)
                    || pattern.pattern_type.to_lowercase().contains(keyword)
                {
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pattern_learner_creation() {
        let learner = PatternLearner::new();
        assert!(learner.patterns.is_empty());
        assert!(learner.naming_patterns.is_empty());
        assert!(learner.structural_patterns.is_empty());
        assert!(learner.implementation_patterns.is_empty());
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
}
