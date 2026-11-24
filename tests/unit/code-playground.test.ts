import { describe, expect, it } from 'vitest';
import { extractJavaMainClassName } from '../../src/core/code-lab/judge';
import {
  buildPlaygroundSnippets,
  ensureRunnableCode,
  extractSingleExerciseSnippet,
  getStarterTemplate,
  inferDefaultCodeLanguage,
} from '../../src/core/code-lab/playground';

describe('code playground core helpers', () => {
  it('prefers the Java class declaring main when no public class is present', () => {
    const code = [
      'class Box { int value; Box(int v) { value = v; } }',
      'class Runner {',
      '    public static void main(String[] args) {',
      '        System.out.println(new Box(10).value);',
      '    }',
      '}',
    ].join('\n');

    expect(extractJavaMainClassName(code)).toBe('Runner');
  });

  it('wraps helper classes + floating main methods into a valid single-file Main program', () => {
    const raw = [
      'class Box { int value; Box(int v) { value = v; } }',
      'static void changeField(Box b) { b.value = 99; }',
      'static void reassign(Box b) { b = new Box(50); }',
      'public static void main(String[] args) {',
      '    Box box = new Box(10);',
      '    changeField(box);',
      '    reassign(box);',
      '    System.out.println(box.value);',
      '}',
    ].join('\n');

    const runnable = ensureRunnableCode(raw, 'java');
    expect(runnable).toContain('class Box');
    expect(runnable).toContain('public class Main');
    expect(runnable).toContain('static void changeField(Box b)');
    expect(runnable).toContain('public static void main(String[] args)');
    expect(extractJavaMainClassName(runnable)).toBe('Main');
  });

  it('comments out package declarations and demotes conflicting public classes without main', () => {
    const raw = [
      'package hus.oop.demo;',
      'import java.util.List;',
      '',
      'public class Vector2D {',
      '    private final double x;',
      '    private final double y;',
      '    public Vector2D(double x, double y) { this.x = x; this.y = y; }',
      '}',
    ].join('\n');

    const runnable = ensureRunnableCode(raw, 'java');
    expect(runnable).toMatch(/^import java\.util\.List;/m);
    expect(runnable).not.toMatch(/^package\s+/m);
    expect(runnable).toContain('class Vector2D {');
    expect(runnable).not.toContain('public class Vector2D');
    expect(runnable).toContain('public class Main');
    expect(extractJavaMainClassName(runnable)).toBe('Main');
  });

  it('preserves a self-contained public class that already defines main', () => {
    const raw = [
      'package demo;',
      'public class HelloWorld {',
      '    public static void main(String[] args) {',
      '        System.out.println("Hello HUS");',
      '    }',
      '}',
    ].join('\n');

    const runnable = ensureRunnableCode(raw, 'java');
    expect(runnable).not.toMatch(/^package\s+/m);
    expect(runnable).toContain('public class HelloWorld');
    expect(extractJavaMainClassName(runnable)).toBe('HelloWorld');
  });

  it('wraps bare Java statements inside Main.main', () => {
    const raw = 'int a = 3;\nint b = 4;\nSystem.out.println(a + b);';
    const runnable = ensureRunnableCode(raw, 'java');
    expect(runnable).toContain('public class Main');
    expect(runnable).toContain('public static void main(String[] args)');
    expect(runnable).toContain('System.out.println(a + b);');
  });

  it('ignores bash/console/plain output fences while extracting Java and Python snippets', () => {
    const lessonMd = [
      '## 1. Giới thiệu',
      '```bash',
      'javac HelloWorld.java && java HelloWorld',
      '```',
      '```text',
      'Output: 42',
      '```',
      '```java',
      'public class Counter {',
      '    private int count = 0;',
      '    public void inc() { count++; }',
      '}',
      '```',
    ].join('\n');

    const snippets = buildPlaygroundSnippets({
      scopeId: 'oop-demo',
      exerciseItems: [
        {
          id: 'ex-1',
          title: 'Truyền tham chiếu',
          prompt: 'Xem đoạn code:\n```java\nint x = 10;\nSystem.out.println(x);\n```',
        },
        {
          id: 'ex-2',
          title: 'Lệnh biên dịch',
          prompt: '```bash\njavac Main.java\n```',
        },
      ],
      lessonMarkdown: lessonMd,
      defaultLanguage: 'java',
    });

    expect(snippets.some(s => s.code.includes('javac Main.java'))).toBe(false);
    expect(snippets.some(s => s.code.includes('Output: 42'))).toBe(false);
    expect(snippets[0]?.source).toBe('exercise');
    expect(snippets[0]?.code).toContain('System.out.println(x);');
    expect(snippets.some(s => s.source === 'lesson' && s.code.includes('class Counter'))).toBe(true);
    expect(snippets.some(s => s.source === 'template' && s.language === 'java')).toBe(true);
  });

  it('infers Python default language for Python lessons and extracts exercise snippets cleanly', () => {
    const lang = inferDefaultCodeLanguage({
      lessonMarkdown: '```python\ndef bfs(adj, start):\n    return [start]\n```',
      fallback: 'java',
    });
    expect(lang).toBe('python');

    const single = extractSingleExerciseSnippet(
      'Xét hàm:\n```python\ndef f(n):\n    return n * 2\nprint(f(5))\n```',
      'Trắc nghiệm Python',
      'python',
    );
    expect(single).not.toBeNull();
    expect(single?.language).toBe('python');
    expect(single?.code).toContain('print(f(5))');
    expect(getStarterTemplate('python')).toContain('def solve');
  });
});
