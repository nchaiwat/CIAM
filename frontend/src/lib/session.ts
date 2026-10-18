"use client";

import { useEffect, useState } from "react";
import { API_BASE_URL } from "./api";

/**
 * Default SSO Portal Idle Session Timeout: 30 minutes (1,800,000 ms)
 * Note: Idle time is ONLY counted while the user is staying on the CIAM SSO Portal / Admin Console.
 * When the user navigates to a Spoke App Client (e.g., IRM, MTPulse, QMS), Portal Idle Time is NOT counted,
 * so when the user logs out from the App Client, they return directly to the CIAM SSO Portal (/portal)
 * with a fresh 30-minute Portal idle timer (provided the 8-hour JWT token itself has not expired).
 */
export const DEFAULT_IDLE_TIMEOUT_MINUTES = 30;
export const DEFAULT_IDLE_TIMEOUT_MS = DEFAULT_IDLE_TIMEOUT_MINUTES * 60 * 1000;
export const SERVER_SESSION_CHECK_INTERVAL_MS = 60 * 1000;

const STORAGE_TOKEN_KEY = "ciam_token";
const STORAGE_USER_KEY = "ciam_user";
const STORAGE_LAST_ACTIVITY_KEY = "ciam_last_activity";
const STORAGE_IN_SPOKE_APP_KEY = "ciam_in_spoke_app";
const SESSION_MANUAL_LOGOUT_KEY = "ciam_manual_logout";

let isManualLogoutInProgress = false;

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
 * Record user activity on the CIAM Portal and clear the "in spoke app" pause flag.
 */
export function markSessionActivity(): void {
  if (typeof window === "undefined") return;
  try {
    isManualLogoutInProgress = false;
    sessionStorage.removeItem(SESSION_MANUAL_LOGOUT_KEY);
    localStorage.setItem(STORAGE_LAST_ACTIVITY_KEY, String(Date.now()));
    localStorage.removeItem(STORAGE_IN_SPOKE_APP_KEY);
  } catch {}
}

/**
 * Mark that the user has launched / navigated to a Spoke App Client.
 * While in a Spoke App Client, SSO Portal Idle Time is paused and NOT counted.
 */
export function markNavigatingToSpokeApp(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_IN_SPOKE_APP_KEY, "1");
    localStorage.setItem(STORAGE_LAST_ACTIVITY_KEY, String(Date.now()));
  } catch {}
}

/**
 * Clear all CIAM session storage keys cleanly (Full Logout from CIAM).
 */
export function clearSessionStorage(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_TOKEN_KEY);
    localStorage.removeItem(STORAGE_USER_KEY);
    localStorage.removeItem(STORAGE_LAST_ACTIVITY_KEY);
    localStorage.removeItem(STORAGE_IN_SPOKE_APP_KEY);
  } catch {}
}

/**
 * Perform an intentional user-initiated logout without triggering any session-expired warning.
 */
export function performManualLogout(targetUrl: string = "/login"): void {
  if (typeof window === "undefined") return;
  try {
    isManualLogoutInProgress = true;
    sessionStorage.setItem(SESSION_MANUAL_LOGOUT_KEY, "1");
  } catch {}
  clearSessionStorage();
  window.location.replace(targetUrl);
}

/**
 * Check ONLY whether the underlying CIAM JWT token exists and has not passed its absolute `exp` (8 hours).
 * Used when returning from a Spoke App Client to /portal or /oauth/authorize so that time spent working
 * inside an App Client is never treated as Portal Idle Time.
 */
export function checkTokenValidOnReturn(): {
  valid: boolean;
  reason: "missing" | "token_expired" | null;
} {
  if (typeof window === "undefined") {
    return { valid: true, reason: null };
  }
  const token = localStorage.getItem(STORAGE_TOKEN_KEY);
  if (!token) {
    return { valid: false, reason: "missing" };
  }
  const jwtExpMs = getJwtExpirationMs(token);
  if (jwtExpMs !== null && Date.now() >= jwtExpMs) {
    return { valid: false, reason: "token_expired" };
  }
  return { valid: true, reason: null };
}

