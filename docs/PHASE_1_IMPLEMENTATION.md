# Phase 1 Implementation Plan

## Overview

Phase 1 delivers the **"3 features users can't live without"**:
1. **Incremental Learning** - Learn from every commit
2. **Pattern Conflict Detection** - Proactive pattern violation warnings
3. **Cross-Project Learning** - Leverage experience across all repositories

**Target Timeline:** 2-3 weeks
**Version Target:** v0.7.0

---

## 1. Incremental Learning

### Current Pain Point
- Full codebase scans take 30 seconds to several minutes
- Learning must be manually triggered
- Changes require full re-analysis
- No awareness of what changed

### Target Solution
- **Git-aware change detection** - Know exactly what changed
- **Delta learning** - Only update affected patterns/concepts
- **Automatic triggers** - Learn on every commit/save
- **Background processing** - Non-blocking updates
- **<5 second updates** - Near-instant intelligence refresh

---

### 1.1 Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Git Repository                        │
└───────────────┬─────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────┐
│              GitIntegration Service                      │
│  - Detect changed files (git diff)                       │
│  - Track file deletions                                  │
│  - Hook into git events (post-commit)                    │
└───────────────┬─────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────┐
│           IncrementalLearner Service                     │
│  - Queue changed files                                   │
│  - Prioritize by importance                              │
│  - Batch process updates                                 │
│  - Track learning deltas                                 │
└───────────────┬─────────────────────────────────────────┘
                │
        ┌───────┴────────┐
        ▼                ▼
┌──────────────┐  ┌────────────────┐
│ Semantic     │  │ Pattern        │
│ Engine       │  │ Engine         │
│ (Delta Mode) │  │ (Delta Mode)   │
└──────────────┘  └────────────────┘
        │                │
        └───────┬────────┘
                ▼
┌─────────────────────────────────────────────────────────┐
│                Learning Delta Storage                    │
│  - What changed (file, concepts, patterns)               │
│  - When it changed                                       │
│  - Why (commit SHA, message)                             │
└─────────────────────────────────────────────────────────┘
```

---

### 1.2 Database Schema Changes

#### New Table: `learning_deltas`
```sql
CREATE TABLE learning_deltas (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    trigger_type TEXT NOT NULL,  -- 'commit', 'save', 'manual'
    commit_sha TEXT,
    commit_message TEXT,
    files_changed TEXT NOT NULL,  -- JSON array
    concepts_added INTEGER DEFAULT 0,
    concepts_removed INTEGER DEFAULT 0,
    concepts_modified INTEGER DEFAULT 0,
    patterns_added INTEGER DEFAULT 0,
    patterns_removed INTEGER DEFAULT 0,
    patterns_modified INTEGER DEFAULT 0,
    duration_ms INTEGER,
    status TEXT NOT NULL,  -- 'pending', 'processing', 'completed', 'failed'
    error_message TEXT,
    FOREIGN KEY (project_id) REFERENCES project_metadata(id)
);

CREATE INDEX idx_deltas_project ON learning_deltas(project_id);
CREATE INDEX idx_deltas_timestamp ON learning_deltas(timestamp);
CREATE INDEX idx_deltas_status ON learning_deltas(status);
```

#### Extend `file_intelligence` Table
```sql
ALTER TABLE file_intelligence ADD COLUMN last_learned_commit TEXT;
ALTER TABLE file_intelligence ADD COLUMN last_learned_timestamp INTEGER;
```

#### Extend `semantic_concepts` Table
```sql
ALTER TABLE semantic_concepts ADD COLUMN created_commit TEXT;
ALTER TABLE semantic_concepts ADD COLUMN last_modified_commit TEXT;
ALTER TABLE semantic_concepts ADD COLUMN is_deleted INTEGER DEFAULT 0;
```

#### Extend `developer_patterns` Table
```sql
ALTER TABLE developer_patterns ADD COLUMN last_updated_commit TEXT;
ALTER TABLE developer_patterns ADD COLUMN version INTEGER DEFAULT 1;
```

---

### 1.3 Implementation Files

#### New: `src/services/git-integration.ts`
```typescript
export interface GitChange {
  type: 'added' | 'modified' | 'deleted' | 'renamed';
  path: string;
  oldPath?: string;  // For renames
  commitSha?: string;
  commitMessage?: string;
}

