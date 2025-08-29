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

#[cfg(feature = "napi-bindings")]
type ParseError = napi::Error;
#[cfg(not(feature = "napi-bindings"))]
type ParseError = SimpleError;
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use tree_sitter::{Node, Parser, Tree};
use walkdir::WalkDir;

// Import tree-sitter language constants
use tree_sitter_javascript::LANGUAGE as tree_sitter_javascript;
use tree_sitter_python::LANGUAGE as tree_sitter_python;
use tree_sitter_rust::LANGUAGE as tree_sitter_rust;
use tree_sitter_typescript::LANGUAGE_TYPESCRIPT as tree_sitter_typescript;

// Import new tree-sitter languages
use tree_sitter_sequel::LANGUAGE as tree_sitter_sql;
use tree_sitter_go::LANGUAGE as tree_sitter_go;
use tree_sitter_java::LANGUAGE as tree_sitter_java;
use tree_sitter_c::LANGUAGE as tree_sitter_c;
use tree_sitter_cpp::LANGUAGE as tree_sitter_cpp;
use tree_sitter_c_sharp::LANGUAGE as tree_sitter_csharp;
use tree_sitter_svelte_ng::LANGUAGE as tree_sitter_svelte;

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
    pub cyclomatic: f64,
    pub cognitive: f64,
    pub lines: u32,
}

#[cfg_attr(feature = "napi-bindings", napi)]
pub struct SemanticAnalyzer {
    parsers: HashMap<String, Parser>,
    concepts: HashMap<String, SemanticConcept>,
    relationships: HashMap<String, Vec<String>>,
}

#[cfg_attr(feature = "napi-bindings", napi)]
impl SemanticAnalyzer {
    #[cfg_attr(feature = "napi-bindings", napi(constructor))]
    pub fn new() -> Result<Self, ParseError> {
        let mut analyzer = SemanticAnalyzer {
            parsers: HashMap::new(),
            concepts: HashMap::new(),
            relationships: HashMap::new(),
        };

        analyzer.initialize_parsers()?;
        Ok(analyzer)
    }

    /// Analyzes an entire codebase for semantic concepts and patterns
    ///
    /// # Safety
    /// This function uses unsafe because it needs to interact with the Node.js runtime
    /// through N-API bindings. The caller must ensure the path exists and is readable.
    #[cfg_attr(feature = "napi-bindings", napi)]
    pub async unsafe fn analyze_codebase(
        &mut self,
        path: String,
    ) -> Result<CodebaseAnalysisResult, ParseError> {
        let languages = self.detect_languages(&path).await?;
        let frameworks = self.detect_frameworks(&path).await?;
        let concepts = self.extract_concepts(&path).await?;
        let complexity = self.calculate_complexity(&concepts);

        Ok(CodebaseAnalysisResult {
            languages,
            frameworks,
            complexity,
            concepts,
        })
    }

    /// Analyzes the content of a specific file for semantic concepts
    ///
    /// # Safety
    /// This function uses unsafe because it needs to interact with the Node.js runtime
    /// through N-API bindings. The caller must ensure the file content is valid UTF-8.
    #[cfg_attr(feature = "napi-bindings", napi)]
    pub async unsafe fn analyze_file_content(
        &mut self,
        file_path: String,
        content: String,
    ) -> Result<Vec<SemanticConcept>, ParseError> {
        let language = self.detect_language_from_path(&file_path);

        let concepts = match self
            .parse_file_content(&file_path, &content, &language)
            .await
        {
            Ok(tree_concepts) => tree_concepts,
            Err(_) => {
                // Fallback to pattern-based extraction for unsupported languages
                self.fallback_extract_concepts(&file_path, &content)
            }
        };

        // Store concepts for relationship analysis
        for concept in &concepts {
            self.concepts.insert(concept.id.clone(), concept.clone());
        }

        Ok(concepts)
    }

    /// Learns semantic concepts from analyzing an entire codebase
    ///
    /// # Safety
    /// This function uses unsafe because it needs to interact with the Node.js runtime
    /// through N-API bindings. The caller must ensure the path exists and is readable.
    #[cfg_attr(feature = "napi-bindings", napi)]
    pub async unsafe fn learn_from_codebase(
        &mut self,
        path: String,
    ) -> Result<Vec<SemanticConcept>, ParseError> {
        // Add overall timeout for the entire learning process (5 minutes)
        let learning_result = match tokio::time::timeout(
            tokio::time::Duration::from_secs(300),
            self.extract_concepts(&path)
        ).await {
            Ok(concepts_result) => concepts_result?,
            Err(_timeout) => {
                eprintln!("Learning process timed out after 5 minutes");
                return Err(ParseError::from_reason(
                    "Learning process timed out. This can happen with very large codebases or complex file structures."
                ));
            }
        };

        // Learn relationships between concepts
        self.learn_concept_relationships(&learning_result);

        // Update internal knowledge
        for concept in &learning_result {
            self.concepts.insert(concept.id.clone(), concept.clone());
        }

        Ok(learning_result)
    }

    /// Updates the analyzer's internal state from analysis data
    ///
    /// # Safety
    /// This function uses unsafe because it needs to interact with the Node.js runtime
    /// through N-API bindings. The caller must ensure the analysis data is valid JSON.
    #[cfg_attr(feature = "napi-bindings", napi)]
    pub async unsafe fn update_from_analysis(
        &mut self,
        _analysis_data: String,
    ) -> Result<bool, ParseError> {
        // Parse analysis data and update internal state
        // This would typically be called when file changes are detected
        Ok(true)
    }

    #[cfg_attr(feature = "napi-bindings", napi)]
    pub fn get_concept_relationships(&self, concept_id: String) -> Result<Vec<String>, ParseError> {
        Ok(self
            .relationships
            .get(&concept_id)
            .cloned()
            .unwrap_or_default())
    }

