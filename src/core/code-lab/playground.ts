import type { CodeLanguage, CodePlaygroundSnippet } from '../../domain/code-lab';
import { extractCodeBlocksFromMarkdown } from '../learning/code-walkthrough';

const NON_RUNNABLE_FENCES = new Set([
  'bash',
  'sh',
  'shell',
  'zsh',
  'powershell',
  'ps1',
  'cmd',
  'console',
  'json',
  'yaml',
  'yml',
  'xml',
  'html',
  'css',
  'sql',
  'markdown',
  'md',
  'mermaid',
]);

const JAVA_STARTER_TEMPLATE = [
  'import java.util.*;',
  '',
  'public class Main {',
  '    public static void main(String[] args) {',
  '        Scanner sc = new Scanner(System.in);',
  '        // Gõ hoặc dán code cần kiểm tra tại đây',
  '        System.out.println("Hello HUS!");',
  '    }',
  '}',
].join('\n');

const PYTHON_STARTER_TEMPLATE = [
  'def solve() -> None:',
  '    # Gõ hoặc dán code cần kiểm tra tại đây',
  '    print("Hello HUS!")',
  '',
  '',
  'if __name__ == "__main__":',
  '    solve()',
].join('\n');

export function getStarterTemplate(language: CodeLanguage): string {
  return language === 'python' ? PYTHON_STARTER_TEMPLATE : JAVA_STARTER_TEMPLATE;
}

export function classifyCodeBlockLanguage(
  fenceLanguage: string,
  code: string,
): CodeLanguage | null {
  const normalized = fenceLanguage.trim().toLowerCase();
  if (NON_RUNNABLE_FENCES.has(normalized)) {
    return null;
  }
  if (normalized === 'java') {
    return 'java';
  }
  if (normalized === 'python' || normalized === 'py' || normalized === 'python3') {
    return 'python';
  }

  if (normalized === '' || normalized === 'text' || normalized === 'plaintext') {
    if (
      /\b(public\s+static\s+void\s+main|System\.out\.|import\s+java\.|public\s+class\s+|private\s+\w+)/.test(
        code,
      )
    ) {
      return 'java';
    }
    if (/\b(def\s+[A-Za-z_]\w*\s*\(|elif\s+|import\s+(?:sys|collections|heapq|math)\b)/.test(code)) {
      return 'python';
    }
  }

  return null;
}

export function inferDefaultCodeLanguage(hints: {
  readonly lessonMarkdown?: string | undefined;
  readonly exercisePrompts?: readonly string[] | undefined;
  readonly fallback?: CodeLanguage | undefined;
}): CodeLanguage {
  const fallback = hints.fallback ?? 'java';
  let javaCount = 0;
  let pythonCount = 0;

  const scan = (markdown: string | undefined) => {
    if (!markdown) return;
    for (const block of extractCodeBlocksFromMarkdown(markdown)) {
      const detected = classifyCodeBlockLanguage(block.language, block.code);
      if (detected === 'java') javaCount += 1;
      if (detected === 'python') pythonCount += 1;
    }
  };

  for (const prompt of hints.exercisePrompts ?? []) {
    scan(prompt);
  }
  scan(hints.lessonMarkdown);

  if (pythonCount > javaCount) return 'python';
  if (javaCount > pythonCount) return 'java';
  return fallback;
}

function countBraceDelta(line: string): number {
  const stripped = line
    .replace(/\/\/.*$/, '')
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, "''");
  let delta = 0;
  for (const ch of stripped) {
    if (ch === '{') delta += 1;
    else if (ch === '}') delta -= 1;
  }
  return delta;
}

function indentBlock(text: string, spaces: number): string {
  const pad = ' '.repeat(spaces);
  return text
    .split('\n')
    .map(line => (line.trim().length > 0 ? `${pad}${line}` : ''))
    .join('\n');
}

function demotePublicTypeDeclarations(chunk: string): string {
  return chunk.replace(
    /\bpublic\s+((?:(?:abstract|final|strictfp)\s+)*(?:class|interface|enum|record)\b)/g,
    '$1',
  );
}

