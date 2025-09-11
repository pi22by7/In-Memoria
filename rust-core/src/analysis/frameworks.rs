//! Framework detection and analysis

#[cfg(feature = "napi-bindings")]
use napi_derive::napi;

use crate::types::ParseError;
use std::collections::{HashMap, HashSet};
use std::path::Path;
use walkdir::WalkDir;
use std::fs;

/// Framework detection results
#[derive(Debug, Clone)]
#[cfg_attr(feature = "napi-bindings", napi(object))]
pub struct FrameworkInfo {
    pub name: String,
    pub version: Option<String>,
    pub confidence: f64,
    pub evidence: Vec<String>,
}

/// Analyzer for detecting frameworks and libraries used in a codebase
#[cfg_attr(feature = "napi-bindings", napi)]
pub struct FrameworkDetector;

#[cfg_attr(feature = "napi-bindings", napi)]
impl FrameworkDetector {
    #[cfg_attr(feature = "napi-bindings", napi(constructor))]
    pub fn new() -> Self {
        FrameworkDetector
    }

    /// Detect frameworks used in a codebase
    #[cfg_attr(feature = "napi-bindings", napi)]
    pub async fn detect_frameworks(path: String) -> Result<Vec<FrameworkInfo>, ParseError> {
        let path = path.as_str();
        let mut frameworks = Vec::new();
        let mut evidence_map: HashMap<String, (HashSet<String>, Option<String>)> = HashMap::new();

        // Check package files for dependencies
        Self::check_package_files(path, &mut evidence_map)?;
        
        // Infer frameworks from file extensions and project structure
        Self::infer_from_project_structure(path, &mut evidence_map)?;

        // Check configuration files
        Self::check_config_files(path, &mut evidence_map)?;

        // Convert evidence to framework info
        for (framework_name, (evidence_set, version)) in evidence_map {
            let confidence = Self::calculate_confidence(&framework_name, &evidence_set);
            if confidence > 0.3 { // Only include frameworks with reasonable confidence
                frameworks.push(FrameworkInfo {
                    name: framework_name,
                    version,
                    confidence,
                    evidence: evidence_set.into_iter().collect(),
                });
            }
        }

        // Sort by confidence
        frameworks.sort_by(|a, b| b.confidence.partial_cmp(&a.confidence).unwrap_or(std::cmp::Ordering::Equal));

        Ok(frameworks)
    }

    /// Check package files (package.json, Cargo.toml, requirements.txt, etc.)
    fn check_package_files(
        path: &str,
        evidence_map: &mut HashMap<String, (HashSet<String>, Option<String>)>,
    ) -> Result<(), ParseError> {
        let package_files = [
            "package.json",
            "Cargo.toml",
            "requirements.txt",
            "Pipfile",
            "pom.xml",
            "build.gradle",
            "go.mod",
            "composer.json",
            "Gemfile",
            "mix.exs",
        ];

        for entry in WalkDir::new(path).max_depth(3).into_iter().filter_map(|e| e.ok()) {
            let file_path = entry.path();
            if let Some(file_name) = file_path.file_name().and_then(|n| n.to_str()) {
                if package_files.contains(&file_name) {
                    Self::analyze_package_file(file_path, evidence_map)?;
                }
            }
        }

        Ok(())
    }

    /// Analyze a specific package file
    fn analyze_package_file(
        file_path: &Path,
        evidence_map: &mut HashMap<String, (HashSet<String>, Option<String>)>,
    ) -> Result<(), ParseError> {
        let content = fs::read_to_string(file_path)
            .map_err(|e| ParseError::from_reason(format!("Failed to read package file: {}", e)))?;

        let file_name = file_path.file_name().unwrap_or_default().to_str().unwrap_or("");

        match file_name {
            "package.json" => Self::parse_package_json(&content, evidence_map),
            "Cargo.toml" => Self::parse_cargo_toml(&content, evidence_map),
            "requirements.txt" => Self::parse_requirements_txt(&content, evidence_map),
            "pom.xml" => Self::parse_maven_pom(&content, evidence_map),
            "go.mod" => Self::parse_go_mod(&content, evidence_map),
            _ => {}
        }

        Ok(())
    }

