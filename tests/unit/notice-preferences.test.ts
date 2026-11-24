import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AI_ONBOARDING_ACK_KEY,
  WEBMCP_NOTICE_ACK_KEY,
  acknowledgeAiOnboarding,
  acknowledgeWebMcpNotice,
  hasAcknowledgedAiOnboarding,
  hasAcknowledgedWebMcpNotice,
  resetAiOnboarding,
  resetWebMcpNotice,
} from '../../src/infrastructure/preferences/notice';

describe('WebMCP & first-visit AI onboarding preferences', () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, val: string) => {
          store.set(key, val);
        },
        removeItem: (key: string) => {
          store.delete(key);
        },
      },
      dispatchEvent: () => true,
    });
    resetAiOnboarding();
    resetWebMcpNotice();
  });

  it('tracks first-visit AI onboarding acknowledgement and reset', () => {
    expect(hasAcknowledgedAiOnboarding()).toBe(false);
    acknowledgeAiOnboarding();
    expect(hasAcknowledgedAiOnboarding()).toBe(true);
    expect(store.get(AI_ONBOARDING_ACK_KEY)).toBe('1');
    resetAiOnboarding();
    expect(hasAcknowledgedAiOnboarding()).toBe(false);
  });

  it('tracks missing-WebMCP toast acknowledgement and dispatches change events', () => {
    const spy = vi.fn();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, val: string) => {
          store.set(key, val);
        },
        removeItem: (key: string) => {
          store.delete(key);
        },
      },
      dispatchEvent: spy,
    });

    expect(hasAcknowledgedWebMcpNotice()).toBe(false);
    acknowledgeWebMcpNotice();
    expect(hasAcknowledgedWebMcpNotice()).toBe(true);
    expect(store.get(WEBMCP_NOTICE_ACK_KEY)).toBe('1');
    expect(spy).toHaveBeenCalledTimes(1);

    resetWebMcpNotice();
    expect(hasAcknowledgedWebMcpNotice()).toBe(false);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('avoids trapping users in un-persistable onboarding when localStorage throws', () => {
    const throwingWindow = {
      dispatchEvent: () => true,
    };
    Object.defineProperty(throwingWindow, 'localStorage', {
      get() {
        throw new Error('blocked');
      },
    });
    vi.stubGlobal('window', throwingWindow);
    resetAiOnboarding();
    resetWebMcpNotice();

    expect(hasAcknowledgedAiOnboarding()).toBe(true);
    expect(hasAcknowledgedWebMcpNotice()).toBe(true);
  });
});
