import * as vscode from 'vscode';
import { InMemoriaClient } from '../mcpClient';

export class DashboardPanel {
  public static currentPanel: DashboardPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    private mcpClient: InMemoriaClient
  ) {
    this._panel = panel;
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._panel.webview.html = this._getLoadingHtml();
    this._update();
  }

  public static render(extensionUri: vscode.Uri, mcpClient: InMemoriaClient) {
    if (DashboardPanel.currentPanel) {
      DashboardPanel.currentPanel._panel.reveal(vscode.ViewColumn.One);
    } else {
      const panel = vscode.window.createWebviewPanel(
        'inMemoriaDashboard',
        'In Memoria Dashboard',
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true
        }
      );

      DashboardPanel.currentPanel = new DashboardPanel(panel, extensionUri, mcpClient);
    }
  }

  private async _update() {
    try {
      const blueprint = await this.mcpClient.getProjectBlueprint();
      const metrics = await this.mcpClient.getIntelligenceMetrics();
      const profile = await this.mcpClient.getDeveloperProfile(true);

      this._panel.webview.html = this._getDashboardHtml(blueprint, metrics, profile);
    } catch (error: any) {
      this._panel.webview.html = this._getErrorHtml(error.message);
    }
  }

  private _getLoadingHtml(): string {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>In Memoria Dashboard</title>
      <style>
        body { display: flex; align-items: center; justify-content: center; height: 100vh; font-family: var(--vscode-font-family); }
        .loading { text-align: center; }
      </style>
    </head>
    <body>
      <div class="loading">
        <h2>Loading Dashboard...</h2>
        <p>Fetching intelligence data from In Memoria</p>
      </div>
    </body>
    </html>`;
  }

  private _getErrorHtml(error: string): string {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>In Memoria Dashboard</title>
      <style>
        body { font-family: var(--vscode-font-family); padding: 20px; }
        .error { color: var(--vscode-errorForeground); background: var(--vscode-inputValidation-errorBackground); padding: 15px; border-radius: 4px; }
      </style>
    </head>
    <body>
      <div class="error">
        <h2>⚠ Error Loading Dashboard</h2>
        <p>${error}</p>
        <p>Make sure In Memoria server is running: <code>npx in-memoria server</code></p>
      </div>
    </body>
    </html>`;
  }

  private _getDashboardHtml(blueprint: any, metrics: any, profile: any): string {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>In Memoria Dashboard</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: var(--vscode-font-family);
          color: var(--vscode-foreground);
          background: var(--vscode-editor-background);
          padding: 20px;
          line-height: 1.6;
        }
        .dashboard { max-width: 1400px; margin: 0 auto; }
        h1 {
          margin-bottom: 30px;
          font-size: 32px;
          color: var(--vscode-textLink-foreground);
          display: flex;
          align-items: center;
          gap: 12px;
        }
        h2 {
          margin: 30px 0 20px;
          font-size: 20px;
          border-bottom: 2px solid var(--vscode-textLink-foreground);
          padding-bottom: 10px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .card {
          background: var(--vscode-editor-background);
          border: 1px solid var(--vscode-panel-border);
          border-radius: 8px;
          padding: 24px;
          box-shadow: 0 2px 12px rgba(0,0,0,0.15);
          transition: transform 0.2s, box-shadow 0.2s;
          position: relative;
          overflow: hidden;
        }
        .card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
          background: linear-gradient(90deg, var(--vscode-textLink-foreground), var(--vscode-textLink-activeForeground));
        }
        .card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 20px rgba(0,0,0,0.2);
        }
        .card h3 { font-size: 13px; color: var(--vscode-descriptionForeground); margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 600; }
        .card .value { font-size: 42px; font-weight: bold; color: var(--vscode-textLink-foreground); line-height: 1; }
        .card .label { font-size: 12px; color: var(--vscode-descriptionForeground); margin-top: 8px; }
        .list { list-style: none; }
        .list li {
          padding: 14px;
          margin: 8px 0;
          background: var(--vscode-list-hoverBackground);
          border-radius: 6px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          transition: background 0.2s;
          border-left: 3px solid transparent;
        }
        .list li:hover {
          background: var(--vscode-list-activeSelectionBackground);
          border-left-color: var(--vscode-textLink-foreground);
        }
        .list li .name { font-weight: 500; font-size: 14px; }
        .list li .count {
          background: var(--vscode-badge-background);
          color: var(--vscode-badge-foreground);
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
        }
        .badge { display: inline-block; padding: 6px 14px; border-radius: 14px; font-size: 12px; font-weight: 600; margin: 4px; }
        .badge.high { background: #28a745; color: white; }
        .badge.medium { background: #ffc107; color: #000; }
        .badge.low { background: #6c757d; color: white; }
        .architecture {
          font-size: 18px;
          padding: 20px;
          background: var(--vscode-textBlockQuote-background);
          border-left: 5px solid var(--vscode-textLink-foreground);
          border-radius: 6px;
          font-weight: 500;
        }
        .status {
          display: flex;
          align-items: center;
          gap: 15px;
          padding: 18px;
          background: var(--vscode-inputValidation-infoBackground);
          border-radius: 8px;
          margin-bottom: 25px;
          border: 1px solid var(--vscode-panel-border);
        }
        .status.success {
          background: var(--vscode-inputValidation-successBackground);
          border-color: #28a745;
        }
        .status-icon { font-size: 28px; }
        .patterns { display: flex; flex-wrap: wrap; gap: 12px; }
        .pattern-chip {
          padding: 10px 18px;
          background: var(--vscode-button-secondaryBackground);
          border-radius: 18px;
          font-size: 13px;
          transition: all 0.2s;
          border: 1px solid var(--vscode-panel-border);
        }
        .pattern-chip:hover {
          background: var(--vscode-button-secondaryHoverBackground);
          transform: translateY(-1px);
        }
        .progress-bar {
          width: 100%;
          height: 8px;
          background: var(--vscode-panel-border);
          border-radius: 4px;
          overflow: hidden;
          margin-top: 8px;
        }
        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--vscode-textLink-foreground), var(--vscode-textLink-activeForeground));
          transition: width 0.3s;
        }
      </style>
    </head>
    <body>
      <div class="dashboard">
        <h1>📊 In Memoria Intelligence Dashboard</h1>

        ${blueprint.learningStatus ? `
        <div class="status ${blueprint.learningStatus.hasIntelligence ? 'success' : ''}">
          <div class="status-icon">${blueprint.learningStatus.hasIntelligence ? '✅' : '⚠️'}</div>
          <div>
            <strong>${blueprint.learningStatus.message}</strong>
            <div style="font-size: 12px; margin-top: 5px;">${blueprint.learningStatus.recommendation === 'ready' ? 'All systems operational' : 'Run "Learn Codebase" to build intelligence'}</div>
          </div>
        </div>
        ` : ''}

        <h2>📈 Intelligence Metrics</h2>
        <div class="grid">
          <div class="card">
            <h3>Semantic Concepts</h3>
            <div class="value">${metrics.totalConcepts || 0}</div>
            <div class="label">Functions, classes, and variables identified</div>
          </div>
          <div class="card">
            <h3>Learned Patterns</h3>
            <div class="value">${metrics.totalPatterns || 0}</div>
            <div class="label">Coding patterns discovered</div>
          </div>
          <div class="card">
            <h3>Files Analyzed</h3>
            <div class="value">${metrics.totalFiles || 0}</div>
            <div class="label">Total files in intelligence database</div>
          </div>
          <div class="card">
            <h3>Avg Complexity</h3>
            <div class="value">${metrics.avgComplexity?.toFixed(1) || 'N/A'}</div>
            <div class="label">Average cyclomatic complexity</div>
          </div>
        </div>

        <h2>🏗️ Project Architecture</h2>
        <div class="architecture">
          <strong>Pattern:</strong> ${blueprint.architecture}
        </div>

        <h2>🔧 Tech Stack</h2>
        <div class="patterns">
          ${blueprint.techStack.map((tech: string) => `<div class="pattern-chip">${tech}</div>`).join('')}
        </div>

        <h2>🎯 Entry Points</h2>
        <ul class="list">
          ${Object.entries(blueprint.entryPoints).map(([type, path]: [string, any]) => `
            <li>
              <span class="name">${type}</span>
              <span style="font-size: 12px; color: var(--vscode-descriptionForeground);">${path}</span>
            </li>
          `).join('')}
        </ul>

        ${profile.preferredPatterns && profile.preferredPatterns.length > 0 ? `
        <h2>⭐ Top Patterns</h2>
        <ul class="list">
          ${profile.preferredPatterns.slice(0, 5).map((p: any) => `
            <li>
              <span class="name">${p.pattern}</span>
              <span class="badge ${p.confidence >= 0.7 ? 'high' : p.confidence >= 0.4 ? 'medium' : 'low'}">
                ${(p.confidence * 100).toFixed(0)}%
              </span>
            </li>
          `).join('')}
        </ul>
        ` : ''}

        ${profile.currentWork && profile.currentWork.currentFiles.length > 0 ? `
        <h2>💼 Current Work Session</h2>
        <div class="card">
          ${profile.currentWork.lastFeature ? `<p><strong>Feature:</strong> ${profile.currentWork.lastFeature}</p>` : ''}
          <p style="margin-top: 10px;"><strong>Active Files (${profile.currentWork.currentFiles.length}):</strong></p>
          <ul class="list" style="margin-top: 10px;">
            ${profile.currentWork.currentFiles.slice(0, 5).map((file: string) => `
              <li style="font-size: 12px;">
                <span>${file.split('/').pop()}</span>
              </li>
            `).join('')}
          </ul>
        </div>
        ` : ''}

        ${metrics.languageDistribution ? `
        <h2>📊 Language Distribution</h2>
        <ul class="list">
          ${Object.entries(metrics.languageDistribution).map(([lang, count]: [string, any]) => `
            <li>
              <span class="name">${lang}</span>
              <span class="count">${count} files</span>
            </li>
          `).join('')}
        </ul>
        ` : ''}
      </div>
    </body>
    </html>`;
  }

  public dispose() {
    DashboardPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}
