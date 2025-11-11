//! Relationship analysis and learning between semantic concepts

#[cfg(feature = "napi-bindings")]
use napi_derive::napi;

use crate::types::SemanticConcept;
use std::collections::HashMap;

/// Analyzer for learning and discovering relationships between code concepts
#[cfg_attr(feature = "napi-bindings", napi)]
pub struct RelationshipLearner;

#[cfg_attr(feature = "napi-bindings", napi)]
impl RelationshipLearner {
    #[cfg_attr(feature = "napi-bindings", napi(constructor))]
    pub fn new() -> Self {
        RelationshipLearner
    }

    /// Learn relationships between concepts and update the relationships map
    pub fn learn_concept_relationships(
        concepts: &Vec<SemanticConcept>,
        relationships: &mut HashMap<String, Vec<String>>,
    ) {
        Self::analyze_spatial_relationships(concepts, relationships);
        Self::analyze_naming_relationships(concepts, relationships);
        Self::analyze_type_relationships(concepts, relationships);
        Self::analyze_file_relationships(concepts, relationships);
    }

    /// Analyze relationships based on proximity in source code
    fn analyze_spatial_relationships(
        concepts: &Vec<SemanticConcept>,
        relationships: &mut HashMap<String, Vec<String>>,
    ) {
        // Group concepts by file for spatial analysis
        let mut file_concepts: HashMap<String, Vec<&SemanticConcept>> = HashMap::new();
        
        for concept in concepts {
            file_concepts
                .entry(concept.file_path.clone())
                .or_default()
                .push(concept);
        }

        // Analyze spatial relationships within each file
        for concepts_in_file in file_concepts.values() {
            for (i, concept1) in concepts_in_file.iter().enumerate() {
                for concept2 in concepts_in_file.iter().skip(i + 1) {
                    let distance = Self::calculate_line_distance(concept1, concept2);
                    
                    // Consider concepts close if within 10 lines
                    if distance <= 10 {
                        Self::add_relationship(
                            relationships,
                            &concept1.id,
                            &concept2.id,
                            "spatial_proximity",
                        );
                        Self::add_relationship(
                            relationships,
                            &concept2.id,
                            &concept1.id,
                            "spatial_proximity",
                        );
                    }
                }
            }
        }
    }

    /// Analyze relationships based on naming patterns
    fn analyze_naming_relationships(
        concepts: &Vec<SemanticConcept>,
        relationships: &mut HashMap<String, Vec<String>>,
    ) {
        for concept1 in concepts {
            for concept2 in concepts {
                if concept1.id == concept2.id {
                    continue;
                }

                let similarity = Self::calculate_name_similarity(&concept1.name, &concept2.name);
                
                // Consider names similar if they share significant prefixes/suffixes
                if similarity > 0.6 {
                    Self::add_relationship(
                        relationships,
                        &concept1.id,
                        &concept2.id,
                        "naming_similarity",
                    );
                }

                // Check for common naming patterns
                if Self::has_naming_relationship(&concept1.name, &concept2.name) {
                    Self::add_relationship(
                        relationships,
                        &concept1.id,
                        &concept2.id,
                        "naming_pattern",
                    );
                }
            }
        }
    }

    /// Analyze relationships based on concept types
    fn analyze_type_relationships(
        concepts: &Vec<SemanticConcept>,
        relationships: &mut HashMap<String, Vec<String>>,
    ) {
        // Group concepts by type
        let mut type_groups: HashMap<String, Vec<&SemanticConcept>> = HashMap::new();
        
        for concept in concepts {
            type_groups
                .entry(concept.concept_type.clone())
                .or_default()
                .push(concept);
        }

        // Analyze relationships within type groups
        for (_concept_type, group_concepts) in type_groups {
            for (i, concept1) in group_concepts.iter().enumerate() {
                for concept2 in group_concepts.iter().skip(i + 1) {
                    Self::add_relationship(
                        relationships,
                        &concept1.id,
                        &concept2.id,
                        "same_type",
                    );
                    Self::add_relationship(
                        relationships,
                        &concept2.id,
                        &concept1.id,
                        "same_type",
                    );
                }
            }
        }

        // Analyze cross-type relationships (e.g., functions in classes)
        Self::analyze_cross_type_relationships(concepts, relationships);
    }

