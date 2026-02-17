#!/bin/bash
#
# Backend Deployment Script for AutoAcct
#
# Usage:
#   ./deploy-backend.sh [environment]
#
# Environments:
#   - production (default)
#   - staging
#   - development
#
# Required Environment Variables:
#   - DOCKER_REGISTRY: Container registry URL (e.g., ghcr.io/username)
#   - DOCKER_IMAGE_NAME: Image name (default: autoacct-backend)
#   - DATABASE_URL: MongoDB connection string
#   - GROQ_API_KEY: Groq API key
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
ENVIRONMENT="${1:-production}"
DOCKER_REGISTRY="${DOCKER_REGISTRY:-}" 
DOCKER_IMAGE_NAME="${DOCKER_IMAGE_NAME:-autoacct-backend}"
VERSION="${VERSION:-$(git describe --tags --always --dirty 2>/dev/null || echo 'latest')}"
DRY_RUN="${DRY_RUN:-false}"

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

die() {
    log_error "$1"
    exit 1
}

# Validate environment
validate_environment() {
    log_info "Validating environment for ${ENVIRONMENT} deployment..."
    
    # Check required environment variables
    local required_vars=(
        "DATABASE_URL"
        "GROQ_API_KEY"
        "JWT_SECRET"
        "ENCRYPTION_KEY"
    )
    
    local missing_vars=()
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            missing_vars+=("$var")
        fi
    done
    
    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        die "Missing required environment variables: ${missing_vars[*]}"
    fi
    
    # Validate Docker registry if pushing
    if [[ "$DRY_RUN" != "true" && -z "$DOCKER_REGISTRY" ]]; then
        die "DOCKER_REGISTRY is required for push deployment"
    fi
    
    log_success "Environment validation passed"
}

# Build Docker image
build_image() {
    log_info "Building Docker image..."
    
    local image_tag="${DOCKER_REGISTRY:+${DOCKER_REGISTRY}/}${DOCKER_IMAGE_NAME}:${VERSION}"
    local latest_tag="${DOCKER_REGISTRY:+${DOCKER_REGISTRY}/}${DOCKER_IMAGE_NAME}:latest"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would build: $image_tag"
        return 0
    fi
    
    cd "$PROJECT_ROOT/backend"
    
    # Build the image
    docker build \
        --build-arg NODE_ENV="$ENVIRONMENT" \
        --build-arg BUILD_VERSION="$VERSION" \
        --tag "$image_tag" \
        --tag "$latest_tag" \
        --file Dockerfile \
        .
    
    log_success "Image built: $image_tag"
}

# Push Docker image
push_image() {
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would push image to registry"
        return 0
    fi
    
    log_info "Pushing Docker image to registry..."
    
    local image_tag="${DOCKER_REGISTRY:+${DOCKER_REGISTRY}/}${DOCKER_IMAGE_NAME}:${VERSION}"
    local latest_tag="${DOCKER_REGISTRY:+${DOCKER_REGISTRY}/}${DOCKER_IMAGE_NAME}:latest"
    
    # Push both tags
    docker push "$image_tag"
    docker push "$latest_tag"
    
    log_success "Image pushed successfully"
}

# Run database migrations
run_migrations() {
    log_info "Running database migrations..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would run migrations"
        return 0
    fi
    
    cd "$PROJECT_ROOT/backend"
    
    # Run migrations using npm script
    npm run migrate:up || die "Migration failed"
    
    log_success "Migrations completed"
}

# Deploy to environment
deploy() {
    log_info "Deploying to ${ENVIRONMENT}..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would deploy to ${ENVIRONMENT}"
        return 0
    fi
    
    # Use docker-compose for deployment
    cd "$PROJECT_ROOT"
    
    # Export environment variables for docker-compose
    export BACKEND_IMAGE="${DOCKER_REGISTRY:+${DOCKER_REGISTRY}/}${DOCKER_IMAGE_NAME}:${VERSION}"
    
    # Pull latest image and restart services
    docker-compose pull backend
    docker-compose up -d backend
    
    # Wait for health check
    log_info "Waiting for health check..."
    sleep 5
    
    local health_url="http://localhost:3001/health"
    local retries=0
    local max_retries=12
    
    while [[ $retries -lt $max_retries ]]; do
        if curl -sf "$health_url" > /dev/null 2>&1; then
            log_success "Health check passed"
            break
        fi
        
        retries=$((retries + 1))
        log_info "Health check attempt $retries/$max_retries..."
        sleep 5
    done
    
    if [[ $retries -eq $max_retries ]]; then
        die "Health check failed after $max_retries attempts"
    fi
    
    log_success "Deployment completed successfully"
}

# Cleanup old images
cleanup() {
    log_info "Cleaning up old images..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would clean up old images"
        return 0
    fi
    
    # Keep only the last 5 versions
    docker images "${DOCKER_REGISTRY:+${DOCKER_REGISTRY}/}${DOCKER_IMAGE_NAME}" \
        --format "{{.Repository}}:{{.Tag}} {{.CreatedAt}}" \
        | sort -k2 -r \
        | tail -n +6 \
        | awk '{print $1}' \
        | xargs -r docker rmi 2>/dev/null || true
    
    log_success "Cleanup completed"
}

# Main execution
main() {
    log_info "Starting AutoAcct Backend Deployment"
    log_info "Environment: $ENVIRONMENT"
    log_info "Version: $VERSION"
    log_info "Dry Run: $DRY_RUN"
    
    validate_environment
    build_image
    push_image
    run_migrations
    deploy
    cleanup
    
    log_success "Backend deployment completed successfully!"
    log_info "Version: $VERSION"
    log_info "Environment: $ENVIRONMENT"
}

# Handle script interruption
trap 'die "Deployment interrupted"' INT TERM

main "$@"
