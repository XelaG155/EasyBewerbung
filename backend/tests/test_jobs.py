"""Tests for job scraping and analysis functionality."""
import pytest
from unittest.mock import Mock, patch
from fastapi import HTTPException

from app.api.endpoints.jobs import (
    scrape_job_offer,
    validate_url_safety,
    sanitize_html_text,
    MAX_DESCRIPTION_LENGTH,
)


class TestURLValidation:
    """Test SSRF protection and URL validation."""

    def test_valid_https_url(self):
        """Valid HTTPS URLs should pass validation."""
        validate_url_safety("https://example.com/job-posting")
        # Should not raise an exception

    def test_valid_http_url(self):
        """Valid HTTP URLs should pass validation."""
        validate_url_safety("http://example.com/job-posting")
        # Should not raise an exception

    def test_invalid_scheme(self):
        """Invalid URL schemes should be rejected."""
        with pytest.raises(HTTPException) as exc_info:
            validate_url_safety("ftp://example.com/job")
        assert exc_info.value.status_code == 400
        assert "scheme" in str(exc_info.value.detail).lower()

    def test_localhost_blocked(self):
        """Localhost URLs should be blocked."""
        with pytest.raises(HTTPException) as exc_info:
            validate_url_safety("http://localhost/job")
        assert exc_info.value.status_code == 400
        assert "local" in str(exc_info.value.detail).lower()

    def test_127_0_0_1_blocked(self):
        """127.0.0.1 URLs should be blocked."""
        with pytest.raises(HTTPException) as exc_info:
            validate_url_safety("http://127.0.0.1/job")
        assert exc_info.value.status_code == 400

    def test_private_ip_10_x_blocked(self):
        """Private IP addresses (10.x.x.x) should be blocked."""
        with pytest.raises(HTTPException) as exc_info:
            validate_url_safety("http://10.0.0.1/job")
        assert exc_info.value.status_code == 400
        assert "private" in str(exc_info.value.detail).lower()

    def test_private_ip_192_168_blocked(self):
        """Private IP addresses (192.168.x.x) should be blocked."""
        with pytest.raises(HTTPException) as exc_info:
            validate_url_safety("http://192.168.1.1/job")
        assert exc_info.value.status_code == 400

    def test_private_ip_172_16_blocked(self):
        """Private IP addresses (172.16.x.x) should be blocked."""
        with pytest.raises(HTTPException) as exc_info:
            validate_url_safety("http://172.16.0.1/job")
        assert exc_info.value.status_code == 400

    def test_ipv6_localhost_blocked(self):
        """IPv6 localhost should be blocked."""
        with pytest.raises(HTTPException) as exc_info:
            validate_url_safety("http://[::1]/job")
        assert exc_info.value.status_code == 400


class TestHTMLSanitization:
    """Test HTML sanitization to prevent XSS."""

    def test_remove_html_tags(self):
        """HTML tags should be removed."""
        text = "This is a <b>job</b> description"
        result = sanitize_html_text(text)
        assert "<b>" not in result
        assert "</b>" not in result
        assert "job" in result

    def test_remove_script_tags(self):
        """Script tags should be removed."""
        text = "Job description <script>alert('xss')</script> here"
        result = sanitize_html_text(text)
        assert "<script>" not in result
        assert "alert" not in result

    def test_remove_event_handlers(self):
        """Event handlers should be removed."""
        text = "Click here onclick='malicious()' for details"
        result = sanitize_html_text(text)
        assert "onclick" not in result or "malicious" not in result

    def test_normalize_whitespace(self):
        """Multiple spaces should be normalized."""
        text = "Job    description    with    spaces"
        result = sanitize_html_text(text)
        assert "    " not in result

    def test_plain_text_unchanged(self):
        """Plain text should pass through safely."""
        text = "This is a normal job description"
        result = sanitize_html_text(text)
        assert result == text


