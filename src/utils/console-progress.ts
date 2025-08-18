import { ProgressTracker, ProgressUpdate } from './progress-tracker.js';

export class ConsoleProgressRenderer {
  private tracker: ProgressTracker;
  private isActive: boolean = false;
  private lastRenderTime: number = 0;
  private renderInterval: number = 500; // Update every 500ms
  private currentLines: number = 0;

  constructor(tracker: ProgressTracker) {
    this.tracker = tracker;
    this.setupListeners();
  }

  private setupListeners(): void {
    this.tracker.on('progress', (update: ProgressUpdate) => {
      if (this.isActive) {
        this.throttledRender();
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

    // Clear previous lines
    if (this.currentLines > 0) {
      process.stdout.write(`\x1b[${this.currentLines}A`); // Move cursor up
      process.stdout.write('\x1b[J'); // Clear from cursor down
    }

    const lines = this.tracker.getConsoleStatus();
    this.currentLines = lines.length;

    for (const line of lines) {
      console.log(line);
    }
  }

  private renderFinal(): void {
    // Clear previous lines
    if (this.currentLines > 0) {
      process.stdout.write(`\x1b[${this.currentLines}A`);
      process.stdout.write('\x1b[J');
    }

    const overall = this.tracker.getProgress();
    if (overall) {
      console.log(`✅ All operations completed in ${this.formatElapsed(overall.elapsed)}`);
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
    
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
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