    /// Analyze relationships between different concept types
    fn analyze_cross_type_relationships(
        concepts: &Vec<SemanticConcept>,
        relationships: &mut HashMap<String, Vec<String>>,
    ) {
        for concept in concepts {
            match concept.concept_type.as_str() {
                "function" | "method" => {
                    // Look for classes or interfaces this function might belong to
                    for other_concept in concepts {
                        if (other_concept.concept_type == "class" || other_concept.concept_type == "interface") && Self::is_function_in_class(concept, other_concept) {
                            Self::add_relationship(
                                relationships,
                                &concept.id,
                                &other_concept.id,
                                "member_of",
                            );
                            Self::add_relationship(
                                relationships,
                                &other_concept.id,
                                &concept.id,
                                "contains",
                            );
                        }
                    }
                }
                "variable" | "field" => {
                    // Look for functions or classes this variable might belong to
                    for other_concept in concepts {
                        if (other_concept.concept_type == "function" || other_concept.concept_type == "class") && Self::is_variable_in_scope(concept, other_concept) {
                            Self::add_relationship(
                                relationships,
                                &concept.id,
                                &other_concept.id,
                                "scoped_in",
                            );
                        }
                    }
                }
                _ => {}
            }
        }
    }

    /// Analyze relationships based on file organization
    fn analyze_file_relationships(
        concepts: &Vec<SemanticConcept>,
        relationships: &mut HashMap<String, Vec<String>>,
    ) {
        // Group concepts by file
        let mut file_groups: HashMap<String, Vec<&SemanticConcept>> = HashMap::new();
        
        for concept in concepts {
            file_groups
                .entry(concept.file_path.clone())
                .or_default()
                .push(concept);
        }

        // Analyze relationships within files
        for concepts_in_file in file_groups.values() {
            for (i, concept1) in concepts_in_file.iter().enumerate() {
                for concept2 in concepts_in_file.iter().skip(i + 1) {
                    Self::add_relationship(
                        relationships,
                        &concept1.id,
                        &concept2.id,
                        "same_file",
                    );
                }
            }
        }

        // Analyze cross-file relationships based on import/export patterns
        Self::analyze_import_relationships(&file_groups, relationships);
    }