export function ensureRunnableCode(rawCode: string, language: CodeLanguage): string {
  const normalized = rawCode.replace(/\r\n/g, '\n').trim();
  if (!normalized) {
    return getStarterTemplate(language);
  }
  if (language === 'python') {
    return normalized;
  }

  const imports: string[] = [];
  const bodyLines: string[] = [];

  for (const line of normalized.split('\n')) {
    const trimmed = line.trim();
    if (/^package\s+[A-Za-z0-9_.]+\s*;/.test(trimmed)) {
      continue;
    }
    if (/^import\s+(?:static\s+)?[A-Za-z0-9_.*]+\s*;/.test(trimmed) && bodyLines.length === 0) {
      imports.push(trimmed);
      continue;
    }
    bodyLines.push(line);
  }

  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let braceDepth = 0;

  for (const line of bodyLines) {
    if (braceDepth === 0 && currentChunk.length === 0 && line.trim() === '') {
      continue;
    }
    currentChunk.push(line);
    braceDepth = Math.max(0, braceDepth + countBraceDelta(line));
    if (braceDepth === 0 && currentChunk.some(l => l.trim().length > 0)) {
      const joined = currentChunk.join('\n').trim();
      // Keep annotations attached to the declaration that follows them
      if (/^(?:@[A-Za-z0-9_$.]+(?:\([^)]*\))?\s*)+$/.test(joined)) {
        continue;
      }
      chunks.push(joined);
      currentChunk = [];
    }
  }
  if (currentChunk.some(l => l.trim().length > 0)) {
    chunks.push(currentChunk.join('\n').trim());
  }

  const isTypeChunk = (chunk: string): boolean => {
    const header = chunk.split('{')[0] ?? chunk;
    return /\b(?:class|interface|enum|record)\s+[A-Za-z_$]/.test(header);
  };

  const typeChunks = chunks.filter(isTypeChunk);
  const nonTypeChunks = chunks.filter(c => !isTypeChunk(c));
  const typeHasMain = typeChunks.some(c => /\bvoid\s+main\s*\(/.test(c));
  const nonTypeHasMain = nonTypeChunks.some(c => /\bvoid\s+main\s*\(/.test(c));

  const sections: string[] = [];
  if (imports.length > 0) {
    sections.push(imports.join('\n'));
  }

  if (typeHasMain && nonTypeChunks.length === 0) {
    sections.push(typeChunks.join('\n\n'));
    return sections.join('\n\n');
  }

  const demotedTypes = typeChunks.map(demotePublicTypeDeclarations);
  if (demotedTypes.length > 0) {
    sections.push(demotedTypes.join('\n\n'));
  }

  if (nonTypeHasMain) {
    const wrappedMembers = nonTypeChunks.map(c => indentBlock(c, 4)).join('\n\n');
    sections.push(`public class Main {\n${wrappedMembers}\n}`);
    return sections.join('\n\n');
  }

  if (nonTypeChunks.length > 0) {
    const isMethodChunk = (chunk: string): boolean => {
      const beforeBrace = chunk.split('{')[0] ?? '';
      return chunk.includes('{') && !beforeBrace.includes(';') && /\)\s*$/.test(beforeBrace.trim());
    };
    const methodChunks = nonTypeChunks.filter(isMethodChunk);
    const statementChunks = nonTypeChunks.filter(c => !isMethodChunk(c));

    const classBodyParts: string[] = [];
    if (methodChunks.length > 0) {
      classBodyParts.push(methodChunks.map(c => indentBlock(c, 4)).join('\n\n'));
    }
    const mainStatements =
      statementChunks.length > 0
        ? statementChunks.map(c => indentBlock(c, 8)).join('\n')
        : '        System.out.println("Sẵn sàng kiểm thử!");';
    classBodyParts.push(
      `    public static void main(String[] args) {\n${mainStatements}\n    }`,
    );
    sections.push(`public class Main {\n${classBodyParts.join('\n\n')}\n}`);
    return sections.join('\n\n');
  }

  sections.push(
    [
      'public class Main {',
      '    public static void main(String[] args) {',
      '        // Khởi tạo đối tượng và gọi phương thức để kiểm thử tại đây',
      '        System.out.println("Sẵn sàng kiểm thử!");',
      '    }',
      '}',
    ].join('\n'),
  );
  return sections.join('\n\n');
}

