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

- **`analyze_codebase`** - Get architectural overview and complexity metrics
- **`search_codebase`** - Find code by meaning, not just keywords
- **`get_semantic_insights`** - Understand functions, classes, and their relationships
- **`get_pattern_recommendations`** - Suggest code that matches your style
- **`predict_coding_approach`** - Anticipate how you'd solve similar problems
- **`generate_documentation`** - Create docs that understand your code's purpose

And 5 more tools for comprehensive code intelligence.

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

- **Node.js 18+** (tested with 20 LTS)
- **2GB RAM minimum** for vector operations
- **For development**: Rust 1.70+ with Cargo

## Project Status

**Current**: v0.2.1 - All 11 MCP tools implemented and functional  
**Architecture**: Hybrid TypeScript/Rust implementation  
**Testing**: Linux primary, macOS/Windows pending validation for compatibility  
**Performance**: Optimized for codebases up to 100k files

## Contributing

Found a bug? Have an idea? [Open an issue](https://github.com/pi22by7/in-memoria/issues) or submit a pull request.

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## License

MIT - Build something amazing.

---

**In Memoria** - _Transforming ephemeral AI interactions into cumulative intelligence_
