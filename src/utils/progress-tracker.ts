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
    });
    this.totalWeight += weight;
  }

  startPhase(phaseName: string): void {
    if (!this.phases.has(phaseName)) {
      throw new Error(`Phase ${phaseName} not found. Add it first with addPhase()`);
    }
    this.currentPhase = phaseName;
    this.emitProgress(phaseName, 0);
  }

  updateProgress(phaseName: string, current: number, message?: string): void {
    const phase = this.phases.get(phaseName);
    if (!phase) {
      throw new Error(`Phase ${phaseName} not found`);
    }

    phase.current = Math.min(current, phase.total);
    this.emitProgress(phaseName, current, message);
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
      }
    } else {
      // Complete all phases
      for (const [name, phase] of this.phases) {
        phase.current = phase.total;
        this.emitProgress(name, phase.total, 'Completed');
      }
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
    const percent = (percentage * 100).toFixed(1);
    
    return `${phaseName}: [${bar}] ${percent}% (${phase.current}/${phase.total})`;
  }

  // Get console-friendly status
  getConsoleStatus(): string[] {
    const lines: string[] = [];
    const overall = this.getProgress();
    
    if (overall) {
      lines.push(`Overall Progress: ${overall.percentage.toFixed(1)}% (${this.formatElapsed(overall.elapsed)})`);
    }
    
    for (const [name, _] of this.phases) {
      lines.push(this.renderProgressBar(name));
    }
    
    return lines;
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