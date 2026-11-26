import type { EntityId } from './learning';

export type CodeLanguage = 'python' | 'java';

export type CodeDifficulty = 'basic' | 'standard' | 'advanced';

export interface CodeTestCase {
  readonly id: string;
  readonly label: string;
  readonly stdin: string;
  readonly expectedOutput: string;
  readonly hidden?: boolean;
}

export interface CodeProblem {
  readonly id: EntityId;
  readonly courseId: EntityId;
  readonly lessonId?: EntityId;
  readonly chapterLabel: string;
  readonly title: string;
  readonly difficulty: CodeDifficulty;
  readonly summary: string;
  readonly promptMarkdown: string;
  readonly supportedLanguages: readonly CodeLanguage[];
  readonly defaultLanguage: CodeLanguage;
  readonly javaClassName?: string;
  readonly starterCode: Readonly<Partial<Record<CodeLanguage, string>>>;
  readonly hints: readonly string[];
  readonly testCases: readonly CodeTestCase[];
}

export type ExecutionStatus =
  | 'ok'
  | 'compile-error'
  | 'runtime-error'
  | 'timeout'
  | 'cancelled'
  | 'unavailable';

export interface CodeExecutionResult {
  readonly status: ExecutionStatus;
  readonly stdout: string;
  readonly stderr: string;
  readonly durationMs: number;
  readonly errorMessage?: string;
}

export interface TestCaseVerdict {
  readonly testCaseId: string;
  readonly label: string;
  readonly passed: boolean;
  readonly status: ExecutionStatus;
  readonly stdin: string;
  readonly expectedOutput: string;
  readonly actualOutput: string;
  readonly stderr: string;
  readonly durationMs: number;
  readonly errorMessage?: string;
}

export interface JudgeSummary {
  readonly total: number;
  readonly passed: number;
  readonly allPassed: boolean;
  readonly verdicts: readonly TestCaseVerdict[];
}

export interface CodePlaygroundSnippet {
  readonly id: string;
  readonly label: string;
  readonly language: CodeLanguage;
  readonly code: string;
  readonly source: 'exercise' | 'lesson' | 'template';
}

export interface CodeLabWebMcpContextPacket {
  readonly schemaVersion: 1;
  readonly generatedAt: string;
  readonly courseId: EntityId;
  readonly mode: 'problem' | 'playground';
  readonly language: CodeLanguage;
  readonly problem?: {
    readonly id: EntityId;
    readonly title: string;
    readonly chapterLabel: string;
    readonly difficulty: CodeDifficulty;
    readonly promptMarkdown: string;
    readonly hints: readonly string[];
    readonly visibleTestCases: readonly {
      readonly label: string;
      readonly stdin: string;
      readonly expectedOutput: string;
    }[];
    readonly hiddenTestCaseCount: number;
  } | undefined;
  readonly snippetLabel?: string | undefined;
  readonly studentCode: string;
  readonly customStdin: string;
  readonly latestExecution?: {
    readonly status: ExecutionStatus;
    readonly stdout: string;
    readonly stderr: string;
    readonly errorMessage?: string | undefined;
  } | undefined;
  readonly latestJudgeSummary?: {
    readonly passed: number;
    readonly total: number;
    readonly allPassed: boolean;
    readonly failedVisibleVerdicts: readonly {
      readonly label: string;
      readonly status: ExecutionStatus;
      readonly expectedOutput: string;
      readonly actualOutput: string;
      readonly stderr: string;
    }[];
    readonly failedHiddenCount: number;
  } | undefined;
  readonly pedagogicalContract: readonly string[];
}

export type CodeLabCoachingVerdict = 'pass' | 'needs-fix';

export interface CodeLabCoachingFeedback {
  readonly version: 1;
  readonly problemId?: EntityId | undefined;
  readonly language: CodeLanguage;
  readonly source: 'webmcp' | 'clipboard';
  readonly receivedAt: string;
  readonly summary: string;
  readonly verdict?: CodeLabCoachingVerdict | undefined;
  readonly complexityNote?: string | undefined;
  readonly bugHints: readonly string[];
  readonly edgeCases: readonly string[];
  readonly socraticQuestions: readonly string[];
}
