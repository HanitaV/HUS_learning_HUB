import { describe, expect, it } from 'vitest';
import {
  buildCodeWalkthrough,
  extractCodeBlocksFromMarkdown,
  splitMarkdownWithCodeBlocks,
} from '../../src/core/learning/code-walkthrough';

describe('code-walkthrough pure engine', () => {
  it('splits a Java method into progressive cumulative steps with line highlights', () => {
    const javaCode = `static int[] bfs(List<List<Integer>> adj, int start) {
    int[] dist = new int[adj.size()];
    Arrays.fill(dist, -1);
    Queue<Integer> queue = new ArrayDeque<>();
    dist[start] = 0;
    queue.add(start);
    while (!queue.isEmpty()) {
        int u = queue.remove();
        for (int v : adj.get(u)) {
            if (dist[v] == -1) {
                dist[v] = dist[u] + 1;
                queue.add(v);
            }
        }
    }
    return dist;
}`;
    const wt = buildCodeWalkthrough(javaCode, 'java', 'Cài đặt BFS');
    expect(wt.language).toBe('java');
    expect(wt.steps.length).toBeGreaterThanOrEqual(2);
    expect(wt.steps.length).toBeLessThanOrEqual(4);

    // Cumulative growth and final step matches fullCode
    for (let i = 1; i < wt.steps.length; i += 1) {
      expect(wt.steps[i]!.code.length).toBeGreaterThan(wt.steps[i - 1]!.code.length);
    }
    expect(wt.steps[wt.steps.length - 1]!.code).toBe(wt.fullCode);
    expect(wt.steps.every(s => s.highlightLines.length > 0)).toBe(true);
  });

  it('splits markdown prose and fenced code blocks cleanly in order', () => {
    const md = `Giới thiệu bước cài đặt.

\`\`\`java
class A {
    int x = 1;
}
\`\`\`

Ghi chú sau code.`;

    const blocks = extractCodeBlocksFromMarkdown(md);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.language).toBe('java');

    const segments = splitMarkdownWithCodeBlocks(md);
    expect(segments.map(s => s.kind)).toEqual(['markdown', 'code', 'markdown']);
  });
});
