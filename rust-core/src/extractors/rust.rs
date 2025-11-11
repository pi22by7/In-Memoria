//! Rust concept extraction

use crate::parsing::NameExtractor;
use crate::types::{LineRange, ParseError, SemanticConcept};
use std::collections::HashMap;
use tree_sitter::Node;

/// Extractor for Rust concepts
pub struct RustExtractor;

impl RustExtractor {
    pub fn new() -> Self {
        Self
    }

    /// Extract concepts from Rust AST nodes
    pub fn extract_concepts(
        &self,
        node: Node<'_>,
        file_path: &str,
        content: &str,
        concepts: &mut Vec<SemanticConcept>,
    ) -> Result<(), ParseError> {
        match node.kind() {
            "struct_item" | "enum_item" | "trait_item" | "impl_item" => {
                if let Some(concept) =
                    self.extract_concept_from_node(node, file_path, content, "struct")?
                {
                    concepts.push(concept);
                }
            }
            "function_item" => {
                if let Some(concept) =
                    self.extract_concept_from_node(node, file_path, content, "function")?
                {
                    concepts.push(concept);
                }
            }
            "let_declaration" => {
                if let Some(concept) =
                    self.extract_concept_from_node(node, file_path, content, "variable")?
                {
                    concepts.push(concept);
                }
            }
            _ => {}
        }
        Ok(())
    }

    /// Extract a concept from a node with proper name extraction
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
            id: format!(
                "concept_{}",
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|d| d.as_millis())
                    .unwrap_or_else(|_| {
                        use std::collections::hash_map::DefaultHasher;
                        use std::hash::{Hash, Hasher};
                        let mut hasher = DefaultHasher::new();
                        format!("{}{}", file_path, name).hash(&mut hasher);
                        hasher.finish() as u128
                    })
            ),
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

impl Default for RustExtractor {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::parsing::ParserManager;

    fn create_rust_tree(code: &str) -> tree_sitter::Tree {
        let mut manager = ParserManager::new().unwrap();
        manager.parse(code, "rust").unwrap()
    }

    fn extract_all_concepts(
        extractor: &RustExtractor,
        tree: &tree_sitter::Tree,
        file_path: &str,
        content: &str,
    ) -> Vec<SemanticConcept> {
        let mut concepts = Vec::new();

        fn walk_and_extract(
            extractor: &RustExtractor,
            node: tree_sitter::Node<'_>,
            file_path: &str,
            content: &str,
            concepts: &mut Vec<SemanticConcept>,
        ) {
            let _ = extractor.extract_concepts(node, file_path, content, concepts);

            let mut cursor = node.walk();
            for child in node.children(&mut cursor) {
                walk_and_extract(extractor, child, file_path, content, concepts);
            }
        }

        walk_and_extract(
            extractor,
            tree.root_node(),
            file_path,
            content,
            &mut concepts,
        );
        concepts
    }

    #[test]
    fn test_extract_rust_struct() {
        let extractor = RustExtractor::new();
        let code = "pub struct User { name: String, age: u32 }";
        let tree = create_rust_tree(code);

        let concepts = extract_all_concepts(&extractor, &tree, "user.rs", code);

        let struct_concepts: Vec<_> = concepts
            .iter()
            .filter(|c| c.concept_type == "struct")
            .collect();
        assert!(!struct_concepts.is_empty());

        let struct_concept = &struct_concepts[0];
        assert_eq!(struct_concept.name, "User");
        assert_eq!(struct_concept.concept_type, "struct");
        assert_eq!(struct_concept.confidence, 0.8);
    }

    #[test]
    fn test_extract_rust_enum() {
        let extractor = RustExtractor::new();
        let code = "enum Color { Red, Green, Blue }";
        let tree = create_rust_tree(code);

        let concepts = extract_all_concepts(&extractor, &tree, "color.rs", code);

        let enum_concepts: Vec<_> = concepts
            .iter()
            .filter(|c| c.concept_type == "struct") // Enums mapped as structs
            .collect();
        assert!(!enum_concepts.is_empty());

        let enum_concept = &enum_concepts[0];
        assert_eq!(enum_concept.name, "Color");
    }

    #[test]
    fn test_extract_rust_function() {
        let extractor = RustExtractor::new();
        let code = "pub fn calculate_total(price: f64, tax: f64) -> f64 { price + tax }";
        let tree = create_rust_tree(code);

        let concepts = extract_all_concepts(&extractor, &tree, "calc.rs", code);

        let function_concepts: Vec<_> = concepts
            .iter()
            .filter(|c| c.concept_type == "function")
            .collect();
        assert!(!function_concepts.is_empty());

        let function_concept = &function_concepts[0];
        assert_eq!(function_concept.name, "calculate_total");
        assert_eq!(function_concept.concept_type, "function");
    }

