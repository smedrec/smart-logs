#!/bin/bash

# Audit System Test Runner
# Comprehensive test execution script with environment validation and reporting

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
TEST_RESULTS_DIR="test-results"
COVERAGE_DIR="coverage"
LOG_FILE="$TEST_RESULTS_DIR/test-execution.log"

# Default values
RUN_UNIT=false
RUN_INTEGRATION=false
RUN_E2E=false
RUN_EXTERNAL_DEPS=false
RUN_LOAD=false
RUN_CHAOS=false
RUN_CI=false
RUN_ALL=false
GENERATE_COVERAGE=false
VERBOSE=false
PARALLEL=true
CLEANUP_AFTER=true

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
show_usage() {
    cat << EOF
Audit System Test Runner

Usage: $0 [OPTIONS]

Test Suites:
    --unit              Run unit tests
    --integration       Run integration tests
    --e2e              Run end-to-end tests
    --external-deps    Run external dependencies tests
    --load             Run load tests
    --chaos            Run chaos engineering tests
    --ci               Run CI/CD test suite
    --all              Run all test suites

Options:
    --coverage         Generate coverage report
    --verbose          Enable verbose output
    --no-parallel      Disable parallel execution
    --no-cleanup       Skip cleanup after tests
    --help             Show this help message

Environment Variables:
    AUDIT_DB_URL       Database URL for testing
    REDIS_HOST         Redis host (default: localhost)
    REDIS_PORT         Redis port (default: 6379)
    REDIS_DB           Redis database number (default: 1)

Examples:
    $0 --unit --coverage                    # Run unit tests with coverage
    $0 --integration --e2e                  # Run integration and e2e tests
    $0 --all --verbose                      # Run all tests with verbose output
    $0 --load --no-parallel                 # Run load tests without parallelization
    $0 --ci                                 # Run CI test suite

EOF
}

# Function to validate environment
validate_environment() {
    print_status "Validating test environment..."
    
    # Check Node.js version
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed"
        exit 1
    fi
    
    NODE_VERSION=$(node --version | cut -d'v' -f2)
    REQUIRED_NODE_VERSION="16.0.0"
    
    if ! node -e "process.exit(require('semver').gte('$NODE_VERSION', '$REQUIRED_NODE_VERSION') ? 0 : 1)" 2>/dev/null; then
        print_error "Node.js version $NODE_VERSION is below required version $REQUIRED_NODE_VERSION"
        exit 1
    fi
    
    # Check pnpm
    if ! command -v pnpm &> /dev/null; then
        print_error "pnpm is not installed"
        exit 1
    fi
    
    # Check database connection
    if [[ "$RUN_INTEGRATION" == true || "$RUN_E2E" == true || "$RUN_EXTERNAL_DEPS" == true || "$RUN_LOAD" == true || "$RUN_CHAOS" == true || "$RUN_CI" == true || "$RUN_ALL" == true ]]; then
        print_status "Checking database connection..."
        
        DB_URL=${AUDIT_DB_URL:-"postgresql://localhost:5432/audit_test"}
        
        if ! node -e "
            const { Client } = require('pg');
            const client = new Client({ connectionString: '$DB_URL' });
            client.connect()
                .then(() => {
                    console.log('Database connection successful');
                    client.end();
                    process.exit(0);
                })
                .catch(err => {
                    console.error('Database connection failed:', err.message);
                    process.exit(1);
                });
        " 2>/dev/null; then
            print_error "Cannot connect to database: $DB_URL"
            print_warning "Make sure PostgreSQL is running and the database exists"
            exit 1
        fi
    fi
    
    # Check Redis connection
    if [[ "$RUN_INTEGRATION" == true || "$RUN_E2E" == true || "$RUN_EXTERNAL_DEPS" == true || "$RUN_LOAD" == true || "$RUN_CHAOS" == true || "$RUN_CI" == true || "$RUN_ALL" == true ]]; then
        print_status "Checking Redis connection..."
        
        REDIS_HOST=${REDIS_HOST:-"localhost"}
        REDIS_PORT=${REDIS_PORT:-6379}
        
        if ! node -e "
            const Redis = require('ioredis');
            const redis = new Redis({ host: '$REDIS_HOST', port: $REDIS_PORT, lazyConnect: true });
            redis.connect()
                .then(() => {
                    console.log('Redis connection successful');
                    redis.disconnect();
                    process.exit(0);
                })
                .catch(err => {
                    console.error('Redis connection failed:', err.message);
                    process.exit(1);
                });
        " 2>/dev/null; then
            print_error "Cannot connect to Redis: $REDIS_HOST:$REDIS_PORT"
            print_warning "Make sure Redis is running and accessible"
            exit 1
        fi
    fi
    
    print_success "Environment validation completed"
}

