# GitHub Copilot Instructions for In Memoria

This repository includes **In Memoria**, an intelligent MCP (Model Context Protocol) server that provides codebase intelligence through semantic analysis, pattern recognition, and smart navigation.

## Core Capabilities

In Memoria learns from codebases and provides:
- **Instant project context** - Tech stack, entry points, key directories, architecture overview
- **Semantic search** - Find code by meaning, not just keywords
- **Pattern recognition** - Discover coding patterns and best practices
- **Smart file routing** - Navigate to relevant files from vague requests
- **Coding approach predictions** - Get implementation suggestions based on learned patterns

## How to Use In Memoria MCP Tools

### 🚀 Quick Start Pattern

**ALWAYS start new sessions with:**
```typescript
// 1. Get instant project blueprint
const blueprint = await use_mcp_tool('in-memoria', 'get_project_blueprint', {
  path: '.',
  includeFeatureMap: true
});

// Check if learning is needed
if (blueprint.learningStatus.recommendation === 'learning_recommended') {
  // 2. Auto-learn from codebase if needed
  await use_mcp_tool('in-memoria', 'auto_learn_if_needed', {
    path: '.',
    includeProgress: true
  });
}
```

This eliminates cold-start exploration and gives you instant context.

### 📊 The 10 Core Tools (Use These Frequently)

#### 1. **analyze_codebase** - Comprehensive Analysis
Use for: Understanding files or directories
```typescript
// Analyze a specific file
await use_mcp_tool('in-memoria', 'analyze_codebase', {
  path: './src/components/Header.tsx'
});

// Analyze entire directory
await use_mcp_tool('in-memoria', 'analyze_codebase', {
  path: './src'
});
```
Returns: Languages, frameworks, complexity, top concepts, top patterns (token-efficient)

#### 2. **search_codebase** - Smart Search
Use for: Finding code by meaning, text, or patterns
```typescript
// Semantic search (finds by meaning)
await use_mcp_tool('in-memoria', 'search_codebase', {
  query: 'authentication logic',
  type: 'semantic',
  limit: 10
});

// Text search (fast keyword matching)
await use_mcp_tool('in-memoria', 'search_codebase', {
  query: 'fetchUserData',
  type: 'text'
});
```

#### 3. **get_project_blueprint** - Instant Context
Use for: Cold-start elimination, understanding project structure
```typescript
await use_mcp_tool('in-memoria', 'get_project_blueprint', {
  path: '.',
  includeFeatureMap: true
});
```
Returns: Tech stack, entry points, key directories, feature-to-file mapping, **learning status**

#### 4. **predict_coding_approach** - Implementation Guidance
Use for: Getting suggestions before writing code
```typescript
await use_mcp_tool('in-memoria', 'predict_coding_approach', {
  problemDescription: 'Add user profile editing feature',
  context: { currentFile: 'src/pages/profile.tsx' },
  includeFileRouting: true
});
```
Returns: Recommended approach, patterns, complexity estimate, target files

#### 5. **get_pattern_recommendations** - Pattern Suggestions
Use for: Maintaining consistency with existing code
```typescript
await use_mcp_tool('in-memoria', 'get_pattern_recommendations', {
  problemDescription: 'Create new API endpoint for user search',
  currentFile: 'src/api/routes/users.ts',
  includeRelatedFiles: true
});
```
Returns: Patterns to follow, examples, confidence scores, related files

#### 6. **get_semantic_insights** - Explore Concepts
Use for: Understanding what the codebase knows
```typescript
await use_mcp_tool('in-memoria', 'get_semantic_insights', {
  query: 'authentication',
  limit: 10
});
```
Returns: Related concepts, usage contexts, relationships

#### 7. **learn_codebase_intelligence** - Deep Learning
Use for: Initial learning or re-learning after major changes
```typescript
await use_mcp_tool('in-memoria', 'learn_codebase_intelligence', {
  path: '.',
  force: false  // Set true to force re-learning
});
```
Returns: Concepts learned, patterns discovered, blueprint data

#### 8. **auto_learn_if_needed** - Smart Automation
Use for: Automatic learning with setup verification
```typescript
await use_mcp_tool('in-memoria', 'auto_learn_if_needed', {
  path: '.',
  force: false,
  includeProgress: true,
  skipLearning: false,      // Set true for quick setup without learning
  includeSetupSteps: true   // Get detailed setup verification
});
```
Returns: Action taken, status, intelligence metrics

#### 9. **get_developer_profile** - Understand Coding Style
Use for: Learning project conventions and preferences
```typescript
await use_mcp_tool('in-memoria', 'get_developer_profile', {
  includeRecentActivity: true,
  includeWorkContext: true
});
```
Returns: Naming conventions, structural patterns, testing approach, expertise areas

#### 10. **contribute_insights** - Record Learnings
Use for: Teaching In Memoria about the codebase
```typescript
await use_mcp_tool('in-memoria', 'contribute_insights', {
  type: 'architectural_decision',
  content: {
    decision: 'Use React Query for all API calls',
    reasoning: 'Provides better caching and error handling',
    affectedFiles: ['src/hooks/', 'src/api/']
  },
  confidence: 0.95,
  sourceAgent: 'github-copilot'
});
```

