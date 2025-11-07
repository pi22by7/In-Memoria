import * as vscode from 'vscode';
import { InMemoriaClient } from '../mcpClient';

export class RelationshipGraphPanel {
  public static currentPanel: RelationshipGraphPanel | undefined;
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
    if (RelationshipGraphPanel.currentPanel) {
      RelationshipGraphPanel.currentPanel._panel.reveal(vscode.ViewColumn.One);
    } else {
      const panel = vscode.window.createWebviewPanel(
        'inMemoriaGraph',
        'Relationship Graph',
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true
        }
      );

      RelationshipGraphPanel.currentPanel = new RelationshipGraphPanel(panel, extensionUri, mcpClient);
    }
  }

  private async _update() {
    try {
      const insights = await this.mcpClient.getSemanticInsights(undefined, undefined, 50);
      this._panel.webview.html = this._getGraphHtml(insights.insights);
    } catch (error: any) {
      this._panel.webview.html = this._getErrorHtml(error.message);
    }
  }

  private _getErrorHtml(error: string): string {
    return `<!DOCTYPE html>
    <html><body style="font-family: var(--vscode-font-family); padding: 20px;">
      <h2 style="color: var(--vscode-errorForeground);">⚠ Error Loading Graph</h2>
      <p>${error}</p>
    </body></html>`;
  }

  private _getGraphHtml(insights: any[]): string {
    // Build nodes and edges from insights
    const nodes = insights.map((insight, idx) => ({
      id: idx,
      label: insight.concept,
      group: insight.usage.frequency > 50 ? 'high' : insight.usage.frequency > 20 ? 'medium' : 'low'
    }));

    const edges: any[] = [];
    insights.forEach((insight, idx) => {
      insight.relationships.forEach((rel: string) => {
        const targetIdx = insights.findIndex(i => i.concept === rel);
        if (targetIdx !== -1) {
          edges.push({ from: idx, to: targetIdx });
        }
      });
    });

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Relationship Graph</title>
      <style>
        body { margin: 0; padding: 0; font-family: var(--vscode-font-family); overflow: hidden; background: var(--vscode-editor-background); }
        #graph { width: 100vw; height: 100vh; }
        .controls {
          position: absolute;
          top: 15px;
          left: 15px;
          background: var(--vscode-editor-background);
          padding: 12px;
          border: 1px solid var(--vscode-panel-border);
          border-radius: 8px;
          z-index: 1000;
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }
        .controls button {
          margin: 5px;
          padding: 8px 14px;
          background: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 13px;
          transition: all 0.2s;
        }
        .controls button:hover {
          background: var(--vscode-button-hoverBackground);
          transform: translateY(-1px);
        }
        .node {
          fill: var(--vscode-textLink-foreground);
          stroke: var(--vscode-editor-background);
          stroke-width: 2.5px;
          cursor: pointer;
          transition: all 0.3s;
        }
        .node:hover {
          stroke-width: 4px;
          stroke: var(--vscode-textLink-activeForeground);
        }
        .node.high { fill: #28a745; }
        .node.medium { fill: #ffc107; }
        .node.low { fill: #6c757d; }
        .link {
          stroke: var(--vscode-panel-border);
          stroke-opacity: 0.4;
          stroke-width: 1.5px;
        }
        .link.highlighted {
          stroke: var(--vscode-textLink-foreground);
          stroke-opacity: 0.8;
          stroke-width: 2.5px;
        }
        .label {
          font-size: 11px;
          fill: var(--vscode-foreground);
          pointer-events: none;
          font-weight: 500;
        }
        .info {
          position: absolute;
          bottom: 15px;
          left: 15px;
          background: var(--vscode-editor-background);
          padding: 15px;
          border: 1px solid var(--vscode-panel-border);
          border-radius: 8px;
          font-size: 12px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }
        .legend {
          position: absolute;
          top: 15px;
          right: 15px;
          background: var(--vscode-editor-background);
          padding: 12px;
          border: 1px solid var(--vscode-panel-border);
          border-radius: 8px;
          font-size: 11px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }
        .legend-item {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 6px 0;
        }
        .legend-color {
          width: 16px;
          height: 16px;
          border-radius: 50%;
        }
      </style>
    </head>
    <body>
      <div class="controls">
        <button onclick="resetZoom()">🔄 Reset View</button>
        <button onclick="toggleLabels()">🏷️ Toggle Labels</button>
        <button onclick="zoomIn()">🔍 Zoom In</button>
        <button onclick="zoomOut()">🔎 Zoom Out</button>
      </div>
      <svg id="graph"></svg>
      <div class="legend">
        <strong style="display: block; margin-bottom: 8px;">Node Frequency</strong>
        <div class="legend-item">
          <div class="legend-color" style="background: #28a745;"></div>
          <span>High (>50)</span>
        </div>
        <div class="legend-item">
          <div class="legend-color" style="background: #ffc107;"></div>
          <span>Medium (20-50)</span>
        </div>
        <div class="legend-item">
          <div class="legend-color" style="background: #6c757d;"></div>
          <span>Low (<20)</span>
        </div>
      </div>
      <div class="info">
        <strong>${nodes.length} Concepts</strong> • ${edges.length} Relationships<br>
        <span style="font-size: 10px; color: var(--vscode-descriptionForeground);">Click nodes for details</span>
      </div>
      <script>
        const width = window.innerWidth;
        const height = window.innerHeight;
        const nodes = ${JSON.stringify(nodes)};
        const edges = ${JSON.stringify(edges)};
        let showLabels = true;

        // Simple force-directed graph simulation
        const svg = document.getElementById('graph');
        svg.setAttribute('width', width);
        svg.setAttribute('height', height);

        // Initialize positions
        nodes.forEach((node, i) => {
          const angle = (i / nodes.length) * 2 * Math.PI;
          const radius = Math.min(width, height) * 0.3;
          node.x = width / 2 + radius * Math.cos(angle);
          node.y = height / 2 + radius * Math.sin(angle);
        });

        // Draw edges
        edges.forEach(edge => {
          const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          line.setAttribute('class', 'link');
          line.setAttribute('data-from', edge.from);
          line.setAttribute('data-to', edge.to);
          line.setAttribute('x1', nodes[edge.from].x);
          line.setAttribute('y1', nodes[edge.from].y);
          line.setAttribute('x2', nodes[edge.to].x);
          line.setAttribute('y2', nodes[edge.to].y);
          svg.appendChild(line);
        });

        // Draw nodes
        nodes.forEach(node => {
          const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          circle.setAttribute('class', 'node ' + node.group);
          circle.setAttribute('cx', node.x);
          circle.setAttribute('cy', node.y);
          circle.setAttribute('r', 8);
          circle.setAttribute('data-id', node.id);
          circle.addEventListener('click', () => alert('Concept: ' + node.label));
          svg.appendChild(circle);

          const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          text.setAttribute('class', 'label');
          text.setAttribute('x', node.x + 10);
          text.setAttribute('y', node.y + 4);
          text.textContent = node.label;
          svg.appendChild(text);
        });

        function resetZoom() {
          svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
        }

        function toggleLabels() {
          showLabels = !showLabels;
          document.querySelectorAll('.label').forEach(label => {
            label.style.display = showLabels ? 'block' : 'none';
          });
        }

        let currentZoom = 1;
        function zoomIn() {
          currentZoom *= 1.2;
          svg.style.transform = 'scale(' + currentZoom + ')';
        }

        function zoomOut() {
          currentZoom /= 1.2;
          svg.style.transform = 'scale(' + currentZoom + ')';
        }

        // Add hover effects for relationships
        document.querySelectorAll('.node').forEach(node => {
          node.addEventListener('mouseenter', function() {
            const id = this.getAttribute('data-id');
            // Highlight connected edges
            document.querySelectorAll('.link').forEach(link => {
              const from = link.getAttribute('data-from');
              const to = link.getAttribute('data-to');
              if (from === id || to === id) {
                link.classList.add('highlighted');
              }
            });
          });
          node.addEventListener('mouseleave', function() {
            document.querySelectorAll('.link').forEach(link => {
              link.classList.remove('highlighted');
            });
          });
        });
      </script>
    </body>
    </html>`;
  }

  public dispose() {
    RelationshipGraphPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}
