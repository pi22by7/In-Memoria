//! Parser management and initialization for multiple languages

#[cfg(feature = "napi-bindings")]
use napi_derive::napi;

use crate::types::{ParseError, AstNode, Symbol, ParseResult};
use std::collections::HashMap;
use tree_sitter::{Language, Parser, Tree, Query, QueryCursor, Node, StreamingIterator};

// Import tree-sitter language constants
use tree_sitter_javascript::LANGUAGE as tree_sitter_javascript;
use tree_sitter_python::LANGUAGE as tree_sitter_python;
use tree_sitter_rust::LANGUAGE as tree_sitter_rust;
use tree_sitter_typescript::LANGUAGE_TYPESCRIPT as tree_sitter_typescript;

// Import new tree-sitter languages
use tree_sitter_sequel::LANGUAGE as tree_sitter_sql;
use tree_sitter_go::LANGUAGE as tree_sitter_go;
use tree_sitter_java::LANGUAGE as tree_sitter_java;
use tree_sitter_c::LANGUAGE as tree_sitter_c;
use tree_sitter_cpp::LANGUAGE as tree_sitter_cpp;
use tree_sitter_c_sharp::LANGUAGE as tree_sitter_csharp;
use tree_sitter_php::LANGUAGE_PHP as tree_sitter_php;
use tree_sitter_svelte_ng::LANGUAGE as tree_sitter_svelte;

/// Manages tree-sitter parsers for different programming languages
#[cfg_attr(feature = "napi-bindings", napi)]
pub struct ParserManager {
    parsers: HashMap<String, Parser>,
    queries: HashMap<String, Query>,
}

impl ParserManager {
    /// Create a new parser manager with all supported languages initialized
    pub fn new() -> Result<Self, ParseError> {
        let mut manager = ParserManager {
            parsers: HashMap::new(),
            queries: HashMap::new(),
        };

        manager.initialize_parsers()?;
        manager.initialize_queries()?;
        Ok(manager)
    }

    /// NAPI constructor
    #[cfg(feature = "napi-bindings")]
    pub fn napi_new() -> Result<Self, ParseError> {
        Self::new()
    }

