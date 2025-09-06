//! Fallback pattern-based extraction when tree-sitter parsing fails

use crate::types::{SemanticConcept, LineRange};
use std::collections::HashMap;
use std::path::Path;

/// Fallback extractor for when tree-sitter parsing fails
pub struct FallbackExtractor;

impl FallbackExtractor {
    /// Create a new fallback extractor
    pub fn new() -> Self {
        Self
    }

    /// Extract concepts using regex patterns when tree-sitter fails
    pub fn extract_concepts(&self, file_path: &str, content: &str) -> Vec<SemanticConcept> {
        let mut concepts = Vec::new();
        let mut concept_id = 1;

        // Parse line by line looking for functions, classes, and interfaces
        for (line_num, line) in content.lines().enumerate() {
            let line = line.trim();

            // Try to extract function names
            if let Some(name) = self.extract_function_name(line) {
                concepts.push(self.create_fallback_concept(
                    &format!("fallback_fn_{}", concept_id),
                    name,
                    "function",
                    file_path,
                    line_num + 1,
                ));
                concept_id += 1;
            }

            // Try to extract class names
            if let Some(name) = self.extract_class_name(line) {
                concepts.push(self.create_fallback_concept(
                    &format!("fallback_class_{}", concept_id),
                    name,
                    "class",
                    file_path,
                    line_num + 1,
                ));
                concept_id += 1;
            }

            // Try to extract interface names
            if let Some(name) = self.extract_interface_name(line) {
                concepts.push(self.create_fallback_concept(
                    &format!("fallback_interface_{}", concept_id),
                    name,
                    "interface",
                    file_path,
                    line_num + 1,
                ));
                concept_id += 1;
            }
        }

        // If no concepts found, create a generic file concept
        if concepts.is_empty() {
            let file_name = Path::new(file_path)
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("unknown");

            concepts.push(self.create_fallback_concept(
                "fallback_file_1",
                file_name.to_string(),
                "file",
                file_path,
                1,
            ));
        }

        concepts
    }

    /// Create a fallback concept with lower confidence
    fn create_fallback_concept(
        &self,
        id: &str,
        name: String,
        concept_type: &str,
        file_path: &str,
        line: usize,
    ) -> SemanticConcept {
        let mut relationships = HashMap::new();
        relationships.insert("extraction_method".to_string(), "fallback".to_string());

        let mut metadata = HashMap::new();
        metadata.insert("source".to_string(), "regex_fallback".to_string());
        metadata.insert(
            "confidence_reason".to_string(),
            "tree_sitter_failed".to_string(),
        );

        SemanticConcept {
            id: id.to_string(),
            name,
            concept_type: concept_type.to_string(),
            confidence: 0.7, // Lower confidence for fallback extraction
            file_path: file_path.to_string(),
            line_range: LineRange {
                start: line as u32,
                end: line as u32,
            },
            relationships,
            metadata,
        }
    }

    /// Extract function names using regex patterns
    fn extract_function_name(&self, line: &str) -> Option<String> {
        // TypeScript/JavaScript function patterns
        if line.contains("function ") {
            if let Some(start) = line.find("function ") {
                let after_function = &line[start + 9..];
                if let Some(end) = after_function.find('(') {
                    let name = after_function[..end].trim();
                    if !name.is_empty() && self.is_valid_identifier(name) {
                        return Some(name.to_string());
                    }
                }
            }
        }

        // Arrow function patterns: const funcName = () =>
        if line.contains("=>") {
            if let Some(equals_pos) = line.find('=') {
                let before_equals = &line[..equals_pos].trim();
                if let Some(name_start) = before_equals.rfind(char::is_whitespace) {
                    let name = before_equals[name_start..].trim();
                    if !name.is_empty() && self.is_valid_identifier(name) {
                        return Some(name.to_string());
                    }
                } else {
                    // Handle case like "const funcName ="
                    if let Some(const_pos) = before_equals.find("const ") {
                        let name = before_equals[const_pos + 6..].trim();
                        if !name.is_empty() && self.is_valid_identifier(name) {
                            return Some(name.to_string());
                        }
                    }
                }
            }
        }

        // Rust function patterns
        if line.contains("fn ") {
            if let Some(start) = line.find("fn ") {
                let after_fn = &line[start + 3..];
                if let Some(end) = after_fn.find('(') {
                    let name = after_fn[..end].trim();
                    if !name.is_empty() && self.is_valid_identifier(name) {
                        return Some(name.to_string());
                    }
                }
            }
        }

        // Python function patterns
        if line.trim_start().starts_with("def ") {
            if let Some(start) = line.find("def ") {
                let after_def = &line[start + 4..];
                if let Some(end) = after_def.find('(') {
                    let name = after_def[..end].trim();
                    if !name.is_empty() && self.is_valid_identifier(name) {
                        return Some(name.to_string());
                    }
                }
            }
        }

        None
    }

