#!/bin/bash

# test-integration.sh - Script for testing the copilot-chargeback action against real GitHub infrastructure

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
GITHUB_TOKEN="${GITHUB_TOKEN:-}"
TEST_ORG="${TEST_ORG:-copilot-chargeback-test}"
TEST_TEAM="${TEST_TEAM:-engineering-team}"
COST_CENTER_NAME="${COST_CENTER_NAME:-engineering-cost-center}"
MOCK_API_URL="${MOCK_API_URL:-http://localhost:3001}"
CLEANUP_ON_EXIT=true
VERBOSE=false
DRY_RUN=false

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
    echo "  -t, --token TOKEN         GitHub personal access token"
    echo "  -o, --org ORG             GitHub organization name (default: copilot-chargeback-test)"
    echo "  --team TEAM               GitHub team name (default: engineering-team)"
    echo "  -c, --cost-center NAME    Cost center name (default: engineering-cost-center)"
    echo "  -u, --api-url URL         Mock API URL (default: http://localhost:3001)"
    echo "  -v, --verbose             Enable verbose output"
    echo "  --dry-run                 Don't make actual changes, just test connectivity"
    echo "  --no-cleanup              Don't cleanup mock API on exit"
    echo "  -h, --help                Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  GITHUB_TOKEN              GitHub personal access token"
    echo "  TEST_ORG                  GitHub organization name"
    echo "  TEST_TEAM                 GitHub team name"
    echo "  COST_CENTER_NAME          Cost center name"
    echo "  MOCK_API_URL              Mock API URL"
    echo ""
    echo "Examples:"
    echo "  $0 --token ghp_xxx --org copilot-chargeback-test"
    echo "  $0 --dry-run --verbose"
    echo "  GITHUB_TOKEN=ghp_xxx $0 --team design-team"
}

