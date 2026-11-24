import { describe, expect, it } from 'vitest';
import { extractMarkdownOutline, slugifyHeading } from '../../src/core/learning/outline';

describe('markdown outline extraction', () => {
  it('slugifies Vietnamese headings deterministically', () => {
    expect(slugifyHeading('Định luật Newton & ứng dụng')).toBe('dinh-luat-newton-ung-dung');
    expect(slugifyHeading('   ')).toBe('muc');
  });

  it('extracts h2 and h3 headings while ignoring h1 and fenced code blocks', () => {
    const md = [
      '# Tiêu đề chính',
      '## Khởi đầu',
      '```python',
      '## comment inside code',
      '```',
      '### Chi tiết',
      '## Khởi đầu',
    ].join('\n');

    expect(extractMarkdownOutline(md)).toEqual([
      { id: 'khoi-dau', label: 'Khởi đầu', level: 2 },
      { id: 'chi-tiet', label: 'Chi tiết', level: 3 },
      { id: 'khoi-dau-2', label: 'Khởi đầu', level: 2 },
    ]);
  });
});