# Function to setup test environment
setup_test_environment() {
    print_status "Setting up test environment..."
    
    # Create test results directory
    mkdir -p "$TEST_RESULTS_DIR"
    mkdir -p "$COVERAGE_DIR"
    
    # Initialize log file
    echo "Test execution started at $(date)" > "$LOG_FILE"
    
    # Install dependencies if needed
    if [[ ! -d "node_modules" ]]; then
        print_status "Installing dependencies..."
        pnpm install >> "$LOG_FILE" 2>&1
    fi
    
    print_success "Test environment setup completed"
}

# Function to run a test suite
run_test_suite() {
    local suite_name=$1
    local test_command=$2
    local timeout=${3:-60}
    
    print_status "Running $suite_name tests..."
    
    local start_time=$(date +%s)
    local success=true
    
    # Build the command
    local cmd="pnpm $test_command"
    
    if [[ "$VERBOSE" == true ]]; then
        cmd="$cmd --reporter=verbose"
    fi
    
    if [[ "$GENERATE_COVERAGE" == true && "$suite_name" != "Load" && "$suite_name" != "Chaos" ]]; then
        cmd="$cmd --coverage"
    fi
    
    # Execute the test
    if timeout ${timeout}s bash -c "$cmd" >> "$LOG_FILE" 2>&1; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        print_success "$suite_name tests completed in ${duration}s"
        
        # Log results
        echo "$suite_name: SUCCESS (${duration}s)" >> "$TEST_RESULTS_DIR/summary.log"
    else
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        print_error "$suite_name tests failed after ${duration}s"
        
        # Log results
        echo "$suite_name: FAILED (${duration}s)" >> "$TEST_RESULTS_DIR/summary.log"
        
        # Show last few lines of log for debugging
        print_error "Last 10 lines of output:"
        tail -n 10 "$LOG_FILE"
        
        success=false
    fi
    
    return $([ "$success" = true ] && echo 0 || echo 1)
}

# Function to generate test report
generate_test_report() {
    print_status "Generating test report..."
    
    local report_file="$TEST_RESULTS_DIR/test-report.html"
    
    cat > "$report_file" << EOF
<!DOCTYPE html>
<html>
<head>
    <title>Audit System Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background-color: #f0f0f0; padding: 20px; border-radius: 5px; }
        .success { color: green; }
        .failure { color: red; }
        .warning { color: orange; }
        .section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        pre { background-color: #f5f5f5; padding: 10px; border-radius: 3px; overflow-x: auto; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Audit System Test Report</h1>
        <p>Generated on: $(date)</p>
        <p>Environment: $(uname -a)</p>
    </div>
    
    <div class="section">
        <h2>Test Summary</h2>
        <pre>$(cat "$TEST_RESULTS_DIR/summary.log" 2>/dev/null || echo "No test results available")</pre>
    </div>
    
    <div class="section">
        <h2>Environment Information</h2>
        <pre>
Node.js Version: $(node --version)
pnpm Version: $(pnpm --version)
Database URL: ${AUDIT_DB_URL:-"postgresql://localhost:5432/audit_test"}
Redis Host: ${REDIS_HOST:-"localhost"}:${REDIS_PORT:-6379}
        </pre>
    </div>
    
    <div class="section">
        <h2>Execution Log</h2>
        <pre>$(tail -n 50 "$LOG_FILE" 2>/dev/null || echo "No log available")</pre>
    </div>
</body>
</html>
EOF
    
    print_success "Test report generated: $report_file"
}

# Function to cleanup test environment
cleanup_test_environment() {
    if [[ "$CLEANUP_AFTER" == true ]]; then
        print_status "Cleaning up test environment..."
        
        # Clean up test data from database
        if [[ -n "$AUDIT_DB_URL" ]]; then
            node -e "
                const { Client } = require('pg');
                const client = new Client({ connectionString: '$AUDIT_DB_URL' });
                client.connect()
                    .then(() => client.query(\"DELETE FROM audit_log WHERE principal_id LIKE 'test-%' OR action LIKE 'test.%'\"))
                    .then(() => client.query(\"DELETE FROM alerts WHERE alert_type = 'TEST'\"))
                    .then(() => {
                        console.log('Test data cleaned up');
                        client.end();
                    })
                    .catch(err => {
                        console.warn('Cleanup warning:', err.message);
                        client.end();
                    });
            " 2>/dev/null || print_warning "Could not clean up test data"
        fi
        
        print_success "Cleanup completed"
    fi
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --unit)
            RUN_UNIT=true
            shift
            ;;
        --integration)
            RUN_INTEGRATION=true
            shift
            ;;
        --e2e)
            RUN_E2E=true
            shift
            ;;
        --external-deps)
            RUN_EXTERNAL_DEPS=true
            shift
            ;;
        --load)
            RUN_LOAD=true
            shift
            ;;
        --chaos)
            RUN_CHAOS=true
            shift
            ;;
        --ci)
            RUN_CI=true
            shift
            ;;
        --all)
            RUN_ALL=true
            shift
            ;;
        --coverage)
            GENERATE_COVERAGE=true
            shift
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        --no-parallel)
            PARALLEL=false
            shift
            ;;
        --no-cleanup)
            CLEANUP_AFTER=false
            shift
            ;;
        --help)
            show_usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# If no specific tests selected, show usage
