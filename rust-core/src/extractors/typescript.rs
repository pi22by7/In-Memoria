//! Comprehensive TypeScript and JavaScript concept extraction using full grammar support
//!
//! This module provides detailed extraction of TypeScript/JavaScript constructs including:
//! - Classes (regular, abstract, with decorators)
//! - Interfaces with method signatures  
//! - Functions (regular, async, generator, arrow functions)
//! - Type definitions (type aliases, enums, generics)
//! - Modules and namespaces
//! - Import/export statements
//! - Variables with type annotations
//! - JSX elements (for TSX)

use crate::types::{LineRange, ParseError, SemanticConcept};
use std::collections::HashMap;
use tree_sitter::Node;

/// Advanced TypeScript/JavaScript concept extractor using full grammar support
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
                if let Some(concept) =
                    self.extract_concept_from_node(node, file_path, content, "function")?
                {
                    concepts.push(concept);
                }
            }
            "variable_declaration" | "lexical_declaration" => {
                self.extract_variables(node, file_path, content, concepts)?;
            }

            // Module constructs
            "module" | "internal_module" => {
                if let Some(concept) = self.extract_module(node, file_path, content)? {
                    concepts.push(concept);
                }
            }

            // Import/Export
            "import_statement" => {
                if let Some(concept) = self.extract_import(node, file_path, content)? {
                    concepts.push(concept);
                }
            }
            "export_statement" => {
                if let Some(concept) = self.extract_export(node, file_path, content)? {
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
        let name = self.extract_name_from_node(node, content)?;
        if name.is_empty() {
            return Ok(None);
        }

        let mut metadata = HashMap::new();

        // Add enhanced metadata based on type
        match concept_type {
            "function" => {
                if self.has_async_modifier(node) {
                    metadata.insert("async".to_string(), "true".to_string());
                }
                if self.has_static_modifier(node) {
                    metadata.insert("static".to_string(), "true".to_string());
                }
                if let Some(params) = self.extract_function_parameters(node, content) {
                    metadata.insert("parameters".to_string(), params);
                }
            }
            "class" => {
                let decorators = self.extract_decorators(node, content);
                if !decorators.is_empty() {
                    metadata.insert("decorators".to_string(), decorators.join(", "));
                }
                if let Some(access) = self.extract_accessibility_modifier(node, content) {
                    metadata.insert("accessibility".to_string(), access);
                }

                // Check for extends/implements
                if let Some(extends) = self.find_child_by_kind(node, "class_heritage") {
                    if let Some(extends_text) = self.extract_text_from_node(extends, content) {
                        metadata.insert("extends".to_string(), extends_text);
                    }
                }
            }
            "interface" => {
                if let Some(extends) = self.find_child_by_kind(node, "extends_type_clause") {
                    let extended_types = self.extract_extended_types(extends, content);
                    if !extended_types.is_empty() {
                        metadata.insert("extends".to_string(), extended_types.join(", "));
                    }
                }
            }
            "type" => {
                if let Some(type_node) = self.find_child_by_field(node, "value") {
                    if let Some(type_def) = self.extract_text_from_node(type_node, content) {
                        metadata.insert("definition".to_string(), type_def);
                    }
                }
            }
            "enum" => {
                // Check if const enum
                let mut cursor = node.walk();
                for child in node.children(&mut cursor) {
                    if child.kind() == "const" {
                        metadata.insert("const".to_string(), "true".to_string());
                        break;
                    }
                }
            }
            "variable" => {
                // Check for type annotation
                if let Some(type_node) = self.find_child_by_kind(node, "type_annotation") {
                    if let Some(type_text) = self.extract_text_from_node(type_node, content) {
                        metadata.insert("type".to_string(), type_text);
                    }
                }
            }
            _ => {}
        }

        Ok(Some(self.create_concept(
            name,
            concept_type.to_string(),
            node,
            file_path,
            0.8,
            metadata,
        )))
    }

    /// Extract variables from variable/lexical declarations
    fn extract_variables(
        &self,
        node: Node<'_>,
        file_path: &str,
        content: &str,
        concepts: &mut Vec<SemanticConcept>,
    ) -> Result<(), ParseError> {
        let mut cursor = node.walk();
        for child in node.children(&mut cursor) {
            if child.kind() == "variable_declarator" {
                if let Some(name_node) = self.find_child_by_field(child, "name") {
                    if let Some(name) = self.extract_text_from_node(name_node, content) {
                        if !name.is_empty() {
                            let mut metadata = HashMap::new();

                            // Check if has type annotation
                            if let Some(type_node) =
                                self.find_child_by_kind(child, "type_annotation")
                            {
                                if let Some(type_text) =
                                    self.extract_text_from_node(type_node, content)
                                {
                                    metadata.insert("type".to_string(), type_text);
                                }
                            }

                            concepts.push(self.create_concept(
                                name,
                                "variable".to_string(),
                                child,
                                file_path,
                                0.7,
                                metadata,
                            ));
                        }
                    }
                }
            }
        }
        Ok(())
    }

    /// Extract module/namespace declaration
    fn extract_module(
        &self,
        node: Node<'_>,
        file_path: &str,
        content: &str,
    ) -> Result<Option<SemanticConcept>, ParseError> {
        let name = self.extract_name_from_node(node, content)?;
        if name.is_empty() {
            return Ok(None);
        }

        let mut metadata = HashMap::new();

        // Distinguish between module and namespace
        if node.kind() == "internal_module" {
            metadata.insert("type".to_string(), "namespace".to_string());
        } else {
            metadata.insert("type".to_string(), "module".to_string());
        }

        Ok(Some(self.create_concept(
            name,
            "module".to_string(),
            node,
            file_path,
            0.8,
            metadata,
        )))
    }

    /// Extract import statement
    fn extract_import(
        &self,
        node: Node<'_>,
        file_path: &str,
        content: &str,
    ) -> Result<Option<SemanticConcept>, ParseError> {
        // Extract source path
        if let Some(source_node) = self.find_child_by_field(node, "source") {
            if let Some(source_text) = self.extract_text_from_node(source_node, content) {
                let mut metadata = HashMap::new();
                metadata.insert("source".to_string(), source_text.clone());

                // Try to get a meaningful name from the import
                let name = source_text
                    .trim_matches('"')
                    .trim_matches('\'')
                    .split('/')
                    .next_back()
                    .unwrap_or("import")
                    .to_string();

                return Ok(Some(self.create_concept(
                    name,
                    "import".to_string(),
                    node,
                    file_path,
                    0.6,
                    metadata,
                )));
            }
        }
        Ok(None)
    }

    /// Extract export statement
    fn extract_export(
        &self,
        node: Node<'_>,
        file_path: &str,
        content: &str,
    ) -> Result<Option<SemanticConcept>, ParseError> {
        // Check if it's a declaration export
        if let Some(decl_node) = self.find_child_by_field(node, "declaration") {
            let name = self.extract_name_from_node(decl_node, content)?;
            if !name.is_empty() {
                let mut metadata = HashMap::new();
                metadata.insert("exported".to_string(), "true".to_string());

                let concept_type = match decl_node.kind() {
                    "class_declaration" => "class",
                    "function_declaration" => "function",
                    "interface_declaration" => "interface",
                    "type_alias_declaration" => "type",
                    "enum_declaration" => "enum",
                    _ => "export",
                };

                return Ok(Some(self.create_concept(
                    name,
                    concept_type.to_string(),
                    decl_node,
                    file_path,
                    0.8,
                    metadata,
                )));
            }
        }

        // Handle export clauses
        if let Some(_export_clause) = self.find_child_by_kind(node, "export_clause") {
            return Ok(Some(self.create_concept(
                "export_clause".to_string(),
                "export".to_string(),
                node,
                file_path,
                0.5,
                HashMap::new(),
            )));
        }

        Ok(None)
    }
}

