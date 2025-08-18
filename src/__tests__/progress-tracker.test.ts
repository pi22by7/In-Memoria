import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProgressTracker, ProgressUpdate } from '../utils/progress-tracker.js';
import { ConsoleProgressRenderer } from '../utils/console-progress.js';

describe('ProgressTracker', () => {
  let tracker: ProgressTracker;
  let mockConsoleLog: any;

  beforeEach(() => {
    tracker = new ProgressTracker();
    mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    mockConsoleLog.mockRestore();
  });

  describe('basic functionality', () => {
    it('should initialize with no phases', () => {
      const progress = tracker.getProgress();
      expect(progress?.percentage).toBe(0);
    });

    it('should add phases correctly', () => {
      tracker.addPhase('test-phase', 10, 2);
      
      const progress = tracker.getProgress('test-phase');
      expect(progress?.total).toBe(10);
      expect(progress?.current).toBe(0);
      expect(progress?.percentage).toBe(0);
    });

    it('should update progress correctly', () => {
      tracker.addPhase('test-phase', 100);
      tracker.updateProgress('test-phase', 25);
      
      const progress = tracker.getProgress('test-phase');
      expect(progress?.current).toBe(25);
      expect(progress?.percentage).toBe(25);
    });

    it('should increment progress correctly', () => {
      tracker.addPhase('test-phase', 10);
      tracker.incrementProgress('test-phase', 3);
      tracker.incrementProgress('test-phase', 2);
      
      const progress = tracker.getProgress('test-phase');
      expect(progress?.current).toBe(5);
      expect(progress?.percentage).toBe(50);
    });

    it('should cap progress at maximum', () => {
      tracker.addPhase('test-phase', 10);
      tracker.updateProgress('test-phase', 15); // Over limit
      
      const progress = tracker.getProgress('test-phase');
      expect(progress?.current).toBe(10);
      expect(progress?.percentage).toBe(100);
    });
  });

  describe('multi-phase progress', () => {
    it('should calculate overall progress correctly', () => {
      tracker.addPhase('phase1', 10, 1); // Weight 1
      tracker.addPhase('phase2', 10, 3); // Weight 3
      
      tracker.updateProgress('phase1', 10); // 100% of weight 1
      tracker.updateProgress('phase2', 5);  // 50% of weight 3
      
      const overall = tracker.getProgress();
      // Expected: (1*100 + 3*50) / 4 = 62.5%
      expect(overall?.percentage).toBeCloseTo(62.5);
    });

    it('should handle multiple phases with different weights', () => {
      tracker.addPhase('discovery', 100, 1);
      tracker.addPhase('analysis', 200, 3);
      tracker.addPhase('learning', 50, 2);
      
      tracker.updateProgress('discovery', 100);  // 100%
      tracker.updateProgress('analysis', 100);   // 50% 
      tracker.updateProgress('learning', 25);    // 50%
      
      const overall = tracker.getProgress();
      // Expected: (1*100 + 3*50 + 2*50) / 6 = 66.67%
      expect(overall?.percentage).toBeCloseTo(66.67, 1);
    });
  });

  describe('event emission', () => {
    it('should emit progress events', () => {
      const progressEvents: ProgressUpdate[] = [];
      tracker.on('progress', (update: ProgressUpdate) => {
        progressEvents.push(update);
      });

      tracker.addPhase('test', 10);
      tracker.updateProgress('test', 5, 'Test message');

      expect(progressEvents).toHaveLength(1);
      expect(progressEvents[0].phase).toBe('test');
      expect(progressEvents[0].current).toBe(5);
      expect(progressEvents[0].message).toBe('Test message');
    });

    it('should emit overall progress events', () => {
      const overallEvents: ProgressUpdate[] = [];
      tracker.on('overall', (update: ProgressUpdate) => {
        overallEvents.push(update);
      });

      tracker.addPhase('test', 10);
      tracker.updateProgress('test', 5);

      expect(overallEvents).toHaveLength(1);
      expect(overallEvents[0].phase).toBe('overall');
      expect(overallEvents[0].percentage).toBe(50);
    });
  });

  describe('completion', () => {
    it('should complete individual phases', () => {
      tracker.addPhase('test', 10);
      tracker.updateProgress('test', 5);
      tracker.complete('test');
      
      const progress = tracker.getProgress('test');
      expect(progress?.current).toBe(10);
      expect(progress?.percentage).toBe(100);
    });

    it('should complete all phases', () => {
      tracker.addPhase('phase1', 10);
      tracker.addPhase('phase2', 20);
      tracker.updateProgress('phase1', 3);
      tracker.updateProgress('phase2', 7);
      
      tracker.complete();
      
      expect(tracker.getProgress('phase1')?.percentage).toBe(100);
      expect(tracker.getProgress('phase2')?.percentage).toBe(100);
      expect(tracker.getProgress()?.percentage).toBe(100);
    });
  });

  describe('reset functionality', () => {
    it('should reset all progress', () => {
      tracker.addPhase('test', 10);
      tracker.updateProgress('test', 8);
      
      tracker.reset();
      
      const progress = tracker.getProgress('test');
      expect(progress?.current).toBe(0);
      expect(progress?.percentage).toBe(0);
    });
  });

  describe('console rendering', () => {
    it('should render progress bars', () => {
      tracker.addPhase('test', 10);
      tracker.updateProgress('test', 3);
      
      const bar = tracker.renderProgressBar('test', 20);
      expect(bar).toContain('test:');
      expect(bar).toContain('30.0%');
      expect(bar).toContain('(3/10)');
    });

    it('should get console status', () => {
      tracker.addPhase('phase1', 10);
      tracker.addPhase('phase2', 20);
      tracker.updateProgress('phase1', 5);
      tracker.updateProgress('phase2', 10);
      
      const status = tracker.getConsoleStatus();
      expect(status.length).toBeGreaterThan(0);
      expect(status[0]).toContain('Overall Progress');
    });
  });
});

describe('ConsoleProgressRenderer', () => {
  let tracker: ProgressTracker;
  let renderer: ConsoleProgressRenderer;
  let mockStdoutWrite: any;

  beforeEach(() => {
    tracker = new ProgressTracker();
    renderer = new ConsoleProgressRenderer(tracker);
    mockStdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    renderer.stop();
    mockStdoutWrite.mockRestore();
  });

  describe('rendering', () => {
    it('should start and stop rendering', () => {
      renderer.start();
      expect(renderer).toBeDefined();
      
      renderer.stop();
      // Should not throw
    });

    it('should get progress data', () => {
      tracker.addPhase('test', 10);
      tracker.updateProgress('test', 3);
      
      const data = renderer.getProgressData();
      expect(data.overall).toBe(30);
      expect(data.phases).toHaveLength(1);
      expect(data.phases[0].name).toBe('test');
      expect(data.phases[0].percentage).toBe(30);
    });

    it('should detect completion', () => {
      tracker.addPhase('test', 10);
      
      const data1 = renderer.getProgressData();
      expect(data1.isComplete).toBe(false);
      
      tracker.complete('test');
      
      const data2 = renderer.getProgressData();
      expect(data2.isComplete).toBe(true);
    });
  });

  describe('static helpers', () => {
    it('should render simple progress bars', () => {
      const bar = ConsoleProgressRenderer.renderSimpleBar(7, 10, 20, 'Test');
      expect(bar).toContain('Test:');
      expect(bar).toContain('70.0%');
      expect(bar).toContain('(7/10)');
    });
  });
});