#!/bin/bash

# E2E Test Runner Script for P3 Protocol
# This script helps setup and run the complete E2E test suite

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print colored output
print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Function to check prerequisites
check_prerequisites() {
    print_info "Checking prerequisites..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 18 or higher."
        exit 1
    fi
    print_success "Node.js found: $(node --version)"
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed."
        exit 1
    fi
    print_success "npm found: $(npm --version)"
    
    # Check PostgreSQL
    if ! command -v psql &> /dev/null; then
        print_warning "psql not found. Ensure PostgreSQL is installed and running."
    else
        print_success "PostgreSQL client found"
    fi
}

# Function to setup test database
setup_database() {
    print_info "Setting up test database..."
    
    export TEST_DATABASE_URL=${TEST_DATABASE_URL:-"postgresql://postgres:postgres@localhost:5432/p3_test"}
    
    # Try to create test database if it doesn't exist
    if command -v psql &> /dev/null; then
        psql -U postgres -lqt | cut -d \| -f 1 | grep -qw p3_test || \
        createdb -U postgres p3_test 2>/dev/null && print_success "Test database created" || \
        print_info "Test database already exists or could not be created"
    fi
}

# Function to install dependencies
install_dependencies() {
    print_info "Checking dependencies..."
    
    if [ ! -d "node_modules" ]; then
        print_info "Installing npm dependencies..."
        npm install
        print_success "Dependencies installed"
    else
        print_success "Dependencies already installed"
    fi
    
    # Install Playwright browsers
    print_info "Installing Playwright browsers..."
    npx playwright install chromium
    print_success "Playwright browsers installed"
}

# Function to run specific test
run_test() {
    local test_name=$1
    local headless=${2:-true}
    
    export HEADLESS=$headless
    export NODE_ENV=test
    
    print_info "Running $test_name test..."
    
    npx mocha "test/e2e/${test_name}.test.ts" \
        --require ts-node/register \
        --timeout 180000 \
        --reporter spec
    
    if [ $? -eq 0 ]; then
        print_success "$test_name test passed"
        return 0
    else
        print_error "$test_name test failed"
        return 1
    fi
}

# Function to run all tests
run_all_tests() {
    local headless=${1:-true}
    local failed_tests=()
    
    print_info "Running complete E2E test suite..."
    echo ""
    
    tests=(
        "message-flow"
        "meeting-flow"
        "payment-flow"
        "governance-flow"
        "cross-chain-flow"
    )
    
    for test in "${tests[@]}"; do
        if ! run_test "$test" "$headless"; then
            failed_tests+=("$test")
        fi
        echo ""
    done
    
    # Summary
    echo "========================================="
    echo "Test Suite Summary"
    echo "========================================="
    
    if [ ${#failed_tests[@]} -eq 0 ]; then
        print_success "All tests passed! 🎉"
        return 0
    else
        print_error "Some tests failed:"
        for test in "${failed_tests[@]}"; do
            echo "  - $test"
        done
        return 1
    fi
}

# Main script
main() {
    echo "========================================="
    echo "P3 Protocol E2E Test Suite"
    echo "========================================="
    echo ""
    
    # Parse arguments
    HEADLESS=true
    TEST_SUITE="all"
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --headed)
                HEADLESS=false
                shift
                ;;
            --suite)
                TEST_SUITE="$2"
                shift 2
                ;;
            --help)
                echo "Usage: ./run-tests.sh [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --headed          Run tests in headed mode (visible browser)"
                echo "  --suite <name>    Run specific test suite (message-flow, meeting-flow, etc.)"
                echo "  --help            Show this help message"
                echo ""
                echo "Examples:"
                echo "  ./run-tests.sh                           # Run all tests headless"
                echo "  ./run-tests.sh --headed                  # Run all tests with visible browser"
                echo "  ./run-tests.sh --suite message-flow      # Run only message flow test"
                echo "  ./run-tests.sh --suite payment-flow --headed  # Run payment test with browser"
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                echo "Use --help for usage information"
                exit 1
                ;;
        esac
    done
    
    # Run prerequisite checks
    check_prerequisites
    echo ""
    
    # Setup database
    setup_database
    echo ""
    
    # Install dependencies
    install_dependencies
    echo ""
    
    # Run tests
    if [ "$TEST_SUITE" = "all" ]; then
        run_all_tests "$HEADLESS"
    else
        run_test "$TEST_SUITE" "$HEADLESS"
    fi
    
    exit_code=$?
    
    echo ""
    echo "========================================="
    if [ $exit_code -eq 0 ]; then
        print_success "Test run completed successfully!"
    else
        print_error "Test run completed with failures"
    fi
    echo "========================================="
    
    exit $exit_code
}

# Run main function
main "$@"
