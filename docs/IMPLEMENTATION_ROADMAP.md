# In-Memoria Implementation Roadmap
## Token-Efficient Session Intelligence - Incremental Implementation Plan

**Created:** 2025-10-14
**Status:** Planning
**Goal:** Implement the Session Amnesia Solution with minimal code breakage and maximum code reuse

---

## Guiding Principles: No Compromises on Quality

**We commit to these principles for every line of code:**

### 1. **Zero Made-Up Data**
- ❌ NEVER fake, synthesize, or hallucinate responses
- ❌ NEVER return placeholder data or "example" responses
- ✅ Return empty arrays/nulls when data doesn't exist
- ✅ Be explicit about missing intelligence: "No patterns detected yet - run learning"
- ✅ Log warnings when falling back to degraded functionality

### 2. **Zero Technical Debt**
- ❌ NEVER leave TODOs, FIXMEs, or incomplete implementations
- ❌ NEVER comment out code "temporarily"
- ❌ NEVER skip error handling
- ✅ Every function must be complete, tested, and production-ready
- ✅ Every edge case must be handled gracefully
- ✅ Every error must provide actionable guidance

### 3. **Token Efficiency is Sacred**
- ❌ NEVER return verbose descriptions or redundant data
- ❌ NEVER include "helpful" explanations that waste tokens
- ❌ NEVER nest objects deeper than necessary
- ✅ Keep responses minimal: only what the agent needs
- ✅ Use compact data structures (arrays over verbose objects)
- ✅ Target: <200 tokens for cold start, <100 for session resume, <50 for routing
- ✅ Test token count for every tool response

### 4. **Rust Integration is Critical**
- ❌ NEVER bypass the Rust analyzer without circuit breaker fallback
- ❌ NEVER assume Rust analysis succeeded without checking
- ❌ NEVER hide Rust errors from the user
- ✅ Always use CircuitBreaker for Rust calls
- ✅ Provide degraded TypeScript fallback when Rust fails
- ✅ Log clear warnings when Rust analyzer is unavailable
- ✅ Test both Rust and fallback paths

### 5. **Database Integrity First**
- ❌ NEVER write schema changes without migrations
- ❌ NEVER skip foreign key constraints
- ❌ NEVER assume data exists without checking
- ✅ Every query must handle NULL/empty results
- ✅ Every write must be transactional where appropriate
- ✅ Every migration must have a rollback plan

### 6. **AI Agent Experience**
- ❌ NEVER make agents guess at parameter formats
- ❌ NEVER return ambiguous error messages
- ❌ NEVER require multiple tool calls for simple operations
- ✅ Tool descriptions must be crystal clear
- ✅ Error messages must suggest corrective actions
- ✅ One tool call should accomplish one logical task

### 7. **Performance Standards**
- ❌ NEVER block the event loop with synchronous operations
- ❌ NEVER scan entire codebases without progress indicators
- ❌ NEVER cache unbounded data structures
- ✅ Use async/await for all I/O operations
- ✅ Implement timeouts for long-running operations (5min max)
- ✅ Cache results with TTL to prevent memory leaks
- ✅ Profile and optimize hot paths

### 8. **Testing is Non-Negotiable**
- ❌ NEVER commit code without tests
- ❌ NEVER skip edge case testing
- ❌ NEVER assume "it should work"
- ✅ Unit tests for every new function
- ✅ Integration tests for tool workflows
- ✅ Test both success and failure paths
- ✅ Test with real Rust analyzer and with fallback

### 9. **Code Quality Bar**
- ❌ NEVER duplicate logic across files
- ❌ NEVER write functions longer than 100 lines
- ❌ NEVER skip type safety (use TypeScript types properly)
- ✅ Follow existing code patterns and conventions
- ✅ Reuse existing utilities before creating new ones
- ✅ Keep cyclomatic complexity under 10 per function
- ✅ Document non-obvious design decisions

