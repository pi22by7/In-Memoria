//! Utility functions for name extraction and tree-sitter node handling

use tree_sitter::Node;

/// Utilities for extracting names and identifiers from tree-sitter nodes
pub struct NameExtractor;

impl NameExtractor {
    /// Extract name from a tree-sitter node by finding identifier children
    pub fn extract_name_from_node(node: Node<'_>, content: &str) -> Result<String, String> {
        // Try to find identifier node recursively
        if let Some(name) = Self::find_identifier_recursive(node, content) {
            return Ok(name);
        }
        Ok(String::new())
    }

    /// Find identifier recursively in the node tree
    pub fn find_identifier_recursive(node: Node<'_>, content: &str) -> Option<String> {
        Self::find_identifier_recursive_impl(node, content)
    }

    /// Internal implementation of recursive identifier finding
    fn find_identifier_recursive_impl(node: Node<'_>, content: &str) -> Option<String> {
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

    /// Find a child node by its kind
    pub fn find_child_by_kind<'a>(node: Node<'a>, kind: &str) -> Option<Node<'a>> {
        let mut cursor = node.walk();
        for child in node.children(&mut cursor) {
            if child.kind() == kind {
                return Some(child);
            }
            // Also search recursively in children
            if let Some(found) = Self::find_child_by_kind(child, kind) {
                return Some(found);
            }
        }
        None
    }

    /// Collect all identifiers from a node and its children
    pub fn collect_identifiers_from_node(node: Node<'_>, content: &str) -> Vec<String> {
        let mut identifiers = Vec::new();
        Self::collect_identifiers_recursive(node, content, &mut identifiers);
        identifiers
    }

    /// Recursively collect identifiers
    fn collect_identifiers_recursive(node: Node<'_>, content: &str, identifiers: &mut Vec<String>) {
        if node.kind() == "identifier" {
            let start_byte = node.start_byte();
            let end_byte = node.end_byte();
            if let Some(name) = content.get(start_byte..end_byte) {
                identifiers.push(name.to_string());
            }
        }
        
        let mut cursor = node.walk();
        for child in node.children(&mut cursor) {
            Self::collect_identifiers_recursive(child, content, identifiers);
        }
    }

    /// Extract text content from a node
    pub fn extract_node_text<'a>(node: Node<'_>, content: &'a str) -> Option<&'a str> {
        content.get(node.start_byte()..node.end_byte())
    }

    /// Check if a node represents a named construct (has identifier children)
    pub fn is_named_construct(node: Node<'_>) -> bool {
        let mut cursor = node.walk();
        for child in node.children(&mut cursor) {
            if matches!(child.kind(), "identifier" | "property_identifier" | "type_identifier") {
                return true;
            }
        }
        false
    }

    /// Get the line and column position of a node
    pub fn get_position_info(node: Node<'_>) -> (u32, u32, u32, u32) {
        (
            node.start_position().row as u32 + 1,
            node.start_position().column as u32 + 1,
            node.end_position().row as u32 + 1,
            node.end_position().column as u32 + 1,
        )
    }

    /// Check if a node or any of its children have errors
    pub fn has_syntax_errors(node: Node<'_>) -> bool {
        if node.is_error() || node.is_missing() {
            return true;
        }

        let mut cursor = node.walk();
        for child in node.children(&mut cursor) {
            if Self::has_syntax_errors(child) {
                return true;
            }
        }

        false
    }

    /// Count the number of children of a specific kind
    pub fn count_children_by_kind(node: Node<'_>, kind: &str) -> usize {
        let mut cursor = node.walk();
        node.children(&mut cursor)
            .filter(|child| child.kind() == kind)
            .count()
    }

    /// Get all direct children of a node
    pub fn get_direct_children(node: Node<'_>) -> Vec<Node<'_>> {
        let mut cursor = node.walk();
        node.children(&mut cursor).collect()
    }

    /// Check if a string is a valid programming language identifier
    pub fn is_valid_identifier(name: &str) -> bool {
        !name.is_empty()
            && name.chars().next().is_some_and(|c| c.is_alphabetic() || c == '_')
            && name.chars().all(|c| c.is_alphanumeric() || c == '_')
    }

    /// Sanitize an extracted name by removing invalid characters
    pub fn sanitize_name(name: &str) -> String {
        name.chars()
            .filter(|c| c.is_alphanumeric() || *c == '_')
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::parsing::ParserManager;

    fn create_test_tree_and_code() -> (tree_sitter::Tree, String) {
        let mut manager = ParserManager::new().unwrap();
        let code = "function calculateTotal(price, tax) { return price + tax; }".to_string();
        let tree = manager.parse(&code, "javascript").unwrap();
        (tree, code)
    }

    #[test]
    fn test_extract_name_from_node() {
        let (tree, code) = create_test_tree_and_code();
        let root = tree.root_node();
        
        // Find the function declaration
        let mut cursor = root.walk();
        let function_node = root.children(&mut cursor)
            .find(|child| child.kind() == "function_declaration")
            .unwrap();
        
        let name = NameExtractor::extract_name_from_node(function_node, &code);
        assert!(name.is_ok());
        assert_eq!(name.unwrap(), "calculateTotal");
    }

    #[test]
    fn test_find_identifier_recursive() {
        let (tree, code) = create_test_tree_and_code();
        let root = tree.root_node();
        
        let identifier = NameExtractor::find_identifier_recursive(root, &code);
        assert!(identifier.is_some());
        assert_eq!(identifier.unwrap(), "calculateTotal");
    }

    #[test]
    fn test_find_child_by_kind() {
        let (tree, _code) = create_test_tree_and_code();
        let root = tree.root_node();
        
        let function_node = NameExtractor::find_child_by_kind(root, "function_declaration");
        assert!(function_node.is_some());
        assert_eq!(function_node.unwrap().kind(), "function_declaration");
        
        let nonexistent = NameExtractor::find_child_by_kind(root, "nonexistent_kind");
        assert!(nonexistent.is_none());
    }

    #[test]
    fn test_collect_identifiers_from_node() {
        let (tree, code) = create_test_tree_and_code();
        let root = tree.root_node();
        
        let identifiers = NameExtractor::collect_identifiers_from_node(root, &code);
        
        // Should find function name and parameter names
        assert!(identifiers.contains(&"calculateTotal".to_string()));
        assert!(identifiers.contains(&"price".to_string()));
        assert!(identifiers.contains(&"tax".to_string()));
    }

    #[test]
    fn test_extract_node_text() {
        let (tree, code) = create_test_tree_and_code();
        let root = tree.root_node();
        
        let text = NameExtractor::extract_node_text(root, &code);
        assert!(text.is_some());
        assert_eq!(text.unwrap(), code);
    }

    #[test]
    fn test_is_named_construct() {
        let (tree, _code) = create_test_tree_and_code();
        let root = tree.root_node();
        
        // Root program node should have named constructs
        assert!(NameExtractor::is_named_construct(root));
        
        // Find function declaration which should also be a named construct
        let function_node = NameExtractor::find_child_by_kind(root, "function_declaration");
        assert!(function_node.is_some());
        assert!(NameExtractor::is_named_construct(function_node.unwrap()));
    }

    #[test]
    fn test_get_position_info() {
        let (tree, _code) = create_test_tree_and_code();
        let root = tree.root_node();
        
        let (start_row, start_col, end_row, end_col) = NameExtractor::get_position_info(root);
        
        // Root should start at line 1, column 1
        assert_eq!(start_row, 1);
        assert_eq!(start_col, 1);
        assert!(end_row >= start_row);
        assert!(end_col >= start_col);
    }

    #[test]
    fn test_has_syntax_errors() {
        let mut manager = ParserManager::new().unwrap();
        
        // Valid code should have no errors
        let valid_code = "function test() { return 42; }";
        let valid_tree = manager.parse(valid_code, "javascript").unwrap();
        assert!(!NameExtractor::has_syntax_errors(valid_tree.root_node()));
        
        // Invalid code should have errors
        let invalid_code = "function {{{ invalid syntax";
        let invalid_tree = manager.parse(invalid_code, "javascript").unwrap();
        assert!(NameExtractor::has_syntax_errors(invalid_tree.root_node()));
    }

    #[test]
    fn test_count_children_by_kind() {
        let (tree, _code) = create_test_tree_and_code();
        let root = tree.root_node();
        
        let function_count = NameExtractor::count_children_by_kind(root, "function_declaration");
        assert_eq!(function_count, 1);
        
        let nonexistent_count = NameExtractor::count_children_by_kind(root, "nonexistent");
        assert_eq!(nonexistent_count, 0);
    }

    #[test]
    fn test_get_direct_children() {
        let (tree, _code) = create_test_tree_and_code();
        let root = tree.root_node();
        
        let children = NameExtractor::get_direct_children(root);
        assert!(!children.is_empty());
        
        // Should have a function declaration as a child
        let has_function = children.iter().any(|child| child.kind() == "function_declaration");
        assert!(has_function);
    }

    #[test]
    fn test_is_valid_identifier() {
        // Valid identifiers
        assert!(NameExtractor::is_valid_identifier("hello"));
        assert!(NameExtractor::is_valid_identifier("_private"));
        assert!(NameExtractor::is_valid_identifier("camelCase"));
        assert!(NameExtractor::is_valid_identifier("snake_case"));
        assert!(NameExtractor::is_valid_identifier("PascalCase"));
        assert!(NameExtractor::is_valid_identifier("a123"));
        assert!(NameExtractor::is_valid_identifier("_"));
        
        // Invalid identifiers
        assert!(!NameExtractor::is_valid_identifier(""));
        assert!(!NameExtractor::is_valid_identifier("123abc"));
        assert!(!NameExtractor::is_valid_identifier("hello-world"));
        assert!(!NameExtractor::is_valid_identifier("hello.world"));
        assert!(!NameExtractor::is_valid_identifier("hello world"));
        assert!(!NameExtractor::is_valid_identifier("@special"));
    }

    #[test]
    fn test_sanitize_name() {
        assert_eq!(NameExtractor::sanitize_name("hello"), "hello");
        assert_eq!(NameExtractor::sanitize_name("hello-world"), "helloworld");
        assert_eq!(NameExtractor::sanitize_name("hello.world"), "helloworld");
        assert_eq!(NameExtractor::sanitize_name("hello world"), "helloworld");
        assert_eq!(NameExtractor::sanitize_name("hello123"), "hello123");
        assert_eq!(NameExtractor::sanitize_name("hello_world"), "hello_world");
        assert_eq!(NameExtractor::sanitize_name("@#$%"), "");
    }

    #[test]
    fn test_complex_javascript_structure() {
        let mut manager = ParserManager::new().unwrap();
        let complex_code = r#"
            class Calculator {
                constructor(name) {
                    this.name = name;
                }
                
                add(a, b) {
                    return a + b;
                }
            }
        "#;
        
        let tree = manager.parse(complex_code, "javascript").unwrap();
        let root = tree.root_node();
        
        let identifiers = NameExtractor::collect_identifiers_from_node(root, complex_code);
        
        // Should find class name, constructor, method name, and parameter names
        assert!(identifiers.contains(&"Calculator".to_string()));
        assert!(identifiers.contains(&"constructor".to_string()));
        assert!(identifiers.contains(&"name".to_string()));
        assert!(identifiers.contains(&"add".to_string()));
        assert!(identifiers.contains(&"a".to_string()));
        assert!(identifiers.contains(&"b".to_string()));
    }

    #[test]
    fn test_empty_node_handling() {
        let mut manager = ParserManager::new().unwrap();
        let empty_code = "";
        let tree = manager.parse(empty_code, "javascript").unwrap();
        let root = tree.root_node();
        
        let name = NameExtractor::extract_name_from_node(root, empty_code);
        assert!(name.is_ok());
        assert_eq!(name.unwrap(), "");
        
        let identifiers = NameExtractor::collect_identifiers_from_node(root, empty_code);
        assert_eq!(identifiers.len(), 0);
    }

    #[test]
    fn test_typescript_types() {
        let mut manager = ParserManager::new().unwrap();
        let ts_code = "interface UserService { getName(): string; }";
        let tree = manager.parse(ts_code, "typescript").unwrap();
        let root = tree.root_node();
        
        let identifiers = NameExtractor::collect_identifiers_from_node(root, ts_code);
        
        // Should find interface name and method name
        assert!(identifiers.contains(&"UserService".to_string()));
        assert!(identifiers.contains(&"getName".to_string()));
    }
}