    /// Initialize parsers for all supported languages
    fn initialize_parsers(&mut self) -> Result<(), ParseError> {
        // TypeScript parser
        let mut ts_parser = Parser::new();
        ts_parser
            .set_language(&tree_sitter_typescript.into())
            .map_err(|e| {
                ParseError::from_reason(format!("Failed to set TypeScript language: {}", e))
            })?;
        self.parsers.insert("typescript".to_string(), ts_parser);

        // JavaScript parser
        let mut js_parser = Parser::new();
        js_parser
            .set_language(&tree_sitter_javascript.into())
            .map_err(|e| {
                ParseError::from_reason(format!("Failed to set JavaScript language: {}", e))
            })?;
        self.parsers.insert("javascript".to_string(), js_parser);

        // Rust parser
        let mut rust_parser = Parser::new();
        rust_parser.set_language(&tree_sitter_rust.into()).map_err(|e| {
            ParseError::from_reason(format!("Failed to set Rust language: {}", e))
        })?;
        self.parsers.insert("rust".to_string(), rust_parser);

        // Python parser
        let mut python_parser = Parser::new();
        python_parser
            .set_language(&tree_sitter_python.into())
            .map_err(|e| {
                ParseError::from_reason(format!("Failed to set Python language: {}", e))
            })?;
        self.parsers.insert("python".to_string(), python_parser);

        // SQL parser
        let mut sql_parser = Parser::new();
        sql_parser.set_language(&tree_sitter_sql.into()).map_err(|e| {
            ParseError::from_reason(format!("Failed to set SQL language: {}", e))
        })?;
        self.parsers.insert("sql".to_string(), sql_parser);

        // Go parser
        let mut go_parser = Parser::new();
        go_parser.set_language(&tree_sitter_go.into()).map_err(|e| {
            ParseError::from_reason(format!("Failed to set Go language: {}", e))
        })?;
        self.parsers.insert("go".to_string(), go_parser);

        // Java parser
        let mut java_parser = Parser::new();
        java_parser.set_language(&tree_sitter_java.into()).map_err(|e| {
            ParseError::from_reason(format!("Failed to set Java language: {}", e))
        })?;
        self.parsers.insert("java".to_string(), java_parser);

        // C parser
        let mut c_parser = Parser::new();
        c_parser.set_language(&tree_sitter_c.into()).map_err(|e| {
            ParseError::from_reason(format!("Failed to set C language: {}", e))
        })?;
        self.parsers.insert("c".to_string(), c_parser);

        // C++ parser
        let mut cpp_parser = Parser::new();
        cpp_parser.set_language(&tree_sitter_cpp.into()).map_err(|e| {
            ParseError::from_reason(format!("Failed to set C++ language: {}", e))
        })?;
        self.parsers.insert("cpp".to_string(), cpp_parser);

        // C# parser
        let mut csharp_parser = Parser::new();
        csharp_parser.set_language(&tree_sitter_csharp.into()).map_err(|e| {
            ParseError::from_reason(format!("Failed to set C# language: {}", e))
        })?;
        self.parsers.insert("csharp".to_string(), csharp_parser);

        // Svelte parser (using svelte-ng)
        let mut svelte_parser = Parser::new();
        svelte_parser.set_language(&tree_sitter_svelte.into()).map_err(|e| {
            ParseError::from_reason(format!("Failed to set Svelte language: {}", e))
        })?;
        self.parsers.insert("svelte".to_string(), svelte_parser);

        // PHP parser
        let mut php_parser = Parser::new();
        php_parser.set_language(&tree_sitter_php.into()).map_err(|e| {
            ParseError::from_reason(format!("Failed to set PHP language: {}", e))
        })?;
        self.parsers.insert("php".to_string(), php_parser);

        Ok(())
    }

    /// Initialize common queries for different languages
    fn initialize_queries(&mut self) -> Result<(), ParseError> {
        // Initialize common queries for different languages
        let languages = ["typescript", "javascript", "rust", "python", "sql", "go", "java", "c", "cpp", "csharp", "svelte"];

        for lang in &languages {
            let lang_obj = self.get_tree_sitter_language(lang)?;

            // Function/method query
            let function_query = match *lang {
                "typescript" | "javascript" => "(function_declaration) @function",
                "rust" => "(function_item) @function",
                "python" => "(function_definition) @function",
                _ => continue,
            };

            if let Ok(query) = Query::new(&lang_obj, function_query) {
                self.queries.insert(format!("{}_functions", lang), query);
            }
        }

        Ok(())
    }

    /// Parse code with the appropriate language parser
    pub fn parse(&mut self, code: &str, language: &str) -> Result<Tree, ParseError> {
        let parser = self.parsers.get_mut(language).ok_or_else(|| {
            ParseError::from_reason(format!("Unsupported language: {}", language))
        })?;

        parser
            .parse(code, None)
            .ok_or_else(|| ParseError::from_reason("Failed to parse code"))
    }

    /// Get available languages
    pub fn available_languages(&self) -> Vec<String> {
        self.parsers.keys().cloned().collect()
    }

    /// Check if a language is supported
    pub fn supports_language(&self, language: &str) -> bool {
        self.parsers.contains_key(language)
    }

    /// Get tree-sitter language object for a given language string
    pub fn get_tree_sitter_language(&self, language: &str) -> Result<Language, ParseError> {
        match language {
            "typescript" => Ok(tree_sitter_typescript.into()),
            "javascript" => Ok(tree_sitter_javascript.into()),
            "rust" => Ok(tree_sitter_rust.into()),
            "python" => Ok(tree_sitter_python.into()),
            "sql" => Ok(tree_sitter_sql.into()),
            "go" => Ok(tree_sitter_go.into()),
            "java" => Ok(tree_sitter_java.into()),
            "c" => Ok(tree_sitter_c.into()),
            "cpp" => Ok(tree_sitter_cpp.into()),
            "csharp" => Ok(tree_sitter_csharp.into()),
            "svelte" => Ok(tree_sitter_svelte.into()),
            "php" => Ok(tree_sitter_php.into()),
            _ => Err(ParseError::from_reason(format!(
                "Unsupported language: {}",
                language
            ))),
        }
    }

