//! PHP concept extraction with docblock awareness

use crate::parsing::NameExtractor;
use crate::types::{LineRange, ParseError, SemanticConcept};
use regex::Regex;
use std::collections::HashMap;
use tree_sitter::Node;

pub struct PhpExtractor;

impl Default for PhpExtractor {
    fn default() -> Self {
        Self::new()
    }
}

impl PhpExtractor {
    pub fn new() -> Self {
        Self
    }

    pub fn extract_concepts(
        &self,
        node: Node<'_>,
        file_path: &str,
        content: &str,
        concepts: &mut Vec<SemanticConcept>,
    ) -> Result<(), ParseError> {
        match node.kind() {
            "class_declaration"
            | "interface_declaration"
            | "trait_declaration"
            | "enum_declaration" => {
                if let Some(concept) =
                    self.build_named_construct(node, file_path, content, node.kind())?
                {
                    concepts.push(concept);
                }
            }
            "anonymous_class" => {
                if let Some(concept) = self.extract_anonymous_class(node, file_path, content)? {
                    concepts.push(concept);
                }
            }
            "function_definition" => {
                if let Some(concept) =
                    self.build_named_construct(node, file_path, content, "function")?
                {
                    concepts.push(concept);
                }
            }
            "method_declaration" => {
                if let Some(concept) =
                    self.build_named_construct(node, file_path, content, "method")?
                {
                    concepts.push(concept);
                }
            }
            "arrow_function_expression" => {
                if let Some(concept) = self.extract_arrow_function(node, file_path, content)? {
                    concepts.push(concept);
                }
            }
            "property_declaration" => {
                let mut cursor = node.walk();
                for child in node.children(&mut cursor) {
                    if child.kind() == "property_element" {
                        if let Some(concept) =
                            self.build_named_construct(child, file_path, content, "property")?
                        {
                            concepts.push(concept);
                        }
                    }
                }
            }
            "property_promotion_parameter" => {
                if let Some(concept) =
                    self.build_named_construct(node, file_path, content, "property")?
                {
                    concepts.push(concept);
                }
            }
            "const_declaration" => {
                let mut cursor = node.walk();
                for child in node.children(&mut cursor) {
                    if child.kind() == "constant_declarator" {
                        if let Some(concept) =
                            self.build_named_construct(child, file_path, content, "constant")?
                        {
                            concepts.push(concept);
                        }
                    }
                }
            }
            "namespace_definition" => {
                if let Some(concept) =
                    self.build_named_construct(node, file_path, content, "namespace")?
                {
                    concepts.push(concept);
                }
            }
            "attribute_list" => {
                if let Some(concept) = self.extract_attribute(node, file_path, content)? {
                    concepts.push(concept);
                }
            }
            _ => {}
        }

        Ok(())
    }

    fn build_named_construct(
        &self,
        node: Node<'_>,
        file_path: &str,
        content: &str,
        concept_type: &str,
    ) -> Result<Option<SemanticConcept>, ParseError> {
        let name = Self::extract_name(node, content)?;
        if name.is_empty() {
            return Ok(None);
        }

        let (start_line, start_col, end_line, end_col) = NameExtractor::get_position_info(node);

        let mut metadata = HashMap::new();
        metadata.insert("language".to_string(), "php".to_string());
        let normalized_type = Self::normalize_concept_type(concept_type);

        metadata.insert("kind".to_string(), normalized_type.to_string());
        metadata.insert("start_column".to_string(), start_col.to_string());
        metadata.insert("end_column".to_string(), end_col.to_string());

        if let Some(visibility) = Self::extract_visibility(node, content) {
            metadata.insert("visibility".to_string(), visibility);
        }
        if Self::has_modifier(node, "static") {
            metadata.insert("static".to_string(), "true".to_string());
        }
        if Self::has_modifier(node, "abstract") {
            metadata.insert("abstract".to_string(), "true".to_string());
        }
        if Self::has_modifier(node, "final") {
            metadata.insert("final".to_string(), "true".to_string());
        }
        if let Some(return_type) = Self::extract_return_type(node, content) {
            metadata.insert("return_type".to_string(), return_type);
        }
        if let Some(annotation) = Self::extract_type_annotation(node, content) {
            metadata.insert("type".to_string(), annotation);
        }

        // Docblock parsing
        if let Some(docblock) = Self::extract_docblock(node, content) {
            if !docblock.description.is_empty() {
                metadata.insert("docblock.description".to_string(), docblock.description);
            }
            if !docblock.params.is_empty() {
                metadata.insert("docblock.params".to_string(), docblock.params.join("|"));
            }
            if let Some(ret) = docblock.returns {
                metadata.insert("docblock.return".to_string(), ret);
            }
            if !docblock.throws.is_empty() {
                metadata.insert("docblock.throws".to_string(), docblock.throws.join("|"));
            }
        }

        // Traits used within classes
        if normalized_type == "class" {
            let traits = Self::collect_traits(node, content);
            if !traits.is_empty() {
                metadata.insert("traits".to_string(), traits.join(","));
            }
        }

        Ok(Some(SemanticConcept {
            id: format!("php::{}::{}::{}", concept_type, file_path, name),
            name,
            concept_type: normalized_type.to_string(),
            confidence: 0.85,
            file_path: file_path.to_string(),
            line_range: LineRange {
                start: start_line,
                end: end_line,
            },
            relationships: HashMap::new(),
            metadata,
        }))
    }

