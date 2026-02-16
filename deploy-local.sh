#!/bin/bash
set -e

# ===========================================
# AutoAcct Local Deployment Script (Docker)
# ===========================================

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 AutoAcct Local Deployment (Docker)${NC}"
echo "======================================="
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker not found${NC}"
    echo "Please install Docker: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if docker-compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ docker-compose not found${NC}"
    echo "Please install docker-compose: https://docs.docker.com/compose/install/"
    exit 1
fi

# Check for required environment variables
if [ -z "$GROQ_API_KEY" ]; then
    echo -e "${YELLOW}⚠️  Warning: GROQ_API_KEY not set${NC}"
    echo "OCR functionality will not work without a GROQ API key."
    echo "Get one at: https://console.groq.com"
    echo ""
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo -e "${BLUE}📦 Building and starting services...${NC}"
echo ""

# Build and start services
docker-compose up --build -d

echo ""
echo -e "${GREEN}✅ AutoAcct is now running!${NC}"
echo ""
echo "Services:"
echo "  Frontend: http://localhost:3000"
echo "  Backend:  http://localhost:3001"
echo "  API Docs: http://localhost:3001/api-docs"
echo "  Health:   http://localhost:3001/health"
echo ""
echo "Logs:"
echo "  docker-compose logs -f"
echo ""
echo "Stop:"
echo "  docker-compose down"
echo ""
