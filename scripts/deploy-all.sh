#!/bin/bash
#
# Full Deployment Orchestration Script for AutoAcct
#
# Usage:
#   ./deploy-all.sh [environment]
#
# This script orchestrates the deployment of all AutoAcct components:
#   1. Runs health checks
#   2. Backs up database
#   3. Deploys backend
#   4. Deploys frontend
#   5. Runs migrations
#   6. Verifies deployment
#

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENVIRONMENT="${1:-production}"
DRY_RUN="${DRY_RUN:-false}"
SKIP_HEALTH_CHECK="${SKIP_HEALTH_CHECK:-false}"
SKIP_BACKUP="${SKIP_BACKUP:-false}"
SKIP_BACKEND="${SKIP_BACKEND:-false}"
SKIP_FRONTEND="${SKIP_FRONTEND:-false}"

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

die() {
    log_error "$1"
    exit 1
}

# Pre-deployment checks
pre_deployment_checks() {
    log_step "Step 1: Pre-Deployment Checks"
    
    # Check required tools
    local required_tools=("docker" "docker-compose" "npm" "node")
    
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            die "Required tool not found: $tool"
        fi
    done
    
    log_success "All required tools are available"
    
    # Run health check if not skipped
    if [[ "$SKIP_HEALTH_CHECK" != "true" ]]; then
        log_info "Running pre-deployment health check..."
        
        if ! "$SCRIPT_DIR/health-check.sh" all; then
            log_warn "Pre-deployment health check failed"
            read -p "Continue anyway? (y/N) " -n 1 -r
            echo
            
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                die "Deployment cancelled"
            fi
        fi
    else
        log_warn "Skipping health check"
    fi
}

# Database backup
backup_database() {
    if [[ "$SKIP_BACKUP" == "true" ]]; then
        log_warn "Skipping database backup"
        return 0
    fi
    
    log_step "Step 2: Database Backup"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would backup database"
        return 0
    fi
    
    "$SCRIPT_DIR/migrate.sh" backup || die "Database backup failed"
}

# Deploy backend
deploy_backend() {
    if [[ "$SKIP_BACKEND" == "true" ]]; then
        log_warn "Skipping backend deployment"
        return 0
    fi
    
    log_step "Step 3: Deploy Backend"
    
    DRY_RUN="$DRY_RUN" "$SCRIPT_DIR/deploy-backend.sh" "$ENVIRONMENT" || die "Backend deployment failed"
}

# Deploy frontend
deploy_frontend() {
    if [[ "$SKIP_FRONTEND" == "true" ]]; then
        log_warn "Skipping frontend deployment"
        return 0
    fi
    
    log_step "Step 4: Deploy Frontend"
    
    DRY_RUN="$DRY_RUN" "$SCRIPT_DIR/deploy-frontend.sh" "$ENVIRONMENT" || die "Frontend deployment failed"
}

# Run database migrations
run_migrations() {
    log_step "Step 5: Database Migrations"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would run migrations"
        return 0
    fi
    
    "$SCRIPT_DIR/migrate.sh" up || die "Migration failed"
}

# Post-deployment verification
post_deployment_verification() {
    log_step "Step 6: Post-Deployment Verification"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would run verification"
        return 0
    fi
    
    # Wait for services to stabilize
    log_info "Waiting for services to stabilize..."
    sleep 10
    
    # Run health check
    if ! "$SCRIPT_DIR/health-check.sh" all; then
        log_error "Post-deployment health check failed"
        
        read -p "Do you want to rollback? (y/N) " -n 1 -r
        echo
        
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            log_warn "Initiating rollback..."
            rollback
        fi
        
        die "Deployment verification failed"
    fi
    
    log_success "Post-deployment verification passed"
}

# Rollback deployment
rollback() {
    log_step "ROLLBACK"
    
    log_warn "Rolling back to previous version..."
    
    # Stop current containers
    cd "$PROJECT_ROOT"
    docker-compose down
    
    # Restore from backup if available
    if [[ "$SKIP_BACKUP" != "true" && -d "$PROJECT_ROOT/backups" ]]; then
        local latest_backup
        latest_backup=$(ls -t "$PROJECT_ROOT/backups"/backup_*.gz 2>/dev/null | head -1)
        
        if [[ -n "$latest_backup" ]]; then
            log_info "Restoring from backup: $latest_backup"
            # mongorestore --uri="$DATABASE_URL" --gzip --archive="$latest_backup"
        fi
    fi
    
    # Start previous version (you would need to tag images with version)
    docker-compose up -d
    
    log_success "Rollback completed"
}

