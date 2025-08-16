# Code Cartographer

**Persistent Intelligence Infrastructure for AI Agents**

Code Cartographer is revolutionary foundational infrastructure that enables AI agents to maintain smart, cumulative understanding of codebases across sessions. Unlike existing tools that suffer from "session amnesia," Code Cartographer builds persistent, developer-specific intelligence that grows smarter over time.

## 🚀 Key Features

### Revolutionary Capabilities
- **Persistent AI Memory**: Intelligence persists and grows across sessions
- **Developer-Specific Learning**: Learns YOUR patterns and coding style
- **Multi-Agent Coordination**: Shared knowledge base for AI agent collaboration
- **Bidirectional Intelligence**: AI agents can contribute insights back to the system

### MCP Integration
- **11 Powerful MCP Tools** for seamless AI agent integration
- **Real-time Intelligence Updates** through file watching
- **Semantic Code Understanding** via advanced AST analysis
- **Pattern Recognition & Learning** from your coding habits

### High-Performance Architecture
- **Hybrid TypeScript + Rust**: MCP compliance with performance optimization
- **SQLite + ChromaDB Storage**: Structured data with semantic embeddings
- **Real-time File Monitoring**: Instant intelligence updates on code changes

## 🏗️ Architecture Overview

```
MCP Client (Claude/GPT-4/Any AI Agent)
    ↓ MCP Protocol
TypeScript MCP Server (11 Tools)
    ↓ napi-rs bindings
Rust Core Engines (Semantic Analysis + Pattern Learning)
    ↓ Storage
SQLite Database + ChromaDB Vector Store
```

## 📦 Installation

### Prerequisites
- Node.js 18+ 
- Rust 1.70+
- (Optional) OpenAI API key for enhanced semantic embeddings

### Quick Start

```bash
# Clone the repository
git clone https://github.com/your-org/code-cartographer.git
cd code-cartographer

# Install dependencies
npm install

# Build the Rust core
npm run build:rust

# Build TypeScript
npm run build

# Initialize for your project
npx code-cartographer init

# Learn from your codebase
npx code-cartographer learn

# Start the MCP server
npx code-cartographer server
```

## 🔧 Usage

### Command Line Interface

```bash
# Start MCP server for AI agent integration
code-cartographer server

# Learn from a codebase
code-cartographer learn ./my-project

# Analyze codebase and show insights  
code-cartographer analyze ./src

# Start real-time file watching
code-cartographer watch ./src

# Initialize project configuration
code-cartographer init
```

### MCP Tools for AI Agents

Code Cartographer exposes 11 powerful tools through the Model Context Protocol:

#### Core Analysis Tools
- `analyze_codebase` - Comprehensive codebase analysis
- `get_file_content` - Retrieve file content with metadata
- `get_project_structure` - Hierarchical project structure
- `search_codebase` - Semantic, text, and pattern-based search
- `generate_documentation` - Intelligent documentation generation

#### Intelligence Tools (Revolutionary)
- `learn_codebase_intelligence` - Build persistent knowledge from codebase
- `get_semantic_insights` - Retrieve semantic concepts and relationships
- `get_pattern_recommendations` - Get intelligent pattern suggestions
- `predict_coding_approach` - Predict likely coding approach based on learned patterns
- `get_developer_profile` - Retrieve learned developer preferences and expertise
- `contribute_insights` - Allow AI agents to contribute insights back

### Environment Variables

```bash
# Optional: OpenAI API key for enhanced embeddings
export OPENAI_API_KEY="your-api-key"

# Optional: ChromaDB host (default: http://localhost:8000)
export CHROMA_HOST="http://localhost:8000"
```

## 🔌 AI Agent Integration

### Claude MCP Integration

Add to your Claude configuration:

```json
{
  "mcpServers": {
    "code-cartographer": {
      "command": "npx",
      "args": ["code-cartographer", "server"],
      "cwd": "/path/to/your/project"
    }
  }
}
```

### Custom Integration

```typescript
import { CodeCartographerMCP } from 'code-cartographer';

const server = new CodeCartographerMCP();
await server.start();

// Your AI agent can now use all 11 MCP tools
```

## 📁 Project Structure