    // AstParser compatibility methods

    /// Parse code and return full AST result with symbols and errors
    pub fn parse_code(
        &mut self,
        code: String,
        language: String,
    ) -> Result<ParseResult, ParseError> {
        let parser = self.parsers.get_mut(&language).ok_or_else(|| {
            ParseError::from_reason(format!("Unsupported language: {}", language))
        })?;

        let tree = parser
            .parse(&code, None)
            .ok_or_else(|| ParseError::from_reason("Failed to parse code"))?;

        let ast_tree = self.convert_tree_to_ast(&tree, &code)?;
        let symbols = self.extract_symbols(&tree, &code, &language)?;
        let errors = Self::extract_errors(&tree, &code);

        Ok(ParseResult {
            language,
            tree: ast_tree,
            errors,
            symbols,
        })
    }

    /// Query AST with tree-sitter query syntax
    pub fn query_ast(
        &mut self,
        code: String,
        language: String,
        query_string: String,
    ) -> Result<Vec<AstNode>, ParseError> {
        let parser = self.parsers.get_mut(&language).ok_or_else(|| {
            ParseError::from_reason(format!("Unsupported language: {}", language))
        })?;

        let tree = parser
            .parse(&code, None)
            .ok_or_else(|| ParseError::from_reason("Failed to parse code"))?;

        let lang = self.get_tree_sitter_language(&language)?;
        let query = Query::new(&lang, &query_string)
            .map_err(|e| ParseError::from_reason(format!("Invalid query: {}", e)))?;

        let mut cursor = QueryCursor::new();
        let mut matches = cursor.matches(&query, tree.root_node(), code.as_bytes());

        let mut results = Vec::new();
        while let Some(m) = matches.next() {
            for capture in m.captures {
                let node_ast = Self::convert_node_to_ast(capture.node, &code)?;
                results.push(node_ast);
            }
        }

        Ok(results)
    }

    /// Get symbols from parsed code
    pub fn get_symbols(
        &mut self,
        code: String,
        language: String,
    ) -> Result<Vec<Symbol>, ParseError> {
        let parser = self.parsers.get_mut(&language).ok_or_else(|| {
            ParseError::from_reason(format!("Unsupported language: {}", language))
        })?;

        let tree = parser
            .parse(&code, None)
            .ok_or_else(|| ParseError::from_reason("Failed to parse code"))?;

        self.extract_symbols(&tree, &code, &language)
    }

    /// Get AST node at specific position
    pub fn get_node_at_position(
        &mut self,
        code: String,
        language: String,
        line: u32,
        column: u32,
    ) -> Result<Option<AstNode>, ParseError> {
        let parser = self.parsers.get_mut(&language).ok_or_else(|| {
            ParseError::from_reason(format!("Unsupported language: {}", language))
        })?;

        let tree = parser
            .parse(&code, None)
            .ok_or_else(|| ParseError::from_reason("Failed to parse code"))?;

        let point = tree_sitter::Point::new(line as usize, column as usize);
        let node = tree.root_node().descendant_for_point_range(point, point);

        if let Some(node) = node {
            let ast_node = Self::convert_node_to_ast(node, &code)?;
            Ok(Some(ast_node))
        } else {
            Ok(None)
        }
    }