    fn normalize_concept_type(concept_type: &str) -> &str {
        match concept_type {
            "class_declaration" => "class",
            "interface_declaration" => "interface",
            "trait_declaration" => "trait",
            "enum_declaration" => "enum",
            other => other,
        }
    }

    fn extract_name(node: Node<'_>, content: &str) -> Result<String, ParseError> {
        if let Some(named) = node.child_by_field_name("name") {
            if let Some(text) = NameExtractor::extract_node_text(named, content) {
                return Ok(text.to_string());
            }
        }

        let fallback =
            NameExtractor::extract_name_from_node(node, content).map_err(ParseError::from_reason)?;
        if !fallback.is_empty() {
            return Ok(fallback);
        }

        if let Some(var_node) = NameExtractor::find_child_by_kind(node, "variable_name") {
            if let Some(text) = NameExtractor::extract_node_text(var_node, content) {
                return Ok(text.trim_start_matches('$').to_string());
            }
        }

        Ok(String::new())
    }

    fn extract_visibility(node: Node<'_>, content: &str) -> Option<String> {
        let mut cursor = node.walk();
        for child in node.children(&mut cursor) {
            if matches!(child.kind(), "public" | "protected" | "private") {
                return NameExtractor::extract_node_text(child, content).map(|s| s.to_string());
            }
        }
        None
    }

    fn has_modifier(node: Node<'_>, modifier: &str) -> bool {
        let mut cursor = node.walk();
        for child in node.children(&mut cursor) {
            if child.kind() == modifier {
                return true;
            }
        }
        false
    }

    fn extract_return_type(node: Node<'_>, content: &str) -> Option<String> {
        if let Some(return_type) = node.child_by_field_name("return_type") {
            if let Some(text) = NameExtractor::extract_node_text(return_type, content) {
                return Some(text.to_string());
            }
        }
        None
    }

    fn extract_type_annotation(node: Node<'_>, content: &str) -> Option<String> {
        if let Some(annotation) = node.child_by_field_name("type") {
            if let Some(text) = NameExtractor::extract_node_text(annotation, content) {
                return Some(text.to_string());
            }
        }
        None
    }

    fn extract_docblock(node: Node<'_>, content: &str) -> Option<DocBlock> {
        let docblock_text = Self::find_docblock_above(node, content)?;
        DocBlock::parse(&docblock_text)
    }

    fn find_docblock_above(node: Node<'_>, content: &str) -> Option<String> {
        let start_byte = node.start_byte();
        let mut index = start_byte;

        while index > 0 {
            let slice = &content[..index];
            if let Some(pos) = slice.rfind("/**") {
                // Only capture content from /** to the current search position (before the node)
                let comment = &slice[pos..index];
                if comment.contains("*/") {
                    let lines: Vec<&str> = comment.lines().collect();
                    if let Some(last_line) = lines.last() {
                        if last_line.trim().ends_with("*/") {
                            return Some(comment.to_string());
                        }
                    }
                }
                index = pos.saturating_sub(1);
            } else {
                break;
            }
        }

        None
    }

    fn collect_traits(node: Node<'_>, content: &str) -> Vec<String> {
        let mut traits = Vec::new();
        let mut cursor = node.walk();

        // Look for trait_use_clause nodes in the class body
        for child in node.children(&mut cursor) {
            if child.kind() == "trait_use_clause" {
                let mut clause_cursor = child.walk();
                for clause_child in child.children(&mut clause_cursor) {
                    if matches!(clause_child.kind(), "qualified_name" | "name") {
                        if let Some(name) = NameExtractor::extract_node_text(clause_child, content) {
                            traits.push(name.to_string());
                        }
                    }
                }
            }
        }
        traits
    }

