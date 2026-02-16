#!/bin/bash
set -e

# ===========================================
# AutoAcct Frontend Deployment Script (Vercel)
# ===========================================

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 AutoAcct Frontend Deployment${NC}"
echo "================================="

# Verify VERCEL_TOKEN
if [ -z "$VERCEL_TOKEN" ]; then
    echo -e "${RED}❌ Error: VERCEL_TOKEN not set${NC}"
    echo "Set it with: export VERCEL_TOKEN=your_token"
    exit 1
fi

# Check if vercel is installed
if ! command -v vercel &> /dev/null; then
    echo -e "${YELLOW}⚠️  Vercel CLI not found. Installing...${NC}"
    npm i -g vercel
fi

# Verify frontend directory
if [ ! -d "frontend" ]; then
    echo -e "${RED}❌ Error: frontend/ directory not found${NC}"
    exit 1
fi

cd frontend

echo -e "${YELLOW}📦 Building frontend...${NC}"
npm ci
npm run build

echo -e "${YELLOW}🚀 Deploying to Vercel (production)...${NC}"
vercel --token "$VERCEL_TOKEN" --prod --yes

echo -e "${GREEN}✅ Frontend deployed successfully!${NC}"