export class GitIntegrationService {
  async getChangedFiles(since?: string): Promise<GitChange[]>
  async getCurrentCommit(): Promise<{ sha: string; message: string }>
  async isGitRepository(path: string): Promise<boolean>
  async getCommitHistory(limit: number): Promise<GitCommit[]>
  async getFileAtCommit(filePath: string, commitSha: string): Promise<string>
  async watchRepository(callback: (changes: GitChange[]) => void): Promise<void>
}
```

#### New: `src/services/incremental-learner.ts`
```typescript
export interface LearningDelta {
  id: string;
  projectId: string;
  timestamp: number;
  triggerType: 'commit' | 'save' | 'manual';
  commitSha?: string;
  commitMessage?: string;
  filesChanged: string[];
  conceptsAdded: number;
  conceptsRemoved: number;
  conceptsModified: number;
  patternsAdded: number;
  patternsRemoved: number;
  patternsModified: number;
  durationMs: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  errorMessage?: string;
}

export class IncrementalLearner {
  async processChanges(changes: GitChange[]): Promise<LearningDelta>
  async queueLearning(files: string[]): Promise<void>
  async getRecentDeltas(limit: number): Promise<LearningDelta[]>
  async getLearningStatus(): Promise<LearningStatus>
}
```

#### Update: `src/engines/semantic-engine.ts`
```typescript
export class SemanticEngine {
  // Existing methods...

  // New incremental methods
  async analyzeChangedFiles(files: string[], context: GitContext): Promise<DeltaResult>
  async removeDeletedConcepts(filePath: string): Promise<void>
  async updateModifiedConcepts(filePath: string, oldConcepts: Concept[], newConcepts: Concept[]): Promise<void>
}
```

#### Update: `src/engines/pattern-engine.ts`
```typescript
export class PatternEngine {
  // Existing methods...

  // New incremental methods
  async updatePatternsFromDelta(delta: LearningDelta): Promise<void>
  async decrementPatternFrequency(pattern: Pattern): Promise<void>
  async incrementPatternFrequency(pattern: Pattern): Promise<void>
  async recalculateConfidence(patternId: string): Promise<void>
}
```

---

### 1.4 MCP Tool Updates

#### Update: `auto_learn_if_needed`
Add incremental mode:
```typescript
{
  name: "auto_learn_if_needed",
  parameters: {
    mode: 'full' | 'incremental',  // NEW
    force: boolean
  }
}
```

#### New: `get_learning_history`
```typescript
{
  name: "get_learning_history",
  description: "Get recent learning deltas and updates",
  parameters: {
    limit: number,
    since_timestamp?: number
  },
  returns: {
    deltas: LearningDelta[],
    total_concepts_learned: number,
    total_patterns_learned: number
  }
}
```

---

### 1.5 Configuration

Add to config:
```json
{
  "incremental_learning": {
    "enabled": true,
    "auto_learn_on_commit": true,
    "auto_learn_on_save": false,  // Future: file watcher
    "batch_size": 50,
    "queue_timeout_ms": 5000,
    "background_learning": true
  }
}
```

---

### 1.6 Testing Strategy

**Unit Tests:**
- `git-integration.test.ts` - Git operations
- `incremental-learner.test.ts` - Delta processing
- `semantic-engine.test.ts` - Incremental concept updates
- `pattern-engine.test.ts` - Incremental pattern updates

**Integration Tests:**
- End-to-end: commit → detect → learn → verify
- Large delta (100+ files)
- Deletion handling
- Rename handling
- Merge conflict scenarios

**Performance Benchmarks:**
- Single file change: <1 second
- 10 files: <5 seconds
- 100 files: <30 seconds

---

## 2. Pattern Conflict Detection

### Current Pain Point
- Patterns learned but never enforced
- No warnings when violating own patterns
- Inconsistencies accumulate over time
- Manual code review catches issues too late

### Target Solution
- **Real-time conflict detection** - Check before writing
- **Confidence-based alerts** - Only warn on strong patterns
- **Explanations** - "You usually do X, but here you did Y"
- **Quick fixes** - Auto-generate code following patterns
- **Learning loop** - Update confidence when user overrides

---

### 2.1 Architecture

```
┌─────────────────────────────────────────────────────────┐
│                Code Being Written                        │
│                (from AI or developer)                    │
└───────────────┬─────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────┐
│        check_pattern_compliance MCP Tool                 │
│  - Parse code snippet                                    │
│  - Extract patterns from code                            │
│  - Compare with learned patterns                         │
└───────────────┬─────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────┐
│        PatternConflictDetector Service                   │
│  - Pattern matching engine                               │
│  - Confidence thresholds                                 │
│  - Conflict severity scoring                             │
│  - Context-aware exceptions                              │
└───────────────┬─────────────────────────────────────────┘
                │
        ┌───────┴────────┐
        ▼                ▼
