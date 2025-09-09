//! Comprehensive SQL concept extraction using full grammar support
//!
//! This module provides detailed extraction of SQL constructs including:
//! - Tables (CREATE TABLE, columns, constraints)
//! - Views (CREATE VIEW)  
//! - Functions and Procedures (CREATE FUNCTION)
//! - Indexes (CREATE INDEX)
//! - Queries (SELECT, INSERT, UPDATE, DELETE)
//! - Database objects (schemas, triggers, etc.)

use crate::types::{SemanticConcept, LineRange, ParseError};
// Remove unused import
use std::collections::HashMap;
use tree_sitter::Node;

/// Advanced SQL concept extractor using full grammar support
pub struct SqlExtractor;

impl SqlExtractor {
    pub fn new() -> Self {
        Self
    }

    /// Extract concepts from SQL AST nodes using full grammar awareness
    pub fn extract_concepts(
        &self,
        node: Node<'_>,
        file_path: &str,
        content: &str,
        concepts: &mut Vec<SemanticConcept>,
    ) -> Result<(), ParseError> {
        match node.kind() {
            // DDL Statements
            "create_table" => {
                if let Some(concept) = self.extract_table(node, file_path, content)? {
                    concepts.push(concept);
                    // Also extract columns
                    self.extract_table_columns(node, file_path, content, concepts)?;
                }
            }
            "create_view" => {
                if let Some(concept) = self.extract_view(node, file_path, content)? {
                    concepts.push(concept);
                }
            }
            "create_function" => {
                if let Some(concept) = self.extract_function(node, file_path, content)? {
                    concepts.push(concept);
                }
            }
            "create_index" => {
                if let Some(concept) = self.extract_index(node, file_path, content)? {
                    concepts.push(concept);
                }
            }
            "create_trigger" => {
                if let Some(concept) = self.extract_trigger(node, file_path, content)? {
                    concepts.push(concept);
                }
            }
            
            // DML Statements
            "_select_statement" | "select" => {
                if let Some(concept) = self.extract_select_query(node, file_path, content)? {
                    concepts.push(concept);
                }
            }
            "_insert_statement" | "insert" => {
                if let Some(concept) = self.extract_insert_query(node, file_path, content)? {
                    concepts.push(concept);
                }
            }
            "_update_statement" | "update" => {
                if let Some(concept) = self.extract_update_query(node, file_path, content)? {
                    concepts.push(concept);
                }
            }
            "_delete_statement" | "delete" => {
                if let Some(concept) = self.extract_delete_query(node, file_path, content)? {
                    concepts.push(concept);
                }
            }

            // Standalone column definitions
            "column_definition" => {
                if let Some(concept) = self.extract_column(node, file_path, content)? {
                    concepts.push(concept);
                }
            }

            _ => {}
        }
        Ok(())
    }

    /// Extract table definition with comprehensive metadata
    fn extract_table(&self, node: Node<'_>, file_path: &str, content: &str) -> Result<Option<SemanticConcept>, ParseError> {
        let name = self.extract_object_name(node, content)?;
        if name.is_empty() {
            return Ok(None);
        }

        let mut metadata = HashMap::new();
        let mut relationships = HashMap::new();

        // Extract table type (temporary, unlogged, external, etc.)
        let mut table_type = "table".to_string();
        let mut cursor = node.walk();
        for child in node.children(&mut cursor) {
            match child.kind() {
                "keyword_temporary" => {
                    table_type = "temporary_table".to_string();
                    metadata.insert("temporary".to_string(), "true".to_string());
                }
                "keyword_unlogged" => {
                    metadata.insert("unlogged".to_string(), "true".to_string());
                }
                "keyword_external" => {
                    table_type = "external_table".to_string();
                    metadata.insert("external".to_string(), "true".to_string());
                }
                "_if_not_exists" => {
                    metadata.insert("if_not_exists".to_string(), "true".to_string());
                }
                "column_definitions" => {
                    let column_count = self.count_columns(child);
                    metadata.insert("column_count".to_string(), column_count.to_string());
                }
                _ => {}
            }
        }

        relationships.insert("sql_object_type".to_string(), table_type.clone());

        Ok(Some(SemanticConcept {
            id: format!("sql_table_{}_{}", file_path, name),
            name,
            concept_type: table_type,
            confidence: 0.95,
            file_path: file_path.to_string(),
            line_range: self.get_line_range(node),
            relationships,
            metadata,
        }))
    }