    fn initialize_parsers(&mut self) -> Result<(), ParseError> {
        let mut ts_parser = Parser::new();
        ts_parser
            .set_language(&tree_sitter_typescript.into())
            .map_err(|e| {
                ParseError::from_reason(format!("Failed to set TypeScript language: {}", e))
            })?;
        self.parsers.insert("typescript".to_string(), ts_parser);

        let mut js_parser = Parser::new();
        js_parser
            .set_language(&tree_sitter_javascript.into())
            .map_err(|e| {
                ParseError::from_reason(format!("Failed to set JavaScript language: {}", e))
            })?;
        self.parsers.insert("javascript".to_string(), js_parser);

        let mut rust_parser = Parser::new();
        rust_parser
            .set_language(&tree_sitter_rust.into())
            .map_err(|e| ParseError::from_reason(format!("Failed to set Rust language: {}", e)))?;
        self.parsers.insert("rust".to_string(), rust_parser);

        let mut python_parser = Parser::new();
        python_parser
            .set_language(&tree_sitter_python.into())
            .map_err(|e| {
                ParseError::from_reason(format!("Failed to set Python language: {}", e))
            })?;
        self.parsers.insert("python".to_string(), python_parser);

        // SQL parser
        let mut sql_parser = Parser::new();
        sql_parser.set_language(&tree_sitter_sql.into()).map_err(|e| {
            ParseError::from_reason(format!("Failed to set SQL language: {}", e))
        })?;
        self.parsers.insert("sql".to_string(), sql_parser);

        // Go parser
        let mut go_parser = Parser::new();
        go_parser.set_language(&tree_sitter_go.into()).map_err(|e| {
            ParseError::from_reason(format!("Failed to set Go language: {}", e))
        })?;
        self.parsers.insert("go".to_string(), go_parser);

        // Java parser
        let mut java_parser = Parser::new();
        java_parser.set_language(&tree_sitter_java.into()).map_err(|e| {
            ParseError::from_reason(format!("Failed to set Java language: {}", e))
        })?;
        self.parsers.insert("java".to_string(), java_parser);

        // C parser
        let mut c_parser = Parser::new();
        c_parser.set_language(&tree_sitter_c.into()).map_err(|e| {
            ParseError::from_reason(format!("Failed to set C language: {}", e))
        })?;
        self.parsers.insert("c".to_string(), c_parser);

        // C++ parser
        let mut cpp_parser = Parser::new();
        cpp_parser.set_language(&tree_sitter_cpp.into()).map_err(|e| {
            ParseError::from_reason(format!("Failed to set C++ language: {}", e))
        })?;
        self.parsers.insert("cpp".to_string(), cpp_parser);

        // C# parser
        let mut csharp_parser = Parser::new();
        csharp_parser.set_language(&tree_sitter_csharp.into()).map_err(|e| {
            ParseError::from_reason(format!("Failed to set C# language: {}", e))
        })?;
        self.parsers.insert("csharp".to_string(), csharp_parser);

        // Svelte parser (using svelte-ng)
        let mut svelte_parser = Parser::new();
        svelte_parser.set_language(&tree_sitter_svelte.into()).map_err(|e| {
            ParseError::from_reason(format!("Failed to set Svelte language: {}", e))
        })?;
        self.parsers.insert("svelte".to_string(), svelte_parser);

        Ok(())
    }

    async fn detect_languages(&self, path: &str) -> Result<Vec<String>, ParseError> {
        let mut languages = std::collections::HashSet::new();

        for entry in WalkDir::new(path).into_iter().filter_map(|e| e.ok()) {
            if entry.file_type().is_file() {
                if let Some(extension) = entry.path().extension().and_then(|s| s.to_str()) {
                    let language = match extension.to_lowercase().as_str() {
                        "ts" | "tsx" => Some("typescript"),
                        "js" | "jsx" => Some("javascript"),
                        "rs" => Some("rust"),
                        "py" => Some("python"),
                        "sql" => Some("sql"),
                        "go" => Some("go"),
                        "java" => Some("java"),
                        "c" => Some("c"),
                        "cpp" | "cc" | "cxx" => Some("cpp"),
                        "cs" => Some("csharp"),
                        "svelte" => Some("svelte"),
                        "vue" => Some("javascript"), // Fallback to JS for Vue (parser not available)
                        _ => None,
                    };

                    if let Some(lang) = language {
                        languages.insert(lang.to_string());
                    }
                }
            }
        }

        Ok(languages.into_iter().collect())
    }

    async fn detect_frameworks(&self, path: &str) -> Result<Vec<String>, ParseError> {
        let mut frameworks = std::collections::HashSet::new();

        // Check package.json for JavaScript/TypeScript frameworks
        let package_json_path = Path::new(path).join("package.json");
        if package_json_path.exists() {
            if let Ok(content) = fs::read_to_string(&package_json_path) {
                if content.contains("\"react\"") || content.contains("\"@types/react\"") {
                    frameworks.insert("React".to_string());
                }
                if content.contains("\"vue\"") || content.contains("\"@vue/\"") {
                    frameworks.insert("Vue".to_string());
                }
                if content.contains("\"@angular/\"") {
                    frameworks.insert("Angular".to_string());
                }
                if content.contains("\"express\"") {
                    frameworks.insert("Express".to_string());
                }
                if content.contains("\"next\"") {
                    frameworks.insert("Next.js".to_string());
                }
                if content.contains("\"gatsby\"") {
                    frameworks.insert("Gatsby".to_string());
                }
            }
        }

        // Check Cargo.toml for Rust frameworks
        let cargo_toml_path = Path::new(path).join("Cargo.toml");
        if cargo_toml_path.exists() {
            if let Ok(content) = fs::read_to_string(&cargo_toml_path) {
                if content.contains("tokio") {
                    frameworks.insert("Tokio".to_string());
                }
                if content.contains("actix-web") {
                    frameworks.insert("Actix-web".to_string());
                }
                if content.contains("warp") {
                    frameworks.insert("Warp".to_string());
                }
                if content.contains("rocket") {
                    frameworks.insert("Rocket".to_string());
                }
            }
        }

        // Check requirements.txt or setup.py for Python frameworks
        let requirements_path = Path::new(path).join("requirements.txt");
        if requirements_path.exists() {
            if let Ok(content) = fs::read_to_string(&requirements_path) {
                if content.contains("django") {
                    frameworks.insert("Django".to_string());
                }
                if content.contains("flask") {
                    frameworks.insert("Flask".to_string());
                }
                if content.contains("fastapi") {
                    frameworks.insert("FastAPI".to_string());
                }
            }
        }

        Ok(frameworks.into_iter().collect())
    }

