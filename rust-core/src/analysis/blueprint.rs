//! Project blueprint analysis - entry points and feature mapping

#[cfg(feature = "napi-bindings")]
use napi_derive::napi;

use crate::types::ParseError;
use crate::analysis::FrameworkInfo;
use std::path::Path;
use std::fs;

/// Entry point information
#[derive(Debug, Clone)]
#[cfg_attr(feature = "napi-bindings", napi(object))]
pub struct EntryPoint {
    pub entry_type: String, // 'web', 'api', 'cli', 'script'
    pub file_path: String,
    pub framework: Option<String>,
    pub confidence: f64,
}

/// Key directory information
#[derive(Debug, Clone)]
#[cfg_attr(feature = "napi-bindings", napi(object))]
pub struct KeyDirectory {
    pub path: String,
    pub dir_type: String, // 'components', 'utils', 'services', etc.
    pub file_count: u32,
}

/// Feature mapping information
#[derive(Debug, Clone)]
#[cfg_attr(feature = "napi-bindings", napi(object))]
pub struct FeatureMap {
    pub id: String,
    pub feature_name: String,
    pub primary_files: Vec<String>,
    pub related_files: Vec<String>,
    pub dependencies: Vec<String>,
}

/// Blueprint analyzer for detecting project structure
#[cfg_attr(feature = "napi-bindings", napi)]
pub struct BlueprintAnalyzer;

impl Default for BlueprintAnalyzer {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg_attr(feature = "napi-bindings", napi)]
impl BlueprintAnalyzer {
    #[cfg_attr(feature = "napi-bindings", napi(constructor))]
    pub fn new() -> Self {
        BlueprintAnalyzer
    }

    /// Detect entry points using AST-based analysis and pattern matching
    #[cfg_attr(feature = "napi-bindings", napi)]
    pub async fn detect_entry_points(
        path: String,
        frameworks: Vec<FrameworkInfo>,
    ) -> Result<Vec<EntryPoint>, ParseError> {
        let mut entry_points = Vec::new();
        let framework_names: Vec<String> = frameworks.iter().map(|f| f.name.clone()).collect();

        // Check for common entry point file patterns first
        Self::check_entry_point_patterns(&path, &framework_names, &mut entry_points)?;

        // TODO: For v2, add AST-based detection to find programmatic entry points
        // (main functions, app.listen() calls, etc.)

        Ok(entry_points)
    }

