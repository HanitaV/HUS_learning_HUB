import type { CodeExecutionResult } from '../../domain/code-lab';
import type { RunCodeOptions, WasmCodeRunner } from './types';

const CHEERPJ_LOADER_URL = 'https://cjrtnc.leaningtech.com/5.0/loader.js';
const DEFAULT_JAVA_TIMEOUT_MS = 15_000;
const OUT_MARKER = '__HUS_OUT_B64__:';
const ERR_MARKER = '__HUS_ERR_B64__:';

interface CheerpJInitOptions {
  readonly version?: number;
}

declare global {
  interface Window {
    cheerpjInit?: (options?: CheerpJInitOptions) => Promise<void>;
    cheerpjRunMain?: (
      className: string,
      classPath: string,
      ...args: string[]
    ) => Promise<number>;
    cheerpOSAddStringFile?: (path: string, content: string) => void;
  }
}

const HUS_JAVA_RUNNER_SOURCE = `import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.PrintStream;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.Base64;

public class __HusRunner {
    public static void main(String[] args) {
        if (args.length == 0) {
            System.exit(1);
            return;
        }
        String targetClass = args[0];
        InputStream origIn = System.in;
        PrintStream origOut = System.out;
        PrintStream origErr = System.err;

        ByteArrayOutputStream outBuf = new ByteArrayOutputStream();
        ByteArrayOutputStream errBuf = new ByteArrayOutputStream();
        int exitCode = 0;

        try {
            byte[] stdinBytes = Files.readAllBytes(Paths.get("/str/__hus_stdin.txt"));
            System.setIn(new ByteArrayInputStream(stdinBytes));
            System.setOut(new PrintStream(outBuf, true, StandardCharsets.UTF_8));
            System.setErr(new PrintStream(errBuf, true, StandardCharsets.UTF_8));

            Class<?> cls = Class.forName(targetClass);
            Method mainMethod = cls.getMethod("main", String[].class);
            mainMethod.invoke(null, (Object) new String[0]);
        } catch (InvocationTargetException ex) {
            exitCode = 1;
            Throwable cause = ex.getCause() != null ? ex.getCause() : ex;
            cause.printStackTrace(new PrintStream(errBuf, true, StandardCharsets.UTF_8));
        } catch (Throwable ex) {
            exitCode = 1;
            ex.printStackTrace(new PrintStream(errBuf, true, StandardCharsets.UTF_8));
        } finally {
            System.setIn(origIn);
            System.setOut(origOut);
            System.setErr(origErr);
        }

        String outB64 = Base64.getEncoder().encodeToString(outBuf.toByteArray());
        String errB64 = Base64.getEncoder().encodeToString(errBuf.toByteArray());
        origOut.println("${OUT_MARKER}" + outB64);
        origOut.println("${ERR_MARKER}" + errB64);

        if (exitCode != 0) {
            System.exit(exitCode);
        }
    }
}
`;

let cheerpJReadyPromise: Promise<void> | null = null;
let runnerCompiled = false;

function loadCheerpJScript(): Promise<void> {
  if (typeof window.cheerpjInit === 'function') {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${CHEERPJ_LOADER_URL}"]`,
    );
    if (existing) {
      if (typeof window.cheerpjInit === 'function') {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener(
        'error',
        () => reject(new Error('Không thể tải script CheerpJ.')),
        { once: true },
      );
      return;
    }

    const script = document.createElement('script');
    script.src = CHEERPJ_LOADER_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Không thể tải script CheerpJ.'));
    document.head.appendChild(script);
  });
}

async function ensureCheerpJReady(): Promise<void> {
  if (!cheerpJReadyPromise) {
    cheerpJReadyPromise = (async () => {
      await loadCheerpJScript();
      if (
        typeof window.cheerpjInit !== 'function' ||
        typeof window.cheerpjRunMain !== 'function' ||
        typeof window.cheerpOSAddStringFile !== 'function'
      ) {
        throw new Error('API CheerpJ chưa sẵn sàng sau khi tải.');
      }
      await window.cheerpjInit({ version: 17 });
    })().catch((error: unknown) => {
      cheerpJReadyPromise = null;
      throw error;
    });
  }
  return cheerpJReadyPromise;
}