/**
 * Check if the current CIAM Portal session is expired either by JWT `exp` or by Portal Idle Timeout (30 mins).
 * If the user is currently flagged as working inside a Spoke App (`ciam_in_spoke_app === "1"`),
 * Portal Idle Timeout is paused and only JWT `exp` applies.
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

  // 1. Check JWT absolute expiration (`exp` claim, default 8 hours)
  const jwtExpMs = getJwtExpirationMs(token);
  if (jwtExpMs !== null && now >= jwtExpMs) {
    return { expired: true, reason: "token_expired", remainingMs: 0 };
  }

  // 2. If user is currently inside a Spoke App Client, do NOT count Portal Idle Time
  const inSpokeApp = localStorage.getItem(STORAGE_IN_SPOKE_APP_KEY) === "1";
  if (inSpokeApp) {
    const remaining = jwtExpMs !== null ? Math.max(0, jwtExpMs - now) : idleTimeoutMs;
    return {
      expired: false,
      reason: null,
      remainingMs: Math.min(remaining, idleTimeoutMs),
    };
  }

  // 3. Check Portal Idle Timeout (30 minutes of inactivity while on SSO Portal)
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
export function triggerImmediateLogoff(
  reason: "token_expired" | "idle_timeout" | "missing" | "revoked" = "token_expired"
): void {
  if (typeof window === "undefined") return;

  // If the user explicitly clicked Logout, never hijack the navigation with an expired=1 notice
  try {
    if (isManualLogoutInProgress || sessionStorage.getItem(SESSION_MANUAL_LOGOUT_KEY) === "1") {
      return;
    }
  } catch {}

  clearSessionStorage();

  const currentPath = window.location.pathname || "/portal";
  if (
    currentPath.includes("/login") ||
    currentPath.includes("/portal/callback") ||
    currentPath.includes("/oauth/authorize") ||
    currentPath.includes("/oauth/logout")
  ) {
    return;
  }

  const redirectTarget = encodeURIComponent(currentPath + (window.location.search || ""));

  // If token was simply missing (e.g. cleared in another tab or never logged in), redirect cleanly without expired=1
  if (reason === "missing") {
    window.location.replace(`/login?redirect=${redirectTarget}`);
    return;
  }

  window.location.replace(`/login?expired=1&reason=${reason}&redirect=${redirectTarget}`);
}

/**
 * Proactive React Hook for SSO Portal (/portal) and Admin Console.
 * - On arrival at /portal (including when returning after logging out from an App Client),
 *   verifies the JWT token is still valid and resets the 30-minute Portal Idle Timer to 30:00.
 * - While staying on /portal without going to an App Client, counts down the 30-minute Idle Timer
 *   and immediately logs off the exact second it reaches 00:00 WITHOUT waiting for any user action.
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

    // When entering/returning to SSO Portal (e.g. after logging out from a Spoke App Client),
    // verify the JWT token is valid and start a fresh 30-minute Portal Idle Timer!
    const tokenCheck = checkTokenValidOnReturn();
    if (!tokenCheck.valid) {
      triggerImmediateLogoff(tokenCheck.reason || "token_expired");
      return;
    }

    // Reset Portal Idle Timer to full 30 minutes upon entering/returning to Portal
    markSessionActivity();

    let exactTimeoutId: ReturnType<typeof setTimeout> | null = null;

    const scheduleExactDeadlineTimer = () => {
      if (exactTimeoutId) clearTimeout(exactTimeoutId);
      const status = checkSessionExpiration(idleTimeoutMs);
      if (status.expired) {
        triggerImmediateLogoff(status.reason || "token_expired");
        return;
      }
      setRemainingSeconds(Math.ceil(status.remainingMs / 1000));
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

    // Throttled user activity listener (updates ciam_last_activity at most every 5 seconds while on Portal)
    let lastRecordedAt = Date.now();
    const handleUserActivity = () => {
      const now = Date.now();
      if (now - lastRecordedAt >= 5000) {
        lastRecordedAt = now;
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

    // 1-second tick interval to update remaining time & trigger immediate zero-action logoff at 00:00
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
        // Ignore transient network hiccups
      }
    }, SERVER_SESSION_CHECK_INTERVAL_MS);

    // Cross-tab synchronization
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_TOKEN_KEY && !e.newValue) {
        triggerImmediateLogoff("missing");
      } else if (e.key === STORAGE_LAST_ACTIVITY_KEY && e.newValue) {
        scheduleExactDeadlineTimer();
      }
    };
    window.addEventListener("storage", handleStorageChange);

    // When returning to the Portal tab after being in a Spoke App, reset idle timer if coming back from spoke
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        const wasInSpoke = localStorage.getItem(STORAGE_IN_SPOKE_APP_KEY) === "1";
        if (wasInSpoke) {
          const validCheck = checkTokenValidOnReturn();
          if (!validCheck.valid) {
            triggerImmediateLogoff(validCheck.reason || "token_expired");
            return;
          }
          markSessionActivity();
          scheduleExactDeadlineTimer();
          return;
        }
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