    /// Check common entry point file patterns
    fn check_entry_point_patterns(
        project_path: &str,
        frameworks: &[String],
        entry_points: &mut Vec<EntryPoint>,
    ) -> Result<(), ParseError> {
        let path = Path::new(project_path);

        // React/Next.js entry points
        if frameworks.iter().any(|f| {
            let lower = f.to_lowercase();
            lower.contains("react") || lower.contains("next")
        }) {
            let react_entries = vec![
                "src/index.tsx", "src/index.jsx",
                "src/App.tsx", "src/App.jsx",
                "pages/_app.tsx", "pages/_app.js",
                "app/page.tsx", "app/layout.tsx" // Next.js 13+
            ];

            for entry in react_entries {
                let full_path = path.join(entry);
                if full_path.exists() {
                    entry_points.push(EntryPoint {
                        entry_type: "web".to_string(),
                        file_path: entry.to_string(),
                        framework: Some("react".to_string()),
                        confidence: 0.9,
                    });
                }
            }
        }

        // Express/Node API entry points
        if frameworks.iter().any(|f| {
            let lower = f.to_lowercase();
            lower.contains("express") || lower.contains("node")
        }) {
            let api_entries = vec![
                "server.js", "app.js", "index.js",
                "src/server.ts", "src/app.ts", "src/index.ts",
                "src/main.ts"
            ];

            for entry in api_entries {
                let full_path = path.join(entry);
                if full_path.exists() {
                    entry_points.push(EntryPoint {
                        entry_type: "api".to_string(),
                        file_path: entry.to_string(),
                        framework: Some("express".to_string()),
                        confidence: 0.85,
                    });
                }
            }
        }

        // Python entry points
        if frameworks.iter().any(|f| {
            let lower = f.to_lowercase();
            lower.contains("python") || lower.contains("fastapi") || lower.contains("flask") || lower.contains("django")
        }) {
            let python_entries = vec![
                "main.py", "app.py", "server.py",
                "api/main.py", "src/main.py",
                "manage.py" // Django
            ];

            for entry in python_entries {
                let full_path = path.join(entry);
                if full_path.exists() {
                    let framework_hint = if frameworks.iter().any(|f| f.to_lowercase().contains("fastapi")) {
                        Some("fastapi".to_string())
                    } else if frameworks.iter().any(|f| f.to_lowercase().contains("flask")) {
                        Some("flask".to_string())
                    } else if frameworks.iter().any(|f| f.to_lowercase().contains("django")) {
                        Some("django".to_string())
                    } else {
                        Some("python".to_string())
                    };

                    entry_points.push(EntryPoint {
                        entry_type: "api".to_string(),
                        file_path: entry.to_string(),
                        framework: framework_hint,
                        confidence: 0.85,
                    });
                }
            }
        }

        // Rust entry points
        if frameworks.iter().any(|f| f.to_lowercase().contains("rust")) {
            let rust_entries = vec!["src/main.rs", "src/lib.rs"];

            for entry in rust_entries {
                let full_path = path.join(entry);
                if full_path.exists() {
                    let entry_type = if entry.contains("main") { "cli" } else { "library" };
                    entry_points.push(EntryPoint {
                        entry_type: entry_type.to_string(),
                        file_path: entry.to_string(),
                        framework: Some("rust".to_string()),
                        confidence: 0.95,
                    });
                }
            }
        }

        // Go entry points
        if frameworks.iter().any(|f| f.to_lowercase().contains("go")) {
            let go_entries = vec!["main.go", "cmd/main.go", "cmd/server/main.go"];

            for entry in go_entries {
                let full_path = path.join(entry);
                if full_path.exists() {
                    entry_points.push(EntryPoint {
                        entry_type: "api".to_string(),
                        file_path: entry.to_string(),
                        framework: Some("go".to_string()),
                        confidence: 0.9,
                    });
                }
            }
        }

        // CLI entry points (language-agnostic)
        let cli_entries = vec!["cli.js", "bin/cli.js", "src/cli.ts", "src/cli.js"];
        for entry in cli_entries {
            let full_path = path.join(entry);
            if full_path.exists() {
                entry_points.push(EntryPoint {
                    entry_type: "cli".to_string(),
                    file_path: entry.to_string(),
                    framework: None,
                    confidence: 0.8,
                });
            }
        }

        Ok(())
    }

    /// Map key directories in the project
    #[cfg_attr(feature = "napi-bindings", napi)]
    pub async fn map_key_directories(path: String) -> Result<Vec<KeyDirectory>, ParseError> {
        let mut key_dirs = Vec::new();
        let project_path = Path::new(&path);

        let common_dirs = vec![
            ("src/components", "components"),
            ("src/utils", "utils"),
            ("src/services", "services"),
            ("src/api", "api"),
            ("src/auth", "auth"),
            ("src/models", "models"),
            ("src/views", "views"),
            ("src/pages", "pages"),
            ("src/lib", "library"),
            ("lib", "library"),
            ("utils", "utils"),
            ("middleware", "middleware"),
            ("routes", "routes"),
            ("controllers", "controllers"),
        ];

        for (dir_pattern, dir_type) in common_dirs {
            let full_path = project_path.join(dir_pattern);
            if full_path.exists() && full_path.is_dir() {
                let file_count = Self::count_files_in_directory(&full_path, 5, 0)?;
                key_dirs.push(KeyDirectory {
                    path: dir_pattern.to_string(),
                    dir_type: dir_type.to_string(),
                    file_count,
                });
            }
        }

        Ok(key_dirs)
    }

