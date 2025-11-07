import * as vscode from 'vscode';
import { InMemoriaClient } from './mcpClient';
import { ProjectIntelligenceProvider } from './views/projectIntelligenceProvider';
import { PatternsProvider } from './views/patternsProvider';
import { WorkSessionProvider } from './views/workSessionProvider';
import { InsightsProvider } from './views/insightsProvider';
import { DashboardPanel } from './panels/dashboardPanel';
import { RelationshipGraphPanel } from './panels/relationshipGraphPanel';
import { PatternExplorerPanel } from './panels/patternExplorerPanel';
import { FileIntelligencePanel } from './panels/fileIntelligencePanel';
import { FeatureRouterPanel } from './panels/featureRouterPanel';

let mcpClient: InMemoriaClient;
let projectIntelligenceProvider: ProjectIntelligenceProvider;
let patternsProvider: PatternsProvider;
let workSessionProvider: WorkSessionProvider;
let insightsProvider: InsightsProvider;
let statusBarItem: vscode.StatusBarItem;

export async function activate(context: vscode.ExtensionContext) {
  console.log('In Memoria Visualizer is now active!');

  // Initialize MCP client
  mcpClient = new InMemoriaClient();

  // Create status bar item
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.text = '$(sync~spin) In Memoria: Connecting...';
  statusBarItem.command = 'inMemoria.showDashboard';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // Initialize tree view providers
  projectIntelligenceProvider = new ProjectIntelligenceProvider(mcpClient);
  patternsProvider = new PatternsProvider(mcpClient);
  workSessionProvider = new WorkSessionProvider(mcpClient);
  insightsProvider = new InsightsProvider(mcpClient);

  // Register tree views
  vscode.window.registerTreeDataProvider(
    'inMemoriaProjectView',
    projectIntelligenceProvider
  );
  vscode.window.registerTreeDataProvider(
    'inMemoriaPatternsView',
    patternsProvider
  );
  vscode.window.registerTreeDataProvider(
    'inMemoriaWorkView',
    workSessionProvider
  );
  vscode.window.registerTreeDataProvider(
    'inMemoriaInsightsView',
    insightsProvider
  );

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('inMemoria.showDashboard', () => {
      DashboardPanel.render(context.extensionUri, mcpClient);
    }),

    vscode.commands.registerCommand('inMemoria.showRelationshipGraph', () => {
      RelationshipGraphPanel.render(context.extensionUri, mcpClient);
    }),

    vscode.commands.registerCommand('inMemoria.showPatternExplorer', () => {
      PatternExplorerPanel.render(context.extensionUri, mcpClient);
    }),

    vscode.commands.registerCommand('inMemoria.showWorkSession', () => {
      workSessionProvider.refresh();
      vscode.commands.executeCommand('inMemoriaWorkView.focus');
    }),

    vscode.commands.registerCommand('inMemoria.showFileIntelligence', async () => {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        const filePath = editor.document.uri.fsPath;
        FileIntelligencePanel.render(context.extensionUri, mcpClient, filePath);
      } else {
        vscode.window.showWarningMessage('No active file to analyze');
      }
    }),

    vscode.commands.registerCommand('inMemoria.showFeatureRouter', () => {
      FeatureRouterPanel.render(context.extensionUri, mcpClient);
    }),

    vscode.commands.registerCommand('inMemoria.refreshIntelligence', async () => {
      await refreshAllViews();
      vscode.window.showInformationMessage('Intelligence data refreshed');
    }),

    vscode.commands.registerCommand('inMemoria.learnCodebase', async () => {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
      }

      const path = workspaceFolders[0].uri.fsPath;

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Learning codebase with In Memoria...',
          cancellable: false
        },
        async (progress) => {
          try {
            const result = await mcpClient.learnCodebase(path, false);
            vscode.window.showInformationMessage(
              `Learned ${result.conceptsLearned} concepts and ${result.patternsLearned} patterns in ${(result.timeElapsed / 1000).toFixed(1)}s`
            );
            await refreshAllViews();
          } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to learn codebase: ${error.message}`);
          }
        }
      );
    }),

    vscode.commands.registerCommand('inMemoria.searchConcepts', async () => {
      const query = await vscode.window.showInputBox({
        prompt: 'Enter concept name to search (e.g., function or class name)',
        placeHolder: 'DatabaseConnection'
      });

      if (query) {
        try {
          const insights = await mcpClient.getSemanticInsights(query);
          if (insights.insights.length === 0) {
            vscode.window.showInformationMessage(`No concepts found matching "${query}"`);
          } else {
            // Show results in a quick pick
            const items = insights.insights.map(insight => ({
              label: insight.concept,
              description: `${insight.usage.contexts[0]}`,
              detail: `Frequency: ${insight.usage.frequency.toFixed(0)}, Relations: ${insight.relationships.length}`
            }));

            const selected = await vscode.window.showQuickPick(items, {
              placeHolder: 'Select a concept to view details'
            });

            if (selected) {
              // TODO: Show detailed concept view
              vscode.window.showInformationMessage(`Concept: ${selected.label}`);
            }
          }
        } catch (error: any) {
          vscode.window.showErrorMessage(`Search failed: ${error.message}`);
        }
      }
    }),

    vscode.commands.registerCommand('inMemoria.routeFeature', async () => {
      const description = await vscode.window.showInputBox({
        prompt: 'Describe the feature to route (e.g., "add password reset")',
        placeHolder: 'add user authentication'
      });

      if (description) {
        try {
          const prediction = await mcpClient.predictCodingApproach(description);

          if (prediction.fileRouting && prediction.fileRouting.targetFiles.length > 0) {
            const items = prediction.fileRouting.targetFiles.map(file => ({
              label: file.split('/').pop() || file,
              description: file,
              detail: `Confidence: ${(prediction.fileRouting!.confidence * 100).toFixed(0)}%`
            }));

            const selected = await vscode.window.showQuickPick(items, {
              placeHolder: prediction.fileRouting.reasoning
            });

            if (selected && selected.description) {
              const doc = await vscode.workspace.openTextDocument(selected.description);
              await vscode.window.showTextDocument(doc);
            }
          } else {
            vscode.window.showInformationMessage('No file routing suggestions available');
          }
        } catch (error: any) {
          vscode.window.showErrorMessage(`Routing failed: ${error.message}`);
        }
      }
    }),

    vscode.commands.registerCommand('inMemoria.treeView.refresh', () => {
      refreshAllViews();
    }),

    vscode.commands.registerCommand('inMemoria.treeView.showItem', (item: any) => {
      if (item.filePath) {
        vscode.workspace.openTextDocument(item.filePath).then(doc => {
          vscode.window.showTextDocument(doc);
        });
      }
    })
  );

  // Auto-connect if configured
  const config = vscode.workspace.getConfiguration('inMemoria');
  if (config.get('autoConnect', true)) {
    try {
      await mcpClient.connect();
      updateStatusBar('connected');
      await refreshAllViews();
    } catch (error: any) {
      updateStatusBar('disconnected', error.message);
      vscode.window.showWarningMessage(
        `Could not connect to In Memoria server: ${error.message}. Run "in-memoria server" in your terminal.`
      );
    }
  }

  // Set up auto-refresh if configured
  const refreshInterval = config.get('refreshInterval', 30000);
  if (refreshInterval > 0) {
    setInterval(() => {
      if (mcpClient.isConnected()) {
        refreshAllViews();
      }
    }, refreshInterval);
  }
}

async function refreshAllViews() {
  projectIntelligenceProvider.refresh();
  patternsProvider.refresh();
  workSessionProvider.refresh();
  insightsProvider.refresh();
}

function updateStatusBar(status: 'connected' | 'disconnected', error?: string) {
  if (status === 'connected') {
    statusBarItem.text = '$(check) In Memoria: Connected';
    statusBarItem.tooltip = 'Click to show dashboard';
    statusBarItem.backgroundColor = undefined;
  } else {
    statusBarItem.text = '$(error) In Memoria: Disconnected';
    statusBarItem.tooltip = error || 'Not connected to In Memoria server';
    statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
  }
}

export function deactivate() {
  if (mcpClient) {
    mcpClient.disconnect();
  }
}
