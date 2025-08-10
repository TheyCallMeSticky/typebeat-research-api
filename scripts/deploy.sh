#!/bin/bash

# TypeBeat Research API - Deployment Script
# This script automates the deployment process for production environments

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$PROJECT_DIR/backups"
LOG_FILE="$PROJECT_DIR/deploy.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
    exit 1
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

# Check if running as root
check_root() {
    if [[ $EUID -eq 0 ]]; then
        error "This script should not be run as root for security reasons"
    fi
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed"
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        error "Docker Compose is not installed"
    fi
    
    # Check if .env.production exists
    if [[ ! -f "$PROJECT_DIR/.env.production" ]]; then
        error ".env.production file not found. Please create it with required environment variables."
    fi
    
    # Check required environment variables
    source "$PROJECT_DIR/.env.production"
    
    local required_vars=(
        "POSTGRES_PASSWORD"
        "REDIS_PASSWORD"
        "YOUTUBE_API_KEY"
        "SPOTIFY_CLIENT_ID"
        "SPOTIFY_CLIENT_SECRET"
        "LASTFM_API_KEY"
        "LASTFM_SHARED_SECRET"
    )
    
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            error "Required environment variable $var is not set in .env.production"
        fi
    done
    
    success "Prerequisites check passed"
}

# Create necessary directories
create_directories() {
    log "Creating necessary directories..."
    
    mkdir -p "$BACKUP_DIR"
    mkdir -p "$PROJECT_DIR/logs"
    mkdir -p "$PROJECT_DIR/docker/postgres"
    mkdir -p "$PROJECT_DIR/docker/redis"
    mkdir -p "$PROJECT_DIR/docker/nginx"
    mkdir -p "$PROJECT_DIR/docker/prometheus"
    mkdir -p "$PROJECT_DIR/docker/grafana/provisioning"
    mkdir -p "$PROJECT_DIR/docker/grafana/dashboards"
    
    success "Directories created"
}

# Backup existing data
backup_data() {
    log "Creating backup of existing data..."
    
    local backup_timestamp=$(date +"%Y%m%d_%H%M%S")
    local backup_file="$BACKUP_DIR/backup_$backup_timestamp.sql"
    
    # Check if database is running
    if docker-compose -f "$PROJECT_DIR/docker-compose.production.yml" ps postgres | grep -q "Up"; then
        log "Creating database backup..."
        docker-compose -f "$PROJECT_DIR/docker-compose.production.yml" exec -T postgres \
            pg_dump -U postgres typebeat_research > "$backup_file" 2>/dev/null || {
            warning "Database backup failed or database is empty"
        }
        
        if [[ -f "$backup_file" && -s "$backup_file" ]]; then
            success "Database backup created: $backup_file"
        else
            warning "Database backup is empty or failed"
            rm -f "$backup_file"
        fi
    else
        log "Database not running, skipping backup"
    fi
    
    # Cleanup old backups (keep last 10)
    find "$BACKUP_DIR" -name "backup_*.sql" -type f | sort -r | tail -n +11 | xargs rm -f
}

# Build Docker images
build_images() {
    log "Building Docker images..."
    
    cd "$PROJECT_DIR"
    
    # Build production image
    docker build -f Dockerfile.prod -t typebeat-research-api:latest . || error "Failed to build Docker image"
    
    success "Docker images built successfully"
}

# Deploy services
deploy_services() {
    log "Deploying services..."
    
    cd "$PROJECT_DIR"
    
    # Pull latest images for external services
    docker-compose -f docker-compose.production.yml pull postgres redis nginx || warning "Failed to pull some images"
    
    # Start services with zero-downtime deployment
    if docker-compose -f docker-compose.production.yml ps | grep -q "Up"; then
        log "Performing rolling update..."
        
        # Update database and cache first
        docker-compose -f docker-compose.production.yml up -d postgres redis
        
        # Wait for services to be healthy
        wait_for_health "postgres"
        wait_for_health "redis"
        
        # Update API with rolling restart
        docker-compose -f docker-compose.production.yml up -d --no-deps typebeat-research-api
        
        # Wait for API to be healthy
        wait_for_health "typebeat-research-api"
        
        # Update reverse proxy
        docker-compose -f docker-compose.production.yml up -d nginx
        
    else
        log "Starting services for the first time..."
        docker-compose -f docker-compose.production.yml up -d
    fi
    
    success "Services deployed successfully"
}

# Wait for service health
wait_for_health() {
    local service=$1
    local max_attempts=30
    local attempt=1
    
    log "Waiting for $service to be healthy..."
    
    while [[ $attempt -le $max_attempts ]]; do
        if docker-compose -f "$PROJECT_DIR/docker-compose.production.yml" ps "$service" | grep -q "healthy"; then
            success "$service is healthy"
            return 0
        fi
        
        log "Attempt $attempt/$max_attempts: $service not healthy yet, waiting..."
        sleep 10
        ((attempt++))
    done
    
    error "$service failed to become healthy within $(($max_attempts * 10)) seconds"
}