    /// Parse package.json for JavaScript/TypeScript dependencies
    fn parse_package_json(content: &str, evidence_map: &mut HashMap<String, (HashSet<String>, Option<String>)>) {
        // Simple JSON parsing for common frameworks
        let framework_patterns = [
            ("React", vec!["\"react\":", "\"@types/react\":"]),
            ("Vue.js", vec!["\"vue\":", "\"@vue/"]),
            ("Angular", vec!["\"@angular/"]),
            ("Express", vec!["\"express\":", "\"@types/express\":"]),
            ("Next.js", vec!["\"next\":", "\"@next/"]),
            ("Svelte", vec!["\"svelte\":", "\"@svelte/"]),
            ("Webpack", vec!["\"webpack\":"]),
            ("Vite", vec!["\"vite\":", "\"@vitejs/"]),
            ("Jest", vec!["\"jest\":", "\"@jest/"]),
            ("TypeScript", vec!["\"typescript\":"]),
            ("Tailwind CSS", vec!["\"tailwindcss\":", "\"@tailwindcss/"]),
            ("Material-UI", vec!["\"@mui/", "\"@material-ui/"]),
            ("Lodash", vec!["\"lodash\":", "\"@types/lodash\":"]),
        ];

        for (framework, patterns) in &framework_patterns {
            for pattern in patterns {
                if content.contains(pattern) {
                    let entry = evidence_map.entry(framework.to_string()).or_insert_with(|| (HashSet::new(), None));
                    entry.0.insert(format!("package.json dependency: {}", pattern));
                    
                    // Try to extract version
                    if let Some(version) = Self::extract_version_from_json(content, pattern) {
                        entry.1 = Some(version);
                    }
                }
            }
        }
    }

    /// Parse Cargo.toml for Rust dependencies
    fn parse_cargo_toml(content: &str, evidence_map: &mut HashMap<String, (HashSet<String>, Option<String>)>) {
        let framework_patterns = [
            ("Tokio", vec!["tokio =", "tokio."]),
            ("Serde", vec!["serde =", "serde_"]),
            ("Actix Web", vec!["actix-web =", "actix_"]),
            ("Rocket", vec!["rocket =", "rocket_"]),
            ("Diesel", vec!["diesel =", "diesel_"]),
            ("SQLx", vec!["sqlx =", "sqlx-"]),
            ("Clap", vec!["clap =", "structopt ="]),
            ("Reqwest", vec!["reqwest ="]),
            ("Tree-sitter", vec!["tree-sitter", "tree_sitter"]),
        ];

        for (framework, patterns) in &framework_patterns {
            for pattern in patterns {
                if content.contains(pattern) {
                    let entry = evidence_map.entry(framework.to_string()).or_insert_with(|| (HashSet::new(), None));
                    entry.0.insert(format!("Cargo.toml dependency: {}", pattern));
                    
                    // Try to extract version
                    if let Some(version) = Self::extract_version_from_toml(content, pattern) {
                        entry.1 = Some(version);
                    }
                }
            }
        }
    }

    /// Parse requirements.txt for Python dependencies
    fn parse_requirements_txt(content: &str, evidence_map: &mut HashMap<String, (HashSet<String>, Option<String>)>) {
        let framework_patterns = [
            ("Django", "django"),
            ("Flask", "flask"),
            ("FastAPI", "fastapi"),
            ("NumPy", "numpy"),
            ("Pandas", "pandas"),
            ("Matplotlib", "matplotlib"),
            ("SQLAlchemy", "sqlalchemy"),
            ("Requests", "requests"),
            ("PyTorch", "torch"),
            ("TensorFlow", "tensorflow"),
        ];

        for (framework, pattern) in &framework_patterns {
            if content.to_lowercase().contains(&pattern.to_lowercase()) {
                let entry = evidence_map.entry(framework.to_string()).or_insert_with(|| (HashSet::new(), None));
                entry.0.insert(format!("requirements.txt dependency: {}", pattern));
                
                // Try to extract version
                if let Some(version) = Self::extract_version_from_requirements(content, pattern) {
                    entry.1 = Some(version);
                }
            }
        }
    }

