# AI Agent Instructions for In Memoria MCP

This file provides instructions for AI agents (Claude Code, GitHub Copilot, Cursor, etc.) on how to effectively use the In Memoria MCP server for intelligent codebase navigation and analysis.

## Quick Start Checklist

Every new session, follow this pattern:

- [ ] 1. Call `get_project_blueprint()` to get instant context
- [ ] 2. Check `learningStatus` in the blueprint response
- [ ] 3. If `recommendation === 'learning_recommended'`, call `auto_learn_if_needed()`
- [ ] 4. Use the blueprint to understand tech stack, entry points, and key directories
- [ ] 5. Leverage feature maps and semantic search for navigation

## Tool Reference Card

### 🎯 Most Important Tools (Use These First)

| Tool | When to Use | Key Feature |
|------|-------------|-------------|
| `get_project_blueprint` | **Every session start** | Instant context: tech stack, entry points, architecture, learning status |
| `auto_learn_if_needed` | When learning recommended | Smart learning with automatic staleness detection |
| `predict_coding_approach` | Before implementing | Get approach + file routing + patterns in one call |
| `search_codebase` | Finding code | Semantic (meaning), text (keywords), or pattern search |
| `analyze_codebase` | Understanding files/dirs | Token-efficient analysis with top concepts/patterns |

### 📊 Complete Tool List (10 Core + 3 Monitoring)

#### Core Intelligence Tools (10)

1. **`analyze_codebase`** - Analyze files or directories
   ```typescript
   { path: string, includeFileContent?: boolean }
   ```
   Returns: Language, concepts (top 10), patterns (top 5), complexity

2. **`search_codebase`** - Smart search (semantic/text/pattern)
   ```typescript
   { query: string, type?: 'semantic'|'text'|'pattern', limit?: number }
   ```
   Returns: Scored results with context

3. **`learn_codebase_intelligence`** - Deep learning
   ```typescript
   { path: string, force?: boolean }
   ```
   Returns: Blueprint, concepts learned, patterns discovered

4. **`get_project_blueprint`** - Instant project context ⭐
   ```typescript
   { path?: string, includeFeatureMap?: boolean }
   ```
   Returns: Tech stack, entry points, key dirs, feature map, **learning status**

5. **`get_semantic_insights`** - Query learned concepts
   ```typescript
   { query?: string, conceptType?: string, limit?: number }
   ```
   Returns: Concepts, relationships, usage contexts

6. **`get_pattern_recommendations`** - Pattern suggestions
   ```typescript
   { problemDescription: string, currentFile?: string, includeRelatedFiles?: boolean }
   ```
   Returns: Patterns, examples, confidence, related files

7. **`predict_coding_approach`** - Implementation guidance
   ```typescript
   { problemDescription: string, context?: object, includeFileRouting?: boolean }
   ```
   Returns: Approach, patterns, complexity, target files

8. **`get_developer_profile`** - Coding style and conventions
   ```typescript
   { includeRecentActivity?: boolean, includeWorkContext?: boolean }
   ```
   Returns: Naming conventions, structural patterns, expertise

9. **`contribute_insights`** - Record architectural decisions
   ```typescript
   { type: string, content: object, confidence: number, sourceAgent: string }
   ```
   Returns: Success, insight ID

10. **`auto_learn_if_needed`** - Smart auto-learning ⭐
    ```typescript
    { path?: string, force?: boolean, skipLearning?: boolean, includeSetupSteps?: boolean }
    ```
    Returns: Action taken, intelligence status, setup steps

#### Monitoring Tools (3 - for debugging)

11. **`get_system_status`** - System health check
12. **`get_intelligence_metrics`** - Concept/pattern metrics
13. **`get_performance_status`** - Performance diagnostics

## Common Use Cases

### Use Case 1: Starting Fresh in a New Codebase

```typescript
// Step 1: Get the lay of the land
const blueprint = await mcp.get_project_blueprint({
  path: '.',
  includeFeatureMap: true
});

console.log('Tech Stack:', blueprint.techStack);
console.log('Entry Points:', blueprint.entryPoints);
console.log('Key Directories:', blueprint.keyDirectories);

// Step 2: Learn if needed
if (blueprint.learningStatus.recommendation !== 'ready') {
  await mcp.auto_learn_if_needed({
    path: '.',
    includeProgress: true
  });
}

// Step 3: You now have full context and intelligence!
```

### Use Case 2: Implementing a New Feature

```typescript
// Step 1: Get implementation approach with file routing
const approach = await mcp.predict_coding_approach({
  problemDescription: 'Add user password reset functionality',
  context: {
    feature: 'authentication',
    relatedFiles: ['src/auth/login.ts']
  },
  includeFileRouting: true
});

// Step 2: Get pattern recommendations for consistency
const patterns = await mcp.get_pattern_recommendations({
  problemDescription: 'Password reset with email validation',
  currentFile: approach.fileRouting.suggestedStartPoint,
  includeRelatedFiles: true
});

// Step 3: Search for similar implementations
const examples = await mcp.search_codebase({
  query: 'email validation auth',
  type: 'semantic',
  limit: 5
});

// Now you have: approach + target files + patterns + examples
```

