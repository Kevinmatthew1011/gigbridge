import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { createProcessCoordinator, startDevAll } from '../scripts/devAll.ts';

class MockChildProcess extends EventEmitter {
  public killed = false;
  public killSignal: string | null = null;

  public kill(signal: string = 'SIGTERM') {
    this.killed = true;
    this.killSignal = signal;
    // Simulate async exit on signal
    setTimeout(() => {
      this.emit('exit', 0, signal);
    }, 10);
    return true;
  }
}

describe('scripts/devAll.ts - Port Availability Checks & Process Lifecycle', () => {
  describe('Port Occupancy Pre-Checks', () => {
    it('aborts and does not spawn either child if gateway port 3001 is occupied', async () => {
      const exitFn = vi.fn();
      const errorFn = vi.fn();
      const mockSpawn = vi.fn();
      const checkPortFn = vi.fn().mockImplementation(async (port: number) => {
        if (port === 3001) return false; // 3001 is occupied
        return true;
      });

      const result = await startDevAll({
        checkPortFn,
        spawnFn: mockSpawn as any,
        exitFn,
        errorFn,
      });

      expect(result).toBeNull();
      expect(mockSpawn).not.toHaveBeenCalled();
      expect(exitFn).toHaveBeenCalledWith(1);
      expect(errorFn).toHaveBeenCalledWith(expect.stringContaining('Cannot start: required port is already occupied'));
      expect(errorFn).toHaveBeenCalledWith(expect.stringContaining('127.0.0.1:3001 (explanation gateway)'));
    });

    it('aborts and does not spawn either child if frontend port 5173 is occupied', async () => {
      const exitFn = vi.fn();
      const errorFn = vi.fn();
      const mockSpawn = vi.fn();
      const checkPortFn = vi.fn().mockImplementation(async (port: number) => {
        if (port === 5173) return false; // 5173 is occupied
        return true;
      });

      const result = await startDevAll({
        checkPortFn,
        spawnFn: mockSpawn as any,
        exitFn,
        errorFn,
      });

      expect(result).toBeNull();
      expect(mockSpawn).not.toHaveBeenCalled();
      expect(exitFn).toHaveBeenCalledWith(1);
      expect(errorFn).toHaveBeenCalledWith(expect.stringContaining('127.0.0.1:5173 (Vite frontend)'));
    });

    it('lists both ports if both 3001 and 5173 are occupied', async () => {
      const exitFn = vi.fn();
      const errorFn = vi.fn();
      const mockSpawn = vi.fn();
      const checkPortFn = vi.fn().mockResolvedValue(false); // Both occupied

      const result = await startDevAll({
        checkPortFn,
        spawnFn: mockSpawn as any,
        exitFn,
        errorFn,
      });

      expect(result).toBeNull();
      expect(mockSpawn).not.toHaveBeenCalled();
      expect(exitFn).toHaveBeenCalledWith(1);
      expect(errorFn).toHaveBeenCalledWith(expect.stringContaining('127.0.0.1:3001 (explanation gateway)'));
      expect(errorFn).toHaveBeenCalledWith(expect.stringContaining('127.0.0.1:5173 (Vite frontend)'));
    });
  });

  describe('Process Spawn & Reaping Coordination', () => {
    it('spawns both processes with strictPort when ports are available', async () => {
      const spawnedCalls: Array<{ command: string; args: string[]; options: any }> = [];
      const mockSpawn = vi.fn().mockImplementation((command: string, args: string[], options: any) => {
        spawnedCalls.push({ command, args, options });
        return new MockChildProcess();
      });

      const exitFn = vi.fn();
      const checkPortFn = vi.fn().mockResolvedValue(true);

      const result = await startDevAll({
        checkPortFn,
        spawnFn: mockSpawn as any,
        exitFn,
      });

      expect(result).not.toBeNull();
      expect(mockSpawn).toHaveBeenCalledTimes(2);

      // Verify server spawn
      expect(spawnedCalls[0].args).toEqual(['server/index.ts']);
      expect(spawnedCalls[0].options.stdio).toBe('inherit');

      // Verify client spawn with strictPort
      expect(spawnedCalls[1].args).toEqual(['run', 'dev', '--', '--strictPort']);
      expect(spawnedCalls[1].options.stdio).toBe('inherit');

      result?.cleanup();
    });

    it('stops and reaps all children before parent exits on SIGINT', async () => {
      const exitFn = vi.fn();
      const coordinator = createProcessCoordinator({ exitFn });

      const child1 = new MockChildProcess();
      const child2 = new MockChildProcess();

      coordinator.registerChild(child1 as any, 'gateway');
      coordinator.registerChild(child2 as any, 'frontend');

      expect(coordinator.getChildren().length).toBe(2);

      // Trigger shutdown and wait for reaping
      await coordinator.shutdown(0, 'SIGINT');

      expect(child1.killed).toBe(true);
      expect(child1.killSignal).toBe('SIGINT');
      expect(child2.killed).toBe(true);
      expect(child2.killSignal).toBe('SIGINT');
      expect(exitFn).toHaveBeenCalledWith(0);
      expect(coordinator.isShuttingDown()).toBe(true);
    });

    it('terminates surviving child and waits for exit if a child exits with error', async () => {
      const exitFn = vi.fn();
      const coordinator = createProcessCoordinator({ exitFn });

      const child1 = new MockChildProcess();
      const child2 = new MockChildProcess();

      coordinator.registerChild(child1 as any, 'gateway');
      coordinator.registerChild(child2 as any, 'frontend');

      // Child 1 fails
      child1.emit('error', new Error('Gateway failed to start'));

      // Wait a tick for child2 exit simulation
      await new Promise((r) => setTimeout(r, 30));

      expect(child2.killed).toBe(true);
      expect(child2.killSignal).toBe('SIGTERM');
      expect(exitFn).toHaveBeenCalledWith(1);
    });

    it('terminates surviving child and waits for exit if a child exits with non-zero code', async () => {
      const exitFn = vi.fn();
      const coordinator = createProcessCoordinator({ exitFn });

      const child1 = new MockChildProcess();
      const child2 = new MockChildProcess();

      coordinator.registerChild(child1 as any, 'gateway');
      coordinator.registerChild(child2 as any, 'frontend');

      // Child 2 crashes with code 2
      child2.emit('exit', 2, null);

      // Wait a tick for child1 exit simulation
      await new Promise((r) => setTimeout(r, 30));

      expect(child1.killed).toBe(true);
      expect(child1.killSignal).toBe('SIGTERM');
      expect(exitFn).toHaveBeenCalledWith(2);
    });
  });
});
