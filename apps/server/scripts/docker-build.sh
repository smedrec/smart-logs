#!/bin/bash

# Docker Build Script for SMEDREC Audit Server
# Provides convenient commands for building and managing Docker images

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
IMAGE_NAME="smedrec/audit-server"
DOCKERFILE_PROD="Dockerfile"
DOCKERFILE_DEV="Dockerfile.dev"
BUILD_CONTEXT="../.."

# Functions
print_usage() {
    echo -e "${BLUE}SMEDREC Audit Server Docker Build Script${NC}"
    echo ""
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  build-dev     Build development image"
    echo "  build-prod    Build production image"
    echo "  build-all     Build both development and production images"
    echo "  push          Push images to registry"
    echo "  clean         Remove local images"
    echo "  scan          Scan images for vulnerabilities"
    echo "  test          Test built images"
    echo "  help          Show this help message"
    echo ""
    echo "Options:"
    echo "  -t, --tag TAG     Specify image tag (default: latest)"
    echo "  -r, --registry    Specify registry URL"
    echo "  --no-cache        Build without using cache"
    echo "  --platform        Specify target platform (e.g., linux/amd64,linux/arm64)"
    echo ""
    echo "Examples:"
    echo "  $0 build-prod -t v1.0.0"
    echo "  $0 build-all --no-cache"
    echo "  $0 push -t v1.0.0 -r my-registry.com"
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

check_docker() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed or not in PATH"
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running"
        exit 1
    fi
}

build_image() {
    local dockerfile=$1
    local tag_suffix=$2
    local build_args=""
    
    if [[ "$NO_CACHE" == "true" ]]; then
        build_args="$build_args --no-cache"
    fi
    
    if [[ -n "$PLATFORM" ]]; then
        build_args="$build_args --platform $PLATFORM"
    fi
    
    local full_tag="${REGISTRY}${IMAGE_NAME}:${TAG}${tag_suffix}"
    
    log_info "Building image: $full_tag"
    log_info "Dockerfile: $dockerfile"
    log_info "Build context: $BUILD_CONTEXT"
    
    if docker build $build_args -f "$dockerfile" -t "$full_tag" "$BUILD_CONTEXT"; then
        log_success "Successfully built $full_tag"
        
        # Also tag as latest if not already latest
        if [[ "$TAG" != "latest" ]]; then
            local latest_tag="${REGISTRY}${IMAGE_NAME}:latest${tag_suffix}"
            docker tag "$full_tag" "$latest_tag"
            log_info "Also tagged as $latest_tag"
        fi
        
        return 0
    else
        log_error "Failed to build $full_tag"
        return 1
    fi
}

build_dev() {
    log_info "Building development image..."
    build_image "$DOCKERFILE_DEV" "-dev"
}

build_prod() {
    log_info "Building production image..."
    build_image "$DOCKERFILE_PROD" ""
}

build_all() {
    log_info "Building all images..."
    build_dev && build_prod
}

