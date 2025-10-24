import { ProgressTracker, ProgressUpdate } from './progress-tracker.js';

export class ConsoleProgressRenderer {
  private tracker: ProgressTracker;
  private isActive: boolean = false;
  private lastRenderTime: number = 0;
  private renderInterval: number = 250; // Update every 250ms for more responsive feedback
  private currentLines: number = 0;

  constructor(tracker: ProgressTracker) {
    this.tracker = tracker;
    this.setupListeners();
  }

  private setupListeners(): void {
    this.tracker.on('progress', (update: ProgressUpdate) => {
      if (this.isActive) {
        // Immediate render for phase starts (0%) and completions (100%)
        if (update.percentage === 0 || update.percentage === 100) {
          this.render();
          this.lastRenderTime = Date.now();
        } else {
          this.throttledRender();
        }
      }
    });

    this.tracker.on('overall', (update: ProgressUpdate) => {
      if (this.isActive && update.percentage >= 100) {
        this.renderFinal();
        this.stop();
      }
    });
  }

  start(): void {
    this.isActive = true;
    this.currentLines = 0;
    this.render();
  }

  stop(): void {
    this.isActive = false;
  }

  private throttledRender(): void {
    const now = Date.now();
    if (now - this.lastRenderTime >= this.renderInterval) {
      this.render();
      this.lastRenderTime = now;
    }
  }

  private render(): void {
    if (!this.isActive) return;

    const isMCPMode = process.env.MCP_SERVER === 'true';
    
    if (isMCPMode) {
      // In MCP mode, send simple ASCII progress to stderr (not logged as output)
      const lines = this.tracker.getConsoleStatus();
      for (const line of lines) {
        console.error(line);
      }
    } else {
      // Normal mode with ANSI codes for terminal
      // Clear previous lines
      if (this.currentLines > 0) {
        process.stderr.write(`\x1b[${this.currentLines}A`); // Move cursor up
        process.stderr.write('\x1b[J'); // Clear from cursor down
      }

      const lines = this.tracker.getConsoleStatus();
      this.currentLines = lines.length;

      for (const line of lines) {
        console.error(line);
      }
    }
  }

  private renderFinal(): void {
    const isMCPMode = process.env.MCP_SERVER === 'true';
    
    if (isMCPMode) {
      // In MCP mode, send final message to stderr
      const overall = this.tracker.getProgress();
      if (overall) {
        console.error(`✅ All operations completed in ${this.formatElapsed(overall.elapsed)}`);
      }
    } else {
      // Normal mode with ANSI codes
      // Clear previous lines
      if (this.currentLines > 0) {
        process.stderr.write(`\x1b[${this.currentLines}A`);
        process.stderr.write('\x1b[J');
      }

      const overall = this.tracker.getProgress();
      if (overall) {
        console.error(`✅ All operations completed in ${this.formatElapsed(overall.elapsed)}`);
      }
    }
  }

  private formatElapsed(elapsed: number): string {
    const seconds = Math.floor(elapsed / 1000);
    const minutes = Math.floor(seconds / 60);
    
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  // Static helper for simple progress bars
  static renderSimpleBar(current: number, total: number, width: number = 40, message?: string): string {
    const percentage = total > 0 ? (current / total) : 0;
    const filled = Math.floor(percentage * width);
    const empty = width - filled;
    
    // Use ASCII characters in MCP mode, Unicode in terminal mode
    const isMCPMode = process.env.MCP_SERVER === 'true';
    const bar = isMCPMode 
      ? '='.repeat(filled) + '-'.repeat(empty)  // ASCII: [====----] 
      : '█'.repeat(filled) + '░'.repeat(empty); // Unicode: [████░░░░]
    
    const percent = (percentage * 100).toFixed(1);
    const baseText = `[${bar}] ${percent}% (${current}/${total})`;
    
    return message ? `${message}: ${baseText}` : baseText;
  }

  // For MCP server - return progress as structured data
  getProgressData(): {
    overall: number;
    phases: Array<{
      name: string;
      current: number;
      total: number;
      percentage: number;
      eta?: string;
    }>;
    elapsed: number;
    isComplete: boolean;
  } {
    const overall = this.tracker.getProgress();
    const phases = [];

    for (const [name, _] of (this.tracker as any).phases) {
      const phaseProgress = this.tracker.getProgress(name);
      if (phaseProgress) {
        phases.push({
          name,
          current: phaseProgress.current,
          total: phaseProgress.total,
          percentage: phaseProgress.percentage,
          eta: phaseProgress.eta
        });
      }
    }

    return {
      overall: overall?.percentage || 0,
      phases,
      elapsed: overall?.elapsed || 0,
      isComplete: overall?.percentage === 100
    };
  }
}