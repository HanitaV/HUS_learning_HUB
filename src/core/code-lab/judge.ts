import type {
  CodeExecutionResult,
  CodeTestCase,
  JudgeSummary,
  TestCaseVerdict,
} from '../../domain/code-lab';

/**
 * Normalizes program output for deterministic test case comparison:
 * converts CRLF/CR to LF, trims trailing horizontal whitespace per line,
 * and strips trailing blank lines.
 */
export function normalizeOutput(raw: string): string {
  const lines = raw
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, ''));

  while (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }

  return lines.join('\n');
}

/**
 * Judges a single test case against an execution result.
 */
export function judgeTestCase(
  testCase: CodeTestCase,
  execResult: CodeExecutionResult,
): TestCaseVerdict {
  const expectedOutput = normalizeOutput(testCase.expectedOutput);
  const actualOutput = normalizeOutput(execResult.stdout);
  const passed = execResult.status === 'ok' && actualOutput === expectedOutput;

  return {
    testCaseId: testCase.id,
    label: testCase.label,
    passed,
    status: execResult.status,
    stdin: testCase.stdin,
    expectedOutput,
    actualOutput,
    stderr: execResult.stderr,
    durationMs: execResult.durationMs,
    ...(execResult.errorMessage !== undefined
      ? { errorMessage: execResult.errorMessage }
      : {}),
  };
}

/**
 * Aggregates individual test case verdicts into an overall judge summary.
 */
export function summarizeJudge(
  verdicts: readonly TestCaseVerdict[],
): JudgeSummary {
  const total = verdicts.length;
  const passed = verdicts.filter((verdict) => verdict.passed).length;

  return {
    total,
    passed,
    allPassed: total > 0 && passed === total,
    verdicts,
  };
}

/**
 * Extracts the main class name from Java source code, ignoring comments.
 * Prefers `public class <Name>`, falls back to `class <Name>`, and returns
 * `fallback` (default `'Main'`) if no class declaration is found.
 */
export function extractJavaMainClassName(
  code: string,
  fallback = 'Main',
): string {
  const withoutComments = code
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\r\n]*/g, ' ');

  const publicMatch = /\bpublic\s+(?:(?:final|abstract|strictfp)\s+)*class\s+([A-Za-z_$][A-Za-z0-9_$]*)/.exec(
    withoutComments,
  );
  if (publicMatch?.[1]) {
    return publicMatch[1];
  }

  const classRegex = /\bclass\s+([A-Za-z_$][A-Za-z0-9_$]*)/g;
  const candidates: { readonly name: string; readonly index: number }[] = [];
  let match: RegExpExecArray | null = classRegex.exec(withoutComments);
  while (match !== null) {
    if (match[1]) {
      candidates.push({ name: match[1], index: match.index });
    }
    match = classRegex.exec(withoutComments);
  }

  for (let i = 0; i < candidates.length; i += 1) {
    const current = candidates[i]!;
    const nextIndex = candidates[i + 1]?.index ?? withoutComments.length;
    const slice = withoutComments.slice(current.index, nextIndex);
    if (/\bvoid\s+main\s*\(/.test(slice)) {
      return current.name;
    }
  }

  if (candidates[0]) {
    return candidates[0].name;
  }

  return fallback;
}
