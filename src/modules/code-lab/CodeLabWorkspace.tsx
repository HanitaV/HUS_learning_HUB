import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { SubjectToolProps } from '../../contracts/subject-module';
import type {
  CodeDifficulty,
  CodeExecutionResult,
  CodeLanguage,
  CodePlaygroundSnippet,
  CodeProblem,
  JudgeSummary,
  TestCaseVerdict,
} from '../../domain/code-lab';
import { codeProblems } from '../../content/code-lab/problems';
import {
  extractJavaMainClassName,
  judgeTestCase,
  summarizeJudge,
} from '../../core/code-lab/judge';
import { buildPlaygroundSnippets, getStarterTemplate } from '../../core/code-lab/playground';
import { createPyodideRunner } from '../../infrastructure/runtimes/pyodide-runtime';
import { createCheerpJRunner } from '../../infrastructure/runtimes/cheerpj-runtime';
import type { RuntimeStage, WasmCodeRunner } from '../../infrastructure/runtimes/types';
import Markdown from '../../components/learning/Markdown';
import { Badge, type BadgeTone } from '../../components/ui/Badge';
import {
  AlertCircleIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  PlayIcon,
  RotateCcwIcon,
} from '../../components/ui/Icons';
import { CodeEditor } from './CodeEditor';

const DRAFT_STORAGE_PREFIX = 'hus-code-lab:draft:v1:';
const PLAYGROUND_STORAGE_PREFIX = 'hus-code-lab:playground:v1:';
const SOLVED_STORAGE_KEY = 'hus-code-lab:solved:v1';

type WorkspaceMode = 'problem' | 'playground';

const DIFFICULTY_META: Record<CodeDifficulty, { readonly label: string; readonly tone: BadgeTone }> = {
  basic: { label: 'Cơ bản', tone: 'success' },
  standard: { label: 'Tiêu chuẩn', tone: 'accent' },
  advanced: { label: 'Nâng cao', tone: 'warning' },
};

const LANGUAGE_LABELS: Record<CodeLanguage, string> = {
  python: 'Python (WASM)',
  java: 'Java (WASM)',
};

const STAGE_META: Record<RuntimeStage, { readonly label: string; readonly tone: BadgeTone }> = {
  idle: { label: 'Sẵn sàng', tone: 'neutral' },
  loading: { label: 'Đang tải runtime WASM...', tone: 'accent' },
  compiling: { label: 'Đang biên dịch Java...', tone: 'accent' },
  running: { label: 'Đang chạy...', tone: 'accent' },
  ready: { label: 'Hoàn tất', tone: 'success' },
  error: { label: 'Có lỗi', tone: 'danger' },
};

function readDraft(problemId: string, language: CodeLanguage): string | null {
  try {
    return window.localStorage.getItem(`${DRAFT_STORAGE_PREFIX}${problemId}:${language}`);
  } catch {
    return null;
  }
}

function writeDraft(problemId: string, language: CodeLanguage, code: string): void {
  try {
    window.localStorage.setItem(`${DRAFT_STORAGE_PREFIX}${problemId}:${language}`, code);
  } catch {
    // Ignore storage quota or private mode restrictions.
  }
}

function clearDraft(problemId: string, language: CodeLanguage): void {
  try {
    window.localStorage.removeItem(`${DRAFT_STORAGE_PREFIX}${problemId}:${language}`);
  } catch {
    // Ignore storage quota or private mode restrictions.
  }
}

function playgroundDraftKey(
  courseId: string,
  lessonId: string | undefined,
  language: CodeLanguage,
): string {
  return `${PLAYGROUND_STORAGE_PREFIX}${courseId}:${lessonId ?? 'general'}:${language}`;
}

function readPlaygroundDraft(
  courseId: string,
  lessonId: string | undefined,
  language: CodeLanguage,
): string | null {
  try {
    return window.localStorage.getItem(playgroundDraftKey(courseId, lessonId, language));
  } catch {
    return null;
  }
}

function writePlaygroundDraft(
  courseId: string,
  lessonId: string | undefined,
  language: CodeLanguage,
  code: string,
): void {
  try {
    window.localStorage.setItem(playgroundDraftKey(courseId, lessonId, language), code);
  } catch {
    // Ignore storage quota or private mode restrictions.
  }
}

function clearPlaygroundDraft(
  courseId: string,
  lessonId: string | undefined,
  language: CodeLanguage,
): void {
  try {
    window.localStorage.removeItem(playgroundDraftKey(courseId, lessonId, language));
  } catch {
    // Ignore storage quota or private mode restrictions.
  }
}

