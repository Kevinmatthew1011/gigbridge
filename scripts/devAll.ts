#!/usr/bin/env node
import { spawn, type ChildProcess } from 'node:child_process';
import net from 'node:net';
import process from 'node:process';

export interface ProcessCoordinatorOptions {
  exitFn?: (code: number) => void;
  forceKillTimeoutMs?: number;
}

export interface StartDevAllOptions extends ProcessCoordinatorOptions {
  spawnFn?: typeof spawn;
  checkPortFn?: (port: number, host: string) => Promise<boolean>;
  logFn?: (...args: any[]) => void;
  errorFn?: (...args: any[]) => void;
}

/**
 * Checks if a specific host:port is free to bind.
 */
export function isPortAvailable(port: number, host: string = '127.0.0.1'): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', () => {
      resolve(false);
    });

    server.once('listening', () => {
      server.close(() => {
        resolve(true);
      });
    });

    server.listen(port, host);
  });
}

/**
 * Process coordinator that manages multiple child processes,
 * forwards termination signals, reaps children before exit,
 * and ensures clean shutdown if any child fails.
 */
export function createProcessCoordinator(options: ProcessCoordinatorOptions = {}) {
  const exitFn = options.exitFn || ((code: number) => process.exit(code));
  const forceKillTimeoutMs = options.forceKillTimeoutMs ?? 3000;
  const children: Array<{ proc: ChildProcess; name: string; exited: boolean }> = [];
  let isShuttingDown = false;

  function shutdown(code: number = 0, signal: NodeJS.Signals = 'SIGTERM'): Promise<void> {
    if (isShuttingDown) return Promise.resolve();
    isShuttingDown = true;

    // Signal all child processes that are still running
    for (const item of children) {
      if (item.proc && !item.exited && typeof item.proc.kill === 'function' && !item.proc.killed) {
        try {
          item.proc.kill(signal);
        } catch (_err) {
          // Process might have already exited
        }
      }
    }

    const unexited = children.filter((c) => !c.exited);
    if (unexited.length === 0) {
      exitFn(code);
      return Promise.resolve();
    }

    let remainingCount = unexited.length;

    return new Promise<void>((resolve) => {
      let resolved = false;

      const finish = () => {
        if (resolved) return;
        resolved = true;
        exitFn(code);
        resolve();
      };

      const checkDone = () => {
        remainingCount--;
        if (remainingCount <= 0) {
          finish();
        }
      };

      for (const item of unexited) {
        if (item.exited) {
          checkDone();
        } else {
          item.proc.once('exit', () => {
            item.exited = true;
            checkDone();
          });
        }
      }

      // Safety fallback to SIGKILL if child processes fail to terminate within deadline
      const timer = setTimeout(() => {
        for (const item of children) {
          if (!item.exited && typeof item.proc.kill === 'function' && !item.proc.killed) {
            try {
              item.proc.kill('SIGKILL');
            } catch (_err) {}
          }
        }
        finish();
      }, forceKillTimeoutMs);

      if (typeof timer.unref === 'function') {
        timer.unref();
      }
    });
  }

  function registerChild(proc: ChildProcess, name: string = 'child'): ChildProcess {
    const entry = { proc, name, exited: false };
    children.push(entry);

    proc.on('error', (err: Error) => {
      console.error(`[GigBridge dev:all] Process "${name}" failed:`, err.message || err);
      entry.exited = true;
      shutdown(1, 'SIGTERM');
    });

    proc.on('exit', (code: number | null, signal: string | null) => {
      entry.exited = true;
      if (isShuttingDown) return;

      if (code !== 0 && code !== null) {
        console.error(`[GigBridge dev:all] Process "${name}" exited unexpectedly with code ${code}.`);
        shutdown(code, 'SIGTERM');
      } else if (signal) {
        console.warn(`[GigBridge dev:all] Process "${name}" exited due to signal ${signal}.`);
        shutdown(1, 'SIGTERM');
      } else {
        // Clean exit of one child -> shutdown others cleanly
        shutdown(0, 'SIGTERM');
      }
    });

    return proc;
  }

  return {
    registerChild,
    shutdown,
    getChildren: () => children.map((c) => c.proc),
    isShuttingDown: () => isShuttingDown,
  };
}

/**
 * Validates required ports, then starts both the explanation gateway
 * and the Vite frontend concurrently.
 */
export async function startDevAll(options: StartDevAllOptions = {}) {
  const spawnFn = options.spawnFn || spawn;
  const checkPortFn = options.checkPortFn || isPortAvailable;
  const exitFn = options.exitFn || ((code: number) => process.exit(code));
  const logFn = options.logFn || console.log;
  const errorFn = options.errorFn || console.error;

  const GATEWAY_PORT = 3001;
  const FRONTEND_PORT = 5173;
  const HOST = '127.0.0.1';

  // 1. Port occupancy checks before spawning
  const [isGatewayPortFree, isFrontendPortFree] = await Promise.all([
    checkPortFn(GATEWAY_PORT, HOST),
    checkPortFn(FRONTEND_PORT, HOST),
  ]);

  const occupied: string[] = [];
  if (!isGatewayPortFree) {
    occupied.push(`${HOST}:${GATEWAY_PORT} (explanation gateway)`);
  }
  if (!isFrontendPortFree) {
    occupied.push(`${HOST}:${FRONTEND_PORT} (Vite frontend)`);
  }

  if (occupied.length > 0) {
    errorFn('[GigBridge dev:all] Cannot start: required port is already occupied:');
    for (const item of occupied) {
      errorFn(`  - ${item}`);
    }
    errorFn('[GigBridge dev:all] Please stop the existing gateway/frontend process before running dev:all.');
    exitFn(1);
    return null;
  }

  const coordinator = createProcessCoordinator(options);
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

  logFn('[GigBridge dev:all] Starting local explanation gateway (127.0.0.1:3001) and Vite frontend (127.0.0.1:5173)...');

  // 2. Start explanation gateway server
  const serverProc = spawnFn(process.execPath, ['server/index.ts'], {
    stdio: 'inherit',
    env: process.env,
  });
  coordinator.registerChild(serverProc, 'gateway');

  // 3. Start Vite frontend dev server with strictPort enabled
  const clientProc = spawnFn(npmCmd, ['run', 'dev', '--', '--strictPort'], {
    stdio: 'inherit',
    env: process.env,
  });
  coordinator.registerChild(clientProc, 'frontend');

  // 4. Register signal listeners on parent process
  const onSigInt = () => {
    logFn('\n[GigBridge dev:all] Received SIGINT (Ctrl+C). Stopping and reaping child processes...');
    coordinator.shutdown(0, 'SIGINT');
  };

  const onSigTerm = () => {
    logFn('\n[GigBridge dev:all] Received SIGTERM. Stopping and reaping child processes...');
    coordinator.shutdown(0, 'SIGTERM');
  };

  process.on('SIGINT', onSigInt);
  process.on('SIGTERM', onSigTerm);

  return {
    coordinator,
    serverProc,
    clientProc,
    cleanup: () => {
      process.off('SIGINT', onSigInt);
      process.off('SIGTERM', onSigTerm);
    },
  };
}

// Direct CLI execution
if (process.argv[1] && (process.argv[1].endsWith('devAll.ts') || process.argv[1].endsWith('devAll.js'))) {
  startDevAll();
}
