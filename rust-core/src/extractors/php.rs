//! Comprehensive PHP concept extraction using full grammar support
//!
//! This module provides detailed extraction of PHP constructs including:
//! - Classes (abstract, final, interfaces, traits)
//! - Functions (regular, anonymous, arrow functions)
//! - Methods (public, private, protected, static, abstract, final)
//! - Properties (with types, visibility modifiers, property promotion)
//! - Namespaces and use declarations
//! - Interfaces and traits
//! - Attributes (PHP 8+)
//! - Constants and variables
//! - Anonymous classes

use crate::types::{LineRange, ParseError, SemanticConcept};
use std::collections::HashMap;
use tree_sitter::Node;

/// Information about class body analysis
#[derive(Debug, Default)]
struct ClassInfo {
    has_abstract_methods: bool,
    method_count: usize,
    property_count: usize,
    has_constructor: bool,
    has_destructor: bool,
    interfaces: Vec<String>,
    traits: Vec<String>,
    is_abstract: bool,
    is_final: bool,
}

/// Advanced PHP concept extractor using full grammar support
pub struct PHPExtractor;

impl PHPExtractor {
    pub fn new() -> Self {
        Self
    }

    /// Extract concepts from PHP AST nodes using full grammar awareness
    pub fn extract_concepts(
        &self,
        node: Node<'_>,
        file_path: &str,
        content: &str,
        concepts: &mut Vec<SemanticConcept>,
    ) -> Result<(), ParseError> {
        match node.kind() {
            // Class and object-oriented constructs
            "class_declaration" => {
                if let Some(concept) = self.extract_class(node, file_path, content)? {
                    concepts.push(concept);
                }
            }
            "interface_declaration" => {
                if let Some(concept) = self.extract_interface(node, file_path, content)? {
                    concepts.push(concept);
                }
            }
            "trait_declaration" => {
                if let Some(concept) = self.extract_trait(node, file_path, content)? {
                    concepts.push(concept);
                }
            }
            "anonymous_class" => {
                if let Some(concept) = self.extract_anonymous_class(node, file_path, content)? {
                    concepts.push(concept);
                }
            }

            // Function constructs
            "function_definition" => {
                if let Some(concept) = self.extract_function(node, file_path, content)? {
                    concepts.push(concept);
                }
            }
            "method_declaration" => {
                if let Some(concept) = self.extract_method(node, file_path, content)? {
                    concepts.push(concept);
                }
            }
            "arrow_function_expression" => {
                if let Some(concept) = self.extract_arrow_function(node, file_path, content)? {
                    concepts.push(concept);
                }
            }
            "anonymous_function_creation" => {
                if let Some(concept) = self.extract_anonymous_function(node, file_path, content)? {
                    concepts.push(concept);
                }
            }

            // Property and variable constructs
            "property_declaration" => {
                self.extract_properties(node, file_path, content, concepts)?;
            }
            "const_declaration" => {
                if let Some(concept) = self.extract_const_declaration(node, file_path, content)? {
                    concepts.push(concept);
                }
            }
            "variable_declaration_statement" => {
                self.extract_variable_declarations(node, file_path, content, concepts)?;
            }

            // Namespace and imports
            "namespace_definition" => {
                if let Some(concept) = self.extract_namespace(node, file_path, content)? {
                    concepts.push(concept);
                }
            }
            "use_declaration" => {
                if let Some(concept) = self.extract_use_declaration(node, file_path, content)? {
                    concepts.push(concept);
                }
            }

            // Attributes (PHP 8+)
            "attribute_list" => {
                if let Some(concept) = self.extract_attribute_group(node, file_path, content)? {
                    concepts.push(concept);
                }
            }

            _ => {}
        }
        Ok(())
    }