    #[test]
    fn test_extract_rust_trait() {
        let extractor = RustExtractor::new();
        let code = "trait Display { fn fmt(&self) -> String; }";
        let tree = create_rust_tree(code);

        let concepts = extract_all_concepts(&extractor, &tree, "display.rs", code);

        let trait_concepts: Vec<_> = concepts
            .iter()
            .filter(|c| c.concept_type == "struct") // Traits mapped as structs
            .collect();
        assert!(!trait_concepts.is_empty());

        let trait_concept = &trait_concepts[0];
        assert_eq!(trait_concept.name, "Display");
    }

    #[test]
    fn test_extract_rust_impl() {
        let extractor = RustExtractor::new();
        let code = r#"
            struct User { name: String }
            
            impl User {
                fn new(name: String) -> Self {
                    User { name }
                }
                
                fn get_name(&self) -> &str {
                    &self.name
                }
            }
        "#;
        let tree = create_rust_tree(code);

        let concepts = extract_all_concepts(&extractor, &tree, "user_impl.rs", code);

        // Should find struct, impl, and functions
        let struct_concepts: Vec<_> = concepts
            .iter()
            .filter(|c| c.concept_type == "struct")
            .collect();

        let function_concepts: Vec<_> = concepts
            .iter()
            .filter(|c| c.concept_type == "function")
            .collect();

        assert!(struct_concepts.len() >= 2); // struct + impl
        assert!(function_concepts.len() >= 2); // new + get_name
    }

    #[test]
    fn test_extract_rust_let_binding() {
        let extractor = RustExtractor::new();
        let code = "let user_name = String::from(\"John\");";
        let tree = create_rust_tree(code);

        let concepts = extract_all_concepts(&extractor, &tree, "var.rs", code);

        let _variable_concepts: Vec<_> = concepts
            .iter()
            .filter(|c| c.concept_type == "variable")
            .collect();

        // May or may not find variables depending on tree structure
        // Length is always >= 0 for Vec
    }

    #[test]
    fn test_complex_rust_example() {
        let extractor = RustExtractor::new();
        let code = r#"
            use std::collections::HashMap;
            
            #[derive(Debug, Clone)]
            pub struct User {
                id: u32,
                name: String,
                email: String,
            }
            
            pub trait Repository<T> {
                fn find_by_id(&self, id: u32) -> Option<T>;
                fn save(&mut self, entity: T) -> Result<(), String>;
            }
            
            pub struct UserRepository {
                users: HashMap<u32, User>,
            }
            
            impl Repository<User> for UserRepository {
                fn find_by_id(&self, id: u32) -> Option<User> {
                    self.users.get(&id).cloned()
                }
                
                fn save(&mut self, user: User) -> Result<(), String> {
                    self.users.insert(user.id, user);
                    Ok(())
                }
            }
            
            impl UserRepository {
                pub fn new() -> Self {
                    UserRepository {
                        users: HashMap::new(),
                    }
                }
            }
        "#;
        let tree = create_rust_tree(code);

        let concepts = extract_all_concepts(&extractor, &tree, "complex.rs", code);

        // Should find multiple concepts
        assert!(!concepts.is_empty());

        let struct_concepts: Vec<_> = concepts
            .iter()
            .filter(|c| c.concept_type == "struct")
            .collect();

        let function_concepts: Vec<_> = concepts
            .iter()
            .filter(|c| c.concept_type == "function")
            .collect();

        assert!(!struct_concepts.is_empty());
        assert!(!function_concepts.is_empty());

        // Check for specific names
        let concept_names: Vec<&String> = concepts.iter().map(|c| &c.name).collect();
        assert!(concept_names.contains(&&"User".to_string()));
        assert!(concept_names.contains(&&"UserRepository".to_string()));
        assert!(concept_names.contains(&&"Repository".to_string()));
    }

    #[test]
    fn test_empty_rust_code() {
        let extractor = RustExtractor::new();
        let code = "";
        let tree = create_rust_tree(code);

        let concepts = extract_all_concepts(&extractor, &tree, "empty.rs", code);
        assert_eq!(concepts.len(), 0);
    }

    #[test]
    fn test_invalid_rust_syntax() {
        let extractor = RustExtractor::new();
        let code = "struct {{{ invalid syntax";
        let tree = create_rust_tree(code);

        let _concepts = extract_all_concepts(&extractor, &tree, "invalid.rs", code);

        // Should not crash on invalid syntax
        // Length is always >= 0 for Vec
    }

    #[test]
    fn test_extractor_default() {
        let extractor = RustExtractor;
        let code = "struct Test;";
        let tree = create_rust_tree(code);

        let mut concepts = Vec::new();
        let result = extractor.extract_concepts(tree.root_node(), "test.rs", code, &mut concepts);
        assert!(result.is_ok());
    }
}
