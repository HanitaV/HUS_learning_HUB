import { useCallback, useEffect, useState } from 'react';
import type { EntityId } from '../domain/learning';
import type {
  MathSymbolContext,
  MathSymbolInsertMode,
  MathSymbolPreferences,
  MathSymbolScope,
} from '../domain/math-symbols';
import {
  resetScopeSymbols,
  toggleSymbolForScope,
} from '../core/learning/math-symbols';
import { mathSymbolCatalog } from '../content/math-symbols';
import {
  loadMathSymbolPreferences,
  saveMathSymbolPreferences,
} from '../infrastructure/preferences/math-symbols';

const MATH_SYMBOLS_EVENT = 'hus:math-symbols-changed';

export function useMathSymbolPreferences() {
  const [preferences, setPreferences] = useState<MathSymbolPreferences>(() =>
    loadMathSymbolPreferences(),
  );

  useEffect(() => {
    const handleSync = () => {
      setPreferences(loadMathSymbolPreferences());
    };
    window.addEventListener(MATH_SYMBOLS_EVENT, handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener(MATH_SYMBOLS_EVENT, handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  const commit = useCallback((updater: (current: MathSymbolPreferences) => MathSymbolPreferences) => {
    setPreferences(current => {
      const next = updater(current);
      if (next === current) return current;
      saveMathSymbolPreferences(next);
      window.dispatchEvent(new Event(MATH_SYMBOLS_EVENT));
      return next;
    });
  }, []);

  const setDefaultScope = useCallback(
    (defaultScope: MathSymbolScope) => commit(curr => ({ ...curr, defaultScope })),
    [commit],
  );

  const setInsertMode = useCallback(
    (insertMode: MathSymbolInsertMode) => commit(curr => ({ ...curr, insertMode })),
    [commit],
  );

  const toggleSymbol = useCallback(
    (context: MathSymbolContext | undefined, scope: 'chapter' | 'course', symbolId: EntityId) =>
      commit(curr => toggleSymbolForScope(curr, mathSymbolCatalog, context, scope, symbolId)),
    [commit],
  );

  const resetScope = useCallback(
    (context: MathSymbolContext | undefined, scope: 'chapter' | 'course') =>
      commit(curr => resetScopeSymbols(curr, context, scope)),
    [commit],
  );

  return {
    preferences,
    setDefaultScope,
    setInsertMode,
    toggleSymbol,
    resetScope,
  };
}
