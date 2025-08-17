#!/bin/bash

# Kubernetes Deployment Script for SMEDREC Audit Server
# Provides convenient commands for deploying and managing Kubernetes resources

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="smedrec-audit"
APP_NAME="audit-server"
K8S_DIR="k8s"

# Functions
print_usage() {
    echo -e "${BLUE}SMEDREC Audit Server Kubernetes Deployment Script${NC}"
    echo ""
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  deploy        Deploy all resources to Kubernetes"
    echo "  update        Update existing deployment"
    echo "  rollback      Rollback to previous deployment"
    echo "  scale         Scale the deployment"
    echo "  status        Show deployment status"
    echo "  logs          Show application logs"
    echo "  delete        Delete all resources"
    echo "  restart       Restart the deployment"
    echo "  port-forward  Forward local port to service"
    echo "  help          Show this help message"
    echo ""
    echo "Options:"
    echo "  -n, --namespace NS    Specify namespace (default: $NAMESPACE)"
    echo "  -r, --replicas NUM    Number of replicas for scaling"
    echo "  -f, --follow          Follow logs in real-time"
    echo "  -p, --port PORT       Local port for port-forwarding (default: 8080)"
    echo "  --dry-run             Show what would be deployed without applying"
    echo ""
    echo "Examples:"
    echo "  $0 deploy"
    echo "  $0 scale -r 5"
    echo "  $0 logs -f"
    echo "  $0 port-forward -p 3000"
}

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

check_kubectl() {
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed or not in PATH"
        exit 1
    fi
    
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi
}

check_k8s_files() {
    local required_files=(
        "$K8S_DIR/namespace.yaml"
        "$K8S_DIR/configmap.yaml"
        "$K8S_DIR/secret.yaml"
        "$K8S_DIR/serviceaccount.yaml"
        "$K8S_DIR/deployment.yaml"
        "$K8S_DIR/service.yaml"
    )
    
    for file in "${required_files[@]}"; do
        if [[ ! -f "$file" ]]; then
            log_error "Required file not found: $file"
            exit 1
        fi
    done
}

deploy_resources() {
    log_info "Deploying SMEDREC Audit Server to Kubernetes..."
    
    check_k8s_files
    
    local kubectl_args=""
    if [[ "$DRY_RUN" == "true" ]]; then
        kubectl_args="--dry-run=client"
        log_info "Dry run mode - no resources will be created"
    fi
    
    # Deploy in order
    local files=(
        "$K8S_DIR/namespace.yaml"
        "$K8S_DIR/configmap.yaml"
        "$K8S_DIR/secret.yaml"
        "$K8S_DIR/serviceaccount.yaml"
        "$K8S_DIR/deployment.yaml"
        "$K8S_DIR/service.yaml"
    )
    
    # Optional files
    local optional_files=(
        "$K8S_DIR/ingress.yaml"
        "$K8S_DIR/hpa.yaml"
    )
    
    for file in "${files[@]}"; do
        log_info "Applying $file..."
        kubectl apply -f "$file" $kubectl_args
    done
    
    for file in "${optional_files[@]}"; do
        if [[ -f "$file" ]]; then
            log_info "Applying optional $file..."
            kubectl apply -f "$file" $kubectl_args
        fi
    done
    
    if [[ "$DRY_RUN" != "true" ]]; then
        log_success "Deployment completed successfully"
        
        # Wait for deployment to be ready
        log_info "Waiting for deployment to be ready..."
        kubectl wait --for=condition=available --timeout=300s deployment/$APP_NAME -n $NAMESPACE
        
        show_status
    fi
}

update_deployment() {
    log_info "Updating deployment..."
    
    # Update deployment with new image or configuration
    kubectl apply -f "$K8S_DIR/deployment.yaml" -n $NAMESPACE
    
    # Wait for rollout to complete
    log_info "Waiting for rollout to complete..."
    kubectl rollout status deployment/$APP_NAME -n $NAMESPACE
    
    log_success "Update completed successfully"
    show_status
}

rollback_deployment() {
    log_info "Rolling back deployment..."
    
    # Rollback to previous revision
    kubectl rollout undo deployment/$APP_NAME -n $NAMESPACE
    
    # Wait for rollback to complete
    log_info "Waiting for rollback to complete..."
    kubectl rollout status deployment/$APP_NAME -n $NAMESPACE
    
    log_success "Rollback completed successfully"
    show_status
}

scale_deployment() {
    if [[ -z "$REPLICAS" ]]; then
        log_error "Number of replicas not specified. Use -r or --replicas option."
        exit 1
    fi
    
    log_info "Scaling deployment to $REPLICAS replicas..."
    
    kubectl scale deployment/$APP_NAME --replicas=$REPLICAS -n $NAMESPACE
    
    # Wait for scaling to complete
    log_info "Waiting for scaling to complete..."
    kubectl wait --for=condition=available --timeout=300s deployment/$APP_NAME -n $NAMESPACE
    
    log_success "Scaling completed successfully"
    show_status
}

