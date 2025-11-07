import * as vscode from 'vscode';
import { InMemoriaClient } from '../mcpClient';

export class InsightsProvider implements vscode.TreeDataProvider<InsightItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<InsightItem | undefined | null | void> =
    new vscode.EventEmitter<InsightItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<InsightItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  constructor(private mcpClient: InMemoriaClient) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: InsightItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: InsightItem): Promise<InsightItem[]> {
    if (!this.mcpClient.isConnected()) {
      return [];
    }

    try {
      if (!element) {
        // For now, show placeholder insights
        // In a real implementation, we'd fetch AI insights from the database
        return [
          new InsightItem(
            'AI insights will appear here',
            vscode.TreeItemCollapsibleState.None,
            'placeholder',
            {
              icon: 'lightbulb',
              description: 'Use contribute_insights tool to add insights'
            }
          )
        ];
      }

      return [];
    } catch (error: any) {
      vscode.window.showErrorMessage(`Failed to load insights: ${error.message}`);
      return [];
    }
  }
}

class InsightItem extends vscode.TreeItem {
  constructor(
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly contextValue: string,
    options?: {
      icon?: string;
      description?: string;
    }
  ) {
    super(label, collapsibleState);

    if (options?.icon) {
      this.iconPath = new vscode.ThemeIcon(options.icon);
    }

    if (options?.description) {
      this.description = options.description;
    }

    this.tooltip = this.label || '';
  }
}
