const LATEX_AFTER_N_RE =
  /^(?:eq\b|e\b|abla\b|u\b|otin\b|i\b|eg\b|atural\b|mid\b|less\b|gtr\b|leq\b|geq\b|sim\b|cong\b|parallel\b|vdash\b|subset|supset)/;

/**
 * Safely repairs unescaped single-backslash LaTeX commands inside JSON string literals
 * (e.g. `\lim`, `\frac`, `\to`, `\tan`, `\beta`, `\neq`) without altering valid JSON escapes
 * (`\"`, `\\`, `\/`, `\uXXXX`, or real `\n` newlines).
 */
export function repairJsonLatexEscapes(jsonSource: string): string {
  let out = '';
  let inString = false;
  let i = 0;

  while (i < jsonSource.length) {
    const ch = jsonSource[i]!;
    if (!inString) {
      if (ch === '"') {
        inString = true;
      }
      out += ch;
      i += 1;
      continue;
    }

    if (ch === '"') {
      inString = false;
      out += ch;
      i += 1;
      continue;
    }

    if (ch !== '\\') {
      if (ch === '\n') {
        out += '\\n';
      } else if (ch === '\r') {
        out += '\\r';
      } else if (ch === '\t') {
        out += '\\t';
      } else {
        out += ch;
      }
      i += 1;
      continue;
    }

    const next = jsonSource[i + 1];
    if (next === undefined) {
      out += '\\\\';
      i += 1;
      continue;
    }

    if (next === '"' || next === '\\' || next === '/') {
      out += '\\' + next;
      i += 2;
      continue;
    }

    if (next === 'u' && /^[0-9a-fA-F]{4}$/.test(jsonSource.slice(i + 2, i + 6))) {
      out += jsonSource.slice(i, i + 6);
      i += 6;
      continue;
    }

    if (next === 'n') {
      const rest = jsonSource.slice(i + 2, i + 14);
      if (LATEX_AFTER_N_RE.test(rest)) {
        out += '\\\\n';
      } else {
        out += '\\n';
      }
      i += 2;
      continue;
    }

    if (next === 'b' || next === 'f' || next === 'r' || next === 't') {
      const afterControl = jsonSource[i + 2] ?? '';
      if (/^[a-zA-Z]$/.test(afterControl)) {
        out += '\\\\' + next;
      } else {
        out += '\\' + next;
      }
      i += 2;
      continue;
    }

    out += '\\\\' + next;
    i += 2;
  }

  return out;
}
