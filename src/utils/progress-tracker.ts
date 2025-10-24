import { EventEmitter } from 'events';

export interface ProgressUpdate {
  phase: string;
  current: number;
  total: number;
  percentage: number;
  eta?: string;
  message?: string;
  startTime: number;
  elapsed: number;
  rate?: number; // items per second
}

export interface ProgressPhase {
  name: string;
  weight: number; // relative weight for overall progress
  current: number;
  total: number;
  started: boolean; // track if phase has been started
}

export class ProgressTracker extends EventEmitter {
  private phases: Map<string, ProgressPhase> = new Map();
  private startTime: number;
  private currentPhase?: string;
  private totalWeight: number = 0;

  constructor() {
    super();
    this.startTime = Date.now();
  }

  addPhase(name: string, total: number, weight: number = 1): void {
    this.phases.set(name, {
      name,
      weight,
      current: 0,
      total,
      started: false,
    });
    this.totalWeight += weight;
  }

  startPhase(phaseName: string): void {
    if (!this.phases.has(phaseName)) {
      throw new Error(`Phase ${phaseName} not found. Add it first with addPhase()`);
    }
    const phase = this.phases.get(phaseName)!;
    phase.started = true;
    this.currentPhase = phaseName;
    this.emit('phaseStart', phaseName);
    this.emitProgress(phaseName, 0);
  }

  updateProgress(phaseName: string, current: number, message?: string): void {
    const phase = this.phases.get(phaseName);
    if (!phase) {
      throw new Error(`Phase ${phaseName} not found`);
    }

    const oldCurrent = phase.current;
    phase.current = Math.min(current, phase.total);

    // Only emit if there's an actual change
    if (oldCurrent !== phase.current) {
      this.emitProgress(phaseName, current, message);
    }
  }

  incrementProgress(phaseName: string, increment: number = 1, message?: string): void {
    const phase = this.phases.get(phaseName);
    if (!phase) {
      throw new Error(`Phase ${phaseName} not found`);
    }

    phase.current = Math.min(phase.current + increment, phase.total);
    this.emitProgress(phaseName, phase.current, message);
  }

  private emitProgress(phaseName: string, current: number, message?: string): void {
    const phase = this.phases.get(phaseName)!;
    const elapsed = Date.now() - this.startTime;

    const phasePercentage = phase.total > 0 ? (current / phase.total) * 100 : 0;
    const overallPercentage = this.calculateOverallProgress();

    // Calculate ETA
    let eta: string | undefined;
    let rate: number | undefined;

    if (current > 0 && elapsed > 1000) { // Only calculate after 1 second
      rate = (current / elapsed) * 1000; // items per second
      if (rate > 0) {
        const remaining = phase.total - current;
        const etaMs = (remaining / rate) * 1000;
        eta = this.formatETA(etaMs);
      }
    }

    const update: ProgressUpdate = {
      phase: phaseName,
      current,
      total: phase.total,
      percentage: phasePercentage,
      eta,
      message,
      startTime: this.startTime,
      elapsed,
      rate
    };

    this.emit('progress', update);
    this.emit(`progress:${phaseName}`, update);

    // Emit overall progress
    this.emit('overall', {
      ...update,
      percentage: overallPercentage,
      phase: 'overall'
    });
  }

  private calculateOverallProgress(): number {
    let weightedProgress = 0;

    for (const [_, phase] of this.phases) {
      const phaseProgress = phase.total > 0 ? (phase.current / phase.total) : 0;
      weightedProgress += (phaseProgress * phase.weight);
    }

    return this.totalWeight > 0 ? (weightedProgress / this.totalWeight) * 100 : 0;
  }