```
code-cartographer/
├── src/                          # TypeScript source
│   ├── mcp-server/              # MCP server implementation
│   │   ├── server.ts            # Main MCP server
│   │   ├── tools/               # 11 MCP tools
│   │   └── types.ts             # Type definitions
│   ├── engines/                 # TypeScript interfaces to Rust
│   │   ├── semantic-engine.ts   # Semantic analysis interface
│   │   └── pattern-engine.ts    # Pattern learning interface
│   ├── watchers/               # Real-time file monitoring
│   │   ├── file-watcher.ts     # File system watcher
│   │   └── change-analyzer.ts  # Change impact analysis
│   ├── storage/                # Data persistence
│   │   ├── sqlite-db.ts        # SQLite operations
│   │   └── vector-db.ts        # ChromaDB operations
│   └── index.ts                # CLI entry point
├── rust-core/                   # High-performance Rust engines
│   ├── src/
│   │   ├── semantic.rs         # Semantic analysis engine
│   │   ├── pattern_learning.rs # Pattern recognition ML
│   │   └── ast_parser.rs       # Tree-sitter AST parsing
│   └── Cargo.toml              # Rust dependencies
└── schemas/                     # Data schemas
    ├── mcp-tools.json          # MCP tool definitions
    └── storage-schema.sql      # Database schema
```

## 🎯 Use Cases

### For Individual Developers
- **Smart Code Completion**: Suggestions based on YOUR coding patterns
- **Architectural Guidance**: Recommendations aligned with your project structure
- **Pattern Detection**: Identify inconsistencies and violations
- **Documentation Generation**: Auto-generated docs that match your style

### For AI Agents
- **Persistent Context**: Maintain understanding across long conversations
- **Developer-Specific Responses**: Tailor suggestions to individual coding style
- **Cross-Session Learning**: Build on previous interactions
- **Collaborative Intelligence**: Share insights between multiple AI agents

### For Teams
- **Onboarding**: New team members learn established patterns quickly
- **Code Review**: Automated pattern compliance checking
- **Knowledge Sharing**: Capture and distribute coding best practices
- **Architecture Evolution**: Track and guide architectural changes

## 🔬 Technical Deep Dive

### Semantic Analysis Engine (Rust)
- **Tree-sitter Integration**: Multi-language AST parsing
- **Concept Extraction**: Identify classes, functions, patterns, relationships
- **Confidence Scoring**: ML-based relevance and accuracy scoring
- **Relationship Mapping**: Build semantic concept graphs

### Pattern Learning Engine (Rust)
- **Multi-dimensional Pattern Detection**: Naming, structural, implementation patterns
- **Frequency Analysis**: Track pattern usage and evolution
- **Context-Aware Recommendations**: Suggest patterns based on current context
- **Approach Prediction**: ML prediction of likely coding approaches

### Real-time Intelligence Updates
- **File System Monitoring**: Instant detection of code changes
- **Incremental Learning**: Update intelligence without full re-analysis
- **Change Impact Analysis**: Assess scope and impact of modifications
- **Bidirectional Updates**: AI agents can contribute new insights

## 🚦 Development Status

### Phase 1: Foundation ✅
- MCP server with core analysis tools
- SQLite database and file watching
- Basic TypeScript ↔ Rust integration

### Phase 2: Intelligence Engines (In Progress)
- Rust semantic analysis engine
- Pattern learning and prediction
- All 11 MCP tools functional

### Phase 3: Advanced Features (Planned)
- Cross-project intelligence sharing
- Advanced ML models for prediction
- VS Code extension
- Production deployment tools

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone and install
git clone https://github.com/your-org/code-cartographer.git
cd code-cartographer
npm install

# Install Rust dependencies
cd rust-core
cargo build

# Run tests
npm test
cargo test

# Start development
npm run dev
```

## 📊 Market Context

### The Problem
- **GitHub Copilot**: Limited memory, no developer-specific learning
- **Cursor AI**: Rules only, no persistent intelligence
- **Claude Code**: Stateless, resets every session
- **All existing tools**: Suffer from "session amnesia"

### Our Solution
- **$25.7B Market Opportunity** in AI coding tools by 2030
- **First persistent, developer-specific intelligence** that grows smarter
- **Multi-agent coordination** for collaborative AI development
- **Bidirectional learning** - AI agents can contribute back

## 📜 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🔗 Links

- **Documentation**: [docs.code-cartographer.dev](https://docs.code-cartographer.dev)
- **GitHub**: [github.com/code-cartographer/core](https://github.com/code-cartographer/core)
- **Discord**: [discord.gg/code-cartographer](https://discord.gg/code-cartographer)
- **Twitter**: [@CodeCartographer](https://twitter.com/CodeCartographer)

## 🙏 Acknowledgments

Built with:
- [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) by Anthropic
- [Tree-sitter](https://tree-sitter.github.io/) for language parsing
- [napi-rs](https://napi.rs/) for TypeScript ↔ Rust bindings
- [ChromaDB](https://www.trychroma.com/) for vector embeddings

---

**Code Cartographer**: Building the future of persistent AI intelligence for development 🚀