    /// Analyze import/export relationships between files
    fn analyze_import_relationships(
        file_groups: &HashMap<String, Vec<&SemanticConcept>>,
        relationships: &mut HashMap<String, Vec<String>>,
    ) {
        // This is a simplified analysis - in practice, you'd parse import statements
        for (file1, concepts1) in file_groups {
            for (file2, concepts2) in file_groups {
                if file1 == file2 {
                    continue;
                }

                // Look for potential import relationships based on naming
                for concept1 in concepts1 {
                    for concept2 in concepts2 {
                        if (concept1.concept_type == "class" || concept1.concept_type == "interface") && concept2.metadata.contains_key("imports") {
                            if let Some(imports) = concept2.metadata.get("imports") {
                                if imports.contains(&concept1.name) {
                                    Self::add_relationship(
                                        relationships,
                                        &concept2.id,
                                        &concept1.id,
                                        "imports",
                                    );
                                    Self::add_relationship(
                                        relationships,
                                        &concept1.id,
                                        &concept2.id,
                                        "imported_by",
                                    );
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    /// Calculate distance between concepts in lines
    fn calculate_line_distance(concept1: &SemanticConcept, concept2: &SemanticConcept) -> u32 {
        if concept1.file_path != concept2.file_path {
            return u32::MAX; // Different files have infinite distance
        }

        let start1 = concept1.line_range.start;
        let end1 = concept1.line_range.end;
        let start2 = concept2.line_range.start;
        let end2 = concept2.line_range.end;

        if end1 < start2 {
            start2 - end1
        } else if end2 < start1 {
            start1.saturating_sub(end2)
        } else {
            0 // Overlapping ranges
        }
    }

    /// Calculate similarity between two names
    fn calculate_name_similarity(name1: &str, name2: &str) -> f64 {
        if name1 == name2 {
            return 1.0;
        }

        let len1 = name1.len();
        let len2 = name2.len();
        let max_len = len1.max(len2);
        
        if max_len == 0 {
            return 1.0;
        }

        // Simple longest common subsequence similarity
        let common = Self::longest_common_subsequence(name1, name2);
        common as f64 / max_len as f64
    }

    /// Calculate longest common subsequence length
    fn longest_common_subsequence(s1: &str, s2: &str) -> usize {
        let chars1: Vec<char> = s1.chars().collect();
        let chars2: Vec<char> = s2.chars().collect();
        let len1 = chars1.len();
        let len2 = chars2.len();

        let mut dp = vec![vec![0; len2 + 1]; len1 + 1];

        for i in 1..=len1 {
            for j in 1..=len2 {
                if chars1[i - 1] == chars2[j - 1] {
                    dp[i][j] = dp[i - 1][j - 1] + 1;
                } else {
                    dp[i][j] = dp[i - 1][j].max(dp[i][j - 1]);
                }
            }
        }

        dp[len1][len2]
    }

    /// Check if two names have a naming relationship (e.g., getter/setter)
    fn has_naming_relationship(name1: &str, name2: &str) -> bool {
        let name1_lower = name1.to_lowercase();
        let name2_lower = name2.to_lowercase();

        // Check for getter/setter patterns
        if name1_lower.starts_with("get") && name2_lower.starts_with("set") {
            let suffix1 = &name1_lower[3..];
            let suffix2 = &name2_lower[3..];
            return suffix1 == suffix2;
        }

        // Check for test/implementation patterns
        if name1_lower.contains("test") || name2_lower.contains("test") {
            let clean1 = name1_lower.replace("test", "");
            let clean2 = name2_lower.replace("test", "");
            return clean1 == clean2 || clean1.is_empty() || clean2.is_empty();
        }

        false
    }

    /// Check if a function is likely a member of a class
    fn is_function_in_class(function: &SemanticConcept, class: &SemanticConcept) -> bool {
        // Same file check
        if function.file_path != class.file_path {
            return false;
        }

        // Check if function is within class line range (with some tolerance)
        function.line_range.start >= class.line_range.start 
            && function.line_range.end <= class.line_range.end + 5
    }

    /// Check if a variable is in scope of another concept
    fn is_variable_in_scope(variable: &SemanticConcept, scope: &SemanticConcept) -> bool {
        // Same file check
        if variable.file_path != scope.file_path {
            return false;
        }

        // Check if variable is within scope line range
        variable.line_range.start >= scope.line_range.start 
            && variable.line_range.end <= scope.line_range.end
    }

    /// Add a relationship to the relationships map
    fn add_relationship(
        relationships: &mut HashMap<String, Vec<String>>,
        from_id: &str,
        to_id: &str,
        relationship_type: &str,
    ) {
        let entry = relationships.entry(from_id.to_string()).or_default();
        let relationship = format!("{}:{}", relationship_type, to_id);
        if !entry.contains(&relationship) {
            entry.push(relationship);
        }
    }
}

impl Default for RelationshipLearner {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::LineRange;

    fn create_test_concept(
        id: &str,
        name: &str,
        concept_type: &str,
        file_path: &str,
        start: u32,
        end: u32,
    ) -> SemanticConcept {
        SemanticConcept {
            id: id.to_string(),
            name: name.to_string(),
            concept_type: concept_type.to_string(),
            confidence: 0.8,
            file_path: file_path.to_string(),
            line_range: LineRange { start, end },
            relationships: HashMap::new(),
            metadata: HashMap::new(),
        }
    }

    #[test]
    fn test_relationship_learner_creation() {
        let _learner = RelationshipLearner::new();
        // Constructor should work
    }

    #[test]
    fn test_spatial_relationships() {
        let concepts = vec![
            create_test_concept("1", "func1", "function", "test.rs", 1, 5),
            create_test_concept("2", "func2", "function", "test.rs", 8, 12),
            create_test_concept("3", "func3", "function", "test.rs", 50, 60),
        ];

        let mut relationships = HashMap::new();
        RelationshipLearner::learn_concept_relationships(&concepts, &mut relationships);

        // func1 and func2 should be spatially related (within 10 lines)
        assert!(relationships.contains_key("1"));
        assert!(relationships.contains_key("2"));
        
        let func1_rels = relationships.get("1").unwrap();
        assert!(func1_rels.iter().any(|r| r.contains("spatial_proximity:2")));
    }

    #[test]
    fn test_naming_relationships() {
        let concepts = vec![
            create_test_concept("1", "getUserName", "function", "test.rs", 1, 5),
            create_test_concept("2", "setUserName", "function", "test.rs", 10, 15),
            create_test_concept("3", "getData", "function", "test.rs", 20, 25),
        ];

        let mut relationships = HashMap::new();
        RelationshipLearner::learn_concept_relationships(&concepts, &mut relationships);

        // getUserName and setUserName should have naming relationship
        let get_rels = relationships.get("1").unwrap();
        assert!(get_rels.iter().any(|r| r.contains("naming_pattern:2")));
    }

    #[test]
    fn test_type_relationships() {
        let concepts = vec![
            create_test_concept("1", "func1", "function", "test.rs", 1, 5),
            create_test_concept("2", "func2", "function", "test.rs", 10, 15),
            create_test_concept("3", "Class1", "class", "test.rs", 20, 30),
        ];

        let mut relationships = HashMap::new();
        RelationshipLearner::learn_concept_relationships(&concepts, &mut relationships);

        // Functions should be related by same type
        let func1_rels = relationships.get("1").unwrap();
        assert!(func1_rels.iter().any(|r| r.contains("same_type:2")));
    }

    #[test]
    fn test_cross_type_relationships() {
        let concepts = vec![
            create_test_concept("1", "TestClass", "class", "test.rs", 1, 30),
            create_test_concept("2", "method1", "function", "test.rs", 5, 10),
            create_test_concept("3", "field1", "variable", "test.rs", 15, 15),
        ];

        let mut relationships = HashMap::new();
        RelationshipLearner::learn_concept_relationships(&concepts, &mut relationships);

        // Method should be member of class
        let method_rels = relationships.get("2").unwrap();
        assert!(method_rels.iter().any(|r| r.contains("member_of:1")));

        // Class should contain method
        let class_rels = relationships.get("1").unwrap();
        assert!(class_rels.iter().any(|r| r.contains("contains:2")));
    }

    #[test]
    fn test_calculate_line_distance() {
        let concept1 = create_test_concept("1", "func1", "function", "test.rs", 1, 5);
        let concept2 = create_test_concept("2", "func2", "function", "test.rs", 10, 15);
        let concept3 = create_test_concept("3", "func3", "function", "other.rs", 1, 5);

        assert_eq!(RelationshipLearner::calculate_line_distance(&concept1, &concept2), 5);
        assert_eq!(RelationshipLearner::calculate_line_distance(&concept1, &concept3), u32::MAX);
    }

    #[test]
    fn test_name_similarity() {
        assert_eq!(RelationshipLearner::calculate_name_similarity("test", "test"), 1.0);
        assert!(RelationshipLearner::calculate_name_similarity("test", "testing") > 0.7);
        assert!(RelationshipLearner::calculate_name_similarity("abc", "xyz") < 0.3);
    }

    #[test]
    fn test_naming_patterns() {
        assert!(RelationshipLearner::has_naming_relationship("getName", "setName"));
        assert!(RelationshipLearner::has_naming_relationship("testFunction", "function"));
        assert!(!RelationshipLearner::has_naming_relationship("foo", "bar"));
    }

    #[test]
    fn test_function_in_class_detection() {
        let class = create_test_concept("1", "TestClass", "class", "test.rs", 1, 30);
        let method_inside = create_test_concept("2", "method1", "function", "test.rs", 5, 10);
        let method_outside = create_test_concept("3", "method2", "function", "test.rs", 35, 40);

        assert!(RelationshipLearner::is_function_in_class(&method_inside, &class));
        assert!(!RelationshipLearner::is_function_in_class(&method_outside, &class));
    }
}