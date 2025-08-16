use napi_derive::napi;
use serde::{Deserialize, Serialize};
use tree_sitter::{Language, Parser, Tree, Node, Query, QueryCursor};
use std::collections::HashMap;
use streaming_iterator::StreamingIterator;

extern "C" {
    fn tree_sitter_typescript() -> Language;
    fn tree_sitter_javascript() -> Language;
    fn tree_sitter_rust() -> Language;
    fn tree_sitter_python() -> Language;
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[napi(object)]
pub struct AstNode {
    pub node_type: String,
    pub text: String,
    pub start_line: u32,
    pub end_line: u32,
    pub start_column: u32,
    pub end_column: u32,
    pub children: Vec<AstNode>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[napi(object)]
pub struct ParseResult {
    pub language: String,
    pub tree: AstNode,
    pub errors: Vec<String>,
    pub symbols: Vec<Symbol>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[napi(object)]
pub struct Symbol {
    pub name: String,
    pub symbol_type: String,
    pub line: u32,
    pub column: u32,
    pub scope: String,
}

#[napi]
pub struct AstParser {
    parsers: HashMap<String, Parser>,
    queries: HashMap<String, Query>,
}

#[napi]
impl AstParser {
    #[napi(constructor)]
    pub fn new() -> napi::Result<Self> {
        let mut parser = AstParser {
            parsers: HashMap::new(),
            queries: HashMap::new(),
        };

        parser.initialize_parsers()?;
        parser.initialize_queries()?;
        Ok(parser)
    }

    #[napi]
    pub fn parse_code(&mut self, code: String, language: String) -> napi::Result<ParseResult> {
        let parser = self.parsers.get_mut(&language)
            .ok_or_else(|| napi::Error::from_reason(format!("Unsupported language: {}", language)))?;

        let tree = parser.parse(&code, None)
            .ok_or_else(|| napi::Error::from_reason("Failed to parse code"))?;

        let ast_tree = self.convert_tree_to_ast(&tree, &code)?;
        let symbols = self.extract_symbols(&tree, &code, &language)?;
        let errors = self.extract_errors(&tree, &code);

        Ok(ParseResult {
            language,
            tree: ast_tree,
            errors,
            symbols,
        })
    }

    #[napi]
    pub fn query_ast(&mut self, code: String, language: String, query_string: String) -> napi::Result<Vec<AstNode>> {
        let parser = self.parsers.get_mut(&language)
            .ok_or_else(|| napi::Error::from_reason(format!("Unsupported language: {}", language)))?;

        let tree = parser.parse(&code, None)
            .ok_or_else(|| napi::Error::from_reason("Failed to parse code"))?;

        let lang = self.get_tree_sitter_language(&language)?;
        let query = Query::new(&lang, &query_string)
            .map_err(|e| napi::Error::from_reason(format!("Invalid query: {}", e)))?;

        let mut cursor = QueryCursor::new();
        let mut matches = cursor.matches(&query, tree.root_node(), code.as_bytes());

        let mut results = Vec::new();
        while let Some(m) = matches.next() {
            for capture in m.captures {
                let node_ast = self.convert_node_to_ast(capture.node, &code)?;
                results.push(node_ast);
            }
        }

        Ok(results)
    }

    #[napi]
    pub fn get_symbols(&mut self, code: String, language: String) -> napi::Result<Vec<Symbol>> {
        let parser = self.parsers.get_mut(&language)
            .ok_or_else(|| napi::Error::from_reason(format!("Unsupported language: {}", language)))?;

        let tree = parser.parse(&code, None)
            .ok_or_else(|| napi::Error::from_reason("Failed to parse code"))?;

        self.extract_symbols(&tree, &code, &language)
    }

    #[napi]
    pub fn get_node_at_position(&mut self, code: String, language: String, line: u32, column: u32) -> napi::Result<Option<AstNode>> {
        let parser = self.parsers.get_mut(&language)
            .ok_or_else(|| napi::Error::from_reason(format!("Unsupported language: {}", language)))?;

        let tree = parser.parse(&code, None)
            .ok_or_else(|| napi::Error::from_reason("Failed to parse code"))?;

        let point = tree_sitter::Point::new(line as usize, column as usize);
        let node = tree.root_node().descendant_for_point_range(point, point);

        if let Some(node) = node {
            let ast_node = self.convert_node_to_ast(node, &code)?;
            Ok(Some(ast_node))
        } else {
            Ok(None)
        }
    }

    #[napi]
    pub fn analyze_complexity(&mut self, code: String, language: String) -> napi::Result<HashMap<String, u32>> {
        let parser = self.parsers.get_mut(&language)
            .ok_or_else(|| napi::Error::from_reason(format!("Unsupported language: {}", language)))?;

        let tree = parser.parse(&code, None)
            .ok_or_else(|| napi::Error::from_reason("Failed to parse code"))?;

        let mut complexity = HashMap::new();
        
        // Calculate various complexity metrics
        complexity.insert("cyclomatic".to_string(), self.calculate_cyclomatic_complexity(&tree));
        complexity.insert("cognitive".to_string(), self.calculate_cognitive_complexity(&tree));
        complexity.insert("nesting_depth".to_string(), self.calculate_max_nesting_depth(&tree));
        complexity.insert("function_count".to_string(), self.count_functions(&tree));
        complexity.insert("class_count".to_string(), self.count_classes(&tree));

        Ok(complexity)
    }

    fn initialize_parsers(&mut self) -> napi::Result<()> {
        unsafe {
            // TypeScript parser
            let mut ts_parser = Parser::new();
            ts_parser.set_language(&tree_sitter_typescript())
                .map_err(|e| napi::Error::from_reason(format!("Failed to set TypeScript language: {}", e)))?;
            self.parsers.insert("typescript".to_string(), ts_parser);

            // JavaScript parser
            let mut js_parser = Parser::new();
            js_parser.set_language(&tree_sitter_javascript())
                .map_err(|e| napi::Error::from_reason(format!("Failed to set JavaScript language: {}", e)))?;
            self.parsers.insert("javascript".to_string(), js_parser);

            // Rust parser
            let mut rust_parser = Parser::new();
            rust_parser.set_language(&tree_sitter_rust())
                .map_err(|e| napi::Error::from_reason(format!("Failed to set Rust language: {}", e)))?;
            self.parsers.insert("rust".to_string(), rust_parser);

            // Python parser
            let mut python_parser = Parser::new();
            python_parser.set_language(&tree_sitter_python())
                .map_err(|e| napi::Error::from_reason(format!("Failed to set Python language: {}", e)))?;
            self.parsers.insert("python".to_string(), python_parser);
        }

        Ok(())
    }

    fn initialize_queries(&mut self) -> napi::Result<()> {
        // Initialize common queries for different languages
        let languages = ["typescript", "javascript", "rust", "python"];
        
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

    fn get_tree_sitter_language(&self, language: &str) -> napi::Result<Language> {
        unsafe {
            match language {
                "typescript" => Ok(tree_sitter_typescript()),
                "javascript" => Ok(tree_sitter_javascript()),
                "rust" => Ok(tree_sitter_rust()),
                "python" => Ok(tree_sitter_python()),
                _ => Err(napi::Error::from_reason(format!("Unsupported language: {}", language))),
            }
        }
    }

    fn convert_tree_to_ast(&self, tree: &Tree, code: &str) -> napi::Result<AstNode> {
        self.convert_node_to_ast(tree.root_node(), code)
    }

    fn convert_node_to_ast(&self, node: Node, code: &str) -> napi::Result<AstNode> {
        let start_pos = node.start_position();
        let end_pos = node.end_position();
        
        let text = code.get(node.start_byte()..node.end_byte())
            .unwrap_or("")
            .to_string();

        let mut children = Vec::new();
        let mut cursor = node.walk();
        for child in node.children(&mut cursor) {
            if !child.is_error() {
                children.push(self.convert_node_to_ast(child, code)?);
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

    fn extract_symbols(&self, tree: &Tree, code: &str, language: &str) -> napi::Result<Vec<Symbol>> {
        let mut symbols = Vec::new();
        self.walk_for_symbols(tree.root_node(), code, language, &mut symbols, "global")?;
        Ok(symbols)
    }

    fn walk_for_symbols(
        &self,
        node: Node,
        code: &str,
        language: &str,
        symbols: &mut Vec<Symbol>,
        scope: &str,
    ) -> napi::Result<()> {
        match node.kind() {
            "function_declaration" | "function_definition" | "function_item" => {
                if let Some(name) = self.extract_function_name(node, code) {
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
                if let Some(name) = self.extract_type_name(node, code) {
                    symbols.push(Symbol {
                        name: name.clone(),
                        symbol_type: self.get_symbol_type(node.kind()).to_string(),
                        line: node.start_position().row as u32,
                        column: node.start_position().column as u32,
                        scope: scope.to_string(),
                    });
                    
                    // Walk children with this class/struct as new scope
                    let mut cursor = node.walk();
                    for child in node.children(&mut cursor) {
                        self.walk_for_symbols(child, code, language, symbols, &name)?;
                    }
                    return Ok(());
                }
            }
            "variable_declaration" | "let_declaration" | "const_declaration" => {
                if let Some(name) = self.extract_variable_name(node, code) {
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
            self.walk_for_symbols(child, code, language, symbols, scope)?;
        }

        Ok(())
    }

    fn extract_function_name(&self, node: Node, code: &str) -> Option<String> {
        let mut cursor = node.walk();
        for child in node.children(&mut cursor) {
            if child.kind() == "identifier" {
                return code.get(child.start_byte()..child.end_byte())
                    .map(|s| s.to_string());
            }
        }
        None
    }

    fn extract_type_name(&self, node: Node, code: &str) -> Option<String> {
        let mut cursor = node.walk();
        for child in node.children(&mut cursor) {
            if child.kind() == "identifier" || child.kind() == "type_identifier" {
                return code.get(child.start_byte()..child.end_byte())
                    .map(|s| s.to_string());
            }
        }
        None
    }

    fn extract_variable_name(&self, node: Node, code: &str) -> Option<String> {
        let mut cursor = node.walk();
        for child in node.children(&mut cursor) {
            if child.kind() == "identifier" {
                return code.get(child.start_byte()..child.end_byte())
                    .map(|s| s.to_string());
            }
        }
        None
    }

    fn get_symbol_type(&self, node_kind: &str) -> &str {
        match node_kind {
            "class_declaration" | "class_definition" => "class",
            "struct_item" => "struct",
            "enum_item" => "enum",
            "interface_declaration" => "interface",
            "type_alias_declaration" => "type",
            _ => "unknown",
        }
    }

    fn extract_errors(&self, tree: &Tree, _code: &str) -> Vec<String> {
        let mut errors = Vec::new();
        self.walk_for_errors(tree.root_node(), &mut errors);
        errors
    }

    fn walk_for_errors(&self, node: Node, errors: &mut Vec<String>) {
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
            self.walk_for_errors(child, errors);
        }
    }

    fn calculate_cyclomatic_complexity(&self, tree: &Tree) -> u32 {
        let mut complexity = 1; // Base complexity
        self.walk_for_complexity(tree.root_node(), &mut complexity);
        complexity
    }

    fn walk_for_complexity(&self, node: Node, complexity: &mut u32) {
        match node.kind() {
            "if_statement" | "while_statement" | "for_statement" | 
            "switch_statement" | "case_clause" | "catch_clause" |
            "conditional_expression" => {
                *complexity += 1;
            }
            _ => {}
        }

        let mut cursor = node.walk();
        for child in node.children(&mut cursor) {
            self.walk_for_complexity(child, complexity);
        }
    }

    fn calculate_cognitive_complexity(&self, tree: &Tree) -> u32 {
        let mut complexity = 0;
        self.walk_for_cognitive_complexity(tree.root_node(), &mut complexity, 0);
        complexity
    }

    fn walk_for_cognitive_complexity(&self, node: Node, complexity: &mut u32, nesting_level: u32) {
        let increment = match node.kind() {
            "if_statement" | "switch_statement" | "for_statement" | 
            "while_statement" | "do_statement" => nesting_level + 1,
            "catch_clause" => nesting_level + 1,
            "conditional_expression" => 1,
            "break_statement" | "continue_statement" => 1,
            _ => 0,
        };

        *complexity += increment;

        let new_nesting = if matches!(node.kind(), 
            "if_statement" | "switch_statement" | "for_statement" | 
            "while_statement" | "do_statement" | "catch_clause"
        ) {
            nesting_level + 1
        } else {
            nesting_level
        };

        let mut cursor = node.walk();
        for child in node.children(&mut cursor) {
            self.walk_for_cognitive_complexity(child, complexity, new_nesting);
        }
    }

    fn calculate_max_nesting_depth(&self, tree: &Tree) -> u32 {
        self.walk_for_nesting_depth(tree.root_node(), 0)
    }

    fn walk_for_nesting_depth(&self, node: Node, current_depth: u32) -> u32 {
        let mut max_depth = current_depth;

        let is_nesting_node = matches!(node.kind(),
            "if_statement" | "while_statement" | "for_statement" |
            "switch_statement" | "function_declaration" | "class_declaration"
        );

        let new_depth = if is_nesting_node {
            current_depth + 1
        } else {
            current_depth
        };

        max_depth = max_depth.max(new_depth);

        let mut cursor = node.walk();
        for child in node.children(&mut cursor) {
            let child_max = self.walk_for_nesting_depth(child, new_depth);
            max_depth = max_depth.max(child_max);
        }

        max_depth
    }

    fn count_functions(&self, tree: &Tree) -> u32 {
        let mut count = 0;
        self.walk_for_function_count(tree.root_node(), &mut count);
        count
    }

    fn walk_for_function_count(&self, node: Node, count: &mut u32) {
        if matches!(node.kind(), 
            "function_declaration" | "function_definition" | "function_item" |
            "method_definition" | "arrow_function"
        ) {
            *count += 1;
        }

        let mut cursor = node.walk();
        for child in node.children(&mut cursor) {
            self.walk_for_function_count(child, count);
        }
    }

    fn count_classes(&self, tree: &Tree) -> u32 {
        let mut count = 0;
        self.walk_for_class_count(tree.root_node(), &mut count);
        count
    }

    fn walk_for_class_count(&self, node: Node, count: &mut u32) {
        if matches!(node.kind(), 
            "class_declaration" | "class_definition" | "struct_item" | "enum_item"
        ) {
            *count += 1;
        }

        let mut cursor = node.walk();
        for child in node.children(&mut cursor) {
            self.walk_for_class_count(child, count);
        }
    }
}