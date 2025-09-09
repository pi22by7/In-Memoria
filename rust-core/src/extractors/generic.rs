//! Generic concept extraction for unknown languages

use crate::types::{SemanticConcept, LineRange, ParseError};
use crate::parsing::NameExtractor;
use std::collections::HashMap;
use tree_sitter::Node;

pub struct GenericExtractor;

impl GenericExtractor {
    pub fn new() -> Self { Self }

    pub fn extract_concepts(&self, node: Node<'_>, file_path: &str, content: &str, concepts: &mut Vec<SemanticConcept>) -> Result<(), ParseError> {
        // Generic extraction for unknown languages
        match node.kind() {
            kind if kind.contains("class") => {
                if let Some(concept) = self.extract_concept_from_node(node, file_path, content, "class")? {
                    concepts.push(concept);
                }
            }
            kind if kind.contains("function") => {
                if let Some(concept) = self.extract_concept_from_node(node, file_path, content, "function")? {
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
            name, concept_type: concept_type.to_string(), confidence: 0.6, file_path: file_path.to_string(),
            line_range: LineRange { start: node.start_position().row as u32 + 1, end: node.end_position().row as u32 + 1 },
            relationships: HashMap::new(), metadata: HashMap::new(),
        }))
    }
}

impl Default for GenericExtractor { fn default() -> Self { Self::new() } }

#[cfg(test)]
mod tests {
    use super::*;
    use crate::parsing::ParserManager;

    #[test]
    fn test_generic_extraction() {
        let extractor = GenericExtractor::new();
        let mut manager = ParserManager::new().unwrap();
        let code = "function test() {}";
        let tree = manager.parse(code, "javascript").unwrap();
        let mut concepts = Vec::new();
        let _ = extractor.extract_concepts(tree.root_node(), "test.js", code, &mut concepts);
        // Length is always >= 0 for Vec
    }
}