  private formatETA(etaMs: number): string {
    if (etaMs < 1000) return 'less than 1s';

    const seconds = Math.floor(etaMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  getProgress(phaseName?: string): ProgressUpdate | null {
    if (phaseName) {
      const phase = this.phases.get(phaseName);
      if (!phase) return null;

      return {
        phase: phaseName,
        current: phase.current,
        total: phase.total,
        percentage: phase.total > 0 ? (phase.current / phase.total) * 100 : 0,
        startTime: this.startTime,
        elapsed: Date.now() - this.startTime
      };
    }

    // Return overall progress
    return {
      phase: 'overall',
      current: 0,
      total: 100,
      percentage: this.calculateOverallProgress(),
      startTime: this.startTime,
      elapsed: Date.now() - this.startTime
    };
  }

  complete(phaseName?: string): void {
    if (phaseName) {
      const phase = this.phases.get(phaseName);
      if (phase) {
        phase.current = phase.total;
        this.emitProgress(phaseName, phase.total, 'Completed');
        // Check if this was the last phase
        const allComplete = Array.from(this.phases.values()).every(p => p.current === p.total);
        if (allComplete) {
          this.emit('complete');
        }
      }
    } else {
      // Complete all phases
      for (const [name, phase] of this.phases) {
        phase.current = phase.total;
        this.emitProgress(name, phase.total, 'Completed');
      }
      this.emit('complete');
    }
  }

  reset(): void {
    for (const [_, phase] of this.phases) {
      phase.current = 0;
    }
    this.startTime = Date.now();
    this.currentPhase = undefined;
  }

  // Console progress bar visualization
  renderProgressBar(phaseName: string, width: number = 40): string {
    const phase = this.phases.get(phaseName);
    if (!phase) return '';

    const percentage = phase.total > 0 ? (phase.current / phase.total) : 0;
    const filled = Math.floor(percentage * width);
    const empty = width - filled;

    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    const percent = (percentage * 100).toFixed(0).padStart(3); // Right-align percentage

    // Format phase name nicely (convert snake_case to Title Case)
    const formattedName = phaseName
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
      .padEnd(20); // Fixed width for alignment

    // Add emoji for visual appeal
    const emoji = this.getPhaseEmoji(phaseName);

    // Preserve visual consistency even for phases that haven't started yet
    if (!phase.started) {
      return `${emoji} ${formattedName} [${bar}] ${percent}% (${phase.current}/${phase.total})`;
    }

    // Completed phases in green with a completion mark
    if (phase.current >= phase.total) {
      return `\x1b[32m${emoji} ${formattedName} [${bar}] ${percent}% (${phase.total}/${phase.total})\x1b[0m ✓`;
    }

    // In-progress phases show live counts
    return `${emoji} ${formattedName} [${bar}] ${percent}% (${phase.current}/${phase.total})`;
  }

  private getPhaseEmoji(phaseName: string): string {
    if (phaseName.includes('semantic')) return '🧠';
    if (phaseName.includes('pattern')) return '🔍';
    if (phaseName.includes('discovery')) return '🔎';
    if (phaseName.includes('indexing')) return '📇';
    if (phaseName.includes('analysis')) return '📊';
    return '⚙️';
  }

  // Get console-friendly status
  getConsoleStatus(): string[] {
    const lines: string[] = [];
    const overall = this.getProgress();

    if (overall) {
      const percentage = overall.percentage.toFixed(1);
      const elapsed = this.formatElapsed(overall.elapsed);
      const eta = this.estimateOverallETA();

      lines.push(`⏱️  Overall: ${percentage}% | Time: ${elapsed}${eta ? ` | ETA: ${eta}` : ''}`);
    }

    // Show ALL phases from the start to maintain fixed layout
    for (const [name, phase] of this.phases) {
      lines.push(this.renderProgressBar(name));
    }

    return lines;
  }

  private estimateOverallETA(): string | null {
    const overall = this.getProgress();
    if (!overall || overall.percentage === 0 || overall.percentage >= 100) return null;

    const elapsed = overall.elapsed;
    const remaining = (elapsed / overall.percentage) * (100 - overall.percentage);

    if (remaining < 1000) return null;

    const seconds = Math.floor(remaining / 1000);
    const minutes = Math.floor(seconds / 60);

    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
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
}