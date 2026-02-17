#!/bin/bash
#
# Frontend Deployment Script for AutoAcct
#
# Usage:
#   ./deploy-frontend.sh [environment]
#
# Environments:
#   - production (default)
#   - staging
#   - development
#
# Required Environment Variables:
#   - NEXT_PUBLIC_API_BASE_URL: Backend API URL
#   - DEPLOY_TARGET: Deployment target (vercel, netlify, s3, docker)
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
DEPLOY_TARGET="${DEPLOY_TARGET:-docker}"
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
        "NEXT_PUBLIC_API_BASE_URL"
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
    
    log_success "Environment validation passed"
}

# Install dependencies
install_deps() {
    log_info "Installing dependencies..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would install dependencies"
        return 0
    fi
    
    cd "$PROJECT_ROOT/frontend"
    
    # Use npm ci for production builds
    if [[ "$ENVIRONMENT" == "production" ]]; then
        npm ci
    else
        npm install
    fi
    
    log_success "Dependencies installed"
}

# Build frontend
build_frontend() {
    log_info "Building frontend for ${ENVIRONMENT}..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would build frontend"
        return 0
    fi
    
    cd "$PROJECT_ROOT/frontend"
    
    # Set environment variables for build
    export NODE_ENV="$ENVIRONMENT"
    export NEXT_TELEMETRY_DISABLED=1
    
    # Clean previous build
    rm -rf .next out
    
    # Build
    npm run build
    
    log_success "Frontend build completed"
}

# Deploy to Docker
deploy_docker() {
    log_info "Deploying frontend to Docker..."
    
    local docker_registry="${DOCKER_REGISTRY:-}"
    local image_name="${DOCKER_IMAGE_NAME:-autoacct-frontend}"
    local image_tag="${docker_registry:+${docker_registry}/}${image_name}:${VERSION}"
    local latest_tag="${docker_registry:+${docker_registry}/}${image_name}:latest"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would build and push Docker image: $image_tag"
        return 0
    fi
    
    cd "$PROJECT_ROOT/frontend"
    
    # Build Docker image
    docker build \
        --build-arg NEXT_PUBLIC_API_BASE_URL="$NEXT_PUBLIC_API_BASE_URL" \
        --build-arg NODE_ENV="$ENVIRONMENT" \
        --tag "$image_tag" \
        --tag "$latest_tag" \
        --file Dockerfile \
        .
    
    # Push if registry is configured
    if [[ -n "$docker_registry" ]]; then
        docker push "$image_tag"
        docker push "$latest_tag"
    fi
    
    # Deploy with docker-compose
    cd "$PROJECT_ROOT"
    export FRONTEND_IMAGE="$image_tag"
    docker-compose up -d frontend
    
    log_success "Frontend deployed to Docker"
}

# Deploy to Vercel
deploy_vercel() {
    log_info "Deploying frontend to Vercel..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would deploy to Vercel"
        return 0
    fi
    
    cd "$PROJECT_ROOT/frontend"
    
    # Check if Vercel CLI is installed
    if ! command -v vercel &> /dev/null; then
        die "Vercel CLI is not installed. Run: npm i -g vercel"
    fi
    
    # Deploy
    if [[ "$ENVIRONMENT" == "production" ]]; then
        vercel --prod
    else
        vercel
    fi
    
    log_success "Frontend deployed to Vercel"
}

# Deploy to Netlify
deploy_netlify() {
    log_info "Deploying frontend to Netlify..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would deploy to Netlify"
        return 0
    fi
    
    cd "$PROJECT_ROOT/frontend"
    
    # Check if Netlify CLI is installed
    if ! command -v netlify &> /dev/null; then
        die "Netlify CLI is not installed. Run: npm i -g netlify-cli"
    fi
    
    # Deploy
    if [[ "$ENVIRONMENT" == "production" ]]; then
        netlify deploy --prod --dir=out
    else
        netlify deploy --dir=out
    fi
    
    log_success "Frontend deployed to Netlify"
}

# Deploy to S3
deploy_s3() {
    log_info "Deploying frontend to S3..."
    
    local s3_bucket="${S3_BUCKET:-}"
    local cloudfront_id="${CLOUDFRONT_DISTRIBUTION_ID:-}"
    
    if [[ -z "$s3_bucket" ]]; then
        die "S3_BUCKET environment variable is required"
    fi
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would deploy to S3 bucket: $s3_bucket"
        return 0
    fi
    
    cd "$PROJECT_ROOT/frontend"
    
    # Sync build output to S3
    aws s3 sync out/ "s3://$s3_bucket/" --delete
    
    # Invalidate CloudFront cache if distribution ID is provided
    if [[ -n "$cloudfront_id" ]]; then
        aws cloudfront create-invalidation \
            --distribution-id "$cloudfront_id" \
            --paths "/*"
    fi
    
    log_success "Frontend deployed to S3"
}

# Run health check
health_check() {
    log_info "Running health check..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would run health check"
        return 0
    fi
    
    local frontend_url="${FRONTEND_URL:-http://localhost:3000}"
    local retries=0
    local max_retries=6
    
    while [[ $retries -lt $max_retries ]]; do
        if curl -sf "$frontend_url" > /dev/null 2>&1; then
            log_success "Frontend health check passed"
            return 0
        fi
        
        retries=$((retries + 1))
        log_info "Health check attempt $retries/$max_retries..."
        sleep 5
    done
    
    die "Frontend health check failed"
}

# Main execution
main() {
    log_info "Starting AutoAcct Frontend Deployment"
    log_info "Environment: $ENVIRONMENT"
    log_info "Target: $DEPLOY_TARGET"
    log_info "Version: $VERSION"
    log_info "Dry Run: $DRY_RUN"
    
    validate_environment
    install_deps
    build_frontend
    
    # Deploy based on target
    case "$DEPLOY_TARGET" in
        docker)
            deploy_docker
            ;;
        vercel)
            deploy_vercel
            ;;
        netlify)
            deploy_netlify
            ;;
        s3)
            deploy_s3
            ;;
        *)
            die "Unknown deploy target: $DEPLOY_TARGET"
            ;;
    esac
    
    health_check
    
    log_success "Frontend deployment completed successfully!"
    log_info "Version: $VERSION"
    log_info "Environment: $ENVIRONMENT"
    log_info "Target: $DEPLOY_TARGET"
}

# Handle script interruption
trap 'die "Deployment interrupted"' INT TERM

main "$@"