    /// Extract class definition with comprehensive metadata
    fn extract_class(
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

        // Check for modifiers
        if self.has_modifier(node, "abstract_modifier") {
            metadata.insert("abstract".to_string(), "true".to_string());
        }
        if self.has_modifier(node, "final_modifier") {
            metadata.insert("final".to_string(), "true".to_string());
        }

        // Extract interfaces
        if let Some(interface_clause) = self.find_child_by_field(node, "interfaces") {
            let interfaces = self.extract_name_list(interface_clause, content);
            if !interfaces.is_empty() {
                metadata.insert("implements".to_string(), interfaces.join(", "));
            }
        }

        // Extract parent class
        if let Some(base_clause) = self.find_child_by_field(node, "base_clause") {
            if let Some(parent_class) = self.extract_text_from_node(base_clause, content) {
                metadata.insert("extends".to_string(), parent_class);
            }
        }

        // Extract traits
        if let Some(body_node) = self.find_child_by_field(node, "body") {
            let class_info = self.analyze_class_body(body_node, content);
            
            if class_info.method_count > 0 {
                metadata.insert("method_count".to_string(), class_info.method_count.to_string());
            }
            
            if class_info.property_count > 0 {
                metadata.insert("property_count".to_string(), class_info.property_count.to_string());
            }
            
            if class_info.has_constructor {
                metadata.insert("has_constructor".to_string(), "true".to_string());
            }
            
            if class_info.has_destructor {
                metadata.insert("has_destructor".to_string(), "true".to_string());
            }
            
            if !class_info.traits.is_empty() {
                metadata.insert("uses".to_string(), class_info.traits.join(", "));
            }
        }

        Ok(Some(self.create_concept(
            name,
            "class".to_string(),
            node,
            file_path,
            0.9,
            metadata,
        )))
    }

    /// Extract interface definition
    fn extract_interface(
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
        metadata.insert("interface".to_string(), "true".to_string());

        // Extract parent interfaces
        if let Some(base_clause) = self.find_child_by_field(node, "base_clause") {
            let parent_interfaces = self.extract_name_list(base_clause, content);
            if !parent_interfaces.is_empty() {
                metadata.insert("extends".to_string(), parent_interfaces.join(", "));
            }
        }

        Ok(Some(self.create_concept(
            name,
            "interface".to_string(),
            node,
            file_path,
            0.9,
            metadata,
        )))
    }

    /// Extract trait definition
    fn extract_trait(
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
        metadata.insert("trait".to_string(), "true".to_string());

        Ok(Some(self.create_concept(
            name,
            "trait".to_string(),
            node,
            file_path,
            0.9,
            metadata,
        )))
    }

    /// Extract anonymous class
    fn extract_anonymous_class(
        &self,
        node: Node<'_>,
        file_path: &str,
        content: &str,
    ) -> Result<Option<SemanticConcept>, ParseError> {
        let mut metadata = HashMap::new();
        metadata.insert("anonymous".to_string(), "true".to_string());

        // Check for parent class
        if let Some(base_clause) = self.find_child_by_field(node, "base_clause") {
            if let Some(parent_class) = self.extract_text_from_node(base_clause, content) {
                metadata.insert("extends".to_string(), parent_class);
            }
        }

        // Check for interfaces
        if let Some(interface_clause) = self.find_child_by_field(node, "interfaces") {
            let interfaces = self.extract_name_list(interface_clause, content);
            if !interfaces.is_empty() {
                metadata.insert("implements".to_string(), interfaces.join(", "));
            }
        }

        Ok(Some(self.create_concept(
            "anonymous_class".to_string(),
            "class".to_string(),
            node,
            file_path,
            0.7,
            metadata,
        )))
    }

    /// Extract function definition
    fn extract_function(
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

        // Extract parameters
        if let Some(params_node) = self.find_child_by_field(node, "parameters") {
            let params = self.extract_parameters(params_node, content);
            if !params.is_empty() {
                metadata.insert("parameters".to_string(), params);
            }
        }

        // Check for return type
        if let Some(return_type) = self.find_child_by_field(node, "return_type") {
            if let Some(type_text) = self.extract_text_from_node(return_type, content) {
                metadata.insert("return_type".to_string(), type_text);
            }
        }

        Ok(Some(self.create_concept(
            name,
            "function".to_string(),
            node,
            file_path,
            0.8,
            metadata,
        )))
    }

