# In Memoria Visualizer for VS Code

> Visualize and explore codebase intelligence captured by In Memoria MCP server

## Overview

In Memoria Visualizer is a powerful VS Code extension that provides rich visualizations for the intelligence data captured by [In Memoria](https://github.com/pi22by7/in-memoria), an MCP server that learns from your codebase and provides persistent intelligence to AI assistants.

## Features

### 📊 Intelligence Dashboard
Get a comprehensive overview of your codebase intelligence with:
- Real-time metrics (concepts, patterns, complexity)
- Tech stack and architecture visualization
- Learning status and recommendations
- Current work session tracking

### 🌳 Hierarchical Tree Views
Browse your codebase intelligence in organized tree structures:
- **Project Intelligence**: Blueprint, tech stack, entry points, key directories
- **Patterns**: Learned coding patterns grouped by confidence
- **Work Session**: Current files, tasks, and decisions
- **AI Insights**: Contributed insights from AI agents

### 🕸️ Relationship Graph
Visualize semantic relationships between concepts with:
- Interactive force-directed graph
- Node coloring by frequency (high/medium/low)
- Relationship edges showing dependencies
- Zoom and pan controls

### 🔍 Pattern Explorer
Deep dive into learned patterns with:
- Confidence-based grouping
- Pattern descriptions and reasoning
- Code examples from your codebase
- Coding style guidelines

### 📄 File Intelligence
Analyze specific files to see:
- Semantic concepts detected
- Relationships and dependencies
- Frequency and evolution metrics
- Last modification tracking

### 🗺️ Feature Router
Smart feature-to-file routing:
- Natural language feature descriptions
- AI-powered file recommendations
- Suggested starting points
- Complexity estimates and patterns

## Installation

1. **Install In Memoria MCP Server** (if not already installed):
   ```bash
   npm install -g in-memoria
   ```

2. **Install the Extension**:
   - Open VS Code
   - Go to Extensions (Ctrl+Shift+X / Cmd+Shift+X)
   - Search for "In Memoria Visualizer"
   - Click Install

3. **Start In Memoria Server**:
   ```bash
   npx in-memoria server
   ```

## Getting Started

### 1. Learn Your Codebase

First, let In Memoria learn from your codebase:

- Open Command Palette (Ctrl+Shift+P / Cmd+Shift+P)
- Run: `In Memoria: Learn Codebase`
- Wait for analysis to complete (~30-60s depending on size)

### 2. Explore Intelligence

Once learning is complete, explore your data:

- **View Dashboard**: Command Palette → `In Memoria: Show Intelligence Dashboard`
- **Browse Tree Views**: Click the In Memoria icon in the Activity Bar
- **Analyze Files**: Right-click in editor → `In Memoria: Show File Intelligence`
- **Route Features**: Command Palette → `In Memoria: Show Feature Router`

### 3. Search and Navigate

Use the built-in commands:

- `In Memoria: Search Concepts` - Find specific functions/classes
- `In Memoria: Route Feature to Files` - Get file recommendations
- `In Memoria: Show Relationship Graph` - Visualize dependencies
- `In Memoria: Refresh Intelligence` - Update all views

## Commands

| Command | Description | Shortcut |
|---------|-------------|----------|
| `In Memoria: Show Intelligence Dashboard` | Open overview dashboard | - |
| `In Memoria: Show Relationship Graph` | Visualize concept relationships | - |
| `In Memoria: Show Pattern Explorer` | Browse learned patterns | - |
| `In Memoria: Show File Intelligence` | Analyze current file | - |
| `In Memoria: Show Feature Router` | Route features to files | - |
| `In Memoria: Learn Codebase` | Analyze and learn from code | - |
| `In Memoria: Search Concepts` | Find semantic concepts | - |
| `In Memoria: Route Feature to Files` | Get file suggestions | - |
| `In Memoria: Refresh Intelligence` | Update all data views | - |

## Configuration

Configure the extension in VS Code settings:

```jsonc
{
  // Command to start In Memoria server
  "inMemoria.serverCommand": "npx in-memoria server",

  // Auto-connect on startup
  "inMemoria.autoConnect": true,

  // Auto-refresh interval (ms, 0 to disable)
  "inMemoria.refreshInterval": 30000,

  // Graph layout algorithm
  "inMemoria.graphLayout": "force", // "force", "hierarchical", "circular"

  // Show complexity metrics
  "inMemoria.showComplexityMetrics": true,

  // Max nodes in relationship graph
  "inMemoria.maxGraphNodes": 100
}
```

## Views

### Project Intelligence Tree

Hierarchical view showing:
- **Tech Stack**: Detected frameworks and technologies
- **Entry Points**: Main application entry points (web, API, CLI)
- **Key Directories**: Important project directories
- **Architecture**: Detected architectural pattern
- **Feature Map**: Feature-to-file mappings
- **Learning Status**: Intelligence health check

### Patterns Tree

Browse learned patterns organized by confidence:
- **High Confidence (>70%)**: Well-established patterns
- **Medium Confidence (40-70%)**: Emerging patterns
- **Low Confidence (<40%)**: Rare or experimental patterns

Each pattern shows:
- Description and reasoning
- Frequency and confidence score
- Code examples from your codebase

### Work Session Tree

Track current development activity:
- **Current Feature**: Active feature being developed
- **Current Files**: Files being modified
- **Pending Tasks**: Outstanding tasks
- **Recent Decisions**: Architectural decisions made
- **Recent Focus**: Areas of recent activity

### AI Insights Tree

View contributed insights from AI agents:
- Bug patterns discovered
- Optimization suggestions
- Refactoring recommendations
- Best practices identified

## Use Cases

### 1. **Onboarding New Developers**
Show new team members the codebase structure, patterns, and conventions instantly through the dashboard and pattern explorer.

### 2. **Maintaining Code Consistency**
Check pattern recommendations before implementing new features to follow established conventions.

### 3. **Finding Related Code**
Use the relationship graph to discover how concepts are connected and find related implementations.

### 4. **Tracking Work Context**
Resume work sessions by viewing recent files, tasks, and decisions in the work session tree.

### 5. **AI-Assisted Development**
Use feature routing to get AI-powered file suggestions for implementing new features.

### 6. **Code Reviews**
Check file intelligence to understand concept usage and complexity before reviewing changes.

## Troubleshooting

### Extension not connecting?

1. **Check In Memoria server is running**:
   ```bash
   npx in-memoria server
   ```

2. **Verify server command in settings**:
   - Open Settings → Search "In Memoria"
   - Check `inMemoria.serverCommand` is correct

3. **Check for errors**:
   - Open Output panel (View → Output)
   - Select "In Memoria Visualizer" from dropdown

### No data showing in views?

1. **Learn the codebase first**:
   - Run `In Memoria: Learn Codebase`
   - Wait for completion message

2. **Refresh the views**:
   - Run `In Memoria: Refresh Intelligence`
   - Or click refresh icon in tree view toolbar

### Graph not displaying properly?

1. **Reduce max nodes**:
   - Settings → `inMemoria.maxGraphNodes` → Lower value (e.g., 50)

2. **Try different layout**:
   - Settings → `inMemoria.graphLayout` → Try "hierarchical" or "circular"

## Requirements

- **VS Code**: Version 1.85.0 or higher
- **Node.js**: Version 18.0.0 or higher
- **In Memoria**: Version 0.5.0 or higher

## About In Memoria

In Memoria is an MCP server that learns from your actual codebase and remembers across sessions. It builds persistent intelligence about your code (patterns, architecture, conventions, decisions) that AI assistants can query through the Model Context Protocol.

Learn more: [github.com/pi22by7/in-memoria](https://github.com/pi22by7/in-memoria)

## Contributing

Found a bug or have a feature request?

- **Issues**: [github.com/pi22by7/in-memoria/issues](https://github.com/pi22by7/in-memoria/issues)
- **Discussions**: [github.com/pi22by7/in-memoria/discussions](https://github.com/pi22by7/in-memoria/discussions)
- **Discord**: [discord.gg/6mGsM4qkYm](https://discord.gg/6mGsM4qkYm)

## License

MIT License - see [LICENSE](LICENSE) file for details

## Credits

Created for the In Memoria project by [@pi22by7](https://github.com/pi22by7)

Built with:
- [Model Context Protocol SDK](https://github.com/modelcontextprotocol/sdk)
- [VS Code Extension API](https://code.visualstudio.com/api)
- [D3.js](https://d3js.org/) for visualizations

---

**Happy Coding with In Memoria! 🧠✨**
