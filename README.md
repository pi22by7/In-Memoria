# In Memoria

[![npm version](https://badge.fury.io/js/in-memoria.svg)](https://www.npmjs.com/package/in-memoria)
[![npm downloads](https://img.shields.io/npm/dm/in-memoria.svg)](https://www.npmjs.com/package/in-memoria)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Platform Support](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue.svg)](https://github.com/pi22by7/in-memoria)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)

**Persistent intelligence infrastructure that gives AI coding assistants the memory and context they need to be truly effective.**

## The Problem: Session Amnesia

AI coding assistants suffer from complete memory loss between sessions:

- **Copilot, Claude, Cursor** waste tokens re-analyzing your codebase every session
- You spend valuable time re-explaining your architecture and patterns
- AI gives generic suggestions that don't match YOUR coding style
- No shared context when using multiple AI tools
- Lost insights about architectural decisions and learned patterns

**In Memoria solves this.** It's the persistent memory layer that makes your AI tools truly intelligent.

## How It Works

🧠 **Persistent Memory** - AI tools remember architecture, patterns, and preferences across sessions

⚡ **Pattern Learning** - Learns your specific coding style to provide personalized suggestions

🎯 **Semantic Understanding** - Pre-analyzed codebase knowledge saves tokens and context windows

🤝 **Shared Intelligence** - One memory layer serves all your AI tools (Claude, Copilot, Cursor)

🔄 **Cumulative Learning** - Intelligence builds up over time instead of starting from scratch

🔒 **Local-First** - All data stays on your machine, enhances your existing tools

## Quick Start

Get up and running in 2 minutes:

```bash
# Start the MCP server
npx in-memoria server

# Or install globally first
npm install -g in-memoria
in-memoria server
```

**Connect to your AI tools:**

**Claude Desktop** - Add this to your config:

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

**Claude Code (CLI)**:

```bash
claude mcp add in-memoria -- npx in-memoria server
```

That's it! Your AI assistant now has persistent memory and will learn your codebase over time.

## Intelligence Tools

In Memoria provides 17 specialized MCP tools for AI assistants:

### 🔍 **Codebase Analysis**

- `analyze_codebase` - Architectural overview and complexity metrics
- `search_codebase` - Semantic search that finds code by meaning
- `get_file_content` - File retrieval with rich metadata
- `get_project_structure` - Intelligent project hierarchy understanding

### 🧠 **Intelligence Engine**

- `get_semantic_insights` - Deep relationships between functions and classes
- `get_pattern_recommendations` - Suggestions that match YOUR coding style
- `predict_coding_approach` - AI predicts how YOU would solve similar problems
- `get_developer_profile` - Your learned coding preferences and patterns
- `learn_codebase_intelligence` - Trigger learning when needed

### ⚡ **Smart Automation**

- `auto_learn_if_needed` - Automatic gap detection and learning
- `get_learning_status` - What your AI knows about your codebase
- `contribute_insights` - Let AI contribute back to your knowledge base
- `quick_setup` - One-command project initialization

### 📊 **System Intelligence**

- `get_system_status` - Health monitoring and diagnostics
- `get_intelligence_metrics` - Quality metrics for learned intelligence
- `get_performance_status` - Performance benchmarks and optimization
- `generate_documentation` - Context-aware, intelligent documentation

## Technical Details

**Architecture:**

```
┌──────────────────────────────┐
│  MCP Clients (Claude, etc.)  │
└──────────────┬───────────────┘
               │ Model Context Protocol
┌──────────────▼───────────────┐
│   TypeScript MCP Server      │  ← Standards compliance & integration
└──────────────┬───────────────┘
               │ napi-rs bindings
┌──────────────▼───────────────┐
│  Rust Intelligence Engines  │  ← Pattern learning & semantic analysis
└──────────────┬───────────────┘
               │ Persistent storage
┌──────────────▼───────────────┐
│ SQLite + Vector Embeddings   │  ← Local-first intelligence storage
└──────────────────────────────┘
```

**Language Support:** TypeScript/JavaScript, Python, and Rust (more coming via tree-sitter)

**Key Features:**

- Tree-sitter parsing for language-aware analysis
- Incremental updates (only processes changes)
- Vector similarity search for semantic understanding
- Cross-platform binaries (Windows, macOS, Linux)
- Circuit breakers for reliability

## How It Enhances Your AI Tools

In Memoria works as an intelligence layer that makes your existing AI coding assistants more effective:

| AI Tool                 | What In Memoria Adds                                              |
| ----------------------- | ----------------------------------------------------------------- |
| **GitHub Copilot**      | Persistent context about your coding patterns and architecture    |
| **Cursor**              | Shared memory across sessions and semantic codebase understanding |
| **Claude Desktop/Code** | Pre-analyzed codebase insights that save context tokens           |
| **Any MCP Client**      | 17 specialized tools for intelligent code analysis and learning   |

**The key insight**: Instead of replacing your AI tools, In Memoria gives them the persistent memory they're missing.

## Command Reference

```bash
# Intelligence Operations
in-memoria learn [path]          # Analyze and learn from codebase
in-memoria analyze [path]        # Generate insights and metrics
in-memoria watch [path]          # Real-time file monitoring

# AI Integration
in-memoria server               # Start MCP server
in-memoria setup --interactive  # Guided setup

# System Management
in-memoria --version            # Show version information
in-memoria debug --verbose     # Detailed diagnostics
```

## Requirements

- **Node.js 18+** (tested with 20 LTS and 24+)
- **2GB RAM** minimum for vector operations
- **Development**: Rust 1.70+ with Cargo

## Why Open Source?

In Memoria is open source because persistent AI intelligence should be a shared foundation, not a proprietary advantage. We're building the infrastructure layer that transforms AI development for everyone.

**Benefits:**

- Zero barrier to entry accelerates adoption
- Community intelligence creates network effects
- Prevents vendor lock-in and promotes innovation
- Builds the ecosystem foundation for agentic development

## Get Involved

Help make In Memoria better:

- 🐛 **Found a bug?** [Open an issue](https://github.com/pi22by7/in-memoria/issues)
- 💡 **Have ideas?** [Start a discussion](https://github.com/pi22by7/in-memoria/discussions)
- 🔧 **Want to contribute?** [Check the contributing guide](CONTRIBUTING.md)
- ⭐ **Like the project?** Give us a star on GitHub!

## License

MIT - Build something intelligent.

---

**Give your AI tools the memory they need. Try In Memoria today.**