    /// Extract table columns with types and constraints
    fn extract_table_columns(
        &self,
        table_node: Node<'_>,
        file_path: &str,
        content: &str,
        concepts: &mut Vec<SemanticConcept>,
    ) -> Result<(), ParseError> {
        let table_name = self.extract_object_name(table_node, content)?;
        
        Self::walk_node_recursively(table_node, &mut |node| {
            if node.kind() == "column_definition" {
                if let Ok(Some(mut column)) = self.extract_column(node, file_path, content) {
                    // Link column to its table
                    column.relationships.insert("parent_table".to_string(), table_name.clone());
                    concepts.push(column);
                }
            }
        });

        Ok(())
    }

    /// Extract column definition with type and constraints
    fn extract_column(&self, node: Node<'_>, file_path: &str, content: &str) -> Result<Option<SemanticConcept>, ParseError> {
        let mut column_name = String::new();
        let mut _column_type = String::new();
        let mut metadata = HashMap::new();
        let mut relationships = HashMap::new();

        let mut cursor = node.walk();
        for child in node.children(&mut cursor) {
            match child.kind() {
                "_column" => {
                    column_name = self.extract_identifier(child, content);
                }
                "_type" => {
                    _column_type = self.extract_type_info(child, content);
                    metadata.insert("data_type".to_string(), _column_type.clone());
                }
                "_column_constraint" => {
                    let constraint_info = self.extract_constraint_info(child, content);
                    for (key, value) in constraint_info {
                        metadata.insert(key, value);
                    }
                }
                _ => {}
            }
        }

        if column_name.is_empty() {
            return Ok(None);
        }

        relationships.insert("sql_object_type".to_string(), "column".to_string());

        Ok(Some(SemanticConcept {
            id: format!("sql_column_{}_{}", file_path, column_name),
            name: column_name,
            concept_type: "column".to_string(),
            confidence: 0.9,
            file_path: file_path.to_string(),
            line_range: self.get_line_range(node),
            relationships,
            metadata,
        }))
    }

    /// Extract view definition
    fn extract_view(&self, node: Node<'_>, file_path: &str, content: &str) -> Result<Option<SemanticConcept>, ParseError> {
        let name = self.extract_object_name(node, content)?;
        if name.is_empty() {
            return Ok(None);
        }

        let mut metadata = HashMap::new();
        let mut relationships = HashMap::new();

        // Check for view modifiers
        let mut cursor = node.walk();
        for child in node.children(&mut cursor) {
            match child.kind() {
                "_or_replace" => {
                    metadata.insert("or_replace".to_string(), "true".to_string());
                }
                "keyword_temporary" => {
                    metadata.insert("temporary".to_string(), "true".to_string());
                }
                "keyword_recursive" => {
                    metadata.insert("recursive".to_string(), "true".to_string());
                }
                "_if_not_exists" => {
                    metadata.insert("if_not_exists".to_string(), "true".to_string());
                }
                "create_query" | "_select_statement" => {
                    metadata.insert("has_query".to_string(), "true".to_string());
                    // Could extract referenced tables here
                }
                _ => {}
            }
        }

        relationships.insert("sql_object_type".to_string(), "view".to_string());

        Ok(Some(SemanticConcept {
            id: format!("sql_view_{}_{}", file_path, name),
            name,
            concept_type: "view".to_string(),
            confidence: 0.95,
            file_path: file_path.to_string(),
            line_range: self.get_line_range(node),
            relationships,
            metadata,
        }))
    }

    /// Extract function definition
    fn extract_function(&self, node: Node<'_>, file_path: &str, content: &str) -> Result<Option<SemanticConcept>, ParseError> {
        let name = self.extract_object_name(node, content)?;
        if name.is_empty() {
            return Ok(None);
        }

        let mut metadata = HashMap::new();
        let mut relationships = HashMap::new();

        let mut cursor = node.walk();
        for child in node.children(&mut cursor) {
            match child.kind() {
                "_or_replace" => {
                    metadata.insert("or_replace".to_string(), "true".to_string());
                }
                "function_arguments" => {
                    let arg_count = self.count_function_arguments(child);
                    metadata.insert("argument_count".to_string(), arg_count.to_string());
                }
                "_type" => {
                    let return_type = self.extract_type_info(child, content);
                    metadata.insert("return_type".to_string(), return_type);
                }
                "keyword_setof" => {
                    metadata.insert("returns_set".to_string(), "true".to_string());
                }
                _ => {}
            }
        }

        relationships.insert("sql_object_type".to_string(), "function".to_string());

        Ok(Some(SemanticConcept {
            id: format!("sql_function_{}_{}", file_path, name),
            name,
            concept_type: "function".to_string(),
            confidence: 0.9,
            file_path: file_path.to_string(),
            line_range: self.get_line_range(node),
            relationships,
            metadata,
        }))
    }