show_status() {
    log_info "Deployment Status:"
    echo ""
    
    # Namespace
    echo -e "${BLUE}Namespace:${NC}"
    kubectl get namespace $NAMESPACE 2>/dev/null || log_warning "Namespace $NAMESPACE not found"
    echo ""
    
    # Deployments
    echo -e "${BLUE}Deployments:${NC}"
    kubectl get deployments -n $NAMESPACE 2>/dev/null || log_warning "No deployments found"
    echo ""
    
    # Pods
    echo -e "${BLUE}Pods:${NC}"
    kubectl get pods -n $NAMESPACE 2>/dev/null || log_warning "No pods found"
    echo ""
    
    # Services
    echo -e "${BLUE}Services:${NC}"
    kubectl get services -n $NAMESPACE 2>/dev/null || log_warning "No services found"
    echo ""
    
    # Ingress (if exists)
    if kubectl get ingress -n $NAMESPACE &>/dev/null; then
        echo -e "${BLUE}Ingress:${NC}"
        kubectl get ingress -n $NAMESPACE
        echo ""
    fi
    
    # HPA (if exists)
    if kubectl get hpa -n $NAMESPACE &>/dev/null; then
        echo -e "${BLUE}Horizontal Pod Autoscaler:${NC}"
        kubectl get hpa -n $NAMESPACE
        echo ""
    fi
}

show_logs() {
    local kubectl_args=""
    
    if [[ "$FOLLOW" == "true" ]]; then
        kubectl_args="-f"
        log_info "Following logs for $APP_NAME (Press Ctrl+C to stop)..."
    else
        log_info "Showing recent logs for $APP_NAME..."
    fi
    
    kubectl logs deployment/$APP_NAME -n $NAMESPACE $kubectl_args
}

delete_resources() {
    log_warning "This will delete all resources for $APP_NAME in namespace $NAMESPACE"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Deletion cancelled"
        return 0
    fi
    
    log_info "Deleting resources..."
    
    # Delete in reverse order
    local files=(
        "$K8S_DIR/hpa.yaml"
        "$K8S_DIR/ingress.yaml"
        "$K8S_DIR/service.yaml"
        "$K8S_DIR/deployment.yaml"
        "$K8S_DIR/serviceaccount.yaml"
        "$K8S_DIR/secret.yaml"
        "$K8S_DIR/configmap.yaml"
        "$K8S_DIR/namespace.yaml"
    )
    
    for file in "${files[@]}"; do
        if [[ -f "$file" ]]; then
            log_info "Deleting resources from $file..."
            kubectl delete -f "$file" --ignore-not-found=true
        fi
    done
    
    log_success "All resources deleted successfully"
}

restart_deployment() {
    log_info "Restarting deployment..."
    
    kubectl rollout restart deployment/$APP_NAME -n $NAMESPACE
    
    # Wait for restart to complete
    log_info "Waiting for restart to complete..."
    kubectl rollout status deployment/$APP_NAME -n $NAMESPACE
    
    log_success "Restart completed successfully"
    show_status
}

port_forward() {
    local local_port=${PORT:-8080}
    local remote_port=80
    
    log_info "Port forwarding from localhost:$local_port to service/$APP_NAME:$remote_port"
    log_info "Access the application at: http://localhost:$local_port"
    log_info "Press Ctrl+C to stop port forwarding"
    
    kubectl port-forward service/$APP_NAME $local_port:$remote_port -n $NAMESPACE
}

# Parse command line arguments
REPLICAS=""
FOLLOW="false"
PORT=""
DRY_RUN="false"

while [[ $# -gt 0 ]]; do
    case $1 in
        -n|--namespace)
            NAMESPACE="$2"
            shift 2
            ;;
        -r|--replicas)
            REPLICAS="$2"
            shift 2
            ;;
        -f|--follow)
            FOLLOW="true"
            shift
            ;;
        -p|--port)
            PORT="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN="true"
            shift
            ;;
        deploy)
            COMMAND="deploy"
            shift
            ;;
        update)
            COMMAND="update"
            shift
            ;;
        rollback)
            COMMAND="rollback"
            shift
            ;;
        scale)
            COMMAND="scale"
            shift
            ;;
        status)
            COMMAND="status"
            shift
            ;;
        logs)
            COMMAND="logs"
            shift
            ;;
        delete)
            COMMAND="delete"
            shift
            ;;
        restart)
            COMMAND="restart"
            shift
            ;;
        port-forward)
            COMMAND="port-forward"
            shift
            ;;
        help)
            print_usage
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            print_usage
            exit 1
            ;;
    esac
done

# Check if command is provided
if [[ -z "$COMMAND" ]]; then
    log_error "No command specified"
    print_usage
    exit 1
fi

# Check kubectl availability
check_kubectl

# Execute command
case $COMMAND in
    deploy)
        deploy_resources
        ;;
    update)
        update_deployment
        ;;
    rollback)
        rollback_deployment
        ;;
    scale)
        scale_deployment
        ;;
    status)
        show_status
        ;;
    logs)
        show_logs
        ;;
    delete)
        delete_resources
        ;;
    restart)
        restart_deployment
        ;;
    port-forward)
        port_forward
        ;;
    *)
        log_error "Unknown command: $COMMAND"
        exit 1
        ;;
esac