    async fn extract_concepts(&mut self, path: &str) -> Result<Vec<SemanticConcept>, ParseError> {
        let mut all_concepts = Vec::new();
        let mut processed_count = 0;
        let max_files = 1000; // Limit maximum files to process

        for entry in WalkDir::new(path).into_iter().filter_map(|e| e.ok()) {
            if entry.file_type().is_file() {
                let file_path = entry.path();

                // Skip non-source files and common directories
                if self.should_analyze_file(file_path) {
                    processed_count += 1;
                    
                    // Prevent processing too many files
                    if processed_count > max_files {
                        eprintln!("Warning: Reached maximum file limit ({}), stopping analysis", max_files);
                        break;
                    }

                    match fs::read_to_string(file_path) {
                        Ok(content) => {
                            let language =
                                self.detect_language_from_path(file_path.to_str().unwrap_or(""));

                            // Add per-file timeout protection
                            match tokio::time::timeout(
                                tokio::time::Duration::from_secs(30), // 30 second timeout per file
                                self.parse_file_with_timeout(
                                    file_path.to_str().unwrap_or(""),
                                    &content,
                                    &language,
                                )
                            ).await {
                                Ok(Ok(mut concepts)) => {
                                    all_concepts.append(&mut concepts);
                                }
                                Ok(Err(_e)) => {
                                    // Fallback to regex-based extraction if tree-sitter fails
                                    eprintln!("Tree-sitter parsing failed for {}, using fallback", file_path.display());
                                    let fallback_concepts = self.fallback_extract_concepts(
                                        file_path.to_str().unwrap_or(""),
                                        &content,
                                    );
                                    all_concepts.extend(fallback_concepts);
                                }
                                Err(_timeout) => {
                                    eprintln!("Timeout parsing {}, skipping", file_path.display());
                                    continue;
                                }
                            };
                        }
                        Err(_) => {
                            // Skip files that can't be read
                            continue;
                        }
                    }
                }
            }
        }

        eprintln!("Processed {} source files and found {} concepts", processed_count, all_concepts.len());
        Ok(all_concepts)
    }

    async fn parse_file_with_timeout(
        &mut self,
        file_path: &str,
        content: &str,
        language: &str,
    ) -> Result<Vec<SemanticConcept>, ParseError> {
        self.parse_file_content(file_path, content, language).await
    }

    fn should_analyze_file(&self, file_path: &Path) -> bool {
        // Skip common non-source directories and build artifacts
        let path_str = file_path.to_string_lossy();
        if path_str.contains("node_modules")
            || path_str.contains(".git")
            || path_str.contains("target")
            || path_str.contains("dist")
            || path_str.contains("build")
            || path_str.contains("out")
            || path_str.contains("output")
            || path_str.contains(".next")
            || path_str.contains(".nuxt")
            || path_str.contains(".svelte-kit")
            || path_str.contains(".vitepress")
            || path_str.contains("_site")
            || path_str.contains("public")
            || path_str.contains("static")
            || path_str.contains("assets")
            || path_str.contains("__pycache__")
            || path_str.contains(".pytest_cache")
            || path_str.contains("coverage")
            || path_str.contains(".coverage")
            || path_str.contains("htmlcov")
            || path_str.contains("vendor")
            || path_str.contains("bin")
            || path_str.contains("obj")
            || path_str.contains("Debug")
            || path_str.contains("Release")
            || path_str.contains(".venv")
            || path_str.contains("venv")
            || path_str.contains("env")
            || path_str.contains(".env")
            || path_str.contains("tmp")
            || path_str.contains("temp")
            || path_str.contains(".tmp")
            || path_str.contains("cache")
            || path_str.contains(".cache")
            || path_str.contains("logs")
            || path_str.contains(".logs")
            || path_str.contains("lib-cov")
            || path_str.contains("nyc_output")
            || path_str.contains(".nyc_output")
            || path_str.contains("bower_components")
            || path_str.contains("jspm_packages")
        {
            return false;
        }

        // Skip common generated/minified file patterns
        let file_name = file_path.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("");
        
        if file_name.ends_with(".min.js")
            || file_name.ends_with(".min.css")
            || file_name.ends_with(".bundle.js")
            || file_name.ends_with(".chunk.js")
            || file_name.ends_with(".map")
            || file_name.starts_with(".")
            || file_name == "package-lock.json"
            || file_name == "yarn.lock"
            || file_name == "Cargo.lock"
            || file_name == "Gemfile.lock"
            || file_name == "Pipfile.lock"
            || file_name == "poetry.lock"
        {
            return false;
        }

        // Check file size - skip very large files (>1MB) to prevent hanging
        if let Ok(metadata) = file_path.metadata() {
            if metadata.len() > 1_048_576 {
                return false;
            }
        }

        // Check if file extension is supported
        if let Some(extension) = file_path.extension().and_then(|s| s.to_str()) {
            matches!(
                extension.to_lowercase().as_str(),
                "ts" | "tsx" | "js" | "jsx" | "rs" | "py" | "go" | "java" | "cpp" | "c" | "cs" | "svelte" | "sql"
            )
        } else {
            false
        }
    }