    /// Extract index definition
    fn extract_index(&self, node: Node<'_>, file_path: &str, content: &str) -> Result<Option<SemanticConcept>, ParseError> {
        let mut index_name = String::new();
        let mut metadata = HashMap::new();
        let mut relationships = HashMap::new();

        let mut cursor = node.walk();
        for child in node.children(&mut cursor) {
            match child.kind() {
                "keyword_unique" => {
                    metadata.insert("unique".to_string(), "true".to_string());
                }
                "keyword_concurrently" => {
                    metadata.insert("concurrent".to_string(), "true".to_string());
                }
                "_if_not_exists" => {
                    metadata.insert("if_not_exists".to_string(), "true".to_string());
                }
                "_column" => {
                    if index_name.is_empty() {
                        index_name = self.extract_identifier(child, content);
                    }
                }
                "object_reference" => {
                    let table_name = self.extract_identifier(child, content);
                    relationships.insert("indexed_table".to_string(), table_name);
                }
                _ => {}
            }
        }

        if index_name.is_empty() {
            index_name = "unnamed_index".to_string();
        }

        relationships.insert("sql_object_type".to_string(), "index".to_string());

        Ok(Some(SemanticConcept {
            id: format!("sql_index_{}_{}", file_path, index_name),
            name: index_name,
            concept_type: "index".to_string(),
            confidence: 0.85,
            file_path: file_path.to_string(),
            line_range: self.get_line_range(node),
            relationships,
            metadata,
        }))
    }

    /// Extract trigger definition
    fn extract_trigger(&self, node: Node<'_>, file_path: &str, content: &str) -> Result<Option<SemanticConcept>, ParseError> {
        let name = self.extract_object_name(node, content)?;
        if name.is_empty() {
            return Ok(None);
        }

        let mut metadata = HashMap::new();
        let mut relationships = HashMap::new();

        // Extract trigger timing, events, etc.
        let mut cursor = node.walk();
        for child in node.children(&mut cursor) {
            match child.kind() {
                "keyword_before" => metadata.insert("timing".to_string(), "before".to_string()),
                "keyword_after" => metadata.insert("timing".to_string(), "after".to_string()),
                "keyword_instead" => metadata.insert("timing".to_string(), "instead_of".to_string()),
                "keyword_insert" => metadata.insert("event_insert".to_string(), "true".to_string()),
                "keyword_update" => metadata.insert("event_update".to_string(), "true".to_string()),
                "keyword_delete" => metadata.insert("event_delete".to_string(), "true".to_string()),
                _ => None,
            };
        }

        relationships.insert("sql_object_type".to_string(), "trigger".to_string());

        Ok(Some(SemanticConcept {
            id: format!("sql_trigger_{}_{}", file_path, name),
            name,
            concept_type: "trigger".to_string(),
            confidence: 0.85,
            file_path: file_path.to_string(),
            line_range: self.get_line_range(node),
            relationships,
            metadata,
        }))
    }

    /// Extract SELECT query information
    fn extract_select_query(&self, node: Node<'_>, file_path: &str, content: &str) -> Result<Option<SemanticConcept>, ParseError> {
        let mut metadata = HashMap::new();
        let mut relationships = HashMap::new();
        let mut referenced_tables = Vec::new();

        // Extract table references from FROM clauses
        Self::walk_node_recursively(node, &mut |child| {
            if child.kind() == "object_reference" {
                let table_name = self.extract_identifier(child, content);
                if !table_name.is_empty() {
                    referenced_tables.push(table_name);
                }
            }
        });

        if !referenced_tables.is_empty() {
            metadata.insert("referenced_tables".to_string(), referenced_tables.join(","));
        }

        let _query_text = self.get_node_text(node, content);
        let query_id = format!("sql_select_{}_{}", file_path, self.get_line_range(node).start);

        relationships.insert("sql_object_type".to_string(), "query".to_string());
        relationships.insert("query_type".to_string(), "select".to_string());

        Ok(Some(SemanticConcept {
            id: query_id,
            name: "SELECT Query".to_string(),
            concept_type: "query".to_string(),
            confidence: 0.75,
            file_path: file_path.to_string(),
            line_range: self.get_line_range(node),
            relationships,
            metadata,
        }))
    }