┌──────────────┐  ┌────────────────┐
│ Conflict     │  │ Quick Fix      │
│ Explanations │  │ Generator      │
└──────────────┘  └────────────────┘
        │                │
        └───────┬────────┘
                ▼
┌─────────────────────────────────────────────────────────┐
│              Conflict Report (JSON)                      │
│  - Violations found                                      │
│  - Severity (low/medium/high)                            │
│  - Explanations                                          │
│  - Quick fix suggestions                                 │
└─────────────────────────────────────────────────────────┘
```

---

### 2.2 Database Schema Changes

#### New Table: `pattern_violations`
```sql
CREATE TABLE pattern_violations (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    file_path TEXT NOT NULL,
    line_number INTEGER,
    column_number INTEGER,
    violation_type TEXT NOT NULL,  -- 'naming', 'structural', 'implementation', etc.
    pattern_id TEXT NOT NULL,
    severity TEXT NOT NULL,  -- 'low', 'medium', 'high'
    message TEXT NOT NULL,
    code_snippet TEXT,
    suggested_fix TEXT,
    detected_at INTEGER NOT NULL,
    resolved_at INTEGER,
    resolution TEXT,  -- 'accepted_fix', 'overridden', 'ignored', 'pattern_updated'
    commit_sha TEXT,
    FOREIGN KEY (project_id) REFERENCES project_metadata(id),
    FOREIGN KEY (pattern_id) REFERENCES developer_patterns(id)
);

CREATE INDEX idx_violations_project ON pattern_violations(project_id);
CREATE INDEX idx_violations_file ON pattern_violations(file_path);
CREATE INDEX idx_violations_severity ON pattern_violations(severity);
CREATE INDEX idx_violations_resolved ON pattern_violations(resolved_at);
```

#### New Table: `pattern_exceptions`
```sql
CREATE TABLE pattern_exceptions (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    pattern_id TEXT NOT NULL,
    file_path TEXT,  -- NULL = global exception
    reason TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    created_by TEXT,  -- For team features
    expires_at INTEGER,  -- NULL = permanent
    FOREIGN KEY (project_id) REFERENCES project_metadata(id),
    FOREIGN KEY (pattern_id) REFERENCES developer_patterns(id)
);

CREATE INDEX idx_exceptions_project ON pattern_exceptions(project_id);
CREATE INDEX idx_exceptions_pattern ON pattern_exceptions(pattern_id);
```

---

### 2.3 Implementation Files

#### New: `src/services/pattern-conflict-detector.ts`
```typescript
export interface PatternViolation {
  id: string;
  type: string;
  pattern: DeveloperPattern;
  severity: 'low' | 'medium' | 'high';
  message: string;
  location?: {
    line: number;
    column: number;
    endLine: number;
    endColumn: number;
  };
  codeSnippet: string;
  expectedPattern: string;
  actualPattern: string;
  suggestedFix?: string;
  confidence: number;
}