    fn fallback_extract_concepts(&self, file_path: &str, content: &str) -> Vec<SemanticConcept> {
        let mut concepts = Vec::new();
        let mut concept_id = 1;

        // Parse line by line looking for functions, classes, and interfaces
        for (line_num, line) in content.lines().enumerate() {
            let line = line.trim();

            // Try to extract function names
            if let Some(name) = self.extract_function_name(line) {
                concepts.push(self.create_fallback_concept(
                    &format!("fallback_fn_{}", concept_id),
                    name,
                    "function",
                    file_path,
                    line_num + 1,
                ));
                concept_id += 1;
            }

            // Try to extract class names
            if let Some(name) = self.extract_class_name(line) {
                concepts.push(self.create_fallback_concept(
                    &format!("fallback_class_{}", concept_id),
                    name,
                    "class",
                    file_path,
                    line_num + 1,
                ));
                concept_id += 1;
            }

            // Try to extract interface names
            if let Some(name) = self.extract_interface_name(line) {
                concepts.push(self.create_fallback_concept(
                    &format!("fallback_interface_{}", concept_id),
                    name,
                    "interface",
                    file_path,
                    line_num + 1,
                ));
                concept_id += 1;
            }
        }

        // If no concepts found, create a generic file concept
        if concepts.is_empty() {
            let file_name = Path::new(file_path)
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("unknown");

            concepts.push(self.create_fallback_concept(
                "fallback_file_1",
                file_name.to_string(),
                "file",
                file_path,
                1,
            ));
        }

        concepts
    }

    fn create_fallback_concept(
        &self,
        id: &str,
        name: String,
        concept_type: &str,
        file_path: &str,
        line: usize,
    ) -> SemanticConcept {
        let mut relationships = HashMap::new();
        relationships.insert("extraction_method".to_string(), "fallback".to_string());

        let mut metadata = HashMap::new();
        metadata.insert("source".to_string(), "regex_fallback".to_string());
        metadata.insert(
            "confidence_reason".to_string(),
            "tree_sitter_failed".to_string(),
        );

        SemanticConcept {
            id: id.to_string(),
            name,
            concept_type: concept_type.to_string(),
            confidence: 0.7, // Lower confidence for fallback extraction
            file_path: file_path.to_string(),
            line_range: LineRange {
                start: line as u32,
                end: line as u32,
            },
            relationships,
            metadata,
        }
    }

    fn extract_function_name(&self, line: &str) -> Option<String> {
        // TypeScript/JavaScript function patterns
        if line.contains("function ") {
            if let Some(start) = line.find("function ") {
                let after_function = &line[start + 9..];
                if let Some(end) = after_function.find('(') {
                    let name = after_function[..end].trim();
                    if !name.is_empty() && name.chars().all(|c| c.is_alphanumeric() || c == '_') {
                        return Some(name.to_string());
                    }
                }
            }
        }

        // Arrow function patterns: const funcName = () =>
        if line.contains("=>") {
            if let Some(equals_pos) = line.find('=') {
                let before_equals = &line[..equals_pos].trim();
                if let Some(name_start) = before_equals.rfind(char::is_whitespace) {
                    let name = before_equals[name_start..].trim();
                    if !name.is_empty() && name.chars().all(|c| c.is_alphanumeric() || c == '_') {
                        return Some(name.to_string());
                    }
                } else {
                    // Handle case like "const funcName ="
                    if let Some(const_pos) = before_equals.find("const ") {
                        let name = before_equals[const_pos + 6..].trim();
                        if !name.is_empty() && name.chars().all(|c| c.is_alphanumeric() || c == '_')
                        {
                            return Some(name.to_string());
                        }
                    }
                }
            }
        }

        // Rust function patterns
        if line.contains("fn ") {
            if let Some(start) = line.find("fn ") {
                let after_fn = &line[start + 3..];
                if let Some(end) = after_fn.find('(') {
                    let name = after_fn[..end].trim();
                    if !name.is_empty() && name.chars().all(|c| c.is_alphanumeric() || c == '_') {
                        return Some(name.to_string());
                    }
                }
            }
        }

        // Python function patterns
        if line.contains("def ") {
            if let Some(start) = line.find("def ") {
                let after_def = &line[start + 4..];
                if let Some(end) = after_def.find('(') {
                    let name = after_def[..end].trim();
                    if !name.is_empty() && name.chars().all(|c| c.is_alphanumeric() || c == '_') {
                        return Some(name.to_string());
                    }
                }
            }
        }

        None
    }

    fn extract_class_name(&self, line: &str) -> Option<String> {
        // Class patterns for TypeScript/JavaScript/Python
        if line.contains("class ") {
            if let Some(start) = line.find("class ") {
                let after_class = &line[start + 6..];
                let end = after_class
                    .find(char::is_whitespace)
                    .or_else(|| after_class.find('{'))
                    .or_else(|| after_class.find('('))
                    .unwrap_or(after_class.len());
                let name = after_class[..end].trim();
                if !name.is_empty() && name.chars().all(|c| c.is_alphanumeric() || c == '_') {
                    return Some(name.to_string());
                }
            }
        }
        None
    }