# Run database migrations
run_migrations() {
    log "Running database migrations..."
    
    # Check if migration files exist
    if [[ -d "$PROJECT_DIR/migrations" ]]; then
        docker-compose -f "$PROJECT_DIR/docker-compose.production.yml" exec -T typebeat-research-api \
            npm run migrate || warning "Database migrations failed"
    else
        log "No migration files found, skipping"
    fi
}

# Verify deployment
verify_deployment() {
    log "Verifying deployment..."
    
    # Check if all services are running
    local services=("postgres" "redis" "typebeat-research-api")
    
    for service in "${services[@]}"; do
        if ! docker-compose -f "$PROJECT_DIR/docker-compose.production.yml" ps "$service" | grep -q "Up"; then
            error "Service $service is not running"
        fi
    done
    
    # Test API health endpoint
    local api_url="http://localhost:3002/api/health"
    local max_attempts=10
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        if curl -f -s "$api_url" > /dev/null; then
            success "API health check passed"
            break
        fi
        
        if [[ $attempt -eq $max_attempts ]]; then
            error "API health check failed after $max_attempts attempts"
        fi
        
        log "API health check attempt $attempt/$max_attempts failed, retrying..."
        sleep 5
        ((attempt++))
    done
    
    # Test a sample API request
    log "Testing sample API request..."
    local test_response=$(curl -s -X POST "$api_url/../research/suggestions" \
        -H "Content-Type: application/json" \
        -d '{"artist": "Drake", "limit": 1}' || echo "failed")
    
    if echo "$test_response" | grep -q '"success":true'; then
        success "Sample API request successful"
    else
        warning "Sample API request failed: $test_response"
    fi
    
    success "Deployment verification completed"
}

# Cleanup old resources
cleanup() {
    log "Cleaning up old resources..."
    
    # Remove unused Docker images
    docker image prune -f || warning "Failed to prune Docker images"
    
    # Remove unused volumes (be careful with this)
    # docker volume prune -f || warning "Failed to prune Docker volumes"
    
    success "Cleanup completed"
}

# Show deployment status
show_status() {
    log "Deployment Status:"
    echo "===================="
    
    # Show running services
    docker-compose -f "$PROJECT_DIR/docker-compose.production.yml" ps
    
    echo ""
    log "Service URLs:"
    echo "API: http://localhost:3002"
    echo "Health Check: http://localhost:3002/api/health"
    echo "Metrics: http://localhost:9090 (if monitoring enabled)"
    echo "Grafana: http://localhost:3000 (if monitoring enabled)"
    
    echo ""
    log "Useful Commands:"
    echo "View logs: docker-compose -f docker-compose.production.yml logs -f"
    echo "Stop services: docker-compose -f docker-compose.production.yml down"
    echo "Restart API: docker-compose -f docker-compose.production.yml restart typebeat-research-api"
}

# Rollback function
rollback() {
    local backup_file=$1
    
    if [[ -z "$backup_file" ]]; then
        error "Backup file not specified for rollback"
    fi
    
    if [[ ! -f "$backup_file" ]]; then
        error "Backup file not found: $backup_file"
    fi
    
    warning "Rolling back to backup: $backup_file"
    
    # Stop current services
    docker-compose -f "$PROJECT_DIR/docker-compose.production.yml" down
    
    # Restore database
    docker-compose -f "$PROJECT_DIR/docker-compose.production.yml" up -d postgres
    wait_for_health "postgres"
    
    docker-compose -f "$PROJECT_DIR/docker-compose.production.yml" exec -T postgres \
        psql -U postgres -d typebeat_research < "$backup_file"
    
    # Start services
    docker-compose -f "$PROJECT_DIR/docker-compose.production.yml" up -d
    
    success "Rollback completed"
}

# Main deployment function
main() {
    local command=${1:-deploy}
    
    case $command in
        "deploy")
            log "Starting TypeBeat Research API deployment..."
            check_root
            check_prerequisites
            create_directories
            backup_data
            build_images
            deploy_services
            run_migrations
            verify_deployment
            cleanup
            show_status
            success "Deployment completed successfully!"
            ;;
        "rollback")
            local backup_file=${2:-}
            rollback "$backup_file"
            ;;
        "status")
            show_status
            ;;
        "backup")
            backup_data
            ;;
        "verify")
            verify_deployment
            ;;
        *)
            echo "Usage: $0 {deploy|rollback|status|backup|verify}"
            echo ""
            echo "Commands:"
            echo "  deploy   - Full deployment (default)"
            echo "  rollback - Rollback to specified backup"
            echo "  status   - Show current deployment status"
            echo "  backup   - Create backup only"
            echo "  verify   - Verify current deployment"
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"