### 🔍 Monitoring Tools (Debug/System)

Use these for debugging and system health:
- `get_system_status` - Database status, learning state
- `get_intelligence_metrics` - Concept/pattern counts, quality scores
- `get_performance_status` - Vector DB health, query performance

## 🎯 Usage Patterns

### Pattern 1: Starting a New Feature
```typescript
// 1. Get project context
const blueprint = await use_mcp_tool('in-memoria', 'get_project_blueprint', { path: '.' });

// 2. Find similar features
const similar = await use_mcp_tool('in-memoria', 'search_codebase', {
  query: 'user profile features',
  type: 'semantic'
});

// 3. Get implementation approach
const approach = await use_mcp_tool('in-memoria', 'predict_coding_approach', {
  problemDescription: 'Add profile photo upload',
  includeFileRouting: true
});

// 4. Get pattern recommendations
const patterns = await use_mcp_tool('in-memoria', 'get_pattern_recommendations', {
  problemDescription: 'Profile photo upload with validation',
  currentFile: approach.fileRouting.suggestedStartPoint
});

// Now you have: context, similar code, approach, patterns, target files
```

### Pattern 2: Understanding Unfamiliar Code
```typescript
// 1. Analyze the file/directory
const analysis = await use_mcp_tool('in-memoria', 'analyze_codebase', {
  path: './src/auth'
});

// 2. Get semantic insights about key concepts
const insights = await use_mcp_tool('in-memoria', 'get_semantic_insights', {
  query: 'authentication flow'
});

// 3. Search for usage examples
const examples = await use_mcp_tool('in-memoria', 'search_codebase', {
  query: 'auth.login',
  type: 'text'
});
```

### Pattern 3: Debugging/Code Review
```typescript
// 1. Get developer profile to understand conventions
const profile = await use_mcp_tool('in-memoria', 'get_developer_profile', {});

// 2. Check if current code follows patterns
const patterns = await use_mcp_tool('in-memoria', 'get_pattern_recommendations', {
  problemDescription: 'Review error handling in API routes',
  currentFile: 'src/api/routes/users.ts'
});

// 3. Find similar implementations for comparison
const similar = await use_mcp_tool('in-memoria', 'search_codebase', {
  query: 'error handling middleware',
  type: 'pattern'
});
```

## 🚫 What NOT to Do

❌ **Don't guess file paths** - Use `get_project_blueprint` to discover structure
❌ **Don't skip learning checks** - Always call `auto_learn_if_needed` at session start
❌ **Don't use text search for concepts** - Use `semantic` search for meaning-based queries
❌ **Don't ignore pattern recommendations** - They reflect actual codebase conventions
❌ **Don't re-learn unnecessarily** - Check `blueprint.learningStatus` before forcing re-learning

## 💡 Pro Tips

1. **Token Efficiency**: `analyze_codebase` automatically limits concepts/patterns to top 10-15 to avoid overwhelming responses
2. **Feature Mapping**: Use `includeFeatureMap: true` in `get_project_blueprint` to get instant feature-to-file routing
3. **Smart Routing**: Set `includeFileRouting: true` in `predict_coding_approach` to get target files automatically
4. **Related Files**: Set `includeRelatedFiles: true` in `get_pattern_recommendations` to discover similar implementations
5. **Work Context**: Set `includeWorkContext: true` in `get_developer_profile` to see session history and recent decisions

## 🔄 Typical Session Flow

```typescript
// Session Start
1. get_project_blueprint({ path: '.' })
   → Get instant context + check learning status

2. auto_learn_if_needed({ path: '.' })
   → Learn if needed (only runs if data is stale/missing)

// During Development
3. predict_coding_approach({ problemDescription: '...', includeFileRouting: true })
   → Get implementation approach + target files

4. get_pattern_recommendations({ problemDescription: '...', includeRelatedFiles: true })
   → Get patterns + similar files

5. search_codebase({ query: '...', type: 'semantic' })
   → Find relevant code

6. analyze_codebase({ path: './specific/file.ts' })
   → Understand specific files

// Session End (Optional)
7. contribute_insights({ type: '...', content: {...} })
   → Record learnings for future sessions
```

## 🎨 Best Practices

- **Always check learning status** before starting work
- **Use semantic search** for concept-based queries
- **Leverage feature maps** for instant navigation
- **Follow pattern recommendations** to maintain consistency
- **Contribute insights** when you discover architectural decisions
- **Use token-efficient responses** - tools automatically limit output for LLM efficiency

## 📚 Additional Resources

- Full API documentation: See tool schemas in `src/mcp-server/tools/`
- Implementation roadmap: `IMPLEMENTATION_ROADMAP.md`
- Architecture overview: `README.md`

---

**Remember**: In Memoria learns from the codebase and provides **intelligent, context-aware suggestions**. Trust the pattern recommendations and semantic insights - they reflect actual code in the project.