    fn extract_anonymous_class(
        &self,
        node: Node<'_>,
        file_path: &str,
        _content: &str,
    ) -> Result<Option<SemanticConcept>, ParseError> {
        let (start_line, start_col, end_line, end_col) = NameExtractor::get_position_info(node);
        let mut metadata = HashMap::new();
        metadata.insert("language".to_string(), "php".to_string());
        metadata.insert("kind".to_string(), "class".to_string());
        metadata.insert("anonymous".to_string(), "true".to_string());
        metadata.insert("start_column".to_string(), start_col.to_string());
        metadata.insert("end_column".to_string(), end_col.to_string());

        Ok(Some(SemanticConcept {
            id: format!("php::anonymous_class::{}::L{}", file_path, start_line),
            name: "anonymous_class".to_string(),
            concept_type: "class".to_string(),
            confidence: 0.75,
            file_path: file_path.to_string(),
            line_range: LineRange {
                start: start_line,
                end: end_line,
            },
            relationships: HashMap::new(),
            metadata,
        }))
    }

    fn extract_arrow_function(
        &self,
        node: Node<'_>,
        file_path: &str,
        content: &str,
    ) -> Result<Option<SemanticConcept>, ParseError> {
        let (start_line, start_col, end_line, end_col) = NameExtractor::get_position_info(node);
        let mut metadata = HashMap::new();
        metadata.insert("language".to_string(), "php".to_string());
        metadata.insert("kind".to_string(), "function".to_string());
        metadata.insert("arrow_function".to_string(), "true".to_string());
        metadata.insert("start_column".to_string(), start_col.to_string());
        metadata.insert("end_column".to_string(), end_col.to_string());

        if let Some(return_type) = Self::extract_return_type(node, content) {
            metadata.insert("return_type".to_string(), return_type);
        }

        Ok(Some(SemanticConcept {
            id: format!("php::arrow_function::{}::L{}", file_path, start_line),
            name: "arrow_function".to_string(),
            concept_type: "function".to_string(),
            confidence: 0.75,
            file_path: file_path.to_string(),
            line_range: LineRange {
                start: start_line,
                end: end_line,
            },
            relationships: HashMap::new(),
            metadata,
        }))
    }

    fn extract_attribute(
        &self,
        node: Node<'_>,
        file_path: &str,
        content: &str,
    ) -> Result<Option<SemanticConcept>, ParseError> {
        let mut cursor = node.walk();
        for child in node.children(&mut cursor) {
            if child.kind() == "attribute" {
                if let Some(name_node) = child.child_by_field_name("name") {
                    if let Some(attr_name) = NameExtractor::extract_node_text(name_node, content) {
                        let (start_line, start_col, end_line, end_col) = NameExtractor::get_position_info(child);
                        let mut metadata = HashMap::new();
                        metadata.insert("language".to_string(), "php".to_string());
                        metadata.insert("kind".to_string(), "attribute".to_string());
                        metadata.insert("start_column".to_string(), start_col.to_string());
                        metadata.insert("end_column".to_string(), end_col.to_string());

                        return Ok(Some(SemanticConcept {
                            id: format!("php::attribute::{}::{}", file_path, attr_name),
                            name: attr_name.to_string(),
                            concept_type: "attribute".to_string(),
                            confidence: 0.8,
                            file_path: file_path.to_string(),
                            line_range: LineRange {
                                start: start_line,
                                end: end_line,
                            },
                            relationships: HashMap::new(),
                            metadata,
                        }));
                    }
                }
            }
        }
        Ok(None)
    }
}

struct DocBlock {
    description: String,
    params: Vec<String>,
    returns: Option<String>,
    throws: Vec<String>,
}

impl DocBlock {
    fn parse(content: &str) -> Option<Self> {
        let mut description = Vec::new();
        let mut params = Vec::new();
        let mut returns = None;
        let mut throws = Vec::new();

        let lines: Vec<&str> = content
            .split('\n')
            .map(|line| line.trim_start_matches(['*', '/', ' '].as_ref()))
            .collect();

        for line in lines {
            if line.starts_with("@param") {
                params.push(line.to_string());
            } else if line.starts_with("@return") {
                returns = Some(line.to_string());
            } else if line.starts_with("@throws") {
                throws.push(line.to_string());
            } else if !line.is_empty() && !line.starts_with('@') {
                description.push(line.to_string());
            }
        }

        Some(Self {
            description: description.join(" "),
            params,
            returns,
            throws,
        })
    }
}

pub fn extract_php_concepts(
    root_node: Node<'_>,
    file_path: &str,
    content: &str,
) -> Result<Vec<SemanticConcept>, ParseError> {
    let extractor = PhpExtractor::new();
    let mut concepts = Vec::new();

    let mut cursor = root_node.walk();
    for child in root_node.children(&mut cursor) {
        extractor.extract_concepts(child, file_path, content, &mut concepts)?;
    }

    Ok(concepts)
}

pub fn extract_php_docblocks(content: &str) -> Vec<String> {
    let docblock_pattern = Regex::new(r"/\*\*(?s).*?\*/").unwrap();
    docblock_pattern
        .find_iter(content)
        .map(|mat| mat.as_str().to_string())
        .collect()
}