    /// Extract method definition
    fn extract_method(
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

        // Check for visibility modifiers
        if let Some(visibility) = self.extract_visibility_modifier(node, content) {
            metadata.insert("visibility".to_string(), visibility);
        }

        // Check for other modifiers
        if self.has_modifier(node, "static_modifier") {
            metadata.insert("static".to_string(), "true".to_string());
        }
        if self.has_modifier(node, "abstract_modifier") {
            metadata.insert("abstract".to_string(), "true".to_string());
        }
        if self.has_modifier(node, "final_modifier") {
            metadata.insert("final".to_string(), "true".to_string());
        }

        // Extract parameters
        if let Some(params_node) = self.find_child_by_field(node, "parameters") {
            let params = self.extract_parameters(params_node, content);
            if !params.is_empty() {
                metadata.insert("parameters".to_string(), params);
            }
        }

        // Check for return type
        if let Some(return_type) = self.find_child_by_field(node, "return_type") {
            if let Some(type_text) = self.extract_text_from_node(return_type, content) {
                metadata.insert("return_type".to_string(), type_text);
            }
        }

        Ok(Some(self.create_concept(
            name,
            "method".to_string(),
            node,
            file_path,
            0.8,
            metadata,
        )))
    }

    /// Extract arrow function
    fn extract_arrow_function(
        &self,
        node: Node<'_>,
        file_path: &str,
        content: &str,
    ) -> Result<Option<SemanticConcept>, ParseError> {
        let mut metadata = HashMap::new();
        metadata.insert("arrow_function".to_string(), "true".to_string());

        // Extract parameters
        if let Some(params_node) = self.find_child_by_field(node, "parameters") {
            let params = self.extract_parameters(params_node, content);
            if !params.is_empty() {
                metadata.insert("parameters".to_string(), params);
            }
        }

        // Check for return type
        if let Some(return_type) = self.find_child_by_field(node, "return_type") {
            if let Some(type_text) = self.extract_text_from_node(return_type, content) {
                metadata.insert("return_type".to_string(), type_text);
            }
        }

        Ok(Some(self.create_concept(
            "arrow_function".to_string(),
            "function".to_string(),
            node,
            file_path,
            0.7,
            metadata,
        )))
    }

    /// Extract anonymous function
    fn extract_anonymous_function(
        &self,
        node: Node<'_>,
        file_path: &str,
        content: &str,
    ) -> Result<Option<SemanticConcept>, ParseError> {
        let mut metadata = HashMap::new();
        metadata.insert("anonymous_function".to_string(), "true".to_string());

        // Extract parameters
        if let Some(params_node) = self.find_child_by_field(node, "parameters") {
            let params = self.extract_parameters(params_node, content);
            if !params.is_empty() {
                metadata.insert("parameters".to_string(), params);
            }
        }

        Ok(Some(self.create_concept(
            "anonymous_function".to_string(),
            "function".to_string(),
            node,
            file_path,
            0.7,
            metadata,
        )))
    }

    /// Extract properties from property declaration
    fn extract_properties(
        &self,
        node: Node<'_>,
        file_path: &str,
        content: &str,
        concepts: &mut Vec<SemanticConcept>,
    ) -> Result<(), ParseError> {
        let mut cursor = node.walk();
        
        // Extract visibility modifier
        let visibility = self.extract_visibility_modifier(node, content);
        
        // Extract type
        let property_type = if let Some(type_node) = self.find_child_by_field(node, "type") {
            self.extract_text_from_node(type_node, content)
        } else {
            None
        };

        for child in node.children(&mut cursor) {
            if child.kind() == "property_element" {
                if let Some(property_name) = self.extract_property_name(child, content) {
                    let mut metadata = HashMap::new();
                    
                    if let Some(ref vis) = visibility {
                        metadata.insert("visibility".to_string(), vis.clone());
                    }
                    
                    if let Some(ref prop_type) = property_type {
                        metadata.insert("type".to_string(), prop_type.clone());
                    }
                    
                    // Check for property promotion parameters
                    if let Some(_promotion_param) = self.find_child_by_field(child, "property_promotion_parameter") {
                        metadata.insert("property_promotion".to_string(), "true".to_string());
                    }

                    concepts.push(self.create_concept(
                        property_name,
                        "property".to_string(),
                        child,
                        file_path,
                        0.8,
                        metadata,
                    ));
                }
            }
        }
        
        Ok(())
    }

