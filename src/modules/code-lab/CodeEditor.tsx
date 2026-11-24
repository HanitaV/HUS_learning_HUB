import { useEffect, useRef, type CSSProperties } from 'react';
import { Compartment, EditorState } from '@codemirror/state';
import {
  EditorView,
  crosshairCursor,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  rectangularSelection,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import {
  HighlightStyle,
  bracketMatching,
  foldGutter,
  foldKeymap,
  indentOnInput,
  indentUnit,
  syntaxHighlighting,
} from '@codemirror/language';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { python } from '@codemirror/lang-python';
import { java } from '@codemirror/lang-java';
import { tags } from '@lezer/highlight';
import type { CodeLanguage } from '../../domain/code-lab';

export interface CodeEditorProps {
  readonly value: string;
  readonly language: CodeLanguage;
  readonly onChange: (next: string) => void;
  readonly ariaLabel?: string;
  readonly minHeight?: string;
}

const observatoryHighlightStyle = HighlightStyle.define([
  {
    tag: [
      tags.keyword,
      tags.operatorKeyword,
      tags.controlKeyword,
      tags.definitionKeyword,
      tags.moduleKeyword,
    ],
    color: 'var(--color-accent)',
    fontWeight: '600',
  },
  {
    tag: [tags.string, tags.special(tags.string), tags.character],
    color: 'var(--color-success)',
  },
  {
    tag: [tags.number, tags.integer, tags.float, tags.bool, tags.null, tags.atom],
    color: 'var(--color-starlight)',
  },
  {
    tag: [tags.comment, tags.lineComment, tags.blockComment, tags.docComment],
    color: 'var(--color-ink-muted)',
    fontStyle: 'italic',
  },
  {
    tag: [
      tags.function(tags.variableName),
      tags.function(tags.propertyName),
      tags.definition(tags.variableName),
    ],
    color: 'var(--color-accent-ink)',
  },
  {
    tag: [tags.typeName, tags.className, tags.namespace, tags.self],
    color: 'var(--color-starlight)',
    fontWeight: '600',
  },
  {
    tag: [tags.operator, tags.punctuation, tags.bracket, tags.paren, tags.squareBracket, tags.brace],
    color: 'var(--color-ink-secondary)',
  },
  {
    tag: [tags.invalid],
    color: 'var(--color-danger)',
    textDecoration: 'underline',
  },
]);

const observatoryTheme = EditorView.theme({
  '&': {
    backgroundColor: 'var(--color-surface)',
    color: 'var(--color-ink)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--color-border)',
    fontSize: '0.875rem',
    overflow: 'hidden',
  },
  '&.cm-focused': {
    outline: '2px solid var(--color-accent)',
    outlineOffset: '1px',
    borderColor: 'var(--color-accent)',
  },
  '.cm-scroller': {
    fontFamily: 'var(--font-mono)',
    lineHeight: '1.6',
    overflow: 'auto',
    WebkitOverflowScrolling: 'touch',
    touchAction: 'pan-x pan-y',
    minHeight: 'var(--cm-min-height, 320px)',
    maxHeight: '62vh',
  },
  '.cm-content': {
    padding: '12px 0',
    caretColor: 'var(--color-accent)',
    minHeight: 'var(--cm-min-height, 320px)',
  },
  '.cm-line': {
    padding: '0 14px 0 10px',
  },
  '.cm-gutters': {
    backgroundColor: 'var(--color-surface-subtle)',
    color: 'var(--color-ink-muted)',
    borderRight: '1px solid var(--color-border)',
    userSelect: 'none',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    padding: '0 10px 0 8px',
    minWidth: '2.5rem',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'var(--color-surface-hover)',
    color: 'var(--color-ink)',
    fontWeight: '600',
  },
  '.cm-activeLine': {
    backgroundColor: 'color-mix(in srgb, var(--color-accent-subtle) 55%, transparent)',
  },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': {
    backgroundColor: 'var(--color-orbit-strong)',
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: 'var(--color-accent)',
    borderLeftWidth: '2px',
  },
  '.cm-matchingBracket, .cm-nonmatchingBracket': {
    backgroundColor: 'var(--color-orbit)',
    outline: '1px solid var(--color-accent)',
    borderRadius: '2px',
  },
  '.cm-foldPlaceholder': {
    backgroundColor: 'var(--color-surface-subtle)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-ink-secondary)',
    borderRadius: 'var(--radius-sm)',
    padding: '0 6px',
  },
});

function getLanguageExtension(language: CodeLanguage) {
  return language === 'java' ? java() : python();
}

export function CodeEditor({
  value,
  language,
  onChange,
  ariaLabel = 'Trình soạn thảo mã nguồn',
  minHeight = '320px',
}: CodeEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const languageCompartmentRef = useRef(new Compartment());
  const ariaCompartmentRef = useRef(new Compartment());
  const onChangeRef = useRef(onChange);
  const isExternalSyncRef = useRef(false);

  onChangeRef.current = onChange;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const languageCompartment = languageCompartmentRef.current;
    const ariaCompartment = ariaCompartmentRef.current;

    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightSpecialChars(),
        history(),
        foldGutter(),
        drawSelection(),
        dropCursor(),
        EditorState.allowMultipleSelections.of(true),
        indentOnInput(),
        indentUnit.of('    '),
        EditorState.tabSize.of(4),
        bracketMatching(),
        closeBrackets(),
        rectangularSelection(),
        crosshairCursor(),
        highlightActiveLine(),
        syntaxHighlighting(observatoryHighlightStyle),
        observatoryTheme,
        languageCompartment.of(getLanguageExtension(language)),
        ariaCompartment.of(
          EditorView.contentAttributes.of({
            'aria-label': ariaLabel,
          }),
        ),
        keymap.of([
          indentWithTab,
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...historyKeymap,
          ...foldKeymap,
        ]),
        EditorView.updateListener.of((update) => {
          if (!update.docChanged || isExternalSyncRef.current) return;
          onChangeRef.current(update.state.doc.toString());
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: container,
    });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // EditorView is created once on mount and updated via compartments/dispatch below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: languageCompartmentRef.current.reconfigure(getLanguageExtension(language)),
    });
  }, [language]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: ariaCompartmentRef.current.reconfigure(
        EditorView.contentAttributes.of({
          'aria-label': ariaLabel,
        }),
      ),
    });
  }, [ariaLabel]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const currentDoc = view.state.doc.toString();
    if (currentDoc === value) return;

    isExternalSyncRef.current = true;
    try {
      view.dispatch({
        changes: { from: 0, to: currentDoc.length, insert: value },
      });
    } finally {
      isExternalSyncRef.current = false;
    }
  }, [value]);

  const wrapperStyle = {
    '--cm-min-height': minHeight,
  } as CSSProperties;

  return (
    <div
      ref={containerRef}
      style={wrapperStyle}
      className="min-w-0 w-full"
      data-testid="code-editor"
    />
  );
}