export interface ComplianceReport {
  passed: boolean;
  violations: PatternViolation[];
  warnings: PatternViolation[];
  suggestions: PatternViolation[];
  overallScore: number;  // 0-100
  checkDurationMs: number;
}

export class PatternConflictDetector {
  async checkCompliance(
    code: string,
    filePath: string,
    options: {
      severityThreshold?: 'low' | 'medium' | 'high';
      includeWarnings?: boolean;
      includeSuggestions?: boolean;
      autoFix?: boolean;
    }
  ): Promise<ComplianceReport>

  async getViolationHistory(filePath?: string): Promise<PatternViolation[]>
  async resolveViolation(violationId: string, resolution: string): Promise<void>
  async addException(patternId: string, reason: string, scope?: string): Promise<void>
  async isExcepted(patternId: string, filePath: string): Promise<boolean>
}
```

#### New: `src/services/quick-fix-generator.ts`
```typescript
export interface QuickFix {
  description: string;
  code: string;
  confidence: number;
  patternId: string;
}

export class QuickFixGenerator {
  async generateFix(violation: PatternViolation): Promise<QuickFix | null>
  async applyFix(filePath: string, fix: QuickFix): Promise<void>
  async previewFix(originalCode: string, fix: QuickFix): Promise<string>
}
```

---

### 2.4 Pattern Matching Logic

#### Naming Pattern Violations
```typescript
// Example: Variable naming
const learned = {
  pattern: "camelCase",
  examples: ["userId", "userName", "totalCount"],
  confidence: 0.92
};

const code = "const user_id = 123;";  // snake_case

// Violation detected:
{
  type: "naming_convention",
  severity: "medium",
  message: "Variable 'user_id' uses snake_case, but you typically use camelCase (92% confidence)",
  suggestedFix: "const userId = 123;"
}
```

#### Structural Pattern Violations
```typescript
// Example: Module organization
const learned = {
  pattern: "services in src/services/",
  confidence: 0.88
};

const code = "// new file: src/utils/user-service.ts";

// Violation detected:
{
  type: "file_location",
  severity: "low",
  message: "Service files are typically in src/services/ (88% confidence)",
  suggestedFix: "Move to src/services/user-service.ts"
}
```

#### Implementation Pattern Violations
```typescript
// Example: Error handling
const learned = {
  pattern: "try-catch with logger.error",
  examples: ["try { ... } catch (error) { logger.error('...', error); throw error; }"],
  confidence: 0.95
};

const code = `
try {
  await fetchData();
} catch (e) {
  console.log(e);  // Using console.log instead of logger
}
`;

// Violation detected:
{
  type: "error_handling",
  severity: "high",
  message: "You typically use logger.error() for error handling, not console.log (95% confidence)",
  suggestedFix: "logger.error('Failed to fetch data', e);"
}
```

---

### 2.5 MCP Tool

#### New: `check_pattern_compliance`
```typescript
{
  name: "check_pattern_compliance",
  description: "Check if code follows learned patterns (smart code review)",
  inputSchema: {
    type: "object",
    properties: {
      file_path: {
        type: "string",
        description: "Path to file being checked"
      },
      code_snippet: {
        type: "string",
        description: "Code to check (optional, checks whole file if not provided)"
      },
      severity_threshold: {
        type: "string",
        enum: ["low", "medium", "high"],
        description: "Only report violations at or above this severity (default: medium)"
      },
      auto_fix: {
        type: "boolean",
        description: "Generate quick fix suggestions (default: true)"
      }
    },
    required: ["file_path"]
  }
}
```

**Response:**
```json
{
  "passed": false,
  "overallScore": 78,
  "violations": [
    {
      "type": "naming_convention",
      "severity": "medium",
      "message": "Variable 'user_id' uses snake_case, but you typically use camelCase (92% confidence)",
      "location": { "line": 10, "column": 7 },
      "suggestedFix": "const userId = 123;"
    }
  ],
  "warnings": [],
  "suggestions": [
    {
      "type": "implementation_pattern",
      "severity": "low",
      "message": "Consider adding error handling (you do this 85% of the time in similar functions)"
    }
  ],
  "checkDurationMs": 45
}
```

---

### 2.6 Confidence Thresholds

```typescript
const SEVERITY_THRESHOLDS = {
  high: 0.85,    // Only alert if 85%+ confident
  medium: 0.70,  // Alert if 70%+ confident
  low: 0.50      // Alert if 50%+ confident
};

