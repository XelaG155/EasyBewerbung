#!/usr/bin/env python3
"""
GitHub Webhook Receiver for EasyBewerbung automatic deployment with Telegram notifications.
Listens for push events and triggers git pull + docker compose rebuild.
"""

import hashlib
import hmac
import logging
import os
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

import requests
from dotenv import load_dotenv
from flask import Flask, request, jsonify

# Load environment variables from .env file
load_dotenv(Path(__file__).parent / ".env")

# Configuration
WEBHOOK_SECRET = os.getenv("WEBHOOK_SECRET", "easybewerbung-webhook-secret-change-me")
REPO_PATH = Path("/home/alexgiss/EasyBewerbung")
LOG_FILE = REPO_PATH / "webhook" / "deploy.log"

# Telegram Configuration (from environment variables)
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")
APP_NAME = "EasyBewerbung"

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

app = Flask(__name__)


def send_telegram(message: str) -> bool:
    """Send a message to Telegram."""
    try:
        url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
        payload = {
            "chat_id": TELEGRAM_CHAT_ID,
            "text": message,
            "parse_mode": "HTML",
            "disable_web_page_preview": True
        }
        response = requests.post(url, json=payload, timeout=10)
        response.raise_for_status()
        logger.info("Telegram notification sent")
        return True
    except Exception as e:
        logger.error(f"Failed to send Telegram notification: {e}")
        return False


def notify_new_push(commit: str, author: str, message: str):
    """Step 1: Notify about new push to GitHub."""
    text = (
        f"🔔 <b>{APP_NAME}: Neuer Code auf GitHub!</b>\n\n"
        f"📦 Commit: <code>{commit[:8]}</code>\n"
        f"👤 Author: {author}\n"
        f"📝 {message[:100]}\n\n"
        f"⏳ Starte Deployment...\n"
        f"🕐 {datetime.now().strftime('%H:%M:%S')}"
    )
    send_telegram(text)


def notify_pull_result(success: bool, output: str = ""):
    """Step 2: Notify about git pull result."""
    if success:
        text = (
            f"⬇️ <b>{APP_NAME}: Code heruntergeladen</b>\n\n"
            f"✅ Git pull erfolgreich\n"
            f"🕐 {datetime.now().strftime('%H:%M:%S')}"
        )
    else:
        text = (
            f"❌ <b>{APP_NAME}: Download FEHLGESCHLAGEN</b>\n\n"
            f"💥 Git pull fehlgeschlagen\n"
            f"📝 {output[:200]}\n"
            f"🕐 {datetime.now().strftime('%H:%M:%S')}"
        )
    send_telegram(text)


def notify_build_start():
    """Step 3: Notify that build is starting."""
    text = (
        f"🐳 <b>{APP_NAME}: Docker Build wird gestartet...</b>\n\n"
        f"⏳ Container werden neu gebaut\n"
        f"🕐 {datetime.now().strftime('%H:%M:%S')}"
    )
    send_telegram(text)


def notify_build_result(success: bool, duration: float, error: str = ""):
    """Step 4: Notify about build result."""
    if success:
        text = (
            f"📦 <b>{APP_NAME}: Build abgeschlossen</b>\n\n"
            f"✅ Backend + Frontend erfolgreich\n"
            f"⏱️ Dauer: {duration:.1f}s\n"
            f"🕐 {datetime.now().strftime('%H:%M:%S')}"
        )
    else:
        text = (
            f"❌ <b>{APP_NAME}: Build FEHLGESCHLAGEN</b>\n\n"
            f"💥 Build fehlgeschlagen\n"
            f"⏱️ Dauer: {duration:.1f}s\n"
            f"📝 Fehler: {error[:300]}\n"
            f"🕐 {datetime.now().strftime('%H:%M:%S')}"
        )
    send_telegram(text)


def notify_deployment_complete(success: bool, commit: str, total_duration: float, error: str = ""):
    """Step 5: Notify that deployment is complete."""
    if success:
        text = (
            f"🚀 <b>{APP_NAME}: Deployment ERFOLGREICH!</b>\n\n"
            f"✅ Neue Version läuft\n"
            f"📦 Commit: <code>{commit[:8]}</code>\n"
            f"⏱️ Gesamtdauer: {total_duration:.1f}s\n"
            f"🌐 https://app.easybewerbung.ch\n"
            f"🕐 {datetime.now().strftime('%H:%M:%S')}"
        )
    else:
        text = (
            f"❌ <b>{APP_NAME}: Deployment FEHLGESCHLAGEN</b>\n\n"
            f"💥 Services konnten nicht gestartet werden\n"
            f"📝 Fehler: {error[:300]}\n"
            f"🔧 Manuelle Prüfung erforderlich\n"
            f"🕐 {datetime.now().strftime('%H:%M:%S')}"
        )
    send_telegram(text)


