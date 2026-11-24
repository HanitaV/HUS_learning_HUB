import { createContext, useContext } from 'react';

export interface WebMcpGuideContextValue {
  readonly isGuideOpen: boolean;
  readonly openGuide: () => void;
  readonly closeGuide: () => void;
}

const DEFAULT_WEBMCP_GUIDE_CONTEXT: WebMcpGuideContextValue = {
  isGuideOpen: false,
  openGuide: () => {},
  closeGuide: () => {},
};

export const WebMcpGuideContext = createContext<WebMcpGuideContextValue>(
  DEFAULT_WEBMCP_GUIDE_CONTEXT,
);

export function useWebMcpGuide(): WebMcpGuideContextValue {
  return useContext(WebMcpGuideContext);
}