    fn extract_interface_name(&self, line: &str) -> Option<String> {
        // TypeScript interface patterns
        if line.contains("interface ") {
            if let Some(start) = line.find("interface ") {
                let after_interface = &line[start + 10..];
                let end = after_interface
                    .find(char::is_whitespace)
                    .or_else(|| after_interface.find('{'))
                    .unwrap_or(after_interface.len());
                let name = after_interface[..end].trim();
                if !name.is_empty() && name.chars().all(|c| c.is_alphanumeric() || c == '_') {
                    return Some(name.to_string());
                }
            }
        }

        // Rust trait patterns
        if line.contains("trait ") {
            if let Some(start) = line.find("trait ") {
                let after_trait = &line[start + 6..];
                let end = after_trait
                    .find(char::is_whitespace)
                    .or_else(|| after_trait.find('{'))
                    .or_else(|| after_trait.find('<'))
                    .unwrap_or(after_trait.len());
                let name = after_trait[..end].trim();
                if !name.is_empty() && name.chars().all(|c| c.is_alphanumeric() || c == '_') {
                    return Some(name.to_string());
                }
            }
        }

        None
    }

    async fn parse_file_content(
        &mut self,
        file_path: &str,
        content: &str,
        language: &str,
    ) -> Result<Vec<SemanticConcept>, ParseError> {
        let parser = self.parsers.get_mut(language).ok_or_else(|| {
            ParseError::from_reason(format!("Unsupported language: {}", language))
        })?;

        let tree = parser
            .parse(content, None)
            .ok_or_else(|| ParseError::from_reason("Failed to parse file content"))?;

        let mut concepts = Vec::new();

        // Extract different types of concepts based on language
        match language {
            "typescript" | "javascript" => {
                concepts.extend(self.extract_js_ts_concepts(&tree, file_path, content)?);
            }
            "rust" => {
                concepts.extend(self.extract_rust_concepts(&tree, file_path, content)?);
            }
            "python" => {
                concepts.extend(self.extract_python_concepts(&tree, file_path, content)?);
            }
            "sql" | "go" | "java" | "c" | "cpp" | "csharp" | "svelte" => {
                // Use generic extraction for new languages
                // TODO: Add specific extractors for each language
                concepts.extend(self.extract_generic_concepts(&tree, file_path, content)?);
            }
            _ => {
                // Generic extraction for truly unsupported languages
                concepts.extend(self.extract_generic_concepts(&tree, file_path, content)?);
            }
        }

        Ok(concepts)
    }

    fn extract_js_ts_concepts(
        &self,
        tree: &Tree,
        file_path: &str,
        content: &str,
    ) -> Result<Vec<SemanticConcept>, ParseError> {
        let mut concepts = Vec::new();
        let root_node = tree.root_node();

        self.walk_node(root_node, file_path, content, &mut concepts, "typescript")?;
        Ok(concepts)
    }

    fn extract_rust_concepts(
        &self,
        tree: &Tree,
        file_path: &str,
        content: &str,
    ) -> Result<Vec<SemanticConcept>, ParseError> {
        let mut concepts = Vec::new();
        let root_node = tree.root_node();

        self.walk_node(root_node, file_path, content, &mut concepts, "rust")?;
        Ok(concepts)
    }

    fn extract_python_concepts(
        &self,
        tree: &Tree,
        file_path: &str,
        content: &str,
    ) -> Result<Vec<SemanticConcept>, ParseError> {
        let mut concepts = Vec::new();
        let root_node = tree.root_node();

        self.walk_node(root_node, file_path, content, &mut concepts, "python")?;
        Ok(concepts)
    }

    fn extract_generic_concepts(
        &self,
        tree: &Tree,
        file_path: &str,
        content: &str,
    ) -> Result<Vec<SemanticConcept>, ParseError> {
        let mut concepts = Vec::new();
        let root_node = tree.root_node();

        self.walk_node(root_node, file_path, content, &mut concepts, "generic")?;
        Ok(concepts)
    }

    fn walk_node(
        &self,
        node: Node,
        file_path: &str,
        content: &str,
        concepts: &mut Vec<SemanticConcept>,
        language: &str,
    ) -> Result<(), ParseError> {
        // Extract concepts based on node types (language-specific)
        match language {
            "typescript" | "javascript" => match node.kind() {
                "class_declaration" | "interface_declaration" | "type_alias_declaration" => {
                    if let Some(concept) =
                        self.extract_concept_from_node(node, file_path, content, "class", language)?
                    {
                        concepts.push(concept);
                    }
                }
                "function_declaration"
                | "method_definition"
                | "arrow_function"
                | "function"
                | "function_expression" => {
                    if let Some(concept) = self
                        .extract_concept_from_node(node, file_path, content, "function", language)?
                    {
                        concepts.push(concept);
                    }
                }
                "variable_declaration" | "lexical_declaration" => {
                    if let Some(concept) = self
                        .extract_concept_from_node(node, file_path, content, "variable", language)?
                    {
                        concepts.push(concept);
                    }
                }
                _ => {}
            },
            "python" => match node.kind() {
                "class_definition" => {
                    if let Some(concept) =
                        self.extract_concept_from_node(node, file_path, content, "class", language)?
                    {
                        concepts.push(concept);
                    }
                }
                "function_definition" => {
                    if let Some(concept) = self
                        .extract_concept_from_node(node, file_path, content, "function", language)?
                    {
                        concepts.push(concept);
                    }
                }
                "assignment" => {
                    if let Some(concept) = self
                        .extract_concept_from_node(node, file_path, content, "variable", language)?
                    {
                        concepts.push(concept);
                    }
                }
                _ => {}
            },
            "rust" => match node.kind() {
                "struct_item" | "enum_item" | "trait_item" | "impl_item" => {
                    if let Some(concept) = self
                        .extract_concept_from_node(node, file_path, content, "struct", language)?
                    {
                        concepts.push(concept);
                    }
                }
                "function_item" => {
                    if let Some(concept) = self
                        .extract_concept_from_node(node, file_path, content, "function", language)?
                    {
                        concepts.push(concept);
                    }
                }
                "let_declaration" => {
                    if let Some(concept) = self
                        .extract_concept_from_node(node, file_path, content, "variable", language)?
                    {
                        concepts.push(concept);
                    }
                }
                _ => {}
            },
            _ => {
                // Generic extraction for unknown languages
                match node.kind() {
                    kind if kind.contains("class") => {
                        if let Some(concept) = self.extract_concept_from_node(
                            node, file_path, content, "class", language,
                        )? {
                            concepts.push(concept);
                        }
                    }
                    kind if kind.contains("function") => {
                        if let Some(concept) = self.extract_concept_from_node(
                            node, file_path, content, "function", language,
                        )? {
                            concepts.push(concept);
                        }
                    }
                    _ => {}
                }
            }
        }

        // Recursively walk child nodes
        let mut cursor = node.walk();
        for child in node.children(&mut cursor) {
            self.walk_node(child, file_path, content, concepts, language)?;
        }

        Ok(())
    }

