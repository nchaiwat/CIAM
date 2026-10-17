"use client";

import { useEffect, useState } from "react";
import { API_BASE_URL } from "./api";

/**
 * Default Idle Session Timeout: 30 minutes (1,800,000 ms)
 * Default Absolute Token Timeout (configured on Backend): 480 minutes (8 hours)
 * Server Session Heartbeat Check Interval: 60 seconds
 */
export const DEFAULT_IDLE_TIMEOUT_MINUTES = 30;
export const DEFAULT_IDLE_TIMEOUT_MS = DEFAULT_IDLE_TIMEOUT_MINUTES * 60 * 1000;
export const SERVER_SESSION_CHECK_INTERVAL_MS = 60 * 1000;

const STORAGE_TOKEN_KEY = "ciam_token";
const STORAGE_USER_KEY = "ciam_user";
const STORAGE_LAST_ACTIVITY_KEY = "ciam_last_activity";

/**
 * Decode JWT payload safely on the client without external libraries.
 * Returns the expiration timestamp in milliseconds, or null if unavailable.
 */
export function getJwtExpirationMs(token: string | null): number | null {
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const jsonPayload = decodeURIComponent(
      atob(padded)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    const parsed = JSON.parse(jsonPayload);
    if (typeof parsed.exp === "number" && parsed.exp > 0) {
      return parsed.exp * 1000;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Record user activity timestamp in localStorage (shared across tabs).
 */
export function markSessionActivity(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_LAST_ACTIVITY_KEY, String(Date.now()));
  } catch {}
}

/**
 * Clear all session storage keys cleanly.
 */
export function clearSessionStorage(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_TOKEN_KEY);
    localStorage.removeItem(STORAGE_USER_KEY);
    localStorage.removeItem(STORAGE_LAST_ACTIVITY_KEY);
  } catch {}
}

/**
 * Check if the current session is expired either by JWT `exp` or by Idle Timeout.
 */
export function checkSessionExpiration(
  idleTimeoutMs: number = DEFAULT_IDLE_TIMEOUT_MS
): { expired: boolean; reason: "missing" | "token_expired" | "idle_timeout" | null; remainingMs: number } {
  if (typeof window === "undefined") {
    return { expired: false, reason: null, remainingMs: idleTimeoutMs };
  }

  const token = localStorage.getItem(STORAGE_TOKEN_KEY);
  if (!token) {
    return { expired: true, reason: "missing", remainingMs: 0 };
  }

  const now = Date.now();

  // 1. Check JWT absolute expiration (`exp` claim)
  const jwtExpMs = getJwtExpirationMs(token);
  if (jwtExpMs !== null && now >= jwtExpMs) {
    return { expired: true, reason: "token_expired", remainingMs: 0 };
  }

  // 2. Check Idle Timeout
  let lastActivityMs = Number(localStorage.getItem(STORAGE_LAST_ACTIVITY_KEY) || "0");
  if (!lastActivityMs || Number.isNaN(lastActivityMs) || lastActivityMs > now) {
    lastActivityMs = now;
    markSessionActivity();
  }

  const idleDeadlineMs = lastActivityMs + idleTimeoutMs;
  if (now >= idleDeadlineMs) {
    return { expired: true, reason: "idle_timeout", remainingMs: 0 };
  }

  const effectiveDeadlineMs = jwtExpMs !== null ? Math.min(jwtExpMs, idleDeadlineMs) : idleDeadlineMs;
  return {
    expired: false,
    reason: null,
    remainingMs: Math.max(0, effectiveDeadlineMs - now),
  };
}

/**
 * Immediately log off the user and redirect to /login without waiting for any user action.
 */
export function triggerImmediateLogoff(reason: "token_expired" | "idle_timeout" | "missing" | "revoked" = "token_expired"): void {
  if (typeof window === "undefined") return;
  clearSessionStorage();

  const currentPath = window.location.pathname || "/portal";
  if (
    currentPath.includes("/login") ||
    currentPath.includes("/portal/callback") ||
    currentPath.includes("/oauth/authorize")
  ) {
    return;
  }

  const redirectTarget = encodeURIComponent(currentPath + (window.location.search || ""));
  window.location.replace(`/login?expired=1&reason=${reason}&redirect=${redirectTarget}`);
}

/**
 * Proactive React Hook that monitors the user's session in real-time and automatically
 * logs off the exact moment the Idle Timeout (30 mins) or JWT Expiration (480 mins / 8 hrs)
 * is reached — or if the server revokes/expires the session — WITHOUT waiting for user action.
 */