    /// Extract INSERT query information
    fn extract_insert_query(&self, node: Node<'_>, file_path: &str, content: &str) -> Result<Option<SemanticConcept>, ParseError> {
        let mut metadata = HashMap::new();
        let mut relationships = HashMap::new();

        // Find target table
        if let Some(target_table) = self.find_insert_target_table(node, content) {
            metadata.insert("target_table".to_string(), target_table);
        }

        let query_id = format!("sql_insert_{}_{}", file_path, self.get_line_range(node).start);

        relationships.insert("sql_object_type".to_string(), "query".to_string());
        relationships.insert("query_type".to_string(), "insert".to_string());

        Ok(Some(SemanticConcept {
            id: query_id,
            name: "INSERT Query".to_string(),
            concept_type: "query".to_string(),
            confidence: 0.75,
            file_path: file_path.to_string(),
            line_range: self.get_line_range(node),
            relationships,
            metadata,
        }))
    }

    /// Extract UPDATE query information
    fn extract_update_query(&self, node: Node<'_>, file_path: &str, content: &str) -> Result<Option<SemanticConcept>, ParseError> {
        let mut metadata = HashMap::new();
        let mut relationships = HashMap::new();

        // Find target table
        if let Some(target_table) = self.find_update_target_table(node, content) {
            metadata.insert("target_table".to_string(), target_table);
        }

        let query_id = format!("sql_update_{}_{}", file_path, self.get_line_range(node).start);

        relationships.insert("sql_object_type".to_string(), "query".to_string());
        relationships.insert("query_type".to_string(), "update".to_string());

        Ok(Some(SemanticConcept {
            id: query_id,
            name: "UPDATE Query".to_string(),
            concept_type: "query".to_string(),
            confidence: 0.75,
            file_path: file_path.to_string(),
            line_range: self.get_line_range(node),
            relationships,
            metadata,
        }))
    }

    /// Extract DELETE query information
    fn extract_delete_query(&self, node: Node<'_>, file_path: &str, content: &str) -> Result<Option<SemanticConcept>, ParseError> {
        let mut metadata = HashMap::new();
        let mut relationships = HashMap::new();

        // Find target table
        if let Some(target_table) = self.find_delete_target_table(node, content) {
            metadata.insert("target_table".to_string(), target_table);
        }

        let query_id = format!("sql_delete_{}_{}", file_path, self.get_line_range(node).start);

        relationships.insert("sql_object_type".to_string(), "query".to_string());
        relationships.insert("query_type".to_string(), "delete".to_string());

        Ok(Some(SemanticConcept {
            id: query_id,
            name: "DELETE Query".to_string(),
            concept_type: "query".to_string(),
            confidence: 0.75,
            file_path: file_path.to_string(),
            line_range: self.get_line_range(node),
            relationships,
            metadata,
        }))
    }

    // Helper methods

    /// Extract object name from various SQL constructs
    fn extract_object_name(&self, node: Node<'_>, content: &str) -> Result<String, ParseError> {
        let mut cursor = node.walk();
        for child in node.children(&mut cursor) {
            if child.kind() == "object_reference" {
                return Ok(self.extract_identifier(child, content));
            }
        }
        Ok(String::new())
    }

    /// Extract identifier text from node
    fn extract_identifier(&self, node: Node<'_>, content: &str) -> String {
        self.get_node_text(node, content)
            .split('.')
            .next_back()
            .unwrap_or("")
            .trim_matches('"')
            .trim_matches('`')
            .to_string()
    }

    /// Get text content of a node
    fn get_node_text(&self, node: Node<'_>, content: &str) -> String {
        content
            .get(node.start_byte()..node.end_byte())
            .unwrap_or("")
            .to_string()
    }

