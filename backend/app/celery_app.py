"""
Celery application configuration for EasyBewerbung.

This module configures Celery for background task processing with Redis as the broker.
Workers can be scaled independently of the web server.
"""

import os

from celery import Celery
from dotenv import load_dotenv

load_dotenv()

# Redis URL for Celery broker and result backend
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# Create Celery app
celery_app = Celery(
    "easybewerbung",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=["app.tasks"],  # Module containing task definitions
)

# Celery configuration
celery_app.conf.update(
    # Task settings
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,

    # Task execution settings
    task_acks_late=True,  # Acknowledge after task completes (safer)
    task_reject_on_worker_lost=True,  # Retry if worker crashes

    # Result settings
    result_expires=3600,  # Results expire after 1 hour

    # Worker settings
    worker_prefetch_multiplier=1,  # Process one task at a time per worker
    worker_concurrency=4,  # Number of concurrent tasks per worker

    # Rate limiting (respect OpenAI rate limits)
    task_default_rate_limit="10/m",  # Default: 10 tasks per minute

    # Retry settings
    task_default_retry_delay=60,  # Wait 60 seconds before retry
    task_max_retries=3,  # Maximum 3 retries
)

# Task routes (optional - for future scaling with dedicated queues)
celery_app.conf.task_routes = {
    "app.tasks.calculate_matching_score_task": {"queue": "matching"},
    "app.tasks.generate_documents_task": {"queue": "generation"},
}