### Use Case 3: Understanding Existing Code

```typescript
// Step 1: Analyze the mysterious directory
const analysis = await mcp.analyze_codebase({
  path: './src/services/payment'
});

// Step 2: Get semantic insights about key concepts
const insights = await mcp.get_semantic_insights({
  query: 'payment processing',
  limit: 10
});

// Step 3: Find all related code
const related = await mcp.search_codebase({
  query: 'stripe payment integration',
  type: 'semantic'
});

// Now you understand: structure + concepts + usage
```

### Use Case 4: Code Review / Refactoring

```typescript
// Step 1: Understand the coding conventions
const profile = await mcp.get_developer_profile({
  includeRecentActivity: true
});

// Step 2: Check if code follows project patterns
const patterns = await mcp.get_pattern_recommendations({
  problemDescription: 'Review API error handling consistency',
  currentFile: 'src/api/routes/users.ts',
  includeRelatedFiles: true
});

// Step 3: Find similar implementations for comparison
const similar = await mcp.search_codebase({
  query: 'try catch error middleware',
  type: 'pattern'
});

// Now you can: validate consistency + suggest improvements
```

## 🎯 Decision Tree: Which Tool to Use?

```
Need instant project context?
  → get_project_blueprint()

Need to learn/update intelligence?
  → auto_learn_if_needed() (smart) OR learn_codebase_intelligence() (force)

Need implementation guidance?
  → predict_coding_approach() with includeFileRouting=true

Need to find code?
  ├─ By meaning/concept? → search_codebase(type='semantic')
  ├─ By keyword? → search_codebase(type='text')
  └─ By pattern? → search_codebase(type='pattern')

Need to understand a file?
  → analyze_codebase(path='./specific/file.ts')

Need coding patterns?
  → get_pattern_recommendations() with includeRelatedFiles=true

Need to understand what codebase knows?
  → get_semantic_insights()

Need coding style/conventions?
  → get_developer_profile()

Made an architectural decision?
  → contribute_insights()

Debugging In Memoria?
  → get_system_status() / get_intelligence_metrics() / get_performance_status()
```

## 💡 Pro Tips for AI Agents

### 1. Always Check Learning Status First
```typescript
const blueprint = await mcp.get_project_blueprint({ path: '.' });
if (blueprint.learningStatus.recommendation !== 'ready') {
  // Learning needed - call auto_learn_if_needed()
}
```

### 2. Use Feature Maps for Instant Navigation
```typescript
const blueprint = await mcp.get_project_blueprint({
  path: '.',
  includeFeatureMap: true  // ← Get feature-to-file mapping
});

// Now you know which files handle which features:
// blueprint.featureMap['authentication'] = ['src/auth/login.ts', ...]
```

### 3. Combine Tools for Maximum Context
```typescript
// Get everything in 3 calls:
const [blueprint, approach, patterns] = await Promise.all([
  mcp.get_project_blueprint({ path: '.', includeFeatureMap: true }),
  mcp.predict_coding_approach({ problemDescription: '...', includeFileRouting: true }),
  mcp.get_pattern_recommendations({ problemDescription: '...', includeRelatedFiles: true })
]);

// You now have: architecture + approach + files + patterns
```

### 4. Leverage Token-Efficient Responses
In Memoria automatically limits responses to avoid overwhelming the LLM:
- File analysis: Top 10 concepts, top 5 patterns
- Directory analysis: Top 15 concepts, top 10 patterns
- Use `get_semantic_insights` if you need more concepts

### 5. Trust the Semantic Search
```typescript
// ✅ GOOD: Semantic search understands meaning
await mcp.search_codebase({
  query: 'user authentication flow',
  type: 'semantic'
});

// ❌ BAD: Text search only matches keywords
await mcp.search_codebase({
  query: 'user authentication flow',
  type: 'text'  // Won't find conceptually related code
});
```

### 6. Record Insights for Future Sessions
```typescript
// When you discover something important:
await mcp.contribute_insights({
  type: 'architectural_decision',
  content: {
    decision: 'All database queries use Prisma ORM',
    reasoning: 'Type safety and migration management',
    affectedFiles: ['src/db/', 'prisma/']
  },
  confidence: 0.95,
  sourceAgent: 'github-copilot'  // or 'claude-code', 'cursor', etc.
});
```

## 🚫 Common Mistakes to Avoid

### ❌ DON'T: Skip the learning check
```typescript
// Bad - might work with stale/missing data
const results = await mcp.search_codebase({ query: '...' });
```

### ✅ DO: Always check and learn if needed
```typescript
// Good - ensure intelligence is fresh
const blueprint = await mcp.get_project_blueprint({ path: '.' });
if (blueprint.learningStatus.recommendation !== 'ready') {
  await mcp.auto_learn_if_needed({ path: '.' });
}
const results = await mcp.search_codebase({ query: '...' });
```