    /// Extract constant declaration
    fn extract_const_declaration(
        &self,
        node: Node<'_>,
        file_path: &str,
        content: &str,
    ) -> Result<Option<SemanticConcept>, ParseError> {
        let mut cursor = node.walk();
        
        for child in node.children(&mut cursor) {
            if child.kind() == "const_element" {
                let const_name = if let Some(name_node) = self.find_child_by_field(child, "name") {
                    self.extract_text_from_node(name_node, content)
                } else {
                    self.extract_text_from_node(child, content)
                };
                
                if let Some(name) = const_name {
                    let mut metadata = HashMap::new();
                    metadata.insert("constant".to_string(), "true".to_string());
                    
                    // Check for visibility (class constants)
                    if let Some(visibility) = self.extract_visibility_modifier(node, content) {
                        metadata.insert("visibility".to_string(), visibility);
                    }
                    
                    return Ok(Some(self.create_concept(
                        name,
                        "constant".to_string(),
                        child,
                        file_path,
                        0.8,
                        metadata,
                    )));
                }
            }
        }
        
        Ok(None)
    }

    /// Extract variable declarations
    fn extract_variable_declarations(
        &self,
        node: Node<'_>,
        file_path: &str,
        content: &str,
        concepts: &mut Vec<SemanticConcept>,
    ) -> Result<(), ParseError> {
        let mut cursor = node.walk();
        
        for child in node.children(&mut cursor) {
            if child.kind() == "variable_declaration" {
                if let Some(var_name) = self.extract_variable_name(child, content) {
                    let mut metadata = HashMap::new();
                    
                    // Check for type
                    if let Some(type_node) = self.find_child_by_field(child, "type") {
                        if let Some(type_text) = self.extract_text_from_node(type_node, content) {
                            metadata.insert("type".to_string(), type_text);
                        }
                    }
                    
                    concepts.push(self.create_concept(
                        var_name,
                        "variable".to_string(),
                        child,
                        file_path,
                        0.6,
                        metadata,
                    ));
                }
            }
        }
        
        Ok(())
    }

    /// Extract namespace definition
    fn extract_namespace(
        &self,
        node: Node<'_>,
        file_path: &str,
        content: &str,
    ) -> Result<Option<SemanticConcept>, ParseError> {
        let name = self.extract_name_from_node(node, content)?;
        if name.is_empty() {
            return Ok(None);
        }

        Ok(Some(self.create_concept(
            name,
            "namespace".to_string(),
            node,
            file_path,
            0.8,
            HashMap::new(),
        )))
    }

    /// Extract use declaration
    fn extract_use_declaration(
        &self,
        node: Node<'_>,
        file_path: &str,
        content: &str,
    ) -> Result<Option<SemanticConcept>, ParseError> {
        let names = self.extract_name_list(node, content);
        if names.is_empty() {
            return Ok(None);
        }

        let mut metadata = HashMap::new();
        metadata.insert("imported_names".to_string(), names.join(", "));

        Ok(Some(self.create_concept(
            format!("use_{}", names.join("_")),
            "import".to_string(),
            node,
            file_path,
            0.6,
            metadata,
        )))
    }

