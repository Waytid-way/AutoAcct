#!/bin/bash

# ===========================================
# AutoAcct Deployment Health Monitor
# ===========================================

# Configuration (override with env vars)
BACKEND_URL="${BACKEND_URL:-https://autoacct-api.fly.dev}"
FRONTEND_URL="${FRONTEND_URL:-https://autoacct.vercel.app}"
TIMEOUT="${TIMEOUT:-10}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 AutoAcct Health Monitor${NC}"
echo "=========================="
echo ""
echo "Backend:  $BACKEND_URL"
echo "Frontend: $FRONTEND_URL"
echo ""

# Function to check health endpoint
check_health() {
    local url=$1
    local name=$2
    
    echo -e "${YELLOW}Checking $name...${NC}"
    
    # Use curl to check health endpoint
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" "$url/health" 2>/dev/null || echo "000")
    
    if [ "$HTTP_CODE" = "200" ]; then
        echo -e "${GREEN}✅ $name is healthy (HTTP $HTTP_CODE)${NC}"
        return 0
    elif [ "$HTTP_CODE" = "000" ]; then
        echo -e "${RED}❌ $name is unreachable (timeout/connection error)${NC}"
        return 1
    else
        echo -e "${RED}❌ $name returned HTTP $HTTP_CODE${NC}"
        return 1
    fi
}

# Check backend
check_health "$BACKEND_URL" "Backend"
BACKEND_STATUS=$?

echo ""

# Check frontend (just check if homepage loads)
echo -e "${YELLOW}Checking Frontend...${NC}"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" "$FRONTEND_URL" 2>/dev/null || echo "000")

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "307" ] || [ "$HTTP_CODE" = "308" ]; then
    echo -e "${GREEN}✅ Frontend is accessible (HTTP $HTTP_CODE)${NC}"
    FRONTEND_STATUS=0
else
    echo -e "${RED}❌ Frontend returned HTTP $HTTP_CODE${NC}"
    FRONTEND_STATUS=1
fi

echo ""
echo "=========================="

# Summary
if [ $BACKEND_STATUS -eq 0 ] && [ $FRONTEND_STATUS -eq 0 ]; then
    echo -e "${GREEN}🎉 All systems operational!${NC}"
    exit 0
else
    echo -e "${RED}⚠️  Some services are unhealthy${NC}"
    exit 1
fi
