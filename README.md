# In Memoria

[![npm version](https://badge.fury.io/js/in-memoria.svg)](https://www.npmjs.com/package/in-memoria)
[![npm downloads](https://img.shields.io/npm/dm/in-memoria.svg)](https://www.npmjs.com/package/in-memoria)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**MCP server that gives AI coding assistants persistent memory and pattern learning.**

AI coding tools suffer from complete memory loss between sessions. Every conversation with Claude, Copilot, or Cursor starts from scratch, wasting time and tokens re-explaining your codebase.

In Memoria solves **session amnesia** by building persistent intelligence about your code that AI tools can access through the Model Context Protocol.

## The Problem

```bash
# What happens now
You: "Refactor this function using our established patterns"
AI: "What patterns? I don't know your codebase."
You: *explains architecture for the 50th time*

# What should happen
You: "Refactor this function using our established patterns"
AI: "Based on your preference for functional composition and your naming conventions..."
```

Current AI tools:

- Re-analyze codebases every session (expensive)
- Give generic suggestions that don't match your style
- Have no memory of architectural decisions
- Can't learn from corrections you've made

## Technical Approach

In Memoria runs as an MCP server that AI tools connect to. It provides 17 tools for codebase analysis and pattern learning.

**Architecture:**

```
┌─────────────────────┐    MCP    ┌──────────────────────┐    napi-rs    ┌─────────────────────┐
│  AI Tool (Claude)   │◄─────────►│  TypeScript Server   │◄─────────────►│     Rust Core       │
└─────────────────────┘           └──────────┬───────────┘               │  • AST Parser       │
                                             │                          │  • Pattern Learner  │
                                             │                          │  • Semantic Engine  │
                                             ▼                          └─────────────────────┘
                                   ┌──────────────────────┐
                                   │ SQLite + SurrealDB   │
                                   │  (Local Storage)     │
                                   └──────────────────────┘
```

**Core engines:**

- **AST Parser** (Rust): Tree-sitter based parsing with complexity analysis and symbol extraction
- **Pattern Learner** (Rust): Analyzes coding decisions and builds developer style profiles  
- **Semantic Engine** (Rust): Maps code relationships and architectural concepts
- **TypeScript Layer**: MCP server, database operations, file watching
- **Storage**: SQLite for structured data, SurrealDB for vector operations and semantic search

## Quick Start

```bash
# Start the MCP server
npx in-memoria server

# Connect from Claude Desktop (add to config)
{
  "mcpServers": {
    "in-memoria": {
      "command": "npx",
      "args": ["in-memoria", "server"]
    }
  }
}

# Connect from Claude Code CLI
claude mcp add in-memoria -- npx in-memoria server
```

## What It Learns

**Coding Patterns:**

```typescript
// Learns you prefer functional composition
const processUser = pipe(validateUser, enrichUserData, saveUser);

// Future suggestions match this style, not OOP alternatives
```

**Naming Conventions:**

```typescript
// Learns your patterns: useXxxData for API hooks, handleXxx for events
const useUserData = () => { ... }
const handleSubmit = () => { ... }

// Suggests consistent naming in new code
```

**Architecture Decisions:**

```typescript
// Remembers you use Result types for error handling
type ApiResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// Suggests this pattern instead of throwing exceptions
```

## MCP Tools

**Analysis:**

- `analyze_codebase` - Get architectural overview and metrics
- `search_codebase` - Semantic search (find by meaning, not keywords)
- `get_file_content` - Retrieve files with metadata
- `get_project_structure` - Project hierarchy understanding

**Intelligence:**

- `get_semantic_insights` - Code relationships and dependencies
- `get_pattern_recommendations` - Suggestions matching your style
- `predict_coding_approach` - How you'd solve similar problems
- `get_developer_profile` - Your learned preferences
- `learn_codebase_intelligence` - Trigger analysis

**Automation:**

- `auto_learn_if_needed` - Smart learning when gaps detected
- `contribute_insights` - AI can add back to knowledge base
- `get_learning_status` - What's been analyzed
- `quick_setup` - Project initialization

**System:**

- `get_system_status` - Health and diagnostics
- `get_intelligence_metrics` - Learning quality metrics
- `get_performance_status` - Performance benchmarks

## Implementation Details

**Pattern Learning Algorithm:**

1. Parse code into ASTs using tree-sitter
2. Extract structural patterns (function signatures, class hierarchies, naming)
3. Build frequency maps of developer choices
4. Train classifier on decision patterns
5. Generate predictions for new code contexts

**Performance:**

- Incremental analysis (only processes changed files)
- SQLite for structured data, SurrealDB embedded for semantic search and vectors
- Cross-platform Rust binaries (Windows, macOS, Linux)
- Handles codebases up to 100k files
- Performance profiling and monitoring built-in
- Zero memory leaks verified through comprehensive testing

## Team Usage

In Memoria works for individual developers and teams:

**Individual:**

- Learns your personal coding style
- Remembers architectural decisions you've made
- Provides context-aware suggestions

**Team:**

- Share intelligence across team members
- Onboard new developers with institutional knowledge
- Maintain consistent AI suggestions team-wide

```bash
# Export team knowledge
in-memoria export --format json > team-intelligence.json

# Import on another machine
in-memoria import team-intelligence.json
```

## Technical Comparison

**vs GitHub Copilot's memory:**

- Copilot: Basic fact storage, no pattern learning
- In Memoria: Semantic analysis with prediction engine

**vs Cursor's rules:**

- Cursor: Static rules, manually defined
- In Memoria: Dynamic learning from actual code

**vs Custom RAG:**

- RAG: Retrieves relevant code snippets
- In Memoria: Understands coding patterns and predicts behavior

## Build from Source

```bash
git clone https://github.com/pi22by7/in-memoria
cd in-memoria
npm install
npm run build
```

**Requirements:**

- Node.js 18+
- Rust 1.70+ (for building)
- 2GB RAM minimum

**Quality & Testing:**

- 98.3% unit test pass rate (118/120 tests)
- 100% MCP integration test coverage (23/23 tests)
- Comprehensive server lifecycle testing
- All Rust clippy warnings resolved
- Zero memory leaks verified

**Development:**

```bash
npm run dev          # Start in development mode
npm test            # Run test suite
npm run build:rust  # Build Rust components
```

## Contributing

This is infrastructure for the AI development ecosystem. Contributions welcome:

- Language support (add tree-sitter parsers)
- Pattern learning improvements
- MCP tool additions
- Performance optimizations

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## FAQ

**Q: Does this replace my AI coding assistant?**
A: No, it enhances them. In Memoria provides memory and context that AI tools can use.

**Q: What data is collected?**
A: Everything stays local. No data is sent to external services.

**Q: How accurate is pattern learning?**
A: Accuracy improves with codebase size. Help us benchmark this across different codebases to establish solid metrics.

**Q: Performance impact?**
A: Minimal. Runs in background, incremental updates only.

## License

MIT - see [LICENSE](LICENSE)

---

**Try it:** `npx in-memoria server`

Give your AI tools the memory they've been missing.
