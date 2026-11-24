import { describe, expect, it } from 'vitest';
import {
  extractJavaMainClassName,
  judgeTestCase,
  normalizeOutput,
  summarizeJudge,
} from '../../src/core/code-lab/judge';
import type {
  CodeExecutionResult,
  CodeTestCase,
} from '../../src/domain/code-lab';

describe('normalizeOutput', () => {
  it('normalizes CRLF to LF, trims trailing line whitespace, and strips trailing blank lines', () => {
    const raw = '  hello   \r\n\r\nworld\t \r\n\r\n   \r\n';
    expect(normalizeOutput(raw)).toBe('  hello\n\nworld');
  });

  it('returns empty string for whitespace-only or empty output', () => {
    expect(normalizeOutput('')).toBe('');
    expect(normalizeOutput('   \r\n\t\n  ')).toBe('');
  });
});

describe('judgeTestCase & summarizeJudge', () => {
  const testCase: CodeTestCase = {
    id: 'tc-1',
    label: 'Sample 1',
    stdin: '2 3\n',
    expectedOutput: '5\n',
  };

  it('passes when status is ok and normalized outputs match', () => {
    const execResult: CodeExecutionResult = {
      status: 'ok',
      stdout: '5  \r\n\r\n',
      stderr: '',
      durationMs: 12,
    };

    const verdict = judgeTestCase(testCase, execResult);
    expect(verdict.passed).toBe(true);
    expect(verdict.actualOutput).toBe('5');
    expect(verdict.expectedOutput).toBe('5');
    expect(verdict.errorMessage).toBeUndefined();
  });

  it('fails when execution status is not ok even if stdout matches', () => {
    const execResult: CodeExecutionResult = {
      status: 'runtime-error',
      stdout: '5\n',
      stderr: 'ZeroDivisionError',
      durationMs: 25,
      errorMessage: 'Process exited with code 1',
    };

    const verdict = judgeTestCase(testCase, execResult);
    expect(verdict.passed).toBe(false);
    expect(verdict.status).toBe('runtime-error');
    expect(verdict.errorMessage).toBe('Process exited with code 1');
  });

  it('summarizes verdicts accurately', () => {
    const passVerdict = judgeTestCase(testCase, {
      status: 'ok',
      stdout: '5',
      stderr: '',
      durationMs: 10,
    });
    const failVerdict = judgeTestCase(
      { ...testCase, id: 'tc-2', label: 'Sample 2' },
      {
        status: 'ok',
        stdout: '6',
        stderr: '',
        durationMs: 11,
      },
    );

    const partial = summarizeJudge([passVerdict, failVerdict]);
    expect(partial.total).toBe(2);
    expect(partial.passed).toBe(1);
    expect(partial.allPassed).toBe(false);

    const allOk = summarizeJudge([passVerdict]);
    expect(allOk.total).toBe(1);
    expect(allOk.passed).toBe(1);
    expect(allOk.allPassed).toBe(true);

    const empty = summarizeJudge([]);
    expect(empty.total).toBe(0);
    expect(empty.passed).toBe(0);
    expect(empty.allPassed).toBe(false);
  });
});

describe('extractJavaMainClassName', () => {
  it('prefers public class over non-public helper classes', () => {
    const code = `
      class Helper {}
      public class BinarySearch {
        public static void main(String[] args) {}
      }
    `;
    expect(extractJavaMainClassName(code)).toBe('BinarySearch');
  });

  it('falls back to non-public class when no public class exists', () => {
    const code = `
      class Solution {
        public static void main(String[] args) {}
      }
    `;
    expect(extractJavaMainClassName(code)).toBe('Solution');
  });

  it('ignores class names inside comments and falls back to default', () => {
    const code = `
      // public class CommentedOut {}
      /* class AlsoCommented {} */
      // nothing here
    `;
    expect(extractJavaMainClassName(code)).toBe('Main');
    expect(extractJavaMainClassName(code, 'App')).toBe('App');
  });
});
