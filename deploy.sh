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
SUBSCRIPTION_ID="7fe479bb-796e-4f40-ad28-b5f075ca5c02"

# Set the correct Azure subscription
echo -e "${YELLOW}Setting Azure subscription...${NC}"
az account set --subscription "$SUBSCRIPTION_ID"
echo -e "${GREEN}✓ Subscription set${NC}"

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
rm -f deploy.zip

# Use PowerShell Compress-Archive (works on Windows without zip command)
STANDALONE_PATH="$(cd .next/standalone && pwd -W 2>/dev/null || pwd)"
DEPLOY_ZIP_PATH="$(cd .. && pwd -W 2>/dev/null || pwd)/deploy.zip"
powershell.exe -NoProfile -Command "
    \$src = '${STANDALONE_PATH//\//\\}'
    \$dst = '${DEPLOY_ZIP_PATH//\//\\}'
    if (Test-Path \$dst) { Remove-Item \$dst }
    Compress-Archive -Path \"\$src\\*\" -DestinationPath \$dst -Force
"
cd ..

if [ -f "deploy.zip" ]; then
    SIZE=$(powershell.exe -NoProfile -Command "(Get-Item '${DEPLOY_ZIP_PATH//\//\\}').Length / 1MB" | tr -d '\r')
    echo -e "${GREEN}✓ Created deploy.zip (${SIZE} MB)${NC}"
else
    echo -e "${RED}✗ Failed to create deploy.zip${NC}"
    exit 1
fi

# Verify server.js is at root of zip
if powershell.exe -NoProfile -Command "
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    \$zip = [System.IO.Compression.ZipFile]::OpenRead('${DEPLOY_ZIP_PATH//\//\\}')
    \$found = \$zip.Entries | Where-Object { \$_.Name -eq 'server.js' -and \$_.FullName -eq 'server.js' }
    \$zip.Dispose()
    if (\$found) { exit 0 } else { exit 1 }
"; then
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
    --src-path "$DEPLOY_ZIP_PATH" \
    --type zip \
    --async false

# Step 5: Verify deployment
echo -e "${YELLOW}[5/5] Verifying deployment...${NC}"
sleep 5

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