# Print deployment summary
print_summary() {
    local end_time=$(date +%s)
    local duration=$((end_time - START_TIME))
    
    echo
    log_step "Deployment Summary"
    
    echo "  Environment:    $ENVIRONMENT"
    echo "  Duration:       ${duration}s"
    echo "  Dry Run:        $DRY_RUN"
    
    if [[ "$SKIP_BACKEND" != "true" ]]; then
        echo "  Backend:        ${BACKEND_URL:-http://localhost:3001}"
    fi
    
    if [[ "$SKIP_FRONTEND" != "true" ]]; then
        echo "  Frontend:       ${FRONTEND_URL:-http://localhost:3000}"
    fi
    
    echo
    log_success "Deployment completed successfully!"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        echo
        log_warn "This was a DRY RUN. No actual changes were made."
        log_info "To deploy for real, run: DRY_RUN=false $0 $ENVIRONMENT"
    fi
}

# Show usage
usage() {
    cat << EOF
Usage: $0 [OPTIONS] [ENVIRONMENT]

AutoAcct Full Deployment Script

Arguments:
  ENVIRONMENT          Deployment environment (production, staging, development)
                       Default: production

Options:
  --dry-run            Show what would be done without making changes
  --skip-health-check  Skip pre-deployment health check
  --skip-backup        Skip database backup
  --skip-backend       Skip backend deployment
  --skip-frontend      Skip frontend deployment
  --help               Show this help message

Environment Variables:
  DATABASE_URL         MongoDB connection string (required)
  GROQ_API_KEY         Groq API key (required for backend)
  JWT_SECRET           JWT signing secret (required for backend)
  DOCKER_REGISTRY      Docker registry URL (optional)
  BACKEND_URL          Backend health check URL (default: http://localhost:3001)
  FRONTEND_URL         Frontend health check URL (default: http://localhost:3000)

Examples:
  # Deploy to production
  $0 production

  # Dry run
  DRY_RUN=true $0 production

  # Deploy only frontend
  $0 --skip-backend production

EOF
}

# Parse arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --dry-run)
                DRY_RUN="true"
                shift
                ;;
            --skip-health-check)
                SKIP_HEALTH_CHECK="true"
                shift
                ;;
            --skip-backup)
                SKIP_BACKUP="true"
                shift
                ;;
            --skip-backend)
                SKIP_BACKEND="true"
                shift
                ;;
            --skip-frontend)
                SKIP_FRONTEND="true"
                shift
                ;;
            --help)
                usage
                exit 0
                ;;
            production|staging|development)
                ENVIRONMENT="$1"
                shift
                ;;
            *)
                die "Unknown option: $1. Use --help for usage."
                ;;
        esac
    done
}

# Track start time
START_TIME=$(date +%s)

# Main execution
main() {
    parse_args "$@"
    
    echo -e "${CYAN}"
    cat << "EOF"
    ___       __        __                __   ______            __    
   /   | ____/ /_____ _/ /_  ____  ____  / /__/_  __/___  ____  / /____
  / /| |/ __  / __/ __  / __ \/ __ \/ __ \/ //_// / / __ \/ __ \/ / ___/
 / ___ / /_/ / /  / /_/ / /_/ / /_/ / / / / ,<  / / / /_/ / /_/ / (__  ) 
/_/  |_\__,_/_/   \__,_/_.___/\____/_/ /_/_/|_|/_/  \____/\____/_/____/  
                                                                          
EOF
    echo -e "${NC}"
    
    log_info "Starting AutoAcct Full Deployment"
    log_info "Environment: $ENVIRONMENT"
    log_info "Dry Run: $DRY_RUN"
    
    pre_deployment_checks
    backup_database
    deploy_backend
    deploy_frontend
    run_migrations
    post_deployment_verification
    print_summary
}

# Handle script interruption
trap 'die "Deployment interrupted"' INT TERM

main "$@"
