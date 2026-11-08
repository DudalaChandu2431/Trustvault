import time
from collections import defaultdict
from fastapi import Request, HTTPException, status

class InMemoryRateLimiter:
    """Sliding-window in-memory IP rate limiter protecting against brute-force and DDoS."""
    def __init__(self):
        # Maps key -> list of timestamps
        self.requests: dict[str, list[float]] = defaultdict(list)

    def check_rate_limit(self, key: str, max_requests: int, window_seconds: int):
        now = time.time()
        cutoff = now - window_seconds
        
        # Prune old timestamps
        timestamps = [ts for ts in self.requests[key] if ts > cutoff]
        self.requests[key] = timestamps

        if len(timestamps) >= max_requests:
            retry_after = int(window_seconds - (now - timestamps[0])) + 1
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded. Too many requests. Try again in {retry_after} seconds.",
                headers={"Retry-After": str(retry_after)}
            )
        
        self.requests[key].append(now)

limiter = InMemoryRateLimiter()

def rate_limit(max_requests: int, window_seconds: int):
    """FastAPI Dependency for route-level rate limiting by client IP."""
    async def dependency(request: Request):
        client_ip = request.client.host if request.client else "unknown"
        path = request.url.path
        key = f"{client_ip}:{path}"
        limiter.check_rate_limit(key, max_requests, window_seconds)
    return dependency
