# In Memoria

[![npm version](https://badge.fury.io/js/in-memoria.svg)](https://www.npmjs.com/package/in-memoria)
[![npm downloads](https://img.shields.io/npm/dm/in-memoria.svg)](https://www.npmjs.com/package/in-memoria)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Persistent memory and pattern learning for AI coding assistants via MCP.**

AI coding tools suffer from complete **session amnesia**. Every conversation with Claude, Copilot, or Cursor starts from scratch, forcing you to re-explain your codebase architecture, patterns, and preferences repeatedly.

In Memoria solves this by building persistent intelligence about your code that AI assistants can access through the Model Context Protocol - giving them memory that persists across sessions.

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

## Quick Start

```bash
# Install and start the MCP server
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

# Learn from your codebase
npx in-memoria learn ./my-project

# Native AST parsing for 12 programming languages
# Supports: TypeScript, JavaScript, Python, Rust, Go, Java, C/C++, C#, Svelte, Vue, SQL
# Intelligent filtering excludes build artifacts and dependencies
```

## GitHub Copilot Integration

In Memoria works seamlessly with GitHub Copilot through custom instructions and chat modes.

### Repository Instructions

This repository includes `.github/copilot-instructions.md` which automatically guides GitHub Copilot on how to use In Memoria's MCP tools effectively.

### Custom Chat Modes

Three specialized chat modes are available in `.github/chatmodes/`:

- **🔍 inmemoria-explorer** - Intelligent codebase navigation with semantic search
- **🚀 inmemoria-feature** - Feature implementation with pattern guidance
- **🔎 inmemoria-review** - Code review with consistency checking

To use them in VS Code:
1. Open Command Palette (Cmd/Ctrl+Shift+P)
2. Run "Chat: Configure Chat Modes..."
3. Select a mode from `.github/chatmodes/`

### Quick Start for Copilot Users

```typescript
// Copilot will automatically use In Memoria when you:

// 1. Ask about the codebase
@workspace "Where is the authentication logic?"
// → Copilot uses semantic search

// 2. Request a new feature
"Add password reset functionality"
// → Copilot gets approach + file routing + patterns

// 3. Ask for a review
"Review this code for consistency"
// → Copilot checks against project patterns
```

### AGENT.md Reference

See `AGENT.md` for complete AI agent instructions, tool reference card, and usage patterns. This file provides detailed guidance for any AI coding assistant (not just Copilot).

## How It Works

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

- **AST Parser** (Rust): Tree-sitter parsing for TypeScript, JavaScript, Python, Rust, Go, Java, C/C++, C#, Svelte, Vue, and SQL
- **Pattern Learner** (Rust): Statistical analysis of naming conventions, function signatures, and architectural choices
- **Semantic Engine** (Rust): Code relationship mapping and concept extraction with timeout protection
- **TypeScript Layer**: MCP server, SQLite/SurrealDB operations, file watching
- **Storage**: SQLite for structured patterns, SurrealDB for vector search and semantic queries

## What It Learns

In Memoria builds statistical models from your actual code to understand your preferences:

**Naming Patterns:**

```typescript
// Detects patterns like: useXxxData for API hooks, handleXxx for events
const useUserData = () => { ... }
const handleSubmit = () => { ... }
const formatUserName = (name: string) => { ... }

// AI gets context: "This developer uses camelCase, 'use' prefix for hooks,
// 'handle' for events, 'format' for data transformation"
```

**Architectural Choices:**

```typescript
// Learns you consistently use Result types instead of throwing
type ApiResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// AI suggests this pattern in new code instead of try/catch
```

**Code Structure Preferences:**

```typescript
// Detects your preference for functional composition
const processUser = pipe(validateUser, enrichUserData, saveUser);

// vs object-oriented approaches you avoid
class UserProcessor { ... } // Rarely used in your codebase
```

**Project Organization:**

```
src/
  components/     # UI components
  services/      # Business logic
  utils/         # Pure functions
  types/         # Type definitions

// AI learns your directory structure preferences
```

## MCP Tools for AI Assistants

In Memoria provides 17 tools that AI assistants can use to understand your codebase:

**Getting Started:**

- `get_learning_status` - Check what intelligence exists for a project
- `auto_learn_if_needed` - Automatically learn from codebase if no intelligence exists
- `quick_setup` - Initialize In Memoria for a new project

**Code Analysis:**

- `analyze_codebase` - Get architectural overview, complexity metrics, and language breakdown
- `get_file_content` - Retrieve files with rich metadata and analysis
- `get_project_structure` - Understand directory hierarchy and organization patterns
- `search_codebase` - Semantic search that finds code by meaning, not just keywords

**Pattern Intelligence:**

- `get_pattern_recommendations` - Get coding suggestions that match your established style
- `predict_coding_approach` - Predict how you'd solve similar problems based on your patterns
- `get_developer_profile` - Access your learned coding preferences and decision patterns
- `get_semantic_insights` - Discover code relationships and architectural concepts

**Learning & Memory:**

- `learn_codebase_intelligence` - Manually trigger analysis of a codebase
- `contribute_insights` - Allow AI to add observations back to the knowledge base
- `generate_documentation` - Create docs that understand your project's patterns

**System Monitoring:**

- `get_system_status` - Health check and component status
- `get_intelligence_metrics` - Quality and completeness of learned patterns
- `get_performance_status` - System performance and benchmarking

## Implementation Details

**Pattern Learning Algorithm:**

1. Parse code into ASTs using tree-sitter
2. Extract structural patterns (function signatures, class hierarchies, naming)
3. Build frequency maps of developer choices
4. Train classifier on decision patterns
5. Generate predictions for new code contexts

**Performance:**

- **Smart file filtering** - Automatically excludes build artifacts, dependencies, and generated files
- **Timeout protection** - Prevents analysis from hanging on complex files
- **Fast analysis** - Optimized processing that skips `node_modules/`, `dist/`, `.next/`, and other non-source files
- **File size limits** - Skips very large files to prevent memory issues
- **Incremental analysis** - Only processes changed files in subsequent runs
- **SQLite for structured data, SurrealDB embedded for semantic search and vectors**
- **Cross-platform Rust binaries** (Windows, macOS, Linux)
- **Built-in performance profiling** and memory leak detection
- **Optimized for real-time file watching** without blocking development workflow

## Team Usage

In Memoria works for individual developers and teams:

**Individual:**

- Learns your personal coding style
- Remembers architectural decisions you've made
- Provides context-aware suggestions

**Team:**

- Share `.in-memoria.db` files containing learned patterns across team members
- Onboard new developers by providing pre-learned codebase intelligence
- Ensure consistent AI suggestions team-wide through shared pattern recognition

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
- Rust 1.70+ (for building from source)
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

### Development Setup

```bash
npm install
npm run build
```

## Contributing

This is infrastructure for the AI development ecosystem. Contributions welcome:

- **Language support** - Add tree-sitter parsers or extend file filtering
- **Pattern learning improvements** - Enhance statistical analysis and concept extraction
- **MCP tool additions** - New tools for AI assistant integration
- **Performance optimizations** - Further speed improvements and memory usage reduction
- **Timeout and reliability** - Additional safeguards for edge cases

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## FAQ

**Q: Does this replace my AI coding assistant?**
A: No, it enhances them. In Memoria provides memory and context that AI tools can use.

**Q: What data is collected?**
A: Everything stays local. No data is sent to external services.

**Q: How accurate is pattern learning?**
A: Pattern recognition accuracy improves with codebase size and consistency. Projects with established patterns and consistent style will see better pattern detection than smaller or inconsistent codebases. The system learns from frequency and repetition in your actual code.

**Q: Performance impact?**
A: Minimal. Runs in background with smart filtering that skips build artifacts and dependencies. Modern analysis engine with built-in safeguards for reliable operation.

**Q: What file types are supported?**
A: TypeScript, JavaScript, Python, Rust, Go, Java, C/C++, C#, Svelte, Vue, and SQL with native AST parsing. Build artifacts and dependencies are automatically excluded.

**Q: What if analysis encounters issues?**
A: Built-in reliability features handle edge cases gracefully. Large files and complex directories are processed efficiently with automatic fallbacks. Progress is shown during analysis.

## License

MIT - see [LICENSE](LICENSE)

---

**Try it:** `npx in-memoria server`

Give your AI tools the memory they've been missing.
