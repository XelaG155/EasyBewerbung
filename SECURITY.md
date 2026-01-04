# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in EasyBewerbung, please report it by opening a GitHub issue or contacting the maintainers directly. We take security seriously and will respond promptly to address any issues.

## Security Best Practices

### For Developers

1. **Never Commit Secrets**
   - Never commit `.env` files with actual credentials
   - Use `.env.example` or `.env.docker.example` as templates only
   - Keep API keys, passwords, and tokens in environment variables
   - Review commits before pushing to ensure no secrets are included

2. **Authentication & Authorization**
   - All authenticated endpoints use JWT tokens
   - User-isolated data queries prevent unauthorized access
   - Admin endpoints require admin role verification
   - Rate limiting is enabled on authentication endpoints

3. **Input Validation**
   - All API inputs are validated using Pydantic schemas
   - File uploads are validated by extension, magic number, and size
   - HTML content is sanitized to prevent XSS attacks
   - URLs are validated to prevent SSRF attacks

4. **File Upload Security**
   - File type validation using magic numbers (not just extensions)
   - Maximum file size: 25MB
   - Files stored in user-specific directories
   - Filenames are sanitized and use UUIDs
   - No path traversal vulnerabilities

5. **Database Security**
   - All queries use SQLAlchemy ORM (prevents SQL injection)
   - User data is isolated by user_id
   - Passwords are hashed using bcrypt
   - PostgreSQL in production (not SQLite)

### For Administrators

1. **Environment Configuration**
   - Generate secure SECRET_KEY: `openssl rand -hex 32`
   - Use strong database passwords (16+ characters)
   - Rotate API keys regularly
   - Never use default credentials in production

2. **Production Deployment**
   - Enable HTTPS with valid SSL certificates
   - Configure CORS to allow only trusted domains
   - Set up rate limiting for all endpoints
   - Enable security headers (CSP, HSTS, X-Frame-Options)
   - Use environment variables, not committed .env files

3. **Monitoring & Logging**
   - Monitor failed login attempts
   - Set up alerts for suspicious activity
   - Regularly review application logs
   - Keep track of API usage and costs

4. **Updates & Maintenance**
   - Keep dependencies updated (`pip-audit`, `npm audit`)
   - Apply security patches promptly
   - Review security advisories for used packages
   - Perform regular security audits

## Known Security Considerations

### Password Requirements
- Minimum length: 8 characters
- **Recommendation**: Implement password complexity requirements in future updates

### JWT Token Storage
- Currently stored in browser localStorage
- **Recommendation**: Consider httpOnly cookies for better XSS protection

### CSRF Protection
- **Status**: Not currently implemented
- **Recommendation**: Implement CSRF tokens for state-changing operations

### Rate Limiting
- Enabled on authentication endpoints (login, register)
- **Recommendation**: Extend to all authenticated endpoints

## Security Features

✅ **Implemented**:
- JWT authentication with token expiration
- Bcrypt password hashing
- User-isolated data queries
- File upload validation (type, size, magic number)
- XSS protection in HTML sanitization
- SSRF protection in job URL scraping
- SQL injection prevention via ORM
- Rate limiting on authentication endpoints
- Admin authorization checks
- CORS protection

⚠️ **Recommended Improvements**:
- Add CSRF protection
- Move JWT tokens to httpOnly cookies
- Implement password complexity requirements
- Add account lockout after failed login attempts
- Extend rate limiting to all endpoints
- Implement security headers (CSP, HSTS)
- Add dependency vulnerability scanning to CI/CD

## Dependency Security

### Backend (Python)
- Run `pip-audit` regularly to check for vulnerabilities
- Keep FastAPI, SQLAlchemy, and other packages updated
- Review security advisories for cryptographic libraries

### Frontend (Node.js)
- Run `npm audit` regularly
- Keep Next.js, React, and dependencies updated
- Monitor for XSS vulnerabilities in third-party components

## Compliance

This application handles personal data (CVs, job applications) and should comply with:
- **GDPR** (if serving EU users)
- **Data retention policies**
- **Right to deletion** (user data removal)
- **Data export** (user data portability)

## Contact

For security concerns, please open a GitHub issue or contact the maintainers.
