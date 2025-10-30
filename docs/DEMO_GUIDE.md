# In-Memoria Demo Guide

This guide provides a script for demonstrating In-Memoria's key features in a compelling way.

## Pre-Demo Setup

### 1. Clean Slate
```bash
# Remove existing database to show fresh learning
rm -rf .in-memoria/*.db

# Ensure project is built
npm run build
```

### 2. Prepare Demo Project
Use the In-Memoria repository itself as the demo project - it showcases:
- Multi-language codebase (TypeScript + Rust)
- Real-world complexity
- Multiple architectural layers

## Demo Script (10-15 minutes)

### Part 1: Intelligence Learning (3-4 min)

**What to show**: In-Memoria learns from your codebase automatically.

```bash
# Run the learning pipeline
npm run learn /home/pipi/Projects/FOSS/In-Memoria
```

**Narration points**:
- "In-Memoria analyzes your entire codebase using Tree-sitter AST parsing"
- "It supports 11 programming languages out of the box"
- "Watch as it discovers patterns, architectural structure, and relationships"
- Point out the milestone progress: 0% → 25% → 50% → 75% → 100%
- Highlight phases: "Analyzing code", "Building feature maps", "Learning patterns"

**Expected output**: Clean milestone-based progress, completes in ~30-60 seconds.

---

### Part 2: Project Blueprint (2-3 min)

**What to show**: Instant project understanding without exploration.

Open your MCP client (Claude Code or MCP Inspector) and run:

```javascript
await mcp__in_memoria__get_project_blueprint({
  includeFeatureMap: true
})
```

**Narration points**:
- "No cold start - In-Memoria provides instant project context"
- **Tech Stack**: "It detected TypeScript, Rust, and our frameworks"
- **Entry Points**: "Here are the main entry points - CLI, MCP server, learning pipeline"
- **Key Directories**: "It identified the core modules automatically"
- **Feature Map**: "And here's how features map to files - database, services, language-support, rust-core"

**Expected output**:
```json
{
  "techStack": ["typescript", "rust", "nodejs"],
  "entryPoints": [
    {
      "type": "cli",
      "filePath": "src/index.ts",
      "framework": "nodejs"
    },
    {
      "type": "server",
      "filePath": "src/mcp-server/index.ts"
    }
  ],
  "keyDirectories": [
    {
      "path": "src/storage",
      "type": "database",
      "fileCount": 3
    },
    {
      "path": "rust-core/src/parsing",
      "type": "language-support",
      "fileCount": 15
    }
  ],
  "featureMap": [
    "database", "services", "language-support", "rust-core",
    "mcp-server", "testing", "utilities"
  ]
}
```

---

### Part 3: Intelligent File Routing (3-4 min)

**What to show**: Smart file routing based on intent, not just keywords.

#### Example 1: Language Support Query
```javascript
await mcp__in_memoria__predict_coding_approach({
  problemDescription: "Add Ruby language support to the AST parser",
  includeFileRouting: true
})
```

**Narration points**:
- "I want to add Ruby support to the parser"
- "Watch how it routes me to the exact files I need"
- **Feature detected**: "language-support"
- **Target files**: "rust-core/src/parsing/manager.rs, rust-core/src/parsing/python.rs (as reference)"
- "It even suggests which file to start with and explains why"

**Expected output**:
```json
{
  "approach": "Add new language parser following existing pattern",
  "fileRouting": {
    "intendedFeature": "language-support",
    "targetFiles": [
      "rust-core/src/parsing/manager.rs",
      "rust-core/src/parsing/python.rs",
      "rust-core/src/parsing/typescript.rs"
    ],
    "workType": "feature-addition",
    "suggestedStartPoint": "rust-core/src/parsing/manager.rs",
    "confidence": 0.95,
    "reasoning": "Query matches 'language-support' feature with keywords: ruby, language, support, parser"
  }
}
```

#### Example 2: Database Query
```javascript
await mcp__in_memoria__predict_coding_approach({
  problemDescription: "Add caching layer to database queries",
  includeFileRouting: true
})
```

**Narration points**:
- "Different intent - database optimization"
- "It routes to completely different files"
- Points to storage layer, not parsing