if [[ "$RUN_UNIT" == false && "$RUN_INTEGRATION" == false && "$RUN_E2E" == false && "$RUN_EXTERNAL_DEPS" == false && "$RUN_LOAD" == false && "$RUN_CHAOS" == false && "$RUN_CI" == false && "$RUN_ALL" == false ]]; then
    print_error "No test suite specified"
    show_usage
    exit 1
fi

# Main execution
main() {
    local overall_success=true
    local start_time=$(date +%s)
    
    print_status "Starting audit system test execution..."
    
    # Validate environment
    validate_environment
    
    # Setup test environment
    setup_test_environment
    
    # Initialize summary log
    echo "Test Execution Summary" > "$TEST_RESULTS_DIR/summary.log"
    echo "======================" >> "$TEST_RESULTS_DIR/summary.log"
    
    # Run selected test suites
    if [[ "$RUN_ALL" == true || "$RUN_UNIT" == true ]]; then
        if ! run_test_suite "Unit" "test:unit" 60; then
            overall_success=false
        fi
    fi
    
    if [[ "$RUN_ALL" == true || "$RUN_INTEGRATION" == true ]]; then
        if ! run_test_suite "Integration" "test:integration" 90; then
            overall_success=false
        fi
    fi
    
    if [[ "$RUN_ALL" == true || "$RUN_E2E" == true ]]; then
        if ! run_test_suite "End-to-End" "test:e2e" 180; then
            overall_success=false
        fi
    fi
    
    if [[ "$RUN_ALL" == true || "$RUN_EXTERNAL_DEPS" == true ]]; then
        if ! run_test_suite "External Dependencies" "test:external-deps" 120; then
            overall_success=false
        fi
    fi
    
    if [[ "$RUN_ALL" == true || "$RUN_LOAD" == true ]]; then
        if ! run_test_suite "Load" "test:load" 600; then
            overall_success=false
        fi
    fi
    
    if [[ "$RUN_ALL" == true || "$RUN_CHAOS" == true ]]; then
        if ! run_test_suite "Chaos Engineering" "test:chaos" 300; then
            overall_success=false
        fi
    fi
    
    if [[ "$RUN_ALL" == true || "$RUN_CI" == true ]]; then
        if ! run_test_suite "CI/CD" "test:ci" 120; then
            overall_success=false
        fi
    fi
    
    # Generate test report
    generate_test_report
    
    # Cleanup
    cleanup_test_environment
    
    # Final summary
    local end_time=$(date +%s)
    local total_duration=$((end_time - start_time))
    
    echo "" >> "$TEST_RESULTS_DIR/summary.log"
    echo "Total execution time: ${total_duration}s" >> "$TEST_RESULTS_DIR/summary.log"
    
    if [[ "$overall_success" == true ]]; then
        print_success "All tests completed successfully in ${total_duration}s"
        echo "Overall result: SUCCESS" >> "$TEST_RESULTS_DIR/summary.log"
        exit 0
    else
        print_error "Some tests failed. Total execution time: ${total_duration}s"
        echo "Overall result: FAILURE" >> "$TEST_RESULTS_DIR/summary.log"
        exit 1
    fi
}

# Run main function
main