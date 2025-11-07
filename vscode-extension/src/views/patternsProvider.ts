import * as vscode from 'vscode';
import { InMemoriaClient, PatternRecommendation } from '../mcpClient';

export class PatternsProvider implements vscode.TreeDataProvider<PatternItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<PatternItem | undefined | null | void> =
    new vscode.EventEmitter<PatternItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<PatternItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  private patterns?: PatternRecommendation[];

  constructor(private mcpClient: InMemoriaClient) {}

  refresh(): void {
    this.patterns = undefined;
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: PatternItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: PatternItem): Promise<PatternItem[]> {
    if (!this.mcpClient.isConnected()) {
      return [];
    }

    try {
      if (!element) {
        // Root level - get pattern recommendations
        if (!this.patterns) {
          try {
            const result = await this.mcpClient.getPatternRecommendations('general patterns');
            this.patterns = result.recommendations;
          } catch (error) {
            // If no patterns learned yet, return empty
            return [];
          }
        }

        if (!this.patterns || this.patterns.length === 0) {
          return [
            new PatternItem(
              'No patterns learned yet',
              vscode.TreeItemCollapsibleState.None,
              'empty',
              { icon: 'info', description: 'Run "Learn Codebase" first' }
            )
          ];
        }

        // Group patterns by confidence
        const highConfidence = this.patterns.filter(p => p.confidence >= 0.7);
        const mediumConfidence = this.patterns.filter(p => p.confidence >= 0.4 && p.confidence < 0.7);
        const lowConfidence = this.patterns.filter(p => p.confidence < 0.4);

        const items: PatternItem[] = [];

        if (highConfidence.length > 0) {
          items.push(
            new PatternItem(
              `High Confidence (${highConfidence.length})`,
              vscode.TreeItemCollapsibleState.Expanded,
              'group',
              { icon: 'star-full', patterns: highConfidence }
            )
          );
        }

        if (mediumConfidence.length > 0) {
          items.push(
            new PatternItem(
              `Medium Confidence (${mediumConfidence.length})`,
              vscode.TreeItemCollapsibleState.Collapsed,
              'group',
              { icon: 'star-half', patterns: mediumConfidence }
            )
          );
        }

        if (lowConfidence.length > 0) {
          items.push(
            new PatternItem(
              `Low Confidence (${lowConfidence.length})`,
              vscode.TreeItemCollapsibleState.Collapsed,
              'group',
              { icon: 'star-empty', patterns: lowConfidence }
            )
          );
        }

        return items;
      } else {
        // Child level - show patterns in group
        if (element.contextValue === 'group' && element.patterns) {
          return element.patterns.map(
            pattern =>
              new PatternItem(
                pattern.pattern,
                vscode.TreeItemCollapsibleState.Collapsed,
                'pattern',
                {
                  icon: 'symbol-method',
                  description: `${(pattern.confidence * 100).toFixed(0)}%`,
                  pattern
                }
              )
          );
        }

        // Show pattern details
        if (element.contextValue === 'pattern' && element.pattern) {
          const items: PatternItem[] = [
            new PatternItem(
              element.pattern.description,
              vscode.TreeItemCollapsibleState.None,
              'description',
              { icon: 'note' }
            ),
            new PatternItem(
              element.pattern.reasoning,
              vscode.TreeItemCollapsibleState.None,
              'reasoning',
              { icon: 'lightbulb' }
            )
          ];

          if (element.pattern.examples && element.pattern.examples.length > 0) {
            items.push(
              new PatternItem(
                `Examples (${element.pattern.examples.length})`,
                vscode.TreeItemCollapsibleState.Collapsed,
                'examples',
                { icon: 'list-unordered', examples: element.pattern.examples }
              )
            );
          }

          return items;
        }

        // Show examples
        if (element.contextValue === 'examples' && element.examples) {
          return element.examples.map(
            (example, index) =>
              new PatternItem(
                `Example ${index + 1}`,
                vscode.TreeItemCollapsibleState.None,
                'example',
                { icon: 'code', description: example.substring(0, 50) + '...' }
              )
          );
        }

        return [];
      }
    } catch (error: any) {
      vscode.window.showErrorMessage(`Failed to load patterns: ${error.message}`);
      return [];
    }
  }
}

class PatternItem extends vscode.TreeItem {
  public patterns?: PatternRecommendation[];
  public pattern?: PatternRecommendation;
  public examples?: string[];

  constructor(
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly contextValue: string,
    options?: {
      icon?: string;
      description?: string;
      patterns?: PatternRecommendation[];
      pattern?: PatternRecommendation;
      examples?: string[];
    }
  ) {
    super(label, collapsibleState);

    if (options?.icon) {
      this.iconPath = new vscode.ThemeIcon(options.icon);
    }

    if (options?.description) {
      this.description = options.description;
    }

    if (options?.patterns) {
      this.patterns = options.patterns;
    }

    if (options?.pattern) {
      this.pattern = options.pattern;
    }

    if (options?.examples) {
      this.examples = options.examples;
    }

    this.tooltip = this.getTooltip();
  }

  private getTooltip(): string {
    if (this.pattern) {
      return `${this.pattern.pattern}\n\nConfidence: ${(this.pattern.confidence * 100).toFixed(0)}%\n\n${this.pattern.description}`;
    }
    return this.label || '';
  }
}
