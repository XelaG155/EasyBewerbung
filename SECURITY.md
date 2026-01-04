# Security Policy

## Overview

EasyBewerbung takes security seriously. This document outlines our security features, best practices, and how to report security vulnerabilities.

## Implemented Security Features

### Authentication & Authorization

- **JWT-based Authentication**: Secure token-based authentication with configurable expiration (7 days default)
- **Bcrypt Password Hashing**: Industry-standard password hashing with automatic salt generation
- **Password Complexity Requirements**:
  - Minimum 8 characters
  - At least one uppercase letter
  - At least one lowercase letter
  - At least one number
  - At least one special character
- **Account Lockout Mechanism**:
  - Accounts are locked for 15 minutes after 5 failed login attempts
  - Automatic unlock after the lockout period expires
  - Failed login attempts are tracked and reset upon successful login
- **Admin Role-Based Access Control**: Admin-only endpoints require JWT authentication with admin privileges
- **OAuth Integration**: Secure Google OAuth 2.0 integration for passwordless authentication

### Rate Limiting

Rate limiting is implemented on sensitive endpoints to prevent abuse:
- Authentication endpoints: 5-10 requests/minute
- Document upload: 10 requests/minute
- Application creation: 20 requests/minute
- Document generation: 10 requests/minute
- Admin endpoints: 5 requests/minute

### CSRF Protection

- **CSRF Middleware Available**: Double-submit cookie pattern implementation
- **Status**: Implemented but disabled by default (requires frontend integration)
- **To Enable**: Uncomment `CSRFMiddleware` in `backend/app/main.py`
- **Frontend Requirements**: Send `X-CSRF-Token` header matching the `csrf_token` cookie

### File Upload Security

- **Extension Validation**: Only allows `.pdf`, `.doc`, `.docx`, `.txt` files
- **Magic Number Verification**: Validates file type using magic numbers (not just extension)
- **Path Traversal Prevention**:
  - Filename sanitization removes path separators and dangerous characters
  - Uses UUID prefixes for unique filenames
- **File Size Limits**: Maximum 25MB per upload
- **Chunked Reading**: Prevents memory exhaustion attacks
- **User Isolation**: Files stored in user-specific directories

### SSRF Protection (Job Scraping)

- **URL Scheme Validation**: Only allows `http://` and `https://` schemes
- **Private IP Blocking**: Blocks requests to private IP ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 127.0.0.0/8)
- **Localhost Blocking**: Prevents access to localhost and 127.0.0.1
- **Timeout Protection**: 10-second timeout on external requests

### XSS Protection

- **HTML Sanitization**: BeautifulSoup used to sanitize scraped HTML content
- **Parameterized Queries**: SQLAlchemy ORM prevents SQL injection
- **Content-Type Headers**: Proper content-type headers on all responses

### SQL Injection Prevention

- **ORM Usage**: SQLAlchemy ORM with parameterized queries throughout
- **No Raw SQL**: Avoids raw SQL queries with user input
- **Migration Safety**: Alembic migrations use SQLAlchemy operations (not string interpolation)

### API Security

- **CORS Configuration**: Configurable allowed origins via environment variables
- **Credential Validation**: User-isolated queries prevent unauthorized data access
- **Secure Headers**: HTTPOnly cookies for sensitive data (when cookie auth is enabled)

## Security Considerations & Recommendations

### High Priority Recommendations

#### 1. Enable CSRF Protection
**Current Status**: Implemented but disabled
**Action Required**:
1. Update frontend to read `csrf_token` cookie
2. Send token in `X-CSRF-Token` header for all state-changing requests
3. Uncomment `CSRFMiddleware` in `backend/app/main.py`

#### 2. Implement HttpOnly Cookie Authentication (Optional Enhancement)
**Current Status**: JWT tokens returned in response body (client stores in localStorage)
**Security Improvement**: Use httpOnly cookies to prevent XSS attacks from stealing tokens
**Trade-off**: Requires CORS configuration changes and may complicate mobile app integration

### Medium Priority Recommendations

#### 3. Environment Variables
**Critical**:
- Never commit `.env`, `.env.docker`, or similar files with real credentials
- Rotate `SECRET_KEY` regularly in production
- Use strong, unique values for `ADMIN_TOKEN`, `OPENAI_API_KEY`, etc.
- Verify production `SECRET_KEY` is cryptographically random (use `openssl rand -hex 32`)

#### 4. HTTPS Enforcement
**Production**: Always use HTTPS in production environments
- Set `secure=True` on cookies
- Configure reverse proxy (nginx/traefik) to enforce HTTPS
- Use HSTS headers

#### 5. Dependency Security
**Ongoing**:
- Regularly update dependencies: `pip list --outdated`
- Review security advisories: `safety check`
- Pin dependency versions in `requirements.txt`

#### 6. Database Security
- Use strong PostgreSQL passwords
- Limit database user privileges (application shouldn't have DROP/CREATE DATABASE)
- Enable PostgreSQL SSL connections in production
- Regular backups with encryption

#### 7. Logging & Monitoring
- **Current**: Basic logging for authentication events and admin actions
- **Recommendation**:
  - Implement centralized logging (e.g., ELK stack, CloudWatch)
  - Set up alerts for suspicious activity (multiple failed logins, unusual API patterns)
  - Log retention policy for compliance

### API Token Management

**Current Admin Token Approach** (DEPRECATED):
- Static `ADMIN_TOKEN` in environment variables (removed in latest security update)
- **New Approach**: JWT-based admin authentication with `is_admin` role check

**Recommendation**:
- Ensure at least one admin user exists in the database with `is_admin=True`
- Use standard JWT authentication for admin operations
- Consider implementing MFA for admin accounts

## GDPR Compliance Considerations

As a job application platform handling personal data:

1. **Data Minimization**: Only collect necessary user information
2. **User Rights**: Implement account deletion functionality (allows users to delete their data)
3. **Privacy Policy**: Display and require acceptance during registration
4. **Data Retention**: Consider implementing automatic deletion of old applications
5. **Audit Logs**: User activity logs track data access and modifications

## Reporting Security Vulnerabilities

If you discover a security vulnerability, please:

1. **Do NOT** open a public GitHub issue
2. Email the maintainers directly (check repository for contact)
3. Provide detailed information about the vulnerability
4. Allow reasonable time for a fix before public disclosure

## Security Checklist for Deployment

- [ ] `SECRET_KEY` is set to a strong, random value (not the default)
- [ ] All sensitive environment variables are set and not committed to git
- [ ] HTTPS is enforced (CORS allows only HTTPS origins)
- [ ] Database uses strong passwords and restricted privileges
- [ ] Rate limiting is enabled and configured
- [ ] File upload directory has proper permissions
- [ ] Logs are monitored for security events
- [ ] Dependencies are up-to-date
- [ ] Backups are configured and tested
- [ ] At least one admin user exists with `is_admin=True`
- [ ] CSRF protection is enabled (after frontend integration)

## Security Updates

**2026-01-04**: Major security improvements
- Added password complexity requirements
- Implemented account lockout mechanism (5 failed attempts = 15min lock)
- Added rate limiting to document upload and application endpoints
- Replaced static admin token with JWT admin role check
- Implemented CSRF protection middleware (ready for frontend integration)
- Added migration for security-related database fields

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [FastAPI Security Best Practices](https://fastapi.tiangolo.com/tutorial/security/)
- [SQLAlchemy Security Considerations](https://docs.sqlalchemy.org/en/14/faq/security.html)