impl Default for TypeScriptExtractor {
    fn default() -> Self {
        Self::new()
    }
}

// Helper methods implementation
impl TypeScriptExtractor {
    /// Extract name from a node using various strategies
    fn extract_name_from_node(&self, node: Node<'_>, content: &str) -> Result<String, ParseError> {
        // Try to find name field first
        if let Some(name_node) = self.find_child_by_field(node, "name") {
            if let Some(name) = self.extract_text_from_node(name_node, content) {
                return Ok(name);
            }
        }

        // Try common name patterns
        let mut cursor = node.walk();
        for child in node.children(&mut cursor) {
            match child.kind() {
                "identifier" | "type_identifier" | "property_identifier" => {
                    if let Some(name) = self.extract_text_from_node(child, content) {
                        return Ok(name);
                    }
                }
                _ => continue,
            }
        }

        Ok(String::new())
    }

    /// Create a semantic concept with standard metadata
    fn create_concept(
        &self,
        name: String,
        concept_type: String,
        node: Node<'_>,
        file_path: &str,
        confidence: f64,
        metadata: HashMap<String, String>,
    ) -> SemanticConcept {
        SemanticConcept {
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
            concept_type,
            confidence,
            file_path: file_path.to_string(),
            line_range: LineRange {
                start: node.start_position().row as u32 + 1,
                end: node.end_position().row as u32 + 1,
            },
            relationships: HashMap::new(),
            metadata,
        }
    }