export function extractSingleExerciseSnippet(
  promptMarkdown: string,
  exerciseTitle: string,
  fallbackLanguage: CodeLanguage = 'java',
): { readonly label: string; readonly language: CodeLanguage; readonly code: string } | null {
  const blocks = extractCodeBlocksFromMarkdown(promptMarkdown);
  for (const block of blocks) {
    const lang = classifyCodeBlockLanguage(block.language, block.code);
    if (!lang) continue;
    return {
      label: `Mẫu từ câu hỏi: ${exerciseTitle}`,
      language: lang,
      code: ensureRunnableCode(block.code, lang),
    };
  }
  void fallbackLanguage;
  return null;
}

export function buildPlaygroundSnippets(input: {
  readonly scopeId: string;
  readonly exerciseItems?:
    | readonly { readonly id: string; readonly title: string; readonly prompt: string }[]
    | undefined;
  readonly lessonMarkdown?: string | undefined;
  readonly defaultLanguage?: CodeLanguage | undefined;
}): readonly CodePlaygroundSnippet[] {
  const defaultLanguage = input.defaultLanguage ?? 'java';
  const results: CodePlaygroundSnippet[] = [];
  const seenCode = new Set<string>();

  for (const ex of input.exerciseItems ?? []) {
    const blocks = extractCodeBlocksFromMarkdown(ex.prompt);
    blocks.forEach((block, idx) => {
      const lang = classifyCodeBlockLanguage(block.language, block.code);
      if (!lang) return;
      const runnable = ensureRunnableCode(block.code, lang);
      const dedupeKey = `${lang}:${runnable}`;
      if (seenCode.has(dedupeKey)) return;
      seenCode.add(dedupeKey);
      results.push({
        id: `${input.scopeId}-ex-${ex.id}-${idx + 1}`,
        label:
          blocks.length > 1
            ? `Câu hỏi: ${ex.title} (#${idx + 1})`
            : `Câu hỏi: ${ex.title}`,
        language: lang,
        code: runnable,
        source: 'exercise',
      });
    });
  }

  if (input.lessonMarkdown) {
    const lessonBlocks = extractCodeBlocksFromMarkdown(input.lessonMarkdown);
    let lessonCounter = 0;
    for (const block of lessonBlocks) {
      const lang = classifyCodeBlockLanguage(block.language, block.code);
      if (!lang) continue;
      if (block.code.trim().split('\n').length < 2) continue;
      const runnable = ensureRunnableCode(block.code, lang);
      const dedupeKey = `${lang}:${runnable}`;
      if (seenCode.has(dedupeKey)) continue;
      seenCode.add(dedupeKey);
      lessonCounter += 1;
      results.push({
        id: `${input.scopeId}-lesson-${lessonCounter}`,
        label: `Ví dụ bài học #${lessonCounter} (${lang === 'java' ? 'Java' : 'Python'})`,
        language: lang,
        code: runnable,
        source: 'lesson',
      });
      if (lessonCounter >= 4) break;
    }
  }

  const templateLanguages: readonly CodeLanguage[] =
    defaultLanguage === 'python' ? ['python', 'java'] : ['java', 'python'];

  for (const lang of templateLanguages) {
    results.push({
      id: `${input.scopeId}-template-${lang}`,
      label: lang === 'java' ? 'Khung trống Java (Main)' : 'Khung trống Python',
      language: lang,
      code: getStarterTemplate(lang),
      source: 'template',
    });
  }

  return results;
}