### ❌ DON'T: Use text search for concepts
```typescript
// Bad - won't find semantically related code
await mcp.search_codebase({ query: 'payment processing', type: 'text' });
```

### ✅ DO: Use semantic search for concepts
```typescript
// Good - finds conceptually related code
await mcp.search_codebase({ query: 'payment processing', type: 'semantic' });
```

### ❌ DON'T: Ignore pattern recommendations
```typescript
// Bad - implementing without checking patterns
// Just start coding...
```

### ✅ DO: Follow project patterns
```typescript
// Good - check patterns first
const patterns = await mcp.get_pattern_recommendations({
  problemDescription: 'Create new API endpoint',
  includeRelatedFiles: true
});
// Now implement following the discovered patterns
```

### ❌ DON'T: Force re-learning unnecessarily
```typescript
// Bad - wastes time re-learning when data is fresh
await mcp.auto_learn_if_needed({ path: '.', force: true });
```

### ✅ DO: Trust the staleness detection
```typescript
// Good - only learns if needed
await mcp.auto_learn_if_needed({ path: '.', force: false });
```

## 🔄 Recommended Session Flow

```typescript
// === SESSION START ===

// 1. Get instant context + learning status
const blueprint = await mcp.get_project_blueprint({
  path: '.',
  includeFeatureMap: true
});

// 2. Learn if needed (automatic staleness check)
if (blueprint.learningStatus.recommendation !== 'ready') {
  await mcp.auto_learn_if_needed({
    path: '.',
    includeProgress: false  // Set true if you want progress updates
  });
}

// 3. Understand coding style (once per session)
const profile = await mcp.get_developer_profile({
  includeRecentActivity: false,
  includeWorkContext: false
});

// === DURING WORK ===

// 4. For each task, get approach + routing
const approach = await mcp.predict_coding_approach({
  problemDescription: userRequest,
  includeFileRouting: true
});

// 5. Get patterns for consistency
const patterns = await mcp.get_pattern_recommendations({
  problemDescription: userRequest,
  currentFile: approach.fileRouting?.suggestedStartPoint,
  includeRelatedFiles: true
});

// 6. Search for relevant code as needed
const examples = await mcp.search_codebase({
  query: relevantConcept,
  type: 'semantic',
  limit: 5
});

// 7. Analyze specific files as needed
const fileAnalysis = await mcp.analyze_codebase({
  path: targetFile
});

// === SESSION END (Optional) ===

// 8. Record any insights discovered
await mcp.contribute_insights({
  type: 'architectural_decision',
  content: { /* ... */ },
  confidence: 0.9,
  sourceAgent: 'your-agent-name'
});
```

## 📊 Response Format Examples

### get_project_blueprint Response
```json
{
  "techStack": ["TypeScript", "React", "Node.js", "Express"],
  "entryPoints": {
    "web": "src/index.tsx",
    "api": "src/server.ts"
  },
  "keyDirectories": {
    "components": "src/components",
    "services": "src/services",
    "api": "src/api"
  },
  "architecture": "client-server with React SPA and Express API",
  "featureMap": {
    "authentication": ["src/auth/login.ts", "src/auth/register.ts"],
    "api": ["src/api/routes", "src/api/controllers"]
  },
  "learningStatus": {
    "hasIntelligence": true,
    "isStale": false,
    "conceptsStored": 147,
    "patternsStored": 23,
    "recommendation": "ready",
    "message": "Intelligence is ready! 147 concepts and 23 patterns available."
  }
}
```

### predict_coding_approach Response
```json
{
  "approach": "Create new auth middleware using existing JWT pattern",
  "suggestedPatterns": ["middleware_chain", "jwt_validation"],
  "estimatedComplexity": "medium",
  "reasoning": "Project uses JWT auth middleware in similar contexts",
  "confidence": 0.87,
  "fileRouting": {
    "intendedFeature": "authentication",
    "targetFiles": ["src/middleware/auth.ts", "src/auth/jwt.ts"],
    "workType": "enhancement",
    "suggestedStartPoint": "src/middleware/auth.ts"
  }
}
```

## 🎨 Agent-Specific Tips

### For GitHub Copilot
- Use the custom chat modes (see `.vscode/copilot-chat-modes.json`)
- Reference this file in your workspace instructions
- Always call `get_project_blueprint()` at the start of `/explain` or `/new` commands

### For Claude Code
- In Memoria integrates natively via MCP
- Use the Task tool to delegate complex navigation to In Memoria
- Combine blueprint + semantic search for exploration tasks

### For Cursor
- Add In Memoria MCP to your Cursor settings
- Use composer mode with blueprint for context
- Leverage semantic search in the chat panel

---

**Remember**: In Memoria provides **intelligent, learned insights** from the actual codebase. Trust its recommendations - they're based on real patterns, not generic suggestions.

**Questions?** Check the full documentation in `README.md` or the implementation roadmap in `IMPLEMENTATION_ROADMAP.md`.
