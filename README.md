# Code Cartographer

Persistent, embedded intelligence infrastructure for AI coding agents.

---

## 1. What It Does

Code Cartographer gives AI agents durable memory of a codebase: structure, semantics, patterns, and developer style. It turns ephemeral session context into cumulative intelligence.

## 2. Why It Exists

Most AI coding assistants re-learn the same project facts every session. This wastes tokens, loses nuance, and blocks multi-agent collaboration. Code Cartographer provides:

- Long-lived semantic + pattern knowledge
- Incremental updates on file changes
- Unified search (text / semantic / pattern)
- Programmable access via 11 MCP tools

## 3. Feature Summary

- Persistent semantic concepts (functions, classes, traits, interfaces, etc.)
- Pattern learning (naming / structural / implementation)
- Vector + full‑text search (embedded SurrealDB)
- Tree-sitter based multi-language parsing (TS/JS/Rust/Python; extensible)
- Real-time change tracking & incremental learning
- Intelligent documentation generation
- Developer profile + approach prediction
- Bidirectional insight contribution

## 4. Architecture

```
┌──────────────────────────────┐
│    MCP Client (Claude, etc.) │
└──────────────┬───────────────┘
               │ MCP
┌──────────────▼───────────────┐
│  TypeScript MCP Server (11)  │  Tools: analysis + intelligence
└──────────────┬───────────────┘
               │ napi-rs
┌──────────────▼───────────────┐
│   Rust Engines (Semantic +   │  Tree-sitter, pattern learning
│        Pattern Learning)     │
└──────────────┬───────────────┘
               │ storage layer
┌──────────────▼───────────────┐
│ SQLite (relational metadata) │
│ SurrealDB (embedded vectors) │
└──────────────────────────────┘
```

## 5. MCP Tools (11 Total)

Core Analysis (6):

1. analyze_codebase
2. get_file_content
3. get_project_structure
4. search_codebase
5. learn_codebase_intelligence
6. generate_documentation

Intelligence (5): 7. get_semantic_insights 8. get_pattern_recommendations 9. predict_coding_approach 10. get_developer_profile 11. contribute_insights

All 11 are implemented and functional.

## 6. Installation

Prerequisites: Node.js 18+, Rust 1.70+, Git

```bash
git clone https://github.com/pi22by7/Code-Cartographer.git
cd Code-Cartographer
npm install
npm run build

# initialize local intelligence store
node dist/index.js init

# optional: learn immediately
node dist/index.js learn
```

### Optional Embeddings

Set an OpenAI key to enrich stored vectors (fallbacks still work without):

```bash
export OPENAI_API_KEY="your-api-key"
```

## 7. CLI Usage

```bash
# Learn / update intelligence
node dist/index.js learn [path]

# Analyze & print summary
node dist/index.js analyze [path]

# Watch for changes & incrementally learn
node dist/index.js watch [path]

# Start MCP server
node dist/index.js server
```

## 8. Integration

### Claude Code (CLI-based)

From within the project directory:

```bash
claude mcp add code-cartographer -- node dist/index.js server
```

### Claude Desktop (config file)

Add to configuration JSON:

```json
{
  "mcpServers": {
    "code-cartographer": {
      "command": "node",
      "args": ["dist/index.js", "server"],
      "cwd": "/absolute/path/to/Code-Cartographer"
    }
  }
}
```

### Generic MCP Clients

Run the server and point your client at the same command / working directory.

## 9. Environment Variables

```bash
OPENAI_API_KEY   # optional – enables enriched embeddings
```

No external DB setup required (SurrealDB is embedded; SQLite is file-based).

## 10. How It Works (Internals)

| Layer                | Responsibility                                    |
| -------------------- | ------------------------------------------------- |
| Rust semantic engine | Parse files with tree-sitter, build concept graph |
| Rust pattern engine  | Learn naming / structural / impl patterns         |
| Vector layer         | Store embeddings + enable semantic similarity     |
| SQLite metadata      | Persist concepts, relationships, pattern stats    |
| TypeScript server    | Expose MCP tools, orchestrate learning & search   |

### Fallback Extraction

If tree-sitter fails, a regex-based fallback extracts functions/classes/interfaces with reduced confidence.

## 11. Project Structure (Trimmed)

```
src/
  mcp-server/ (server + tools)
  engines/ (TS bridges to Rust)
  storage/ (sqlite + vector abstractions)
rust-core/
  src/semantic.rs
  src/pattern_learning.rs
schemas/
```

## 12. Status & Roadmap

Current: v1.0 (All 11 tools implemented)

Near-term Enhancements:

- Broader language coverage
- Smarter relationship inference
- Performance tuning on very large repos
- Additional embedding backends (pluggable)

Planned (Exploratory):

- Cross-repo intelligence sharing
- Multi-user/team knowledge graph
- IDE extension reintegration

## 13. Known Limitations

- Initial full learn pass can be slow on very large monorepos
- Some complex language edge cases may miss concepts
- Primary testing on Linux (community feedback welcome for macOS/Windows)

## 14. Contributing

```bash
git clone https://github.com/pi22by7/Code-Cartographer.git
cd Code-Cartographer
npm install
npm run build
npm test
cd rust-core && cargo test
```

Please open issues for language/feature requests before large PRs.

## 15. License

MIT – see LICENSE.

## 16. Acknowledgments

- Model Context Protocol (Anthropic)
- Tree-sitter
- napi-rs
- SurrealDB

---

Code Cartographer – durable intelligence for your codebase.
