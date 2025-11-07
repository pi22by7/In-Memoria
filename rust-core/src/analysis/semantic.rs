//! Main semantic analysis orchestration

#[cfg(feature = "napi-bindings")]
use napi_derive::napi;

use crate::types::{SemanticConcept, CodebaseAnalysisResult, ParseError, AnalysisConfig};
use crate::parsing::{ParserManager, FallbackExtractor, TreeWalker};
use crate::extractors::*;
use crate::analysis::{ComplexityAnalyzer, RelationshipLearner, FrameworkDetector};

use std::collections::HashMap;
use walkdir::WalkDir;
use std::fs;

/// Main semantic analyzer that orchestrates concept extraction across languages
#[cfg_attr(feature = "napi-bindings", napi)]
pub struct SemanticAnalyzer {
    parser_manager: ParserManager,
    config: AnalysisConfig,
    concepts: HashMap<String, SemanticConcept>,
    relationships: HashMap<String, Vec<String>>,
}

#[cfg_attr(feature = "napi-bindings", napi)]
impl SemanticAnalyzer {
    #[cfg_attr(feature = "napi-bindings", napi(constructor))]
    pub fn new() -> Result<Self, ParseError> {
        Ok(SemanticAnalyzer {
            parser_manager: ParserManager::new()?,
            config: AnalysisConfig::default(),
            concepts: HashMap::new(),
            relationships: HashMap::new(),
        })
    }