const PATTERN_FREQUENCY_THRESHOLD = 5;  // Must see pattern 5+ times
```

---

### 2.7 Testing Strategy

**Unit Tests:**
- `pattern-conflict-detector.test.ts` - Core detection logic
- `quick-fix-generator.test.ts` - Fix generation
- Pattern matching accuracy tests

**Integration Tests:**
- End-to-end: write code → detect conflicts → generate fixes
- False positive rate (should be <5%)
- Coverage of all pattern types

**User Acceptance:**
- Test with real codebases
- Verify explanations are clear
- Ensure fixes are safe

---

## 3. Cross-Project Learning

### Current Pain Point
- Each project isolated
- Can't leverage experience from other projects
- Same patterns re-learned for every project
- No way to search across all code

### Target Solution
- **Global pattern database** - Shared across all projects
- **Cross-project search** - Find anything in any project
- **Pattern aggregation** - Patterns from 10 projects > 1 project
- **Portfolio view** - See all your work at once
- **Pattern inheritance** - Global → project-specific overrides

---

### 3.1 Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   ~/.in-memoria/                         │
│                                                           │
│  ├── global-patterns.db      (SQLite)                    │
│  │   - Cross-project patterns                            │
│  │   - Project registry                                  │
│  │   - Global concepts                                   │
│  │                                                        │
│  ├── global-vectors.db       (SurrealDB)                 │
│  │   - Cross-project embeddings                          │
│  │   - Searchable across all code                        │
│  │                                                        │
│  └── projects/                                            │
│      ├── project-a/                                       │
│      │   ├── patterns.db     (project-specific)          │
│      │   └── vectors.db                                  │
│      ├── project-b/                                       │
│      │   ├── patterns.db                                 │
│      │   └── vectors.db                                  │
│      └── ...                                              │
└─────────────────────────────────────────────────────────┘
```

**Pattern Resolution Flow:**
```
┌──────────────┐
│  AI Request  │
└──────┬───────┘
       │
       ▼
┌──────────────────────────────┐
│  Check project-specific DB   │
└──────┬───────────────────────┘
       │
       ├─ Found? → Return patterns
       │
       ▼
┌──────────────────────────────┐
│  Check global DB             │
└──────┬───────────────────────┘
       │
       ├─ Found? → Return patterns
       │
       ▼
┌──────────────────────────────┐
│  Merge & rank by:            │
│  - Frequency across projects │
│  - Similarity to current     │
│  - Recency                   │
└──────────────────────────────┘
```

---

### 3.2 Database Schema Changes

#### New Database: `~/.in-memoria/global-patterns.db`

**Table: `global_projects`**
```sql
CREATE TABLE global_projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    path TEXT NOT NULL UNIQUE,
    description TEXT,
    primary_language TEXT,
    frameworks TEXT,  -- JSON array
    linked_at INTEGER NOT NULL,
    last_synced INTEGER,
    pattern_count INTEGER DEFAULT 0,
    concept_count INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1
);

CREATE INDEX idx_projects_path ON global_projects(path);
CREATE INDEX idx_projects_active ON global_projects(is_active);
```

