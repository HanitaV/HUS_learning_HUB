import { useSyncExternalStore } from 'react';
import {
  getWebMcpActivitySnapshot,
  subscribeWebMcpActivity,
  type WebMcpActivitySnapshot,
} from '../infrastructure/ai/webmcp-essay-bridge';

/**
 * Subscribes a React component to live WebMCP tool execution & `toolactivated`/`toolcancel` events.
 */
export function useWebMcpActivity(): WebMcpActivitySnapshot {
  return useSyncExternalStore(
    subscribeWebMcpActivity,
    getWebMcpActivitySnapshot,
    getWebMcpActivitySnapshot,
  );
}