    /// Parse Maven pom.xml for Java dependencies
    fn parse_maven_pom(content: &str, evidence_map: &mut HashMap<String, (HashSet<String>, Option<String>)>) {
        let framework_patterns = [
            ("Spring Framework", vec!["<groupId>org.springframework", "<artifactId>spring-"]),
            ("Spring Boot", vec!["spring-boot-starter", "spring-boot-parent"]),
            ("Hibernate", vec!["<artifactId>hibernate"]),
            ("JUnit", vec!["<artifactId>junit", "<groupId>org.junit"]),
            ("Apache Commons", vec!["<groupId>org.apache.commons"]),
            ("Jackson", vec!["<groupId>com.fasterxml.jackson"]),
        ];

        for (framework, patterns) in &framework_patterns {
            for pattern in patterns {
                if content.contains(pattern) {
                    let entry = evidence_map.entry(framework.to_string()).or_insert_with(|| (HashSet::new(), None));
                    entry.0.insert(format!("pom.xml dependency: {}", pattern));
                }
            }
        }
    }

    /// Parse go.mod for Go dependencies
    fn parse_go_mod(content: &str, evidence_map: &mut HashMap<String, (HashSet<String>, Option<String>)>) {
        let framework_patterns = [
            ("Gin", "github.com/gin-gonic/gin"),
            ("Echo", "github.com/labstack/echo"),
            ("Fiber", "github.com/gofiber/fiber"),
            ("GORM", "gorm.io/gorm"),
            ("Cobra", "github.com/spf13/cobra"),
            ("Viper", "github.com/spf13/viper"),
        ];

        for (framework, pattern) in &framework_patterns {
            if content.contains(pattern) {
                let entry = evidence_map.entry(framework.to_string()).or_insert_with(|| (HashSet::new(), None));
                entry.0.insert(format!("go.mod dependency: {}", pattern));
            }
        }
    }

    /// Check source code for framework usage patterns
    fn infer_from_project_structure(
        path: &str,
        evidence_map: &mut HashMap<String, (HashSet<String>, Option<String>)>,
    ) -> Result<(), ParseError> {
        let mut extension_counts = std::collections::HashMap::new();
        
        for entry in WalkDir::new(path).into_iter().filter_map(|e| e.ok()) {
            if entry.file_type().is_file() {
                let file_path = entry.path();
                
                // Skip files in dot folders and common build/dependency directories
                if file_path.components().any(|component| {
                    let comp_str = component.as_os_str().to_str().unwrap_or("");
                    (comp_str.starts_with('.') && comp_str != ".") 
                        || comp_str == "node_modules"
                        || comp_str == "target"
                        || comp_str == "dist"
                        || comp_str == "build"
                }) {
                    continue;
                }
                
                if let Some(extension) = file_path.extension().and_then(|s| s.to_str()) {
                    *extension_counts.entry(extension.to_lowercase()).or_insert(0) += 1;
                }
            }
        }
        
        // Infer languages/frameworks based on significant file presence
        for (ext, count) in extension_counts {
            if count >= 5 { // Only consider if there are at least 5 files of this type
                match ext.as_str() {
                    "rs" => {
                        let entry = evidence_map.entry("Rust".to_string()).or_insert_with(|| (HashSet::new(), None));
                        entry.0.insert(format!("Project structure: {} Rust files", count));
                    }
                    "ts" | "tsx" => {
                        let entry = evidence_map.entry("TypeScript".to_string()).or_insert_with(|| (HashSet::new(), None));
                        entry.0.insert(format!("Project structure: {} TypeScript files", count));
                    }
                    "js" | "jsx" => {
                        let entry = evidence_map.entry("JavaScript".to_string()).or_insert_with(|| (HashSet::new(), None));
                        entry.0.insert(format!("Project structure: {} JavaScript files", count));
                    }
                    "py" => {
                        let entry = evidence_map.entry("Python".to_string()).or_insert_with(|| (HashSet::new(), None));
                        entry.0.insert(format!("Project structure: {} Python files", count));
                    }
                    "java" => {
                        let entry = evidence_map.entry("Java".to_string()).or_insert_with(|| (HashSet::new(), None));
                        entry.0.insert(format!("Project structure: {} Java files", count));
                    }
                    "go" => {
                        let entry = evidence_map.entry("Go".to_string()).or_insert_with(|| (HashSet::new(), None));
                        entry.0.insert(format!("Project structure: {} Go files", count));
                    }
                    _ => {}
                }
            }
        }

        Ok(())
    }