**Table: `global_patterns`**
```sql
CREATE TABLE global_patterns (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    subcategory TEXT,
    pattern_data TEXT NOT NULL,  -- JSON
    project_count INTEGER DEFAULT 1,  -- How many projects have this
    total_frequency INTEGER DEFAULT 1,
    confidence REAL NOT NULL,
    first_seen INTEGER NOT NULL,
    last_seen INTEGER NOT NULL,
    source_projects TEXT NOT NULL,  -- JSON array of project IDs
    example_code TEXT,
    language TEXT
);

CREATE INDEX idx_global_patterns_category ON global_patterns(category);
CREATE INDEX idx_global_patterns_project_count ON global_patterns(project_count);
CREATE INDEX idx_global_patterns_confidence ON global_patterns(confidence);
```

**Table: `global_concepts`**
```sql
CREATE TABLE global_concepts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    file_path TEXT NOT NULL,
    project_id TEXT NOT NULL,
    language TEXT NOT NULL,
    embedding_id TEXT,  -- Reference to global vector DB
    metadata TEXT,  -- JSON
    created_at INTEGER NOT NULL,
    FOREIGN KEY (project_id) REFERENCES global_projects(id)
);

CREATE INDEX idx_global_concepts_name ON global_concepts(name);
CREATE INDEX idx_global_concepts_type ON global_concepts(type);
CREATE INDEX idx_global_concepts_project ON global_concepts(project_id);
```

**Table: `pattern_aggregations`**
```sql
CREATE TABLE pattern_aggregations (
    id TEXT PRIMARY KEY,
    pattern_signature TEXT NOT NULL,  -- Normalized pattern key
    category TEXT NOT NULL,
    occurrences TEXT NOT NULL,  -- JSON: [{projectId, frequency, confidence}]
    aggregated_confidence REAL NOT NULL,
    consensus_score REAL NOT NULL,  -- 0-1: how consistent across projects
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX idx_aggregations_signature ON pattern_aggregations(pattern_signature);
CREATE INDEX idx_aggregations_category ON pattern_aggregations(category);
CREATE INDEX idx_aggregations_consensus ON pattern_aggregations(consensus_score);
```

---

### 3.3 Implementation Files

#### New: `src/storage/global-db.ts`
```typescript
export class GlobalDatabase {
  private db: Database;
  private projectsDb: Map<string, SqliteDatabase>;

  async linkProject(projectPath: string, metadata: ProjectMetadata): Promise<string>
  async unlinkProject(projectId: string): Promise<void>
  async syncProject(projectId: string): Promise<SyncResult>
  async syncAllProjects(): Promise<SyncResult[]>

  async getGlobalPatterns(options: {
    category?: string;
    minProjectCount?: number;
    minConsensus?: number;
    language?: string;
  }): Promise<GlobalPattern[]>

  async searchAllProjects(query: string, mode: 'semantic' | 'text' | 'pattern'): Promise<SearchResult[]>
  async getProjectRegistry(): Promise<Project[]>

  async aggregatePatterns(): Promise<void>
  async getPatternStats(): Promise<PatternStats>
}
```

#### New: `src/services/cross-project-service.ts`
```typescript
export interface ProjectLink {
  id: string;
  name: string;
  path: string;
  linkedAt: number;
  lastSynced: number;
  patternCount: number;
}

export interface GlobalPattern {
  id: string;
  category: string;
  pattern: any;
  projectCount: number;
  confidence: number;
  consensusScore: number;  // How consistent across projects
  sourceProjects: string[];
  examples: { projectId: string; code: string }[];
}

export class CrossProjectService {
  async linkProject(path: string, name?: string): Promise<ProjectLink>
  async getLinkedProjects(): Promise<ProjectLink[]>
  async syncProject(projectId: string): Promise<SyncResult>

  async getGlobalPatterns(filter: PatternFilter): Promise<GlobalPattern[]>
  async searchAllProjects(query: string, options: SearchOptions): Promise<SearchResult[]>

  async getPortfolioView(): Promise<PortfolioView>
  async getProjectSimilarity(projectId1: string, projectId2: string): Promise<number>
}
```

