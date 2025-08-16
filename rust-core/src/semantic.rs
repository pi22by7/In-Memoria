use napi_derive::napi;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tree_sitter::{Language, Parser, Tree, Node};

extern "C" {
    fn tree_sitter_typescript() -> Language;
    fn tree_sitter_javascript() -> Language;
    fn tree_sitter_rust() -> Language;
    fn tree_sitter_python() -> Language;
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[napi(object)]
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
#[napi(object)]
pub struct LineRange {
    pub start: u32,
    pub end: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[napi(object)]
pub struct CodebaseAnalysisResult {
    pub languages: Vec<String>,
    pub frameworks: Vec<String>,
    pub complexity: ComplexityMetrics,
    pub concepts: Vec<SemanticConcept>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[napi(object)]
pub struct ComplexityMetrics {
    pub cyclomatic: f64,
    pub cognitive: f64,
    pub lines: u32,
}

#[napi]
pub struct SemanticAnalyzer {
    parsers: HashMap<String, Parser>,
    concepts: HashMap<String, SemanticConcept>,
    relationships: HashMap<String, Vec<String>>,
}

#[napi]
impl SemanticAnalyzer {
    #[napi(constructor)]
    pub fn new() -> napi::Result<Self> {
        let mut analyzer = SemanticAnalyzer {
            parsers: HashMap::new(),
            concepts: HashMap::new(),
            relationships: HashMap::new(),
        };

        analyzer.initialize_parsers()?;
        Ok(analyzer)
    }

    #[napi]
    pub async unsafe fn analyze_codebase(&mut self, path: String) -> napi::Result<CodebaseAnalysisResult> {
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

    #[napi]
    pub async unsafe fn analyze_file_content(
        &mut self,
        file_path: String,
        content: String,
    ) -> napi::Result<Vec<SemanticConcept>> {
        let language = self.detect_language_from_path(&file_path);
        let concepts = self.parse_file_content(&file_path, &content, &language).await?;
        
        // Store concepts for relationship analysis
        for concept in &concepts {
            self.concepts.insert(concept.id.clone(), concept.clone());
        }

        Ok(concepts)
    }

    #[napi]
    pub async unsafe fn learn_from_codebase(&mut self, path: String) -> napi::Result<Vec<SemanticConcept>> {
        let concepts = self.extract_concepts(&path).await?;
        
        // Learn relationships between concepts
        self.learn_concept_relationships(&concepts);
        
        // Update internal knowledge
        for concept in &concepts {
            self.concepts.insert(concept.id.clone(), concept.clone());
        }

        Ok(concepts)
    }

    #[napi]
    pub async unsafe fn update_from_analysis(&mut self, _analysis_data: String) -> napi::Result<bool> {
        // Parse analysis data and update internal state
        // This would typically be called when file changes are detected
        Ok(true)
    }

    #[napi]
    pub fn get_concept_relationships(&self, concept_id: String) -> napi::Result<Vec<String>> {
        Ok(self.relationships.get(&concept_id).cloned().unwrap_or_default())
    }

    fn initialize_parsers(&mut self) -> napi::Result<()> {
        unsafe {
            let mut ts_parser = Parser::new();
            ts_parser.set_language(&tree_sitter_typescript())
                .map_err(|e| napi::Error::from_reason(format!("Failed to set TypeScript language: {}", e)))?;
            self.parsers.insert("typescript".to_string(), ts_parser);

            let mut js_parser = Parser::new();
            js_parser.set_language(&tree_sitter_javascript())
                .map_err(|e| napi::Error::from_reason(format!("Failed to set JavaScript language: {}", e)))?;
            self.parsers.insert("javascript".to_string(), js_parser);

            let mut rust_parser = Parser::new();
            rust_parser.set_language(&tree_sitter_rust())
                .map_err(|e| napi::Error::from_reason(format!("Failed to set Rust language: {}", e)))?;
            self.parsers.insert("rust".to_string(), rust_parser);

            let mut python_parser = Parser::new();
            python_parser.set_language(&tree_sitter_python())
                .map_err(|e| napi::Error::from_reason(format!("Failed to set Python language: {}", e)))?;
            self.parsers.insert("python".to_string(), python_parser);
        }

        Ok(())
    }

    async fn detect_languages(&self, _path: &str) -> napi::Result<Vec<String>> {
        // Placeholder implementation - would scan directory for file extensions
        Ok(vec!["typescript".to_string(), "javascript".to_string()])
    }

    async fn detect_frameworks(&self, _path: &str) -> napi::Result<Vec<String>> {
        // Placeholder implementation - would analyze package.json, Cargo.toml, etc.
        Ok(vec!["react".to_string(), "node".to_string()])
    }

    async fn extract_concepts(&mut self, _path: &str) -> napi::Result<Vec<SemanticConcept>> {
        // Placeholder implementation - would walk directory and analyze files
        let concepts = vec![
            SemanticConcept {
                id: format!("concept_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis()),
                name: "ExampleClass".to_string(),
                concept_type: "class".to_string(),
                confidence: 0.95,
                file_path: "src/example.ts".to_string(),
                line_range: LineRange { start: 1, end: 20 },
                relationships: HashMap::new(),
                metadata: HashMap::new(),
            }
        ];

        Ok(concepts)
    }

    async fn parse_file_content(
        &mut self,
        file_path: &str,
        content: &str,
        language: &str,
    ) -> napi::Result<Vec<SemanticConcept>> {
        let parser = self.parsers.get_mut(language)
            .ok_or_else(|| napi::Error::from_reason(format!("Unsupported language: {}", language)))?;

        let tree = parser.parse(content, None)
            .ok_or_else(|| napi::Error::from_reason("Failed to parse file content"))?;

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
            _ => {
                // Generic extraction for unsupported languages
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
    ) -> napi::Result<Vec<SemanticConcept>> {
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
    ) -> napi::Result<Vec<SemanticConcept>> {
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
    ) -> napi::Result<Vec<SemanticConcept>> {
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
    ) -> napi::Result<Vec<SemanticConcept>> {
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
    ) -> napi::Result<()> {
        // Extract concepts based on node types
        match node.kind() {
            "class_declaration" | "interface_declaration" | "type_alias_declaration" => {
                if let Some(concept) = self.extract_concept_from_node(node, file_path, content, "class", language)? {
                    concepts.push(concept);
                }
            }
            "function_declaration" | "method_definition" | "arrow_function" => {
                if let Some(concept) = self.extract_concept_from_node(node, file_path, content, "function", language)? {
                    concepts.push(concept);
                }
            }
            "variable_declaration" | "const_statement" | "let_statement" => {
                if let Some(concept) = self.extract_concept_from_node(node, file_path, content, "variable", language)? {
                    concepts.push(concept);
                }
            }
            _ => {}
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
    ) -> napi::Result<Option<SemanticConcept>> {
        // Extract name from node
        let name = self.extract_name_from_node(node, content)?;
        
        if name.is_empty() {
            return Ok(None);
        }

        let concept = SemanticConcept {
            id: format!("concept_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis()),
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

    fn extract_name_from_node(&self, node: Node, content: &str) -> napi::Result<String> {
        // Try to find identifier node
        let mut cursor = node.walk();
        for child in node.children(&mut cursor) {
            if child.kind() == "identifier" || child.kind() == "property_identifier" {
                let start_byte = child.start_byte();
                let end_byte = child.end_byte();
                
                if let Ok(name) = content.get(start_byte..end_byte)
                    .ok_or_else(|| napi::Error::from_reason("Invalid byte range")) {
                    return Ok(name.to_string());
                }
            }
        }

        Ok(String::new())
    }

    fn detect_language_from_path(&self, file_path: &str) -> String {
        if let Some(extension) = file_path.split('.').last() {
            match extension {
                "ts" | "tsx" => "typescript".to_string(),
                "js" | "jsx" => "javascript".to_string(),
                "rs" => "rust".to_string(),
                "py" => "python".to_string(),
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

            self.relationships.insert(concept.id.clone(), related_concepts);
        }
    }

    fn calculate_complexity(&self, concepts: &[SemanticConcept]) -> ComplexityMetrics {
        let function_count = concepts.iter()
            .filter(|c| c.concept_type == "function")
            .count() as f64;
        
        let class_count = concepts.iter()
            .filter(|c| c.concept_type == "class")
            .count() as f64;

        ComplexityMetrics {
            cyclomatic: function_count * 1.5 + class_count * 2.0,
            cognitive: function_count * 2.0 + class_count * 3.0,
            lines: concepts.iter()
                .map(|c| c.line_range.end - c.line_range.start + 1)
                .sum(),
        }
    }
}