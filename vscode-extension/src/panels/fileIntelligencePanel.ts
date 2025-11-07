import * as vscode from 'vscode';
import { InMemoriaClient } from '../mcpClient';

export class FileIntelligencePanel {
  public static currentPanel: FileIntelligencePanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    private mcpClient: InMemoriaClient,
    private filePath: string
  ) {
    this._panel = panel;
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._update();
  }

  public static render(extensionUri: vscode.Uri, mcpClient: InMemoriaClient, filePath: string) {
    const panel = vscode.window.createWebviewPanel(
      'inMemoriaFileIntel',
      `File: ${filePath.split('/').pop()}`,
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    FileIntelligencePanel.currentPanel = new FileIntelligencePanel(panel, extensionUri, mcpClient, filePath);
  }

  private async _update() {
    try {
      // Analyze the file
      const insights = await this.mcpClient.getSemanticInsights(undefined, undefined, 100);
      const fileInsights = insights.insights.filter(i =>
        i.usage.contexts.some(c => c.includes(this.filePath))
      );

      this._panel.webview.html = this._getFileIntelHtml(fileInsights);
    } catch (error: any) {
      this._panel.webview.html = this._getErrorHtml(error.message);
    }
  }

  private _getErrorHtml(error: string): string {
    return `<!DOCTYPE html>
    <html><body style="font-family: var(--vscode-font-family); padding: 20px;">
      <h2 style="color: var(--vscode-errorForeground);">⚠ Error Loading File Intelligence</h2>
      <p>${error}</p>
    </body></html>`;
  }

  private _getFileIntelHtml(insights: any[]): string {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>File Intelligence</title>
      <style>
        body { font-family: var(--vscode-font-family); padding: 20px; background: var(--vscode-editor-background); color: var(--vscode-foreground); }
        h1 { color: var(--vscode-textLink-foreground); word-break: break-all; }
        .section { margin: 20px 0; padding: 15px; background: var(--vscode-editor-background); border: 1px solid var(--vscode-panel-border); border-radius: 6px; }
        .concept { padding: 10px; margin: 8px 0; background: var(--vscode-list-hoverBackground); border-radius: 4px; }
        .concept-name { font-weight: bold; font-size: 16px; }
        .concept-details { font-size: 13px; color: var(--vscode-descriptionForeground); margin-top: 5px; }
        .relations { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
        .relation-tag { padding: 4px 10px; background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); border-radius: 12px; font-size: 11px; }
      </style>
    </head>
    <body>
      <h1>📄 ${this.filePath.split('/').pop()}</h1>
      <p style="color: var(--vscode-descriptionForeground); margin-bottom: 20px;">${this.filePath}</p>

      <div class="section">
        <h2>🧠 Semantic Concepts (${insights.length})</h2>
        ${insights.length > 0 ? insights.map(insight => `
          <div class="concept">
            <div class="concept-name">${insight.concept}</div>
            <div class="concept-details">
              Frequency: ${insight.usage.frequency.toFixed(0)} |
              Last Modified: ${new Date(insight.evolution.lastModified).toLocaleDateString()}
            </div>
            ${insight.relationships.length > 0 ? `
              <div class="relations">
                ${insight.relationships.map((rel: string) => `<span class="relation-tag">${rel}</span>`).join('')}
              </div>
            ` : ''}
          </div>
        `).join('') : '<p style="text-align: center; color: var(--vscode-descriptionForeground);">No concepts found for this file</p>'}
      </div>
    </body>
    </html>`;
  }

  public dispose() {
    FileIntelligencePanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}