### 10. **Incremental Progress**
- ❌ NEVER make sweeping refactors across multiple files
- ❌ NEVER change existing APIs without discussion
- ❌ NEVER commit half-finished features
- ✅ Each commit must leave the codebase in working state
- ✅ Each phase must be fully tested before moving to next
- ✅ Migrations must be backwards compatible

---

**Enforcement Checklist (Before Every Commit):**
- [ ] No fake/placeholder data in responses
- [ ] All error cases handled with clear messages
- [ ] Token count measured and within targets
- [ ] Rust integration tested with CircuitBreaker
- [ ] Database migrations tested (up and down)
- [ ] Tests written and passing (≥80% coverage)
- [ ] Code reviewed against these principles
- [ ] Performance profiled for hot paths

**If ANY principle is violated, the code is NOT ready.**

---

## Executive Summary

This roadmap transforms In-Memoria from a pattern detector into a **project intelligence cache** that eliminates token waste during AI agent sessions. We will **reuse 90%+ of existing code** and add strategic enhancements to achieve the proposal's goals.

**Token Efficiency Target:**
- Cold start: <200 tokens (currently ~3000+ tokens)
- Feature work: Direct file access, zero exploration
- Session resume: <100 tokens to restore context
- Vague requests: Route to files in <50 tokens

---

## Current State Analysis

### ✅ What We Already Have

1. **Database Schema (schema.sql)** - 90% ready
   - ✅ `semantic_concepts` - stores concepts with relationships
   - ✅ `developer_patterns` - stores patterns with frequency
   - ✅ `file_intelligence` - stores per-file analysis
   - ✅ `project_metadata` - stores project info
   - ✅ `architectural_decisions` - exists but underutilized
   - ✅ `ai_insights` - exists but underutilized

2. **MCP Tools (17 total)** - Will consolidate to 10
   - CoreAnalysisTools (5): analyze_codebase, get_file_content, get_project_structure, search_codebase, generate_documentation
   - IntelligenceTools (6): learn_codebase_intelligence, get_semantic_insights, get_pattern_recommendations, predict_coding_approach, get_developer_profile, contribute_insights
   - AutomationTools (3): auto_learn_if_needed, get_learning_status, quick_setup
   - MonitoringTools (3): get_system_status, get_intelligence_metrics, get_performance_status (system-level, not agent-facing)

3. **Engines** - Solid foundation
   - SemanticEngine: Rust-based AST analysis, concept extraction, codebase analysis
   - PatternEngine: Pattern extraction and learning

### ❌ What We Need to Add

1. **Project Blueprint System**
   - Tech stack detection (partial - frameworks detected)
   - Entry points mapping (missing)
   - Key directories mapping (missing)
   - Feature-to-file mapping (missing)

2. **Work Context/Session System**
   - Session tracking (missing)
   - Current work context (missing)
   - Pending tasks tracking (missing)
   - Blockers tracking (missing)

3. **Smart Navigation**
   - Request routing logic (missing)
   - Feature-to-file resolution (missing)
   - Next-file suggestions (missing)

4. **Tool Consolidation** (optional optimization)
   - 17 tools → 4 focused interfaces
   - Can be done later without breaking changes

---

## Implementation Strategy: Evolution Through Consolidation

**Key Principle:** ZERO new tools. Instead, we ENHANCE existing tools and then CONSOLIDATE in Phase 4.

### Phase 1: Project Blueprint Enhancement (Week 1)
**Goal:** Add missing project intelligence by enhancing existing tools

#### 1.1 Extend Database Schema (schema.sql)
Add new tables without touching existing ones:

```sql
-- Feature to file mapping
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

-- Entry points mapping
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

-- Key directories mapping
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

CREATE INDEX IF NOT EXISTS idx_feature_map_project ON feature_map(project_path);
CREATE INDEX IF NOT EXISTS idx_feature_map_name ON feature_map(feature_name);
CREATE INDEX IF NOT EXISTS idx_entry_points_project ON entry_points(project_path);
CREATE INDEX IF NOT EXISTS idx_key_directories_project ON key_directories(project_path);
```