# Function to validate GitHub token
validate_github_token() {
    if [ -z "$GITHUB_TOKEN" ]; then
        print_error "GitHub token is required. Set GITHUB_TOKEN environment variable or use --token option."
        return 1
    fi
    
    print_status "Validating GitHub token..."
    
    local response
    response=$(curl -s -H "Authorization: Bearer $GITHUB_TOKEN" \
                    -H "Accept: application/vnd.github.v3+json" \
                    https://api.github.com/user)
    
    if echo "$response" | grep -q '"login"'; then
        local username
        username=$(echo "$response" | grep -o '"login":"[^"]*"' | cut -d'"' -f4)
        print_success "GitHub token is valid for user: $username"
        return 0
    else
        print_error "GitHub token validation failed"
        if [ "$VERBOSE" = true ]; then
            echo "Response: $response"
        fi
        return 1
    fi
}

# Function to test GitHub organization access
test_github_org() {
    print_status "Testing access to GitHub organization: $TEST_ORG"
    
    local response
    response=$(curl -s -H "Authorization: Bearer $GITHUB_TOKEN" \
                    -H "Accept: application/vnd.github.v3+json" \
                    "https://api.github.com/orgs/$TEST_ORG/members")
    
    if echo "$response" | grep -q '^\['; then
        local member_count
        member_count=$(echo "$response" | grep -o '"login"' | wc -l)
        print_success "Organization access verified. Found $member_count members."
        return 0
    else
        print_error "Failed to access organization: $TEST_ORG"
        if [ "$VERBOSE" = true ]; then
            echo "Response: $response"
        fi
        return 1
    fi
}

# Function to test GitHub team access
test_github_team() {
    if [ -z "$TEST_TEAM" ]; then
        print_status "No team specified, skipping team access test"
        return 0
    fi
    
    print_status "Testing access to GitHub team: $TEST_TEAM"
    
    local response
    response=$(curl -s -H "Authorization: Bearer $GITHUB_TOKEN" \
                    -H "Accept: application/vnd.github.v3+json" \
                    "https://api.github.com/orgs/$TEST_ORG/teams/$TEST_TEAM/members")
    
    if echo "$response" | grep -q '^\['; then
        local member_count
        member_count=$(echo "$response" | grep -o '"login"' | wc -l)
        print_success "Team access verified. Found $member_count members."
        return 0
    else
        print_error "Failed to access team: $TEST_TEAM"
        if [ "$VERBOSE" = true ]; then
            echo "Response: $response"
        fi
        return 1
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
        if curl -sf "$MOCK_API_URL/health" &> /dev/null; then
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

# Function to test mock API connectivity
test_mock_api() {
    print_status "Testing mock API connectivity..."
    
    local health_response
    health_response=$(curl -s "$MOCK_API_URL/health" 2>/dev/null || echo "")
    
    if [ -z "$health_response" ]; then
        print_error "Mock API is not responding at $MOCK_API_URL"
        return 1
    fi
    
    if echo "$health_response" | grep -q '"status":"healthy"'; then
        print_success "Mock API is healthy"
        return 0
    else
        print_error "Mock API health check failed"
        if [ "$VERBOSE" = true ]; then
            echo "Response: $health_response"
        fi
        return 1
    fi
}

# Function to run integration test
run_integration_test() {
    print_status "Running integration test..."
    
    if [ "$DRY_RUN" = true ]; then
        print_status "DRY RUN: Would run action with:"
        print_status "  Organization: $TEST_ORG"
        print_status "  Team: $TEST_TEAM"
        print_status "  Cost Center: $COST_CENTER_NAME"
        print_status "  API URL: $MOCK_API_URL"
        return 0
    fi
    
    # Reset mock API to known state
    print_status "Resetting mock API state..."
    curl -s -X POST "$MOCK_API_URL/reset" > /dev/null
    
    # Run the action using local-action
    cd "$ROOT_DIR"
    
    # Create temporary .env file for test
    local temp_env_file
    temp_env_file=$(mktemp)
    
    cat > "$temp_env_file" << EOF
INPUT_GITHUB_ORGANIZATION=$TEST_ORG
INPUT_GITHUB_TEAM=$TEST_TEAM
INPUT_GITHUB_COST_CENTER_NAME=$COST_CENTER_NAME
GITHUB_TOKEN=$GITHUB_TOKEN
COST_CENTER_API_BASE_URL=$MOCK_API_URL
ACTIONS_STEP_DEBUG=true
EOF
    
    print_status "Running action with npx @github/local-action..."
    
    if npx @github/local-action . src/main.js "$temp_env_file"; then
        print_success "Action completed successfully"
        rm -f "$temp_env_file"
        return 0
    else
        print_error "Action failed"
        rm -f "$temp_env_file"
        return 1
    fi
}

# Function to validate integration test results
validate_integration_results() {
    print_status "Validating integration test results..."
    
    # Check cost center state
    local cost_centers_response
    cost_centers_response=$(curl -s "$MOCK_API_URL/cost-centers/$COST_CENTER_NAME/users" 2>/dev/null || echo "")
    
    if [ -z "$cost_centers_response" ]; then
        print_error "Failed to fetch cost center users"
        return 1
    fi
    
    if echo "$cost_centers_response" | grep -q '"login"'; then
        local user_count
        user_count=$(echo "$cost_centers_response" | grep -o '"login"' | wc -l)
        print_success "Cost center has $user_count users after sync"
        
        if [ "$VERBOSE" = true ]; then
            echo "Cost center users:"
            echo "$cost_centers_response" | grep -o '"login":"[^"]*"' | cut -d'"' -f4
        fi
        
        return 0
    else
        print_error "Cost center validation failed"
        if [ "$VERBOSE" = true ]; then
            echo "Response: $cost_centers_response"
        fi
        return 1
    fi
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--token)
            GITHUB_TOKEN="$2"
            shift 2
            ;;
        -o|--org)
            TEST_ORG="$2"
            shift 2
            ;;
        --team)
            TEST_TEAM="$2"
            shift 2
            ;;
        -c|--cost-center)
            COST_CENTER_NAME="$2"
            shift 2
            ;;
        -u|--api-url)
            MOCK_API_URL="$2"
            shift 2
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
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
    print_status "Starting integration test for copilot-chargeback action"
    print_status "Organization: $TEST_ORG"
    print_status "Team: $TEST_TEAM"
    print_status "Cost Center: $COST_CENTER_NAME"
    print_status "API URL: $MOCK_API_URL"
    
    # Setup cleanup
    setup_cleanup
    
    # Validate GitHub access
    if ! validate_github_token; then
        exit 1
    fi
    
    if ! test_github_org; then
        exit 1
    fi
    
    if ! test_github_team; then
        print_warning "Team access test failed, but continuing..."
    fi
    
    # Start mock API
    if ! start_mock_api; then
        exit 1
    fi
    
    # Test mock API
    if ! test_mock_api; then
        exit 1
    fi
    
    # Run integration test
    if run_integration_test; then
        # Validate results
        if validate_integration_results; then
            print_success "All integration tests passed!"
        else
            print_warning "Integration tests completed but validation failed"
        fi
    else
        print_error "Integration tests failed"
        exit 1
    fi
}

# Run main function
main "$@"