#### New: `src/services/pattern-aggregator.ts`
```typescript
export class PatternAggregator {
  async aggregatePatterns(projectIds: string[]): Promise<AggregatedPattern[]>
  async calculateConsensus(pattern: Pattern, occurrences: Occurrence[]): Promise<number>
  async mergePatterns(patterns: Pattern[]): Promise<Pattern>
  async rankPatternsByRelevance(patterns: GlobalPattern[], context: ProjectContext): Promise<GlobalPattern[]>
}
```

---

### 3.4 MCP Tools

#### New: `link_project`
```typescript
{
  name: "link_project",
  description: "Link a project to global intelligence for cross-project learning",
  inputSchema: {
    type: "object",
    properties: {
      project_path: {
        type: "string",
        description: "Absolute path to project"
      },
      project_name: {
        type: "string",
        description: "Human-readable name (optional)"
      },
      auto_sync: {
        type: "boolean",
        description: "Automatically sync patterns to global DB (default: true)"
      }
    },
    required: ["project_path"]
  }
}
```

**Response:**
```json
{
  "projectId": "abc123",
  "name": "my-app",
  "path": "/Users/dev/projects/my-app",
  "linkedAt": 1700000000,
  "syncStatus": "completed",
  "patternsAdded": 47,
  "conceptsAdded": 234
}
```

#### New: `search_all_projects`
```typescript
{
  name: "search_all_projects",
  description: "Search code across all linked projects",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Search query (natural language or keywords)"
      },
      mode: {
        type: "string",
        enum: ["semantic", "text", "pattern"],
        description: "Search mode (default: semantic)"
      },
      project_filter: {
        type: "array",
        items: { type: "string" },
        description: "Only search these projects (optional)"
      },
      language_filter: {
        type: "string",
        description: "Only search files in this language (optional)"
      },
      limit: {
        type: "number",
        description: "Max results (default: 20)"
      }
    },
    required: ["query"]
  }
}
```

**Response:**
```json
{
  "results": [
    {
      "projectId": "abc123",
      "projectName": "my-app",
      "filePath": "src/auth/login.ts",
      "match": {
        "code": "async function handleLogin(credentials: LoginCredentials) {...}",
        "score": 0.92,
        "context": "Authentication handling pattern"
      }
    }
  ],
  "totalResults": 15,
  "projectsSearched": 5,
  "searchDurationMs": 123
}
```

#### New: `get_global_patterns`
```typescript
{
  name: "get_global_patterns",
  description: "Get patterns learned across all your projects",
  inputSchema: {
    type: "object",
    properties: {
      category: {
        type: "string",
        enum: ["naming", "structural", "implementation", "testing", "style"],
        description: "Pattern category (optional)"
      },
      min_project_count: {
        type: "number",
        description: "Minimum number of projects that must have this pattern (default: 2)"
      },
      min_consensus: {
        type: "number",
        description: "Minimum consensus score 0-1 (default: 0.7)"
      },
      language: {
        type: "string",
        description: "Filter by language (optional)"
      }
    }
  }
}
```

**Response:**
```json
{
  "patterns": [
    {
      "id": "pattern-xyz",
      "category": "naming",
      "pattern": "camelCase for variables",
      "projectCount": 8,
      "confidence": 0.94,
      "consensusScore": 0.89,
      "sourceProjects": ["abc123", "def456", ...],
      "examples": [
        {
          "projectName": "my-app",
          "code": "const userId = 123;"
        }
      ]
    }
  ],
  "totalPatterns": 47,
  "projectsAnalyzed": 8
}
```

#### New: `get_portfolio_view`
```typescript
{
  name: "get_portfolio_view",
  description: "Get overview of all linked projects",
  inputSchema: {
    type: "object",
    properties: {}
  }
}
```

**Response:**
```json
{
  "projects": [
    {
      "id": "abc123",
      "name": "my-app",
      "path": "/Users/dev/projects/my-app",
      "primaryLanguage": "TypeScript",
      "frameworks": ["React", "Express"],
      "patternCount": 47,
      "conceptCount": 234,
      "lastSynced": 1700000000,
      "size": "large"
    }
  ],
  "totalProjects": 8,
  "totalPatterns": 312,
  "totalConcepts": 1847,
  "mostUsedLanguages": ["TypeScript", "Python", "Go"],
  "mostUsedFrameworks": ["React", "Express", "Django"]
}
```

