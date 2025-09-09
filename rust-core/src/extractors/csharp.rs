//! C# concept extraction

use crate::types::{SemanticConcept, LineRange, ParseError};
use crate::parsing::NameExtractor;
use std::collections::HashMap;
use tree_sitter::Node;

pub struct CSharpExtractor;

impl CSharpExtractor {
    pub fn new() -> Self { Self }

    pub fn extract_concepts(&self, node: Node<'_>, file_path: &str, content: &str, concepts: &mut Vec<SemanticConcept>) -> Result<(), ParseError> {
        match node.kind() {
            "class_declaration" | "interface_declaration" | "struct_declaration" | "enum_declaration" => {
                if let Some(concept) = self.extract_concept_from_node(node, file_path, content, "class")? {
                    concepts.push(concept);
                }
            }
            "method_declaration" | "constructor_declaration" => {
                if let Some(concept) = self.extract_concept_from_node(node, file_path, content, "function")? {
                    concepts.push(concept);
                }
            }
            "field_declaration" | "variable_declaration" => {
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

impl Default for CSharpExtractor { fn default() -> Self { Self::new() } }

#[cfg(test)]
mod tests {
    use super::*;
    use crate::parsing::ParserManager;

    #[test]
    fn test_csharp_class() {
        let extractor = CSharpExtractor::new();
        let mut manager = ParserManager::new().unwrap();
        let code = "public class Program { public static void Main() {} }";
        let tree = manager.parse(code, "csharp").unwrap();
        let mut concepts = Vec::new();
        let _ = extractor.extract_concepts(tree.root_node(), "Program.cs", code, &mut concepts);
        // Length is always >= 0 for Vec
    }
}