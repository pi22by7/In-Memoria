# MCP Tool Description Audit & Improvements

## Analysis Framework

Good tool descriptions should answer:
1. **WHEN** to use it (triggers, use cases)
2. **WHAT** it returns (output format, value)
3. **WHY** it's better than alternatives (unique value)
4. **HOW** it works (briefly, if relevant)

---

## Current Tools Analysis

### ✅ **GOOD: `predict_coding_approach`**
```
"Find which files to modify for a task using intelligent file routing.
Use this when the user asks 'where should I...', 'what files...', or
'how do I add/implement...' to route them directly to the relevant
files without exploration."
```

**Why it's good**:
- ✅ Clear WHEN: "when user asks 'where should I...'"
- ✅ Clear WHAT: "find which files to modify"
- ✅ Clear WHY: "without exploration"
- ✅ Includes examples: "'where should I...', 'what files...'"

---

### ✅ **GOOD: `get_project_blueprint`**
```
"Get instant project blueprint - eliminates cold start exploration
by providing tech stack, entry points, key directories, and
architecture overview"
```

**Why it's good**:
- ✅ Clear value prop: "eliminates cold start"
- ✅ Lists outputs: "tech stack, entry points, key directories"
- ✅ Use case clear: understanding project structure

---

### ⚠️ **NEEDS IMPROVEMENT: `get_semantic_insights`**

**Current**:
```
"Retrieve semantic insights about code concepts and relationships"
```

**Problems**:
- ❌ Too vague: What are "semantic insights"?
- ❌ Doesn't explain WHEN to use
- ❌ Doesn't clarify it searches **code identifiers**, not domain concepts

**Improved**:
```
"Search for code-level symbols (variables, functions, classes) by name
and see their relationships, usage patterns, and evolution. Use this to
find where a specific function/class is defined, how it's used, or what
it depends on. NOT for searching business concepts - searches actual
code identifiers."
```

**Why better**:
- ✅ Clarifies it's code-level search, not domain search
- ✅ Gives examples: "where function is defined", "what it depends on"
- ✅ Sets expectations: "NOT for business concepts"

---

### ⚠️ **NEEDS IMPROVEMENT: `get_pattern_recommendations`**

**Current**:
```
"Get intelligent pattern recommendations based on coding context,
with optional related file suggestions"
```

**Problems**:
- ❌ "Intelligent" is vague marketing speak
- ❌ Doesn't explain it learns from YOUR code
- ❌ Doesn't clarify WHEN to use

**Improved**:
```
"Get coding pattern recommendations learned from this codebase. Use
this when implementing new features to follow existing patterns
(e.g., 'create a new service class', 'add API endpoint'). Returns
patterns like Factory, Singleton, DI with confidence scores and
actual examples from your code. These are learned, not hardcoded."
```

**Why better**:
- ✅ Emphasizes "learned from this codebase" (unique value)
- ✅ Clear WHEN: "implementing new features"
- ✅ Examples: "'create service', 'add API endpoint'"
- ✅ Shows output: "confidence scores and examples"

---

### ⚠️ **NEEDS IMPROVEMENT: `search_codebase`**

**Current**:
```
"Search the codebase using semantic, text, or pattern-based queries"
```

