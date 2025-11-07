import * as vscode from 'vscode';
import { InMemoriaClient, ProjectBlueprint } from '../mcpClient';

export class ProjectIntelligenceProvider implements vscode.TreeDataProvider<IntelligenceItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<IntelligenceItem | undefined | null | void> =
    new vscode.EventEmitter<IntelligenceItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<IntelligenceItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  private blueprint?: ProjectBlueprint;

  constructor(private mcpClient: InMemoriaClient) {}

  refresh(): void {
    this.blueprint = undefined;
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: IntelligenceItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: IntelligenceItem): Promise<IntelligenceItem[]> {
    if (!this.mcpClient.isConnected()) {
      return [];
    }

    try {
      if (!element) {
        // Root level
        if (!this.blueprint) {
          this.blueprint = await this.mcpClient.getProjectBlueprint();
        }

        const items: IntelligenceItem[] = [
          new IntelligenceItem(
            'Tech Stack',
            vscode.TreeItemCollapsibleState.Collapsed,
            'techStack',
            { icon: 'package' }
          ),
          new IntelligenceItem(
            'Entry Points',
            vscode.TreeItemCollapsibleState.Collapsed,
            'entryPoints',
            { icon: 'symbol-event' }
          ),
          new IntelligenceItem(
            'Key Directories',
            vscode.TreeItemCollapsibleState.Collapsed,
            'keyDirectories',
            { icon: 'folder' }
          ),
          new IntelligenceItem(
            `Architecture: ${this.blueprint.architecture}`,
            vscode.TreeItemCollapsibleState.None,
            'architecture',
            { icon: 'organization' }
          )
        ];

        if (this.blueprint.featureMap && Object.keys(this.blueprint.featureMap).length > 0) {
          items.push(
            new IntelligenceItem(
              'Feature Map',
              vscode.TreeItemCollapsibleState.Collapsed,
              'featureMap',
              { icon: 'map' }
            )
          );
        }

        if (this.blueprint.learningStatus) {
          const status = this.blueprint.learningStatus;
          const statusLabel = status.hasIntelligence
            ? `✓ Intelligence: ${status.conceptsStored} concepts, ${status.patternsStored} patterns`
            : '⚠ No Intelligence Data';

          items.push(
            new IntelligenceItem(
              statusLabel,
              vscode.TreeItemCollapsibleState.None,
              'learningStatus',
              {
                icon: status.hasIntelligence ? 'check' : 'warning',
                description: status.message
              }
            )
          );
        }

        return items;
      } else {
        // Child level
        if (!this.blueprint) {
          return [];
        }

        switch (element.contextValue) {
          case 'techStack':
            return this.blueprint.techStack.map(
              tech => new IntelligenceItem(tech, vscode.TreeItemCollapsibleState.None, 'tech', { icon: 'symbol-class' })
            );

          case 'entryPoints':
            return Object.entries(this.blueprint.entryPoints).map(
              ([type, path]) =>
                new IntelligenceItem(
                  `${type}: ${path.split('/').pop()}`,
                  vscode.TreeItemCollapsibleState.None,
                  'entryPoint',
                  {
                    icon: 'file-code',
                    description: path,
                    filePath: path
                  }
                )
            );

          case 'keyDirectories':
            return Object.entries(this.blueprint.keyDirectories).map(
              ([type, path]) =>
                new IntelligenceItem(
                  `${type}: ${path}`,
                  vscode.TreeItemCollapsibleState.None,
                  'directory',
                  { icon: 'folder-opened', description: type }
                )
            );

          case 'featureMap':
            if (this.blueprint.featureMap) {
              return Object.entries(this.blueprint.featureMap).map(
                ([feature, files]) =>
                  new IntelligenceItem(
                    feature,
                    vscode.TreeItemCollapsibleState.Collapsed,
                    'feature',
                    {
                      icon: 'symbol-method',
                      description: `${files.length} files`,
                      files
                    }
                  )
              );
            }
            return [];

          case 'feature':
            if (element.files) {
              return element.files.map(
                file =>
                  new IntelligenceItem(
                    file.split('/').pop() || file,
                    vscode.TreeItemCollapsibleState.None,
                    'featureFile',
                    {
                      icon: 'file',
                      description: file,
                      filePath: file
                    }
                  )
              );
            }
            return [];

          default:
            return [];
        }
      }
    } catch (error: any) {
      vscode.window.showErrorMessage(`Failed to load project intelligence: ${error.message}`);
      return [];
    }
  }
}

class IntelligenceItem extends vscode.TreeItem {
  public files?: string[];
  public filePath?: string;

  constructor(
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly contextValue: string,
    options?: {
      icon?: string;
      description?: string;
      files?: string[];
      filePath?: string;
    }
  ) {
    super(label, collapsibleState);

    if (options?.icon) {
      this.iconPath = new vscode.ThemeIcon(options.icon);
    }

    if (options?.description) {
      this.description = options.description;
    }

    if (options?.files) {
      this.files = options.files;
    }

    if (options?.filePath) {
      this.filePath = options.filePath;
      this.command = {
        command: 'vscode.open',
        title: 'Open File',
        arguments: [vscode.Uri.file(options.filePath)]
      };
    }

    this.tooltip = this.getTooltip();
  }

  private getTooltip(): string {
    switch (this.contextValue) {
      case 'techStack':
        return 'Technologies and frameworks detected in the codebase';
      case 'entryPoints':
        return 'Main entry points for the application';
      case 'keyDirectories':
        return 'Important directories in the project structure';
      case 'featureMap':
        return 'Mapping of features to their implementation files';
      case 'feature':
        return `Feature with ${this.files?.length || 0} implementation files`;
      default:
        return this.label || '';
    }
  }
}