**Files to modify:**
- `src/storage/schema.sql` - Add new tables
- `src/storage/migrations.ts` - Add migration for new schema
- `src/storage/sqlite-db.ts` - Add methods for new tables

**Reuse:** Existing migration system, existing database connection

#### 1.2 Enhance SemanticEngine with Blueprint Detection
Add blueprint detection to existing `analyzeCodebase()` method:

```typescript
// In src/engines/semantic-engine.ts
async analyzeCodebase(path: string): Promise<CodebaseAnalysisResult> {
  const result = await /* existing analysis */;

  // NEW: Detect entry points
  const entryPoints = await this.detectEntryPoints(path, result.frameworks);

  // NEW: Map key directories
  const keyDirectories = await this.mapKeyDirectories(path);

  return {
    ...result,
    entryPoints,    // Add entry points
    keyDirectories  // Add key directories
  };
}

private async detectEntryPoints(path: string, frameworks: string[]): Promise<EntryPoint[]> {
  // Detect based on framework patterns
  // - React: src/index.tsx, src/App.tsx
  // - Express: server.js, app.js, index.js
  // - FastAPI: main.py, app.py
  // - Svelte: src/routes/+page.svelte
}

private async mapKeyDirectories(path: string): Promise<KeyDirectory[]> {
  // Map common directory patterns
  // - src/components, src/utils, src/services
  // - lib/, utils/, middleware/
  // - Based on file intelligence data
}
```

**Files to modify:**
- `src/engines/semantic-engine.ts` - Add blueprint detection
- `src/types.ts` - Add Blueprint types

**Reuse:** Existing Rust analyzer, existing file system traversal

#### 1.3 Add Blueprint Tool + Enhance Learning Tool
Add ONE focused tool for blueprint access, and enhance learning to include blueprint:

```typescript
// In src/mcp-server/tools/intelligence-tools.ts
// ENHANCE existing learn_codebase_intelligence to include:
async learnCodebaseIntelligence(args): Promise<{
  success: boolean;
  conceptsLearned: number;
  patternsLearned: number;
  insights: string[];
  timeElapsed: number;
  // NEW: Add blueprint data to response
  blueprint: {
    techStack: string[];
    entryPoints: Record<string, string>;
    keyDirectories: Record<string, string>;
    architecture: string;
  };
}> {
  // Existing learning logic...

  // NEW: Also compute and store blueprint
  const blueprint = await this.buildProjectBlueprint(args.path);

  return {
    ...existingResult,
    blueprint  // Add to response
  };
}
```

```typescript
// ALSO ADD new focused tool for fast blueprint access:
{
  name: 'get_project_blueprint',
  description: 'Get instant project blueprint - eliminates cold start exploration',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string' },
      includeFeatureMap: { type: 'boolean', default: true }
    }
  }
}
```

**Files to modify:**
- `src/mcp-server/tools/intelligence-tools.ts` - Enhance learning + add 1 blueprint tool
- `src/mcp-server/types.ts` - Add Blueprint types

**Reuse:** Existing infrastructure. Add 1 tool for ergonomics (17 → 11 so far).

---

### Phase 2: Work Context System (Week 2)
**Goal:** Add session tracking and work memory

#### 2.1 Extend Database Schema
Add session tracking tables:

```sql
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

CREATE INDEX IF NOT EXISTS idx_work_sessions_project ON work_sessions(project_path);
CREATE INDEX IF NOT EXISTS idx_work_sessions_updated ON work_sessions(last_updated DESC);
CREATE INDEX IF NOT EXISTS idx_project_decisions_key ON project_decisions(project_path, decision_key);
```