function decodeBase64Utf8(base64: string): string {
  if (!base64) {
    return '';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

function formatConsoleArg(arg: unknown): string {
  if (typeof arg === 'string') {
    return arg;
  }
  if (arg instanceof Error) {
    return arg.message;
  }
  try {
    return String(arg);
  } catch {
    return '';
  }
}

async function withCapturedConsole<T>(
  fn: () => Promise<T>,
): Promise<{ readonly value: T; readonly lines: readonly string[] }> {
  const origLog = console.log;
  const origError = console.error;
  const lines: string[] = [];

  const capture = (...args: unknown[]): void => {
    const line = args.map(formatConsoleArg).join(' ');
    lines.push(line);
  };

  console.log = capture;
  console.error = capture;
  try {
    const value = await fn();
    return { value, lines };
  } finally {
    console.log = origLog;
    console.error = origError;
  }
}

function sanitizeJavaClassName(rawName: string | undefined): string {
  const trimmed = rawName?.trim() ?? '';
  if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(trimmed)) {
    return trimmed;
  }
  return 'Main';
}

export function createCheerpJRunner(): WasmCodeRunner {
  let activeRunId = 0;
  let cancelledRunId = 0;
  let timeoutTimer: number | null = null;
  let activeReject: ((reason: 'cancelled' | 'timeout') => void) | null = null;

  function clearTimer(): void {
    if (timeoutTimer !== null) {
      window.clearTimeout(timeoutTimer);
      timeoutTimer = null;
    }
  }

  function cancel(): void {
    if (activeRunId !== 0) {
      cancelledRunId = activeRunId;
      clearTimer();
      activeReject?.('cancelled');
      activeReject = null;
    }
  }

  function dispose(): void {
    cancel();
  }

  async function run(
    code: string,
    options: RunCodeOptions,
  ): Promise<CodeExecutionResult> {
    if (activeReject !== null) {
      cancel();
    }

    const runId = ++activeRunId;
    const startTime = performance.now();
    const timeoutMs = options.timeoutMs ?? DEFAULT_JAVA_TIMEOUT_MS;
    const className = sanitizeJavaClassName(options.javaClassName);

    const abortPromise = new Promise<never>((_resolve, reject) => {
      activeReject = reject;
      timeoutTimer = window.setTimeout(() => {
        reject('timeout');
      }, timeoutMs);
    });

    const execute = async (): Promise<CodeExecutionResult> => {
      try {
        options.onStage?.('loading', 'Đang tải môi trường Java (CheerpJ)...');
        await ensureCheerpJReady();
      } catch (error: unknown) {
        const detail = error instanceof Error ? error.message : String(error);
        options.onStage?.('error', detail);
        return {
          status: 'unavailable',
          stdout: '',
          stderr: detail,
          durationMs: Math.round(performance.now() - startTime),
          errorMessage:
            'Không thể tải môi trường Java (CheerpJ). Vui lòng kiểm tra kết nối mạng.',
        };
      }

      if (cancelledRunId === runId) {
        return {
          status: 'cancelled',
          stdout: '',
          stderr: '',
          durationMs: Math.round(performance.now() - startTime),
          errorMessage: 'Đã hủy thực thi.',
        };
      }

      const addStringFile = window.cheerpOSAddStringFile;
      const runMain = window.cheerpjRunMain;
      if (!addStringFile || !runMain) {
        options.onStage?.('error', 'CheerpJ API không khả dụng.');
        return {
          status: 'unavailable',
          stdout: '',
          stderr: '',
          durationMs: Math.round(performance.now() - startTime),
          errorMessage: 'Môi trường Java (CheerpJ) chưa sẵn sàng.',
        };
      }

      options.onStage?.('compiling', `Đang biên dịch ${className}.java...`);
      const sourcePath = `/str/${className}.java`;
      addStringFile(sourcePath, code);

      const compileResult = await withCapturedConsole(() =>
        runMain('com.sun.tools.javac.Main', '', '-d', '/files/out', sourcePath),
      );

      if (compileResult.value !== 0) {
        const compileErrors = compileResult.lines.join('\n').trim();
        options.onStage?.('error', 'Lỗi biên dịch Java.');
        return {
          status: 'compile-error',
          stdout: '',
          stderr: compileErrors,
          durationMs: Math.round(performance.now() - startTime),
          errorMessage: 'Lỗi biên dịch Java.',
        };
      }

      if (!runnerCompiled) {
        addStringFile('/str/__HusRunner.java', HUS_JAVA_RUNNER_SOURCE);
        const runnerCompileCode = await runMain(
          'com.sun.tools.javac.Main',
          '',
          '-d',
          '/files/out',
          '/str/__HusRunner.java',
        );
        if (runnerCompileCode !== 0) {
          options.onStage?.('error', 'Không thể khởi tạo bộ chạy Java.');
          return {
            status: 'unavailable',
            stdout: '',
            stderr: '',
            durationMs: Math.round(performance.now() - startTime),
            errorMessage: 'Không thể biên dịch bộ điều phối Java.',
          };
        }
        runnerCompiled = true;
      }

      addStringFile('/str/__hus_stdin.txt', options.stdin);
      options.onStage?.('running', `Đang chạy ${className}...`);

      const execStart = performance.now();
      const execResult = await withCapturedConsole(() =>
        runMain('__HusRunner', '/files/out', className),
      );
      const durationMs = Math.round(performance.now() - execStart);

      let stdout = '';
      let stderr = '';
      for (const line of execResult.lines) {
        if (line.startsWith(OUT_MARKER)) {
          stdout = decodeBase64Utf8(line.slice(OUT_MARKER.length).trim());
        } else if (line.startsWith(ERR_MARKER)) {
          stderr = decodeBase64Utf8(line.slice(ERR_MARKER.length).trim());
        }
      }

      if (execResult.value === 0) {
        options.onStage?.('ready');
        return {
          status: 'ok',
          stdout,
          stderr,
          durationMs,
        };
      }

      options.onStage?.('error', 'Chương trình Java gặp lỗi khi thực thi.');
      return {
        status: 'runtime-error',
        stdout,
        stderr,
        durationMs,
        errorMessage: 'Chương trình Java gặp lỗi khi thực thi.',
      };
    };

    try {
      return await Promise.race([execute(), abortPromise]);
    } catch (reason: unknown) {
      if (reason === 'cancelled') {
        options.onStage?.('idle');
        return {
          status: 'cancelled',
          stdout: '',
          stderr: '',
          durationMs: Math.round(performance.now() - startTime),
          errorMessage: 'Đã hủy thực thi.',
        };
      }
      options.onStage?.('error', 'Hết thời gian thực thi.');
      return {
        status: 'timeout',
        stdout: '',
        stderr: '',
        durationMs: Math.round(performance.now() - startTime),
        errorMessage: `Chương trình Java vượt quá giới hạn thời gian (${timeoutMs} ms).`,
      };
    } finally {
      clearTimer();
      if (activeRunId === runId) {
        activeReject = null;
      }
    }
  }

  return {
    run,
    cancel,
    dispose,
  };
}
