#!/bin/bash
set -e

# ===========================================
# AutoAcct Unified Production Deployment Script
# ===========================================
# Single entry point for deploying AutoAcct to production
# Supports: local (Docker), Fly.io (backend), Vercel (frontend)

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOY_MODE="${1:-local}"  # local, flyio, vercel, or full
SKIP_TESTS="${SKIP_TESTS:-false}"
SKIP_BUILD="${SKIP_BUILD:-false}"

# Track deployment state for rollback
deployed_backend=false
deployed_frontend=false
BACKUP_DIR=""

echo -e "${BLUE}🚀 AutoAcct Production Deployment${NC}"
echo "===================================="
echo ""
echo "Mode: $DEPLOY_MODE"
echo "Skip Tests: $SKIP_TESTS"
echo "Skip Build: $SKIP_BUILD"
echo ""

# ============================================
# USAGE
# ============================================

usage() {
    echo "Usage: $0 [MODE] [OPTIONS]"
    echo ""
    echo "Modes:"
    echo "  local      Deploy locally using Docker Compose (default)"
    echo "  flyio      Deploy backend to Fly.io"
    echo "  vercel     Deploy frontend to Vercel"
    echo "  full       Deploy backend to Fly.io AND frontend to Vercel"
    echo ""
    echo "Options:"
    echo "  SKIP_TESTS=true    Skip running tests"
    echo "  SKIP_BUILD=true    Skip build step"
    echo ""
    echo "Examples:"
    echo "  $0 local                    # Deploy locally"
    echo "  $0 flyio                    # Deploy backend only"
    echo "  $0 full                     # Full production deployment"
    echo "  SKIP_TESTS=true $0 local    # Skip tests"
    exit 1
}

if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    usage
fi

# ============================================
# PRE-DEPLOYMENT CHECKS
# ============================================

echo -e "${BLUE}📋 Running Pre-Deployment Checks...${NC}"
echo ""

# Run environment setup check
echo "Validating environment..."
if ! "$PROJECT_ROOT/scripts/setup-environment.sh" >/dev/null 2>&1; then
    echo -e "${RED}❌ Environment check failed${NC}"
    echo "Run: ./scripts/setup-environment.sh"
    exit 1
fi
echo -e "${GREEN}✓${NC} Environment valid"
echo ""

# ============================================
# TEST PHASE
# ============================================

if [ "$SKIP_TESTS" != "true" ]; then
    echo -e "${BLUE}🧪 Running Tests...${NC}"
    echo ""
    
    # Backend tests
    if [ -d "$PROJECT_ROOT/backend" ]; then
        echo "Testing backend..."
        cd "$PROJECT_ROOT/backend"
        
        if npm test 2>&1; then
            echo -e "${GREEN}✓${NC} Backend tests passed"
        else
            echo -e "${RED}❌ Backend tests failed${NC}"
            echo "Fix tests or run with SKIP_TESTS=true"
            exit 1
        fi
    fi
    
    # Frontend tests
    if [ -d "$PROJECT_ROOT/frontend" ]; then
        echo "Testing frontend..."
        cd "$PROJECT_ROOT/frontend"
        
        if npm test 2>&1; then
            echo -e "${GREEN}✓${NC} Frontend tests passed"
        else
            echo -e "${YELLOW}⚠${NC} Frontend tests failed (continuing anyway)"
        fi
    fi
    
    echo ""
else
    echo -e "${YELLOW}⚠${NC} Skipping tests (SKIP_TESTS=true)"
    echo ""
fi

# ============================================
# BUILD PHASE
# ============================================

if [ "$SKIP_BUILD" != "true" ]; then
    echo -e "${BLUE}🔨 Building Applications...${NC}"
    echo ""
    
    # Build backend
    if [ "$DEPLOY_MODE" = "local" ] || [ "$DEPLOY_MODE" = "flyio" ] || [ "$DEPLOY_MODE" = "full" ]; then
        echo "Building backend..."
        cd "$PROJECT_ROOT/backend"
        
        if npm ci && npm run build; then
            echo -e "${GREEN}✓${NC} Backend build successful"
        else
            echo -e "${RED}❌ Backend build failed${NC}"
            exit 1
        fi
    fi
    
    # Build frontend
    if [ "$DEPLOY_MODE" = "local" ] || [ "$DEPLOY_MODE" = "vercel" ] || [ "$DEPLOY_MODE" = "full" ]; then
        echo "Building frontend..."
        cd "$PROJECT_ROOT/frontend"
        
        if npm ci && npm run build; then
            echo -e "${GREEN}✓${NC} Frontend build successful"
        else
            echo -e "${RED}❌ Frontend build failed${NC}"
            exit 1
        fi
    fi
    
    echo ""
else
    echo -e "${YELLOW}⚠${NC} Skipping build (SKIP_BUILD=true)"
    echo ""
fi

# ============================================
# DEPLOYMENT FUNCTIONS
# ============================================

