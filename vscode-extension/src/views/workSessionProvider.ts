import * as vscode from 'vscode';
import { InMemoriaClient, DeveloperProfile } from '../mcpClient';

export class WorkSessionProvider implements vscode.TreeDataProvider<WorkItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<WorkItem | undefined | null | void> =
    new vscode.EventEmitter<WorkItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<WorkItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  private profile?: DeveloperProfile;

  constructor(private mcpClient: InMemoriaClient) {}

  refresh(): void {
    this.profile = undefined;
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: WorkItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: WorkItem): Promise<WorkItem[]> {
    if (!this.mcpClient.isConnected()) {
      return [];
    }

    try {
      if (!element) {
        // Root level
        if (!this.profile) {
          this.profile = await this.mcpClient.getDeveloperProfile(true);
        }

        const items: WorkItem[] = [];

        if (this.profile.currentWork) {
          const work = this.profile.currentWork;

          if (work.lastFeature) {
            items.push(
              new WorkItem(
                `Current Feature: ${work.lastFeature}`,
                vscode.TreeItemCollapsibleState.None,
                'currentFeature',
                { icon: 'symbol-event' }
              )
            );
          }

          if (work.currentFiles.length > 0) {
            items.push(
              new WorkItem(
                `Current Files (${work.currentFiles.length})`,
                vscode.TreeItemCollapsibleState.Expanded,
                'currentFiles',
                { icon: 'files', files: work.currentFiles }
              )
            );
          }

          if (work.pendingTasks.length > 0) {
            items.push(
              new WorkItem(
                `Pending Tasks (${work.pendingTasks.length})`,
                vscode.TreeItemCollapsibleState.Expanded,
                'pendingTasks',
                { icon: 'checklist', tasks: work.pendingTasks }
              )
            );
          }

          if (work.recentDecisions.length > 0) {
            items.push(
              new WorkItem(
                `Recent Decisions (${work.recentDecisions.length})`,
                vscode.TreeItemCollapsibleState.Collapsed,
                'recentDecisions',
                { icon: 'milestone', decisions: work.recentDecisions }
              )
            );
          }
        }

        if (this.profile.recentFocus.length > 0) {
          items.push(
            new WorkItem(
              `Recent Focus Areas (${this.profile.recentFocus.length})`,
              vscode.TreeItemCollapsibleState.Collapsed,
              'recentFocus',
              { icon: 'target', focus: this.profile.recentFocus }
            )
          );
        }

        if (items.length === 0) {
          return [
            new WorkItem(
              'No active work session',
              vscode.TreeItemCollapsibleState.None,
              'empty',
              { icon: 'info', description: 'Start coding to track your session' }
            )
          ];
        }

        return items;
      } else {
        // Child level
        switch (element.contextValue) {
          case 'currentFiles':
            if (element.files) {
              return element.files.map(
                file =>
                  new WorkItem(
                    file.split('/').pop() || file,
                    vscode.TreeItemCollapsibleState.None,
                    'file',
                    { icon: 'file-code', description: file, filePath: file }
                  )
              );
            }
            return [];

          case 'pendingTasks':
            if (element.tasks) {
              return element.tasks.map(
                task =>
                  new WorkItem(
                    task,
                    vscode.TreeItemCollapsibleState.None,
                    'task',
                    { icon: 'circle-outline' }
                  )
              );
            }
            return [];

          case 'recentDecisions':
            if (element.decisions) {
              return element.decisions.map(
                decision =>
                  new WorkItem(
                    `${decision.key}: ${decision.value}`,
                    vscode.TreeItemCollapsibleState.None,
                    'decision',
                    { icon: 'shield', description: decision.reasoning }
                  )
              );
            }
            return [];

          case 'recentFocus':
            if (element.focus) {
              return element.focus.map(
                area =>
                  new WorkItem(
                    area,
                    vscode.TreeItemCollapsibleState.None,
                    'focusArea',
                    { icon: 'flame' }
                  )
              );
            }
            return [];

          default:
            return [];
        }
      }
    } catch (error: any) {
      vscode.window.showErrorMessage(`Failed to load work session: ${error.message}`);
      return [];
    }
  }
}

class WorkItem extends vscode.TreeItem {
  public files?: string[];
  public tasks?: string[];
  public decisions?: Array<{ key: string; value: string; reasoning?: string }>;
  public focus?: string[];
  public filePath?: string;

  constructor(
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly contextValue: string,
    options?: {
      icon?: string;
      description?: string;
      files?: string[];
      tasks?: string[];
      decisions?: Array<{ key: string; value: string; reasoning?: string }>;
      focus?: string[];
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

    if (options?.tasks) {
      this.tasks = options.tasks;
    }

    if (options?.decisions) {
      this.decisions = options.decisions;
    }

    if (options?.focus) {
      this.focus = options.focus;
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
      case 'currentFeature':
        return 'The feature currently being worked on';
      case 'currentFiles':
        return 'Files actively being modified in this session';
      case 'pendingTasks':
        return 'Tasks that are pending completion';
      case 'recentDecisions':
        return 'Architectural decisions made in recent sessions';
      case 'recentFocus':
        return 'Areas of focus in recent development';
      default:
        return this.label || '';
    }
  }
}