**Problems**:
- ❌ Doesn't explain difference between search types
- ❌ Doesn't clarify when to use this vs `predict_coding_approach`
- ❌ "Semantic" search is misleading (it's not vector search currently)

**Improved**:
```
"Search for code by text matching or patterns. Use 'text' type for
finding specific strings/keywords in code. Use 'pattern' type for
regex/AST patterns. Note: For 'where should I work?' questions, use
predict_coding_approach instead - it's smarter and routes to files
directly."
```

**Why better**:
- ✅ Clarifies search types clearly
- ✅ Guides to better tool: "use predict_coding_approach instead"
- ✅ Sets clear expectations

---

### ⚠️ **NEEDS IMPROVEMENT: `analyze_codebase`**

**Current**:
```
"Analyze a codebase directory or single file - provides comprehensive
analysis including semantic concepts, patterns, complexity metrics,
and file content"
```

**Problems**:
- ❌ Overlaps with `get_project_blueprint` - unclear when to use which
- ❌ "Comprehensive" is vague
- ❌ Doesn't explain it's for **one-time analysis**, not persistent

**Improved**:
```
"One-time analysis of a specific file or directory. Returns AST
structure, complexity metrics, and detected patterns for that path
only. For project-wide understanding, use get_project_blueprint
instead (faster, uses learned intelligence). Use this for deep-dive
analysis of a specific file you're working on."
```

**Why better**:
- ✅ Clarifies "one-time" vs "project-wide"
- ✅ Guides to better tool when appropriate
- ✅ Clear use case: "deep-dive on specific file"

---

### ⚠️ **NEEDS IMPROVEMENT: `learn_codebase_intelligence`**

**Current**:
```
"Learn and extract intelligence from a codebase, building persistent knowledge"
```

**Problems**:
- ❌ Doesn't clarify this is a **prerequisite** for other tools
- ❌ Doesn't explain it's a one-time setup
- ❌ Missing guidance: when to re-run?

**Improved**:
```
"Build intelligence database from codebase (one-time setup, ~30-60s).
Required before using predict_coding_approach, get_project_blueprint,
or get_pattern_recommendations. Re-run with force=true if codebase
has significant changes. Most users should use auto_learn_if_needed
instead - it runs this automatically when needed."
```

**Why better**:
- ✅ Clarifies it's a prerequisite
- ✅ Sets time expectation: "30-60s"
- ✅ Guides to easier tool: "use auto_learn_if_needed"
- ✅ Explains when to re-run

---

### ✅ **GOOD: `auto_learn_if_needed`**

**Current**:
```
"Automatically learn from codebase if intelligence data is missing
or stale. Includes project setup and verification. Perfect for
seamless agent integration."
```

**Why it's good**:
- ✅ Clear automation: "if missing or stale"
- ✅ Clear value: "seamless integration"
- ✅ Sets expectations: "includes setup and verification"

**Small improvement**:
```
"Automatically learn from codebase if intelligence data is missing
or stale. Call this first before using other In-Memoria tools - it's
a no-op if data already exists. Includes project setup and
verification. Perfect for seamless agent integration."
```

---

### ⚠️ **NEEDS IMPROVEMENT: `get_developer_profile`**

**Current**:
```
"Get the learned developer profile including patterns, preferences, and expertise"
```

**Problems**:
- ❌ Not clear what "developer profile" means
- ❌ Doesn't explain WHEN this is useful
- ❌ Doesn't clarify it's about the **codebase's** patterns, not a human developer

**Improved**:
```
"Get patterns and conventions learned from this codebase's code style.
Shows frequently-used patterns (DI, Factory, etc.), naming conventions,
and architectural preferences. Use this to understand 'how we do things
here' before writing new code. Note: This is about the codebase's
style, not individual developers."
```

**Why better**:
- ✅ Clarifies "codebase's style" not "developer's profile"
- ✅ Clear use case: "understand how we do things here"
- ✅ Examples: "DI, Factory, naming conventions"

---

### ⚠️ **NEEDS IMPROVEMENT: `contribute_insights`**

**Current**:
```
"Allow AI agents to contribute insights back to the knowledge base.
IMPORTANT: The `content` field is REQUIRED and must contain the
actual insight details as a structured object."
```

**Problems**:
- ❌ Not clear WHEN an agent should use this
- ❌ Sounds like internal tool, not for general use
- ❌ The "IMPORTANT" note is implementation detail

**Improved**:
```
"Let AI agents save discovered insights (bug patterns, optimizations,
best practices) back to In-Memoria for future reference. Use this when
you discover a recurring pattern, potential bug, or refactoring
opportunity that other agents/sessions should know about. Creates
organizational memory across conversations."
```

**Why better**:
- ✅ Clear WHEN: "when you discover a recurring pattern"
- ✅ Clear value: "organizational memory"
- ✅ Examples: "bug patterns, optimizations"
- ✅ Removed implementation details

---

## Summary of Changes

### High Priority (Claude confused by these)

1. **`get_semantic_insights`** - Clarify it searches code identifiers, not domain concepts
2. **`search_codebase`** - Guide users to `predict_coding_approach` for routing
3. **`get_pattern_recommendations`** - Emphasize "learned from YOUR code"

### Medium Priority (Improves usability)

4. **`analyze_codebase`** - Clarify one-time vs project-wide
5. **`learn_codebase_intelligence`** - Explain prerequisite relationship
6. **`get_developer_profile`** - Clarify it's codebase style, not human profile

### Low Priority (Nice to have)

7. **`contribute_insights`** - Better explain when to use
8. **`auto_learn_if_needed`** - Small tweak: "call this first"

---

## Implementation Strategy

### Phase 1: Fix the Confusion (Critical)
Tools where Claude is using them wrong or not using them at all:

```typescript
// 1. predict_coding_approach - DONE ✅

// 2. get_semantic_insights
description: "Search for code-level symbols (variables, functions, classes) by name and see their relationships, usage patterns, and evolution. Use this to find where a specific function/class is defined, how it's used, or what it depends on. NOT for searching business concepts - searches actual code identifiers."

// 3. get_pattern_recommendations
description: "Get coding pattern recommendations learned from this codebase. Use this when implementing new features to follow existing patterns (e.g., 'create a new service class', 'add API endpoint'). Returns patterns like Factory, Singleton, DI with confidence scores and actual examples from your code. These are learned, not hardcoded."

// 4. search_codebase
description: "Search for code by text matching or patterns. Use 'text' type for finding specific strings/keywords in code. Use 'pattern' type for regex/AST patterns. Note: For 'where should I work?' questions, use predict_coding_approach instead - it's smarter and routes to files directly."
```

### Phase 2: Improve Clarity (Important)

```typescript
// 5. analyze_codebase
// 6. learn_codebase_intelligence
// 7. get_developer_profile
```

### Phase 3: Polish (Good to have)

```typescript
// 8. contribute_insights
// 9. auto_learn_if_needed
```

---

## Testing

After changes, test with these prompts to verify Claude picks the right tool:

**Test 1**: Should use `predict_coding_approach`
```
"Where should I add Ruby language support?"
"What files do I need to modify for database caching?"
```

**Test 2**: Should use `get_project_blueprint`
```
"What's the structure of this codebase?"
"Show me the project architecture"
```

**Test 3**: Should use `get_pattern_recommendations`
```
"I need to create a new service class - what patterns should I follow?"
"What's the established pattern for API endpoints here?"
```

**Test 4**: Should use `get_semantic_insights`
```
"Where is the processRequest function defined?"
"Show me relationships for the Database class"
```

**Test 5**: Should NOT use `search_codebase` (should use `predict_coding_approach`)
```
"Help me add authentication"
"Where should I implement caching?"
```
