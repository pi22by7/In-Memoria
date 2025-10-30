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
  created_at DATETIME DEFAULT (datetime('now', 'utc')),
  updated_at DATETIME DEFAULT (datetime('now', 'utc'))
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
  created_at DATETIME DEFAULT (datetime('now', 'utc')),
  last_seen DATETIME DEFAULT (datetime('now', 'utc'))
);

-- Architectural decisions and their reasoning
CREATE TABLE IF NOT EXISTS architectural_decisions (
  decision_id TEXT PRIMARY KEY,
  decision_context TEXT NOT NULL,
  decision_rationale TEXT,
  alternatives_considered TEXT, -- JSON
  impact_analysis TEXT, -- JSON
  decision_date DATETIME DEFAULT (datetime('now', 'utc')),
  files_affected TEXT, -- JSON: list of affected files
  created_at DATETIME DEFAULT (datetime('now', 'utc'))
);

-- Per-file intelligence and analysis results
CREATE TABLE IF NOT EXISTS file_intelligence (
  file_path TEXT PRIMARY KEY,
  file_hash TEXT NOT NULL,
  semantic_concepts TEXT, -- JSON: concepts found in this file
  patterns_used TEXT, -- JSON: patterns detected in this file
  complexity_metrics TEXT, -- JSON: various complexity measurements
  dependencies TEXT, -- JSON: file dependencies
  last_analyzed DATETIME DEFAULT (datetime('now', 'utc')),
  created_at DATETIME DEFAULT (datetime('now', 'utc'))
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
  created_at DATETIME DEFAULT (datetime('now', 'utc'))
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
  created_at DATETIME DEFAULT (datetime('now', 'utc'))
);

-- Project metadata and configuration
CREATE TABLE IF NOT EXISTS project_metadata (
  project_id TEXT PRIMARY KEY,
  project_path TEXT NOT NULL UNIQUE,
  project_name TEXT,
  language_primary TEXT,
  languages_detected TEXT, -- JSON: all detected languages
  framework_detected TEXT, -- JSON: detected frameworks
  intelligence_version TEXT,
  last_full_scan DATETIME,
  created_at DATETIME DEFAULT (datetime('now', 'utc')),
  updated_at DATETIME DEFAULT (datetime('now', 'utc'))
);

CREATE TABLE IF NOT EXISTS feature_map (
  id TEXT PRIMARY KEY,
  project_path TEXT NOT NULL,
  feature_name TEXT NOT NULL,
  primary_files TEXT NOT NULL,    -- JSON array
  related_files TEXT,              -- JSON array
  dependencies TEXT,               -- JSON array
  status TEXT DEFAULT 'active',
  created_at DATETIME DEFAULT (datetime('now', 'utc')),
  updated_at DATETIME DEFAULT (datetime('now', 'utc')),
  FOREIGN KEY (project_path) REFERENCES project_metadata(project_path)
);

CREATE TABLE IF NOT EXISTS entry_points (
  id TEXT PRIMARY KEY,
  project_path TEXT NOT NULL,
  entry_type TEXT NOT NULL,       -- 'web', 'api', 'cli', 'worker'
  file_path TEXT NOT NULL,
  description TEXT,
  framework TEXT,                 -- 'react', 'express', 'fastapi', etc.
  created_at DATETIME DEFAULT (datetime('now', 'utc')),
  FOREIGN KEY (project_path) REFERENCES project_metadata(project_path)
);

CREATE TABLE IF NOT EXISTS key_directories (
  id TEXT PRIMARY KEY,
  project_path TEXT NOT NULL,
  directory_path TEXT NOT NULL,
  directory_type TEXT NOT NULL,   -- 'components', 'utils', 'services', 'auth', etc.
  file_count INTEGER DEFAULT 0,
  description TEXT,
  created_at DATETIME DEFAULT (datetime('now', 'utc')),
  FOREIGN KEY (project_path) REFERENCES project_metadata(project_path)
);

CREATE TABLE IF NOT EXISTS work_sessions (
  id TEXT PRIMARY KEY,
  project_path TEXT NOT NULL,
  session_start DATETIME DEFAULT (datetime('now', 'utc')),
  session_end DATETIME,
  last_feature TEXT,
  current_files TEXT,           -- JSON array
  completed_tasks TEXT,          -- JSON array
  pending_tasks TEXT,            -- JSON array
  blockers TEXT,                 -- JSON array
  session_notes TEXT,
  last_updated DATETIME DEFAULT (datetime('now', 'utc')),
  FOREIGN KEY (project_path) REFERENCES project_metadata(project_path)
);

CREATE TABLE IF NOT EXISTS project_decisions (
  id TEXT PRIMARY KEY,
  project_path TEXT NOT NULL,
  decision_key TEXT NOT NULL,
  decision_value TEXT NOT NULL,
  reasoning TEXT,
  made_at DATETIME DEFAULT (datetime('now', 'utc')),
  UNIQUE(project_path, decision_key),
  FOREIGN KEY (project_path) REFERENCES project_metadata(project_path)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_semantic_concepts_type ON semantic_concepts(concept_type);
CREATE INDEX IF NOT EXISTS idx_semantic_concepts_file ON semantic_concepts(file_path);
CREATE INDEX IF NOT EXISTS idx_developer_patterns_type ON developer_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_developer_patterns_frequency ON developer_patterns(frequency DESC);
CREATE INDEX IF NOT EXISTS idx_file_intelligence_analyzed ON file_intelligence(last_analyzed);
CREATE INDEX IF NOT EXISTS idx_ai_insights_type ON ai_insights(insight_type);
CREATE INDEX IF NOT EXISTS idx_ai_insights_confidence ON ai_insights(confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_feature_map_project ON feature_map(project_path);
CREATE INDEX IF NOT EXISTS idx_feature_map_name ON feature_map(feature_name);
CREATE INDEX IF NOT EXISTS idx_entry_points_project ON entry_points(project_path);
CREATE INDEX IF NOT EXISTS idx_key_directories_project ON key_directories(project_path);
CREATE INDEX IF NOT EXISTS idx_work_sessions_project ON work_sessions(project_path);
CREATE INDEX IF NOT EXISTS idx_work_sessions_updated ON work_sessions(last_updated DESC);
CREATE INDEX IF NOT EXISTS idx_project_decisions_key ON project_decisions(project_path, decision_key);