function readSolvedIds(): readonly string[] {
  try {
    const raw = window.localStorage.getItem(SOLVED_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string');
  } catch {
    return [];
  }
}

function writeSolvedIds(ids: readonly string[]): void {
  try {
    window.localStorage.setItem(SOLVED_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Ignore storage quota or private mode restrictions.
  }
}

function resolveInitialProblemCode(problem: CodeProblem, language: CodeLanguage): string {
  const draft = readDraft(problem.id, language);
  if (draft !== null) return draft;
  return problem.starterCode[language] ?? '';
}

function getExecutionStatusLabel(result: CodeExecutionResult): {
  readonly label: string;
  readonly tone: BadgeTone;
} {
  switch (result.status) {
    case 'ok':
      return { label: 'Chạy thành công', tone: 'success' };
    case 'compile-error':
      return { label: 'Lỗi biên dịch', tone: 'danger' };
    case 'runtime-error':
      return { label: 'Lỗi thực thi', tone: 'danger' };
    case 'timeout':
      return { label: 'Quá thời gian', tone: 'warning' };
    case 'cancelled':
      return { label: 'Đã dừng', tone: 'neutral' };
    case 'unavailable':
      return { label: 'Runtime chưa sẵn sàng', tone: 'warning' };
  }
}

export default function CodeLabWorkspace({
  courseId,
  initialPreset,
  lessonId,
  lessonTitle,
  playgroundSnippets,
  injectedSnippet,
  embeddedSurface = 'course',
}: SubjectToolProps) {
  const instanceId = useId();

  const problems = useMemo(() => {
    const matched = codeProblems.filter(problem => problem.courseId === courseId);
    return matched.length > 0 ? matched : codeProblems;
  }, [courseId]);

  const lessonMatchedProblems = useMemo(
    () => (lessonId ? problems.filter(problem => problem.lessonId === lessonId) : []),
    [problems, lessonId],
  );

  const courseDefaultLanguage: CodeLanguage = problems[0]?.defaultLanguage ?? 'java';

  const effectiveSnippets = useMemo<readonly CodePlaygroundSnippet[]>(() => {
    if (playgroundSnippets && playgroundSnippets.length > 0) {
      return playgroundSnippets;
    }
    return buildPlaygroundSnippets({
      scopeId: lessonId ?? courseId,
      defaultLanguage: courseDefaultLanguage,
    });
  }, [playgroundSnippets, lessonId, courseId, courseDefaultLanguage]);

  const initialProblem = useMemo(() => {
    if (initialPreset) {
      const presetMatch = problems.find(problem => problem.id === initialPreset);
      if (presetMatch) return presetMatch;
    }
    if (lessonMatchedProblems[0]) {
      return lessonMatchedProblems[0];
    }
    return problems[0];
  }, [problems, initialPreset, lessonMatchedProblems]);

  const hasDirectProblemMatch = Boolean(
    (initialPreset && problems.some(p => p.id === initialPreset)) ||
      lessonMatchedProblems.length > 0,
  );

  const isContextualExerciseSurface =
    embeddedSurface === 'lesson-exercise' || embeddedSurface === 'practice';

  const defaultMode: WorkspaceMode =
    embeddedSurface === 'practice'
      ? initialPreset && problems.some(p => p.id === initialPreset)
        ? 'problem'
        : 'playground'
      : embeddedSurface === 'lesson-exercise'
        ? hasDirectProblemMatch
          ? 'problem'
          : 'playground'
        : 'problem';

  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>(defaultMode);

  // Problem-mode state
  const [selectedProblemId, setSelectedProblemId] = useState<string>(initialProblem?.id ?? '');
  const selectedProblem = useMemo(
    () => problems.find(problem => problem.id === selectedProblemId) ?? problems[0],
    [problems, selectedProblemId],
  );
  const [problemLanguage, setProblemLanguage] = useState<CodeLanguage>(
    selectedProblem?.defaultLanguage ?? courseDefaultLanguage,
  );
  const [problemCode, setProblemCode] = useState<string>(() =>
    selectedProblem
      ? resolveInitialProblemCode(selectedProblem, selectedProblem.defaultLanguage)
      : '',
  );
  const [problemStdin, setProblemStdin] = useState<string>(
    () => selectedProblem?.testCases[0]?.stdin ?? '',
  );

  // Playground-mode state
  const initialSnippet = effectiveSnippets[0];
  const initialPgLanguage = initialSnippet?.language ?? courseDefaultLanguage;
  const [selectedSnippetId, setSelectedSnippetId] = useState<string>(initialSnippet?.id ?? '');
  const [pgLanguage, setPgLanguage] = useState<CodeLanguage>(initialPgLanguage);
  const [pgCode, setPgCode] = useState<string>(
    () =>
      readPlaygroundDraft(courseId, lessonId, initialPgLanguage) ??
      initialSnippet?.code ??
      getStarterTemplate(initialPgLanguage),
  );
  const [pgStdin, setPgStdin] = useState<string>('');
  const [injectedLabel, setInjectedLabel] = useState<string | null>(null);

  const [hintsOpen, setHintsOpen] = useState(false);
  const [solvedIds, setSolvedIds] = useState<readonly string[]>(() => readSolvedIds());

  const [isRunning, setIsRunning] = useState(false);
  const [stage, setStage] = useState<RuntimeStage>('idle');
  const [stageMessage, setStageMessage] = useState<string | undefined>(undefined);
  const [runResult, setRunResult] = useState<CodeExecutionResult | null>(null);
  const [judgeSummary, setJudgeSummary] = useState<JudgeSummary | null>(null);

  const pyodideRunnerRef = useRef<WasmCodeRunner | null>(null);
  const cheerpjRunnerRef = useRef<WasmCodeRunner | null>(null);
  const activeRunnerRef = useRef<WasmCodeRunner | null>(null);
  const runSessionRef = useRef(0);
  const hydratedSnippetScopeRef = useRef<string | null>(null);
  const lastInjectedNonceRef = useRef<number | null>(null);

  useEffect(() => {
    setWorkspaceMode(defaultMode);
  }, [defaultMode, courseId, lessonId]);

  useEffect(() => {
    if (!initialProblem) return;
    setSelectedProblemId(initialProblem.id);
    const nextLang = initialProblem.defaultLanguage;
    setProblemLanguage(nextLang);
    setProblemCode(resolveInitialProblemCode(initialProblem, nextLang));
    setProblemStdin(initialProblem.testCases[0]?.stdin ?? '');
    setRunResult(null);
    setJudgeSummary(null);
    setStage('idle');
    setStageMessage(undefined);
  }, [initialProblem]);

  // Refresh playground starter when async lesson/exercise snippets finish loading (if no saved user draft exists)
  useEffect(() => {
    const first = effectiveSnippets[0];
    if (!first) return;
    const scopeSignature = `${courseId}:${lessonId ?? 'general'}:${first.id}`;
    if (hydratedSnippetScopeRef.current === scopeSignature) return;
    hydratedSnippetScopeRef.current = scopeSignature;

    setSelectedSnippetId(first.id);
    const existingDraft = readPlaygroundDraft(courseId, lessonId, first.language);
    setPgLanguage(first.language);
    setPgCode(existingDraft ?? first.code);
  }, [effectiveSnippets, courseId, lessonId]);

  // Handle 1-click snippet injection from exercise cards
  useEffect(() => {
    if (!injectedSnippet || injectedSnippet.nonce === lastInjectedNonceRef.current) {
      return;
    }
    lastInjectedNonceRef.current = injectedSnippet.nonce;
    runSessionRef.current += 1;
    activeRunnerRef.current?.cancel();
    activeRunnerRef.current = null;
    setIsRunning(false);

    setWorkspaceMode('playground');
    setPgLanguage(injectedSnippet.language);
    setPgCode(injectedSnippet.code);
    writePlaygroundDraft(courseId, lessonId, injectedSnippet.language, injectedSnippet.code);
    setInjectedLabel(injectedSnippet.label);
    setRunResult(null);
    setJudgeSummary(null);
    setStage('idle');
    setStageMessage(undefined);
  }, [injectedSnippet, courseId, lessonId]);

  useEffect(() => {
    return () => {
      runSessionRef.current += 1;
      pyodideRunnerRef.current?.dispose();
      cheerpjRunnerRef.current?.dispose();
      pyodideRunnerRef.current = null;
      cheerpjRunnerRef.current = null;
      activeRunnerRef.current = null;
    };
  }, []);

  if (!selectedProblem && workspaceMode === 'problem') {
    return (
      <section className="rounded-[var(--radius-xl)] border border-border bg-surface p-6 text-sm text-ink-secondary">
        Chưa có bài tập lập trình nào cho học phần này.
      </section>
    );
  }

  const activeLanguage = workspaceMode === 'playground' ? pgLanguage : problemLanguage;
  const activeCode = workspaceMode === 'playground' ? pgCode : problemCode;
  const activeStdin = workspaceMode === 'playground' ? pgStdin : problemStdin;

  const getRunner = (targetLanguage: CodeLanguage): WasmCodeRunner => {
    if (targetLanguage === 'java') {
      if (!cheerpjRunnerRef.current) {
        cheerpjRunnerRef.current = createCheerpJRunner();
      }
      return cheerpjRunnerRef.current;
    }
    if (!pyodideRunnerRef.current) {
      pyodideRunnerRef.current = createPyodideRunner();
    }
    return pyodideRunnerRef.current;
  };

  const abortActiveExecution = () => {
    runSessionRef.current += 1;
    activeRunnerRef.current?.cancel();
    activeRunnerRef.current = null;
    setIsRunning(false);
    setRunResult(null);
    setJudgeSummary(null);
    setStage('idle');
    setStageMessage(undefined);
  };

  const handleSwitchMode = (nextMode: WorkspaceMode) => {
    if (nextMode === workspaceMode) return;
    abortActiveExecution();
    setWorkspaceMode(nextMode);
  };

  const handleSelectProblem = (nextProblemId: string) => {
    const nextProblem = problems.find(problem => problem.id === nextProblemId);
    if (!nextProblem) return;
    abortActiveExecution();

    setSelectedProblemId(nextProblem.id);
    const nextLanguage = nextProblem.supportedLanguages.includes(problemLanguage)
      ? problemLanguage
      : nextProblem.defaultLanguage;
    setProblemLanguage(nextLanguage);
    setProblemCode(resolveInitialProblemCode(nextProblem, nextLanguage));
    setProblemStdin(nextProblem.testCases[0]?.stdin ?? '');
    setHintsOpen(false);
  };

  const handleSelectSnippet = (nextSnippetId: string) => {
    const found = effectiveSnippets.find(s => s.id === nextSnippetId);
    if (!found) return;
    abortActiveExecution();
    setSelectedSnippetId(found.id);
    setInjectedLabel(null);
    setPgLanguage(found.language);
    setPgCode(found.code);
    writePlaygroundDraft(courseId, lessonId, found.language, found.code);
  };

  const handleSelectLanguage = (nextLanguage: CodeLanguage) => {
    if (nextLanguage === activeLanguage) return;
    if (workspaceMode === 'problem') {
      if (!selectedProblem || !selectedProblem.supportedLanguages.includes(nextLanguage)) return;
      abortActiveExecution();
      setProblemLanguage(nextLanguage);
      setProblemCode(resolveInitialProblemCode(selectedProblem, nextLanguage));
      return;
    }

    abortActiveExecution();
    setInjectedLabel(null);
    setPgLanguage(nextLanguage);
    const saved = readPlaygroundDraft(courseId, lessonId, nextLanguage);
    const matchingSnippet = effectiveSnippets.find(s => s.language === nextLanguage);
    if (matchingSnippet) {
      setSelectedSnippetId(matchingSnippet.id);
    }
    setPgCode(saved ?? matchingSnippet?.code ?? getStarterTemplate(nextLanguage));
  };

  const handleCodeChange = (nextCode: string) => {
    if (workspaceMode === 'playground') {
      setPgCode(nextCode);
      writePlaygroundDraft(courseId, lessonId, pgLanguage, nextCode);
    } else if (selectedProblem) {
      setProblemCode(nextCode);
      writeDraft(selectedProblem.id, problemLanguage, nextCode);
    }
  };

  const handleStdinChange = (nextStdin: string) => {
    if (workspaceMode === 'playground') {
      setPgStdin(nextStdin);
    } else {
      setProblemStdin(nextStdin);
    }
  };

  const handleReset = () => {
    abortActiveExecution();
    if (workspaceMode === 'playground') {
      clearPlaygroundDraft(courseId, lessonId, pgLanguage);
      setInjectedLabel(null);
      const currentSnippet = effectiveSnippets.find(
        s => s.id === selectedSnippetId && s.language === pgLanguage,
      );
      const fallbackSnippet = effectiveSnippets.find(s => s.language === pgLanguage);
      const starter =
        currentSnippet?.code ?? fallbackSnippet?.code ?? getStarterTemplate(pgLanguage);
      setPgCode(starter);
      return;
    }

    if (!selectedProblem) return;
    clearDraft(selectedProblem.id, problemLanguage);
    const starter = selectedProblem.starterCode[problemLanguage] ?? '';
    setProblemCode(starter);
  };

  const handleStop = () => {
    runSessionRef.current += 1;
    activeRunnerRef.current?.cancel();
    activeRunnerRef.current = null;
    setIsRunning(false);
    setStage('idle');
    setStageMessage('Đã dừng thực thi theo yêu cầu.');
  };

  const handleRunCustom = async () => {
    const session = ++runSessionRef.current;
    const runner = getRunner(activeLanguage);
    activeRunnerRef.current = runner;
    setIsRunning(true);
    setJudgeSummary(null);
    setRunResult(null);
    setStage('loading');
    setStageMessage(undefined);

    const fallbackJavaClass =
      workspaceMode === 'problem' ? (selectedProblem?.javaClassName ?? 'Main') : 'Main';
    const javaClassName =
      activeLanguage === 'java'
        ? extractJavaMainClassName(activeCode, fallbackJavaClass)
        : undefined;

    try {
      const result = await runner.run(activeCode, {
        stdin: activeStdin,
        ...(javaClassName !== undefined ? { javaClassName } : {}),
        onStage: (nextStage, message) => {
          if (runSessionRef.current !== session) return;
          setStage(nextStage);
          setStageMessage(message);
        },
      });
      if (runSessionRef.current !== session) return;
      setRunResult(result);
      setStage(
        result.status === 'ok' ? 'ready' : result.status === 'cancelled' ? 'idle' : 'error',
      );
    } catch (error) {
      if (runSessionRef.current !== session) return;
      const message = error instanceof Error ? error.message : 'Không thể thực thi mã nguồn.';
      setRunResult({
        status: 'unavailable',
        stdout: '',
        stderr: '',
        durationMs: 0,
        errorMessage: message,
      });
      setStage('error');
    } finally {
      if (runSessionRef.current === session) {
        activeRunnerRef.current = null;
        setIsRunning(false);
      }
    }
  };

  const handleJudgeAll = async () => {
    if (workspaceMode !== 'problem' || !selectedProblem) return;
    const session = ++runSessionRef.current;
    const runner = getRunner(problemLanguage);
    activeRunnerRef.current = runner;
    setIsRunning(true);
    setRunResult(null);
    setJudgeSummary(null);
    setStage('loading');
    setStageMessage(undefined);

    const javaClassName =
      problemLanguage === 'java'
        ? extractJavaMainClassName(problemCode, selectedProblem.javaClassName ?? 'Main')
        : undefined;

    const verdicts: TestCaseVerdict[] = [];

    try {
      for (let i = 0; i < selectedProblem.testCases.length; i += 1) {
        if (runSessionRef.current !== session) return;
        const testCase = selectedProblem.testCases[i];
        if (!testCase) continue;

        setStageMessage(
          `Đang chấm ${testCase.label} (${i + 1}/${selectedProblem.testCases.length})`,
        );

        const result = await runner.run(problemCode, {
          stdin: testCase.stdin,
          ...(javaClassName !== undefined ? { javaClassName } : {}),
          onStage: (nextStage, message) => {
            if (runSessionRef.current !== session) return;
            setStage(nextStage);
            if (message) setStageMessage(message);
          },
        });

        if (runSessionRef.current !== session) return;
        verdicts.push(judgeTestCase(testCase, result));

        if (result.status === 'cancelled' || result.status === 'unavailable') {
          break;
        }
      }

      if (runSessionRef.current !== session) return;
      const summary = summarizeJudge(verdicts);
      setJudgeSummary(summary);
      setStage(summary.allPassed ? 'ready' : 'error');
      setStageMessage(
        summary.allPassed
          ? `Đạt tất cả ${summary.total}/${summary.total} test case.`
          : `Đạt ${summary.passed}/${summary.total} test case.`,
      );

      if (summary.allPassed && !solvedIds.includes(selectedProblem.id)) {
        const nextSolved = [...solvedIds, selectedProblem.id];
        setSolvedIds(nextSolved);
        writeSolvedIds(nextSolved);
      }
    } catch (error) {
      if (runSessionRef.current !== session) return;
      const message = error instanceof Error ? error.message : 'Không thể chấm bài.';
      setRunResult({
        status: 'unavailable',
        stdout: '',
        stderr: '',
        durationMs: 0,
        errorMessage: message,
      });
      setStage('error');
    } finally {
      if (runSessionRef.current === session) {
        activeRunnerRef.current = null;
        setIsRunning(false);
      }
    }
  };

  const stageMeta = STAGE_META[stage];
  const solvedCountInCourse = problems.filter(problem => solvedIds.includes(problem.id)).length;

  const languageSwitcher = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div
        role="group"
        aria-label="Chọn ngôn ngữ lập trình"
        className="inline-flex flex-wrap items-center gap-1.5 rounded-[var(--radius-lg)] border border-border bg-surface-subtle p-1"
      >
        {(['python', 'java'] as const).map(lang => {
          const supported =
            workspaceMode === 'playground'
              ? true
              : Boolean(selectedProblem?.supportedLanguages.includes(lang));
          const active = activeLanguage === lang;
          return (
            <button
              key={lang}
              type="button"
              disabled={!supported}
              aria-pressed={active}
              onClick={() => handleSelectLanguage(lang)}
              className={`min-h-[40px] rounded-[var(--radius-md)] px-3 py-1.5 text-xs font-semibold transition-colors ${
                active
                  ? 'bg-accent-solid text-white'
                  : supported
                    ? 'text-ink-secondary hover:bg-surface-hover hover:text-ink'
                    : 'cursor-not-allowed text-ink-muted opacity-50'
              }`}
            >
              {LANGUAGE_LABELS[lang]}
            </button>
          );
        })}
      </div>

      <div role="status" aria-live="polite" className="flex flex-wrap items-center gap-2">
        <Badge tone={stageMeta.tone}>{stageMeta.label}</Badge>
        {stageMessage && <span className="text-xs text-ink-muted">{stageMessage}</span>}
      </div>
    </div>
  );

  const actionToolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={isRunning}
        onClick={handleRunCustom}
        className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-[var(--radius-md)] px-3.5 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-55 ${
          workspaceMode === 'playground'
            ? 'bg-accent-solid text-white hover:bg-accent-solid-hover'
            : 'border border-border-strong bg-surface font-medium text-ink hover:bg-surface-hover'
        }`}
      >
        <PlayIcon
          width={15}
          height={15}
          className={workspaceMode === 'playground' ? 'text-white' : 'text-accent'}
        />
        <span>Chạy thử</span>
      </button>

      {workspaceMode === 'problem' && (
        <button
          type="button"
          disabled={isRunning}
          onClick={handleJudgeAll}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-[var(--radius-md)] bg-accent-solid px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-solid-hover disabled:cursor-not-allowed disabled:opacity-55"
        >
          <CheckCircleIcon width={15} height={15} />
          <span>Chấm Test Case</span>
        </button>
      )}

      <button
        type="button"
        disabled={!isRunning}
        onClick={handleStop}
        className="inline-flex min-h-[40px] items-center gap-1.5 rounded-[var(--radius-md)] border border-border bg-surface px-3.5 py-2 text-sm font-medium text-danger transition-colors hover:bg-danger-subtle disabled:cursor-not-allowed disabled:opacity-45"
      >
        <span>Dừng</span>
      </button>

      <button
        type="button"
        onClick={handleReset}
        className="ml-auto inline-flex min-h-[40px] items-center gap-1.5 rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 text-sm font-medium text-ink-secondary transition-colors hover:bg-surface-hover hover:text-ink"
      >
        <RotateCcwIcon width={15} height={15} />
        <span>Đặt lại</span>
      </button>
    </div>
  );

  const stdinBox = (
    <div className="min-w-0">
      <label
        htmlFor={`${instanceId}-custom-stdin`}
        className="block text-xs font-medium text-ink-secondary"
      >
        Dữ liệu đầu vào tùy chỉnh (stdin)
      </label>
      <textarea
        id={`${instanceId}-custom-stdin`}
        rows={3}
        value={activeStdin}
        onChange={event => handleStdinChange(event.target.value)}
        placeholder="Nhập dữ liệu đầu vào khi bấm Chạy thử..."
        className="mt-1.5 w-full rounded-[var(--radius-md)] border border-border bg-surface-subtle p-2.5 font-mono text-xs text-ink placeholder:text-ink-muted focus:border-accent focus:outline-2 focus:outline-accent"
      />
    </div>
  );

  const outputConsole = (
    <div
      role="status"
      aria-live="polite"
      className="min-w-0 space-y-3 rounded-[var(--radius-lg)] border border-border bg-surface-subtle p-3.5"
    >
      {!runResult && !judgeSummary && (
        <p className="text-xs text-ink-muted">
          {workspaceMode === 'playground' ? (
            <>
              Sửa code trực tiếp ở khung soạn thảo rồi bấm <strong>Chạy thử</strong> để kiểm chứng kết quả ngay trên trang bài tập.
            </>
          ) : (
            <>
              Bấm <strong>Chạy thử</strong> để kiểm tra với stdin tùy chỉnh hoặc{' '}
              <strong>Chấm Test Case</strong> để kiểm tra toàn bộ bộ test.
            </>
          )}
        </p>
      )}

      {runResult && (
        <div className="min-w-0 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Badge tone={getExecutionStatusLabel(runResult).tone}>
              {getExecutionStatusLabel(runResult).label}
            </Badge>
            <span className="font-mono text-xs tabular-nums text-ink-muted">
              {runResult.durationMs} ms
            </span>
          </div>

          {runResult.errorMessage && (
            <div className="flex items-start gap-2 rounded-[var(--radius-md)] border border-danger/25 bg-danger-subtle p-2.5 text-xs text-danger">
              <AlertCircleIcon width={15} height={15} className="mt-0.5 shrink-0" />
              <span>{runResult.errorMessage}</span>
            </div>
          )}

          <div className="min-w-0">
            <div className="text-xs font-medium text-ink-secondary">Stdout</div>
            <pre className="mt-1 overflow-x-auto rounded-[var(--radius-md)] border border-border bg-surface p-2.5 font-mono text-xs text-ink">
              {runResult.stdout || '(không có kết quả in ra)'}
            </pre>
          </div>

          {runResult.stderr && (
            <div className="min-w-0">
              <div className="text-xs font-medium text-danger">Stderr</div>
              <pre className="mt-1 overflow-x-auto rounded-[var(--radius-md)] border border-danger/25 bg-danger-subtle p-2.5 font-mono text-xs text-danger">
                {runResult.stderr}
              </pre>
            </div>
          )}
        </div>
      )}

      {judgeSummary && selectedProblem && (
        <div className="min-w-0 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Badge tone={judgeSummary.allPassed ? 'success' : 'danger'}>
                {judgeSummary.allPassed ? 'Đạt toàn bộ' : 'Chưa đạt hết'}
              </Badge>
              <span className="font-mono text-xs font-semibold tabular-nums text-ink">
                {judgeSummary.passed}/{judgeSummary.total} test case
              </span>
            </div>
          </div>

          <div className="space-y-2">
            {judgeSummary.verdicts.map((verdict, index) => {
              const sourceTestCase = selectedProblem.testCases[index];
              const isHidden = Boolean(sourceTestCase?.hidden);
              return (
                <div
                  key={verdict.testCaseId}
                  className={`min-w-0 rounded-[var(--radius-md)] border p-2.5 ${
                    verdict.passed
                      ? 'border-success/25 bg-success-subtle/60'
                      : 'border-danger/25 bg-danger-subtle/60'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge tone={verdict.passed ? 'success' : 'danger'}>
                        {verdict.passed ? 'Đạt' : 'Chưa đạt'}
                      </Badge>
                      <span className="text-xs font-semibold text-ink">{verdict.label}</span>
                    </div>
                    <span className="font-mono text-[11px] tabular-nums text-ink-muted">
                      {verdict.durationMs} ms
                    </span>
                  </div>

                  {verdict.errorMessage && (
                    <p className="mt-1.5 text-xs text-danger">{verdict.errorMessage}</p>
                  )}

                  {!verdict.passed && !isHidden && (
                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-ink-secondary">Kỳ vọng</div>
                        <pre className="mt-0.5 overflow-x-auto rounded-[var(--radius-sm)] border border-border bg-surface p-2 font-mono text-xs text-ink">
                          {verdict.expectedOutput || '(trống)'}
                        </pre>
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-ink-secondary">Thực tế</div>
                        <pre className="mt-0.5 overflow-x-auto rounded-[var(--radius-sm)] border border-border bg-surface p-2 font-mono text-xs text-ink">
                          {verdict.actualOutput || '(trống)'}
                        </pre>
                      </div>
                    </div>
                  )}

                  {!verdict.passed && isHidden && (
                    <p className="mt-1.5 text-xs text-ink-secondary">
                      Test case ẩn: đầu ra chưa khớp kỳ vọng ({verdict.status}).
                    </p>
                  )}

                  {verdict.stderr && (
                    <pre className="mt-2 overflow-x-auto rounded-[var(--radius-sm)] border border-danger/25 bg-surface p-2 font-mono text-xs text-danger">
                      {verdict.stderr}
                    </pre>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <section
      aria-label="Phòng thực hành lập trình"
      className="min-w-0 space-y-4 rounded-[var(--radius-xl)] border border-border bg-surface p-4 sm:p-5"
    >
      {isContextualExerciseSurface && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3.5">
          <div className="min-w-0 space-y-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display text-base font-semibold text-ink sm:text-lg">
                Khung code thực hành tại chỗ
              </h3>
              {lessonMatchedProblems.length > 0 && (
                <Badge tone="accent">Có đề chấm tự động cho bài này</Badge>
              )}
              {injectedLabel && workspaceMode === 'playground' && (
                <Badge tone="success">Đã nạp: {injectedLabel}</Badge>
              )}
            </div>
            <p className="text-xs text-ink-secondary">
              {workspaceMode === 'playground'
                ? 'Soạn và chạy thử Java / Python ngay cạnh câu hỏi để kiểm chứng mà không cần chuyển tab.'
                : 'Viết lời giải và chấm trực tiếp với bộ test case tự động ngay trong bài học.'}
            </p>
          </div>

          <div
            role="group"
            aria-label="Chế độ thực hành code"
            className="inline-flex flex-wrap items-center gap-1 rounded-[var(--radius-lg)] border border-border bg-surface-subtle p-1"
          >
            <button
              type="button"
              aria-pressed={workspaceMode === 'playground'}
              onClick={() => handleSwitchMode('playground')}
              className={`min-h-[36px] rounded-[var(--radius-md)] px-3 py-1.5 text-xs font-semibold transition-colors ${
                workspaceMode === 'playground'
                  ? 'bg-surface text-accent-ink'
                  : 'text-ink-secondary hover:text-ink'
              }`}
            >
              Bàn nháp chạy thử
            </button>
            <button
              type="button"
              aria-pressed={workspaceMode === 'problem'}
              onClick={() => handleSwitchMode('problem')}
              className={`min-h-[36px] rounded-[var(--radius-md)] px-3 py-1.5 text-xs font-semibold transition-colors ${
                workspaceMode === 'problem'
                  ? 'bg-surface text-accent-ink'
                  : 'text-ink-secondary hover:text-ink'
              }`}
            >
              {lessonMatchedProblems.length > 0
                ? 'Bài tập chấm Test Case'
                : `Kho đề chấm Test Case (${problems.length})`}
            </button>
          </div>
        </div>
      )}

      {workspaceMode === 'playground' ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <div className="min-w-0 space-y-3.5 lg:col-span-7">
            {languageSwitcher}

            <CodeEditor
              value={pgCode}
              language={pgLanguage}
              onChange={handleCodeChange}
              ariaLabel={`Bàn nháp ${LANGUAGE_LABELS[pgLanguage]}${lessonTitle ? ` cho bài ${lessonTitle}` : ''}`}
              minHeight="280px"
            />

            {pgLanguage === 'java' && (
              <p className="text-xs text-ink-muted">
                Biên dịch &amp; chạy Java trực tiếp trên trình duyệt qua WebAssembly (CheerpJ).
              </p>
            )}

            {actionToolbar}
          </div>

          <div className="min-w-0 space-y-4 lg:col-span-5">
            <div className="rounded-[var(--radius-lg)] border border-border bg-surface-subtle p-3.5">
              <label
                htmlFor={`${instanceId}-snippet-select`}
                className="block text-xs font-medium text-ink-secondary"
              >
                Nạp nhanh mẫu mã nguồn ({effectiveSnippets.length} mẫu)
              </label>
              <select
                id={`${instanceId}-snippet-select`}
                value={selectedSnippetId}
                onChange={event => handleSelectSnippet(event.target.value)}
                className="mt-2 min-h-[40px] w-full rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 text-sm font-medium text-ink transition-colors focus:border-accent focus:outline-2 focus:outline-accent"
              >
                {effectiveSnippets.map(snippet => (
                  <option key={snippet.id} value={snippet.id}>
                    {snippet.label}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-ink-muted">
                Bản nháp của bạn được lưu tự động trên trình duyệt theo từng bài học.
              </p>
            </div>

            {stdinBox}
            {outputConsole}
          </div>
        </div>
      ) : selectedProblem ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Left column (~40%): Problem selector, statement, hints, sample I/O */}
          <div className="min-w-0 space-y-4 lg:col-span-5">
            <div className="rounded-[var(--radius-lg)] border border-border bg-surface-subtle p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label
                  htmlFor={`${instanceId}-problem-select`}
                  className="text-xs font-medium text-ink-secondary"
                >
                  Bài tập ({solvedCountInCourse}/{problems.length} đã đạt)
                </label>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={DIFFICULTY_META[selectedProblem.difficulty].tone}>
                    {DIFFICULTY_META[selectedProblem.difficulty].label}
                  </Badge>
                  {solvedIds.includes(selectedProblem.id) && (
                    <Badge tone="success">
                      <CheckCircleIcon width={12} height={12} />
                      <span>Đã đạt</span>
                    </Badge>
                  )}
                </div>
              </div>

              <select
                id={`${instanceId}-problem-select`}
                value={selectedProblem.id}
                onChange={event => handleSelectProblem(event.target.value)}
                className="mt-2 min-h-[40px] w-full rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 text-sm font-medium text-ink transition-colors focus:border-accent focus:outline-2 focus:outline-accent"
              >
                {problems.map((problem, index) => {
                  const donePrefix = solvedIds.includes(problem.id) ? '✓ ' : '';
                  const lessonTag =
                    lessonId && problem.lessonId === lessonId ? '[Bài học này] ' : '';
                  return (
                    <option key={problem.id} value={problem.id}>
                      {donePrefix}
                      {lessonTag}
                      {index + 1}. {problem.title} ({problem.chapterLabel})
                    </option>
                  );
                })}
              </select>

              <p className="mt-2 text-xs text-ink-muted">
                {selectedProblem.chapterLabel} · {selectedProblem.summary}
              </p>
            </div>

            <article className="min-w-0 rounded-[var(--radius-lg)] border border-border bg-surface p-4">
              <h3 className="font-display text-lg font-semibold text-ink">
                {selectedProblem.title}
              </h3>
              <div className="academic-prose mt-3 text-sm leading-relaxed text-ink-secondary">
                <Markdown>{selectedProblem.promptMarkdown}</Markdown>
              </div>
            </article>

            {selectedProblem.hints.length > 0 && (
              <div className="rounded-[var(--radius-lg)] border border-border bg-surface-subtle">
                <button
                  type="button"
                  aria-expanded={hintsOpen}
                  onClick={() => setHintsOpen(prev => !prev)}
                  className="flex min-h-[40px] w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm font-medium text-ink transition-colors hover:bg-surface-hover"
                >
                  <span>Gợi ý hướng giải ({selectedProblem.hints.length})</span>
                  <ChevronDownIcon
                    width={16}
                    height={16}
                    className={`shrink-0 text-ink-muted transition-transform ${hintsOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {hintsOpen && (
                  <ul className="space-y-2 border-t border-border px-4 py-3 text-sm text-ink-secondary">
                    {selectedProblem.hints.map((hint, idx) => (
                      <li key={idx} className="flex gap-2">
                        <span className="font-mono text-xs font-semibold tabular-nums text-accent">
                          {idx + 1}.
                        </span>
                        <span className="min-w-0 flex-1 [&_.katex-display]:overflow-x-auto">
                          <Markdown inline>{hint}</Markdown>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {selectedProblem.testCases.some(tc => !tc.hidden) && (
              <div className="min-w-0 space-y-2.5">
                <h4 className="text-sm font-semibold text-ink">Ví dụ vào / ra</h4>
                {selectedProblem.testCases
                  .filter(testCase => !testCase.hidden)
                  .map(testCase => (
                    <div
                      key={testCase.id}
                      className="min-w-0 rounded-[var(--radius-lg)] border border-border bg-surface-subtle p-3"
                    >
                      <div className="text-xs font-medium text-ink-secondary">{testCase.label}</div>
                      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-ink-secondary">Input</div>
                          <pre className="mt-1 overflow-x-auto rounded-[var(--radius-sm)] border border-border bg-surface p-2 font-mono text-xs text-ink">
                            {testCase.stdin || '(trống)'}
                          </pre>
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-ink-secondary">
                            Output kỳ vọng
                          </div>
                          <pre className="mt-1 overflow-x-auto rounded-[var(--radius-sm)] border border-border bg-surface p-2 font-mono text-xs text-ink">
                            {testCase.expectedOutput || '(trống)'}
                          </pre>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Right column (~60%): Language switcher, CodeMirror 6, action bar, stdin, console/verdicts */}
          <div className="min-w-0 space-y-3.5 lg:col-span-7">
            {languageSwitcher}

            <CodeEditor
              value={problemCode}
              language={problemLanguage}
              onChange={handleCodeChange}
              ariaLabel={`Trình soạn thảo ${LANGUAGE_LABELS[problemLanguage]} cho bài ${selectedProblem.title}`}
              minHeight="340px"
            />

            {problemLanguage === 'java' && (
              <p className="text-xs text-ink-muted">
                Biên dịch &amp; chạy Java trên trình duyệt qua WebAssembly (Built with CheerpJ).
              </p>
            )}

            {actionToolbar}
            {stdinBox}
            {outputConsole}
          </div>
        </div>
      ) : null}
    </section>
  );
}
