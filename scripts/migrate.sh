#!/bin/bash
#
# Database Migration Script for AutoAcct
#
# Usage:
#   ./migrate.sh [command]
#
# Commands:
#   up       - Run pending migrations (default)
#   down     - Rollback last migration
#   status   - Show migration status
#   create   - Create a new migration
#   backup   - Backup database before migration
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
COMMAND="${1:-up}"
MIGRATIONS_DIR="$PROJECT_ROOT/backend/migrations"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_ROOT/backups}"
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
    log_info "Validating environment..."
    
    if [[ -z "${DATABASE_URL:-}" ]]; then
        die "DATABASE_URL environment variable is required"
    fi
    
    # Create migrations directory if it doesn't exist
    mkdir -p "$MIGRATIONS_DIR"
    
    log_success "Environment validation passed"
}

# Backup database
backup_database() {
    log_info "Creating database backup..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would create backup"
        return 0
    fi
    
    mkdir -p "$BACKUP_DIR"
    
    local backup_name="backup_$(date +%Y%m%d_%H%M%S).gz"
    local backup_path="$BACKUP_DIR/$backup_name"
    
    # Extract database name from connection string
    local db_name=$(echo "$DATABASE_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')
    
    if [[ -z "$db_name" ]]; then
        log_warn "Could not extract database name from URL, using 'autoacct'"
        db_name="autoacct"
    fi
    
    # Create backup using mongodump
    if command -v mongodump &> /dev/null; then
        mongodump --uri="$DATABASE_URL" --gzip --archive="$backup_path"
        log_success "Backup created: $backup_path"
    else
        log_warn "mongodump not found, skipping backup"
    fi
}

# Run migrations up
migrate_up() {
    log_info "Running pending migrations..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would run migrations"
        return 0
    fi
    
    cd "$PROJECT_ROOT/backend"
    
    # Run migrations using the npm script
    npm run migrate:up || die "Migration failed"
    
    log_success "Migrations completed"
}

# Rollback last migration
migrate_down() {
    log_warn "Rolling back last migration..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would rollback migration"
        return 0
    fi
    
    cd "$PROJECT_ROOT/backend"
    
    # Confirm rollback
    read -p "Are you sure you want to rollback the last migration? (y/N) " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Rollback cancelled"
        exit 0
    fi
    
    # Create backup before rollback
    backup_database
    
    # Run rollback
    npm run migrate:down || die "Rollback failed"
    
    log_success "Rollback completed"
}

# Show migration status
migration_status() {
    log_info "Checking migration status..."
    
    cd "$PROJECT_ROOT/backend"
    
    # List migration files
    local migration_count=$(find "$MIGRATIONS_DIR" -name "*.js" -o -name "*.ts" 2>/dev/null | wc -l)
    
    log_info "Found $migration_count migration files in $MIGRATIONS_DIR"
    
    # Show recent migrations
    if [[ $migration_count -gt 0 ]]; then
        echo
        echo "Recent migrations:"
        find "$MIGRATIONS_DIR" -name "*.js" -o -name "*.ts" 2>/dev/null | sort -r | head -10 | while read -r file; do
            local filename=$(basename "$file")
            local status="PENDING"
            
            # Check if migration has been applied (you would need to implement this check)
            echo "  [$status] $filename"
        done
    fi
}

# Create new migration
create_migration() {
    local name="${2:-}"
    
    if [[ -z "$name" ]]; then
        die "Migration name is required. Usage: ./migrate.sh create <name>"
    fi
    
    # Sanitize name
    name=$(echo "$name" | tr '[:upper:]' '[:lower:]' | tr ' ' '_')
    
    local timestamp=$(date +%Y%m%d%H%M%S)
    local filename="${timestamp}_${name}.ts"
    local filepath="$MIGRATIONS_DIR/$filename"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would create migration: $filename"
        return 0
    fi
    
    # Create migration file template
    cat > "$filepath" << 'EOF'
import { Migration } from '../config/migration-runner';

export const migration: Migration = {
    name: '__MIGRATION_NAME__',
    
    async up(): Promise<void> {
        // TODO: Implement migration up
        // Example:
        // await db.collection('users').createIndex({ email: 1 }, { unique: true });
    },
    
    async down(): Promise<void> {
        // TODO: Implement migration down (rollback)
        // Example:
        // await db.collection('users').dropIndex('email_1');
    }
};
EOF
    
    # Replace placeholder
    sed -i "s/__MIGRATION_NAME__/$name/g" "$filepath"
    
    log_success "Migration created: $filepath"
}

# Main execution
main() {
    log_info "AutoAcct Database Migration Tool"
    log_info "Command: $COMMAND"
    log_info "Database: ${DATABASE_URL:-not set}"
    
    validate_environment
    
    case "$COMMAND" in
        up)
            backup_database
            migrate_up
            ;;
        down)
            migrate_down
            ;;
        status)
            migration_status
            ;;
        create)
            create_migration "$@"
            ;;
        backup)
            backup_database
            ;;
        *)
            die "Unknown command: $COMMAND. Available: up, down, status, create, backup"
            ;;
    esac
    
    log_success "Migration operation completed"
}

# Handle script interruption
trap 'die "Migration interrupted"' INT TERM

main "$@"
