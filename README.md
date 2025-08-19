# In Memoria

[![npm version](https://badge.fury.io/js/in-memoria.svg)](https://www.npmjs.com/package/in-memoria)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Platform Support](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue.svg)](https://github.com/pi22by7/in-memoria)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)

**Persistent intelligence infrastructure for AI development tools.**

In Memoria solves AI **session amnesia** by providing a Model Context Protocol (MCP) server that enables AI assistants to build and maintain persistent understanding of your codebase. Instead of starting from scratch every conversation, your AI tools get cumulative intelligence that grows smarter over time.

## The Session Amnesia Problem

Every AI coding assistant forgets everything between conversations. **Copilot, Cursor, Claude Code** - they all restart from zero, leading to:

- 🔄 **Redundant analysis** - Re-analyzing your entire codebase every session
- 🧠 **Lost context** - Forgetting learned patterns and architectural insights
- 🎯 **Generic suggestions** - Missing your specific coding style and preferences  
- 🤖 **Isolated experiences** - No coordination between multiple AI tools

**In Memoria changes this.** Think of it as giving your AI assistant a notebook it never loses.

## What You Get

✨ **Persistent Memory** - Your AI remembers everything: architecture, patterns, and preferences  
🔄 **Cumulative Learning** - Intelligence builds up over time instead of resetting  
🎯 **Personal Style** - AI suggestions that match your coding conventions  
🤝 **Multi-Agent Support** - One knowledge base serves all your AI tools  
⚡ **Real-Time Updates** - Intelligence evolves as your code changes  
🔒 **Local-First** - All data stays on your machine

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

## Installation

```bash
npm install -g in-memoria
```

## Quick Start

Get persistent AI intelligence in under 2 minutes:

1. **Interactive setup** (recommended):
   ```bash
   in-memoria setup --interactive
   ```

2. **Start the MCP server**:
   ```bash
   in-memoria server
   ```

3. **Connect your AI tool** - Add In Memoria to Claude Desktop, Claude Code, or any MCP-compatible client

That's it! Your AI assistant now has persistent memory of your codebase and will get smarter with every interaction.

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

## Supercharge Your AI with 17 Powerful Tools

In Memoria gives your AI assistant deep codebase intelligence through 17 specialized tools:

### 🔍 **Analysis Tools**
- `analyze_codebase` - Get architectural overview and complexity metrics
- `search_codebase` - Find code by meaning, not just keywords
- `get_file_content` - Retrieve files with rich metadata
- `get_project_structure` - Understand your project hierarchy
- `generate_documentation` - Create intelligent, context-aware docs

### 🧠 **Intelligence Tools** 
- `get_semantic_insights` - Discover function and class relationships
- `get_pattern_recommendations` - Get suggestions that match your style
- `predict_coding_approach` - AI predicts how you'd solve similar problems
- `learn_codebase_intelligence` - Trigger learning when needed
- `get_developer_profile` - Access your learned coding preferences
- `contribute_insights` - Let AI contribute back to your knowledge base

### ⚡ **Automation Tools**
- `auto_learn_if_needed` - Smart gap detection and auto-learning
- `get_learning_status` - Check what your AI knows about your code
- `quick_setup` - One-command project initialization

### 📊 **Monitoring Tools**
- `get_system_status` - Health monitoring and diagnostics
- `get_intelligence_metrics` - Quality metrics for learned intelligence
- `get_performance_status` - Performance benchmarks and optimization tips

## How It Works

### 🏗️ **Hybrid Architecture**
- **TypeScript MCP Server** - Standards-compliant, extensible interface
- **Rust Processing Core** - Blazing-fast semantic analysis and pattern learning
- **Smart Storage** - SQLite + SurrealDB for structured data and vector operations
- **Native Binaries** - Platform-optimized modules for Windows, macOS, and Linux

### 💬 **Language Support**
Currently supports **TypeScript/JavaScript**, **Python**, and **Rust**, with more languages coming through the tree-sitter ecosystem.

### ⚡ **Built for Performance**
- **Tree-sitter parsing** - Language-aware, not regex-based
- **Incremental updates** - Only processes what changed
- **Vector similarity** - Find semantically related code
- **Circuit breakers** - Fault-tolerant and resilient

## Command Reference

```bash
# Setup and Configuration
in-memoria setup --interactive    # Interactive guided setup
in-memoria init [path]           # Quick project initialization
in-memoria --version             # Show version information

# Intelligence Operations
in-memoria learn [path]          # Analyze and learn from codebase
in-memoria analyze [path]        # Generate insights and metrics
in-memoria watch [path]          # Real-time file monitoring

# AI Integration
in-memoria server                # Start MCP server

# Diagnostics
in-memoria debug [options]       # System diagnostics
  --verbose                      # Detailed diagnostic output
  --validate                     # Data integrity validation
```

## Requirements

- Node.js 18+ (tested with 20 LTS and 24+)
- 2GB RAM minimum for vector operations
- For development: Rust 1.70+ with Cargo

## Project Status

| Aspect           | Status                                   |
| ---------------- | ---------------------------------------- |
| **Version**      | v0.3.2 - Cross-platform support          |
| **Architecture** | Hybrid TypeScript/Rust                   |
| **Testing**      | Unit and integration test coverage       |
| **Performance**  | Optimized for codebases up to 100k files |
| **Platforms**    | Windows, macOS (Intel/ARM), Linux        |
| **MCP Tools**    | 17 tools for AI integration              |

## Join the Community

We'd love your help making In Memoria even better! Whether you:

- 🐛 **Found a bug** - [Open an issue](https://github.com/pi22by7/in-memoria/issues)
- 💡 **Have an idea** - [Start a discussion](https://github.com/pi22by7/in-memoria/discussions)  
- 🔧 **Want to contribute** - [Check out the contributing guide](CONTRIBUTING.md)
- ⭐ **Like the project** - Give us a star on GitHub!

## License

MIT - Build something amazing.