    /// Analyze code complexity
    pub fn analyze_complexity(
        &mut self,
        code: String,
        language: String,
    ) -> Result<HashMap<String, u32>, ParseError> {
        let parser = self.parsers.get_mut(&language).ok_or_else(|| {
            ParseError::from_reason(format!("Unsupported language: {}", language))
        })?;

        let tree = parser
            .parse(&code, None)
            .ok_or_else(|| ParseError::from_reason("Failed to parse code"))?;

        let mut complexity = HashMap::new();

        // Calculate various complexity metrics
        complexity.insert(
            "cyclomatic".to_string(),
            Self::calculate_cyclomatic_complexity(&tree),
        );
        complexity.insert(
            "cognitive".to_string(),
            Self::calculate_cognitive_complexity(&tree),
        );
        complexity.insert(
            "nesting_depth".to_string(),
            Self::calculate_max_nesting_depth(&tree),
        );
        complexity.insert("function_count".to_string(), Self::count_functions(&tree));
        complexity.insert("class_count".to_string(), Self::count_classes(&tree));

        Ok(complexity)
    }

    // Helper methods for AST conversion and analysis

    fn convert_tree_to_ast(&self, tree: &Tree, code: &str) -> Result<AstNode, ParseError> {
        Self::convert_node_to_ast(tree.root_node(), code)
    }

    fn convert_node_to_ast(node: Node, code: &str) -> Result<AstNode, ParseError> {
        let start_pos = node.start_position();
        let end_pos = node.end_position();

        let text = code
            .get(node.start_byte()..node.end_byte())
            .unwrap_or("")
            .to_string();

        let mut children = Vec::new();
        let mut cursor = node.walk();
        for child in node.children(&mut cursor) {
            if !child.is_error() {
                children.push(Self::convert_node_to_ast(child, code)?);
            }
        }

        Ok(AstNode {
            node_type: node.kind().to_string(),
            text,
            start_line: start_pos.row as u32,
            end_line: end_pos.row as u32,
            start_column: start_pos.column as u32,
            end_column: end_pos.column as u32,
            children,
        })
    }

    fn extract_symbols(
        &self,
        tree: &Tree,
        code: &str,
        language: &str,
    ) -> Result<Vec<Symbol>, ParseError> {
        let mut symbols = Vec::new();
        Self::walk_for_symbols(tree.root_node(), code, language, &mut symbols, "global")?;
        Ok(symbols)
    }

    fn walk_for_symbols(
        node: Node,
        code: &str,
        _language: &str,
        symbols: &mut Vec<Symbol>,
        scope: &str,
    ) -> Result<(), ParseError> {
        match node.kind() {
            "function_declaration" | "function_definition" | "function_item" => {
                if let Some(name) = Self::extract_function_name(node, code) {
                    symbols.push(Symbol {
                        name,
                        symbol_type: "function".to_string(),
                        line: node.start_position().row as u32,
                        column: node.start_position().column as u32,
                        scope: scope.to_string(),
                    });
                }
            }
            "class_declaration" | "class_definition" | "struct_item" | "enum_item" => {
                if let Some(name) = Self::extract_type_name(node, code) {
                    symbols.push(Symbol {
                        name: name.clone(),
                        symbol_type: Self::get_symbol_type(node.kind()).to_string(),
                        line: node.start_position().row as u32,
                        column: node.start_position().column as u32,
                        scope: scope.to_string(),
                    });

                    // Walk children with this class/struct as new scope
                    let mut cursor = node.walk();
                    for child in node.children(&mut cursor) {
                        Self::walk_for_symbols(child, code, _language, symbols, &name)?;
                    }
                    return Ok(());
                }
            }
            "variable_declaration" | "let_declaration" | "const_declaration" => {
                if let Some(name) = Self::extract_variable_name(node, code) {
                    symbols.push(Symbol {
                        name,
                        symbol_type: "variable".to_string(),
                        line: node.start_position().row as u32,
                        column: node.start_position().column as u32,
                        scope: scope.to_string(),
                    });
                }
            }
            _ => {}
        }

        // Continue walking children
        let mut cursor = node.walk();
        for child in node.children(&mut cursor) {
            Self::walk_for_symbols(child, code, _language, symbols, scope)?;
        }

        Ok(())
    }

