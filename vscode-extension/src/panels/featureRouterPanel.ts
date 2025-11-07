import * as vscode from 'vscode';
import { InMemoriaClient } from '../mcpClient';

export class FeatureRouterPanel {
  public static currentPanel: FeatureRouterPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    private mcpClient: InMemoriaClient
  ) {
    this._panel = panel;
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._panel.webview.html = this._getRouterHtml();

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      async message => {
        switch (message.command) {
          case 'routeFeature':
            await this.routeFeature(message.description);
            break;
        }
      },
      null,
      this._disposables
    );
  }

  public static render(extensionUri: vscode.Uri, mcpClient: InMemoriaClient) {
    if (FeatureRouterPanel.currentPanel) {
      FeatureRouterPanel.currentPanel._panel.reveal(vscode.ViewColumn.One);
    } else {
      const panel = vscode.window.createWebviewPanel(
        'inMemoriaRouter',
        'Feature Router',
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true
        }
      );

      FeatureRouterPanel.currentPanel = new FeatureRouterPanel(panel, extensionUri, mcpClient);
    }
  }

  private async routeFeature(description: string) {
    try {
      const prediction = await this.mcpClient.predictCodingApproach(description);

      this._panel.webview.postMessage({
        command: 'routingResult',
        data: prediction
      });
    } catch (error: any) {
      this._panel.webview.postMessage({
        command: 'routingError',
        error: error.message
      });
    }
  }

  private _getRouterHtml(): string {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Feature Router</title>
      <style>
        body { font-family: var(--vscode-font-family); padding: 20px; background: var(--vscode-editor-background); color: var(--vscode-foreground); }
        h1 { color: var(--vscode-textLink-foreground); }
        .input-section { margin: 30px 0; }
        input { width: 100%; padding: 10px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 4px; font-family: var(--vscode-font-family); font-size: 14px; }
        button { padding: 10px 20px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; border-radius: 4px; cursor: pointer; font-size: 14px; margin-top: 10px; }
        button:hover { background: var(--vscode-button-hoverBackground); }
        .result { margin-top: 30px; padding: 20px; background: var(--vscode-editor-background); border: 1px solid var(--vscode-panel-border); border-radius: 6px; display: none; }
        .result.show { display: block; }
        .result h2 { margin-top: 0; color: var(--vscode-textLink-foreground); }
        .approach { background: var(--vscode-textBlockQuote-background); padding: 15px; border-left: 4px solid var(--vscode-textLink-foreground); border-radius: 4px; margin: 15px 0; }
        .file-list { list-style: none; padding: 0; }
        .file-list li { padding: 10px; margin: 5px 0; background: var(--vscode-list-hoverBackground); border-radius: 4px; display: flex; justify-content: space-between; align-items: center; }
        .confidence-badge { padding: 4px 12px; background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); border-radius: 12px; font-size: 11px; }
        .error { background: var(--vscode-inputValidation-errorBackground); color: var(--vscode-errorForeground); padding: 15px; border-radius: 4px; margin-top: 20px; display: none; }
        .error.show { display: block; }
        .loading { display: none; text-align: center; margin: 20px; color: var(--vscode-descriptionForeground); }
        .loading.show { display: block; }
      </style>
    </head>
    <body>
      <h1>🗺️ Feature Router</h1>
      <p style="color: var(--vscode-descriptionForeground);">Describe a feature and In Memoria will route you to the relevant files</p>

      <div class="input-section">
        <input type="text" id="featureInput" placeholder="e.g., add user authentication, implement password reset, create API endpoint..." />
        <button onclick="routeFeature()">Route Feature</button>
      </div>

      <div class="loading" id="loading">⏳ Analyzing codebase and routing feature...</div>
      <div class="error" id="error"></div>

      <div class="result" id="result">
        <h2>🎯 Routing Result</h2>
        <div id="resultContent"></div>
      </div>

      <script>
        const vscode = acquireVsCodeApi();

        function routeFeature() {
          const input = document.getElementById('featureInput');
          const description = input.value.trim();

          if (!description) {
            showError('Please enter a feature description');
            return;
          }

          document.getElementById('loading').classList.add('show');
          document.getElementById('error').classList.remove('show');
          document.getElementById('result').classList.remove('show');

          vscode.postMessage({
            command: 'routeFeature',
            description: description
          });
        }

        window.addEventListener('message', event => {
          const message = event.data;
          document.getElementById('loading').classList.remove('show');

          switch (message.command) {
            case 'routingResult':
              displayResult(message.data);
              break;
            case 'routingError':
              showError(message.error);
              break;
          }
        });

        function displayResult(data) {
          const resultDiv = document.getElementById('result');
          const contentDiv = document.getElementById('resultContent');

          let html = \`
            <div class="approach">
              <h3>Recommended Approach</h3>
              <p>\${data.approach}</p>
              <p style="margin-top: 10px; font-size: 13px; color: var(--vscode-descriptionForeground);">
                <strong>Reasoning:</strong> \${data.reasoning}
              </p>
              <p style="margin-top: 8px; font-size: 13px;">
                <strong>Complexity:</strong> <span class="confidence-badge">\${data.estimatedComplexity}</span>
              </p>
            </div>
          \`;

          if (data.suggestedPatterns && data.suggestedPatterns.length > 0) {
            html += \`
              <h3>Suggested Patterns</h3>
              <ul style="margin: 10px 0;">
                \${data.suggestedPatterns.map(p => '<li>' + p + '</li>').join('')}
              </ul>
            \`;
          }

          if (data.fileRouting && data.fileRouting.targetFiles.length > 0) {
            html += \`
              <h3>Target Files (\${data.fileRouting.targetFiles.length})</h3>
              <p style="margin: 10px 0; font-size: 13px; color: var(--vscode-descriptionForeground);">
                <strong>Feature:</strong> \${data.fileRouting.intendedFeature}<br>
                <strong>Work Type:</strong> \${data.fileRouting.workType}<br>
                <strong>Start Point:</strong> \${data.fileRouting.suggestedStartPoint}
              </p>
              <ul class="file-list">
                \${data.fileRouting.targetFiles.map(file => \`
                  <li>
                    <span>\${file.split('/').pop()}</span>
                    <span style="font-size: 11px; color: var(--vscode-descriptionForeground);">\${file}</span>
                  </li>
                \`).join('')}
              </ul>
              <p style="margin-top: 10px; font-size: 12px; font-style: italic;">
                💡 \${data.fileRouting.reasoning}
              </p>
            \`;
          }

          contentDiv.innerHTML = html;
          resultDiv.classList.add('show');
        }

        function showError(errorMessage) {
          const errorDiv = document.getElementById('error');
          errorDiv.textContent = '⚠️ ' + errorMessage;
          errorDiv.classList.add('show');
        }

        // Allow Enter key to submit
        document.getElementById('featureInput').addEventListener('keypress', function(e) {
          if (e.key === 'Enter') {
            routeFeature();
          }
        });
      </script>
    </body>
    </html>`;
  }

  public dispose() {
    FeatureRouterPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}