    /// Extract class names using regex patterns
    fn extract_class_name(&self, line: &str) -> Option<String> {
        if line.contains("class ") {
            if let Some(start) = line.find("class ") {
                let after_class = &line[start + 6..];
                let end = after_class
                    .find(char::is_whitespace)
                    .or_else(|| after_class.find('{'))
                    .or_else(|| after_class.find('('))
                    .unwrap_or(after_class.len());
                let name = after_class[..end].trim();
                if !name.is_empty() && self.is_valid_identifier(name) {
                    return Some(name.to_string());
                }
            }
        }

        // Rust struct patterns
        if line.contains("struct ") {
            if let Some(start) = line.find("struct ") {
                let after_struct = &line[start + 7..];
                let end = after_struct
                    .find(char::is_whitespace)
                    .or_else(|| after_struct.find('{'))
                    .or_else(|| after_struct.find('<'))
                    .unwrap_or(after_struct.len());
                let name = after_struct[..end].trim();
                if !name.is_empty() && self.is_valid_identifier(name) {
                    return Some(name.to_string());
                }
            }
        }

        None
    }

    /// Extract interface names using regex patterns
    fn extract_interface_name(&self, line: &str) -> Option<String> {
        if line.contains("interface ") {
            if let Some(start) = line.find("interface ") {
                let after_interface = &line[start + 10..];
                let end = after_interface
                    .find(char::is_whitespace)
                    .or_else(|| after_interface.find('{'))
                    .or_else(|| after_interface.find('<'))
                    .unwrap_or(after_interface.len());
                let name = after_interface[..end].trim();
                if !name.is_empty() && self.is_valid_identifier(name) {
                    return Some(name.to_string());
                }
            }
        }

        None
    }

    /// Check if a string is a valid programming language identifier
    fn is_valid_identifier(&self, name: &str) -> bool {
        !name.is_empty()
            && name.chars().next().is_some_and(|c| c.is_alphabetic() || c == '_')
            && name.chars().all(|c| c.is_alphanumeric() || c == '_')
    }
}

impl Default for FallbackExtractor {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_javascript_function() {
        let extractor = FallbackExtractor::new();
        
        let code = "function calculateTotal() { return 42; }";
        let concepts = extractor.extract_concepts("test.js", code);
        
        assert_eq!(concepts.len(), 1);
        assert_eq!(concepts[0].name, "calculateTotal");
        assert_eq!(concepts[0].concept_type, "function");
        assert_eq!(concepts[0].confidence, 0.7);
    }

    #[test]
    fn test_extract_arrow_function() {
        let extractor = FallbackExtractor::new();
        
        let code = "const handleClick = () => { console.log('clicked'); }";
        let concepts = extractor.extract_concepts("test.js", code);
        
        assert_eq!(concepts.len(), 1);
        assert_eq!(concepts[0].name, "handleClick");
        assert_eq!(concepts[0].concept_type, "function");
    }

    #[test]
    fn test_extract_typescript_class() {
        let extractor = FallbackExtractor::new();
        
        let code = "export class UserService { getName() { return 'test'; } }";
        let concepts = extractor.extract_concepts("test.ts", code);
        
        assert_eq!(concepts.len(), 2); // Class + method
        
        let class_concept = concepts.iter().find(|c| c.concept_type == "class").unwrap();
        assert_eq!(class_concept.name, "UserService");
        
        let function_concept = concepts.iter().find(|c| c.concept_type == "function").unwrap();
        assert_eq!(function_concept.name, "getName");
    }

    #[test]
    fn test_extract_rust_function() {
        let extractor = FallbackExtractor::new();
        
        let code = "fn calculate_total() -> i32 { 42 }";
        let concepts = extractor.extract_concepts("test.rs", code);
        
        assert_eq!(concepts.len(), 1);
        assert_eq!(concepts[0].name, "calculate_total");
        assert_eq!(concepts[0].concept_type, "function");
    }

    #[test]
    fn test_extract_rust_struct() {
        let extractor = FallbackExtractor::new();
        
        let code = "pub struct User { name: String }";
        let concepts = extractor.extract_concepts("test.rs", code);
        
        assert_eq!(concepts.len(), 1);
        assert_eq!(concepts[0].name, "User");
        assert_eq!(concepts[0].concept_type, "class"); // Mapped as class
    }

    #[test]
    fn test_extract_python_function() {
        let extractor = FallbackExtractor::new();
        
        let code = "def process_data(data):\n    return data.strip()";
        let concepts = extractor.extract_concepts("test.py", code);
        
        assert_eq!(concepts.len(), 1);
        assert_eq!(concepts[0].name, "process_data");
        assert_eq!(concepts[0].concept_type, "function");
    }