    fn extract_function_name(node: Node, code: &str) -> Option<String> {
        let mut cursor = node.walk();
        for child in node.children(&mut cursor) {
            if child.kind() == "identifier" {
                return code
                    .get(child.start_byte()..child.end_byte())
                    .map(|s| s.to_string());
            }
        }
        None
    }

    fn extract_type_name(node: Node, code: &str) -> Option<String> {
        let mut cursor = node.walk();
        for child in node.children(&mut cursor) {
            if child.kind() == "identifier" || child.kind() == "type_identifier" {
                return code
                    .get(child.start_byte()..child.end_byte())
                    .map(|s| s.to_string());
            }
        }
        None
    }

    fn extract_variable_name(node: Node, code: &str) -> Option<String> {
        let mut cursor = node.walk();
        for child in node.children(&mut cursor) {
            if child.kind() == "identifier" {
                return code
                    .get(child.start_byte()..child.end_byte())
                    .map(|s| s.to_string());
            }
        }
        None
    }

    fn get_symbol_type(node_kind: &str) -> &str {
        match node_kind {
            "class_declaration" | "class_definition" => "class",
            "struct_item" => "struct",
            "enum_item" => "enum",
            "interface_declaration" => "interface",
            "type_alias_declaration" => "type",
            _ => "unknown",
        }
    }

    fn extract_errors(tree: &Tree, _code: &str) -> Vec<String> {
        let mut errors = Vec::new();
        Self::walk_for_errors(tree.root_node(), &mut errors);
        errors
    }

    fn walk_for_errors(node: Node, errors: &mut Vec<String>) {
        if node.is_error() {
            errors.push(format!(
                "Parse error at line {}, column {}: {}",
                node.start_position().row + 1,
                node.start_position().column + 1,
                node.kind()
            ));
        }

        if node.is_missing() {
            errors.push(format!(
                "Missing node at line {}, column {}: expected {}",
                node.start_position().row + 1,
                node.start_position().column + 1,
                node.kind()
            ));
        }

        let mut cursor = node.walk();
        for child in node.children(&mut cursor) {
            Self::walk_for_errors(child, errors);
        }
    }

    // Complexity calculation methods

    fn calculate_cyclomatic_complexity(tree: &Tree) -> u32 {
        let mut complexity = 1; // Base complexity
        Self::walk_for_complexity(tree.root_node(), &mut complexity);
        complexity
    }

    fn walk_for_complexity(node: Node, complexity: &mut u32) {
        match node.kind() {
            "if_statement"
            | "while_statement"
            | "for_statement"
            | "switch_statement"
            | "case_clause"
            | "catch_clause"
            | "conditional_expression" => {
                *complexity += 1;
            }
            _ => {}
        }

        let mut cursor = node.walk();
        for child in node.children(&mut cursor) {
            Self::walk_for_complexity(child, complexity);
        }
    }

    fn calculate_cognitive_complexity(tree: &Tree) -> u32 {
        let mut complexity = 0;
        Self::walk_for_cognitive_complexity(tree.root_node(), &mut complexity, 0);
        complexity
    }

    fn walk_for_cognitive_complexity(node: Node, complexity: &mut u32, nesting_level: u32) {
        let increment = match node.kind() {
            "if_statement" | "switch_statement" | "for_statement" | "while_statement"
            | "do_statement" => nesting_level + 1,
            "catch_clause" => nesting_level + 1,
            "conditional_expression" => 1,
            "break_statement" | "continue_statement" => 1,
            _ => 0,
        };

        *complexity += increment;

        let new_nesting = if matches!(
            node.kind(),
            "if_statement"
                | "switch_statement"
                | "for_statement"
                | "while_statement"
                | "do_statement"
                | "catch_clause"
        ) {
            nesting_level + 1
        } else {
            nesting_level
        };

        let mut cursor = node.walk();
        for child in node.children(&mut cursor) {
            Self::walk_for_cognitive_complexity(child, complexity, new_nesting);
        }
    }

    fn calculate_max_nesting_depth(tree: &Tree) -> u32 {
        Self::walk_for_nesting_depth(tree.root_node(), 0)
    }

