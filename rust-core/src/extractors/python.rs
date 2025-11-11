//! Comprehensive Python concept extraction using full grammar support
//!
//! This module provides detailed extraction of Python constructs including:
//! - Classes (with inheritance, decorators, type parameters)
//! - Functions (async, generators, decorators, type hints)
//! - Variables (with type annotations)
//! - Modern Python (type aliases, pattern matching, async/await)
//! - Import system (from/import, relative imports)
//! - Advanced features (context managers, comprehensions)

use crate::types::{SemanticConcept, LineRange, ParseError};
use crate::parsing::NameExtractor;
use std::collections::HashMap;
use tree_sitter::Node;

/// Information about class body analysis
#[derive(Debug, Default)]
struct ClassInfo {
    has_abstract_methods: bool,
    method_count: usize,
    property_count: usize,
    decorators: Vec<String>,
    has_init: bool,
    has_classmethods: bool,
    has_staticmethods: bool,
}

/// Advanced Python concept extractor using full grammar support
pub struct PythonExtractor;

impl PythonExtractor {
    pub fn new() -> Self {
        Self
    }

    /// Extract concepts from Python AST nodes using full grammar awareness
    pub fn extract_concepts(
        &self,
        node: Node<'_>,
        file_path: &str,
        content: &str,
        concepts: &mut Vec<SemanticConcept>,
    ) -> Result<(), ParseError> {
        match node.kind() {
            // Class and object-oriented constructs
            "class_definition" => {
                if let Some(concept) = self.extract_class(node, file_path, content)? {
                    concepts.push(concept);
                }
            }
            "decorated_definition" => {
                self.extract_decorated_definition(node, file_path, content, concepts)?;
            }
            
            // Function constructs
            "function_definition" => {
                if let Some(concept) = self.extract_function(node, file_path, content)? {
                    concepts.push(concept);
                }
            }
            
            // Variable assignments and type annotations
            "assignment" => {
                self.extract_assignment(node, file_path, content, concepts)?;
            }
            "augmented_assignment" => {
                if let Some(concept) = self.extract_augmented_assignment(node, file_path, content)? {
                    concepts.push(concept);
                }
            }
            
            // Modern Python features
            "type_alias_statement" => {
                if let Some(concept) = self.extract_type_alias(node, file_path, content)? {
                    concepts.push(concept);
                }
            }
            "match_statement" => {
                if let Some(concept) = self.extract_match_statement(node, file_path, content)? {
                    concepts.push(concept);
                }
            }
            
            // Import system
            "import_statement" | "import_from_statement" => {
                if let Some(concept) = self.extract_import(node, file_path, content)? {
                    concepts.push(concept);
                }
            }
            
            // Context managers
            "with_statement" => {
                if let Some(concept) = self.extract_with_statement(node, file_path, content)? {
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
        
        // Extract superclasses (inheritance)
        if let Some(superclasses_node) = self.find_child_by_field(node, "superclasses") {
            let superclasses = self.extract_argument_list(superclasses_node, content);
            if !superclasses.is_empty() {
                metadata.insert("superclasses".to_string(), superclasses.join(", "));
                metadata.insert("has_inheritance".to_string(), "true".to_string());
            }
        }
        
        // Check for type parameters (Generic classes)
        if let Some(type_params) = self.find_child_by_field(node, "type_parameters") {
            if let Some(type_params_text) = self.extract_text_from_node(type_params, content) {
                metadata.insert("type_parameters".to_string(), type_params_text);
                metadata.insert("generic".to_string(), "true".to_string());
            }
        }
        
        // Analyze class body for additional metadata
        if let Some(body_node) = self.find_child_by_field(node, "body") {
            let class_info = self.analyze_class_body(body_node, content);
            
            if class_info.has_abstract_methods {
                metadata.insert("abstract".to_string(), "true".to_string());
            }
            
            if class_info.method_count > 0 {
                metadata.insert("method_count".to_string(), class_info.method_count.to_string());
            }
            
            if class_info.property_count > 0 {
                metadata.insert("property_count".to_string(), class_info.property_count.to_string());
            }
            
            if !class_info.decorators.is_empty() {
                metadata.insert("decorators".to_string(), class_info.decorators.join(", "));
            }
            
            if class_info.has_init {
                metadata.insert("has_constructor".to_string(), "true".to_string());
            }
            
            if class_info.has_classmethods {
                metadata.insert("has_classmethods".to_string(), "true".to_string());
            }
            
            if class_info.has_staticmethods {
                metadata.insert("has_staticmethods".to_string(), "true".to_string());
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
    
    /// Extract function definition with type hints and modifiers
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
        
        // Check if async function
        if self.has_async_modifier(node) {
            metadata.insert("async".to_string(), "true".to_string());
        }
        
        // Extract parameters with type hints
        if let Some(params_node) = self.find_child_by_field(node, "parameters") {
            let params = self.extract_parameters_with_types(params_node, content);
            if !params.is_empty() {
                metadata.insert("parameters".to_string(), params);
            }
        }
        
        // Check for generator (yield in body)
        if self.contains_yield(node, content) {
            metadata.insert("generator".to_string(), "true".to_string());
        }
        
        // Use legacy method for additional validation
        if let Some(legacy_concept) = self.extract_concept_from_node(node, file_path, content, "function")? {
            // Merge any additional metadata from legacy extraction
            for (key, value) in legacy_concept.metadata {
                metadata.entry(key).or_insert(value);
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
    
    /// Extract decorated definition (classes/functions with decorators)
    fn extract_decorated_definition(
        &self,
        node: Node<'_>,
        file_path: &str,
        content: &str,
        concepts: &mut Vec<SemanticConcept>,
    ) -> Result<(), ParseError> {
        // Extract decorators
        let decorators = self.extract_decorators(node, content);
        
        // Find the actual definition (class or function)
        if let Some(definition_node) = self.find_child_by_field(node, "definition") {
            match definition_node.kind() {
                "class_definition" => {
                    if let Some(mut concept) = self.extract_class(definition_node, file_path, content)? {
                        if !decorators.is_empty() {
                            concept.metadata.insert("decorators".to_string(), decorators.join(", "));
                        }
                        concepts.push(concept);
                    }
                }
                "function_definition" => {
                    if let Some(mut concept) = self.extract_function(definition_node, file_path, content)? {
                        if !decorators.is_empty() {
                            concept.metadata.insert("decorators".to_string(), decorators.join(", "));
                        }
                        concepts.push(concept);
                    }
                }
                _ => {}
            }
        }
        
        Ok(())
    }
    
    /// Extract assignment with type annotations
    fn extract_assignment(
        &self,
        node: Node<'_>,
        file_path: &str,
        content: &str,
        concepts: &mut Vec<SemanticConcept>,
    ) -> Result<(), ParseError> {
        // Get left-hand side (variable names)
        if let Some(left_node) = self.find_child_by_field(node, "left") {
            let var_names = self.extract_variable_names(left_node, content);
            
            for var_name in var_names {
                if !var_name.is_empty() {
                    let mut metadata = HashMap::new();
                    
                    // Check for type annotation
                    if let Some(type_node) = self.find_child_by_field(node, "type") {
                        if let Some(type_text) = self.extract_text_from_node(type_node, content) {
                            metadata.insert("type".to_string(), type_text);
                        }
                    } else {
                        // Try to infer type from right-hand side
                        if let Some(right_node) = self.find_child_by_field(node, "right") {
                            let inferred_type = self.infer_value_type(right_node);
                            if !inferred_type.is_empty() {
                                metadata.insert("inferred_type".to_string(), inferred_type);
                            }
                        }
                    }
                    
                    concepts.push(self.create_concept(
                        var_name,
                        "variable".to_string(),
                        node,
                        file_path,
                        0.7,
                        metadata,
                    ));
                }
            }
        }
        
        Ok(())
    }
    
    /// Extract augmented assignment (+=, -=, etc.)
    fn extract_augmented_assignment(
        &self,
        node: Node<'_>,
        file_path: &str,
        content: &str,
    ) -> Result<Option<SemanticConcept>, ParseError> {
        let var_name = if let Some(left_node) = self.find_child_by_field(node, "left") {
            self.extract_text_from_node(left_node, content).unwrap_or_default()
        } else {
            return Ok(None);
        };
        
        if var_name.is_empty() {
            return Ok(None);
        }
        
        let mut metadata = HashMap::new();
        metadata.insert("augmented_assignment".to_string(), "true".to_string());
        
        Ok(Some(self.create_concept(
            var_name,
            "variable".to_string(),
            node,
            file_path,
            0.6,
            metadata,
        )))
    }
    
    /// Extract type alias statement
    fn extract_type_alias(
        &self,
        node: Node<'_>,
        file_path: &str,
        content: &str,
    ) -> Result<Option<SemanticConcept>, ParseError> {
        let name = if let Some(left_node) = self.find_child_by_field(node, "left") {
            self.extract_text_from_node(left_node, content).unwrap_or_default()
        } else {
            return Ok(None);
        };
        
        let mut metadata = HashMap::new();
        
        // Extract type definition
        if let Some(right_node) = self.find_child_by_field(node, "right") {
            if let Some(type_def) = self.extract_text_from_node(right_node, content) {
                metadata.insert("definition".to_string(), type_def);
            }
        }
        
        Ok(Some(self.create_concept(
            name,
            "type_alias".to_string(),
            node,
            file_path,
            0.8,
            metadata,
        )))
    }
    
    /// Extract match statement
    fn extract_match_statement(
        &self,
        node: Node<'_>,
        file_path: &str,
        content: &str,
    ) -> Result<Option<SemanticConcept>, ParseError> {
        let subjects = self.extract_match_subjects(node, content);
        if subjects.is_empty() {
            return Ok(None);
        }
        
        let mut metadata = HashMap::new();
        metadata.insert("subjects".to_string(), subjects.join(", "));
        
        // Count case clauses for complexity analysis
        let case_count = self.count_case_clauses(node);
        metadata.insert("case_count".to_string(), case_count.to_string());
        
        Ok(Some(self.create_concept(
            format!("match_{}", subjects.join("_")),
            "match_statement".to_string(),
            node,
            file_path,
            0.7,
            metadata,
        )))
    }
    
    /// Extract import statements
    fn extract_import(
        &self,
        node: Node<'_>,
        file_path: &str,
        content: &str,
    ) -> Result<Option<SemanticConcept>, ParseError> {
        let mut metadata = HashMap::new();
        
        match node.kind() {
            "import_statement" => {
                let modules = self.extract_import_modules(node, content);
                if modules.is_empty() {
                    return Ok(None);
                }
                
                metadata.insert("modules".to_string(), modules.join(", "));
                
                Ok(Some(self.create_concept(
                    format!("import_{}", modules.join("_")),
                    "import".to_string(),
                    node,
                    file_path,
                    0.6,
                    metadata,
                )))
            }
            "import_from_statement" => {
                if let Some(module_node) = self.find_child_by_field(node, "module_name") {
                    let module_name = self.extract_text_from_node(module_node, content).unwrap_or_default();
                    let imported_items = self.extract_import_items(node, content);
                    
                    metadata.insert("module".to_string(), module_name.clone());
                    metadata.insert("import_type".to_string(), "from_import".to_string());
                    
                    if !imported_items.is_empty() {
                        metadata.insert("items".to_string(), imported_items.join(", "));
                    }
                    
                    Ok(Some(self.create_concept(
                        format!("from_{}_import", module_name),
                        "import".to_string(),
                        node,
                        file_path,
                        0.6,
                        metadata,
                    )))
                } else {
                    Ok(None)
                }
            }
            _ => Ok(None)
        }
    }
    
    /// Extract with statement (context managers)
    fn extract_with_statement(
        &self,
        node: Node<'_>,
        file_path: &str,
        content: &str,
    ) -> Result<Option<SemanticConcept>, ParseError> {
        let mut metadata = HashMap::new();
        
        // Check if async with
        if self.has_async_modifier(node) {
            metadata.insert("async".to_string(), "true".to_string());
        }
        
        let context_managers = self.extract_with_items(node, content);
        if context_managers.is_empty() {
            return Ok(None);
        }
        
        metadata.insert("context_managers".to_string(), context_managers.join(", "));
        
        Ok(Some(self.create_concept(
            format!("with_{}", context_managers.join("_")),
            "context_manager".to_string(),
            node,
            file_path,
            0.7,
            metadata,
        )))
    }
    
    // Helper methods for comprehensive Python extraction
    
    /// Analyze class body for comprehensive metadata
    fn analyze_class_body(&self, body_node: Node<'_>, content: &str) -> ClassInfo {
        let mut info = ClassInfo::default();
        let mut cursor = body_node.walk();
        
        for child in body_node.children(&mut cursor) {
            match child.kind() {
                "function_definition" => {
                    info.method_count += 1;
                    
                    // Check method name
                    if let Ok(method_name) = self.extract_name_from_node(child, content) {
                        if method_name == "__init__" {
                            info.has_init = true;
                        }
                    }
                    
                    // Check for abstract methods
                    if self.has_decorator_named(child, content, "abstractmethod") {
                        info.has_abstract_methods = true;
                    }
                    
                    // Check for class/static methods
                    if self.has_decorator_named(child, content, "classmethod") {
                        info.has_classmethods = true;
                    }
                    
                    if self.has_decorator_named(child, content, "staticmethod") {
                        info.has_staticmethods = true;
                    }
                    
                    if self.has_decorator_named(child, content, "property") {
                        info.property_count += 1;
                    }
                }
                "decorated_definition" => {
                    // Handle decorated methods
                    let decorators = self.extract_decorators(child, content);
                    info.decorators.extend(decorators);
                    
                    if let Some(def_node) = self.find_child_by_field(child, "definition") {
                        if def_node.kind() == "function_definition" {
                            info.method_count += 1;
                            
                            if let Ok(method_name) = self.extract_name_from_node(def_node, content) {
                                if method_name == "__init__" {
                                    info.has_init = true;
                                }
                            }
                        }
                    }
                }
                _ => {}
            }
        }
        
        info
    }
    
    /// Check if a function/method has a specific decorator
    fn has_decorator_named(&self, node: Node<'_>, content: &str, decorator_name: &str) -> bool {
        let decorators = self.extract_decorators(node, content);
        decorators.iter().any(|d| d.contains(decorator_name))
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
            if child.kind() == "identifier" {
                if let Some(name) = self.extract_text_from_node(child, content) {
                    return Ok(name);
                }
            }
        }
        
        Ok(String::new())
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
    
    /// Extract decorators from a decorated definition
    fn extract_decorators(&self, node: Node<'_>, content: &str) -> Vec<String> {
        let mut decorators = Vec::new();
        let mut cursor = node.walk();
        
        for child in node.children(&mut cursor) {
            if child.kind() == "decorator" {
                if let Some(decorator_text) = self.extract_text_from_node(child, content) {
                    decorators.push(decorator_text.trim_start_matches('@').to_string());
                }
            }
        }
        decorators
    }
    
    /// Extract argument list (for superclasses, function calls, etc.)
    fn extract_argument_list(&self, node: Node<'_>, content: &str) -> Vec<String> {
        let mut args = Vec::new();
        let mut cursor = node.walk();
        
        for child in node.children(&mut cursor) {
            if child.kind() == "expression" || child.kind() == "identifier" {
                if let Some(arg_text) = self.extract_text_from_node(child, content) {
                    args.push(arg_text);
                }
            }
        }
        args
    }
    
    /// Extract parameters with type hints
    fn extract_parameters_with_types(&self, node: Node<'_>, content: &str) -> String {
        self.extract_text_from_node(node, content).unwrap_or_default()
    }
    
    /// Check if function contains yield (generator)
    fn contains_yield(&self, node: Node<'_>, _content: &str) -> bool {
        let mut cursor = node.walk();
        
        fn check_yield_recursive<'a>(node: Node<'a>, cursor: &mut tree_sitter::TreeCursor<'a>) -> bool {
            if node.kind() == "yield" {
                return true;
            }
            
            let children: Vec<_> = node.children(cursor).collect();
            for child in children {
                if check_yield_recursive(child, cursor) {
                    return true;
                }
            }
            false
        }
        
        check_yield_recursive(node, &mut cursor)
    }
    
    /// Extract variable names from assignment patterns
    fn extract_variable_names(&self, node: Node<'_>, content: &str) -> Vec<String> {
        let mut names = Vec::new();
        
        match node.kind() {
            "identifier" => {
                if let Some(name) = self.extract_text_from_node(node, content) {
                    names.push(name);
                }
            }
            "pattern_list" => {
                let mut cursor = node.walk();
                for child in node.children(&mut cursor) {
                    names.extend(self.extract_variable_names(child, content));
                }
            }
            _ => {
                // Try to extract from first identifier child
                let mut cursor = node.walk();
                for child in node.children(&mut cursor) {
                    if child.kind() == "identifier" {
                        if let Some(name) = self.extract_text_from_node(child, content) {
                            names.push(name);
                        }
                    }
                }
            }
        }
        
        names
    }
    
    /// Infer value type from right-hand side of assignment
    fn infer_value_type(&self, node: Node<'_>) -> String {
        match node.kind() {
            "string" | "concatenated_string" => "str".to_string(),
            "integer" => "int".to_string(),
            "float" => "float".to_string(),
            "true" | "false" => "bool".to_string(),
            "none" => "None".to_string(),
            "list" => "list".to_string(),
            "dictionary" => "dict".to_string(),
            "set" => "set".to_string(),
            "tuple" => "tuple".to_string(),
            "call" => "function_call".to_string(),
            _ => String::new(),
        }
    }
    
    /// Extract match statement subjects
    fn extract_match_subjects(&self, node: Node<'_>, content: &str) -> Vec<String> {
        let mut subjects = Vec::new();
        
        // Look for subject field directly
        let mut cursor = node.walk();
        for child in node.named_children(&mut cursor) {
            if let Some(subject_node) = self.find_child_by_field(child, "subject") {
                if let Some(subject_text) = self.extract_text_from_node(subject_node, content) {
                    subjects.push(subject_text);
                }
            }
        }
        
        // If no subjects found, try to extract from expressions
        if subjects.is_empty() {
            let mut cursor = node.walk();
            for child in node.children(&mut cursor) {
                if child.kind() == "expression" {
                    if let Some(subject_text) = self.extract_text_from_node(child, content) {
                        subjects.push(subject_text);
                    }
                }
            }
        }
        
        subjects
    }
    
    /// Count case clauses in match statement
    fn count_case_clauses(&self, node: Node<'_>) -> usize {
        let mut count = 0;
        let mut cursor = node.walk();
        
        for child in node.children(&mut cursor) {
            if child.kind() == "case_clause" {
                count += 1;
            }
        }
        
        count
    }
    
    /// Extract modules from import statement
    fn extract_import_modules(&self, node: Node<'_>, content: &str) -> Vec<String> {
        let mut modules = Vec::new();
        let mut cursor = node.walk();
        
        for child in node.children(&mut cursor) {
            if child.kind() == "dotted_name" || child.kind() == "identifier" {
                if let Some(module_text) = self.extract_text_from_node(child, content) {
                    modules.push(module_text);
                }
            }
        }
        
        modules
    }
    
    /// Extract imported items from from-import statement
    fn extract_import_items(&self, node: Node<'_>, content: &str) -> Vec<String> {
        let mut items = Vec::new();
        let mut cursor = node.walk();
        
        for child in node.children(&mut cursor) {
            if child.kind() == "dotted_name" || child.kind() == "identifier" || child.kind() == "aliased_import" {
                if let Some(item_text) = self.extract_text_from_node(child, content) {
                    items.push(item_text);
                }
            }
        }
        
        items
    }
    
    /// Extract with statement items (context managers)
    fn extract_with_items(&self, node: Node<'_>, content: &str) -> Vec<String> {
        let mut items = Vec::new();
        let mut cursor = node.walk();
        
        for child in node.children(&mut cursor) {
            if child.kind() == "with_item" {
                if let Some(item_text) = self.extract_text_from_node(child, content) {
                    items.push(item_text);
                }
            }
        }
        
        items
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
        assert!(!concepts.is_empty());
    }

    #[test]
    fn test_python_function_extraction() {
        let extractor = PythonExtractor::new();
        let mut manager = ParserManager::new().unwrap();
        let code = "def calculate_total(price, tax):\n    return price + tax";
        let tree = manager.parse(code, "python").unwrap();
        
        let mut concepts = Vec::new();
        let _ = extractor.extract_concepts(tree.root_node(), "calc.py", code, &mut concepts);
        
        assert!(!concepts.is_empty());
    }
}