export function useSessionWatchdog(options?: {
  enabled?: boolean;
  idleTimeoutMs?: number;
}): { remainingSeconds: number } {
  const enabled = options?.enabled ?? true;
  const idleTimeoutMs = options?.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS;
  const [remainingSeconds, setRemainingSeconds] = useState<number>(
    Math.floor(idleTimeoutMs / 1000)
  );

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    // Initial check on mount
    const initial = checkSessionExpiration(idleTimeoutMs);
    if (initial.expired) {
      triggerImmediateLogoff(initial.reason || "token_expired");
      return;
    }
    setRemainingSeconds(Math.ceil(initial.remainingMs / 1000));

    let exactTimeoutId: ReturnType<typeof setTimeout> | null = null;

    const scheduleExactDeadlineTimer = () => {
      if (exactTimeoutId) clearTimeout(exactTimeoutId);
      const status = checkSessionExpiration(idleTimeoutMs);
      if (status.expired) {
        triggerImmediateLogoff(status.reason || "token_expired");
        return;
      }
      setRemainingSeconds(Math.ceil(status.remainingMs / 1000));
      // Schedule exact millisecond callback so logoff happens immediately when deadline is reached
      exactTimeoutId = setTimeout(() => {
        const verify = checkSessionExpiration(idleTimeoutMs);
        if (verify.expired) {
          triggerImmediateLogoff(verify.reason || "token_expired");
        } else {
          scheduleExactDeadlineTimer();
        }
      }, Math.min(status.remainingMs + 50, 2147483647));
    };

    scheduleExactDeadlineTimer();

    // Throttled user activity listener (updates ciam_last_activity at most every 5 seconds)
    let lastRecordedAt = Date.now();
    const handleUserActivity = () => {
      const now = Date.now();
      if (now - lastRecordedAt >= 5000) {
        lastRecordedAt = now;
        // Before extending idle activity, verify JWT hasn't already expired
        const token = localStorage.getItem(STORAGE_TOKEN_KEY);
        const jwtExpMs = getJwtExpirationMs(token);
        if (!token || (jwtExpMs !== null && now >= jwtExpMs)) {
          triggerImmediateLogoff("token_expired");
          return;
        }
        markSessionActivity();
        scheduleExactDeadlineTimer();
      }
    };

    const activityEvents: (keyof WindowEventMap)[] = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
      "click",
    ];
    activityEvents.forEach((evt) =>
      window.addEventListener(evt, handleUserActivity, { passive: true })
    );

    // 1-second tick interval to update remaining time & catch OS sleep/wake expiration immediately
    const tickInterval = setInterval(() => {
      const status = checkSessionExpiration(idleTimeoutMs);
      if (status.expired) {
        triggerImmediateLogoff(status.reason || "token_expired");
        return;
      }
      setRemainingSeconds(Math.ceil(status.remainingMs / 1000));
    }, 1000);

    // Background Server Session Heartbeat (every 60s) to catch server-side revocation / AD disable without user action
    const serverHeartbeatInterval = setInterval(async () => {
      const token = localStorage.getItem(STORAGE_TOKEN_KEY);
      if (!token) {
        triggerImmediateLogoff("missing");
        return;
      }
      try {
        const res = await fetch(`${API_BASE_URL}/auth/me`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        });
        if (res.status === 401 || res.status === 403) {
          triggerImmediateLogoff("revoked");
        }
      } catch {
        // Ignore transient network hiccups; local timer still enforces strict expiration
      }
    }, SERVER_SESSION_CHECK_INTERVAL_MS);

    // Cross-tab synchronization: if user logs out in another tab, log off this tab immediately
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_TOKEN_KEY && !e.newValue) {
        triggerImmediateLogoff("missing");
      } else if (e.key === STORAGE_LAST_ACTIVITY_KEY && e.newValue) {
        scheduleExactDeadlineTimer();
      }
    };
    window.addEventListener("storage", handleStorageChange);

    // Immediate check when returning to tab or waking screen
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        const status = checkSessionExpiration(idleTimeoutMs);
        if (status.expired) {
          triggerImmediateLogoff(status.reason || "token_expired");
        } else {
          setRemainingSeconds(Math.ceil(status.remainingMs / 1000));
        }
      }
    };
    window.addEventListener("focus", handleVisibilityOrFocus);
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);

    return () => {
      if (exactTimeoutId) clearTimeout(exactTimeoutId);
      clearInterval(tickInterval);
      clearInterval(serverHeartbeatInterval);
      activityEvents.forEach((evt) =>
        window.removeEventListener(evt, handleUserActivity)
      );
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("focus", handleVisibilityOrFocus);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
    };
  }, [enabled, idleTimeoutMs]);

  return { remainingSeconds };
}