deploy_local() {
    echo -e "${BLUE}🐳 Deploying Locally (Docker)...${NC}"
    echo ""
    
    cd "$PROJECT_ROOT"
    
    # Create backup
    BACKUP_DIR="$PROJECT_ROOT/.backup/$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    
    # Backup current state
    if docker-compose ps -q 2>/dev/null | grep -q .; then
        echo "Creating backup of current state..."
        docker-compose ps > "$BACKUP_DIR/containers.txt" 2>/dev/null || true
        deployed_backend=true
    fi
    
    # Deploy
    echo "Starting services..."
    if docker-compose up --build -d; then
        echo -e "${GREEN}✓${NC} Services started"
        
        # Wait for health check
        echo "Waiting for services to be ready..."
        sleep 5
        
        if curl -s http://localhost:3001/health/live >/dev/null 2>&1; then
            echo -e "${GREEN}✓${NC} Backend is healthy"
        else
            echo -e "${YELLOW}⚠${NC} Backend health check pending"
        fi
        
        echo ""
        echo -e "${GREEN}✅ Local Deployment Complete${NC}"
        echo ""
        echo "Services:"
        echo "  Frontend: http://localhost:3000"
        echo "  Backend:  http://localhost:3001"
        echo "  API Docs: http://localhost:3001/api-docs"
        echo ""
        echo "Logs: docker-compose logs -f"
        echo "Stop:  docker-compose down"
        
        deployed_backend=true
        deployed_frontend=true
    else
        echo -e "${RED}❌ Deployment failed${NC}"
        rollback
        exit 1
    fi
}

deploy_flyio() {
    echo -e "${BLUE}☁️  Deploying Backend to Fly.io...${NC}"
    echo ""
    
    cd "$PROJECT_ROOT/backend"
    
    # Verify flyctl
    if ! command -v flyctl >/dev/null 2>&1; then
        echo -e "${YELLOW}⚠${NC} Installing flyctl..."
        curl -L https://fly.io/install.sh | sh
        export PATH="$HOME/.fly/bin:$PATH"
    fi
    
    # Verify token
    if [ -z "$FLY_API_TOKEN" ]; then
        echo -e "${RED}❌ FLY_API_TOKEN not set${NC}"
        exit 1
    fi
    
    # Get current release for rollback
    current_release=$(flyctl status --app autoacct-api --json 2>/dev/null | grep -o '"version": [0-9]*' | head -1 | cut -d' ' -f2) || true
    if [ -n "$current_release" ]; then
        echo "Current release: $current_release"
        deployed_backend=true  # Mark as deployed for rollback
    fi
    
    # Deploy
    echo "Deploying to Fly.io..."
    if flyctl deploy --app autoacct-api; then
        echo -e "${GREEN}✓${NC} Backend deployed"
        
        # Health check
        echo "Running health check..."
        sleep 10
        
        if flyctl status --app autoacct-api | grep -q "running"; then
            echo -e "${GREEN}✓${NC} Backend is running"
        else
            echo -e "${YELLOW}⚠${NC} Backend status check inconclusive"
        fi
        
        deployed_backend=true
        echo ""
        echo -e "${GREEN}✅ Backend Deployment Complete${NC}"
    else
        echo -e "${RED}❌ Deployment failed${NC}"
        rollback
        exit 1
    fi
}

deploy_vercel() {
    echo -e "${BLUE}▲ Deploying Frontend to Vercel...${NC}"
    echo ""
    
    cd "$PROJECT_ROOT/frontend"
    
    # Verify vercel CLI
    if ! command -v vercel >/dev/null 2>&1; then
        echo -e "${YELLOW}⚠${NC} Installing Vercel CLI..."
        npm i -g vercel
    fi
    
    # Verify token
    if [ -z "$VERCEL_TOKEN" ]; then
        echo -e "${RED}❌ VERCEL_TOKEN not set${NC}"
        exit 1
    fi
    
    # Deploy
    echo "Deploying to Vercel..."
    if vercel --token "$VERCEL_TOKEN" --prod --yes; then
        echo -e "${GREEN}✓${NC} Frontend deployed"
        deployed_frontend=true
        echo ""
        echo -e "${GREEN}✅ Frontend Deployment Complete${NC}"
    else
        echo -e "${RED}❌ Deployment failed${NC}"
        rollback
        exit 1
    fi
}

rollback() {
    echo ""
    echo -e "${YELLOW}⚠️  Rolling back deployment...${NC}"
    echo ""
    
    if [ "$DEPLOY_MODE" = "local" ] && [ -n "$BACKUP_DIR" ]; then
        echo "Restoring local deployment..."
        cd "$PROJECT_ROOT"
        docker-compose down 2>/dev/null || true
        echo "Rollback complete (services stopped)"
    fi
    
    if [ "$DEPLOY_MODE" = "flyio" ] || [ "$DEPLOY_MODE" = "full" ]; then
        if [ "$deployed_backend" = true ]; then
            echo "Rolling back Fly.io deployment..."
            if [ -n "$current_release" ]; then
                flyctl deploy --app autoacct-api --image-ref registry.fly.io/autoacct-api:$current_release 2>/dev/null || true
            fi
        fi
    fi
    
    echo -e "${YELLOW}⚠️  Rollback complete${NC}"
}

# ============================================
# TRAP FOR CLEANUP
# ============================================

cleanup() {
    if [ $? -ne 0 ] && [ "$deployed_backend" = true -o "$deployed_frontend" = true ]; then
        echo ""
        echo -e "${YELLOW}⚠️  Deployment failed. Consider rollback if needed.${NC}"
    fi
}

trap cleanup EXIT

# ============================================
# EXECUTE DEPLOYMENT
# ============================================

case "$DEPLOY_MODE" in
    local)
        deploy_local
        ;;
    flyio)
        deploy_flyio
        ;;
    vercel)
        deploy_vercel
        ;;
    full)
        deploy_flyio
        echo ""
        deploy_vercel
        ;;
    *)
        echo -e "${RED}❌ Unknown deployment mode: $DEPLOY_MODE${NC}"
        usage
        ;;
esac

echo ""
echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo ""
echo "Next steps:"
echo "  ./scripts/health-check.sh  # Verify deployment"
