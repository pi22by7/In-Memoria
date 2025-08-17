-- Persistent intelligence storage schema for In Memoria

-- Semantic concepts extracted from codebase
CREATE TABLE IF NOT EXISTS semantic_concepts (
  id TEXT PRIMARY KEY,
  concept_name TEXT NOT NULL,
  concept_type TEXT NOT NULL, -- 'class', 'function', 'interface', 'module', 'pattern'
  confidence_score REAL DEFAULT 0.0,
  relationships TEXT, -- JSON: linked concepts and their relationship types
  evolution_history TEXT, -- JSON: how concept has changed over time
  file_path TEXT,
  line_range TEXT, -- JSON: start and end line numbers
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Developer-specific coding patterns learned over time
CREATE TABLE IF NOT EXISTS developer_patterns (
  pattern_id TEXT PRIMARY KEY,
  pattern_type TEXT NOT NULL, -- 'naming', 'structure', 'implementation', 'style', 'testing'
  pattern_content TEXT NOT NULL, -- JSON: detailed pattern specification
  frequency INTEGER DEFAULT 1,
  contexts TEXT, -- JSON: contexts where pattern is used
  examples TEXT, -- JSON: code examples demonstrating pattern
  confidence REAL DEFAULT 0.0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Architectural decisions and their reasoning
CREATE TABLE IF NOT EXISTS architectural_decisions (
  decision_id TEXT PRIMARY KEY,
  decision_context TEXT NOT NULL,
  decision_rationale TEXT,
  alternatives_considered TEXT, -- JSON
  impact_analysis TEXT, -- JSON
  decision_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  files_affected TEXT, -- JSON: list of affected files
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Per-file intelligence and analysis results
CREATE TABLE IF NOT EXISTS file_intelligence (
  file_path TEXT PRIMARY KEY,
  file_hash TEXT NOT NULL,
  semantic_concepts TEXT, -- JSON: concepts found in this file
  patterns_used TEXT, -- JSON: patterns detected in this file
  complexity_metrics TEXT, -- JSON: various complexity measurements
  dependencies TEXT, -- JSON: file dependencies
  last_analyzed DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Cross-project pattern sharing and community insights
CREATE TABLE IF NOT EXISTS shared_patterns (
  pattern_id TEXT PRIMARY KEY,
  pattern_name TEXT NOT NULL,
  pattern_description TEXT,
  pattern_data TEXT, -- JSON
  usage_count INTEGER DEFAULT 0,
  community_rating REAL DEFAULT 0.0,
  tags TEXT, -- JSON: searchable tags
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- AI agent insights and contributions
CREATE TABLE IF NOT EXISTS ai_insights (
  insight_id TEXT PRIMARY KEY,
  insight_type TEXT NOT NULL, -- 'bug_pattern', 'optimization', 'refactor_suggestion', 'best_practice'
  insight_content TEXT NOT NULL, -- JSON
  confidence_score REAL DEFAULT 0.0,
  source_agent TEXT, -- which AI agent provided this insight
  validation_status TEXT DEFAULT 'pending', -- 'pending', 'validated', 'rejected'
  impact_prediction TEXT, -- JSON
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Project metadata and configuration
CREATE TABLE IF NOT EXISTS project_metadata (
  project_id TEXT PRIMARY KEY,
  project_path TEXT NOT NULL,
  project_name TEXT,
  language_primary TEXT,
  languages_detected TEXT, -- JSON: all detected languages
  framework_detected TEXT, -- JSON: detected frameworks
  intelligence_version TEXT,
  last_full_scan DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_semantic_concepts_type ON semantic_concepts(concept_type);
CREATE INDEX IF NOT EXISTS idx_semantic_concepts_file ON semantic_concepts(file_path);
CREATE INDEX IF NOT EXISTS idx_developer_patterns_type ON developer_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_developer_patterns_frequency ON developer_patterns(frequency DESC);
CREATE INDEX IF NOT EXISTS idx_file_intelligence_analyzed ON file_intelligence(last_analyzed);
CREATE INDEX IF NOT EXISTS idx_ai_insights_type ON ai_insights(insight_type);
CREATE INDEX IF NOT EXISTS idx_ai_insights_confidence ON ai_insights(confidence_score DESC);