def verify_signature(payload: bytes, signature: str) -> bool:
    """Verify GitHub webhook signature."""
    if not signature:
        return False

    expected = "sha256=" + hmac.new(
        WEBHOOK_SECRET.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()

    return hmac.compare_digest(expected, signature)


def run_command(cmd: list, cwd: Path = REPO_PATH, env: dict = None) -> tuple[bool, str]:
    """Run a shell command and return success status and output."""
    try:
        full_env = os.environ.copy()
        if env:
            full_env.update(env)
        result = subprocess.run(
            cmd,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=600,  # 10 minute timeout
            env=full_env
        )
        output = result.stdout + result.stderr
        return result.returncode == 0, output
    except subprocess.TimeoutExpired:
        return False, "Command timed out"
    except Exception as e:
        return False, str(e)


def run_shell(cmd: str, cwd: Path = REPO_PATH) -> tuple[bool, str]:
    """Run a shell command string and return success status and output."""
    try:
        result = subprocess.run(
            ["/bin/bash", "-c", cmd],
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=600
        )
        output = result.stdout + result.stderr
        return result.returncode == 0, output
    except subprocess.TimeoutExpired:
        return False, "Command timed out"
    except Exception as e:
        return False, str(e)


def deploy(commit: str, author: str, message: str) -> tuple[bool, str]:
    """Pull latest code and rebuild/restart Docker containers with notifications."""
    start_time = time.time()
    steps = []

    # Step 1: Notify new push
    notify_new_push(commit, author, message)

    # Step 2: Git pull
    logger.info("Pulling latest code...")
    success, output = run_command(["git", "pull", "origin", "main"])
    steps.append(f"git pull: {'OK' if success else 'FAILED'}")
    notify_pull_result(success, output)

    if not success:
        notify_deployment_complete(False, commit, time.time() - start_time, output)
        return False, "\n".join(steps)

    # Step 3: Notify build start
    notify_build_start()
    build_start = time.time()

    # Step 3a: Build Docker containers
    logger.info("Building Docker containers...")
    success, output = run_shell("docker-compose build --no-cache", cwd=REPO_PATH)
    build_duration = time.time() - build_start

    if not success:
        steps.append("docker build: FAILED")
        notify_build_result(False, build_duration, output[-500:])
        notify_deployment_complete(False, commit, time.time() - start_time, output[-300:])
        return False, "\n".join(steps)
    steps.append("docker build: OK")

    notify_build_result(True, build_duration)

    # Step 4: Restart Docker containers
    logger.info("Restarting Docker containers...")
    success, output = run_shell("docker-compose up -d", cwd=REPO_PATH)
    if not success:
        steps.append("docker up: FAILED")
        notify_deployment_complete(False, commit, time.time() - start_time, output)
        return False, "\n".join(steps)
    steps.append("docker up: OK")

    # Wait for services to start
    time.sleep(10)

    # Health check - check if containers are running
    success, output = run_shell("docker-compose ps", cwd=REPO_PATH)
    if success and "running" in output.lower():
        notify_deployment_complete(True, commit, time.time() - start_time)
        return True, "\n".join(steps)
    else:
        # Fallback check
        success, output = run_shell("docker ps | grep easybewerbung", cwd=REPO_PATH)
        if success and "Up" in output:
            notify_deployment_complete(True, commit, time.time() - start_time)
            return True, "\n".join(steps)
        notify_deployment_complete(False, commit, time.time() - start_time, "Docker containers not running")
        return False, "\n".join(steps)


@app.route("/webhook", methods=["POST"])
def webhook():
    """Handle GitHub webhook."""
    # Verify signature
    signature = request.headers.get("X-Hub-Signature-256", "")
    if not verify_signature(request.data, signature):
        logger.warning("Invalid webhook signature")
        return jsonify({"error": "Invalid signature"}), 401

    # Check if it's a push event
    event = request.headers.get("X-GitHub-Event", "")
    if event != "push":
        logger.info(f"Ignoring event: {event}")
        return jsonify({"status": "ignored", "event": event}), 200

    # Check if it's the main branch
    payload = request.json
    ref = payload.get("ref", "")
    if ref != "refs/heads/main":
        logger.info(f"Ignoring push to: {ref}")
        return jsonify({"status": "ignored", "ref": ref}), 200

    # Extract commit info
    commit = payload.get("after", "unknown")
    head_commit = payload.get("head_commit", {})
    author = head_commit.get("author", {}).get("name", "Unknown")
    message = head_commit.get("message", "No message")

    # Deploy
    logger.info(f"Deploying commit: {commit[:7]} by {author}")
    success, output = deploy(commit, author, message)

    if success:
        logger.info("Deployment successful!")
        return jsonify({"status": "success", "output": output[:1000]}), 200
    else:
        logger.error(f"Deployment failed: {output}")
        return jsonify({"status": "failed", "output": output[:1000]}), 500


@app.route("/webhook/health", methods=["GET"])
def health():
    """Health check endpoint."""
    return jsonify({"status": "ok", "time": datetime.now().isoformat()}), 200


@app.route("/webhook/test", methods=["GET"])
def test_notification():
    """Test Telegram notification."""
    text = (
        f"🧪 <b>{APP_NAME}: Test-Nachricht</b>\n\n"
        f"✅ Webhook funktioniert!\n"
        f"🕐 {datetime.now().strftime('%H:%M:%S')}"
    )
    success = send_telegram(text)
    return jsonify({"status": "sent" if success else "failed"}), 200 if success else 500


if __name__ == "__main__":
    # Ensure log directory exists
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)

    logger.info("Starting webhook server...")
    app.run(host="127.0.0.1", port=9002, debug=False)