class TestJobScraping:
    """Test job scraping functionality."""

    @patch('app.api.endpoints.jobs.requests.get')
    def test_scrape_with_main_content(self, mock_get):
        """Scraping should extract content from main element."""
        html = """
        <html>
            <head><title>Job Posting</title></head>
            <body>
                <nav>Navigation menu</nav>
                <main>
                    <h1>Senior Software Engineer</h1>
                    <div class="company">TechCorp Inc.</div>
                    <p>We are looking for a talented software engineer with 5+ years of experience.</p>
                    <p>You will work on cutting-edge technologies and challenging problems.</p>
                </main>
                <footer>Copyright 2025</footer>
            </body>
        </html>
        """
        mock_response = Mock()
        mock_response.content = html.encode('utf-8')
        mock_response.raise_for_status = Mock()
        mock_get.return_value = mock_response

        result = scrape_job_offer("https://example.com/job")

        assert result["title"] == "Senior Software Engineer"
        assert "software engineer" in result["description"].lower()
        assert "cutting-edge" in result["description"].lower()
        # Navigation and footer should be removed
        assert "navigation" not in result["description"].lower()
        assert "copyright" not in result["description"].lower()

    @patch('app.api.endpoints.jobs.requests.get')
    def test_scrape_filters_short_paragraphs(self, mock_get):
        """Short paragraphs (UI elements) should be filtered out."""
        html = """
        <html>
            <body>
                <main>
                    <h1>Job Title</h1>
                    <p>Apply</p>
                    <p>This is a proper job description with enough text to be considered real content and not a UI element.</p>
                    <p>OK</p>
                    <p>Another substantial paragraph describing the role and responsibilities in detail.</p>
                </main>
            </body>
        </html>
        """
        mock_response = Mock()
        mock_response.content = html.encode('utf-8')
        mock_response.raise_for_status = Mock()
        mock_get.return_value = mock_response

        result = scrape_job_offer("https://example.com/job")

        # Short paragraphs like "Apply" and "OK" should be filtered out
        assert "Apply" not in result["description"]
        assert "OK" not in result["description"]
        # Long paragraphs should be included
        assert "proper job description" in result["description"]
        assert "responsibilities" in result["description"]

    @patch('app.api.endpoints.jobs.requests.get')
    def test_scrape_filters_ui_keywords(self, mock_get):
        """Paragraphs with UI keywords should be filtered out."""
        html = """
        <html>
            <body>
                <main>
                    <h1>Job Title</h1>
                    <p>This is a legitimate job description for the role we are hiring for.</p>
                    <p>Click Apply Now to submit your application and join our team today.</p>
                    <p>We use cookies to improve your experience on our website.</p>
                    <p>Salary estimator based on your experience and location.</p>
                </main>
            </body>
        </html>
        """
        mock_response = Mock()
        mock_response.content = html.encode('utf-8')
        mock_response.raise_for_status = Mock()
        mock_get.return_value = mock_response

        result = scrape_job_offer("https://example.com/job")

        # Legitimate description should be included
        assert "legitimate job description" in result["description"]
        # UI elements should be filtered
        assert "apply now" not in result["description"].lower()
        assert "cookies" not in result["description"].lower()
        assert "salary estimator" not in result["description"].lower()

    @patch('app.api.endpoints.jobs.requests.get')
    def test_scrape_respects_length_limit(self, mock_get):
        """Description should be limited to MAX_DESCRIPTION_LENGTH."""
        # Create a very long description
        long_paragraph = "This is a very long paragraph. " * 200
        html = f"""
        <html>
            <body>
                <main>
                    <h1>Job Title</h1>
                    <p>{long_paragraph}</p>
                </main>
            </body>
        </html>
        """
        mock_response = Mock()
        mock_response.content = html.encode('utf-8')
        mock_response.raise_for_status = Mock()
        mock_get.return_value = mock_response

        result = scrape_job_offer("https://example.com/job")

        assert len(result["description"]) <= MAX_DESCRIPTION_LENGTH

    @patch('app.api.endpoints.jobs.requests.get')
    def test_scrape_handles_missing_title(self, mock_get):
        """Scraping should handle pages without a clear title."""
        html = """
        <html>
            <body>
                <main>
                    <p>Job description without a title element.</p>
                </main>
            </body>
        </html>
        """
        mock_response = Mock()
        mock_response.content = html.encode('utf-8')
        mock_response.raise_for_status = Mock()
        mock_get.return_value = mock_response

        result = scrape_job_offer("https://example.com/job")

        # Should not crash, title can be None
        assert "title" in result

    @patch('app.api.endpoints.jobs.requests.get')
    def test_scrape_removes_navigation_elements(self, mock_get):
        """Navigation, header, and footer elements should be removed."""
        html = """
        <html>
            <body>
                <nav>Home | Jobs | Contact</nav>
                <header>Website Header</header>
                <main>
                    <h1>Job Title</h1>
                    <p>This is the actual job description that should be extracted.</p>
                </main>
                <aside>Sidebar content</aside>
                <footer>Footer content</footer>
            </body>
        </html>
        """
        mock_response = Mock()
        mock_response.content = html.encode('utf-8')
        mock_response.raise_for_status = Mock()
        mock_get.return_value = mock_response

        result = scrape_job_offer("https://example.com/job")

        # Main content should be present
        assert "actual job description" in result["description"]
        # UI elements should be removed
        assert "home" not in result["description"].lower()
        assert "website header" not in result["description"].lower()
        assert "sidebar" not in result["description"].lower()
        assert "footer content" not in result["description"].lower()

    @patch('app.api.endpoints.jobs.requests.get')
    def test_scrape_sanitizes_content(self, mock_get):
        """Content should be sanitized to prevent XSS."""
        html = """
        <html>
            <body>
                <main>
                    <h1>Job <script>alert('xss')</script> Title</h1>
                    <p>Description with <b>HTML tags</b> that should be removed.</p>
                </main>
            </body>
        </html>
        """
        mock_response = Mock()
        mock_response.content = html.encode('utf-8')
        mock_response.raise_for_status = Mock()
        mock_get.return_value = mock_response

        result = scrape_job_offer("https://example.com/job")

        # Script tags should be removed
        assert "<script>" not in result["title"]
        assert "alert" not in result["title"]
        # HTML tags should be removed from description
        assert "<b>" not in result["description"]
        assert "</b>" not in result["description"]

    @patch('app.api.endpoints.jobs.requests.get')
    def test_scrape_timeout_error(self, mock_get):
        """Timeout errors should be handled gracefully."""
        import requests
        mock_get.side_effect = requests.Timeout("Request timed out")

        with pytest.raises(HTTPException) as exc_info:
            scrape_job_offer("https://example.com/job")

        assert exc_info.value.status_code == 400
        assert "timed out" in str(exc_info.value.detail).lower()

    @patch('app.api.endpoints.jobs.requests.get')
    def test_scrape_request_error(self, mock_get):
        """Request errors should be handled gracefully."""
        import requests
        mock_get.side_effect = requests.RequestException("Network error")

        with pytest.raises(HTTPException) as exc_info:
            scrape_job_offer("https://example.com/job")

        assert exc_info.value.status_code == 400
        assert "could not fetch" in str(exc_info.value.detail).lower()

    @patch('app.api.endpoints.jobs.requests.get')
    def test_scrape_response_too_large(self, mock_get):
        """Very large responses should be rejected."""
        # Create a response larger than 5MB
        large_content = b"x" * (6 * 1024 * 1024)
        mock_response = Mock()
        mock_response.content = large_content
        mock_response.raise_for_status = Mock()
        mock_get.return_value = mock_response

        with pytest.raises(HTTPException) as exc_info:
            scrape_job_offer("https://example.com/job")

        assert exc_info.value.status_code == 400
        assert "too large" in str(exc_info.value.detail).lower()

    def test_scrape_rejects_localhost(self):
        """Localhost URLs should be rejected before making request."""
        with pytest.raises(HTTPException) as exc_info:
            scrape_job_offer("http://localhost/job")

        assert exc_info.value.status_code == 400

    def test_scrape_rejects_private_ips(self):
        """Private IP addresses should be rejected before making request."""
        with pytest.raises(HTTPException) as exc_info:
            scrape_job_offer("http://192.168.1.1/job")

        assert exc_info.value.status_code == 400
