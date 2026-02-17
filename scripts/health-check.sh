#!/bin/bash
#
# Health Check Script for AutoAcct
#
# Usage:
#   ./health-check.sh [component]
#
# Components:
#   all       - Check all services (default)
#   backend   - Check backend only
#   frontend  - Check frontend only
#   database  - Check database only
#   external  - Check external APIs only
#
# Exit Codes:
#   0 - All checks passed
#   1 - One or more checks failed
#

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
COMPONENT="${1:-all}"
TIMEOUT="${TIMEOUT:-10}"
VERBOSE="${VERBOSE:-false}"

# Service URLs
BACKEND_URL="${BACKEND_URL:-http://localhost:3001}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:3000}"

# Track overall status
EXIT_CODE=0

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1"
    EXIT_CODE=1
}

# Check if a URL is reachable
check_url() {
    local name="$1"
    local url="$2"
    local expected_status="${3:-200}"
    
    log_info "Checking $name at $url..."
    
    local response
    local status_code
    
    if response=$(curl -sf --max-time "$TIMEOUT" -w "\n%{http_code}" "$url" 2>/dev/null); then
        status_code=$(echo "$response" | tail -n1)
        
        if [[ "$status_code" == "$expected_status" ]]; then
            log_success "$name is healthy (HTTP $status_code)"
            return 0
        else
            log_error "$name returned HTTP $status_code (expected $expected_status)"
            return 1
        fi
    else
        log_error "$name is unreachable"
        return 1
    fi
}

# Check backend health
check_backend() {
    echo
    log_info "=== Backend Health Checks ==="
    
    # Main health endpoint
    check_url "Backend Health" "$BACKEND_URL/health"
    
    # Liveness probe
    check_url "Liveness" "$BACKEND_URL/health/live"
    
    # Readiness probe
    check_url "Readiness" "$BACKEND_URL/health/ready"
    
    # API endpoints
    if [[ "$VERBOSE" == "true" ]]; then
        log_info "Checking API endpoints..."
        
        # These might return 401/403 without auth, which is fine
        local api_status
        api_status=$(curl -sf --max-time "$TIMEOUT" -w "%{http_code}" -o /dev/null "$BACKEND_URL/api/receipts/stats" 2>/dev/null || echo "000")
        
        if [[ "$api_status" == "401" || "$api_status" == "403" ]]; then
            log_success "API endpoints are accessible (auth required)"
        elif [[ "$api_status" == "200" ]]; then
            log_success "API endpoints are accessible"
        else
            log_warn "API endpoints returned HTTP $api_status"
        fi
    fi
}

# Check frontend health
check_frontend() {
    echo
    log_info "=== Frontend Health Checks ==="
    
    check_url "Frontend" "$FRONTEND_URL"
}

# Check database connectivity
check_database() {
    echo
    log_info "=== Database Health Checks ==="
    
    if [[ -z "${DATABASE_URL:-}" ]]; then
        log_warn "DATABASE_URL not set, skipping database check"
        return 0
    fi
    
    # Try to connect using mongosh or mongo
    if command -v mongosh &> /dev/null; then
        if mongosh "$DATABASE_URL" --eval "db.adminCommand('ping')" --quiet > /dev/null 2>&1; then
            log_success "Database is reachable"
        else
            log_error "Database connection failed"
        fi
    elif command -v mongo &> /dev/null; then
        if mongo "$DATABASE_URL" --eval "db.adminCommand('ping')" --quiet > /dev/null 2>&1; then
            log_success "Database is reachable"
        else
            log_error "Database connection failed"
        fi
    else
        log_warn "Neither mongosh nor mongo CLI found, skipping database check"
    fi
}

# Check external APIs
check_external() {
    echo
    log_info "=== External API Checks ==="
    
    # Check Groq API
    if [[ -n "${GROQ_API_KEY:-}" ]]; then
        log_info "Checking Groq API..."
        
        local response
        if response=$(curl -sf --max-time "$TIMEOUT" \
            -H "Authorization: Bearer $GROQ_API_KEY" \
            -H "Content-Type: application/json" \
            https://api.groq.com/openai/v1/models 2>/dev/null); then
            log_success "Groq API is accessible"
            
            if [[ "$VERBOSE" == "true" ]]; then
                local model_count=$(echo "$response" | grep -o '"id"' | wc -l)
                log_info "  Available models: $model_count"
            fi
        else
            log_error "Groq API is unreachable or API key is invalid"
        fi
    else
        log_warn "GROQ_API_KEY not set, skipping Groq API check"
    fi
    
    # Check other external services as needed
    # Add more checks here...
}

# Check system resources
check_system() {
    echo
    log_info "=== System Resource Checks ==="
    
    # Check disk space
    local disk_usage
    disk_usage=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
    
    if [[ "$disk_usage" -lt 80 ]]; then
        log_success "Disk usage: ${disk_usage}%"
    elif [[ "$disk_usage" -lt 90 ]]; then
        log_warn "Disk usage: ${disk_usage}% (consider cleanup)"
    else
        log_error "Disk usage: ${disk_usage}% (critical)"
    fi
    
    # Check memory
    if command -v free &> /dev/null; then
        local mem_usage
        mem_usage=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100.0}')
        
        if [[ "$mem_usage" -lt 80 ]]; then
            log_success "Memory usage: ${mem_usage}%"
        elif [[ "$mem_usage" -lt 90 ]]; then
            log_warn "Memory usage: ${mem_usage}%"
        else
            log_error "Memory usage: ${mem_usage}% (critical)"
        fi
    fi
}

# Check Docker containers (if running in Docker)
check_docker() {
    echo
    log_info "=== Docker Container Checks ==="
    
    if ! command -v docker &> /dev/null; then
        log_info "Docker not found, skipping container checks"
        return 0
    fi
    
    if ! docker info > /dev/null 2>&1; then
        log_warn "Docker daemon not running, skipping container checks"
        return 0
    fi
    
    # Check if autoacct containers are running
    local containers
    containers=$(docker ps --filter "name=autoacct" --format "{{.Names}}" 2>/dev/null || true)
    
    if [[ -z "$containers" ]]; then
        log_warn "No AutoAcct containers found"
        return 0
    fi
    
    while IFS= read -r container; do
        if [[ -n "$container" ]]; then
            local status
            status=$(docker inspect --format='{{.State.Status}}' "$container" 2>/dev/null || echo "unknown")
            
            if [[ "$status" == "running" ]]; then
                log_success "Container $container is running"
            else
                log_error "Container $container status: $status"
            fi
        fi
    done <<< "$containers"
}

# Print summary
print_summary() {
    echo
    log_info "=== Health Check Summary ==="
    
    if [[ $EXIT_CODE -eq 0 ]]; then
        log_success "All health checks passed!"
    else
        log_error "Some health checks failed. Please review the output above."
    fi
    
    echo
    echo "Checked at: $(date)"
}

# Main execution
main() {
    log_info "AutoAcct Health Check Tool"
    log_info "Component: $COMPONENT"
    log_info "Timeout: ${TIMEOUT}s"
    
    case "$COMPONENT" in
        all)
            check_backend
            check_frontend
            check_database
            check_external
            check_system
            check_docker
            ;;
        backend)
            check_backend
            ;;
        frontend)
            check_frontend
            ;;
        database)
            check_database
            ;;
        external)
            check_external
            ;;
        system)
            check_system
            ;;
        docker)
            check_docker
            ;;
        *)
            echo "Usage: $0 [all|backend|frontend|database|external|system|docker]"
            exit 1
            ;;
    esac
    
    print_summary
    
    exit $EXIT_CODE
}

main "$@"
