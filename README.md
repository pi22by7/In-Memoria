# In Memoria

**Persistent intelligence infrastructure for agentic development**

## The Problem: AI Session Amnesia

Current AI coding tools suffer from **session amnesia** - they restart from zero every conversation, cannot learn developer-specific patterns, and lack coordination between multiple AI agents. GitHub Copilot, Cursor, and Claude Code all reset completely between sessions, wasting computational resources and losing valuable context.

**In Memoria** solves this by providing **persistent, cumulative intelligence** that grows smarter over time.

## How It Works

Instead of re-analyzing your entire codebase every session, In Memoria:

- **Learns once, remembers forever** - Initial analysis creates a persistent knowledge base
- **Watches and adapts** - Incrementally updates understanding as your code evolves
- **Provides rich context** - AI assistants get semantic insights, not just raw text
- **Respects your patterns** - Learns your coding style and suggests consistent approaches

Think of it as giving your AI assistant a notebook it never loses.

## Architecture

```
┌──────────────────────────────┐
│    MCP Client (Claude, etc.) │
└──────────────┬───────────────┘
               │ Model Context Protocol
┌──────────────▼───────────────┐
│  TypeScript MCP Server (11)  │  ← Integration & API compliance
└──────────────┬───────────────┘
               │ napi-rs bindings
┌──────────────▼───────────────┐
│   Rust Performance Engines   │  ← Semantic analysis & ML
└──────────────┬───────────────┘
               │ Persistent storage
┌──────────────▼───────────────┐
│ SQLite + Embedded SurrealDB  │  ← Local-first storage
└──────────────────────────────┘
```

## Quick Start

```bash
# Install
npm install -g in-memoria

# Initialize in your project
in-memoria init

# Learn from existing codebase
in-memoria learn

# Start MCP server for AI integration
in-memoria server
```

## Integration

### Claude Desktop

```json
{
  "mcpServers": {
    "in-memoria": {
      "command": "npx",
      "args": ["in-memoria", "server"]
    }
  }
}
```

### Claude Code (CLI)

```bash
claude mcp add in-memoria -- npx in-memoria server
```

## What Your AI Gets

With In Memoria connected, your AI assistant can:

**🔧 Core Analysis Tools:**
- **`analyze_codebase`** - Get architectural overview and complexity metrics
- **`search_codebase`** - Find code by meaning, not just keywords
- **`get_file_content`** - Retrieve file contents with metadata
- **`get_project_structure`** - Get hierarchical project structure
- **`generate_documentation`** - Create intelligent documentation

**🧠 Intelligence Tools:**
- **`get_semantic_insights`** - Understand functions, classes, and their relationships
- **`get_pattern_recommendations`** - Suggest code that matches your style
- **`predict_coding_approach`** - Anticipate how you'd solve similar problems
- **`learn_codebase_intelligence`** - Learn from codebase (manual trigger)
- **`get_developer_profile`** - Get learned developer patterns and preferences
- **`contribute_insights`** - AI agents can contribute back to knowledge base

**🤖 Automation Tools (for seamless agent use):**
- **`auto_learn_if_needed`** - Automatically learn if intelligence data is missing/stale
- **`get_learning_status`** - Check current intelligence status
- **`quick_setup`** - Rapid setup and learning for immediate use

**📊 Monitoring Tools:**
- **`get_system_status`** - Comprehensive system health and status
- **`get_intelligence_metrics`** - Detailed metrics about learned intelligence
- **`get_performance_status`** - Performance metrics and benchmarks

**17 total tools** providing seamless, intelligent development assistance.

## Core Capabilities

### Semantic Intelligence Engine

- **Tree-sitter AST analysis** across TypeScript, JavaScript, Python, Rust
- **Concept extraction** - functions, classes, interfaces, relationships
- **Complexity metrics** - cyclomatic, cognitive, architectural
- **Pattern recognition** - naming conventions, structural preferences

### Persistent Memory System

- **Cumulative learning** - Intelligence accumulates across sessions
- **Real-time updates** - File watcher integration with incremental learning
- **Local storage** - Your code never leaves your machine
- **Vector embeddings** - Semantic similarity search

### Multi-Agent Coordination

- **Shared context** - Multiple AI agents access the same intelligence base
- **Pattern predictions** - Anticipate developer approaches based on learned patterns
- **Bidirectional flow** - AI agents can contribute insights back to the knowledge base

## Commands

```bash
in-memoria init          # Initialize project configuration
in-memoria learn [path]  # Analyze and learn from codebase
in-memoria watch [path]  # Real-time monitoring and learning
in-memoria analyze       # Generate insights and metrics
in-memoria server        # Start MCP server for AI integration
```

## Why "In Memoria"?

Because every line of code tells a story. Every function has a purpose. Every architectural decision has reasoning behind it.

Most of this context lives only in developers' minds and gets lost over time. In Memoria preserves it, creating a living memory of your codebase that grows smarter with every change.

## Requirements

- **Node.js 18+** (tested with 20 LTS and 24+)
- **2GB RAM minimum** for vector operations
- **For development**: Rust 1.70+ with Cargo

## Project Status

**Current**: v0.3.1 - Cross-platform release with Windows/macOS support and 80% smaller downloads  
**Architecture**: Hybrid TypeScript/Rust implementation  
**Testing**: Comprehensive test suite with unit and integration tests  
**Performance**: Optimized for codebases up to 100k files  
**Compatibility**: Node.js 18+ including 24+  
**Usability**: Interactive setup, progress indicators, debugging tools, seamless agent integration

## Contributing

Found a bug? Have an idea? [Open an issue](https://github.com/pi22by7/in-memoria/issues) or submit a pull request.

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## License

MIT - Build something amazing.

---

**In Memoria** - _Transforming ephemeral AI interactions into cumulative intelligence_