    /// Check configuration files for framework indicators
    fn check_config_files(
        path: &str,
        evidence_map: &mut HashMap<String, (HashSet<String>, Option<String>)>,
    ) -> Result<(), ParseError> {
        let config_files = [
            ("webpack.config.js", "Webpack"),
            ("vite.config.js", "Vite"),
            ("next.config.js", "Next.js"),
            ("nuxt.config.js", "Nuxt.js"),
            ("vue.config.js", "Vue.js"),
            ("angular.json", "Angular"),
            ("tsconfig.json", "TypeScript"),
            ("tailwind.config.js", "Tailwind CSS"),
            ("jest.config.js", "Jest"),
            ("vitest.config.js", "Vitest"),
            ("svelte.config.js", "Svelte"),
        ];

        for entry in WalkDir::new(path).max_depth(3).into_iter().filter_map(|e| e.ok()) {
            let file_path = entry.path();
            if let Some(file_name) = file_path.file_name().and_then(|n| n.to_str()) {
                for (config_file, framework) in &config_files {
                    if file_name == *config_file {
                        let entry = evidence_map.entry(framework.to_string()).or_insert_with(|| (HashSet::new(), None));
                        entry.0.insert(format!("Configuration file: {}", config_file));
                    }
                }
            }
        }

        Ok(())
    }

    /// Calculate confidence score based on evidence
    fn calculate_confidence(_framework: &str, evidence: &HashSet<String>) -> f64 {
        let evidence_count = evidence.len() as f64;
        let base_confidence = (evidence_count * 0.2).min(1.0);

        // Boost confidence for certain types of evidence
        let mut boosted_confidence = base_confidence;
        
        for evidence_item in evidence {
            if evidence_item.contains("package.json") || evidence_item.contains("Cargo.toml") {
                boosted_confidence += 0.3;
            } else if evidence_item.contains("Configuration file") {
                boosted_confidence += 0.2;
            } else if evidence_item.contains("Project structure") {
                boosted_confidence += 0.2; // Boost confidence for project structure evidence
            } else if evidence_item.contains("Source code usage") {
                boosted_confidence += 0.1;
            }
        }

        boosted_confidence.min(1.0)
    }

    /// Extract version from JSON dependency
    fn extract_version_from_json(content: &str, pattern: &str) -> Option<String> {
        // Simple regex-like extraction - in practice you'd use a proper JSON parser
        if let Some(start) = content.find(pattern) {
            if let Some(version_start) = content[start..].find(": \"") {
                let version_content = &content[start + version_start + 3..];
                if let Some(version_end) = version_content.find('"') {
                    let version = &version_content[..version_end];
                    if !version.is_empty() && version != "latest" {
                        return Some(version.to_string());
                    }
                }
            }
        }
        None
    }

    /// Extract version from TOML dependency
    fn extract_version_from_toml(content: &str, pattern: &str) -> Option<String> {
        if let Some(start) = content.find(pattern) {
            if let Some(version_start) = content[start..].find(" = \"") {
                let version_content = &content[start + version_start + 4..];
                if let Some(version_end) = version_content.find('"') {
                    let version = &version_content[..version_end];
                    if !version.is_empty() {
                        return Some(version.to_string());
                    }
                }
            }
        }
        None
    }

    /// Extract version from requirements.txt
    fn extract_version_from_requirements(content: &str, pattern: &str) -> Option<String> {
        for line in content.lines() {
            if line.to_lowercase().contains(&pattern.to_lowercase()) {
                if let Some(version_start) = line.find("==") {
                    let version = &line[version_start + 2..].trim();
                    if !version.is_empty() {
                        return Some(version.to_string());
                    }
                } else if let Some(version_start) = line.find(">=") {
                    let version = &line[version_start + 2..].trim();
                    if !version.is_empty() {
                        return Some(format!(">={}",  version));
                    }
                }
            }
        }
        None
    }
}

impl Default for FrameworkDetector {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::io::Write;
    use tempfile::TempDir;

    fn create_test_file(dir: &TempDir, path: &str, content: &str) -> std::io::Result<()> {
        let full_path = dir.path().join(path);
        if let Some(parent) = full_path.parent() {
            fs::create_dir_all(parent)?;
        }
        let mut file = fs::File::create(full_path)?;
        file.write_all(content.as_bytes())?;
        Ok(())
    }

