//! Configuration and file filtering logic for semantic analysis

use std::path::Path;

/// Configuration for file analysis
pub struct AnalysisConfig {
    /// Maximum file size to analyze (in bytes)
    pub max_file_size: u64,
    /// Maximum files to process
    pub max_files: usize,
    /// Supported file extensions
    pub supported_extensions: Vec<&'static str>,
}

impl Default for AnalysisConfig {
    fn default() -> Self {
        Self {
            max_file_size: 1_048_576, // 1MB
            max_files: 1000,
            supported_extensions: vec![
                "ts", "tsx", "js", "jsx", "rs", "py", "go", "java", 
                "cpp", "c", "cs", "svelte", "sql"
            ],
        }
    }
}

impl AnalysisConfig {
    /// Check if a file should be analyzed based on configuration rules
    pub fn should_analyze_file(&self, file_path: &Path) -> bool {
        // Skip common non-source directories and build artifacts
        let path_str = file_path.to_string_lossy();
        if self.is_ignored_directory(&path_str) {
            return false;
        }

        // Skip common generated/minified file patterns
        let file_name = file_path.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("");
        
        if self.is_ignored_file(file_name) {
            return false;
        }

        // Check file size - skip very large files to prevent hanging
        if let Ok(metadata) = file_path.metadata() {
            if metadata.len() > self.max_file_size {
                return false;
            }
        }

        // Check if file extension is supported
        if let Some(extension) = file_path.extension().and_then(|s| s.to_str()) {
            self.supported_extensions.contains(&extension.to_lowercase().as_str())
        } else {
            false
        }
    }

    /// Check if a directory should be ignored
    fn is_ignored_directory(&self, path_str: &str) -> bool {
        path_str.contains("node_modules")
            || path_str.contains(".git")
            || path_str.contains("target")
            || path_str.contains("dist")
            || path_str.contains("build")
            || path_str.contains("out")
            || path_str.contains("output")
            || path_str.contains(".next")
            || path_str.contains(".nuxt")
            || path_str.contains(".svelte-kit")
            || path_str.contains(".vitepress")
            || path_str.contains("_site")
            || path_str.contains("public")
            || path_str.contains("static")
            || path_str.contains("assets")
            || path_str.contains("__pycache__")
            || path_str.contains(".pytest_cache")
            || path_str.contains("coverage")
            || path_str.contains(".coverage")
            || path_str.contains("htmlcov")
            || path_str.contains("vendor")
            || path_str.contains("bin")
            || path_str.contains("obj")
            || path_str.contains("Debug")
            || path_str.contains("Release")
            || path_str.contains(".venv")
            || path_str.contains("venv")
            || path_str.contains("env")
            || path_str.contains(".env")
            || path_str.contains("tmp")
            || path_str.contains("temp")
            || path_str.contains(".tmp")
            || path_str.contains("cache")
            || path_str.contains(".cache")
            || path_str.contains("logs")
            || path_str.contains(".logs")
            || path_str.contains("lib-cov")
            || path_str.contains("nyc_output")
            || path_str.contains(".nyc_output")
            || path_str.contains("bower_components")
            || path_str.contains("jspm_packages")
    }

    /// Check if a file should be ignored based on its name
    fn is_ignored_file(&self, file_name: &str) -> bool {
        file_name.ends_with(".min.js")
            || file_name.ends_with(".min.css")
            || file_name.ends_with(".bundle.js")
            || file_name.ends_with(".chunk.js")
            || file_name.ends_with(".map")
            || file_name.starts_with(".")
            || file_name == "package-lock.json"
            || file_name == "yarn.lock"
            || file_name == "Cargo.lock"
            || file_name == "Gemfile.lock"
            || file_name == "Pipfile.lock"
            || file_name == "poetry.lock"
    }

