#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== World Cup Prode Azure Deployment ===${NC}"

# Configuration
RESOURCE_GROUP="worldcupprode-rg"
APP_NAME="worldcupprode"
APP_DIR="app"

# Change to script directory
cd "$(dirname "$0")"

# Step 1: Build the Next.js app
echo -e "${YELLOW}[1/5] Building Next.js app...${NC}"
cd "$APP_DIR"
npm run build
echo -e "${GREEN}✓ Build complete${NC}"

# Step 2: Prepare standalone directory with static files
echo -e "${YELLOW}[2/5] Preparing standalone directory...${NC}"

# Copy static files to standalone
if [ -d ".next/static" ]; then
    mkdir -p .next/standalone/.next/static
    cp -r .next/static/* .next/standalone/.next/static/
    echo -e "${GREEN}✓ Static files copied${NC}"
else
    echo -e "${RED}✗ .next/static directory not found${NC}"
    exit 1
fi

# Copy public folder to standalone
if [ -d "public" ]; then
    cp -r public .next/standalone/
    echo -e "${GREEN}✓ Public folder copied${NC}"
fi

# Step 3: Create deployment zip
echo -e "${YELLOW}[3/5] Creating deployment package...${NC}"
cd .next/standalone
rm -f ../../deploy.zip ../../../deploy.zip
zip -rq ../../../deploy.zip . -x "*.DS_Store"
cd ../../..
echo -e "${GREEN}✓ Created deploy.zip ($(ls -lh deploy.zip | awk '{print $5}'))${NC}"

# Verify server.js is at root of zip
if unzip -l deploy.zip | grep -q "^.*server\.js$"; then
    echo -e "${GREEN}✓ server.js found at zip root${NC}"
else
    echo -e "${RED}✗ server.js not at zip root - deployment will fail${NC}"
    exit 1
fi

# Step 4: Deploy to Azure
echo -e "${YELLOW}[4/5] Deploying to Azure App Service...${NC}"
az webapp deploy \
    --resource-group "$RESOURCE_GROUP" \
    --name "$APP_NAME" \
    --src-path deploy.zip \
    --type zip \
    --async true

# Step 5: Wait and verify
echo -e "${YELLOW}[5/5] Waiting for deployment to complete...${NC}"
sleep 30

# Check if site is responding
echo -e "${YELLOW}Checking site status...${NC}"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 15 "https://${APP_NAME}.azurewebsites.net/" || echo "000")

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "302" ]; then
    echo -e "${GREEN}✓ Site is live! https://${APP_NAME}.azurewebsites.net${NC}"
else
    echo -e "${YELLOW}Site returned HTTP $HTTP_CODE - may still be starting up${NC}"
    echo -e "Check manually: https://${APP_NAME}.azurewebsites.net"
fi

echo -e "${GREEN}=== Deployment complete ===${NC}"