    fn walk_for_nesting_depth(node: Node, current_depth: u32) -> u32 {
        let mut max_depth = current_depth;

        let is_nesting_node = matches!(
            node.kind(),
            "if_statement"
                | "while_statement"
                | "for_statement"
                | "switch_statement"
                | "function_declaration"
                | "class_declaration"
        );

        let new_depth = if is_nesting_node {
            current_depth + 1
        } else {
            current_depth
        };

        max_depth = max_depth.max(new_depth);

        let mut cursor = node.walk();
        for child in node.children(&mut cursor) {
            let child_max = Self::walk_for_nesting_depth(child, new_depth);
            max_depth = max_depth.max(child_max);
        }

        max_depth
    }

    fn count_functions(tree: &Tree) -> u32 {
        let mut count = 0;
        Self::walk_for_function_count(tree.root_node(), &mut count);
        count
    }

    fn walk_for_function_count(node: Node, count: &mut u32) {
        if matches!(
            node.kind(),
            "function_declaration"
                | "function_definition"
                | "function_item"
                | "method_definition"
                | "arrow_function"
        ) {
            *count += 1;
        }

        let mut cursor = node.walk();
        for child in node.children(&mut cursor) {
            Self::walk_for_function_count(child, count);
        }
    }

    fn count_classes(tree: &Tree) -> u32 {
        let mut count = 0;
        Self::walk_for_class_count(tree.root_node(), &mut count);
        count
    }