    /// Extract attribute group
    fn extract_attribute_group(
        &self,
        node: Node<'_>,
        file_path: &str,
        content: &str,
    ) -> Result<Option<SemanticConcept>, ParseError> {
        let mut cursor = node.walk();
        
        for child in node.children(&mut cursor) {
            if child.kind() == "attribute" {
                if let Some(attr_name) = self.extract_attribute_name(child, content) {
                    let mut metadata = HashMap::new();
                    metadata.insert("attribute".to_string(), "true".to_string());
                    
                    // Check for arguments
                    if let Some(params_node) = self.find_child_by_field(child, "parameters") {
                        if let Some(args) = self.extract_text_from_node(params_node, content) {
                            metadata.insert("arguments".to_string(), args);
                        }
                    }
                    
                    return Ok(Some(self.create_concept(
                        attr_name,
                        "attribute".to_string(),
                        child,
                        file_path,
                        0.7,
                        metadata,
                    )));
                }
            }
        }
        
        Ok(None)
    }

    // Helper methods

    /// Analyze class body for comprehensive metadata
    fn analyze_class_body(&self, body_node: Node<'_>, content: &str) -> ClassInfo {
        let mut info = ClassInfo::default();
        let mut cursor = body_node.walk();
        
        for child in body_node.children(&mut cursor) {
            match child.kind() {
                "method_declaration" => {
                    info.method_count += 1;
                    
                    if let Ok(method_name) = self.extract_name_from_node(child, content) {
                        if method_name == "__construct" {
                            info.has_constructor = true;
                        } else if method_name == "__destruct" {
                            info.has_destructor = true;
                        }
                    }
                    
                    if self.has_modifier(child, "abstract_modifier") {
                        info.has_abstract_methods = true;
                    }
                }
                "property_declaration" => {
                    info.property_count += 1;
                }
                "use_declaration" => {
                    if let Some(trait_name) = self.extract_text_from_node(child, content) {
                        info.traits.push(trait_name);
                    }
                }
                _ => {}
            }
        }
        
        info
    }

    /// Check if node has a specific modifier
    fn has_modifier(&self, node: Node<'_>, modifier_kind: &str) -> bool {
        let mut cursor = node.walk();
        for child in node.children(&mut cursor) {
            if child.kind() == modifier_kind {
                return true;
            }
        }
        false
    }

    /// Extract visibility modifier
    fn extract_visibility_modifier(&self, node: Node<'_>, content: &str) -> Option<String> {
        let mut cursor = node.walk();
        for child in node.children(&mut cursor) {
            if child.kind() == "visibility_modifier" {
                return self.extract_text_from_node(child, content);
            }
        }
        None
    }

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
                "name" | "identifier" | "variable_name" => {
                    if let Some(name) = self.extract_text_from_node(child, content) {
                        return Ok(name);
                    }
                }
                _ => continue,
            }
        }

        Ok(String::new())
    }

    /// Extract property name
    fn extract_property_name(&self, node: Node<'_>, content: &str) -> Option<String> {
        if let Some(name_node) = self.find_child_by_field(node, "name") {
            self.extract_text_from_node(name_node, content)
        } else if let Some(var_node) = self.find_child_by_field(node, "variable_name") {
            self.extract_text_from_node(var_node, content)
        } else {
            None
        }
    }

    /// Extract variable name
    fn extract_variable_name(&self, node: Node<'_>, content: &str) -> Option<String> {
        if let Some(name_node) = self.find_child_by_field(node, "name") {
            self.extract_text_from_node(name_node, content)
        } else if let Some(var_node) = self.find_child_by_field(node, "variable_name") {
            self.extract_text_from_node(var_node, content)
        } else {
            None
        }
    }

    /// Extract attribute name
    fn extract_attribute_name(&self, node: Node<'_>, content: &str) -> Option<String> {
        if let Some(name_node) = self.find_child_by_field(node, "name") {
            self.extract_text_from_node(name_node, content)
        } else {
            None
        }
    }

    /// Extract parameters list
    fn extract_parameters(&self, node: Node<'_>, content: &str) -> String {
        self.extract_text_from_node(node, content).unwrap_or_default()
    }

    /// Extract list of names (for interfaces, use declarations, etc.)
    fn extract_name_list(&self, node: Node<'_>, content: &str) -> Vec<String> {
        let mut names = Vec::new();
        let mut cursor = node.walk();
        
        for child in node.children(&mut cursor) {
            match child.kind() {
                "name" | "identifier" | "qualified_name" => {
                    if let Some(name) = self.extract_text_from_node(child, content) {
                        names.push(name);
                    }
                }
                _ => continue,
            }
        }
        
        names
    }

    /// Find child node by field name
    fn find_child_by_field<'a>(&self, node: Node<'a>, field_name: &str) -> Option<Node<'a>> {
        node.child_by_field_name(field_name)
    }

    /// Extract text from a node
    fn extract_text_from_node(&self, node: Node<'_>, content: &str) -> Option<String> {
        if node.start_byte() < content.len() && node.end_byte() <= content.len() {
            Some(content[node.start_byte()..node.end_byte()].to_string())
        } else {
            None
        }
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
}

