//! Python concept extraction

use crate::types::{SemanticConcept, LineRange, ParseError};
use crate::parsing::NameExtractor;
use std::collections::HashMap;
use tree_sitter::Node;

/// Extractor for Python concepts
pub struct PythonExtractor;

impl PythonExtractor {
    pub fn new() -> Self {
        Self
    }

    /// Extract concepts from Python AST nodes
    pub fn extract_concepts(
        &self,
        node: Node<'_>,
        file_path: &str,
        content: &str,
        concepts: &mut Vec<SemanticConcept>,
    ) -> Result<(), ParseError> {
        match node.kind() {
            "class_definition" => {
                if let Some(concept) =
                    self.extract_concept_from_node(node, file_path, content, "class")?
                {
                    concepts.push(concept);
                }
            }
            "function_definition" => {
                if let Some(concept) = self
                    .extract_concept_from_node(node, file_path, content, "function")?
                {
                    concepts.push(concept);
                }
            }
            "assignment" => {
                if let Some(concept) = self
                    .extract_concept_from_node(node, file_path, content, "variable")?
                {
                    concepts.push(concept);
                }
            }
            _ => {}
        }
        Ok(())
    }

    fn extract_concept_from_node(
        &self,
        node: Node<'_>,
        file_path: &str,
        content: &str,
        concept_type: &str,
    ) -> Result<Option<SemanticConcept>, ParseError> {
        let name = NameExtractor::extract_name_from_node(node, content)
            .map_err(ParseError::from_reason)?;

        if name.is_empty() {
            return Ok(None);
        }

        let concept = SemanticConcept {
            id: format!("concept_{}", std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_millis())
                .unwrap_or(0)),
            name,
            concept_type: concept_type.to_string(),
            confidence: 0.8,
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
}

impl Default for PythonExtractor {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::parsing::ParserManager;

    #[test]
    fn test_python_class_extraction() {
        let extractor = PythonExtractor::new();
        let mut manager = ParserManager::new().unwrap();
        let code = "class User:\n    def __init__(self):\n        pass";
        let tree = manager.parse(code, "python").unwrap();
        
        let mut concepts = Vec::new();
        let _ = extractor.extract_concepts(tree.root_node(), "test.py", code, &mut concepts);
        
        // Should find at least the class
        assert!(concepts.len() > 0);
    }

    #[test]
    fn test_python_function_extraction() {
        let extractor = PythonExtractor::new();
        let mut manager = ParserManager::new().unwrap();
        let code = "def calculate_total(price, tax):\n    return price + tax";
        let tree = manager.parse(code, "python").unwrap();
        
        let mut concepts = Vec::new();
        let _ = extractor.extract_concepts(tree.root_node(), "calc.py", code, &mut concepts);
        
        assert!(concepts.len() > 0);
    }
}