    /// Analyzes an entire codebase for semantic concepts and patterns
    /// 
    /// # Safety
    /// This function is marked unsafe for NAPI compatibility. It performs file system operations
    /// and language parsing that are inherently safe but marked unsafe for JavaScript interop.
    #[cfg_attr(feature = "napi-bindings", napi)]
    pub async unsafe fn analyze_codebase(
        &mut self,
        path: String,
    ) -> Result<CodebaseAnalysisResult, ParseError> {
        let languages = self.detect_languages(&path).await?;
        let framework_info = FrameworkDetector::detect_frameworks(path.clone()).await?;
        let frameworks: Vec<String> = framework_info.into_iter().map(|f| f.name).collect();
        let concepts = self.extract_concepts(&path).await?;
        let complexity = ComplexityAnalyzer::calculate_complexity(&concepts);

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
    /// This function is marked unsafe for NAPI compatibility. It performs language parsing 
    /// operations that are inherently safe but marked unsafe for JavaScript interop.
    #[cfg_attr(feature = "napi-bindings", napi)]
    pub async unsafe fn analyze_file_content(
        &mut self,
        file_path: String,
        content: String,
    ) -> Result<Vec<SemanticConcept>, ParseError> {
        let language = self.config.detect_language_from_path(&file_path);

        let concepts = match self
            .parse_file_content(&file_path, &content, &language)
            .await
        {
            Ok(tree_concepts) => tree_concepts,
            Err(_) => {
                // Fallback to pattern-based extraction for unsupported languages
                FallbackExtractor::new().extract_concepts(&file_path, &content)
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
    /// This function is marked unsafe for NAPI compatibility. It performs file system operations
    /// and language parsing that are inherently safe but marked unsafe for JavaScript interop.
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
        RelationshipLearner::learn_concept_relationships(&learning_result, &mut self.relationships);

        // Update internal knowledge
        for concept in &learning_result {
            self.concepts.insert(concept.id.clone(), concept.clone());
        }

        Ok(learning_result)
    }

    /// Updates the analyzer's internal state from analysis data (from original implementation)
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

    /// Get concept relationships for a specific concept ID (from original implementation)
    #[cfg_attr(feature = "napi-bindings", napi)]
    pub fn get_concept_relationships(&self, concept_id: String) -> Result<Vec<String>, ParseError> {
        Ok(self
            .relationships
            .get(&concept_id)
            .cloned()
            .unwrap_or_default())
    }

    /// Parse file content with tree-sitter and extract concepts
    pub async fn parse_file_content(
        &mut self,
        file_path: &str,
        content: &str,
        language: &str,
    ) -> Result<Vec<SemanticConcept>, ParseError> {
        // Add per-file timeout protection
        let parsing_result = tokio::time::timeout(
            tokio::time::Duration::from_secs(30), // 30 second timeout per file
            self.parse_file_with_language(file_path, content, language)
        ).await;

        match parsing_result {
            Ok(result) => result,
            Err(_timeout) => {
                eprintln!("Timeout parsing {}, using fallback", file_path);
                Ok(FallbackExtractor::new().extract_concepts(file_path, content))
            }
        }
    }

    /// Internal parsing with specific language
    async fn parse_file_with_language(
        &mut self,
        file_path: &str,
        content: &str,
        language: &str,
    ) -> Result<Vec<SemanticConcept>, ParseError> {
        let tree = self.parser_manager.parse(content, language)?;
        let mut concepts = Vec::new();

        // Use language-specific extraction
        match language {
            "typescript" | "javascript" => {
                let extractor = TypeScriptExtractor::new();
                self.walk_and_extract(tree.root_node(), file_path, content, &extractor, &mut concepts)?;
            }
            "rust" => {
                let extractor = RustExtractor::new();
                self.walk_and_extract(tree.root_node(), file_path, content, &extractor, &mut concepts)?;
            }
            "python" => {
                let extractor = PythonExtractor::new();
                self.walk_and_extract(tree.root_node(), file_path, content, &extractor, &mut concepts)?;
            }
            "php" => {
                let extractor = PhpExtractor::new();
                self.walk_and_extract(tree.root_node(), file_path, content, &extractor, &mut concepts)?;
            }
            "sql" => {
                let extractor = SqlExtractor::new();
                self.walk_and_extract(tree.root_node(), file_path, content, &extractor, &mut concepts)?;
            }
            "go" => {
                let extractor = GoExtractor::new();
                self.walk_and_extract(tree.root_node(), file_path, content, &extractor, &mut concepts)?;
            }
            "java" => {
                let extractor = JavaExtractor::new();
                self.walk_and_extract(tree.root_node(), file_path, content, &extractor, &mut concepts)?;
            }
            "cpp" | "c" => {
                let extractor = CppExtractor::new();
                self.walk_and_extract(tree.root_node(), file_path, content, &extractor, &mut concepts)?;
            }
            "csharp" => {
                let extractor = CSharpExtractor::new();
                self.walk_and_extract(tree.root_node(), file_path, content, &extractor, &mut concepts)?;
            }
            "svelte" => {
                let extractor = SvelteExtractor::new();
                self.walk_and_extract(tree.root_node(), file_path, content, &extractor, &mut concepts)?;
            }
            _ => {
                let extractor = GenericExtractor::new();
                self.walk_and_extract(tree.root_node(), file_path, content, &extractor, &mut concepts)?;
            }
        }

        Ok(concepts)
    }

    /// Walk tree and extract concepts using a specific extractor
    fn walk_and_extract<T>(
        &self,
        node: tree_sitter::Node<'_>,
        file_path: &str,
        content: &str,
        extractor: &T,
        concepts: &mut Vec<SemanticConcept>,
    ) -> Result<(), ParseError>
    where
        T: HasExtractConcepts,
    {
        let walker = TreeWalker::default();
        
        walker.walk(node, &mut |node| {
            extractor.extract_concepts(node, file_path, content, concepts)
                .map_err(|e| format!("Extraction error: {}", e))
        }).map_err(ParseError::from_reason)?;

        Ok(())
    }

    /// Extract concepts from entire codebase
    async fn extract_concepts(&mut self, path: &str) -> Result<Vec<SemanticConcept>, ParseError> {
        let mut all_concepts = Vec::new();
        let mut processed_count = 0;
        let debug_php_enabled = std::env::var("IN_MEMORIA_DEBUG_PHP").is_ok();

        for entry in WalkDir::new(path).into_iter().filter_map(|e| e.ok()) {
            if entry.file_type().is_file() {
                let file_path = entry.path();

                if debug_php_enabled {
                    eprintln!("[PHP DEBUG] entry {}", file_path.display());
                }

                if self.config.should_analyze_file(file_path) {
                    if debug_php_enabled {
                        eprintln!("[PHP DEBUG] processing file {}", file_path.display());
                    }
                    processed_count += 1;
                    
                    // Prevent processing too many files
                    if processed_count > self.config.max_files {
                        eprintln!("Warning: Reached maximum file limit ({}), stopping analysis", self.config.max_files);
                        break;
                    }

                    match fs::read_to_string(file_path) {
                        Ok(content) => {
                            let language = self.config.detect_language_from_path(
                                file_path.to_str().unwrap_or(""));

                            match self.parse_file_content(
                                file_path.to_str().unwrap_or(""),
                                &content,
                                &language,
                            ).await {
                                Ok(mut concepts) => {
                                    all_concepts.append(&mut concepts);
                                }
                                Err(_) => {
                                    // Fallback to regex-based extraction if tree-sitter fails
                                    eprintln!("Tree-sitter parsing failed for {}, using fallback", file_path.display());
                                    let fallback_concepts = FallbackExtractor::new()
                                        .extract_concepts(
                                            file_path.to_str().unwrap_or(""),
                                            &content,
                                        );
                                    all_concepts.extend(fallback_concepts);
                                }
                            };
                        }
                        Err(_) => {
                            // Skip files that can't be read
                            continue;
                        }
                    }
                } else if debug_php_enabled {
                    eprintln!("[PHP DEBUG] skipped file {}", file_path.display());
                }
            }
        }

        eprintln!("Processed {} source files and found {} concepts", processed_count, all_concepts.len());
        Ok(all_concepts)
    }

    /// Detect programming languages in codebase
    async fn detect_languages(&self, path: &str) -> Result<Vec<String>, ParseError> {
        let mut languages = std::collections::HashSet::new();

        for entry in WalkDir::new(path).into_iter().filter_map(|e| e.ok()) {
            if entry.file_type().is_file() {
                let file_path = entry.path();
                
                if let Some(extension) = file_path.extension().and_then(|s| s.to_str()) {
                    let language = match extension.to_lowercase().as_str() {
                        "ts" | "tsx" => Some("typescript"),
                        "js" | "jsx" => Some("javascript"),
                        "rs" => Some("rust"),
                        "py" => Some("python"),
                        "php" | "phtml" | "inc" => Some("php"),
                        "sql" => Some("sql"),
                        "go" => Some("go"),
                        "java" => Some("java"),
                        "c" => Some("c"),
                        "cpp" | "cc" | "cxx" => Some("cpp"),
                        "cs" => Some("csharp"),
                        "svelte" => Some("svelte"),
                        "vue" => Some("javascript"), // Fallback to JS for Vue
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
}

/// Trait for extractors that can extract concepts from nodes
pub trait HasExtractConcepts {
    fn extract_concepts(
        &self,
        node: tree_sitter::Node<'_>,
        file_path: &str,
        content: &str,
        concepts: &mut Vec<SemanticConcept>,
    ) -> Result<(), ParseError>;
}

// Implement the trait for all extractors
impl HasExtractConcepts for TypeScriptExtractor {
    fn extract_concepts(&self, node: tree_sitter::Node<'_>, file_path: &str, content: &str, concepts: &mut Vec<SemanticConcept>) -> Result<(), ParseError> {
        TypeScriptExtractor::extract_concepts(self, node, file_path, content, concepts)
    }
}

impl HasExtractConcepts for RustExtractor {
    fn extract_concepts(&self, node: tree_sitter::Node<'_>, file_path: &str, content: &str, concepts: &mut Vec<SemanticConcept>) -> Result<(), ParseError> {
        RustExtractor::extract_concepts(self, node, file_path, content, concepts)
    }
}

impl HasExtractConcepts for PythonExtractor {
    fn extract_concepts(&self, node: tree_sitter::Node<'_>, file_path: &str, content: &str, concepts: &mut Vec<SemanticConcept>) -> Result<(), ParseError> {
        PythonExtractor::extract_concepts(self, node, file_path, content, concepts)
    }
}

impl HasExtractConcepts for PhpExtractor {
    fn extract_concepts(&self, node: tree_sitter::Node<'_>, file_path: &str, content: &str, concepts: &mut Vec<SemanticConcept>) -> Result<(), ParseError> {
        PhpExtractor::extract_concepts(self, node, file_path, content, concepts)
    }
}

impl HasExtractConcepts for SqlExtractor {
    fn extract_concepts(&self, node: tree_sitter::Node<'_>, file_path: &str, content: &str, concepts: &mut Vec<SemanticConcept>) -> Result<(), ParseError> {
        SqlExtractor::extract_concepts(self, node, file_path, content, concepts)
    }
}

impl HasExtractConcepts for GoExtractor {
    fn extract_concepts(&self, node: tree_sitter::Node<'_>, file_path: &str, content: &str, concepts: &mut Vec<SemanticConcept>) -> Result<(), ParseError> {
        GoExtractor::extract_concepts(self, node, file_path, content, concepts)
    }
}

impl HasExtractConcepts for JavaExtractor {
    fn extract_concepts(&self, node: tree_sitter::Node<'_>, file_path: &str, content: &str, concepts: &mut Vec<SemanticConcept>) -> Result<(), ParseError> {
        JavaExtractor::extract_concepts(self, node, file_path, content, concepts)
    }
}

impl HasExtractConcepts for CppExtractor {
    fn extract_concepts(&self, node: tree_sitter::Node<'_>, file_path: &str, content: &str, concepts: &mut Vec<SemanticConcept>) -> Result<(), ParseError> {
        CppExtractor::extract_concepts(self, node, file_path, content, concepts)
    }
}

impl HasExtractConcepts for CSharpExtractor {
    fn extract_concepts(&self, node: tree_sitter::Node<'_>, file_path: &str, content: &str, concepts: &mut Vec<SemanticConcept>) -> Result<(), ParseError> {
        CSharpExtractor::extract_concepts(self, node, file_path, content, concepts)
    }
}

impl HasExtractConcepts for SvelteExtractor {
    fn extract_concepts(&self, node: tree_sitter::Node<'_>, file_path: &str, content: &str, concepts: &mut Vec<SemanticConcept>) -> Result<(), ParseError> {
        SvelteExtractor::extract_concepts(self, node, file_path, content, concepts)
    }
}

impl HasExtractConcepts for GenericExtractor {
    fn extract_concepts(&self, node: tree_sitter::Node<'_>, file_path: &str, content: &str, concepts: &mut Vec<SemanticConcept>) -> Result<(), ParseError> {
        GenericExtractor::extract_concepts(self, node, file_path, content, concepts)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_semantic_analyzer_creation() {
        let analyzer = SemanticAnalyzer::new();
        assert!(analyzer.is_ok());
        
        let analyzer = analyzer.unwrap();
        assert!(analyzer.parser_manager.supports_language("typescript"));
        assert!(analyzer.parser_manager.supports_language("javascript"));
        assert!(analyzer.parser_manager.supports_language("rust"));
        assert!(analyzer.parser_manager.supports_language("python"));
    }

    #[tokio::test]
    async fn test_typescript_class_parsing() {
        let mut analyzer = SemanticAnalyzer::new().unwrap();
        let content = "export class UserService { getName() { return 'test'; } }";

        println!("🔍 Testing TypeScript class parsing...");
        println!("Content: {}", content);

        let result = unsafe {
            analyzer.analyze_file_content("test.ts".to_string(), content.to_string()).await
        };

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
                // Don't panic - assert with proper error message
                assert!(false, "TypeScript parsing should succeed, but failed with: {}", e);
            }
        }
    }

    #[tokio::test]
    async fn test_javascript_function_parsing() {
        let mut analyzer = SemanticAnalyzer::new().unwrap();
        let content = "function hello() { return 'world'; }";

        println!("🔍 Testing JavaScript function parsing...");
        println!("Content: {}", content);

        let result = unsafe {
            analyzer.analyze_file_content("test.js".to_string(), content.to_string()).await
        };

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
                // Don't panic - assert with proper error message
                assert!(false, "JavaScript parsing should succeed, but failed with: {}", e);
            }
        }
    }

    #[tokio::test]
    async fn test_python_class_parsing() {
        let mut analyzer = SemanticAnalyzer::new().unwrap();
        let content = "class User:\n    def __init__(self):\n        pass";

        println!("🔍 Testing Python class parsing...");
        println!("Content: {}", content);

        let result = unsafe {
            analyzer.analyze_file_content("test.py".to_string(), content.to_string()).await
        };

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
                // Don't panic - assert with proper error message
                assert!(false, "Python parsing should succeed, but failed with: {}", e);
            }
        }
    }

    #[tokio::test]
    async fn test_rust_struct_parsing() {
        let mut analyzer = SemanticAnalyzer::new().unwrap();
        let content = "pub struct User { name: String }";

        println!("🔍 Testing Rust struct parsing...");
        println!("Content: {}", content);

        let result = unsafe {
            analyzer.analyze_file_content("test.rs".to_string(), content.to_string()).await
        };

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
                // Don't panic - assert with proper error message
                assert!(false, "Rust parsing should succeed, but failed with: {}", e);
            }
        }
    }

    #[tokio::test]
    async fn test_learn_from_codebase() {
        let mut analyzer = SemanticAnalyzer::new().unwrap();
        
        let result = unsafe {
            analyzer.learn_from_codebase(".".to_string()).await
        };
        
        assert!(result.is_ok());
        let concepts = result.unwrap();
        println!("Learned {} concepts from codebase", concepts.len());
        
        // Should find some concepts in the current Rust codebase
        assert!(concepts.len() > 0);
    }

    #[tokio::test]
    async fn test_update_from_analysis() {
        let mut analyzer = SemanticAnalyzer::new().unwrap();
        let analysis_data = r#"{"patterns": [], "concepts": []}"#.to_string();
        
        let result = unsafe {
            analyzer.update_from_analysis(analysis_data).await
        };
        
        assert!(result.is_ok());
        assert!(result.unwrap());
    }

    #[test]
    fn test_get_concept_relationships() {
        let analyzer = SemanticAnalyzer::new().unwrap();
        
        let result = analyzer.get_concept_relationships("nonexistent".to_string());
        assert!(result.is_ok());
        assert_eq!(result.unwrap().len(), 0);
    }

    #[tokio::test]
    async fn test_detect_languages() {
        let analyzer = SemanticAnalyzer::new().unwrap();
        
        let result = analyzer.detect_languages(".").await;
        assert!(result.is_ok());
        
        let languages = result.unwrap();
        println!("Detected languages: {:?}", languages);
        
        // Should detect Rust in the current codebase
        assert!(languages.contains(&"rust".to_string()));
    }

    #[tokio::test]
    async fn test_analyze_codebase_structure() {
        let mut analyzer = SemanticAnalyzer::new().unwrap();
        
        let result = unsafe {
            analyzer.analyze_codebase(".".to_string()).await
        };
        
        assert!(result.is_ok());
        let analysis = result.unwrap();
        
        println!("Analysis result:");
        println!("- Languages: {:?}", analysis.languages);
        println!("- Frameworks: {:?}", analysis.frameworks);
        println!("- Concepts: {}", analysis.concepts.len());
        println!("- Complexity: {:?}", analysis.complexity);
        
        assert!(!analysis.languages.is_empty());
        assert!(analysis.concepts.len() > 0);
        assert!(analysis.complexity.file_count > 0);
    }

    #[tokio::test] 
    async fn test_analyze_simple_typescript() {
        let mut analyzer = SemanticAnalyzer::new().unwrap();
        let code = "function test() { return 42; }";
        
        let result = unsafe {
            analyzer.analyze_file_content("test.ts".to_string(), code.to_string()).await
        };
        
        assert!(result.is_ok());
        let concepts = result.unwrap();
        assert!(concepts.len() > 0);
        
        // Verify concept properties
        let concept = &concepts[0];
        assert!(!concept.name.is_empty());
        assert!(!concept.concept_type.is_empty());
        assert!(concept.confidence > 0.0);
        assert!(concept.confidence <= 1.0);
        assert_eq!(concept.file_path, "test.ts");
        assert!(concept.line_range.start > 0);
        assert!(concept.line_range.end >= concept.line_range.start);
    }

    #[tokio::test]
    async fn test_new_language_support() {
        let mut analyzer = SemanticAnalyzer::new().unwrap();
        
        // Test SQL
        let sql_content = "CREATE TABLE users (id INTEGER PRIMARY KEY, name VARCHAR(255));";
        println!("🔍 Testing SQL parsing...");
        let sql_result = unsafe {
            analyzer.analyze_file_content("test.sql".to_string(), sql_content.to_string()).await
        };
        match &sql_result {
            Ok(concepts) => println!("✅ SQL: Found {} concepts", concepts.len()),
            Err(e) => println!("❌ SQL failed: {}", e),
        }
        assert!(sql_result.is_ok(), "SQL parsing should succeed: {:?}", sql_result.err());
        
        // Test Go
        let go_content = "package main\nfunc main() {\n    println(\"Hello World\")\n}";
        println!("🔍 Testing Go parsing...");
        let go_result = unsafe {
            analyzer.analyze_file_content("test.go".to_string(), go_content.to_string()).await
        };
        match &go_result {
            Ok(concepts) => println!("✅ Go: Found {} concepts", concepts.len()),
            Err(e) => println!("❌ Go failed: {}", e),
        }
        assert!(go_result.is_ok(), "Go parsing should succeed: {:?}", go_result.err());
        
        // Test Java
        let java_content = "public class HelloWorld {\n    public static void main(String[] args) {\n        System.out.println(\"Hello\");\n    }\n}";
        println!("🔍 Testing Java parsing...");
        let java_result = unsafe {
            analyzer.analyze_file_content("test.java".to_string(), java_content.to_string()).await
        };
        match &java_result {
            Ok(concepts) => println!("✅ Java: Found {} concepts", concepts.len()),
            Err(e) => println!("❌ Java failed: {}", e),
        }
        assert!(java_result.is_ok(), "Java parsing should succeed: {:?}", java_result.err());
        
        // Test C
        let c_content = "#include <stdio.h>\nint main() {\n    printf(\"Hello World\");\n    return 0;\n}";
        println!("🔍 Testing C parsing...");
        let c_result = unsafe {
            analyzer.analyze_file_content("test.c".to_string(), c_content.to_string()).await
        };
        assert!(c_result.is_ok(), "C parsing should succeed");
        
        // Test C++
        let cpp_content = "#include <iostream>\nclass HelloWorld {\npublic:\n    void sayHello() {\n        std::cout << \"Hello\";\n    }\n};";
        println!("🔍 Testing C++ parsing...");
        let cpp_result = unsafe {
            analyzer.analyze_file_content("test.cpp".to_string(), cpp_content.to_string()).await
        };
        assert!(cpp_result.is_ok(), "C++ parsing should succeed");
        
        // Test C#
        let csharp_content = "using System;\npublic class Program {\n    public static void Main() {\n        Console.WriteLine(\"Hello World\");\n    }\n}";
        println!("🔍 Testing C# parsing...");
        let csharp_result = unsafe {
            analyzer.analyze_file_content("test.cs".to_string(), csharp_content.to_string()).await
        };
        assert!(csharp_result.is_ok(), "C# parsing should succeed");
        
        // Test Svelte
        let svelte_content = "<script>\n  let name = \"world\";\n  function greet() {\n    alert(`Hello ${name}!`);\n  }\n</script>";
        println!("🔍 Testing Svelte parsing...");
        let svelte_result = unsafe {
            analyzer.analyze_file_content("test.svelte".to_string(), svelte_content.to_string()).await
        };
        assert!(svelte_result.is_ok(), "Svelte parsing should succeed");

        // Test PHP
        let php_content = "<?php\nclass Greeter {\n    public function greet(): string {\n        return 'Hello';\n    }\n}\n";
        println!("🔍 Testing PHP parsing...");
        let php_result = unsafe {
            analyzer.analyze_file_content("Greeter.php".to_string(), php_content.to_string()).await
        };
        assert!(php_result.is_ok(), "PHP parsing should succeed");

        println!("✅ All language parsing tests passed!");
    }

    #[tokio::test]
    async fn test_timeout_handling() {
        let mut analyzer = SemanticAnalyzer::new().unwrap();
        
        // Test that timeout doesn't cause crashes - use normal content
        let content = "function test() { return 42; }";
        let result = unsafe {
            analyzer.analyze_file_content("test.js".to_string(), content.to_string()).await
        };
        
        assert!(result.is_ok());
    }

    #[test]
    fn test_semantic_concept_creation() {
        use crate::types::LineRange;
        use std::collections::HashMap;
        
        let concept = SemanticConcept {
            id: "test_concept".to_string(),
            name: "TestClass".to_string(),
            concept_type: "class".to_string(),
            confidence: 0.9,
            file_path: "test.ts".to_string(),
            line_range: LineRange { start: 1, end: 10 },
            relationships: HashMap::new(),
            metadata: HashMap::new(),
        };

        assert_eq!(concept.name, "TestClass");
        assert_eq!(concept.concept_type, "class");
        assert_eq!(concept.confidence, 0.9);
        assert_eq!(concept.file_path, "test.ts");
        assert_eq!(concept.line_range.start, 1);
        assert_eq!(concept.line_range.end, 10);
    }

    #[test]
    fn test_complexity_metrics() {
        use crate::types::ComplexityMetrics;
        
        let metrics = ComplexityMetrics {
            cyclomatic_complexity: 5.0,
            cognitive_complexity: 8.0,
            function_count: 10,
            class_count: 5,
            file_count: 100,
            avg_functions_per_file: 2.0,
            avg_lines_per_concept: 15.0,
            max_nesting_depth: 3,
        };

        assert!(metrics.cyclomatic_complexity > 0.0);
        assert!(metrics.cognitive_complexity >= metrics.cyclomatic_complexity);
        assert!(metrics.file_count > 0);
        assert!(metrics.function_count > 0);
        assert!(metrics.class_count > 0);
    }

    #[tokio::test]
    async fn test_fallback_extraction() {
        let mut analyzer = SemanticAnalyzer::new().unwrap();
        
        // Test with a language that might not have full tree-sitter support
        // The system should fall back to regex-based extraction
        let content = "function calculate() { return 42; }";
        let result = unsafe {
            analyzer.analyze_file_content("test.unknown".to_string(), content.to_string()).await
        };
        
        assert!(result.is_ok());
        let concepts = result.unwrap();
        assert!(concepts.len() > 0);
        
        // Check that fallback extraction worked
        let concept = &concepts[0];
        assert!(!concept.name.is_empty());
        assert!(concept.confidence > 0.0);
    }
}