    fn walk_for_class_count(node: Node, count: &mut u32) {
        if matches!(
            node.kind(),
            "class_declaration" | "class_definition" | "struct_item" | "enum_item"
        ) {
            *count += 1;
        }

        let mut cursor = node.walk();
        for child in node.children(&mut cursor) {
            Self::walk_for_class_count(child, count);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parser_manager_creation() {
        let manager = ParserManager::new();
        assert!(manager.is_ok());
        
        let manager = manager.unwrap();
        assert!(!manager.parsers.is_empty());
    }

    #[test]
    fn test_available_languages() {
        let manager = ParserManager::new().unwrap();
        let languages = manager.available_languages();
        
        assert!(languages.contains(&"typescript".to_string()));
        assert!(languages.contains(&"javascript".to_string()));
        assert!(languages.contains(&"rust".to_string()));
        assert!(languages.contains(&"python".to_string()));
        assert!(languages.contains(&"sql".to_string()));
        assert!(languages.contains(&"go".to_string()));
        assert!(languages.contains(&"java".to_string()));
        assert!(languages.contains(&"c".to_string()));
        assert!(languages.contains(&"cpp".to_string()));
        assert!(languages.contains(&"csharp".to_string()));
        assert!(languages.contains(&"svelte".to_string()));
    }

    #[test]
    fn test_supports_language() {
        let manager = ParserManager::new().unwrap();
        
        assert!(manager.supports_language("typescript"));
        assert!(manager.supports_language("javascript"));
        assert!(manager.supports_language("rust"));
        assert!(manager.supports_language("python"));
        assert!(manager.supports_language("sql"));
        assert!(manager.supports_language("go"));
        assert!(manager.supports_language("java"));
        assert!(manager.supports_language("c"));
        assert!(manager.supports_language("cpp"));
        assert!(manager.supports_language("csharp"));
        assert!(manager.supports_language("svelte"));
        
        assert!(!manager.supports_language("unknown"));
        assert!(!manager.supports_language(""));
    }

    #[test]
    fn test_get_tree_sitter_language() {
        let manager = ParserManager::new().unwrap();
        
        // Test all supported languages
        assert!(manager.get_tree_sitter_language("typescript").is_ok());
        assert!(manager.get_tree_sitter_language("javascript").is_ok());
        assert!(manager.get_tree_sitter_language("rust").is_ok());
        assert!(manager.get_tree_sitter_language("python").is_ok());
        assert!(manager.get_tree_sitter_language("sql").is_ok());
        assert!(manager.get_tree_sitter_language("go").is_ok());
        assert!(manager.get_tree_sitter_language("java").is_ok());
        assert!(manager.get_tree_sitter_language("c").is_ok());
        assert!(manager.get_tree_sitter_language("cpp").is_ok());
        assert!(manager.get_tree_sitter_language("csharp").is_ok());
        assert!(manager.get_tree_sitter_language("svelte").is_ok());
        assert!(manager.get_tree_sitter_language("php").is_ok());
        
        // Test unsupported language
        assert!(manager.get_tree_sitter_language("unknown").is_err());
    }

    #[test]
    fn test_parse_simple_code() {
        let mut manager = ParserManager::new().unwrap();
        
        // Test TypeScript parsing
        let ts_code = "function test() { return 42; }";
        let ts_result = manager.parse(ts_code, "typescript");
        assert!(ts_result.is_ok());
        
        let tree = ts_result.unwrap();
        assert_eq!(tree.root_node().kind(), "program");
        assert!(tree.root_node().child_count() > 0);
    }

    #[test]
    fn test_parse_javascript() {
        let mut manager = ParserManager::new().unwrap();
        
        let js_code = "const x = 5;";
        let result = manager.parse(js_code, "javascript");
        assert!(result.is_ok());
        
        let tree = result.unwrap();
        assert_eq!(tree.root_node().kind(), "program");
    }

    #[test]
    fn test_parse_rust() {
        let mut manager = ParserManager::new().unwrap();
        
        let rust_code = "fn main() { println!(\"Hello\"); }";
        let result = manager.parse(rust_code, "rust");
        assert!(result.is_ok());
        
        let tree = result.unwrap();
        assert_eq!(tree.root_node().kind(), "source_file");
    }

    #[test]
    fn test_parse_python() {
        let mut manager = ParserManager::new().unwrap();
        
        let python_code = "def hello():\n    return 'world'";
        let result = manager.parse(python_code, "python");
        assert!(result.is_ok());
        
        let tree = result.unwrap();
        assert_eq!(tree.root_node().kind(), "module");
    }

    #[test]
    fn test_parse_sql() {
        let mut manager = ParserManager::new().unwrap();
        
        let sql_code = "SELECT * FROM users WHERE id = 1;";
        let result = manager.parse(sql_code, "sql");
        assert!(result.is_ok());
        
        let tree = result.unwrap();
        assert_eq!(tree.root_node().kind(), "program");
    }

    #[test]
    fn test_parse_go() {
        let mut manager = ParserManager::new().unwrap();
        
        let go_code = "package main\n\nfunc main() {\n    println(\"Hello\")\n}";
        let result = manager.parse(go_code, "go");
        assert!(result.is_ok());
        
        let tree = result.unwrap();
        assert_eq!(tree.root_node().kind(), "source_file");
    }

    #[test]
    fn test_parse_unsupported_language() {
        let mut manager = ParserManager::new().unwrap();
        
        let result = manager.parse("some code", "unknown");
        assert!(result.is_err());
    }

    #[test]
    fn test_parse_invalid_code() {
        let mut manager = ParserManager::new().unwrap();
        
        // Test with syntactically invalid JavaScript
        let invalid_js = "function {{{ invalid syntax";
        let result = manager.parse(invalid_js, "javascript");
        
        // Tree-sitter should still parse this (with error nodes), not fail entirely
        assert!(result.is_ok());
        
        let tree = result.unwrap();
        assert_eq!(tree.root_node().kind(), "program");
    }

    #[test]
    fn test_all_languages_initialized() {
        let manager = ParserManager::new().unwrap();
        
        // Verify all expected languages are present
        let expected_languages = vec![
            "typescript", "javascript", "rust", "python", "sql",
            "go", "java", "c", "cpp", "csharp", "svelte", "php"
        ];
        
        for lang in expected_languages {
            assert!(manager.supports_language(lang), "Language {} should be supported", lang);
        }
        
        // Should have exactly these languages
        assert_eq!(manager.available_languages().len(), 12);
    }
}