    /// Get line range for a node
    fn get_line_range(&self, node: Node<'_>) -> LineRange {
        LineRange {
            start: node.start_position().row as u32 + 1,
            end: node.end_position().row as u32 + 1,
        }
    }

    /// Walk node recursively with callback
    fn walk_node_recursively<F>(node: Node<'_>, callback: &mut F)
    where
        F: FnMut(Node<'_>),
    {
        callback(node);
        let mut cursor = node.walk();
        for child in node.children(&mut cursor) {
            Self::walk_node_recursively(child, callback);
        }
    }

    /// Count columns in column_definitions
    fn count_columns(&self, node: Node<'_>) -> usize {
        let mut count = 0;
        Self::walk_node_recursively(node, &mut |child| {
            if child.kind() == "column_definition" {
                count += 1;
            }
        });
        count
    }

    /// Count function arguments
    fn count_function_arguments(&self, node: Node<'_>) -> usize {
        let mut count = 0;
        Self::walk_node_recursively(node, &mut |child| {
            if child.kind() == "function_argument" {
                count += 1;
            }
        });
        count
    }

    /// Extract type information
    fn extract_type_info(&self, node: Node<'_>, content: &str) -> String {
        self.get_node_text(node, content)
    }

    /// Extract constraint information from column constraint
    fn extract_constraint_info(&self, node: Node<'_>, _content: &str) -> HashMap<String, String> {
        let mut constraints = HashMap::new();
        
        Self::walk_node_recursively(node, &mut |child| {
            match child.kind() {
                "keyword_null" => {
                    constraints.insert("nullable".to_string(), "true".to_string());
                }
                "_not_null" => {
                    constraints.insert("nullable".to_string(), "false".to_string());
                }
                "keyword_primary" => {
                    constraints.insert("primary_key".to_string(), "true".to_string());
                }
                "keyword_unique" => {
                    constraints.insert("unique".to_string(), "true".to_string());
                }
                "keyword_references" => {
                    constraints.insert("foreign_key".to_string(), "true".to_string());
                }
                "keyword_default" => {
                    constraints.insert("has_default".to_string(), "true".to_string());
                }
                _ => {}
            }
        });

        constraints
    }

    /// Find INSERT target table
    fn find_insert_target_table(&self, node: Node<'_>, content: &str) -> Option<String> {
        let mut target = None;
        Self::walk_node_recursively(node, &mut |child| {
            if child.kind() == "object_reference" && target.is_none() {
                target = Some(self.extract_identifier(child, content));
            }
        });
        target
    }

    /// Find UPDATE target table
    fn find_update_target_table(&self, node: Node<'_>, content: &str) -> Option<String> {
        let mut target = None;
        Self::walk_node_recursively(node, &mut |child| {
            if child.kind() == "relation" && target.is_none() {
                target = Some(self.extract_identifier(child, content));
            }
        });
        target
    }

    /// Find DELETE target table
    fn find_delete_target_table(&self, node: Node<'_>, content: &str) -> Option<String> {
        let mut target = None;
        Self::walk_node_recursively(node, &mut |child| {
            if child.kind() == "_delete_from" && target.is_none() {
                // Look for relation within the delete_from
                let mut cursor = child.walk();
                for grandchild in child.children(&mut cursor) {
                    if grandchild.kind() == "relation" {
                        target = Some(self.extract_identifier(grandchild, content));
                        break;
                    }
                }
            }
        });
        target
    }
}

impl Default for SqlExtractor {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::parsing::ParserManager;

    fn create_sql_tree(sql: &str) -> tree_sitter::Tree {
        let mut parser_manager = ParserManager::new().unwrap();
        parser_manager.parse(sql, "sql").unwrap()
    }

    fn extract_all_concepts(extractor: &SqlExtractor, tree: &tree_sitter::Tree, file_path: &str, content: &str) -> Vec<SemanticConcept> {
        let mut concepts = Vec::new();
        let _cursor = tree.root_node().walk();
        
        fn walk_recursive(node: tree_sitter::Node<'_>, extractor: &SqlExtractor, file_path: &str, content: &str, concepts: &mut Vec<SemanticConcept>) {
            let _ = extractor.extract_concepts(node, file_path, content, concepts);
            
            let mut cursor = node.walk();
            for child in node.children(&mut cursor) {
                walk_recursive(child, extractor, file_path, content, concepts);
            }
        }
        
        walk_recursive(tree.root_node(), extractor, file_path, content, &mut concepts);
        concepts
    }

    #[test]
    fn test_comprehensive_table_extraction() {
        let extractor = SqlExtractor::new();
        let sql = r#"
            CREATE TABLE users (
                id INTEGER PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(255) UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        "#;
        
        let tree = create_sql_tree(sql);
        let concepts = extract_all_concepts(&extractor, &tree, "test.sql", sql);
        
        println!("Found {} concepts", concepts.len());
        for concept in &concepts {
            println!("- {}: {} ({})", concept.name, concept.concept_type, concept.confidence);
        }
        
        // Should find table + columns
        assert!(concepts.len() >= 2); // At least table + some columns
        
        let table = concepts.iter().find(|c| c.concept_type == "table").unwrap();
        assert_eq!(table.name, "users");
        assert!(table.metadata.contains_key("column_count"));
        
        let columns: Vec<_> = concepts.iter().filter(|c| c.concept_type == "column").collect();
        assert!(columns.len() >= 2); // Should find multiple columns
        
        // Check column details
        let id_column = columns.iter().find(|c| c.name == "id");
        assert!(id_column.is_some());
        if let Some(col) = id_column {
            assert_eq!(col.metadata.get("data_type").unwrap(), "INTEGER");
            assert_eq!(col.metadata.get("primary_key").unwrap(), "true");
        }
    }

    #[test]
    fn test_view_extraction() {
        let extractor = SqlExtractor::new();
        let sql = r#"
            CREATE OR REPLACE VIEW user_summary AS
            SELECT id, name, email FROM users WHERE active = true;
        "#;
        
        let tree = create_sql_tree(sql);
        let concepts = extract_all_concepts(&extractor, &tree, "test.sql", sql);
        
        let view = concepts.iter().find(|c| c.concept_type == "view");
        assert!(view.is_some());
        if let Some(v) = view {
            assert_eq!(v.name, "user_summary");
            assert_eq!(v.metadata.get("or_replace").unwrap(), "true");
            assert_eq!(v.metadata.get("has_query").unwrap(), "true");
        }
    }

    #[test]
    fn test_function_extraction() {
        let extractor = SqlExtractor::new();
        let sql = r#"
            CREATE FUNCTION get_user_count() RETURNS INTEGER AS $$
            BEGIN
                RETURN (SELECT COUNT(*) FROM users);
            END;
            $$ LANGUAGE plpgsql;
        "#;
        
        let tree = create_sql_tree(sql);
        let concepts = extract_all_concepts(&extractor, &tree, "test.sql", sql);
        
        let function = concepts.iter().find(|c| c.concept_type == "function");
        assert!(function.is_some());
        if let Some(f) = function {
            assert_eq!(f.name, "get_user_count");
            assert!(f.metadata.contains_key("return_type"));
        }
    }

    #[test]
    fn test_index_extraction() {
        let extractor = SqlExtractor::new();
        let sql = r#"
            CREATE UNIQUE INDEX idx_users_email ON users (email);
        "#;
        
        let tree = create_sql_tree(sql);
        let concepts = extract_all_concepts(&extractor, &tree, "test.sql", sql);
        
        let index = concepts.iter().find(|c| c.concept_type == "index");
        assert!(index.is_some());
        if let Some(idx) = index {
            assert_eq!(idx.metadata.get("unique").unwrap(), "true");
            assert!(idx.relationships.contains_key("indexed_table"));
        }
    }

    #[test]
    fn test_query_extraction() {
        let extractor = SqlExtractor::new();
        let sql = r#"
            SELECT u.name, u.email, p.title 
            FROM users u 
            JOIN profiles p ON u.id = p.user_id 
            WHERE u.active = true;
            
            INSERT INTO users (name, email) VALUES ('John', 'john@example.com');
            
            UPDATE users SET last_login = NOW() WHERE id = 1;
            
            DELETE FROM users WHERE active = false;
        "#;
        
        let tree = create_sql_tree(sql);
        let concepts = extract_all_concepts(&extractor, &tree, "test.sql", sql);
        
        let queries: Vec<_> = concepts.iter().filter(|c| c.concept_type == "query").collect();
        assert!(queries.len() >= 4); // SELECT, INSERT, UPDATE, DELETE
        
        let select_query = queries.iter().find(|q| 
            q.relationships.get("query_type") == Some(&"select".to_string())
        );
        assert!(select_query.is_some());
        
        let insert_query = queries.iter().find(|q| 
            q.relationships.get("query_type") == Some(&"insert".to_string())
        );
        assert!(insert_query.is_some());
    }

    #[test]
    fn test_complex_sql_schema() {
        let extractor = SqlExtractor::new();
        let sql = r#"
            CREATE TABLE orders (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                total DECIMAL(10,2) NOT NULL,
                status VARCHAR(20) DEFAULT 'pending'
            );
            
            CREATE INDEX idx_orders_user_id ON orders (user_id);
            CREATE INDEX idx_orders_status ON orders (status);
            
            CREATE VIEW active_orders AS
            SELECT o.*, u.name as user_name
            FROM orders o
            JOIN users u ON o.user_id = u.id
            WHERE o.status IN ('pending', 'processing');
        "#;
        
        let tree = create_sql_tree(sql);
        let concepts = extract_all_concepts(&extractor, &tree, "schema.sql", sql);
        
        println!("Complex schema found {} concepts:", concepts.len());
        for concept in &concepts {
            println!("- {}: {} (confidence: {:.2})", 
                concept.name, concept.concept_type, concept.confidence);
        }
        
        // Should find table, columns, indexes, and view
        let tables: Vec<_> = concepts.iter().filter(|c| c.concept_type == "table").collect();
        let columns: Vec<_> = concepts.iter().filter(|c| c.concept_type == "column").collect();
        let indexes: Vec<_> = concepts.iter().filter(|c| c.concept_type == "index").collect();
        let views: Vec<_> = concepts.iter().filter(|c| c.concept_type == "view").collect();
        
        assert_eq!(tables.len(), 1);
        assert!(columns.len() >= 3); // Multiple columns
        assert!(indexes.len() >= 2); // Two indexes
        assert_eq!(views.len(), 1);
        
        // Verify table metadata
        let orders_table = tables[0];
        assert_eq!(orders_table.name, "orders");
        
        // Verify foreign key constraint
        let user_id_column = columns.iter().find(|c| c.name == "user_id");
        assert!(user_id_column.is_some());
        if let Some(col) = user_id_column {
            assert_eq!(col.metadata.get("foreign_key").unwrap(), "true");
        }
    }

    #[test]
    fn test_invalid_sql_handling() {
        let extractor = SqlExtractor::new();
        let sql = "CREATE TABLE {{{ invalid syntax";
        
        let tree = create_sql_tree(sql);
        let mut concepts = Vec::new();
        let result = extractor.extract_concepts(tree.root_node(), "invalid.sql", sql, &mut concepts);
        
        assert!(result.is_ok()); // Should not crash on invalid syntax
        // Length is always >= 0 for Vec
    }

    #[test]
    fn test_concept_relationships() {
        let extractor = SqlExtractor::new();
        let sql = r#"
            CREATE TABLE products (
                id INTEGER PRIMARY KEY,
                name VARCHAR(100),
                category_id INTEGER REFERENCES categories(id)
            );
        "#;
        
        let tree = create_sql_tree(sql);
        let concepts = extract_all_concepts(&extractor, &tree, "products.sql", sql);
        
        let table = concepts.iter().find(|c| c.concept_type == "table").unwrap();
        assert_eq!(table.relationships.get("sql_object_type").unwrap(), "table");
        
        let columns: Vec<_> = concepts.iter().filter(|c| c.concept_type == "column").collect();
        for column in columns {
            assert_eq!(column.relationships.get("parent_table").unwrap(), "products");
        }
    }

    #[test]
    fn test_line_number_accuracy() {
        let extractor = SqlExtractor::new();
        let sql = r#"
CREATE TABLE test (
    id INTEGER,
    name VARCHAR(50)
);

CREATE VIEW test_view AS SELECT * FROM test;
        "#;
        
        let tree = create_sql_tree(sql);
        let concepts = extract_all_concepts(&extractor, &tree, "test.sql", sql);
        
        let table = concepts.iter().find(|c| c.concept_type == "table").unwrap();
        assert_eq!(table.line_range.start, 2); // Second line
        
        let view = concepts.iter().find(|c| c.concept_type == "view").unwrap();
        assert_eq!(view.line_range.start, 7); // Seventh line
    }
}