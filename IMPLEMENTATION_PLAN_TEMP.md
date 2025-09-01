# Session Amnesia Solution - Token-Efficient Implementation

**Core Problem**: AI agents waste thousands of tokens every session rediscovering project structure, tech stack, and entry points instead of working on the actual task.

**Solution**: Pre-learned project intelligence that eliminates exploration overhead.

## The Token Waste Problem

**Current Reality:**
```
User: "work on the auth feature"
Agent: *lists 50 files* → *reads README* → *reads package.json* → *explores src/* → *finds auth files*
Result: 3000+ tokens wasted before any real work begins
```

**Target Reality:**
```
User: "work on the auth feature"  
Agent: "Loading auth module at src/auth/... Starting with middleware validation..."
Result: Direct action, zero exploration tokens
```

## Core Architecture: Project Intelligence Cache

### 1. Project Blueprint System

**Purpose**: Eliminate "where do I start?" questions with pre-computed project map.

**Database Schema:**
```sql
project_blueprints (
  project_path TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  tech_stack JSON NOT NULL,        -- ["React", "TypeScript", "Express", "PostgreSQL"]
  entry_points JSON NOT NULL,      -- {"web": "src/index.tsx", "api": "server/app.js"}
  key_directories JSON NOT NULL,   -- {"auth": "src/auth/", "components": "src/components/"}
  architecture_style TEXT,         -- "microservices", "monolith", "jamstack"
  testing_framework TEXT,          -- "jest", "vitest", "pytest"
  build_system TEXT,              -- "vite", "webpack", "tsc"
  last_analyzed DATETIME NOT NULL
);

-- Map features to specific file locations
feature_map (
  project_path TEXT NOT NULL,
  feature_name TEXT NOT NULL,      -- "authentication", "user-profile", "payment"
  primary_files JSON NOT NULL,     -- ["src/auth/middleware.ts", "src/auth/routes.ts"]
  related_files JSON,             -- Tests, configs, types
  dependencies JSON,              -- What this feature depends on
  status TEXT,                    -- "active", "deprecated", "planned"
  FOREIGN KEY (project_path) REFERENCES project_blueprints(project_path)
);
```

**MCP Tools:**
```typescript
async getProjectBlueprint(): Promise<{
  techStack: string[],
  entryPoints: Record<string, string>,
  architecture: string,
  keyDirectories: Record<string, string>
}>

async findFeatureFiles(feature: string): Promise<{
  primaryFiles: string[],
  relatedFiles: string[],
  suggestedStartPoint: string
}>
```

### 2. Work Context System

**Purpose**: Remember what was being worked on and provide immediate continuation points.

**Database Schema:**
```sql
work_sessions (
  id TEXT PRIMARY KEY,
  project_path TEXT NOT NULL,
  last_feature TEXT,               -- "authentication system"
  current_files JSON,              -- Currently open/modified files
  completed_tasks JSON,            -- ["added JWT middleware", "implemented login route"]
  pending_tasks JSON,              -- ["add rate limiting", "write auth tests"]
  blockers JSON,                   -- ["need to configure database", "waiting for API keys"]
  session_notes TEXT,              -- Brief context about current work
  last_updated DATETIME NOT NULL,
  FOREIGN KEY (project_path) REFERENCES project_blueprints(project_path)
);

-- Quick decisions to avoid re-asking
project_decisions (
  project_path TEXT NOT NULL,
  decision_key TEXT NOT NULL,      -- "auth_method", "database_orm", "testing_approach"
  decision_value TEXT NOT NULL,    -- "JWT", "Prisma", "integration-focused"
  reasoning TEXT,                  -- Brief rationale
  made_at DATETIME NOT NULL,
  PRIMARY KEY (project_path, decision_key)
);
```

### 3. Smart File Navigation

**Purpose**: Jump directly to relevant files without exploration.

**Database Schema:**
```sql
-- Pre-computed file relationships and importance
file_intelligence (
  project_path TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,         -- "component", "utility", "config", "test"
  importance_score REAL,           -- 0.0-1.0 how central this file is
  purpose_summary TEXT,            -- "Main API routes", "User authentication logic"
  key_exports JSON,               -- Functions/classes this file provides
  dependencies JSON,              -- What files this depends on
  dependents JSON,                -- What files depend on this
  last_modified DATETIME,
  PRIMARY KEY (project_path, file_path)
);

-- Common patterns for different project types
navigation_patterns (
  tech_stack TEXT NOT NULL,        -- "react-typescript", "node-express", "python-fastapi"
  feature_type TEXT NOT NULL,      -- "auth", "api", "ui", "database"
  typical_locations JSON NOT NULL, -- Where these features are usually found
  entry_patterns JSON NOT NULL,    -- How to identify entry points
  confidence REAL NOT NULL
);
```

## Implementation Strategy

### Phase 1: Project Intelligence Builder

**Goal**: Eliminate "list files → read README → explore structure" pattern.

**Core Function**: `analyzeProjectStructure()`
```typescript
async analyzeProjectStructure(projectPath: string): Promise<ProjectBlueprint> {
  // 1. Detect tech stack from package.json, requirements.txt, Cargo.toml, etc.
  // 2. Map directory structure to common patterns
  // 3. Identify entry points and key files
  // 4. Build feature-to-file mappings
  // 5. Cache everything for instant retrieval
}
```

