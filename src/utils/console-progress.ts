import { ProgressTracker, ProgressUpdate } from './progress-tracker.js';

export class ConsoleProgressRenderer {
  private tracker: ProgressTracker;
  private isActive: boolean = false;
  private renderTimer: NodeJS.Timeout | null = null;
  private lastOutput: string = '';
  private hasRendered: boolean = false;
  private isCompleted: boolean = false;
  private hasShownCompletionMessage: boolean = false;

  constructor(tracker: ProgressTracker) {
    this.tracker = tracker;
    this.setupListeners();
  }

  private setupListeners(): void {
    // No need for phaseStart listener since we show all phases from the beginning
    
    // Listen for completion to handle final state properly
    this.tracker.on('complete', () => {
      this.isCompleted = true;
      if (this.isActive) {
        this.render(); // One final render with complete state
      }
    });
  }

  start(): void {
    this.isActive = true;
    this.hasRendered = false;
    this.isCompleted = false;
    this.hasShownCompletionMessage = false;
    
    // Always render immediately to show initial state
    this.render();

    // Update reasonably frequently for smooth progress - every 500ms
    this.renderTimer = setInterval(() => {
      if (this.isActive) {
        this.render();
      }
    }, 500);
  }

  stop(): void {
    // Ensure one final render with completion state
    this.renderFinal();
    
    // Clean up
    if (this.renderTimer) {
      clearInterval(this.renderTimer);
      this.renderTimer = null;
    }
    this.isActive = false;
  }

  private render(): void {
    if (!this.isActive) return;

    // Get all lines 
    const allLines = this.tracker.getConsoleStatus();
    if (allLines.length === 0) return;

    // Filter out phases that haven't started (all zeros) unless we're completed
    const lines = this.isCompleted 
      ? allLines 
      : allLines.filter((line, idx) => {
          // Always keep the overall progress line (first line)
          if (idx === 0) return true;
          // Keep lines that have progress or are complete
          return !line.includes('0% (0/') || line.includes('✓');
        });

    if (lines.length <= 1) return; // Only overall line, don't render yet

    // Build the output with separator
    const output = '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
                  lines.join('\n') + 
                  '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';

    // Only update if something changed
    if (output !== this.lastOutput) {
      if (this.hasRendered) {
        // Move cursor up to the beginning of our progress display and overwrite
        const lineCount = this.lastOutput.split('\n').length;
        process.stderr.write(`\x1b[${lineCount}A`); // Move up
        process.stderr.write('\x1b[0J'); // Clear from cursor to end of screen
      }
      
      process.stderr.write(output + '\n');
      this.lastOutput = output;
      this.hasRendered = true;
    }
  }

  private renderFinal(): void {
    if (!this.hasRendered) return;
    this.isCompleted = true;
    this.render();
    
    // Show completion message only once
    if (!this.hasShownCompletionMessage) {
      process.stderr.write('✅ Learning Complete!\n\n');
      this.hasShownCompletionMessage = true;
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