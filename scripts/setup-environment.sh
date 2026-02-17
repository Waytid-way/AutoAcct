#!/bin/bash
set -e

# ===========================================
# AutoAcct Environment Setup Script
# ===========================================
# Validates and sets up environment for AutoAcct deployment

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REQUIRED_ENV_VARS=(
    "GROQ_API_KEY"
    "JWT_SECRET"
    "MONGODB_URI"
)
OPTIONAL_ENV_VARS=(
    "TEABLE_API_KEY"
    "TEABLE_API_URL"
    "TEABLE_BASE_ID"
    "DISCORD_WEBHOOK_URL"
    "FLY_API_TOKEN"
    "VERCEL_TOKEN"
)

echo -e "${BLUE}🔧 AutoAcct Environment Setup${NC}"
echo "==============================="
echo ""

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# ============================================
# CHECK DEPENDENCIES
# ============================================
echo -e "${BLUE}📋 Checking Dependencies...${NC}"
echo ""

dependencies_ok=true

# Check Node.js
if command_exists node; then
    NODE_VERSION=$(node --version | cut -d'v' -f2)
    echo -e "${GREEN}✓${NC} Node.js: $NODE_VERSION"
else
    echo -e "${RED}✗${NC} Node.js: Not installed (required >= 18.0.0)"
    dependencies_ok=false
fi

# Check npm
if command_exists npm; then
    NPM_VERSION=$(npm --version)
    echo -e "${GREEN}✓${NC} npm: $NPM_VERSION"
else
    echo -e "${RED}✗${NC} npm: Not installed"
    dependencies_ok=false
fi

# Check Docker (optional but recommended)
if command_exists docker; then
    DOCKER_VERSION=$(docker --version | awk '{print $3}' | sed 's/,//')
    echo -e "${GREEN}✓${NC} Docker: $DOCKER_VERSION"
else
    echo -e "${YELLOW}⚠${NC} Docker: Not installed (optional for local deployment)"
fi

# Check docker-compose (optional)
if command_exists docker-compose; then
    echo -e "${GREEN}✓${NC} docker-compose: Installed"
else
    echo -e "${YELLOW}⚠${NC} docker-compose: Not installed (optional for local deployment)"
fi

# Check flyctl (optional)
if command_exists flyctl; then
    echo -e "${GREEN}✓${NC} flyctl: Installed"
else
    echo -e "${YELLOW}⚠${NC} flyctl: Not installed (optional for Fly.io deployment)"
fi

# Check Vercel CLI (optional)
if command_exists vercel; then
    echo -e "${GREEN}✓${NC} Vercel CLI: Installed"
else
    echo -e "${YELLOW}⚠${NC} Vercel CLI: Not installed (optional for Vercel deployment)"
fi

echo ""

# ============================================
# CHECK .env FILE
# ============================================
echo -e "${BLUE}📋 Checking Environment File...${NC}"
echo ""

ENV_FILE="$PROJECT_ROOT/.env"
ENV_EXAMPLE="$PROJECT_ROOT/.env.example"

if [ -f "$ENV_FILE" ]; then
    echo -e "${GREEN}✓${NC} .env file exists"
else
    echo -e "${YELLOW}⚠${NC} .env file not found"
    
    if [ -f "$ENV_EXAMPLE" ]; then
        echo ""
        echo -e "${BLUE}Creating .env from .env.example...${NC}"
        cp "$ENV_EXAMPLE" "$ENV_FILE"
        echo -e "${GREEN}✓${NC} Created .env file"
        echo -e "${YELLOW}⚠${NC} Please edit .env and fill in your actual values!"
    else
        echo -e "${RED}✗${NC} .env.example not found. Cannot create .env file."
        exit 1
    fi
fi

echo ""

# ============================================
# VALIDATE ENVIRONMENT VARIABLES
# ============================================
echo -e "${BLUE}📋 Validating Environment Variables...${NC}"
echo ""

# Load .env file
if [ -f "$ENV_FILE" ]; then
    export $(grep -v '^#' "$ENV_FILE" | xargs)
fi

missing_required=false
missing_optional=false

# Check required variables
echo "Required variables:"
for var in "${REQUIRED_ENV_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        echo -e "  ${RED}✗${NC} $var: Not set"
        missing_required=true
    else
        # Mask sensitive values
        if [[ "$var" == *"SECRET"* ]] || [[ "$var" == *"KEY"* ]] || [[ "$var" == *"TOKEN"* ]]; then
            value="${!var}"
            masked="${value:0:8}...${value: -4}"
            echo -e "  ${GREEN}✓${NC} $var: $masked"
        else
            echo -e "  ${GREEN}✓${NC} $var: ${!var}"
        fi
    fi
done

echo ""
echo "Optional variables:"
for var in "${OPTIONAL_ENV_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        echo -e "  ${YELLOW}⚠${NC} $var: Not set"
        missing_optional=true
    else
        # Mask sensitive values
        if [[ "$var" == *"SECRET"* ]] || [[ "$var" == *"KEY"* ]] || [[ "$var" == *"TOKEN"* ]]; then
            value="${!var}"
            masked="${value:0:8}...${value: -4}"
            echo -e "  ${GREEN}✓${NC} $var: $masked"
        else
            echo -e "  ${GREEN}✓${NC} $var: ${!var}"
        fi
    fi
done

echo ""

# ============================================
# SUMMARY
# ============================================
if [ "$missing_required" = true ]; then
    echo -e "${RED}❌ Setup Incomplete${NC}"
    echo ""
    echo "Missing required environment variables."
    echo "Please edit $ENV_FILE and add the missing values."
    echo ""
    echo "To get started:"
    echo "  1. Get GROQ_API_KEY from: https://console.groq.com"
    echo "  2. Generate JWT_SECRET with: openssl rand -hex 32"
    echo "  3. Set up MongoDB (local or MongoDB Atlas)"
    echo ""
    exit 1
else
    echo -e "${GREEN}✅ Environment Setup Complete${NC}"
    echo ""
    echo "All required dependencies and environment variables are configured."
    
    if [ "$missing_optional" = true ]; then
        echo ""
        echo -e "${YELLOW}Note:${NC} Some optional features may not work without additional configuration."
    fi
    
    echo ""
    echo "Next steps:"
    echo "  ./scripts/health-check.sh     # Check service health"
    echo "  ./scripts/deploy-production.sh # Deploy to production"
    echo ""
fi
