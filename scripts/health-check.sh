#!/bin/bash
set -e

# ===========================================
# AutoAcct Health Check Script
# ===========================================
# Comprehensive health checks for all AutoAcct services

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_URL="${NEXT_PUBLIC_API_BASE_URL:-http://localhost:3001}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:3000}"
TIMEOUT=10

# Track overall health
overall_healthy=true

echo -e "${BLUE}🏥 AutoAcct Health Check${NC}"
echo "========================"
echo ""
echo "Backend:  $BACKEND_URL"
echo "Frontend: $FRONTEND_URL"
echo ""

# ============================================
# HELPER FUNCTIONS
# ============================================

check_http() {
    local name=$1
    local url=$2
    local expected_code=${3:-200}
    
    echo -n "Checking $name... "
    
    if response=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" "$url" 2>/dev/null); then
        if [ "$response" -eq "$expected_code" ]; then
            echo -e "${GREEN}✓${NC} ($response)"
            return 0
        else
            echo -e "${RED}✗${NC} (expected $expected_code, got $response)"
            return 1
        fi
    else
        echo -e "${RED}✗${NC} (connection failed)"
        return 1
    fi
}

check_json_field() {
    local name=$1
    local url=$2
    local field=$3
    local expected=$4
    
    echo -n "Checking $name... "
    
    if response=$(curl -s --max-time "$TIMEOUT" "$url" 2>/dev/null); then
        value=$(echo "$response" | grep -o '"'$field'"[^,}]*' | cut -d':' -f2 | tr -d '"' | xargs)
        if [ "$value" = "$expected" ]; then
            echo -e "${GREEN}✓${NC} ($field: $expected)"
            return 0
        else
            echo -e "${RED}✗${NC} (expected $field=$expected, got $value)"
            return 1
        fi
    else
        echo -e "${RED}✗${NC} (connection failed)"
        return 1
    fi
}

# ============================================
# CHECK SERVICES
# ============================================

echo -e "${BLUE}📋 Service Health Checks${NC}"
echo ""

# Backend Liveness
if ! check_http "Backend (Liveness)" "$BACKEND_URL/health/live"; then
    overall_healthy=false
fi

# Backend Readiness
if ! check_json_field "Backend (Readiness)" "$BACKEND_URL/health/ready" "status" "ready"; then
    overall_healthy=false
fi

# Frontend
if ! check_http "Frontend" "$FRONTEND_URL"; then
    overall_healthy=false
fi

echo ""

# ============================================
# CHECK DATABASE (if Docker is running)
# ============================================

echo -e "${BLUE}📋 Database Checks${NC}"
echo ""

# Check MongoDB (Docker)
if docker ps --format "{{.Names}}" | grep -q "autoacct-mongodb"; then
    echo -e "${GREEN}✓${NC} MongoDB container: Running"
else
    echo -e "${YELLOW}⚠${NC} MongoDB container: Not running (may be using external MongoDB)"
fi

# Check Redis (Docker)
if docker ps --format "{{.Names}}" | grep -q "autoacct-redis"; then
    echo -e "${GREEN}✓${NC} Redis container: Running"
else
    echo -e "${YELLOW}⚠${NC} Redis container: Not running"
fi

echo ""

# ============================================
# CHECK EXTERNAL APIs (if configured)
# ============================================

echo -e "${BLUE}📋 External API Checks${NC}"
echo ""

# Load .env file
if [ -f "$PROJECT_ROOT/.env" ]; then
    export $(grep -v '^#' "$PROJECT_ROOT/.env" | xargs)
fi

# Check Groq API
if [ -n "$GROQ_API_KEY" ]; then
    echo -n "Checking Groq API... "
    if curl -s -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" \
         -H "Authorization: Bearer $GROQ_API_KEY" \
         https://api.groq.com/openai/v1/models 2>/dev/null | grep -q "200"; then
        echo -e "${GREEN}✓${NC} (authenticated)"
    else
        echo -e "${RED}✗${NC} (authentication failed)"
        overall_healthy=false
    fi
else
    echo -e "${YELLOW}⚠${NC} Groq API: Not configured (GROQ_API_KEY not set)"
fi

# Check Teable API (optional)
if [ -n "$TEABLE_API_KEY" ] && [ -n "$TEABLE_API_URL" ]; then
    echo -n "Checking Teable API... "
    if curl -s -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" \
         -H "Authorization: Bearer $TEABLE_API_KEY" \
         "$TEABLE_API_URL/base/$TEABLE_BASE_ID" 2>/dev/null | grep -q "200"; then
        echo -e "${GREEN}✓${NC} (authenticated)"
    else
        echo -e "${YELLOW}⚠${NC} (connection failed - check API key and URL)"
    fi
else
    echo -e "${YELLOW}⚠${NC} Teable API: Not configured"
fi

echo ""

# ============================================
# CHECK DISK SPACE
# ============================================

echo -e "${BLUE}📋 System Resources${NC}"
echo ""

# Disk usage
if command -v df >/dev/null 2>&1; then
    disk_usage=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
    if [ "$disk_usage" -lt 80 ]; then
        echo -e "${GREEN}✓${NC} Disk usage: ${disk_usage}%"
    elif [ "$disk_usage" -lt 90 ]; then
        echo -e "${YELLOW}⚠${NC} Disk usage: ${disk_usage}% (getting full)"
    else
        echo -e "${RED}✗${NC} Disk usage: ${disk_usage}% (critical)"
        overall_healthy=false
    fi
fi

# Memory usage (if available)
if command -v free >/dev/null 2>&1; then
    mem_usage=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100}')
    if [ "$mem_usage" -lt 80 ]; then
        echo -e "${GREEN}✓${NC} Memory usage: ${mem_usage}%"
    elif [ "$mem_usage" -lt 90 ]; then
        echo -e "${YELLOW}⚠${NC} Memory usage: ${mem_usage}% (high)"
    else
        echo -e "${RED}✗${NC} Memory usage: ${mem_usage}% (critical)"
    fi
fi

echo ""

# ============================================
# DETAILED BACKEND HEALTH
# ============================================

echo -e "${BLUE}📋 Detailed Backend Health${NC}"
echo ""

if response=$(curl -s --max-time "$TIMEOUT" "$BACKEND_URL/health" 2>/dev/null); then
    echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"
else
    echo -e "${YELLOW}⚠${NC} Could not fetch detailed health"
fi

echo ""

# ============================================
# SUMMARY
# ============================================

if [ "$overall_healthy" = true ]; then
    echo -e "${GREEN}✅ All Health Checks Passed${NC}"
    echo ""
    echo "AutoAcct is healthy and ready!"
    exit 0
else
    echo -e "${RED}❌ Some Health Checks Failed${NC}"
    echo ""
    echo "Please check the errors above and:"
    echo "  1. Ensure all services are running"
    echo "  2. Check environment variables in .env"
    echo "  3. Verify external API keys are valid"
    echo "  4. Review logs: docker-compose logs -f"
    exit 1
fi