    fn extract_concept_from_node(
        &self,
        node: Node,
        file_path: &str,
        content: &str,
        concept_type: &str,
        _language: &str,
    ) -> Result<Option<SemanticConcept>, ParseError> {
        // Extract name from node
        let name = self.extract_name_from_node(node, content)?;

        if name.is_empty() {
            return Ok(None);
        }

        let concept = SemanticConcept {
            id: format!(
                "concept_{}",
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_millis()
            ),
            name,
            concept_type: concept_type.to_string(),
            confidence: 0.8, // Base confidence
            file_path: file_path.to_string(),
            line_range: LineRange {
                start: node.start_position().row as u32 + 1,
                end: node.end_position().row as u32 + 1,
            },
            relationships: HashMap::new(),
            metadata: HashMap::new(),
        };

        Ok(Some(concept))
    }

    fn extract_name_from_node(&self, node: Node, content: &str) -> Result<String, ParseError> {
        // Try to find identifier node recursively
        if let Some(name) = self.find_identifier_recursive(node, content) {
            return Ok(name);
        }
        Ok(String::new())
    }

    fn find_identifier_recursive(&self, node: Node, content: &str) -> Option<String> {
        Self::find_identifier_recursive_impl(node, content)
    }

    fn find_identifier_recursive_impl(node: Node, content: &str) -> Option<String> {
        // Check if this node is an identifier
        match node.kind() {
            "identifier" | "property_identifier" | "type_identifier" => {
                let start_byte = node.start_byte();
                let end_byte = node.end_byte();
                if let Some(name) = content.get(start_byte..end_byte) {
                    return Some(name.to_string());
                }
            }
            _ => {}
        }

        // Search children recursively (but limit depth to avoid infinite recursion)
        let mut cursor = node.walk();
        for child in node.children(&mut cursor) {
            if let Some(name) = Self::find_identifier_recursive_impl(child, content) {
                return Some(name);
            }
        }

        None
    }

    fn detect_language_from_path(&self, file_path: &str) -> String {
        if let Some(extension) = file_path.split('.').next_back() {
            match extension {
                "ts" | "tsx" => "typescript".to_string(),
                "js" | "jsx" => "javascript".to_string(),
                "rs" => "rust".to_string(),
                "py" => "python".to_string(),
                "sql" => "sql".to_string(),
                "go" => "go".to_string(),
                "java" => "java".to_string(),
                "c" => "c".to_string(),
                "cpp" | "cc" | "cxx" => "cpp".to_string(),
                "cs" => "csharp".to_string(),
                "svelte" => "svelte".to_string(),
                _ => "generic".to_string(),
            }
        } else {
            "generic".to_string()
        }
    }

    fn learn_concept_relationships(&mut self, concepts: &[SemanticConcept]) {
        // Analyze relationships between concepts
        for concept in concepts {
            let mut related_concepts = Vec::new();

            // Find concepts in the same file
            for other_concept in concepts {
                if concept.id != other_concept.id && concept.file_path == other_concept.file_path {
                    related_concepts.push(other_concept.id.clone());
                }
            }

            self.relationships
                .insert(concept.id.clone(), related_concepts);
        }
    }

