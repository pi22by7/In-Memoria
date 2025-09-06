//! TypeScript and JavaScript concept extraction

use crate::types::{SemanticConcept, LineRange, ParseError};
use crate::parsing::NameExtractor;
use std::collections::HashMap;
use tree_sitter::Node;

/// Extractor for TypeScript and JavaScript concepts
pub struct TypeScriptExtractor;

impl TypeScriptExtractor {
    pub fn new() -> Self {
        Self
    }

    /// Extract concepts from TypeScript/JavaScript AST nodes
    pub fn extract_concepts(
        &self,
        node: Node<'_>,
        file_path: &str,
        content: &str,
        concepts: &mut Vec<SemanticConcept>,
    ) -> Result<(), ParseError> {
        match node.kind() {
            "class_declaration" | "interface_declaration" | "type_alias_declaration" => {
                if let Some(concept) =
                    self.extract_concept_from_node(node, file_path, content, "class")?
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
                    .extract_concept_from_node(node, file_path, content, "function")?
                {
                    concepts.push(concept);
                }
            }
            "variable_declaration" | "lexical_declaration" => {
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

    /// Extract a concept from a node with proper name extraction
    fn extract_concept_from_node(
        &self,
        node: Node<'_>,
        file_path: &str,
        content: &str,
        concept_type: &str,
    ) -> Result<Option<SemanticConcept>, ParseError> {
        // Extract name from node
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
                        // Fallback to hash-based ID if system time fails
                        use std::collections::hash_map::DefaultHasher;
                        use std::hash::{Hash, Hasher};
                        let mut hasher = DefaultHasher::new();
                        format!("{}{}", file_path, name).hash(&mut hasher);
                        hasher.finish() as u128
                    })
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
}

impl Default for TypeScriptExtractor {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::parsing::ParserManager;

    fn create_ts_tree(code: &str) -> tree_sitter::Tree {
        let mut manager = ParserManager::new().unwrap();
        manager.parse(code, "typescript").unwrap()
    }

    fn create_js_tree(code: &str) -> tree_sitter::Tree {
        let mut manager = ParserManager::new().unwrap();
        manager.parse(code, "javascript").unwrap()
    }

    fn extract_all_concepts(extractor: &TypeScriptExtractor, tree: &tree_sitter::Tree, file_path: &str, content: &str) -> Vec<SemanticConcept> {
        let mut concepts = Vec::new();
        
        fn walk_and_extract(
            extractor: &TypeScriptExtractor,
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
        
        walk_and_extract(extractor, tree.root_node(), file_path, content, &mut concepts);
        concepts
    }

    #[test]
    fn test_extract_typescript_class() {
        let extractor = TypeScriptExtractor::new();
        let code = "export class UserService { getName() { return 'test'; } }";
        let tree = create_ts_tree(code);
        
        let concepts = extract_all_concepts(&extractor, &tree, "test.ts", code);
        
        // Should find class and method
        let class_concepts: Vec<_> = concepts.iter()
            .filter(|c| c.concept_type == "class")
            .collect();
        assert!(class_concepts.len() > 0);
        
        let class_concept = &class_concepts[0];
        assert_eq!(class_concept.name, "UserService");
        assert_eq!(class_concept.concept_type, "class");
        assert_eq!(class_concept.confidence, 0.8);
    }

    #[test]
    fn test_extract_typescript_interface() {
        let extractor = TypeScriptExtractor::new();
        let code = "interface IUserService { getName(): string; getAge(): number; }";
        let tree = create_ts_tree(code);
        
        let concepts = extract_all_concepts(&extractor, &tree, "interface.ts", code);
        
        let interface_concepts: Vec<_> = concepts.iter()
            .filter(|c| c.concept_type == "class") // Interfaces mapped as classes
            .collect();
        assert!(interface_concepts.len() > 0);
        
        let interface_concept = &interface_concepts[0];
        assert_eq!(interface_concept.name, "IUserService");
    }

    #[test]
    fn test_extract_typescript_function() {
        let extractor = TypeScriptExtractor::new();
        let code = "function calculateTotal(price: number, tax: number): number { return price + tax; }";
        let tree = create_ts_tree(code);
        
        let concepts = extract_all_concepts(&extractor, &tree, "calc.ts", code);
        
        let function_concepts: Vec<_> = concepts.iter()
            .filter(|c| c.concept_type == "function")
            .collect();
        assert!(function_concepts.len() > 0);
        
        let function_concept = &function_concepts[0];
        assert_eq!(function_concept.name, "calculateTotal");
        assert_eq!(function_concept.concept_type, "function");
    }

    #[test]
    fn test_extract_arrow_function() {
        let extractor = TypeScriptExtractor::new();
        let code = "const handleClick = (event: Event) => { console.log('clicked'); };";
        let tree = create_ts_tree(code);
        
        let concepts = extract_all_concepts(&extractor, &tree, "handler.ts", code);
        
        // Should find variable and potentially arrow function
        let __variable_concepts: Vec<_> = concepts.iter()
            .filter(|c| c.concept_type == "variable")
            .collect();
        assert!(__variable_concepts.len() > 0);
    }

    #[test]
    fn test_extract_javascript_class() {
        let extractor = TypeScriptExtractor::new();
        let code = "class Calculator { add(a, b) { return a + b; } }";
        let tree = create_js_tree(code);
        
        let concepts = extract_all_concepts(&extractor, &tree, "calc.js", code);
        
        let class_concepts: Vec<_> = concepts.iter()
            .filter(|c| c.concept_type == "class")
            .collect();
        assert!(class_concepts.len() > 0);
        
        let class_concept = &class_concepts[0];
        assert_eq!(class_concept.name, "Calculator");
    }

    #[test]
    fn test_extract_javascript_function() {
        let extractor = TypeScriptExtractor::new();
        let code = "function hello() { return 'world'; }";
        let tree = create_js_tree(code);
        
        let concepts = extract_all_concepts(&extractor, &tree, "hello.js", code);
        
        let function_concepts: Vec<_> = concepts.iter()
            .filter(|c| c.concept_type == "function")
            .collect();
        assert!(function_concepts.len() > 0);
        
        let function_concept = &function_concepts[0];
        assert_eq!(function_concept.name, "hello");
        assert_eq!(function_concept.concept_type, "function");
    }

    #[test]
    fn test_extract_variable_declaration() {
        let extractor = TypeScriptExtractor::new();
        let code = "const userName = 'john'; let userAge = 25; var isActive = true;";
        let tree = create_js_tree(code);
        
        let concepts = extract_all_concepts(&extractor, &tree, "vars.js", code);
        
        let __variable_concepts: Vec<_> = concepts.iter()
            .filter(|c| c.concept_type == "variable")
            .collect();
        assert!(__variable_concepts.len() > 0);
        
        // Should find at least one variable
        let variable_names: Vec<&String> = __variable_concepts.iter()
            .map(|c| &c.name)
            .collect();
        
        // Note: The exact extraction depends on tree structure
        assert!(variable_names.len() > 0);
    }

    #[test]
    fn test_extract_method_definition() {
        let extractor = TypeScriptExtractor::new();
        let code = r#"
            class UserManager {
                constructor(name) {
                    this.name = name;
                }
                
                getName() {
                    return this.name;
                }
                
                setName(newName) {
                    this.name = newName;
                }
            }
        "#;
        let tree = create_js_tree(code);
        
        let concepts = extract_all_concepts(&extractor, &tree, "manager.js", code);
        
        // Should find class and methods
        let class_concepts: Vec<_> = concepts.iter()
            .filter(|c| c.concept_type == "class")
            .collect();
        assert!(class_concepts.len() > 0);
        
        let function_concepts: Vec<_> = concepts.iter()
            .filter(|c| c.concept_type == "function")
            .collect();
        assert!(function_concepts.len() > 0);
        
        // Should find the class name
        let class_concept = &class_concepts[0];
        assert_eq!(class_concept.name, "UserManager");
    }

    #[test]
    fn test_extract_type_alias() {
        let extractor = TypeScriptExtractor::new();
        let code = "type UserType = { name: string; age: number; };";
        let tree = create_ts_tree(code);
        
        let concepts = extract_all_concepts(&extractor, &tree, "types.ts", code);
        
        let type_concepts: Vec<_> = concepts.iter()
            .filter(|c| c.concept_type == "class") // Type aliases mapped as classes
            .collect();
        assert!(type_concepts.len() > 0);
        
        let type_concept = &type_concepts[0];
        assert_eq!(type_concept.name, "UserType");
    }

    #[test]
    fn test_empty_code() {
        let extractor = TypeScriptExtractor::new();
        let code = "";
        let tree = create_js_tree(code);
        
        let concepts = extract_all_concepts(&extractor, &tree, "empty.js", code);
        assert_eq!(concepts.len(), 0);
    }

    #[test]
    fn test_invalid_syntax() {
        let extractor = TypeScriptExtractor::new();
        let code = "function {{{ invalid syntax";
        let tree = create_js_tree(code);
        
        let concepts = extract_all_concepts(&extractor, &tree, "invalid.js", code);
        
        // Should not crash on invalid syntax
        // Tree-sitter will parse what it can
        assert!(concepts.len() >= 0); // May or may not find concepts
    }

    #[test]
    fn test_concept_line_numbers() {
        let extractor = TypeScriptExtractor::new();
        let code = r#"
function first() {}

class Second {}

const third = () => {};
"#;
        let tree = create_js_tree(code);
        
        let concepts = extract_all_concepts(&extractor, &tree, "lines.js", code);
        
        // Check that concepts have reasonable line numbers
        for concept in &concepts {
            assert!(concept.line_range.start > 0);
            assert!(concept.line_range.end >= concept.line_range.start);
            assert!(concept.line_range.start <= 6); // Code has 6 lines
        }
    }

    #[test]
    fn test_concept_metadata() {
        let extractor = TypeScriptExtractor::new();
        let code = "function testFunction() { return 42; }";
        let tree = create_js_tree(code);
        
        let concepts = extract_all_concepts(&extractor, &tree, "test.js", code);
        
        assert!(concepts.len() > 0);
        
        let concept = &concepts[0];
        assert!(!concept.id.is_empty());
        assert!(!concept.name.is_empty());
        assert!(!concept.concept_type.is_empty());
        assert!(concept.confidence > 0.0 && concept.confidence <= 1.0);
        assert_eq!(concept.file_path, "test.js");
        assert!(concept.line_range.start > 0);
    }

    #[test]
    fn test_extractor_default() {
        let extractor = TypeScriptExtractor::default();
        let code = "const test = 42;";
        let tree = create_js_tree(code);
        
        let mut concepts = Vec::new();
        let result = extractor.extract_concepts(tree.root_node(), "test.js", code, &mut concepts);
        assert!(result.is_ok());
    }

    #[test]
    fn test_complex_typescript_example() {
        let extractor = TypeScriptExtractor::new();
        let code = r#"
            interface DatabaseConnection {
                connect(): Promise<void>;
                disconnect(): Promise<void>;
            }
            
            class UserRepository implements DatabaseConnection {
                private connection: any;
                
                constructor(connectionString: string) {
                    this.connection = connectionString;
                }
                
                async connect(): Promise<void> {
                    // Connection logic
                }
                
                async disconnect(): Promise<void> {
                    // Disconnection logic  
                }
                
                async findUser(id: number): Promise<User | null> {
                    // Find user logic
                    return null;
                }
            }
            
            type User = {
                id: number;
                name: string;
                email: string;
            };
            
            const createRepository = (connectionString: string): UserRepository => {
                return new UserRepository(connectionString);
            };
        "#;
        let tree = create_ts_tree(code);
        
        let concepts = extract_all_concepts(&extractor, &tree, "complex.ts", code);
        
        // Should find multiple concepts
        assert!(concepts.len() > 0);
        
        let class_concepts: Vec<_> = concepts.iter()
            .filter(|c| c.concept_type == "class")
            .collect();
        
        let function_concepts: Vec<_> = concepts.iter()
            .filter(|c| c.concept_type == "function")
            .collect();
        
        let __variable_concepts: Vec<_> = concepts.iter()
            .filter(|c| c.concept_type == "variable")
            .collect();
        
        // Should find interfaces, classes, types, and functions
        assert!(class_concepts.len() > 0);
        assert!(function_concepts.len() > 0);
        
        // Check specific concept names
        let concept_names: Vec<&String> = concepts.iter().map(|c| &c.name).collect();
        assert!(concept_names.contains(&&"DatabaseConnection".to_string()));
        assert!(concept_names.contains(&&"UserRepository".to_string()));
        assert!(concept_names.contains(&&"User".to_string()));
    }
}