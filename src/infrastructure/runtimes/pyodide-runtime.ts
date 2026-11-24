import type { CodeExecutionResult } from '../../domain/code-lab';
import type {
  PyodideWorkerRequest,
  PyodideWorkerResponse,
} from './pyodide.worker';
import type { RunCodeOptions, WasmCodeRunner } from './types';

const DEFAULT_LOAD_TIMEOUT_MS = 30_000;
const DEFAULT_EXEC_TIMEOUT_MS = 8_000;

interface PendingRun {
  readonly id: string;
  readonly startTime: number;
  readonly execTimeoutMs: number;
  readonly options: RunCodeOptions;
  readonly resolve: (result: CodeExecutionResult) => void;
  timerId: number | null;
}

export function createPyodideRunner(): WasmCodeRunner {
  let worker: Worker | null = null;
  let isLoaded = false;
  let pending: PendingRun | null = null;
  let nextRunId = 1;

  function clearPendingTimer(run: PendingRun): void {
    if (run.timerId !== null) {
      window.clearTimeout(run.timerId);
      run.timerId = null;
    }
  }

  function terminateWorker(): void {
    if (worker !== null) {
      worker.onmessage = null;
      worker.onerror = null;
      worker.onmessageerror = null;
      worker.terminate();
      worker = null;
    }
    isLoaded = false;
  }

  function finishPending(result: CodeExecutionResult): void {
    if (pending === null) {
      return;
    }
    const current = pending;
    pending = null;
    clearPendingTimer(current);
    current.resolve(result);
  }

  function scheduleTimeout(run: PendingRun, timeoutMs: number): void {
    clearPendingTimer(run);
    run.timerId = window.setTimeout(() => {
      if (pending === null || pending.id !== run.id) {
        return;
      }
      terminateWorker();
      run.options.onStage?.('error', 'Hết thời gian thực thi.');
      finishPending({
        status: 'timeout',
        stdout: '',
        stderr: '',
        durationMs: Math.round(performance.now() - run.startTime),
        errorMessage: `Chương trình vượt quá giới hạn thời gian (${timeoutMs} ms).`,
      });
    }, timeoutMs);
  }

  function ensureWorker(): Worker {
    if (worker !== null) {
      return worker;
    }

    const created = new Worker(
      new URL('./pyodide.worker.ts', import.meta.url),
      { type: 'module' },
    );

    created.onmessage = (event: MessageEvent<PyodideWorkerResponse>) => {
      const msg = event.data;
      if (!msg || pending === null) {
        return;
      }

      if (msg.type === 'stage') {
        if (msg.stage === 'loading') {
          pending.options.onStage?.('loading', 'Đang tải Python (Pyodide)...');
          if (!isLoaded) {
            scheduleTimeout(pending, DEFAULT_LOAD_TIMEOUT_MS);
          }
        } else if (msg.stage === 'running') {
          isLoaded = true;
          pending.options.onStage?.('running', 'Đang chạy mã Python...');
          scheduleTimeout(pending, pending.execTimeoutMs);
        }
        return;
      }

      if (msg.type === 'result' && msg.id === pending.id) {
        if (msg.result.status !== 'unavailable') {
          isLoaded = true;
        }
        if (msg.result.status === 'ok') {
          pending.options.onStage?.('ready');
        } else {
          pending.options.onStage?.('error', msg.result.errorMessage);
        }
        finishPending(msg.result);
      }
    };

    created.onerror = (event: ErrorEvent) => {
      const detail = event.message || 'Lỗi khởi tạo Web Worker Pyodide.';
      terminateWorker();
      if (pending !== null) {
        pending.options.onStage?.('error', detail);
        finishPending({
          status: 'unavailable',
          stdout: '',
          stderr: detail,
          durationMs: Math.round(performance.now() - pending.startTime),
          errorMessage:
            'Không thể khởi chạy môi trường Python trong trình duyệt.',
        });
      }
    };

    created.onmessageerror = () => {
      terminateWorker();
      if (pending !== null) {
        pending.options.onStage?.('error', 'Lỗi giao tiếp với Worker.');
        finishPending({
          status: 'unavailable',
          stdout: '',
          stderr: '',
          durationMs: Math.round(performance.now() - pending.startTime),
          errorMessage: 'Mất kết nối với môi trường thực thi Python.',
        });
      }
    };

    worker = created;
    return created;
  }

  function cancel(): void {
    if (pending === null) {
      return;
    }
    const current = pending;
    terminateWorker();
    current.options.onStage?.('idle');
    finishPending({
      status: 'cancelled',
      stdout: '',
      stderr: '',
      durationMs: Math.round(performance.now() - current.startTime),
      errorMessage: 'Đã hủy thực thi.',
    });
  }

  function dispose(): void {
    cancel();
    terminateWorker();
  }

  function run(
    code: string,
    options: RunCodeOptions,
  ): Promise<CodeExecutionResult> {
    if (pending !== null) {
      cancel();
    }

    const execTimeoutMs = options.timeoutMs ?? DEFAULT_EXEC_TIMEOUT_MS;
    const startTime = performance.now();

    if (typeof Worker === 'undefined') {
      options.onStage?.('error', 'Trình duyệt không hỗ trợ Web Worker.');
      return Promise.resolve({
        status: 'unavailable',
        stdout: '',
        stderr: '',
        durationMs: 0,
        errorMessage:
          'Trình duyệt hiện tại không hỗ trợ Web Worker để chạy Python.',
      });
    }

    let activeWorker: Worker;
    try {
      activeWorker = ensureWorker();
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      options.onStage?.('error', detail);
      return Promise.resolve({
        status: 'unavailable',
        stdout: '',
        stderr: detail,
        durationMs: 0,
        errorMessage:
          'Không thể khởi tạo Web Worker cho môi trường Python.',
      });
    }

    const id = `py-${nextRunId++}`;

    return new Promise<CodeExecutionResult>((resolve) => {
      const runState: PendingRun = {
        id,
        startTime,
        execTimeoutMs,
        options,
        resolve,
        timerId: null,
      };
      pending = runState;

      scheduleTimeout(
        runState,
        isLoaded ? execTimeoutMs : DEFAULT_LOAD_TIMEOUT_MS,
      );

      const payload: PyodideWorkerRequest = {
        type: 'run',
        id,
        code,
        stdin: options.stdin,
      };
      activeWorker.postMessage(payload);
    });
  }

  return {
    run,
    cancel,
    dispose,
  };
}
