export const SMALL_SCREEN_ACK_KEY = 'hus-learning-hub:small-screen-ack:v1';
export const WEBMCP_NOTICE_ACK_KEY = 'hus-learning-hub:webmcp-notice-ack:v1';
export const AI_ONBOARDING_ACK_KEY = 'hus-learning-hub:ai-onboarding-ack:v1';

let memorySmallScreenAck = false;
let memoryWebMcpAck = false;
let memoryAiOnboardingAck = false;

export function hasAcknowledgedSmallScreen(): boolean {
  if (memorySmallScreenAck) return true;
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(SMALL_SCREEN_ACK_KEY) === '1';
  } catch {
    return false;
  }
}

export function acknowledgeSmallScreen(): void {
  memorySmallScreenAck = true;
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SMALL_SCREEN_ACK_KEY, '1');
  } catch {
    // Ignore storage errors in restricted browsing modes; in-memory state keeps the modal closed.
  }
}

export function hasAcknowledgedWebMcpNotice(): boolean {
  if (memoryWebMcpAck) return true;
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(WEBMCP_NOTICE_ACK_KEY) === '1';
  } catch {
    return true;
  }
}

export function acknowledgeWebMcpNotice(): void {
  memoryWebMcpAck = true;
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(WEBMCP_NOTICE_ACK_KEY, '1');
  } catch {
    // Ignore storage errors in restricted browsing modes; in-memory state keeps the toast dismissed.
  }
  window.dispatchEvent(new Event('hus:webmcp-notice-change'));
}

export function resetWebMcpNotice(): void {
  memoryWebMcpAck = false;
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(WEBMCP_NOTICE_ACK_KEY);
  } catch {
    // Ignore storage errors cleanly.
  }
  window.dispatchEvent(new Event('hus:webmcp-notice-change'));
}

export function hasAcknowledgedAiOnboarding(): boolean {
  if (memoryAiOnboardingAck) return true;
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(AI_ONBOARDING_ACK_KEY) === '1';
  } catch {
    // When storage is blocked, avoid trapping the user in a first-visit modal on every reload.
    return true;
  }
}

export function acknowledgeAiOnboarding(): void {
  memoryAiOnboardingAck = true;
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(AI_ONBOARDING_ACK_KEY, '1');
  } catch {
    // Ignore storage errors in restricted browsing modes.
  }
}

export function resetAiOnboarding(): void {
  memoryAiOnboardingAck = false;
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(AI_ONBOARDING_ACK_KEY);
  } catch {
    // Ignore storage errors cleanly.
  }
}
