import { describe, expect, it } from 'vitest';
import { isDeepDiveHeading, parseMicroLesson } from '../../src/core/learning/micro-lesson';

describe('micro-lesson core parser', () => {
  it('identifies deep dive headings accent-insensitively', () => {
    expect(isDeepDiveHeading('Độ phức tạp thuật toán')).toBe(true);
    expect(isDeepDiveHeading('Mở rộng kiến thức')).toBe(true);
    expect(isDeepDiveHeading('So sánh / liên hệ')).toBe(true);
    expect(isDeepDiveHeading('Chứng minh định lý')).toBe(true);
    expect(isDeepDiveHeading('Bổ trợ nâng cao')).toBe(true);
    expect(isDeepDiveHeading('Vì sao cần')).toBe(false);
  });

  it('splits H2 sections into distinct micro-cards, ignores #/## inside code fences, and extracts spoilers + attribution', () => {
    const markdown = `# Mảng một chiều và duyệt mảng

## Vì sao cần

Lưu 100 điểm thi gọn gàng.

## Cài đặt

\`\`\`python
# Comment cấp 1
## Comment cấp 2 không được tách thẻ!
a = [1, 2, 3]
\`\`\`

## Độ phức tạp

Truy cập theo chỉ số tốn $O(1)$.

## Tự kiểm tra

1. Mảng \`v = [10, 20, 30]\` có chỉ số cuối là mấy?

> **Đáp án**
> Chỉ số cuối là \`2\` và tổng dạng $x^2 + y^2$.
> Dòng giải thích thứ hai.

---

Chuyển từ ghi chú lý thuyết VLDC-HUS, mục T2.1.
`;

    const parsed = parseMicroLesson(markdown);
    expect(parsed.title).toBe('Mảng một chiều và duyệt mảng');
    expect(parsed.attributionFooter).toBe('Chuyển từ ghi chú lý thuyết VLDC-HUS, mục T2.1.');
    expect(parsed.cards).toHaveLength(4);
    expect(parsed.cards.map(c => c.title)).toEqual([
      'Vì sao cần',
      'Cài đặt',
      'Độ phức tạp',
      'Tự kiểm tra',
    ]);
    expect(parsed.cards[1]?.bodyMarkdown).toContain('## Comment cấp 2 không được tách thẻ!');
    expect(parsed.cards[2]?.isDeepDiveCard).toBe(true);
    expect(parsed.cards[3]?.selfChecks).toHaveLength(1);
    expect(parsed.cards[3]?.selfChecks[0]?.promptMarkdown).toContain('chỉ số cuối là mấy?');
    expect(parsed.cards[3]?.selfChecks[0]?.answerMarkdown).toContain('x^2 + y^2');
    expect(parsed.cards[3]?.selfChecks[0]?.answerMarkdown).toContain('Dòng giải thích thứ hai.');
    expect(parsed.cards[3]?.bodyMarkdown).not.toContain('Đáp án');
  });

  it('extracts ### Đáp số subsections in math lessons into interactive selfChecks', () => {
    const mathMd = `# Cận trên đúng

## Ví dụ

Tìm $\\sup A$ với $A = (0, 1]$.

### Đáp số

$\\sup A = 1$.
`;
    const parsed = parseMicroLesson(mathMd);
    expect(parsed.cards).toHaveLength(1);
    expect(parsed.cards[0]?.selfChecks).toHaveLength(1);
    expect(parsed.cards[0]?.selfChecks[0]?.answerMarkdown).toContain('\\sup A = 1');
    expect(parsed.cards[0]?.bodyMarkdown).not.toContain('\\sup A = 1');
  });
});