---

### Part 4: Pattern Intelligence (2-3 min)

**What to show**: In-Memoria learns your coding patterns.

```javascript
await mcp__in_memoria__get_pattern_recommendations({
  problemDescription: "implement a new service class for handling analytics"
})
```

**Narration points**:
- "In-Memoria learned patterns from this codebase"
- "It found [X] patterns in the code"
- Point out high-confidence patterns:
  - **Dependency Injection** (83% confidence, 1230 occurrences)
  - **Factory pattern** (73% confidence, 3478 occurrences)
  - **Singleton pattern** (80% confidence, 10 occurrences)
- "These aren't hardcoded - it learned them from YOUR code"
- "It even shows you examples from your codebase"

**Expected output**: List of 5-10 patterns with confidence scores and frequency.

---

### Part 5: Semantic Code Insights (2 min)

**What to show**: Relationship-aware code understanding.

```javascript
await mcp__in_memoria__get_semantic_insights({
  query: "semantic",
  limit: 5
})
```

**Narration points**:
- "In-Memoria understands code relationships"
- "It tracks concepts, their usage, and evolution"
- Show a concept with its relationships
- "This is semantic understanding, not just text search"

**Expected output**: Concepts with relationships, usage frequency, and evolution data.

---

## Demo Tips

### Do's
✅ Use In-Memoria's own codebase - it's the perfect demo
✅ Emphasize "no cold start" - instant context
✅ Show multi-language support (TypeScript + Rust)
✅ Highlight intelligent routing vs simple keyword matching
✅ Point out that patterns are learned, not hardcoded
✅ Keep it flowing - pre-run commands to check timing

### Don'ts
❌ Don't show database internals unless asked
❌ Don't dwell on technical implementation details
❌ Don't show empty results (always verify queries first)
❌ Don't rush through the learning phase - it's impressive
❌ Don't skip the "why this matters" narration

## Quick Demo (5 min version)

If time is limited, focus on:
1. **Learning** (1 min) - Show the learning pipeline
2. **Blueprint** (2 min) - Instant project understanding
3. **File Routing** (2 min) - One example of intelligent routing

## Troubleshooting

### If learning fails:
```bash
# Check database
ls -la .in-memoria/

# Re-run with clean slate
rm -rf .in-memoria/*.db
npm run learn /home/pipi/Projects/FOSS/In-Memoria
```

### If MCP tools return empty:
```bash
# Restart MCP server to pick up latest build
# In Claude Code: Restart the MCP connection
```

### If demo environment needs reset:
```bash
# Full reset
rm -rf .in-memoria/
npm run build
npm run learn /home/pipi/Projects/FOSS/In-Memoria
```

## Post-Demo Q&A Prep

**Q: How does it compare to GitHub Copilot?**
A: Copilot provides code completion. In-Memoria provides codebase intelligence - understanding structure, patterns, and relationships. They're complementary.

**Q: Does it work with my language?**
A: Supports 11 languages: TypeScript, JavaScript, Python, Rust, Go, Java, C, C++, Ruby, PHP, C#. More coming.

**Q: How does it handle large codebases?**
A: Uses incremental learning and SQLite for efficient storage. Tested on codebases with 100K+ lines.

**Q: Can it integrate with my IDE?**
A: Yes, via MCP (Model Context Protocol). Works with Claude Code, MCP Inspector, and any MCP-compatible client.

**Q: Is the data stored locally?**
A: Yes, everything is local. Database is in `.in-memoria/` directory. No cloud dependencies.

## Recording Tips

### Screen Setup
- Clear terminal (no clutter)
- Large font size (18-20pt for readability)
- Dark theme (easier on eyes)
- Hide unnecessary panels/toolbars
- Full screen or focus mode

### Pacing
- Pause briefly after each command
- Let results fully render before moving on
- Speak slightly slower than normal
- Leave 2-3 seconds of silence between major sections

### Highlighting
- Use cursor to point at important output
- Highlight key JSON fields by reading them aloud
- Circle back to "why this matters"

---

**Ready to record!** Run through the script once before recording to ensure timing and verify all outputs.