**Files to modify:**
- `src/storage/schema.sql` - Add session tables
- `src/storage/migrations.ts` - Add migration
- `src/storage/sqlite-db.ts` - Add session methods

#### 2.2 Enhance Existing Tools with Session Data
**Don't add new tools** - enhance existing `get_developer_profile` and `contribute_insights`:

```typescript
// In src/mcp-server/tools/intelligence-tools.ts

// ENHANCE get_developer_profile to include session context
async getDeveloperProfile(args: {
  includeRecentActivity?: boolean;
  includeWorkContext?: boolean;  // NEW parameter
}): Promise<DeveloperProfile> {
  const profile = /* existing profile logic */;

  // NEW: Add work session context if requested
  if (args.includeWorkContext) {
    const session = this.database.getCurrentWorkSession();
    profile.currentWork = {
      lastFeature: session.last_feature,
      currentFiles: session.current_files,
      pendingTasks: session.pending_tasks,
      recentDecisions: this.database.getRecentDecisions()
    };
  }

  return profile;
}

// ENHANCE contribute_insights to accept session updates
async contributeInsights(args: AIInsights & {
  sessionUpdate?: {  // NEW optional parameter
    files?: string[];
    feature?: string;
    tasks?: string[];
    decisions?: Record<string, string>;
  }
}): Promise<{...}> {
  // Existing insight storage...

  // NEW: Also update work session if provided
  if (args.sessionUpdate) {
    await this.updateWorkSession(args.sessionUpdate);
  }

  return result;
}
```

**Files to modify:**
- `src/mcp-server/tools/intelligence-tools.ts` - Enhance 2 existing tools

**Reuse:** Existing tools, just add optional parameters. NO NEW TOOLS.

---

### Phase 3: Smart Navigation & Routing (Week 3)
**Goal:** Enable instant file routing from vague requests

#### 3.1 Implement Feature-to-File Mapping
Enhance pattern engine to build feature maps:

```typescript
// In src/engines/pattern-engine.ts
async buildFeatureMap(path: string): Promise<FeatureMap[]> {
  // Analyze directory structure and naming patterns
  // - Auth files: **/auth/**, **/authentication/**, login*, signup*
  // - API files: **/api/**, **/routes/**, **/endpoints/**
  // - UI components: **/components/**, **/views/**, **/pages/**
  // - Database: **/db/**, **/models/**, **/schemas/**

  // Store in feature_map table
}
```

**Files to modify:**
- `src/engines/pattern-engine.ts` - Add feature mapping
- `src/storage/sqlite-db.ts` - Add feature map methods

#### 3.2 Enhance Existing Navigation Tools
**Don't add a new tool** - enhance `predict_coding_approach` to include file routing:

```typescript
// In src/mcp-server/tools/intelligence-tools.ts

// ENHANCE predict_coding_approach to include smart routing
async predictCodingApproach(args: {
  problemDescription: string;
  context?: Record<string, any>;
  includeFileRouting?: boolean;  // NEW parameter
}): Promise<CodingApproachPrediction & {
  fileRouting?: {  // NEW response field
    intendedFeature: string;
    targetFiles: string[];
    workType: string;
    suggestedStartPoint: string;
  }
}> {
  const prediction = await this.patternEngine.predictApproach(
    args.problemDescription,
    args.context || {}
  );

  // NEW: Add intelligent file routing
  if (args.includeFileRouting) {
    const routing = await this.routeRequest(args.problemDescription);
    prediction.fileRouting = routing;
  }

  return prediction;
}

// ENHANCE get_pattern_recommendations to suggest related files
async getPatternRecommendations(args: CodingContext & {
  includeRelatedFiles?: boolean;  // NEW parameter
}): Promise<{
  recommendations: PatternRecommendation[];
  reasoning: string;
  relatedFiles?: string[];  // NEW response field
}> {
  const recommendations = /* existing logic */;

  // NEW: Suggest files where patterns are used
  if (args.includeRelatedFiles) {
    const files = await this.findFilesUsingPatterns(recommendations);
    return { ...result, relatedFiles: files };
  }

  return result;
}
```