    /// Build feature map for the project
    #[cfg_attr(feature = "napi-bindings", napi)]
    pub async fn build_feature_map(path: String) -> Result<Vec<FeatureMap>, ParseError> {
        let mut feature_maps = Vec::new();
        let project_path = Path::new(&path);

        let feature_patterns: Vec<(&str, Vec<&str>)> = vec![
            ("authentication", vec!["auth", "authentication"]),
            ("api", vec!["api", "routes", "endpoints", "controllers"]),
            ("database", vec!["db", "database", "models", "schemas", "migrations", "storage"]),
            ("ui-components", vec!["components", "ui"]),
            ("views", vec!["views", "pages", "screens"]),
            ("services", vec!["services", "api-clients"]),
            ("utilities", vec!["utils", "helpers", "lib"]),
            ("testing", vec!["tests", "__tests__", "test"]),
            ("configuration", vec!["config", ".config", "settings"]),
            ("middleware", vec!["middleware", "middlewares"]),
            // Language/compiler-specific features for In-Memoria
            ("language-support", vec!["parsing", "parser", "ast", "tree-sitter", "compiler"]),
            ("rust-core", vec!["rust-core", "native", "bindings"]),
            ("mcp-server", vec!["mcp-server", "server", "mcp"]),
            ("cli", vec!["cli", "bin", "commands"]),
        ];

        for (feature_name, directories) in feature_patterns {
            let mut primary_files = Vec::new();
            let mut related_files = Vec::new();

            for dir in &directories {
                // Standard paths
                let src_path = project_path.join("src").join(dir);
                let alt_path = project_path.join(dir);

                // Nested paths for mono-repo/multi-module projects
                let rust_core_src_path = project_path.join("rust-core").join("src").join(dir);
                let rust_core_path = project_path.join("rust-core").join(dir);

                for check_path in &[src_path, alt_path, rust_core_src_path, rust_core_path] {
                    if check_path.exists() && check_path.is_dir() {
                        let files = Self::collect_files_in_directory(check_path, project_path, 5, 0)?;
                        if !files.is_empty() {
                            let mid_point = files.len().div_ceil(2);
                            primary_files.extend_from_slice(&files[0..mid_point]);
                            if mid_point < files.len() {
                                related_files.extend_from_slice(&files[mid_point..]);
                            }
                        }
                    }
                }
            }

            if !primary_files.is_empty() {
                // Deduplicate
                primary_files.sort();
                primary_files.dedup();
                related_files.sort();
                related_files.dedup();

                feature_maps.push(FeatureMap {
                    id: uuid::Uuid::new_v4().to_string(),
                    feature_name: feature_name.to_string(),
                    primary_files,
                    related_files,
                    dependencies: Vec::new(),
                });
            }
        }

        Ok(feature_maps)
    }

    /// Count files in directory with depth limit
    fn count_files_in_directory(dir_path: &Path, max_depth: u32, current_depth: u32) -> Result<u32, ParseError> {
        if current_depth >= max_depth {
            return Ok(0);
        }

        let mut count = 0;
        let entries = fs::read_dir(dir_path).map_err(|e| ParseError::from_reason(format!("Failed to read directory: {}", e)))?;

        for entry in entries.flatten() {
            let path = entry.path();
            let file_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");

            // Skip common ignore patterns
            if ["node_modules", ".git", "dist", "build", ".next", "__pycache__", "venv", "target"].contains(&file_name) {
                continue;
            }

            if path.is_dir() {
                count += Self::count_files_in_directory(&path, max_depth, current_depth + 1)?;
            } else if path.is_file() {
                count += 1;
            }
        }

        Ok(count)
    }

    /// Collect files from directory with depth limit
    fn collect_files_in_directory(
        dir_path: &Path,
        project_root: &Path,
        max_depth: u32,
        current_depth: u32,
    ) -> Result<Vec<String>, ParseError> {
        if current_depth >= max_depth {
            return Ok(Vec::new());
        }

        let mut files = Vec::new();
        let entries = fs::read_dir(dir_path).map_err(|e| ParseError::from_reason(format!("Failed to read directory: {}", e)))?;

        for entry in entries.flatten() {
            let path = entry.path();
            let file_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");

            // Skip common ignore patterns
            if ["node_modules", ".git", "dist", "build", ".next", "__pycache__", "venv", "target"].contains(&file_name) {
                continue;
            }

            if path.is_dir() {
                let nested = Self::collect_files_in_directory(&path, project_root, max_depth, current_depth + 1)?;
                files.extend(nested);
            } else if path.is_file() {
                // Only include source code files
                if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                    if ["ts", "tsx", "js", "jsx", "py", "rs", "go", "java", "c", "cpp", "cs"].contains(&ext) {
                        if let Ok(relative) = path.strip_prefix(project_root) {
                            files.push(relative.to_string_lossy().to_string());
                        }
                    }
                }
            }
        }

        Ok(files)
    }
}
