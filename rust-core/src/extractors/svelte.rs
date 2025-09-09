//! Svelte concept extraction

use crate::types::{SemanticConcept, LineRange, ParseError};
use crate::parsing::NameExtractor;
use std::collections::HashMap;
use tree_sitter::Node;

pub struct SvelteExtractor;

impl SvelteExtractor {
    pub fn new() -> Self { Self }

    pub fn extract_concepts(&self, node: Node<'_>, file_path: &str, content: &str, concepts: &mut Vec<SemanticConcept>) -> Result<(), ParseError> {
        match node.kind() {
            "script_element" => {
                // Parse as JavaScript/TypeScript content within Svelte
                let mut cursor = node.walk();
                for child in node.children(&mut cursor) {
                    self.extract_concepts(child, file_path, content, concepts)?;
                }
            }
            "element" => {
                if let Some(concept) = self.extract_concept_from_node(node, file_path, content, "component")? {
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

impl Default for SvelteExtractor { fn default() -> Self { Self::new() } }

#[cfg(test)]
mod tests {
    use super::*;
    use crate::parsing::ParserManager;

    #[test]
    fn test_svelte_component() {
        let extractor = SvelteExtractor::new();
        let mut manager = ParserManager::new().unwrap();
        let code = "<script>\nlet name = 'world';\n</script>\n<h1>Hello {name}!</h1>";
        let tree = manager.parse(code, "svelte").unwrap();
        let mut concepts = Vec::new();
        let _ = extractor.extract_concepts(tree.root_node(), "App.svelte", code, &mut concepts);
        // Length is always >= 0 for Vec
    }
}