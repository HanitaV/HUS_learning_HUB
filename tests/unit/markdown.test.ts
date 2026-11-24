import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { expect, it } from 'vitest';
import Markdown from '../../src/components/learning/Markdown';

it('renders math and highlighted code while refusing executable HTML and URLs', () => {
  const source = '$v = \\frac{s}{t}$\n\n```python\nprint(2 + 3)\n```\n\n<script>alert(1)</script>\n\n[unsafe](javascript:alert(1))\n\n[next](#/courses/phy1159)';
  const html = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(Markdown, { children: source })));
  expect(html).toContain('katex');
  expect(html).toContain('hljs-');
  expect(html).not.toContain('<script');
  expect(html).not.toContain('javascript:');
  expect(html).toContain('href="/courses/phy1159"');
});

it('renders GFM tables inside a scrollable wrapper', () => {
  const source = '| Hạt | Điện tích |\n|---|---|\n| Proton | +1 |\n| Electron | -1 |';
  const html = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(Markdown, { children: source })));
  expect(html).toContain('class="table-scroll"');
  expect(html).toContain('<table>');
  expect(html).toContain('<td>Proton</td>');
});

it('renders inline LaTeX math for hint list items without wrapping in a paragraph tag', () => {
  const source = 'Áp dụng công thức $\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1$.';
  const html = renderToStaticMarkup(
    createElement(MemoryRouter, null, createElement(Markdown, { inline: true, children: source })),
  );
  expect(html).toContain('katex');
  expect(html).not.toContain('<p>');
});