impl Default for PHPExtractor {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::parsing::ParserManager;

    #[test]
    fn test_php_class_extraction() {
        let extractor = PHPExtractor::new();
        let mut manager = ParserManager::new().unwrap();
        let code = "<?php\nclass User {\n    public $name;\n    public function getName() { return $this->name; }\n}";
        let tree = manager.parse(code, "php").unwrap();
        
        let mut concepts = Vec::new();
        let _ = extractor.extract_concepts(tree.root_node(), "test.php", code, &mut concepts);
        
        // Should find class and method
        assert!(concepts.len() > 0);
        
        let class_concepts: Vec<_> = concepts
            .iter()
            .filter(|c| c.concept_type == "class")
            .collect();
        assert!(class_concepts.len() > 0);
        
        assert_eq!(class_concepts[0].name, "User");
    }

    #[test]
    fn test_php_function_extraction() {
        let extractor = PHPExtractor::new();
        let mut manager = ParserManager::new().unwrap();
        let code = "<?php\nfunction calculateTotal($price, $tax) { return $price + $tax; }";
        let tree = manager.parse(code, "php").unwrap();
        
        let mut concepts = Vec::new();
        let _ = extractor.extract_concepts(tree.root_node(), "calc.php", code, &mut concepts);
        
        let function_concepts: Vec<_> = concepts
            .iter()
            .filter(|c| c.concept_type == "function")
            .collect();
        assert!(function_concepts.len() > 0);
        
        assert_eq!(function_concepts[0].name, "calculateTotal");
    }

    #[test]
    fn test_php_interface_extraction() {
        let extractor = PHPExtractor::new();
        let mut manager = ParserManager::new().unwrap();
        let code = "<?php\ninterface UserInterface {\n    public function getName(): string;\n}";
        let tree = manager.parse(code, "php").unwrap();
        
        let mut concepts = Vec::new();
        let _ = extractor.extract_concepts(tree.root_node(), "interface.php", code, &mut concepts);
        
        let interface_concepts: Vec<_> = concepts
            .iter()
            .filter(|c| c.concept_type == "interface")
            .collect();
        assert!(interface_concepts.len() > 0);
        
        assert_eq!(interface_concepts[0].name, "UserInterface");
    }

    #[test]
    fn test_php_namespace_extraction() {
        let extractor = PHPExtractor::new();
        let mut manager = ParserManager::new().unwrap();
        let code = "<?php\nnamespace App\\Services;\nclass UserService {}";
        let tree = manager.parse(code, "php").unwrap();
        
        let mut concepts = Vec::new();
        let _ = extractor.extract_concepts(tree.root_node(), "namespace.php", code, &mut concepts);
        
        let namespace_concepts: Vec<_> = concepts
            .iter()
            .filter(|c| c.concept_type == "namespace")
            .collect();
        assert!(namespace_concepts.len() > 0);
        
        assert_eq!(namespace_concepts[0].name, "App\\Services");
    }
}
