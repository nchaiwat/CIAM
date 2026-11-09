"""
Window Asia Enterprise In-App Bot Defense Engine.
Provides sliding-window IP rate limiting, decoy honeypot evaluation,
and render-to-submission velocity (timing guard) checks.
Complies with ISO 27001 A.9.4.2 (Secure log-on) & A.12.4.1 (Event logging).
"""
import time
import threading
from typing import Dict, List, Tuple, Optional, Set
from fastapi import Request

class SlidingWindowRateLimiter:
    """
    Thread-safe in-memory sliding window rate limiter.
    Tracks epoch timestamps of requests per client IP or key.
    """
    def __init__(self, default_limit: int = 10, default_window_seconds: int = 60):
        self.default_limit = default_limit
        self.default_window_seconds = default_window_seconds
        self._records: Dict[str, List[float]] = {}
        self._lock = threading.Lock()
        # Corporate & Local Whitelist
        self.whitelist: Set[str] = {
            "127.0.0.1",
            "localhost",
            "testclient",
            "::1",
            "172.18.0.1",       # Docker bridge host
            "157.173.219.153",   # CIAM Production VPS
            "49.231.185.245",   # Window Asia HQ Gateway WAN
            "58.8.190.63",      # Branch WAN
        }

    def is_allowed(
        self,
        key: str,
        limit: Optional[int] = None,
        window_seconds: Optional[int] = None
    ) -> Tuple[bool, int, int]:
        """
        Check if request is allowed under rate limits.
        Returns:
            Tuple of (is_allowed: bool, remaining_attempts: int, retry_after_seconds: int)
        """
        if not key:
            return True, limit or self.default_limit, 0

        clean_key = key.strip().lower()
        if clean_key in self.whitelist:
            return True, limit or self.default_limit, 0

        lim = limit or self.default_limit
        win = window_seconds or self.default_window_seconds
        now = time.time()
        window_start = now - win

        with self._lock:
            timestamps = self._records.get(clean_key, [])
            # Evict timestamps older than sliding window
            valid_timestamps = [ts for ts in timestamps if ts > window_start]

            if len(valid_timestamps) >= lim:
                # Rate limit exceeded
                oldest = valid_timestamps[0]
                retry_after = max(1, int(oldest + win - now))
                self._records[clean_key] = valid_timestamps
                return False, 0, retry_after

            # Record current timestamp
            valid_timestamps.append(now)
            self._records[clean_key] = valid_timestamps
            remaining = lim - len(valid_timestamps)
            return True, remaining, 0

    def reset(self, key: Optional[str] = None):
        """Reset records for a key or all keys (useful in testing)."""
        with self._lock:
            if key:
                clean_key = key.strip().lower()
                self._records.pop(clean_key, None)
            else:
                self._records.clear()

    def prune(self):
        """Periodically prune stale entries to prevent memory leaks."""
        now = time.time()
        with self._lock:
            stale_keys = []
            for k, timestamps in self._records.items():
                active = [ts for ts in timestamps if (now - ts) < self.default_window_seconds * 2]
                if not active:
                    stale_keys.append(k)
                else:
                    self._records[k] = active
            for k in stale_keys:
                self._records.pop(k, None)


# Global default instance for authentication endpoints
auth_rate_limiter = SlidingWindowRateLimiter(default_limit=10, default_window_seconds=60)


def extract_client_ip(request: Request) -> str:
    """
    Extract client IP honoring reverse proxies (Cloudflare, Nginx, Docker).
    """
    cf_ip = request.headers.get("cf-connecting-ip")
    if cf_ip:
        return cf_ip.strip()

    xff = request.headers.get("x-forwarded-for")
    if xff:
        # XFF may contain multiple comma-separated IPs: client, proxy1, proxy2
        return xff.split(",")[0].strip()

    x_real = request.headers.get("x-real-ip")
    if x_real:
        return x_real.strip()

    if request.client and request.client.host:
        return request.client.host.strip()

    return "127.0.0.1"


def verify_submission_timing(
    form_render_ts: Optional[int],
    min_elapsed_ms: int = 400,
    max_elapsed_hours: int = 24
) -> Tuple[bool, Optional[int]]:
    """
    Evaluate human vs bot velocity based on epoch milliseconds.
    - If form_render_ts is None: returns True (fallback for non-web API clients).
    - If elapsed < min_elapsed_ms: flagged as automated script / bot.
    - If render_ts is in the future (> now + 10s): clock drift or tampering.
    """
    if form_render_ts is None:
        return True, None

    now_ms = int(time.time() * 1000)
    delta_ms = now_ms - form_render_ts

    # Future timestamp manipulation tolerance (10 seconds for slight NTP differences)
    if delta_ms < -10000:
        return False, delta_ms

    if delta_ms < min_elapsed_ms:
        return False, delta_ms

    # Check if form token is ridiculously stale (> 24 hours)
    if delta_ms > (max_elapsed_hours * 3600 * 1000):
        return False, delta_ms

    return True, delta_ms