**Files to modify:**
- `src/mcp-server/tools/intelligence-tools.ts` - Enhance 2 existing tools

**Reuse:** Existing tools, add optional parameters for routing. NO NEW TOOLS.

---

### Phase 4: Tool Consolidation (Week 4) - CRITICAL PRIORITY
**Goal:** Consolidate 17 tools → 10 focused, ergonomic tools

Balance between simplicity (fewer tools) and usability (clear purpose per tool).

#### 4.1 Tool Consolidation Strategy: 17 → 10 Tools

**Target Architecture:**

```typescript
// === CORE LEARNING & INTELLIGENCE (3 tools) ===

// 1. learn_codebase - Main learning entry point
interface LearnCodebase {
  path: string;
  force?: boolean;
  // Returns: blueprint, concepts learned, patterns discovered
}

// 2. get_project_blueprint - Fast project context access
interface GetProjectBlueprint {
  path?: string;
  includeFeatureMap?: boolean;
  // Returns: tech stack, entry points, key directories, architecture
}

// 3. get_semantic_insights - Query learned concepts
interface GetSemanticInsights {
  query?: string;
  conceptType?: string;
  limit?: number;
  // Returns: concepts, relationships, usage patterns
}

// === WORK CONTEXT & SESSIONS (2 tools) ===

// 4. get_developer_profile - Get coding patterns and preferences
interface GetDeveloperProfile {
  includeRecentActivity?: boolean;
  includeWorkContext?: boolean;  // NEW: session context
  // Returns: patterns, style, expertise, current work context
}

// 5. contribute_insights - Record insights and update session
interface ContributeInsights {
  type: string;
  content: object;
  confidence: number;
  sessionUpdate?: object;  // NEW: update work context
  // Returns: success, insightId, session updated
}

// === SMART NAVIGATION & RECOMMENDATIONS (2 tools) ===

// 6. predict_coding_approach - Get approach + file routing
interface PredictCodingApproach {
  problemDescription: string;
  context?: object;
  includeFileRouting?: boolean;  // NEW: route to files
  // Returns: approach, patterns, complexity, target files
}

// 7. get_pattern_recommendations - Get patterns + related files
interface GetPatternRecommendations {
  problemDescription: string;
  currentFile?: string;
  includeRelatedFiles?: boolean;  // NEW: suggest files
  // Returns: patterns, examples, confidence, related files
}

// === CODEBASE ANALYSIS (2 tools) ===

// 8. analyze_codebase - Comprehensive analysis
interface AnalyzeCodebase {
  path: string;
  // Returns: languages, frameworks, complexity, concepts, patterns
}

// 9. search_codebase - Smart search (semantic/text/pattern)
interface SearchCodebase {
  query: string;
  type?: 'semantic' | 'text' | 'pattern';
  language?: string;
  limit?: number;
  // Returns: results with scores, context, metadata
}

// === SYSTEM & AUTOMATION (1 tool) ===

// 10. auto_learn_if_needed - Automatic learning check
interface AutoLearnIfNeeded {
  path?: string;
  force?: boolean;
  includeProgress?: boolean;
  // Returns: action taken, status, intelligence metrics
}
```

#### 4.2 Consolidation Map: What Gets Merged

**Keep as Enhanced Tools (10 tools):**

1. ✅ **learn_codebase_intelligence** → Enhanced with blueprint data
2. ✅ **get_project_blueprint** → NEW tool (from blueprint enhancement)
3. ✅ **get_semantic_insights** → Keep, already focused
4. ✅ **get_developer_profile** → Enhanced with work context
5. ✅ **contribute_insights** → Enhanced with session updates
6. ✅ **predict_coding_approach** → Enhanced with file routing
7. ✅ **get_pattern_recommendations** → Enhanced with file suggestions
8. ✅ **analyze_codebase** → Keep, core functionality
9. ✅ **search_codebase** → Keep, essential for agents
10. ✅ **auto_learn_if_needed** → Keep, automation entry point