**Smart Detection Logic:**
- `package.json` → Extract framework, build tools, testing setup
- Directory patterns → Identify architecture style (src/, lib/, components/)
- Import analysis → Build dependency graphs
- File naming conventions → Classify file purposes

### Phase 2: Contextual Work Memory

**Goal**: Answer "what was I working on?" instantly.

**Auto-Context Capture:**
```typescript
// Triggered when files are modified
async updateWorkContext(files: string[], description?: string): Promise<void> {
  // Extract what feature/area is being worked on
  // Update pending tasks based on TODO comments, incomplete functions
  // Identify logical next steps
  // Store minimal context for resumption
}
```

**Session Resume:**
```typescript
async resumeWork(): Promise<{
  welcomeMessage: string,        // "You were working on the authentication system"
  currentFocus: string,          // "JWT token validation middleware"  
  suggestedFiles: string[],      // ["src/auth/middleware.ts", "src/auth/routes.ts"]
  nextActions: string[]          // ["Add rate limiting", "Write integration tests"]
}>
```

### Phase 3: Intelligent Task Routing

**Goal**: Route vague requests to specific files without exploration.

**Smart Request Processing:**
```typescript
async routeRequest(userInput: string): Promise<{
  intendedFeature: string,       // "authentication"
  targetFiles: string[],         // Specific files to work with
  workType: string,             // "feature", "bug", "refactor", "test"
  suggestedApproach: string      // Brief guidance on how to proceed
}>
```

**Pattern Matching Examples:**
- "work on auth" → `src/auth/` directory, middleware files
- "fix the login bug" → Authentication files + recent error logs
- "add tests" → Test files related to recently modified code
- "improve performance" → Core business logic files, database queries

## MCP Tool Consolidation

**Current: 17 tools → Target: 4 focused tools**

### 1. `project_intelligence` 
```typescript
interface ProjectIntelligence {
  getBlueprint(): Promise<ProjectBlueprint>
  findFeatureFiles(feature: string): Promise<FileMap>
  analyzeStructure(): Promise<void>
  getFileContext(path: string): Promise<FileIntelligence>
}
```

### 2. `work_memory`
```typescript
interface WorkMemory {
  resumeSession(): Promise<SessionResume>
  updateContext(files: string[], notes?: string): Promise<void>
  recordDecision(key: string, value: string, reason?: string): Promise<void>
  getRecentDecisions(): Promise<Record<string, string>>
}
```

### 3. `smart_navigation`
```typescript
interface SmartNavigation {
  routeRequest(input: string): Promise<TaskRoute>
  suggestNextFiles(currentFiles: string[]): Promise<string[]>
  findRelatedFiles(path: string): Promise<RelatedFiles>
}
```

### 4. `codebase_analysis` (streamlined)
```typescript
interface CodebaseAnalysis {
  quickSearch(query: string): Promise<SearchResults>
  getFileSummary(path: string): Promise<FileSummary>
  analyzeChanges(files: string[]): Promise<ChangeAnalysis>
}
```

## Token Efficiency Metrics

**Success Criteria:**
- **Cold start**: <200 tokens to understand project structure
- **Feature work**: Direct file access, zero exploration tokens  
- **Session resume**: <100 tokens to restore full context
- **Vague requests**: Route to specific files in <50 tokens

**Before/After Comparison:**
```
Traditional Approach:
"work on auth" → 3000+ tokens (list files, read README, explore, find auth files)

In-Memoria Approach: 
"work on auth" → 50 tokens (load auth context, jump to files)
Savings: 98%+ token reduction
```

## Implementation Phases

### Week 1: Project Blueprint System
- Build tech stack detection
- Create directory mapping
- Implement feature-to-file mapping
- Basic MCP tool integration

### Week 2: Work Context Memory
- Session state tracking
- Decision recording system
- Context capture automation
- Resume functionality

### Week 3: Smart Navigation
- Request routing logic
- Pattern matching system
- File relationship mapping
- Next-action prediction

### Week 4: Tool Consolidation & Testing
- Merge 17 tools into 4 focused interfaces
- Performance optimization
- Real-world testing with various project types
- Token efficiency validation

## Real-World Examples

### Scenario 1: "Add authentication"
**Traditional**: List files → Read README → Find package.json → Explore src/ → Find auth-related code → Start work
**In-Memoria**: "Loading auth module... Found existing middleware at src/auth/middleware.ts. Suggested approach: extend JWT validation. Ready to code."

### Scenario 2: "Fix the bug"
**Traditional**: Explore codebase → Read recent commits → Check error logs → Find relevant files → Debug
**In-Memoria**: "Recent work on payment processing detected. Loading src/payments/stripe.ts where validation error occurs. Ready to debug."

### Scenario 3: "Write tests" 
**Traditional**: Find test directory → Understand testing framework → Locate files needing tests → Set up test structure
**In-Memoria**: "Test coverage needed for recent auth changes. Loading jest setup, creating tests for src/auth/middleware.ts. Ready to write tests."

This approach transforms In-Memoria from a pattern detector into a **project intelligence cache** that eliminates token waste and enables agents to work immediately on the actual task instead of rediscovering project structure every session.