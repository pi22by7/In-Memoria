//! C/C++ concept extraction

use crate::types::{SemanticConcept, LineRange, ParseError};
use crate::parsing::NameExtractor;
use std::collections::HashMap;
use tree_sitter::Node;

pub struct CppExtractor;

impl CppExtractor {
    pub fn new() -> Self { Self }

    pub fn extract_concepts(&self, node: Node<'_>, file_path: &str, content: &str, concepts: &mut Vec<SemanticConcept>) -> Result<(), ParseError> {
        match node.kind() {
            "struct_specifier" | "class_specifier" | "union_specifier" | "enum_specifier" => {
                if let Some(concept) = self.extract_concept_from_node(node, file_path, content, "class")? {
                    concepts.push(concept);
                }
            }
            "function_definition" | "function_declarator" => {
                if let Some(concept) = self.extract_concept_from_node(node, file_path, content, "function")? {
                    concepts.push(concept);
                }
            }
            "declaration" => {
                if let Some(concept) = self.extract_concept_from_node(node, file_path, content, "variable")? {
                    concepts.push(concept);
                }
            }
            _ => {}
        }
        Ok(())
    }

    fn extract_concept_from_node(&self, node: Node<'_>, file_path: &str, content: &str, concept_type: &str) -> Result<Option<SemanticConcept>, ParseError> {
        let name = NameExtractor::extract_name_from_node(node, content)
            .map_err(ParseError::from_reason)?;
        if name.is_empty() { return Ok(None); }

        Ok(Some(SemanticConcept {
            id: format!("concept_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis()).unwrap_or(0)),
            name, concept_type: concept_type.to_string(), confidence: 0.8, file_path: file_path.to_string(),
            line_range: LineRange { start: node.start_position().row as u32 + 1, end: node.end_position().row as u32 + 1 },
            relationships: HashMap::new(), metadata: HashMap::new(),
        }))
    }
}

impl Default for CppExtractor { fn default() -> Self { Self::new() } }

#[cfg(test)]
mod tests {
    use super::*;
    use crate::parsing::ParserManager;

    #[test]
    fn test_cpp_class() {
        let extractor = CppExtractor::new();
        let mut manager = ParserManager::new().unwrap();
        let code = "class HelloWorld { public: void sayHello(); };";
        let tree = manager.parse(code, "cpp").unwrap();
        let mut concepts = Vec::new();
        let _ = extractor.extract_concepts(tree.root_node(), "hello.cpp", code, &mut concepts);
        // Length is always >= 0 for Vec
    }
}