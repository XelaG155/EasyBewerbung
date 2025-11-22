#!/bin/bash

# Restart Script für EasyBewerbung (Frontend & Backend)
# Wird von einem externen Tool nach Git-Updates aufgerufen

set -e

# Farben für Output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== EasyBewerbung Service Restart ===${NC}"
echo -e "Start: $(date)"

# Navigate to project directory
cd /home/alexgiss/EasyBewerbung

# 1. Stop services
echo -e "${YELLOW}Stopping services...${NC}"
pm2 stop EASYBEWERBUNG_SRV || true
pm2 stop easybewerbung-frontend || true

# 2. Update Backend Dependencies (if needed)
echo -e "${YELLOW}Checking backend dependencies...${NC}"
cd backend
if [ -f "requirements.txt" ]; then
    source venv/bin/activate
    pip install -q -r requirements.txt
    deactivate
fi

# 3. Run Database Migrations
echo -e "${YELLOW}Running database migrations...${NC}"
venv/bin/alembic upgrade head || echo -e "${RED}Migration failed or no migrations needed${NC}"

# 4. Update Frontend Dependencies and Build
echo -e "${YELLOW}Building frontend...${NC}"
cd ../frontend
if [ -f "package.json" ]; then
    npm install --silent
    npm run build
fi

# 5. Restart Services
echo -e "${YELLOW}Restarting services...${NC}"
pm2 restart EASYBEWERBUNG_SRV
pm2 restart easybewerbung-frontend

# 6. Save PM2 configuration
pm2 save

# 7. Check status
echo -e "${GREEN}Services restarted!${NC}"
pm2 status

echo -e "End: $(date)"
echo -e "${GREEN}=== Restart Complete ===${NC}"