---

### 3.5 Pattern Synchronization

**Sync Strategy:**
1. **On Link** - Full sync of project patterns to global DB
2. **Incremental** - Sync only changed patterns (after learning deltas)
3. **On Demand** - Manual sync via MCP tool
4. **Scheduled** - Background sync (configurable)

**Conflict Resolution:**
- Same pattern, different confidence → Keep highest
- Same pattern, different implementation → Store both, flag conflict
- Pattern present in N projects → Higher weight

**Aggregation Algorithm:**
```typescript
function aggregatePattern(occurrences: PatternOccurrence[]): AggregatedPattern {
  const avgConfidence = mean(occurrences.map(o => o.confidence));
  const projectCount = occurrences.length;

  // Consensus: how similar are the patterns?
  const consensusScore = calculateSimilarity(occurrences.map(o => o.pattern));

  // Weight by project count (more projects = more confident)
  const globalConfidence = avgConfidence * (1 + Math.log(projectCount));

  return {
    confidence: Math.min(globalConfidence, 1.0),
    consensusScore,
    projectCount
  };
}
```

---

### 3.6 Testing Strategy

**Unit Tests:**
- `global-db.test.ts` - Database operations
- `cross-project-service.test.ts` - Service logic
- `pattern-aggregator.test.ts` - Aggregation algorithm

**Integration Tests:**
- Link multiple projects
- Sync patterns across projects
- Search all projects
- Pattern conflict resolution

**Performance Tests:**
- Search across 10+ projects
- Sync 100+ patterns
- Query performance with large global DB

---

## Implementation Order

### Week 1: Incremental Learning
1. ✅ Day 1-2: Git integration service
2. ✅ Day 3-4: Incremental learner service
3. ✅ Day 5: Database schema updates & migrations
4. ✅ Day 6-7: Testing & integration

### Week 2: Pattern Conflict Detection
1. ✅ Day 1-2: Pattern conflict detector
2. ✅ Day 3: Quick fix generator
3. ✅ Day 4-5: MCP tool integration
4. ✅ Day 6-7: Testing & refinement

### Week 3: Cross-Project Learning
1. ✅ Day 1-2: Global database & schema
2. ✅ Day 3-4: Cross-project service
3. ✅ Day 5: Pattern aggregation
4. ✅ Day 6-7: MCP tools & testing

---

## Success Criteria

### Incremental Learning
- ✅ Single file change processed in <1 second
- ✅ 10 files in <5 seconds
- ✅ Auto-learn on commit works
- ✅ Delta history tracked correctly

### Pattern Conflict Detection
- ✅ Detects 80%+ of pattern violations
- ✅ False positive rate <10%
- ✅ Explanations are clear and actionable
- ✅ Quick fixes are safe (don't break code)

### Cross-Project Learning
- ✅ Can link 5+ projects
- ✅ Cross-project search works
- ✅ Global patterns aggregated correctly
- ✅ Pattern consensus calculated accurately

---

## Migration Path

For existing users:

1. **Auto-detect existing projects** in `~/.in-memoria/`
2. **Prompt to link** existing projects to global DB
3. **One-time sync** of all existing patterns
4. **Enable incremental learning** by default (with opt-out)

---

## Documentation Updates

- ✅ Update AGENT.md with new tools
- ✅ Add Phase 1 tutorial to docs/
- ✅ Update README with new features
- ✅ Create migration guide
- ✅ Add troubleshooting section

---

## Next Steps After Phase 1

Once Phase 1 is complete and tested:
1. Gather user feedback
2. Measure adoption of new features
3. Tune algorithms based on real usage
4. Plan Phase 2 (VS Code extension, Git hooks, CLI improvements)

---

*Last Updated: 2025-11-17*
*Status: Ready for Implementation*