    #[test]
    fn test_framework_detector_creation() {
        let _detector = FrameworkDetector::new();
        assert!(true); // Constructor should work
    }

    #[tokio::test]
    async fn test_detect_react_from_package_json() {
        let temp_dir = TempDir::new().unwrap();
        let package_json = r#"{
            "dependencies": {
                "react": "^18.0.0",
                "@types/react": "^18.0.0"
            }
        }"#;

        create_test_file(&temp_dir, "package.json", package_json).unwrap();

        let frameworks = FrameworkDetector::detect_frameworks(temp_dir.path().to_str().unwrap().to_string()).await.unwrap();
        
        assert!(frameworks.iter().any(|f| f.name == "React"));
        assert!(frameworks.iter().any(|f| f.name == "TypeScript"));
    }

    #[tokio::test]
    async fn test_detect_rust_frameworks() {
        let temp_dir = TempDir::new().unwrap();
        let cargo_toml = r#"[dependencies]
tokio = "1.0"
serde = { version = "1.0", features = ["derive"] }
"#;

        create_test_file(&temp_dir, "Cargo.toml", cargo_toml).unwrap();

        let frameworks = FrameworkDetector::detect_frameworks(temp_dir.path().to_str().unwrap().to_string()).await.unwrap();
        
        assert!(frameworks.iter().any(|f| f.name == "Tokio"));
        assert!(frameworks.iter().any(|f| f.name == "Serde"));
    }

    #[tokio::test]
    async fn test_detect_python_frameworks() {
        let temp_dir = TempDir::new().unwrap();
        let requirements = "django==4.2.0\nflask>=2.0.0\nnumpy\n";

        create_test_file(&temp_dir, "requirements.txt", requirements).unwrap();

        let frameworks = FrameworkDetector::detect_frameworks(temp_dir.path().to_str().unwrap().to_string()).await.unwrap();
        
        assert!(frameworks.iter().any(|f| f.name == "Django"));
        assert!(frameworks.iter().any(|f| f.name == "Flask"));
        assert!(frameworks.iter().any(|f| f.name == "NumPy"));
    }

    #[tokio::test]
    async fn test_detect_from_source_code() {
        let temp_dir = TempDir::new().unwrap();
        let react_code = r#"import React, { useState } from 'react';

function App() {
    const [count, setCount] = useState(0);
    return <div>{count}</div>;
}
"#;

        create_test_file(&temp_dir, "src/App.js", react_code).unwrap();

        let frameworks = FrameworkDetector::detect_frameworks(temp_dir.path().to_str().unwrap().to_string()).await.unwrap();
        
        assert!(frameworks.iter().any(|f| f.name == "React"));
    }

    #[tokio::test]
    async fn test_detect_from_config_files() {
        let temp_dir = TempDir::new().unwrap();
        
        create_test_file(&temp_dir, "webpack.config.js", "module.exports = {};").unwrap();
        create_test_file(&temp_dir, "tsconfig.json", "{}").unwrap();

        let frameworks = FrameworkDetector::detect_frameworks(temp_dir.path().to_str().unwrap().to_string()).await.unwrap();
        
        assert!(frameworks.iter().any(|f| f.name == "Webpack"));
        assert!(frameworks.iter().any(|f| f.name == "TypeScript"));
    }

    #[test]
    fn test_calculate_confidence() {
        let mut evidence = HashSet::new();
        evidence.insert("package.json dependency: react".to_string());
        evidence.insert("Source code usage: useState(".to_string());
        
        let confidence = FrameworkDetector::calculate_confidence("React", &evidence);
        assert!(confidence > 0.5);
        assert!(confidence <= 1.0);
    }

    #[test]
    fn test_version_extraction() {
        let json_content = r#"{"dependencies": {"react": "^18.2.0"}}"#;
        let version = FrameworkDetector::extract_version_from_json(json_content, "\"react\":");
        assert_eq!(version, Some("^18.2.0".to_string()));

        let toml_content = r#"tokio = "1.28.0""#;
        let version = FrameworkDetector::extract_version_from_toml(toml_content, "tokio =");
        assert_eq!(version, Some("1.28.0".to_string()));

        let req_content = "django==4.2.0\nflask>=2.0.0";
        let version = FrameworkDetector::extract_version_from_requirements(req_content, "django");
        assert_eq!(version, Some("4.2.0".to_string()));
    }
}