**Remove/Merge (7 tools):**

❌ **get_file_content** → Merge into `analyze_codebase` (pass specific file path)
❌ **get_project_structure** → Merge into `get_project_blueprint` (part of blueprint)
❌ **generate_documentation** → Remove (not agent-facing, can be separate utility)
❌ **get_learning_status** → Merge into `get_project_blueprint` (status in blueprint)
❌ **quick_setup** → Merge into `auto_learn_if_needed` (same purpose)
❌ **get_system_status** → Keep separate but not counted (monitoring/debugging)
❌ **get_intelligence_metrics** → Keep separate but not counted (monitoring/debugging)
❌ **get_performance_status** → Keep separate but not counted (monitoring/debugging)

**Files to modify:**
- `src/mcp-server/tools/core-analysis.ts` → Keep but remove get_file_content, get_project_structure, generate_documentation
- `src/mcp-server/tools/intelligence-tools.ts` → Add get_project_blueprint, enhance existing tools
- `src/mcp-server/tools/automation-tools.ts` → Keep auto_learn_if_needed, remove others
- `src/mcp-server/tools/monitoring-tools.ts` → Keep as-is (system-level, not counted in 10)

---

## Migration and Database Schema Updates

### Adding New Tables Without Breakage

```typescript
// In src/storage/migrations.ts
{
  version: 2,
  description: 'Add project blueprint tables',
  up: (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS feature_map (...);
      CREATE TABLE IF NOT EXISTS entry_points (...);
      CREATE TABLE IF NOT EXISTS key_directories (...);
      -- Indexes
    `);
  },
  down: (db) => {
    db.exec(`DROP TABLE IF EXISTS feature_map;`);
    db.exec(`DROP TABLE IF EXISTS entry_points;`);
    db.exec(`DROP TABLE IF EXISTS key_directories;`);
  }
},
{
  version: 3,
  description: 'Add work session tracking',
  up: (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS work_sessions (...);
      CREATE TABLE IF NOT EXISTS project_decisions (...);
      -- Indexes
    `);
  },
  down: (db) => {
    db.exec(`DROP TABLE IF EXISTS work_sessions;`);
    db.exec(`DROP TABLE IF EXISTS project_decisions;`);
  }
}
```

**Key principle:** All migrations are additive - no existing tables are modified

---

## Reuse Strategy: Maximizing Existing Code

### What We're Reusing (90%+)

1. **Database Layer** - 100% reuse
   - SQLiteDatabase class - unchanged
   - DatabaseMigrator - enhanced with new migrations
   - Existing table schemas - untouched

2. **Engines** - 95% reuse
   - SemanticEngine - add methods, don't modify existing
   - PatternEngine - extend with feature mapping
   - Rust analyzer - unchanged

3. **MCP Infrastructure** - 100% reuse
   - Server setup - unchanged
   - Tool registration - just add new tools
   - Type system - extend with new types

4. **Utilities** - 100% reuse
   - ProgressTracker - unchanged
   - CircuitBreaker - unchanged
   - Error handling - unchanged

### What We're Adding (10%)

1. **New Database Tables** - 5 tables
2. **New Tool Methods** - ~6 new tools
3. **Blueprint Detection Logic** - 2 new methods
4. **Session Management** - 1 new class
5. **Routing Logic** - 1 new method

---

## Testing Strategy

### Phase-by-Phase Testing

**Phase 1 Tests:**
```typescript
describe('Project Blueprint', () => {
  test('detects entry points for React projects');
  test('detects entry points for Express projects');
  test('maps key directories correctly');
  test('builds feature map from directory structure');
});
```

**Phase 2 Tests:**
```typescript
describe('Work Sessions', () => {
  test('creates new work session');
  test('resumes previous session');
  test('updates work context');
  test('records project decisions');
});
```

**Phase 3 Tests:**
```typescript
describe('Smart Navigation', () => {
  test('routes "work on auth" to auth files');
  test('routes "fix login bug" to login-related files');
  test('suggests next files based on current work');
});
```

### Integration Tests
```typescript
describe('End-to-End Token Efficiency', () => {
  test('cold start provides project context in <200 tokens');
  test('session resume loads context in <100 tokens');
  test('vague request routing in <50 tokens');
});
```

---

## Success Metrics

### Token Efficiency Metrics
| Scenario | Before | After | Savings |
|----------|--------|-------|---------|
| Cold Start | 3000+ tokens | <200 tokens | 93% |
| Session Resume | Manual exploration | <100 tokens | 99% |
| Vague Request | 2000+ tokens | <50 tokens | 98% |
| Feature Work | List → explore → find | Direct access | 95% |

### Code Quality Metrics
- **Code Reuse:** 90%+ existing code reused
- **Breaking Changes:** Zero breaking changes to existing APIs
- **Test Coverage:** Maintain 80%+ coverage
- **Migration Path:** Smooth migration for all users

---

## Timeline

### Week 1: Project Blueprint
- Day 1-2: Database schema + migrations
- Day 3-4: Blueprint detection logic
- Day 5-7: Tool integration + testing

### Week 2: Work Context
- Day 1-2: Session tables + migrations
- Day 3-4: Session management tools
- Day 5-7: Context capture + testing

### Week 3: Smart Navigation
- Day 1-2: Feature mapping logic
- Day 3-4: Routing algorithm
- Day 5-7: Tool integration + testing

### Week 4: Tool Consolidation (CRITICAL)
- Day 1-2: Remove/merge 7 redundant tools
- Day 3-4: Enhance remaining 10 tools with new capabilities
- Day 5: Update server registration
- Day 6-7: Update documentation + migration guide

---

## Risk Mitigation

### Potential Risks

1. **Database Schema Changes**
   - **Risk:** Migration failures
   - **Mitigation:** Additive-only changes, comprehensive rollback scripts

2. **Performance Impact**
   - **Risk:** New tables slow down queries
   - **Mitigation:** Proper indexing, query optimization, caching

3. **Breaking Changes**
   - **Risk:** Existing users affected
   - **Mitigation:** Zero breaking changes, backward compatibility

4. **Complexity Creep**
   - **Risk:** Code becomes harder to maintain
   - **Mitigation:** Strict adherence to reuse strategy, clear separation of concerns

---

## Conclusion

This roadmap achieves the Session Amnesia Solution's goals through **incremental evolution** rather than revolution. By reusing 90%+ of existing code and adding strategic enhancements, we:

1. ✅ Maintain backward compatibility
2. ✅ Minimize code breakage risk
3. ✅ Achieve 93%+ token savings
4. ✅ Enable seamless AI agent workflows
5. ✅ Keep development timeline realistic (4 weeks)

**Next Steps:**
1. Review and approve this roadmap
2. Create detailed implementation tickets for Phase 1
3. Set up testing infrastructure
4. Begin Phase 1 implementation

---

---

## Pre-Implementation Checklist

Before writing any code, confirm:

- [x] Roadmap principles reviewed and accepted
- [x] Quality standards understood and committed to
- [ ] Phase 1 database schema designed and reviewed
- [ ] Migration strategy tested with current database
- [ ] Token count targets confirmed for each tool
- [ ] Rust integration patterns reviewed
- [ ] Test strategy planned for new functionality
- [ ] Backup plan for rollback if issues arise

---

**Document Status:** Ready for Implementation
**Last Updated:** 2025-10-14
**Quality Commitment:** Every line of code will be production-ready, tested, and token-efficient
**Next Step:** Begin Phase 1 with database schema changes