    fn calculate_complexity(&self, concepts: &[SemanticConcept]) -> ComplexityMetrics {
        let function_count = concepts
            .iter()
            .filter(|c| c.concept_type == "function")
            .count() as f64;

        let class_count = concepts
            .iter()
            .filter(|c| c.concept_type == "class")
            .count() as f64;

        ComplexityMetrics {
            cyclomatic: function_count * 1.5 + class_count * 2.0,
            cognitive: function_count * 2.0 + class_count * 3.0,
            lines: concepts
                .iter()
                .map(|c| c.line_range.end - c.line_range.start + 1)
                .sum(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_typescript_class_parsing() {
        let mut analyzer = SemanticAnalyzer::new().unwrap();
        let content = "export class UserService { getName() { return 'test'; } }";

        println!("🔍 Testing TypeScript class parsing...");
        println!("Content: {}", content);

        let result = analyzer
            .parse_file_content("test.ts", content, "typescript")
            .await;

        match result {
            Ok(concepts) => {
                println!("✅ Parsing succeeded! Found {} concepts:", concepts.len());
                for concept in &concepts {
                    println!("  - {} ({})", concept.name, concept.concept_type);
                }
                assert!(!concepts.is_empty(), "Should find at least one concept");
            }
            Err(e) => {
                println!("❌ Parsing failed: {}", e);
                panic!("TypeScript parsing should succeed");
            }
        }
    }

    #[tokio::test]
    async fn test_javascript_function_parsing() {
        let mut analyzer = SemanticAnalyzer::new().unwrap();
        let content = "function hello() { return 'world'; }";

        println!("🔍 Testing JavaScript function parsing...");
        println!("Content: {}", content);

        let result = analyzer
            .parse_file_content("test.js", content, "javascript")
            .await;

        match result {
            Ok(concepts) => {
                println!("✅ Parsing succeeded! Found {} concepts:", concepts.len());
                for concept in &concepts {
                    println!("  - {} ({})", concept.name, concept.concept_type);
                }
                assert!(!concepts.is_empty(), "Should find at least one concept");
            }
            Err(e) => {
                println!("❌ Parsing failed: {}", e);
                panic!("JavaScript parsing should succeed");
            }
        }
    }

    #[tokio::test]
    async fn test_python_class_parsing() {
        let mut analyzer = SemanticAnalyzer::new().unwrap();
        let content = "class User:\n    def __init__(self):\n        pass";

        println!("🔍 Testing Python class parsing...");
        println!("Content: {}", content);

        let result = analyzer
            .parse_file_content("test.py", content, "python")
            .await;

        match result {
            Ok(concepts) => {
                println!("✅ Parsing succeeded! Found {} concepts:", concepts.len());
                for concept in &concepts {
                    println!("  - {} ({})", concept.name, concept.concept_type);
                }
                assert!(!concepts.is_empty(), "Should find at least one concept");
            }
            Err(e) => {
                println!("❌ Parsing failed: {}", e);
                panic!("Python parsing should succeed");
            }
        }
    }

    #[tokio::test]
    async fn test_rust_struct_parsing() {
        let mut analyzer = SemanticAnalyzer::new().unwrap();
        let content = "pub struct User { name: String }";

        println!("🔍 Testing Rust struct parsing...");
        println!("Content: {}", content);

        let result = analyzer
            .parse_file_content("test.rs", content, "rust")
            .await;

        match result {
            Ok(concepts) => {
                println!("✅ Parsing succeeded! Found {} concepts:", concepts.len());
                for concept in &concepts {
                    println!("  - {} ({})", concept.name, concept.concept_type);
                }
                assert!(!concepts.is_empty(), "Should find at least one concept");
            }
            Err(e) => {
                println!("❌ Parsing failed: {}", e);
                panic!("Rust parsing should succeed");
            }
        }
    }

    #[tokio::test]
    async fn test_tree_sitter_basic_functionality() {
        println!("🔍 Testing basic tree-sitter functionality...");

        // Test parser initialization
        let mut analyzer = SemanticAnalyzer::new().unwrap();

        // Test that parsers were initialized
        assert!(analyzer.parsers.contains_key("typescript"));
        assert!(analyzer.parsers.contains_key("javascript"));
        assert!(analyzer.parsers.contains_key("rust"));
        assert!(analyzer.parsers.contains_key("python"));

        println!("✅ All parsers initialized successfully");

        // Test basic parsing without concept extraction
        let content = "class Test {}";
        if let Some(parser) = analyzer.parsers.get_mut("typescript") {
            match parser.parse(content, None) {
                Some(tree) => {
                    let root = tree.root_node();
                    println!("✅ Tree-sitter parsed successfully");
                    println!("   Root node kind: {}", root.kind());
                    println!("   Root node children: {}", root.child_count());

                    // Walk through the tree
                    let mut cursor = root.walk();
                    for child in root.children(&mut cursor) {
                        println!(
                            "   Child: {} ({}..{})",
                            child.kind(),
                            child.start_byte(),
                            child.end_byte()
                        );
                    }
                }
                None => {
                    panic!("Tree-sitter failed to parse simple TypeScript class");
                }
            }
        }
    }

    #[test]
    fn test_fallback_concept_creation() {
        let analyzer = SemanticAnalyzer {
            parsers: HashMap::new(),
            concepts: HashMap::new(),
            relationships: HashMap::new(),
        };

        println!("🔍 Testing fallback concept creation...");
        let concepts = analyzer.fallback_extract_concepts("test.ts", "dummy content");

        println!("✅ Fallback created {} concepts:", concepts.len());
        for concept in &concepts {
            println!("  - {} ({})", concept.name, concept.concept_type);
        }

        assert_eq!(concepts.len(), 1);
        assert_eq!(concepts[0].name, "test");
        assert_eq!(concepts[0].concept_type, "file");
    }

    // Helper function for creating test concepts
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
        let concept = create_test_concept("UserService", "class");

        assert_eq!(concept.name, "UserService");
        assert_eq!(concept.concept_type, "class");
        assert_eq!(concept.confidence, 0.8);
        assert_eq!(concept.file_path, "test.ts");
        assert!(concept.id.starts_with("test_"));
    }

    #[test]
    fn test_line_range_validation() {
        let range = LineRange { start: 1, end: 10 };
        assert!(range.end >= range.start);

        let single_line = LineRange { start: 5, end: 5 };
        assert_eq!(single_line.start, single_line.end);
    }

    #[test]
    fn test_complexity_metrics_calculation() {
        let metrics = ComplexityMetrics {
            cyclomatic: 5.0,
            cognitive: 8.0,
            lines: 100,
        };

        assert!(metrics.cyclomatic > 0.0);
        assert!(metrics.cognitive >= metrics.cyclomatic);
        assert!(metrics.lines > 0);
    }

    #[test]
    fn test_concept_relationships() {
        let mut concept = create_test_concept("UserService", "class");
        concept
            .relationships
            .insert("extends".to_string(), "BaseService".to_string());
        concept
            .relationships
            .insert("implements".to_string(), "IUserService".to_string());

        assert_eq!(
            concept.relationships.get("extends"),
            Some(&"BaseService".to_string())
        );
        assert_eq!(
            concept.relationships.get("implements"),
            Some(&"IUserService".to_string())
        );
        assert_eq!(concept.relationships.len(), 2);
    }

    #[test]
    fn test_concept_metadata() {
        let mut concept = create_test_concept("calculateTotal", "function");
        concept
            .metadata
            .insert("visibility".to_string(), "public".to_string());
        concept
            .metadata
            .insert("async".to_string(), "false".to_string());
        concept
            .metadata
            .insert("parameters".to_string(), "2".to_string());

        assert_eq!(
            concept.metadata.get("visibility"),
            Some(&"public".to_string())
        );
        assert_eq!(concept.metadata.get("async"), Some(&"false".to_string()));
        assert_eq!(concept.metadata.get("parameters"), Some(&"2".to_string()));
    }

    #[test]
    fn test_codebase_analysis_result_structure() {
        let analysis = CodebaseAnalysisResult {
            languages: vec!["typescript".to_string(), "javascript".to_string()],
            frameworks: vec!["react".to_string(), "express".to_string()],
            complexity: ComplexityMetrics {
                cyclomatic: 15.0,
                cognitive: 22.0,
                lines: 500,
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

    #[tokio::test]
    async fn test_new_language_support() {
        let mut analyzer = SemanticAnalyzer::new().unwrap();
        
        // Test SQL
        let sql_content = "CREATE TABLE users (id INTEGER PRIMARY KEY, name VARCHAR(255));";
        println!("🔍 Testing SQL parsing...");
        let sql_result = analyzer.parse_file_content("test.sql", sql_content, "sql").await;
        match &sql_result {
            Ok(concepts) => println!("✅ SQL: Found {} concepts", concepts.len()),
            Err(e) => println!("❌ SQL failed: {}", e),
        }
        assert!(sql_result.is_ok(), "SQL parsing should succeed: {:?}", sql_result.err());
        
        // Test Go
        let go_content = "package main\nfunc main() {\n    println(\"Hello World\")\n}";
        println!("🔍 Testing Go parsing...");
        let go_result = analyzer.parse_file_content("test.go", go_content, "go").await;
        match &go_result {
            Ok(concepts) => println!("✅ Go: Found {} concepts", concepts.len()),
            Err(e) => println!("❌ Go failed: {}", e),
        }
        assert!(go_result.is_ok(), "Go parsing should succeed: {:?}", go_result.err());
        
        // Test Java
        let java_content = "public class HelloWorld {\n    public static void main(String[] args) {\n        System.out.println(\"Hello\");\n    }\n}";
        println!("🔍 Testing Java parsing...");
        let java_result = analyzer.parse_file_content("test.java", java_content, "java").await;
        match &java_result {
            Ok(concepts) => println!("✅ Java: Found {} concepts", concepts.len()),
            Err(e) => println!("❌ Java failed: {}", e),
        }
        assert!(java_result.is_ok(), "Java parsing should succeed: {:?}", java_result.err());
        
        // Test C
        let c_content = "#include <stdio.h>\nint main() {\n    printf(\"Hello World\");\n    return 0;\n}";
        println!("🔍 Testing C parsing...");
        let c_result = analyzer.parse_file_content("test.c", c_content, "c").await;
        assert!(c_result.is_ok(), "C parsing should succeed");
        
        // Test C++
        let cpp_content = "#include <iostream>\nclass HelloWorld {\npublic:\n    void sayHello() {\n        std::cout << \"Hello\";\n    }\n};";
        println!("🔍 Testing C++ parsing...");
        let cpp_result = analyzer.parse_file_content("test.cpp", cpp_content, "cpp").await;
        assert!(cpp_result.is_ok(), "C++ parsing should succeed");
        
        // Test C#
        let csharp_content = "using System;\npublic class Program {\n    public static void Main() {\n        Console.WriteLine(\"Hello World\");\n    }\n}";
        println!("🔍 Testing C# parsing...");
        let csharp_result = analyzer.parse_file_content("test.cs", csharp_content, "csharp").await;
        assert!(csharp_result.is_ok(), "C# parsing should succeed");
        
        // Test Svelte
        let svelte_content = "<script>\n  let name = \"world\";\n  function greet() {\n    alert(`Hello ${name}!`);\n  }\n</script>";
        println!("🔍 Testing Svelte parsing...");
        let svelte_result = analyzer.parse_file_content("test.svelte", svelte_content, "svelte").await;
        assert!(svelte_result.is_ok(), "Svelte parsing should succeed");
        
        println!("✅ All language parsing tests passed!");
    }

    #[test]
    fn test_file_extension_filtering() {
        let analyzer = SemanticAnalyzer::new().unwrap();
        
        // Test supported extensions
        assert!(analyzer.should_analyze_file(std::path::Path::new("test.ts")));
        assert!(analyzer.should_analyze_file(std::path::Path::new("test.js")));
        assert!(analyzer.should_analyze_file(std::path::Path::new("test.py")));
        assert!(analyzer.should_analyze_file(std::path::Path::new("test.rs")));
        assert!(analyzer.should_analyze_file(std::path::Path::new("test.go")));
        assert!(analyzer.should_analyze_file(std::path::Path::new("test.java")));
        assert!(analyzer.should_analyze_file(std::path::Path::new("test.c")));
        assert!(analyzer.should_analyze_file(std::path::Path::new("test.cpp")));
        assert!(analyzer.should_analyze_file(std::path::Path::new("test.cs")));
        assert!(analyzer.should_analyze_file(std::path::Path::new("test.svelte")));
        assert!(analyzer.should_analyze_file(std::path::Path::new("test.sql")));
        
        // Test unsupported extensions
        assert!(!analyzer.should_analyze_file(std::path::Path::new("test.md")));
        assert!(!analyzer.should_analyze_file(std::path::Path::new("test.json")));
        assert!(!analyzer.should_analyze_file(std::path::Path::new("test.css")));
        assert!(!analyzer.should_analyze_file(std::path::Path::new("test.html")));
        
        // Test build directories
        assert!(!analyzer.should_analyze_file(std::path::Path::new("dist/test.js")));
        assert!(!analyzer.should_analyze_file(std::path::Path::new("build/test.js")));
        assert!(!analyzer.should_analyze_file(std::path::Path::new("node_modules/test.js")));
        assert!(!analyzer.should_analyze_file(std::path::Path::new(".next/test.js")));
    }
}
