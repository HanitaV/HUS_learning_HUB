import type { CodeExecutionResult } from '../../domain/code-lab';

export type RuntimeStage =
  | 'idle'
  | 'loading'
  | 'compiling'
  | 'running'
  | 'ready'
  | 'error';

export interface RunCodeOptions {
  readonly stdin: string;
  readonly timeoutMs?: number;
  readonly javaClassName?: string;
  readonly onStage?: (stage: RuntimeStage, message?: string) => void;
}

export interface WasmCodeRunner {
  run(code: string, options: RunCodeOptions): Promise<CodeExecutionResult>;
  cancel(): void;
  dispose(): void;
}
