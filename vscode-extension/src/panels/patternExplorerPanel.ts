import * as vscode from 'vscode';
import { InMemoriaClient } from '../mcpClient';

export class PatternExplorerPanel {
  public static currentPanel: PatternExplorerPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    private mcpClient: InMemoriaClient
  ) {
    this._panel = panel;
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._update();
  }

  public static render(extensionUri: vscode.Uri, mcpClient: InMemoriaClient) {
    if (PatternExplorerPanel.currentPanel) {
      PatternExplorerPanel.currentPanel._panel.reveal(vscode.ViewColumn.One);
    } else {
      const panel = vscode.window.createWebviewPanel(
        'inMemoriaPatterns',
        'Pattern Explorer',
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true
        }
      );

      PatternExplorerPanel.currentPanel = new PatternExplorerPanel(panel, extensionUri, mcpClient);
    }
  }

  private async _update() {
    try {
      const result = await this.mcpClient.getPatternRecommendations('explore all patterns');
      const profile = await this.mcpClient.getDeveloperProfile(false);
      this._panel.webview.html = this._getPatternsHtml(result.recommendations, profile);
    } catch (error: any) {
      this._panel.webview.html = this._getErrorHtml(error.message);
    }
  }

  private _getErrorHtml(error: string): string {
    return `<!DOCTYPE html>
    <html><body style="font-family: var(--vscode-font-family); padding: 20px;">
      <h2 style="color: var(--vscode-errorForeground);">⚠ Error Loading Patterns</h2>
      <p>${error}</p>
    </body></html>`;
  }

  private _getPatternsHtml(patterns: any[], profile: any): string {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Pattern Explorer</title>
      <style>
        body { font-family: var(--vscode-font-family); padding: 20px; background: var(--vscode-editor-background); color: var(--vscode-foreground); }
        h1 { color: var(--vscode-textLink-foreground); margin-bottom: 30px; }
        h2 { margin-top: 30px; border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 10px; }
        .pattern { background: var(--vscode-editor-background); border: 1px solid var(--vscode-panel-border); border-radius: 6px; padding: 15px; margin: 15px 0; }
        .pattern-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .pattern-title { font-size: 18px; font-weight: bold; }
        .confidence { padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 500; }
        .confidence.high { background: #28a745; color: white; }
        .confidence.medium { background: #ffc107; color: black; }
        .confidence.low { background: #dc3545; color: white; }
        .pattern-description { color: var(--vscode-descriptionForeground); margin-bottom: 10px; }
        .pattern-reasoning { font-size: 13px; font-style: italic; color: var(--vscode-textPreformat-foreground); }
        .examples { margin-top: 10px; }
        .example { background: var(--vscode-textBlockQuote-background); border-left: 3px solid var(--vscode-textLink-foreground); padding: 10px; margin: 5px 0; font-family: monospace; font-size: 12px; overflow-x: auto; }
        .coding-style { background: var(--vscode-textBlockQuote-background); padding: 15px; border-radius: 4px; margin-bottom: 20px; }
        .style-item { margin: 8px 0; }
      </style>
    </head>
    <body>
      <h1>🔍 Pattern Explorer</h1>

      <h2>📋 Coding Style</h2>
      <div class="coding-style">
        <div class="style-item"><strong>Naming Conventions:</strong> ${Object.entries(profile.codingStyle.namingConventions).map(([key, val]: [string, any]) => `${key}: ${val}`).join(', ')}</div>
        <div class="style-item"><strong>Structural Preferences:</strong> ${profile.codingStyle.structuralPreferences.join(', ')}</div>
        <div class="style-item"><strong>Testing Approach:</strong> ${profile.codingStyle.testingApproach}</div>
      </div>

      <h2>⭐ Learned Patterns (${patterns.length})</h2>
      ${patterns.map(p => `
        <div class="pattern">
          <div class="pattern-header">
            <div class="pattern-title">${p.pattern}</div>
            <div class="confidence ${p.confidence >= 0.7 ? 'high' : p.confidence >= 0.4 ? 'medium' : 'low'}">
              ${(p.confidence * 100).toFixed(0)}% confidence
            </div>
          </div>
          <div class="pattern-description">${p.description}</div>
          <div class="pattern-reasoning">💡 ${p.reasoning}</div>
          ${p.examples && p.examples.length > 0 ? `
            <div class="examples">
              <strong>Examples:</strong>
              ${p.examples.slice(0, 2).map((ex: string) => `
                <pre class="example">${ex.substring(0, 200)}${ex.length > 200 ? '...' : ''}</pre>
              `).join('')}
            </div>
          ` : ''}
        </div>
      `).join('')}

      ${patterns.length === 0 ? '<p style="text-align: center; color: var(--vscode-descriptionForeground); margin: 40px;">No patterns learned yet. Run "Learn Codebase" first.</p>' : ''}
    </body>
    </html>`;
  }

  public dispose() {
    PatternExplorerPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}