    #[test]
    fn test_extract_interface() {
        let extractor = FallbackExtractor::new();
        
        let code = "interface IUserService { getName(): string; }";
        let concepts = extractor.extract_concepts("test.ts", code);
        
        assert_eq!(concepts.len(), 1);
        assert_eq!(concepts[0].name, "IUserService");
        assert_eq!(concepts[0].concept_type, "interface");
    }

    #[test]
    fn test_extract_multiple_concepts() {
        let extractor = FallbackExtractor::new();
        
        let code = r#"
            class Calculator {
                add(a, b) { return a + b; }
            }
            
            function multiply(x, y) {
                return x * y;
            }
            
            interface MathOperations {
                calculate(): number;
            }
        "#;
        
        let concepts = extractor.extract_concepts("test.ts", code);
        
        assert!(concepts.len() >= 3);
        
        let class_concepts = concepts.iter().filter(|c| c.concept_type == "class").count();
        let function_concepts = concepts.iter().filter(|c| c.concept_type == "function").count();
        let interface_concepts = concepts.iter().filter(|c| c.concept_type == "interface").count();
        
        assert!(class_concepts >= 1);
        assert!(function_concepts >= 2); // add + multiply
        assert!(interface_concepts >= 1);
    }

    #[test]
    fn test_empty_content() {
        let extractor = FallbackExtractor::new();
        
        let concepts = extractor.extract_concepts("empty.js", "");
        
        assert_eq!(concepts.len(), 1);
        assert_eq!(concepts[0].name, "empty");
        assert_eq!(concepts[0].concept_type, "file");
    }

    #[test]
    fn test_no_concepts_found() {
        let extractor = FallbackExtractor::new();
        
        let code = "const x = 42;\nconsole.log('hello');";
        let concepts = extractor.extract_concepts("simple.js", code);
        
        assert_eq!(concepts.len(), 1);
        assert_eq!(concepts[0].name, "simple");
        assert_eq!(concepts[0].concept_type, "file");
    }

    #[test]
    fn test_invalid_identifiers() {
        let extractor = FallbackExtractor::new();
        
        // Should not extract invalid identifiers
        assert!(!extractor.is_valid_identifier(""));
        assert!(!extractor.is_valid_identifier("123abc")); // Starts with number
        assert!(!extractor.is_valid_identifier("hello-world")); // Contains dash
        assert!(!extractor.is_valid_identifier("hello.world")); // Contains dot
        
        // Should extract valid identifiers
        assert!(extractor.is_valid_identifier("hello"));
        assert!(extractor.is_valid_identifier("_private"));
        assert!(extractor.is_valid_identifier("camelCase"));
        assert!(extractor.is_valid_identifier("snake_case"));
        assert!(extractor.is_valid_identifier("PascalCase"));
        assert!(extractor.is_valid_identifier("a123"));
    }

    #[test]
    fn test_concept_metadata() {
        let extractor = FallbackExtractor::new();
        
        let code = "function test() { return 42; }";
        let concepts = extractor.extract_concepts("test.js", code);
        
        assert_eq!(concepts.len(), 1);
        
        let concept = &concepts[0];
        assert_eq!(concept.relationships.get("extraction_method"), Some(&"fallback".to_string()));
        assert_eq!(concept.metadata.get("source"), Some(&"regex_fallback".to_string()));
        assert_eq!(concept.metadata.get("confidence_reason"), Some(&"tree_sitter_failed".to_string()));
    }

    #[test]
    fn test_line_numbers() {
        let extractor = FallbackExtractor::new();
        
        let code = r#"
function first() {}

class Second {}

function third() {}
"#;
        
        let concepts = extractor.extract_concepts("test.js", code);
        
        // Find concepts by name and check their line numbers
        let first_fn = concepts.iter().find(|c| c.name == "first").unwrap();
        assert_eq!(first_fn.line_range.start, 2); // Second line (1-indexed)
        
        let second_class = concepts.iter().find(|c| c.name == "Second").unwrap();
        assert_eq!(second_class.line_range.start, 4); // Fourth line
        
        let third_fn = concepts.iter().find(|c| c.name == "third").unwrap();
        assert_eq!(third_fn.line_range.start, 6); // Sixth line
    }

    #[test]
    fn test_edge_case_patterns() {
        let extractor = FallbackExtractor::new();
        
        // Edge case: function keyword in comment should not be extracted
        let code_with_comment = "// This function does something\nfunction realFunction() {}";
        let concepts = extractor.extract_concepts("test.js", code_with_comment);
        
        assert_eq!(concepts.len(), 1);
        assert_eq!(concepts[0].name, "realFunction");
        
        // Edge case: function keyword in string should not be extracted
        let code_with_string = r#"const msg = "function in string"; function actualFunction() {}"#;
        let string_concepts = extractor.extract_concepts("test.js", code_with_string);
        
        assert_eq!(string_concepts.len(), 1);
        assert_eq!(string_concepts[0].name, "actualFunction");
    }
}