    /// Detect programming language from file path
    pub fn detect_language_from_path(&self, file_path: &str) -> String {
        if let Some(extension) = Path::new(file_path)
            .extension()
            .and_then(|s| s.to_str())
        {
            match extension.to_lowercase().as_str() {
                "ts" | "tsx" => "typescript".to_string(),
                "js" | "jsx" => "javascript".to_string(),
                "rs" => "rust".to_string(),
                "py" => "python".to_string(),
                "sql" => "sql".to_string(),
                "go" => "go".to_string(),
                "java" => "java".to_string(),
                "c" => "c".to_string(),
                "cpp" | "cc" | "cxx" => "cpp".to_string(),
                "cs" => "csharp".to_string(),
                "svelte" => "svelte".to_string(),
                _ => "generic".to_string(),
            }
        } else {
            "generic".to_string()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    #[test]
    fn test_default_config() {
        let config = AnalysisConfig::default();
        assert_eq!(config.max_file_size, 1_048_576);
        assert_eq!(config.max_files, 1000);
        assert!(config.supported_extensions.contains(&"ts"));
        assert!(config.supported_extensions.contains(&"rs"));
        assert!(config.supported_extensions.contains(&"sql"));
    }

    #[test]
    fn test_supported_file_extensions() {
        let config = AnalysisConfig::default();
        
        // Test supported extensions
        assert!(config.should_analyze_file(Path::new("test.ts")));
        assert!(config.should_analyze_file(Path::new("test.js")));
        assert!(config.should_analyze_file(Path::new("test.py")));
        assert!(config.should_analyze_file(Path::new("test.rs")));
        assert!(config.should_analyze_file(Path::new("test.go")));
        assert!(config.should_analyze_file(Path::new("test.java")));
        assert!(config.should_analyze_file(Path::new("test.c")));
        assert!(config.should_analyze_file(Path::new("test.cpp")));
        assert!(config.should_analyze_file(Path::new("test.cs")));
        assert!(config.should_analyze_file(Path::new("test.svelte")));
        assert!(config.should_analyze_file(Path::new("test.sql")));
    }

    #[test]
    fn test_unsupported_file_extensions() {
        let config = AnalysisConfig::default();
        
        // Test unsupported extensions
        assert!(!config.should_analyze_file(Path::new("test.md")));
        assert!(!config.should_analyze_file(Path::new("test.json")));
        assert!(!config.should_analyze_file(Path::new("test.css")));
        assert!(!config.should_analyze_file(Path::new("test.html")));
    }

    #[test]
    fn test_ignored_directories() {
        let config = AnalysisConfig::default();
        
        // Test build directories
        assert!(!config.should_analyze_file(Path::new("dist/test.js")));
        assert!(!config.should_analyze_file(Path::new("build/test.js")));
        assert!(!config.should_analyze_file(Path::new("node_modules/test.js")));
        assert!(!config.should_analyze_file(Path::new(".next/test.js")));
        assert!(!config.should_analyze_file(Path::new("target/test.rs")));
        assert!(!config.should_analyze_file(Path::new("__pycache__/test.py")));
    }

    #[test]
    fn test_ignored_files() {
        let config = AnalysisConfig::default();
        
        // Test minified and generated files
        assert!(!config.should_analyze_file(Path::new("app.min.js")));
        assert!(!config.should_analyze_file(Path::new("bundle.min.css")));
        assert!(!config.should_analyze_file(Path::new("package-lock.json")));
        assert!(!config.should_analyze_file(Path::new("yarn.lock")));
        assert!(!config.should_analyze_file(Path::new("Cargo.lock")));
        assert!(!config.should_analyze_file(Path::new("app.bundle.js")));
        assert!(!config.should_analyze_file(Path::new("source.map")));
    }

    #[test]
    fn test_sql_server_database_project_structure() {
        let config = AnalysisConfig::default();
        
        // Test SQL Server Database Project structure (dbo/Tables/, etc.)
        assert!(config.should_analyze_file(Path::new("dbo/Tables/Users.sql")));
        assert!(config.should_analyze_file(Path::new("dbo/Views/UserView.sql")));
        assert!(config.should_analyze_file(Path::new("dbo/StoredProcedures/GetUser.sql")));
        assert!(config.should_analyze_file(Path::new("Security/Roles/db_owner.sql")));
    }

    #[test]
    fn test_language_detection() {
        let config = AnalysisConfig::default();
        
        assert_eq!(config.detect_language_from_path("test.ts"), "typescript");
        assert_eq!(config.detect_language_from_path("test.tsx"), "typescript");
        assert_eq!(config.detect_language_from_path("test.js"), "javascript");
        assert_eq!(config.detect_language_from_path("test.jsx"), "javascript");
        assert_eq!(config.detect_language_from_path("test.rs"), "rust");
        assert_eq!(config.detect_language_from_path("test.py"), "python");
        assert_eq!(config.detect_language_from_path("test.sql"), "sql");
        assert_eq!(config.detect_language_from_path("test.go"), "go");
        assert_eq!(config.detect_language_from_path("test.java"), "java");
        assert_eq!(config.detect_language_from_path("test.c"), "c");
        assert_eq!(config.detect_language_from_path("test.cpp"), "cpp");
        assert_eq!(config.detect_language_from_path("test.cc"), "cpp");
        assert_eq!(config.detect_language_from_path("test.cxx"), "cpp");
        assert_eq!(config.detect_language_from_path("test.cs"), "csharp");
        assert_eq!(config.detect_language_from_path("test.svelte"), "svelte");
        assert_eq!(config.detect_language_from_path("test.unknown"), "generic");
        assert_eq!(config.detect_language_from_path("noextension"), "generic");
    }

    #[test]
    fn test_custom_config() {
        let mut config = AnalysisConfig::default();
        config.max_file_size = 500_000; // 500KB
        config.max_files = 500;
        config.supported_extensions = vec!["ts", "js", "rs"];

        assert_eq!(config.max_file_size, 500_000);
        assert_eq!(config.max_files, 500);
        assert_eq!(config.supported_extensions.len(), 3);
        
        // Should support only the specified extensions
        assert!(config.should_analyze_file(Path::new("test.ts")));
        assert!(config.should_analyze_file(Path::new("test.js")));
        assert!(config.should_analyze_file(Path::new("test.rs")));
        assert!(!config.should_analyze_file(Path::new("test.py"))); // No longer supported
    }

    #[test]
    fn test_is_ignored_directory_directly() {
        let config = AnalysisConfig::default();
        
        assert!(config.is_ignored_directory("node_modules/package"));
        assert!(config.is_ignored_directory("dist/build"));
        assert!(config.is_ignored_directory("target/debug"));
        assert!(config.is_ignored_directory("__pycache__/test"));
        assert!(!config.is_ignored_directory("src/components"));
        assert!(!config.is_ignored_directory("lib/utils"));
    }

    #[test]
    fn test_is_ignored_file_directly() {
        let config = AnalysisConfig::default();
        
        assert!(config.is_ignored_file("app.min.js"));
        assert!(config.is_ignored_file("package-lock.json"));
        assert!(config.is_ignored_file(".gitignore"));
        assert!(config.is_ignored_file("bundle.chunk.js"));
        assert!(!config.is_ignored_file("app.js"));
        assert!(!config.is_ignored_file("package.json"));
        assert!(!config.is_ignored_file("test.ts"));
    }
}