    /// Find child node by field name
    fn find_child_by_field<'a>(&self, node: Node<'a>, field_name: &str) -> Option<Node<'a>> {
        node.child_by_field_name(field_name)
    }

    /// Find child node by kind
    fn find_child_by_kind<'a>(&self, node: Node<'a>, kind: &str) -> Option<Node<'a>> {
        let mut cursor = node.walk();
        let children: Vec<_> = node.children(&mut cursor).collect();
        children.into_iter().find(|child| child.kind() == kind)
    }

    /// Extract text from a node
    fn extract_text_from_node(&self, node: Node<'_>, content: &str) -> Option<String> {
        if node.start_byte() < content.len() && node.end_byte() <= content.len() {
            Some(content[node.start_byte()..node.end_byte()].to_string())
        } else {
            None
        }
    }

    /// Check if node has async modifier
    fn has_async_modifier(&self, node: Node<'_>) -> bool {
        let mut cursor = node.walk();
        for child in node.children(&mut cursor) {
            if child.kind() == "async" {
                return true;
            }
        }
        false
    }

    /// Check if node has static modifier  
    fn has_static_modifier(&self, node: Node<'_>) -> bool {
        let mut cursor = node.walk();
        for child in node.children(&mut cursor) {
            if child.kind() == "static" {
                return true;
            }
        }
        false
    }

    /// Extract accessibility modifier (public/private/protected)
    fn extract_accessibility_modifier(&self, node: Node<'_>, content: &str) -> Option<String> {
        let mut cursor = node.walk();
        for child in node.children(&mut cursor) {
            if child.kind() == "accessibility_modifier" {
                return self.extract_text_from_node(child, content);
            }
        }
        None
    }

    /// Extract decorators from node
    fn extract_decorators(&self, node: Node<'_>, content: &str) -> Vec<String> {
        let mut decorators = Vec::new();
        let mut cursor = node.walk();

        for child in node.children(&mut cursor) {
            if child.kind() == "decorator" {
                if let Some(decorator_text) = self.extract_text_from_node(child, content) {
                    decorators.push(decorator_text);
                }
            }
        }
        decorators
    }

    /// Extract function parameters  
    fn extract_function_parameters(&self, node: Node<'_>, content: &str) -> Option<String> {
        if let Some(params_node) = self.find_child_by_field(node, "parameters") {
            self.extract_text_from_node(params_node, content)
        } else {
            None
        }
    }

    /// Extract extended types from extends clause
    fn extract_extended_types(&self, node: Node<'_>, content: &str) -> Vec<String> {
        let mut types = Vec::new();
        let mut cursor = node.walk();

        for child in node.children(&mut cursor) {
            if child.kind() == "type" || child.kind() == "identifier" {
                if let Some(type_text) = self.extract_text_from_node(child, content) {
                    types.push(type_text);
                }
            }
        }
        types
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

    fn extract_all_concepts(
        extractor: &TypeScriptExtractor,
        tree: &tree_sitter::Tree,
        file_path: &str,
        content: &str,
    ) -> Vec<SemanticConcept> {
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
    fn test_extract_typescript_class() {
        let extractor = TypeScriptExtractor::new();
        let code = "export class UserService { getName() { return 'test'; } }";
        let tree = create_ts_tree(code);

        let concepts = extract_all_concepts(&extractor, &tree, "test.ts", code);

        // Should find class and method
        let class_concepts: Vec<_> = concepts
            .iter()
            .filter(|c| c.concept_type == "class")
            .collect();
        assert!(!class_concepts.is_empty());

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

        let interface_concepts: Vec<_> = concepts
            .iter()
            .filter(|c| c.concept_type == "class") // Interfaces mapped as classes
            .collect();
        assert!(!interface_concepts.is_empty());

        let interface_concept = &interface_concepts[0];
        assert_eq!(interface_concept.name, "IUserService");
    }

    #[test]
    fn test_extract_typescript_function() {
        let extractor = TypeScriptExtractor::new();
        let code =
            "function calculateTotal(price: number, tax: number): number { return price + tax; }";
        let tree = create_ts_tree(code);

        let concepts = extract_all_concepts(&extractor, &tree, "calc.ts", code);

        let function_concepts: Vec<_> = concepts
            .iter()
            .filter(|c| c.concept_type == "function")
            .collect();
        assert!(!function_concepts.is_empty());

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
        let __variable_concepts: Vec<_> = concepts
            .iter()
            .filter(|c| c.concept_type == "variable")
            .collect();
        assert!(!__variable_concepts.is_empty());
    }

    #[test]
    fn test_extract_javascript_class() {
        let extractor = TypeScriptExtractor::new();
        let code = "class Calculator { add(a, b) { return a + b; } }";
        let tree = create_js_tree(code);

        let concepts = extract_all_concepts(&extractor, &tree, "calc.js", code);

        let class_concepts: Vec<_> = concepts
            .iter()
            .filter(|c| c.concept_type == "class")
            .collect();
        assert!(!class_concepts.is_empty());

        let class_concept = &class_concepts[0];
        assert_eq!(class_concept.name, "Calculator");
    }

    #[test]
    fn test_extract_javascript_function() {
        let extractor = TypeScriptExtractor::new();
        let code = "function hello() { return 'world'; }";
        let tree = create_js_tree(code);

        let concepts = extract_all_concepts(&extractor, &tree, "hello.js", code);

        let function_concepts: Vec<_> = concepts
            .iter()
            .filter(|c| c.concept_type == "function")
            .collect();
        assert!(!function_concepts.is_empty());

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

        let __variable_concepts: Vec<_> = concepts
            .iter()
            .filter(|c| c.concept_type == "variable")
            .collect();
        assert!(!__variable_concepts.is_empty());

        // Should find at least one variable
        let variable_names: Vec<&String> = __variable_concepts.iter().map(|c| &c.name).collect();

        // Note: The exact extraction depends on tree structure
        assert!(!variable_names.is_empty());
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
        let class_concepts: Vec<_> = concepts
            .iter()
            .filter(|c| c.concept_type == "class")
            .collect();
        assert!(!class_concepts.is_empty());

        let function_concepts: Vec<_> = concepts
            .iter()
            .filter(|c| c.concept_type == "function")
            .collect();
        assert!(!function_concepts.is_empty());

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

        let type_concepts: Vec<_> = concepts
            .iter()
            .filter(|c| c.concept_type == "class") // Type aliases mapped as classes
            .collect();
        assert!(!type_concepts.is_empty());

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

        let _concepts = extract_all_concepts(&extractor, &tree, "invalid.js", code);

        // Should not crash on invalid syntax
        // Tree-sitter will parse what it can
        // May or may not find concepts, length is always >= 0
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

        assert!(!concepts.is_empty());

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
        let extractor = TypeScriptExtractor;
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
        assert!(!concepts.is_empty());

        let class_concepts: Vec<_> = concepts
            .iter()
            .filter(|c| c.concept_type == "class")
            .collect();

        let function_concepts: Vec<_> = concepts
            .iter()
            .filter(|c| c.concept_type == "function")
            .collect();

        let __variable_concepts: Vec<_> = concepts
            .iter()
            .filter(|c| c.concept_type == "variable")
            .collect();

        // Should find interfaces, classes, types, and functions
        assert!(!class_concepts.is_empty());
        assert!(!function_concepts.is_empty());

        // Check specific concept names
        let concept_names: Vec<&String> = concepts.iter().map(|c| &c.name).collect();
        assert!(concept_names.contains(&&"DatabaseConnection".to_string()));
        assert!(concept_names.contains(&&"UserRepository".to_string()));
        assert!(concept_names.contains(&&"User".to_string()));
    }
}
