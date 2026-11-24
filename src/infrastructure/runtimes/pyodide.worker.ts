import type { CodeExecutionResult } from '../../domain/code-lab';

const PYODIDE_INDEX_URL = 'https://cdn.jsdelivr.net/pyodide/v0.27.5/full/';
const PYODIDE_MODULE_URL = `${PYODIDE_INDEX_URL}pyodide.mjs`;

interface PyodideGlobals {
  get(name: string): unknown;
  set(name: string, value: unknown): void;
  delete(name: string): void;
}

interface PyodideInstance {
  readonly globals: PyodideGlobals;
  runPythonAsync(code: string): Promise<unknown>;
}

interface PyodideModule {
  loadPyodide(options?: { readonly indexURL?: string }): Promise<PyodideInstance>;
}

export interface PyodideWorkerRequest {
  readonly type: 'run';
  readonly id: string;
  readonly code: string;
  readonly stdin: string;
}

export type PyodideWorkerResponse =
  | {
      readonly type: 'stage';
      readonly stage: 'loading' | 'running';
    }
  | {
      readonly type: 'result';
      readonly id: string;
      readonly result: CodeExecutionResult;
    };

interface WorkerGlobalScopeLike {
  postMessage(message: PyodideWorkerResponse): void;
  addEventListener(
    type: 'message',
    listener: (event: MessageEvent<PyodideWorkerRequest>) => void,
  ): void;
}

const workerScope = globalThis as unknown as WorkerGlobalScopeLike;

const PYTHON_HARNESS = `
import io
import sys
import traceback

__hus_orig_stdin = sys.stdin
__hus_orig_stdout = sys.stdout
__hus_orig_stderr = sys.stderr
__hus_out_buf = io.StringIO()
__hus_err_buf = io.StringIO()
__hus_ok = True

try:
    sys.stdin = io.StringIO(__hus_stdin)
    sys.stdout = __hus_out_buf
    sys.stderr = __hus_err_buf
    __hus_ns = {"__name__": "__main__"}
    exec(compile(__hus_code, "<main.py>", "exec"), __hus_ns)
except SystemExit as __hus_exit:
    if __hus_exit.code not in (None, 0):
        __hus_ok = False
        if isinstance(__hus_exit.code, str):
            __hus_err_buf.write(__hus_exit.code + "\\n")
        else:
            __hus_err_buf.write(f"Process exited with code {__hus_exit.code}\\n")
except BaseException:
    __hus_ok = False
    traceback.print_exc(file=__hus_err_buf)
finally:
    sys.stdin = __hus_orig_stdin
    sys.stdout = __hus_orig_stdout
    sys.stderr = __hus_orig_stderr

__hus_stdout_text = __hus_out_buf.getvalue()
__hus_stderr_text = __hus_err_buf.getvalue()
`;

let pyodidePromise: Promise<PyodideInstance> | null = null;

async function getPyodide(): Promise<PyodideInstance> {
  if (!pyodidePromise) {
    pyodidePromise = (async () => {
      const mod = (await import(
        /* @vite-ignore */ PYODIDE_MODULE_URL
      )) as PyodideModule;
      return mod.loadPyodide({ indexURL: PYODIDE_INDEX_URL });
    })().catch((error: unknown) => {
      pyodidePromise = null;
      throw error;
    });
  }
  return pyodidePromise;
}

function postMessageToHost(message: PyodideWorkerResponse): void {
  workerScope.postMessage(message);
}

async function handleRun(request: PyodideWorkerRequest): Promise<void> {
  const totalStart = performance.now();
  let pyodide: PyodideInstance;

  try {
    postMessageToHost({ type: 'stage', stage: 'loading' });
    pyodide = await getPyodide();
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    postMessageToHost({
      type: 'result',
      id: request.id,
      result: {
        status: 'unavailable',
        stdout: '',
        stderr: detail,
        durationMs: Math.round(performance.now() - totalStart),
        errorMessage:
          'Không thể tải môi trường Python (Pyodide). Vui lòng kiểm tra kết nối mạng.',
      },
    });
    return;
  }

  postMessageToHost({ type: 'stage', stage: 'running' });
  const execStart = performance.now();

  try {
    pyodide.globals.set('__hus_code', request.code);
    pyodide.globals.set('__hus_stdin', request.stdin);
    await pyodide.runPythonAsync(PYTHON_HARNESS);

    const ok = pyodide.globals.get('__hus_ok') === true;
    const stdoutRaw = pyodide.globals.get('__hus_stdout_text');
    const stderrRaw = pyodide.globals.get('__hus_stderr_text');
    const stdout = typeof stdoutRaw === 'string' ? stdoutRaw : '';
    const stderr = typeof stderrRaw === 'string' ? stderrRaw : '';

    postMessageToHost({
      type: 'result',
      id: request.id,
      result: ok
        ? {
            status: 'ok',
            stdout,
            stderr,
            durationMs: Math.round(performance.now() - execStart),
          }
        : {
            status: 'runtime-error',
            stdout,
            stderr,
            durationMs: Math.round(performance.now() - execStart),
            errorMessage: 'Chương trình Python gặp lỗi khi thực thi.',
          },
    });
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    postMessageToHost({
      type: 'result',
      id: request.id,
      result: {
        status: 'runtime-error',
        stdout: '',
        stderr: detail,
        durationMs: Math.round(performance.now() - execStart),
        errorMessage: 'Lỗi thực thi trong môi trường Pyodide.',
      },
    });
  } finally {
    try {
      pyodide.globals.delete('__hus_code');
      pyodide.globals.delete('__hus_stdin');
      pyodide.globals.delete('__hus_stdout_text');
      pyodide.globals.delete('__hus_stderr_text');
      pyodide.globals.delete('__hus_ok');
    } catch {
      // Ignore cleanup errors if runtime state is already reset.
    }
  }
}

workerScope.addEventListener(
  'message',
  (event: MessageEvent<PyodideWorkerRequest>) => {
    const data = event.data;
    if (data && data.type === 'run') {
      void handleRun(data);
    }
  },
);
