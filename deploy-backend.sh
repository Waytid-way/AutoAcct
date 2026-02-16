#!/bin/bash
set -e

# ===========================================
# AutoAcct Backend Deployment Script (Fly.io)
# ===========================================

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 AutoAcct Backend Deployment${NC}"
echo "================================"

# Verify FLY_API_TOKEN
if [ -z "$FLY_API_TOKEN" ]; then
    echo -e "${RED}❌ Error: FLY_API_TOKEN not set${NC}"
    echo "Set it with: export FLY_API_TOKEN=your_token"
    exit 1
fi

# Check if flyctl is installed
if ! command -v flyctl &> /dev/null; then
    echo -e "${YELLOW}⚠️  flyctl not found. Installing...${NC}"
    curl -L https://fly.io/install.sh | sh
    export PATH="$HOME/.fly/bin:$PATH"
fi

# Verify backend directory
if [ ! -d "backend" ]; then
    echo -e "${RED}❌ Error: backend/ directory not found${NC}"
    exit 1
fi

cd backend

# Verify fly.toml exists
if [ ! -f "fly.toml" ]; then
    echo -e "${RED}❌ Error: fly.toml not found in backend/${NC}"
    exit 1
fi

echo -e "${YELLOW}📦 Building backend...${NC}"
npm ci
npm run build

echo -e "${YELLOW}🚀 Deploying to Fly.io...${NC}"
flyctl deploy --app autoacct-api

echo -e "${GREEN}✅ Backend deployed successfully!${NC}"
echo ""
echo "Health check:"
flyctl status --app autoacct-api
