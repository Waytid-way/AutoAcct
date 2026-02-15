#!/bin/bash
# setup-cicd.sh - Setup CI/CD for AutoAcct
# Run this script to configure GitHub Actions

set -e

echo "🚀 Setting up CI/CD for AutoAcct..."
echo "======================================"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Step 1: Verify GitHub repository${NC}"
if [ ! -d ".git" ]; then
    echo -e "${RED}❌ Not a git repository${NC}"
    exit 1
fi

REMOTE_URL=$(git remote get-url origin 2>/dev/null || echo "")
if [[ "$REMOTE_URL" == *"github.com"* ]]; then
    echo -e "${GREEN}✓ GitHub repository detected${NC}"
    echo "  URL: $REMOTE_URL"
else
    echo -e "${RED}❌ Not a GitHub repository${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}Step 2: Check workflow files${NC}"
if [ -f ".github/workflows/ci.yml" ]; then
    echo -e "${GREEN}✓ CI workflow exists${NC}"
else
    echo -e "${RED}❌ CI workflow missing${NC}"
fi

if [ -f ".github/workflows/cd.yml" ]; then
    echo -e "${GREEN}✓ CD workflow exists${NC}"
else
    echo -e "${RED}❌ CD workflow missing${NC}"
fi

echo ""
echo -e "${YELLOW}Step 3: Required Secrets${NC}"
echo "Please add these secrets to your GitHub repository:"
echo ""
echo "For Backend Deployment (Fly.io):"
echo "  FLY_API_TOKEN     - Get from: flyctl auth token"
echo ""
echo "For Frontend Deployment (Vercel):"
echo "  VERCEL_TOKEN      - Get from: vercel tokens create"
echo ""
echo "For Health Checks:"
echo "  BACKEND_URL       - e.g., https://autoacct-api.fly.dev"
echo "  FRONTEND_URL      - e.g., https://autoacct.vercel.app"
echo ""

echo -e "${YELLOW}Step 4: Setup Instructions${NC}"
echo ""
echo "1. Go to: https://github.com/$(echo $REMOTE_URL | sed 's/.*github.com[:/]//' | sed 's/.git$//')/settings/secrets/actions"
echo ""
echo "2. Add the secrets listed above"
echo ""
echo "3. Create a new branch and push:"
echo "   git checkout -b feature/setup-cicd"
echo "   git add .github/workflows/"
echo "   git commit -m \"Add CI/CD workflows\""
echo "   git push origin feature/setup-cicd"
echo ""
echo "4. Create a Pull Request to test CI"
echo ""

echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo "Next steps:"
echo "  - Add required secrets to GitHub"
echo "  - Create a PR to test CI"
echo "  - Merge to main to trigger deployment"
