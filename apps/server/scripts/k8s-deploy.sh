#!/bin/bash

# SMEDREC Audit Server Kubernetes Deployment Script
# This script handles deployment to Kubernetes clusters

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
K8S_DIR="$(dirname "$SCRIPT_DIR")/k8s"
NAMESPACE="smedrec-audit"
APP_NAME="audit-server"

# Default values
ENVIRONMENT="production"
IMAGE_TAG="latest"
DRY_RUN=false
SKIP_BACKUP=false
ROLLBACK=false
WAIT_TIMEOUT="600s"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Help function
show_help() {
    cat << EOF
SMEDREC Audit Server Kubernetes Deployment Script

Usage: $0 [OPTIONS]

Options:
    -e, --environment ENV    Target environment (production, staging) [default: production]
    -t, --tag TAG           Docker image tag [default: latest]
    -n, --namespace NS      Kubernetes namespace [default: smedrec-audit]
    -d, --dry-run          Perform a dry run without making changes
    -s, --skip-backup      Skip pre-deployment backup
    -r, --rollback         Rollback to previous deployment
    -w, --wait TIMEOUT     Wait timeout for rollout [default: 600s]
    -h, --help             Show this help message

Examples:
    $0 --environment production --tag v1.2.3
    $0 --dry-run --environment staging
    $0 --rollback --environment production

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -t|--tag)
            IMAGE_TAG="$2"
            shift 2
            ;;
        -n|--namespace)
            NAMESPACE="$2"
            shift 2
            ;;
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -s|--skip-backup)
            SKIP_BACKUP=true
            shift
            ;;
        -r|--rollback)
            ROLLBACK=true
            shift
            ;;
        -w|--wait)
            WAIT_TIMEOUT="$2"
            shift 2
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Validate environment
if [[ "$ENVIRONMENT" != "production" && "$ENVIRONMENT" != "staging" ]]; then
    log_error "Invalid environment: $ENVIRONMENT. Must be 'production' or 'staging'"
    exit 1
fi

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed or not in PATH"
        exit 1
    fi
    
    # Check cluster connectivity
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi
    
    # Check namespace exists
    if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
        log_warning "Namespace $NAMESPACE does not exist, creating..."
        if [[ "$DRY_RUN" == "false" ]]; then
            kubectl create namespace "$NAMESPACE"
        fi
    fi
    
    log_success "Prerequisites check passed"
}

# Create backup before deployment
create_backup() {
    if [[ "$SKIP_BACKUP" == "true" ]]; then
        log_warning "Skipping backup as requested"
        return
    fi
    
    log_info "Creating pre-deployment backup..."
    
    local backup_job_name="backup-pre-deploy-$(date +%s)"
    
    if [[ "$DRY_RUN" == "false" ]]; then
        # Check if backup cronjob exists
        if kubectl get cronjob backup-job -n "$NAMESPACE" &> /dev/null; then
            kubectl create job --from=cronjob/backup-job "$backup_job_name" -n "$NAMESPACE"
            
            # Wait for backup to complete
            log_info "Waiting for backup to complete..."
            if kubectl wait --for=condition=complete "job/$backup_job_name" -n "$NAMESPACE" --timeout=600s; then
                log_success "Backup completed successfully"
            else
                log_error "Backup failed or timed out"
                exit 1
            fi
        else
            log_warning "Backup cronjob not found, skipping backup"
        fi
    else
        log_info "[DRY RUN] Would create backup job: $backup_job_name"
    fi
}

# Deploy application
deploy_application() {
    log_info "Deploying $APP_NAME to $ENVIRONMENT environment..."
    
    local image_name="ghcr.io/smedrec/audit-server:$IMAGE_TAG"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would deploy image: $image_name"
        log_info "[DRY RUN] Would apply manifests from: $K8S_DIR"
        return
    fi
    
    # Apply all Kubernetes manifests
    log_info "Applying Kubernetes manifests..."
    kubectl apply -f "$K8S_DIR/" -n "$NAMESPACE"
    
    # Update deployment image
    log_info "Updating deployment image to: $image_name"
    kubectl set image "deployment/$APP_NAME" "$APP_NAME=$image_name" -n "$NAMESPACE"
    
    # Wait for rollout to complete
    log_info "Waiting for rollout to complete (timeout: $WAIT_TIMEOUT)..."
    if kubectl rollout status "deployment/$APP_NAME" -n "$NAMESPACE" --timeout="$WAIT_TIMEOUT"; then
        log_success "Deployment completed successfully"
    else
        log_error "Deployment failed or timed out"
        return 1
    fi
}

