#!/bin/bash

# EasyBewerbung Deployment Script
# Called by CI/CD monitor when changes are detected

set -e  # Exit on any error

# Configuration
REPO_DIR="/home/alexgiss/EasyBewerbung"
LOG_FILE="$REPO_DIR/logs/deploy.log"
RESTART_SCRIPT="$REPO_DIR/restart_service.sh"

# Function to log messages with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Main deployment function
deploy() {
    log "=== Starting EasyBewerbung Deployment ==="

    cd "$REPO_DIR"

    # Stash any local changes
    if [ -n "$(git status --porcelain)" ]; then
        log "Stashing local changes"
        git stash
    fi

    # Get current commit (passed as argument by CI/CD monitor)
    local old_commit="${1:-$(git rev-parse HEAD)}"
    log "Current commit: $old_commit"

    # Pull latest changes with timeout
    log "Pulling latest changes from GitHub"
    if ! timeout 60 git -c core.sshCommand="ssh -o ConnectTimeout=10" fetch origin main; then
        log "ERROR: Git fetch timed out or failed"
        return 1
    fi

    local new_commit="${2:-$(git rev-parse origin/main)}"
    log "Latest commit: $new_commit"

    if [ "$old_commit" = "$new_commit" ]; then
        log "No new changes found"
        return 0
    fi

    log "New changes detected, updating..."
    git reset --hard origin/main

    # Make scripts executable
    log "Updating file permissions..."
    chmod +x *.sh 2>/dev/null || true

    # Call restart script
    log "Calling restart script..."
    if [ -f "$RESTART_SCRIPT" ]; then
        bash "$RESTART_SCRIPT"
    else
        log "ERROR: Restart script not found at $RESTART_SCRIPT"
        return 1
    fi

    log "=== EasyBewerbung Deployment completed successfully ==="
    return 0
}

# Create logs directory if it doesn't exist
mkdir -p "$(dirname "$LOG_FILE")"

# Run deployment with arguments (old_commit, new_commit)
deploy "$@"
