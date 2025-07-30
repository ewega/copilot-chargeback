#!/bin/bash

# test-local.sh - Script for testing the copilot-chargeback action locally using act

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
TEST_SCENARIO="basic"
CLEANUP_ON_EXIT=true
VERBOSE=false
ACT_PLATFORM="ubuntu-latest"

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
    echo "  -s, --scenario SCENARIO    Test scenario to run (basic|org-only|team-sync|error-conditions)"
    echo "  -p, --platform PLATFORM    Act platform to use (default: ubuntu-latest)"
    echo "  -v, --verbose              Enable verbose output"
    echo "  --no-cleanup              Don't cleanup mock API on exit"
    echo "  -h, --help                Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 --scenario basic"
    echo "  $0 --scenario error-conditions --verbose"
    echo "  $0 --platform ubuntu-20.04"
}

# Function to check if act is installed
check_act() {
    if ! command -v act &> /dev/null; then
        print_error "act CLI is not installed. Please install it first:"
        print_error "  # macOS"
        print_error "  brew install act"
        print_error ""
        print_error "  # Linux/WSL"
        print_error "  curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash"
        print_error ""
        print_error "  # Or download from: https://github.com/nektos/act/releases"
        exit 1
    fi
}

# Function to check if Docker is running
check_docker() {
    if ! docker info &> /dev/null; then
        print_error "Docker is not running. Please start Docker first."
        exit 1
    fi
}

# Function to start mock API
start_mock_api() {
    print_status "Starting mock API server..."
    
    cd "$MOCK_API_DIR"
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        print_status "Installing mock API dependencies..."
        npm install
    fi
    
    # Start the mock API in background
    npm start &
    MOCK_API_PID=$!
    
    # Wait for API to be ready
    print_status "Waiting for mock API to be ready..."
    for i in {1..30}; do
        if curl -sf http://localhost:3001/health &> /dev/null; then
            print_success "Mock API is ready"
            return 0
        fi
        sleep 1
    done
    
    print_error "Mock API failed to start or is not responding"
    return 1
}

# Function to stop mock API
stop_mock_api() {
    if [ ! -z "$MOCK_API_PID" ]; then
        print_status "Stopping mock API server..."
        kill $MOCK_API_PID 2>/dev/null || true
        wait $MOCK_API_PID 2>/dev/null || true
    fi
    
    # Kill any remaining mock API processes
    pkill -f "node.*server.js" 2>/dev/null || true
}

# Function to setup cleanup trap
setup_cleanup() {
    if [ "$CLEANUP_ON_EXIT" = true ]; then
        trap 'stop_mock_api' EXIT
    fi
}

# Function to run act with specific scenario
run_act_test() {
    local scenario=$1
    local env_file=""
    
    print_status "Running act test for scenario: $scenario"
    
    # Determine environment file based on scenario
    case $scenario in
        "basic")
            env_file=".env.example"
            ;;
        "org-only")
            env_file=".env.test-org-only"
            ;;
        "team-sync")
            env_file=".env.test-team-sync"
            ;;
        "error-conditions")
            env_file=".env.test-errors"
            ;;
        *)
            print_error "Unknown scenario: $scenario"
            return 1
            ;;
    esac
    
    # Build act command
    local act_cmd="act"
    act_cmd="$act_cmd --platform $ACT_PLATFORM"
    act_cmd="$act_cmd --env-file $env_file"
    act_cmd="$act_cmd --workflows .github/workflows/test-local.yml"
    
    if [ "$VERBOSE" = true ]; then
        act_cmd="$act_cmd --verbose"
    fi
    
    # Add job filter based on scenario
    case $scenario in
        "basic")
            act_cmd="$act_cmd --job test-local-basic"
            ;;
        "org-only")
            act_cmd="$act_cmd --job test-local-org-only"
            ;;
        "error-conditions")
            act_cmd="$act_cmd --job test-local-error-conditions"
            ;;
    esac
    
    cd "$ROOT_DIR"
    
    print_status "Executing: $act_cmd"
    
    if eval "$act_cmd"; then
        print_success "Act test completed successfully for scenario: $scenario"
        return 0
    else
        print_error "Act test failed for scenario: $scenario"
        return 1
    fi
}

# Function to validate test results
validate_results() {
    local scenario=$1
    
    print_status "Validating results for scenario: $scenario"
    
    # Check if mock API recorded the expected calls
    local api_response
    api_response=$(curl -s http://localhost:3001/cost-centers 2>/dev/null || echo "[]")
    
    if [ "$api_response" = "[]" ]; then
        print_warning "No cost centers found in mock API - test may not have run properly"
        return 1
    fi
    
    print_success "Mock API responded with cost centers data"
    return 0
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -s|--scenario)
            TEST_SCENARIO="$2"
            shift 2
            ;;
        -p|--platform)
            ACT_PLATFORM="$2"
            shift 2
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        --no-cleanup)
            CLEANUP_ON_EXIT=false
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
    print_status "Starting local test for copilot-chargeback action"
    print_status "Scenario: $TEST_SCENARIO"
    print_status "Platform: $ACT_PLATFORM"
    
    # Pre-flight checks
    check_act
    check_docker
    
    # Setup cleanup
    setup_cleanup
    
    # Start mock API
    if ! start_mock_api; then
        exit 1
    fi
    
    # Run the test
    if run_act_test "$TEST_SCENARIO"; then
        # Validate results
        if validate_results "$TEST_SCENARIO"; then
            print_success "All tests passed!"
        else
            print_warning "Tests completed but validation failed"
        fi
    else
        print_error "Tests failed"
        exit 1
    fi
}

# Run main function
main "$@"