push_images() {
    local images_to_push=()
    
    # Check which images exist locally
    if docker image inspect "${REGISTRY}${IMAGE_NAME}:${TAG}" &> /dev/null; then
        images_to_push+=("${REGISTRY}${IMAGE_NAME}:${TAG}")
    fi
    
    if docker image inspect "${REGISTRY}${IMAGE_NAME}:${TAG}-dev" &> /dev/null; then
        images_to_push+=("${REGISTRY}${IMAGE_NAME}:${TAG}-dev")
    fi
    
    if [[ ${#images_to_push[@]} -eq 0 ]]; then
        log_error "No images found to push. Build images first."
        return 1
    fi
    
    for image in "${images_to_push[@]}"; do
        log_info "Pushing $image..."
        if docker push "$image"; then
            log_success "Successfully pushed $image"
        else
            log_error "Failed to push $image"
            return 1
        fi
    done
}

clean_images() {
    log_info "Cleaning up local images..."
    
    # Remove images with the specified tag
    local images_to_remove=(
        "${REGISTRY}${IMAGE_NAME}:${TAG}"
        "${REGISTRY}${IMAGE_NAME}:${TAG}-dev"
        "${REGISTRY}${IMAGE_NAME}:latest"
        "${REGISTRY}${IMAGE_NAME}:latest-dev"
    )
    
    for image in "${images_to_remove[@]}"; do
        if docker image inspect "$image" &> /dev/null; then
            log_info "Removing $image..."
            docker rmi "$image" || log_warning "Failed to remove $image"
        fi
    done
    
    # Clean up dangling images
    log_info "Removing dangling images..."
    docker image prune -f
    
    log_success "Cleanup completed"
}

scan_images() {
    log_info "Scanning images for vulnerabilities..."
    
    # Check if docker scan or trivy is available
    if command -v trivy &> /dev/null; then
        log_info "Using Trivy for vulnerability scanning..."
        
        local images_to_scan=(
            "${REGISTRY}${IMAGE_NAME}:${TAG}"
            "${REGISTRY}${IMAGE_NAME}:${TAG}-dev"
        )
        
        for image in "${images_to_scan[@]}"; do
            if docker image inspect "$image" &> /dev/null; then
                log_info "Scanning $image..."
                trivy image "$image"
            fi
        done
    elif docker scan --help &> /dev/null; then
        log_info "Using Docker scan for vulnerability scanning..."
        
        local images_to_scan=(
            "${REGISTRY}${IMAGE_NAME}:${TAG}"
            "${REGISTRY}${IMAGE_NAME}:${TAG}-dev"
        )
        
        for image in "${images_to_scan[@]}"; do
            if docker image inspect "$image" &> /dev/null; then
                log_info "Scanning $image..."
                docker scan "$image"
            fi
        done
    else
        log_warning "No vulnerability scanner found. Install Trivy or Docker scan."
        return 1
    fi
}

test_images() {
    log_info "Testing built images..."
    
    # Test production image
    local prod_image="${REGISTRY}${IMAGE_NAME}:${TAG}"
    if docker image inspect "$prod_image" &> /dev/null; then
        log_info "Testing production image: $prod_image"
        
        # Run basic smoke test
        local container_id=$(docker run -d -p 3001:3000 \
            -e NODE_ENV=production \
            -e DATABASE_URL=postgresql://test:test@localhost:5432/test \
            -e REDIS_URL=redis://localhost:6379 \
            -e AUTH_SECRET=test-secret \
            "$prod_image")
        
        sleep 10
        
        if curl -f http://localhost:3001/health &> /dev/null; then
            log_success "Production image health check passed"
        else
            log_error "Production image health check failed"
        fi
        
        docker stop "$container_id" &> /dev/null
        docker rm "$container_id" &> /dev/null
    fi
    
    # Test development image
    local dev_image="${REGISTRY}${IMAGE_NAME}:${TAG}-dev"
    if docker image inspect "$dev_image" &> /dev/null; then
        log_info "Testing development image: $dev_image"
        log_success "Development image exists and is ready for use"
    fi
}

# Parse command line arguments
TAG="latest"
REGISTRY=""
NO_CACHE="false"
PLATFORM=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--tag)
            TAG="$2"
            shift 2
            ;;
        -r|--registry)
            REGISTRY="$2/"
            shift 2
            ;;
        --no-cache)
            NO_CACHE="true"
            shift
            ;;
        --platform)
            PLATFORM="$2"
            shift 2
            ;;
        build-dev)
            COMMAND="build-dev"
            shift
            ;;
        build-prod)
            COMMAND="build-prod"
            shift
            ;;
        build-all)
            COMMAND="build-all"
            shift
            ;;
        push)
            COMMAND="push"
            shift
            ;;
        clean)
            COMMAND="clean"
            shift
            ;;
        scan)
            COMMAND="scan"
            shift
            ;;
        test)
            COMMAND="test"
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

# Check Docker availability
check_docker

# Execute command
case $COMMAND in
    build-dev)
        build_dev
        ;;
    build-prod)
        build_prod
        ;;
    build-all)
        build_all
        ;;
    push)
        push_images
        ;;
    clean)
        clean_images
        ;;
    scan)
        scan_images
        ;;
    test)
        test_images
        ;;
    *)
        log_error "Unknown command: $COMMAND"
        exit 1
        ;;
esac