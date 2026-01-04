"""
CSRF Protection Middleware for FastAPI

Implements double-submit cookie pattern for CSRF protection.
"""
import secrets
import logging
import os
from typing import Callable
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response, JSONResponse
from fastapi import status

logger = logging.getLogger(__name__)

# Methods that require CSRF protection
CSRF_PROTECTED_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

# Paths that are exempt from CSRF protection
CSRF_EXEMPT_PATHS = {
    "/users/login",
    "/users/register",
    "/users/google",
}


class CSRFMiddleware(BaseHTTPMiddleware):
    """
    CSRF protection middleware using double-submit cookie pattern.

    - For GET requests: Generate and set a CSRF token cookie if not present
    - For state-changing requests (POST, PUT, PATCH, DELETE): Verify CSRF token
    """

    def __init__(self, app, cookie_name: str = "csrf_token", header_name: str = "X-CSRF-Token"):
        super().__init__(app)
        self.cookie_name = cookie_name
        self.header_name = header_name

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Skip CSRF protection for exempt paths
        if request.url.path in CSRF_EXEMPT_PATHS:
            return await call_next(request)

        # Skip CSRF for safe methods (GET, HEAD, OPTIONS)
        if request.method not in CSRF_PROTECTED_METHODS:
            response = await call_next(request)

            # Set CSRF cookie if not present
            if self.cookie_name not in request.cookies:
                csrf_token = secrets.token_urlsafe(32)
                # Use secure=True in production, False in development
                is_production = os.getenv("ENVIRONMENT", "production") == "production"
                response.set_cookie(
                    key=self.cookie_name,
                    value=csrf_token,
                    httponly=False,  # JavaScript needs to read this to send it in headers
                    secure=is_production,  # Only send over HTTPS in production
                    samesite="strict",
                    max_age=3600 * 24,  # 24 hours
                )
            return response

        # For state-changing methods, verify CSRF token
        csrf_cookie = request.cookies.get(self.cookie_name)
        csrf_header = request.headers.get(self.header_name)

        if not csrf_cookie or not csrf_header:
            logger.warning(
                f"CSRF validation failed: Missing token for {request.method} {request.url.path}"
            )
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={"detail": "CSRF token missing"},
            )

        # Use constant-time comparison to prevent timing attacks
        if not secrets.compare_digest(csrf_cookie, csrf_header):
            logger.warning(
                f"CSRF validation failed: Token mismatch for {request.method} {request.url.path}"
            )
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={"detail": "CSRF token invalid"},
            )

        # CSRF token is valid, proceed with request
        return await call_next(request)
