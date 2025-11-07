# In Memoria VS Code Extension - Developer Guide

## Architecture Overview

The In Memoria Visualizer extension is built with a modular architecture:

```
vscode-extension/
├── src/
│   ├── extension.ts              # Main extension entry point
│   ├── mcpClient.ts               # MCP client for In Memoria server
│   ├── views/                     # Tree view providers
│   │   ├── projectIntelligenceProvider.ts
│   │   ├── patternsProvider.ts
│   │   ├── workSessionProvider.ts
│   │   └── insightsProvider.ts
│   └── panels/                    # Webview panels
│       ├── dashboardPanel.ts
│       ├── relationshipGraphPanel.ts
│       ├── patternExplorerPanel.ts
│       ├── fileIntelligencePanel.ts
│       └── featureRouterPanel.ts
├── resources/                     # Static assets
├── package.json                   # Extension manifest
└── tsconfig.json                  # TypeScript configuration
```

## Components

### 1. MCP Client (`mcpClient.ts`)

Handles communication with In Memoria server via Model Context Protocol:

- **Connection Management**: Establishes stdio transport to server
- **Tool Calls**: Wraps all In Memoria MCP tools
- **Type Safety**: Full TypeScript interfaces for all data types
- **Error Handling**: Graceful error handling and retries

**Key Methods**:
- `connect()` - Connect to In Memoria server
- `getProjectBlueprint()` - Get project overview
- `getSemanticInsights()` - Query semantic concepts
- `getPatternRecommendations()` - Get pattern suggestions
- `predictCodingApproach()` - Route features to files
- `getDeveloperProfile()` - Get coding style and work context
- `learnCodebase()` - Trigger learning process

### 2. Tree View Providers

Implement `vscode.TreeDataProvider` for hierarchical data display:

#### ProjectIntelligenceProvider
- Displays project blueprint, tech stack, entry points
- Shows feature map with file associations
- Displays learning status and intelligence health

#### PatternsProvider
- Groups patterns by confidence (high/medium/low)
- Shows pattern descriptions, examples, and reasoning
- Expandable tree for pattern details

#### WorkSessionProvider
- Displays current feature and active files
- Shows pending tasks and recent decisions
- Tracks recent focus areas

#### InsightsProvider
- Lists AI-contributed insights
- Categorizes by type (bug patterns, optimizations, etc.)
- Shows confidence scores and validation status

### 3. Webview Panels

Rich HTML-based visualizations with VS Code webview API:

#### DashboardPanel
- **Metrics Cards**: Concepts, patterns, files, complexity
- **Architecture Display**: Detected architectural pattern
- **Tech Stack**: Technologies and frameworks
- **Entry Points**: Application entry points list
- **Top Patterns**: Most-used patterns with confidence
- **Work Session**: Current files and tasks
- **Language Distribution**: File count by language

#### RelationshipGraphPanel
- **SVG-based Graph**: Interactive force-directed layout
- **Node Coloring**: By frequency (high/medium/low)
- **Edges**: Show concept relationships
- **Controls**: Reset zoom, toggle labels
- **Click Interaction**: Show concept details

#### PatternExplorerPanel
- **Coding Style Summary**: Naming, structure, testing
- **Pattern List**: All learned patterns with details
- **Examples**: Code snippets from codebase
- **Confidence Indicators**: Visual badges

#### FileIntelligencePanel
- **Semantic Concepts**: Functions, classes in file
- **Relationships**: Dependencies and connections
- **Metrics**: Frequency and last modified
- **Evolution**: Change tracking over time

#### FeatureRouterPanel
- **Input Form**: Natural language feature description
- **Routing Results**: AI-powered file suggestions
- **Approach Guidance**: Recommended implementation
- **Suggested Patterns**: Relevant patterns to use
- **Target Files**: Files to modify with reasoning

## Data Flow

```
VS Code Extension
       ↓
   MCP Client (stdio)
       ↓
In Memoria Server
       ↓
   SQLite Database
   (Persistent Intelligence)
```

1. **User Action**: User triggers command or views data
2. **Extension Request**: Extension calls MCP client method
3. **MCP Tool Call**: Client sends tool call to server via stdio
4. **Server Processing**: Server queries database and processes
5. **Response**: Server returns JSON response
6. **Display**: Extension updates UI with data

## Development

### Building

