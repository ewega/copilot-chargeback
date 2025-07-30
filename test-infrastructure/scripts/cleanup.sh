#!/bin/bash

# cleanup.sh - Script for cleaning up test resources and state

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
MOCK_API_DIR="$ROOT_DIR/test-infrastructure/mock-api"

# Default values
FULL_CLEANUP=false
VERBOSE=false

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to show usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --full                    Perform full cleanup (containers, images, etc.)"
    echo "  -v, --verbose             Enable verbose output"
    echo "  -h, --help                Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                        # Basic cleanup"
    echo "  $0 --full --verbose       # Full cleanup with verbose output"
}

# Function to stop running processes
stop_processes() {
    print_status "Stopping running processes..."
    
    # Stop mock API processes
    local pids
    pids=$(pgrep -f "node.*server.js" 2>/dev/null || true)
    
    if [ ! -z "$pids" ]; then
        print_status "Stopping mock API processes: $pids"
        echo "$pids" | xargs kill 2>/dev/null || true
        sleep 2
        
        # Force kill if still running
        pids=$(pgrep -f "node.*server.js" 2>/dev/null || true)
        if [ ! -z "$pids" ]; then
            print_warning "Force killing remaining processes: $pids"
            echo "$pids" | xargs kill -9 2>/dev/null || true
        fi
    fi
    
    print_success "Processes stopped"
}

# Function to cleanup temporary files
cleanup_temp_files() {
    print_status "Cleaning up temporary files..."
    
    # Remove temporary .env files
    find "$ROOT_DIR" -name ".env.tmp*" -type f -delete 2>/dev/null || true
    find "$ROOT_DIR" -name "*.tmp" -type f -delete 2>/dev/null || true
    
    # Remove act cache and temporary files
    if [ -d "$HOME/.cache/act" ]; then
        print_status "Removing act cache..."
        rm -rf "$HOME/.cache/act"
    fi
    
    # Remove npm logs
    find "$ROOT_DIR" -name "npm-debug.log*" -type f -delete 2>/dev/null || true
    find "$ROOT_DIR" -name ".npm" -type d -exec rm -rf {} + 2>/dev/null || true
    
    print_success "Temporary files cleaned"
}

# Function to cleanup Docker resources
cleanup_docker() {
    if [ "$FULL_CLEANUP" != true ]; then
        return 0
    fi
    
    print_status "Cleaning up Docker resources..."
    
    # Stop and remove containers related to copilot-chargeback
    local containers
    containers=$(docker ps -a --filter "name=copilot" --format "{{.ID}}" 2>/dev/null || true)
    
    if [ ! -z "$containers" ]; then
        print_status "Removing containers: $containers"
        echo "$containers" | xargs docker rm -f 2>/dev/null || true
    fi
    
    # Remove images related to copilot-chargeback
    local images
    images=$(docker images --filter "reference=*copilot*" --format "{{.ID}}" 2>/dev/null || true)
    
    if [ ! -z "$images" ]; then
        print_status "Removing images: $images"
        echo "$images" | xargs docker rmi -f 2>/dev/null || true
    fi
    
    # Remove docker-compose resources
    if [ -f "$MOCK_API_DIR/docker-compose.yml" ]; then
        cd "$MOCK_API_DIR"
        docker-compose down --volumes --remove-orphans 2>/dev/null || true
    fi
    
    print_success "Docker resources cleaned"
}

# Function to reset mock API state
reset_mock_api() {
    print_status "Resetting mock API state..."
    
    # Try to reset via API call
    if curl -sf http://localhost:3001/health &> /dev/null; then
        curl -s -X POST http://localhost:3001/reset &> /dev/null || true
        print_success "Mock API state reset"
    else
        print_status "Mock API not running, skipping state reset"
    fi
}

# Function to cleanup node modules (if full cleanup)
cleanup_node_modules() {
    if [ "$FULL_CLEANUP" != true ]; then
        return 0
    fi
    
    print_status "Cleaning up node_modules directories..."
    
    # Remove node_modules in root
    if [ -d "$ROOT_DIR/node_modules" ]; then
        print_status "Removing root node_modules..."
        rm -rf "$ROOT_DIR/node_modules"
    fi
    
    # Remove node_modules in mock API
    if [ -d "$MOCK_API_DIR/node_modules" ]; then
        print_status "Removing mock API node_modules..."
        rm -rf "$MOCK_API_DIR/node_modules"
    fi
    
    # Remove package-lock.json files if requested
    find "$ROOT_DIR" -name "package-lock.json" -not -path "*/node_modules/*" | while read -r lockfile; do
        if [ "$VERBOSE" = true ]; then
            print_status "Found package-lock.json: $lockfile"
        fi
    done
    
    print_success "node_modules cleaned"
}

# Function to cleanup logs
cleanup_logs() {
    print_status "Cleaning up log files..."
    
    # Remove common log files
    find "$ROOT_DIR" -name "*.log" -type f -delete 2>/dev/null || true
    find "$ROOT_DIR" -name "*.out" -type f -delete 2>/dev/null || true
    find "$ROOT_DIR" -name "*.err" -type f -delete 2>/dev/null || true
    
    print_success "Log files cleaned"
}

# Function to verify cleanup
verify_cleanup() {
    print_status "Verifying cleanup..."
    
    local issues=0
    
    # Check for running processes
    local pids
    pids=$(pgrep -f "node.*server.js" 2>/dev/null || true)
    if [ ! -z "$pids" ]; then
        print_warning "Still running processes: $pids"
        issues=$((issues + 1))
    fi
    
    # Check for temporary files
    local temp_files
    temp_files=$(find "$ROOT_DIR" -name "*.tmp" -o -name ".env.tmp*" 2>/dev/null | head -5)
    if [ ! -z "$temp_files" ]; then
        print_warning "Remaining temporary files found"
        if [ "$VERBOSE" = true ]; then
            echo "$temp_files"
        fi
        issues=$((issues + 1))
    fi
    
    if [ $issues -eq 0 ]; then
        print_success "Cleanup verification passed"
        return 0
    else
        print_warning "Cleanup verification found $issues issue(s)"
        return 1
    fi
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --full)
            FULL_CLEANUP=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

# Main execution
main() {
    print_status "Starting cleanup for copilot-chargeback testing infrastructure"
    
    if [ "$FULL_CLEANUP" = true ]; then
        print_status "Performing FULL cleanup"
    else
        print_status "Performing basic cleanup"
    fi
    
    # Execute cleanup functions
    stop_processes
    reset_mock_api
    cleanup_temp_files
    cleanup_logs
    cleanup_docker
    cleanup_node_modules
    
    # Verify cleanup
    if verify_cleanup; then
        print_success "Cleanup completed successfully"
    else
        print_warning "Cleanup completed with some issues"
    fi
    
    print_status "Cleanup finished"
}

# Run main function
main "$@"