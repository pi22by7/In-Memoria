//! Generic tree traversal utilities for tree-sitter ASTs

use tree_sitter::Node;

/// Generic tree walker that visits all nodes in a tree-sitter AST
pub struct TreeWalker {
    /// Maximum depth to traverse (prevents infinite recursion)
    pub max_depth: usize,
}

impl Default for TreeWalker {
    fn default() -> Self {
        Self {
            max_depth: 100, // Reasonable default to prevent stack overflow
        }
    }
}

impl TreeWalker {
    /// Create a new tree walker with specified maximum depth
    pub fn new(max_depth: usize) -> Self {
        Self { max_depth }
    }

    /// Walk through all nodes in the tree, calling the visitor function for each
    pub fn walk<F>(&self, node: Node<'_>, visitor: &mut F) -> Result<(), String>
    where
        F: FnMut(Node<'_>) -> Result<(), String>,
    {
        self.walk_recursive(node, visitor, 0)
    }

    /// Recursively walk through the tree with depth tracking
    fn walk_recursive<F>(
        &self,
        node: Node<'_>,
        visitor: &mut F,
        depth: usize,
    ) -> Result<(), String>
    where
        F: FnMut(Node<'_>) -> Result<(), String>,
    {
        // Prevent infinite recursion
        if depth > self.max_depth {
            return Err(format!("Maximum tree depth ({}) exceeded", self.max_depth));
        }

        // Visit current node
        visitor(node)?;

        // Visit all children
        let mut cursor = node.walk();
        for child in node.children(&mut cursor) {
            self.walk_recursive(child, visitor, depth + 1)?;
        }

        Ok(())
    }

    /// Walk through nodes and collect results
    pub fn collect<T, F>(&self, node: Node<'_>, mut collector: F) -> Result<Vec<T>, String>
    where
        F: FnMut(Node<'_>) -> Option<T>,
    {
        let mut results = Vec::new();
        
        self.walk(node, &mut |node| {
            if let Some(result) = collector(node) {
                results.push(result);
            }
            Ok(())
        })?;

        Ok(results)
    }

    /// Find the first node by kind
    pub fn find_first_by_kind(&self, node: Node<'_>, target_kind: &str) -> Result<Option<String>, String> {
        let mut found = None;
        
        self.walk(node, &mut |node| {
            if found.is_none() && node.kind() == target_kind {
                found = Some(node.kind().to_string());
            }
            Ok(())
        })?;

        Ok(found)
    }

    /// Find all nodes by kind
    pub fn find_all_by_kind(&self, node: Node<'_>, target_kind: &str) -> Result<Vec<String>, String> {
        let mut results = Vec::new();
        
        self.walk(node, &mut |node| {
            if node.kind() == target_kind {
                results.push(node.kind().to_string());
            }
            Ok(())
        })?;

        Ok(results)
    }

    /// Count nodes matching a predicate
    pub fn count<F>(&self, node: Node<'_>, mut predicate: F) -> Result<usize, String>
    where
        F: FnMut(Node<'_>) -> bool,
    {
        let mut count = 0;
        
        self.walk(node, &mut |node| {
            if predicate(node) {
                count += 1;
            }
            Ok(())
        })?;

        Ok(count)
    }

    /// Get all child nodes of a specific kind
    pub fn get_children_by_kind<'a>(&self, node: Node<'a>, kind: &str) -> Vec<Node<'a>> {
        let mut cursor = node.walk();
        let children: Vec<_> = node.children(&mut cursor).collect();
        children.into_iter()
            .filter(|child| child.kind() == kind)
            .collect()
    }

    /// Get the first child node of a specific kind
    pub fn get_first_child_by_kind<'a>(&self, node: Node<'a>, kind: &str) -> Option<Node<'a>> {
        let mut cursor = node.walk();
        let children: Vec<_> = node.children(&mut cursor).collect();
        children.into_iter()
            .find(|child| child.kind() == kind)
    }

    /// Extract text content for a node
    pub fn extract_node_text<'a>(&self, node: Node<'_>, source: &'a str) -> Option<&'a str> {
        source.get(node.start_byte()..node.end_byte())
    }

    /// Check if node has any error children
    pub fn has_errors(&self, node: Node<'_>) -> bool {
        Self::node_has_errors(node)
    }
    
    /// Static helper to check if node has any error children
    fn node_has_errors(node: Node<'_>) -> bool {
        if node.is_error() {
            return true;
        }

        let mut cursor = node.walk();
        for child in node.children(&mut cursor) {
            if Self::node_has_errors(child) {
                return true;
            }
        }

        false
    }

    /// Get node position information as a string
    pub fn get_position_info(&self, node: Node<'_>) -> String {
        format!(
            "{}:{}-{}:{}",
            node.start_position().row + 1,
            node.start_position().column + 1,
            node.end_position().row + 1,
            node.end_position().column + 1
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::parsing::ParserManager;

    fn create_test_tree() -> tree_sitter::Tree {
        let mut manager = ParserManager::new().unwrap();
        let code = "function test() { const x = 42; return x; }";
        manager.parse(code, "javascript").unwrap()
    }

    #[test]
    fn test_tree_walker_creation() {
        let walker = TreeWalker::default();
        assert_eq!(walker.max_depth, 100);

        let custom_walker = TreeWalker::new(50);
        assert_eq!(custom_walker.max_depth, 50);
    }

    #[test]
    fn test_walk_all_nodes() {
        let tree = create_test_tree();
        let walker = TreeWalker::default();
        let mut node_count = 0;

        let result = walker.walk(tree.root_node(), &mut |_node| {
            node_count += 1;
            Ok(())
        });

        assert!(result.is_ok());
        assert!(node_count > 0);
    }

    #[test]
    fn test_collect_nodes() {
        let tree = create_test_tree();
        let walker = TreeWalker::default();

        let node_kinds: Result<Vec<String>, _> = walker.collect(tree.root_node(), |node| {
            Some(node.kind().to_string())
        });

        assert!(node_kinds.is_ok());
        let kinds = node_kinds.unwrap();
        assert!(kinds.contains(&"program".to_string()));
        assert!(kinds.contains(&"function_declaration".to_string()));
    }

    #[test]
    fn test_find_first_node() {
        let tree = create_test_tree();
        let walker = TreeWalker::default();

        let function_node = walker.find_first_by_kind(tree.root_node(), "function_declaration");

        assert!(function_node.is_ok());
        assert!(function_node.unwrap().is_some());
    }

    #[test]
    fn test_find_all_nodes() {
        let tree = create_test_tree();
        let walker = TreeWalker::default();

        let identifier_nodes = walker.find_all_by_kind(tree.root_node(), "identifier");

        assert!(identifier_nodes.is_ok());
        let nodes = identifier_nodes.unwrap();
        assert!(nodes.len() > 0);
    }

    #[test]
    fn test_count_nodes() {
        let tree = create_test_tree();
        let walker = TreeWalker::default();

        let identifier_count = walker.count(tree.root_node(), |node| {
            node.kind() == "identifier"
        });

        assert!(identifier_count.is_ok());
        assert!(identifier_count.unwrap() > 0);
    }

    #[test]
    fn test_get_children_by_kind() {
        let tree = create_test_tree();
        let walker = TreeWalker::default();
        let root = tree.root_node();

        // Get function declarations as direct children of program
        let functions = walker.get_children_by_kind(root, "function_declaration");
        assert!(functions.len() > 0);
    }

    #[test]
    fn test_get_first_child_by_kind() {
        let tree = create_test_tree();
        let walker = TreeWalker::default();
        let root = tree.root_node();

        let first_function = walker.get_first_child_by_kind(root, "function_declaration");
        assert!(first_function.is_some());
    }

    #[test]
    fn test_extract_node_text() {
        let tree = create_test_tree();
        let walker = TreeWalker::default();
        let code = "function test() { const x = 42; return x; }";

        let function_node = walker.get_first_child_by_kind(tree.root_node(), "function_declaration");
        assert!(function_node.is_some());

        let text = walker.extract_node_text(function_node.unwrap(), code);
        assert!(text.is_some());
        assert!(text.unwrap().contains("function test"));
    }

    #[test]
    fn test_has_errors() {
        let walker = TreeWalker::default();

        // Test with valid code
        let tree = create_test_tree();
        assert!(!walker.has_errors(tree.root_node()));

        // Test with invalid code
        let mut manager = ParserManager::new().unwrap();
        let invalid_code = "function {{{ invalid";
        let invalid_tree = manager.parse(invalid_code, "javascript").unwrap();
        assert!(walker.has_errors(invalid_tree.root_node()));
    }

    #[test]
    fn test_position_info() {
        let tree = create_test_tree();
        let walker = TreeWalker::default();
        let root = tree.root_node();

        let position = walker.get_position_info(root);
        assert!(position.contains("1:1")); // Should start at line 1, column 1
    }

    #[test]
    fn test_walk_error_handling() {
        let tree = create_test_tree();
        let walker = TreeWalker::default();

        // Test that error in visitor function is properly propagated
        let result = walker.walk(tree.root_node(), &mut |_node| {
            Err("Test error".to_string())
        });

        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Test error");
    }

    #[test]
    fn test_max_depth_limit() {
        let tree = create_test_tree();
        let walker = TreeWalker::new(1); // Very shallow depth

        let mut count = 0;
        let result = walker.walk(tree.root_node(), &mut |_node| {
            count += 1;
            Ok(())
        });

        // Should hit depth limit with nested nodes
        assert!(result.is_err() || count <= 10); // Either error or very few nodes processed
    }

    #[test]
    fn test_empty_tree_handling() {
        let mut manager = ParserManager::new().unwrap();
        let empty_code = "";
        let empty_tree = manager.parse(empty_code, "javascript").unwrap();
        
        let walker = TreeWalker::default();
        let mut count = 0;

        let result = walker.walk(empty_tree.root_node(), &mut |_node| {
            count += 1;
            Ok(())
        });

        assert!(result.is_ok());
        assert!(count > 0); // Should at least have the root program node
    }
}