```bash
cd vscode-extension
npm install
npm run compile
```

### Running

1. Open extension folder in VS Code
2. Press F5 to launch Extension Development Host
3. Test features in the new VS Code window

### Debugging

- Set breakpoints in TypeScript files
- Use Debug Console for logs
- Check Output panel for MCP communication

### Adding New Features

#### New Command

1. Add command to `package.json` contributes.commands
2. Register command handler in `extension.ts` activate()
3. Implement command logic

#### New Tree View

1. Create provider class implementing `TreeDataProvider`
2. Register in `extension.ts` with `registerTreeDataProvider`
3. Add view to `package.json` contributes.views

#### New Webview Panel

1. Create panel class extending base pattern
2. Implement `_getHtml()` method with HTML/CSS/JS
3. Handle webview messages for interactivity
4. Register command to open panel

## Testing

### Manual Testing Checklist

- [ ] Extension activates without errors
- [ ] Connects to In Memoria server successfully
- [ ] Status bar shows connection status
- [ ] Tree views populate with data
- [ ] Dashboard displays metrics correctly
- [ ] Relationship graph renders and is interactive
- [ ] Pattern explorer shows patterns and examples
- [ ] File intelligence analyzes current file
- [ ] Feature router routes features to files
- [ ] Search concepts finds and displays results
- [ ] Refresh command updates all views
- [ ] Learn codebase triggers learning successfully

### Unit Testing

```bash
npm test
```

Tests cover:
- MCP client methods
- Tree view data transformation
- Command handlers
- Error handling

## Packaging

Create `.vsix` package:

```bash
npm run package
```

Install locally:

```bash
code --install-extension in-memoria-visualizer-0.1.0.vsix
```

## Publishing

Publish to VS Code Marketplace:

```bash
vsce publish
```

## Performance Considerations

1. **Lazy Loading**: Tree views load data on demand
2. **Caching**: MCP client caches responses where appropriate
3. **Throttling**: Auto-refresh uses configurable interval
4. **Webview Retention**: Panels retain context when hidden
5. **Graph Limits**: Max nodes configurable to prevent slowdowns

## Security

- **No External Requests**: All data stays local
- **Stdio Transport**: Secure local communication with server
- **Input Sanitization**: User inputs sanitized in webviews
- **Content Security Policy**: Webviews use strict CSP

## Future Enhancements

### Planned Features
- [ ] Enhanced graph with D3.js force simulation
- [ ] Timeline view for concept evolution
- [ ] Custom query builder
- [ ] Export intelligence to Markdown/JSON
- [ ] Real-time file watching and updates
- [ ] Multi-project workspace support
- [ ] Collaborative intelligence sharing
- [ ] Integration with VS Code testing
- [ ] Diff view for pattern changes
- [ ] AI insight validation workflow

### API Extensions
- [ ] Extension API for other extensions
- [ ] Custom visualization plugins
- [ ] Webhook support for CI/CD integration
- [ ] REST API for external tools

## Troubleshooting

### Extension doesn't activate
- Check VS Code version >= 1.85.0
- Verify `package.json` activationEvents
- Check Extension Host logs (Help → Toggle Developer Tools)

### MCP client fails to connect
- Ensure In Memoria server is running
- Check `inMemoria.serverCommand` setting
- Verify Node.js >= 18.0.0
- Check server logs for errors

### Webviews don't render
- Check Content Security Policy in webview HTML
- Verify script sources are allowed
- Check for JavaScript errors in webview console

### Tree views empty
- Run "Learn Codebase" command first
- Check MCP server has data in database
- Verify workspace folder is open
- Try "Refresh Intelligence" command

## Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create feature branch
3. Make changes with tests
4. Submit pull request
5. Follow code style (ESLint)

## Resources

- [VS Code Extension API](https://code.visualstudio.com/api)
- [MCP SDK Documentation](https://github.com/modelcontextprotocol/sdk)
- [In Memoria Documentation](https://github.com/pi22by7/in-memoria)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

## License

MIT License - Same as In Memoria project

## Support

- Issues: [GitHub Issues](https://github.com/pi22by7/in-memoria/issues)
- Discord: [discord.gg/6mGsM4qkYm](https://discord.gg/6mGsM4qkYm)
- Email: [talk@pi22by7.me](mailto:talk@pi22by7.me)