# Rollback deployment
rollback_deployment() {
    log_info "Rolling back $APP_NAME deployment..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would rollback deployment"
        return
    fi
    
    kubectl rollout undo "deployment/$APP_NAME" -n "$NAMESPACE"
    
    log_info "Waiting for rollback to complete..."
    if kubectl rollout status "deployment/$APP_NAME" -n "$NAMESPACE" --timeout="$WAIT_TIMEOUT"; then
        log_success "Rollback completed successfully"
    else
        log_error "Rollback failed or timed out"
        return 1
    fi
}

# Verify deployment
verify_deployment() {
    log_info "Verifying deployment..."
    
    # Check pod status
    local ready_pods
    ready_pods=$(kubectl get pods -n "$NAMESPACE" -l "app.kubernetes.io/name=$APP_NAME" -o jsonpath='{.items[*].status.conditions[?(@.type=="Ready")].status}' | grep -o "True" | wc -l)
    local total_pods
    total_pods=$(kubectl get pods -n "$NAMESPACE" -l "app.kubernetes.io/name=$APP_NAME" --no-headers | wc -l)
    
    log_info "Ready pods: $ready_pods/$total_pods"
    
    if [[ "$ready_pods" -eq "$total_pods" && "$total_pods" -gt 0 ]]; then
        log_success "All pods are ready"
    else
        log_error "Not all pods are ready"
        kubectl get pods -n "$NAMESPACE" -l "app.kubernetes.io/name=$APP_NAME"
        return 1
    fi
    
    # Check service endpoints
    local service_endpoints
    service_endpoints=$(kubectl get endpoints "$APP_NAME" -n "$NAMESPACE" -o jsonpath='{.subsets[*].addresses[*].ip}' | wc -w)
    
    if [[ "$service_endpoints" -gt 0 ]]; then
        log_success "Service has $service_endpoints endpoint(s)"
    else
        log_error "Service has no endpoints"
        return 1
    fi
    
    log_success "Deployment verification passed"
}

# Health check
health_check() {
    log_info "Performing health check..."
    
    # Get service URL based on environment
    local health_url
    if [[ "$ENVIRONMENT" == "production" ]]; then
        health_url="https://api.smedrec.com/health"
    else
        health_url="https://staging-api.smedrec.com/health"
    fi
    
    # Wait a bit for the service to be ready
    sleep 30
    
    # Perform health check
    local max_attempts=10
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        log_info "Health check attempt $attempt/$max_attempts..."
        
        if curl -f -s "$health_url" > /dev/null; then
            log_success "Health check passed"
            return 0
        fi
        
        if [[ $attempt -eq $max_attempts ]]; then
            log_error "Health check failed after $max_attempts attempts"
            return 1
        fi
        
        sleep 10
        ((attempt++))
    done
}

# Cleanup function
cleanup() {
    log_info "Cleaning up temporary resources..."
    
    # Clean up old backup jobs (keep last 5)
    local old_jobs
    old_jobs=$(kubectl get jobs -n "$NAMESPACE" -l job-name --sort-by=.metadata.creationTimestamp -o name | grep backup-pre-deploy | head -n -5)
    
    if [[ -n "$old_jobs" ]]; then
        echo "$old_jobs" | xargs kubectl delete -n "$NAMESPACE"
        log_info "Cleaned up old backup jobs"
    fi
}

# Main execution
main() {
    log_info "Starting deployment process..."
    log_info "Environment: $ENVIRONMENT"
    log_info "Namespace: $NAMESPACE"
    log_info "Image tag: $IMAGE_TAG"
    log_info "Dry run: $DRY_RUN"
    
    # Check prerequisites
    check_prerequisites
    
    if [[ "$ROLLBACK" == "true" ]]; then
        # Rollback deployment
        rollback_deployment
        verify_deployment
        health_check
    else
        # Normal deployment
        create_backup
        
        if deploy_application; then
            verify_deployment
            health_check
            cleanup
            log_success "Deployment completed successfully!"
        else
            log_error "Deployment failed, consider rolling back"
            exit 1
        fi
    fi
}

# Trap errors and cleanup
trap 'log_error "Script failed on line $LINENO"' ERR

# Run main function
main "$@"