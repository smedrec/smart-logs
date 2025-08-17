# Audit System Testing Guide

This document provides comprehensive information about testing the audit system, including setup, execution, and interpretation of results.

## Overview

The audit system includes multiple layers of testing to ensure reliability, performance, and compliance:

1. **Unit Tests** - Individual component testing
2. **Integration Tests** - Component interaction testing
3. **End-to-End Tests** - Complete audit lifecycle testing
4. **External Dependencies Tests** - Redis and PostgreSQL integration testing
5. **Load Tests** - High-volume scenario testing
6. **Chaos Engineering Tests** - System resilience validation
7. **CI/CD Tests** - Automated pipeline testing

## Test Structure

```
packages/audit/src/__tests__/
├── e2e-integration.test.ts           # End-to-end audit lifecycle tests
├── external-dependencies-integration.test.ts  # Redis/PostgreSQL integration
├── load-testing.test.ts              # High-volume performance tests
├── chaos-engineering.test.ts         # System resilience tests
├── ci-test-suite.test.ts            # CI/CD pipeline tests
└── integration.test.ts              # Basic integration tests (existing)

packages/audit/src/**/*.test.ts       # Unit tests (existing)
```

## Prerequisites

### Required Services

1. **PostgreSQL Database**
   - Version: 12.0 or higher
   - Extensions: uuid-ossp
   - Test database: `audit_test`

2. **Redis Server**
   - Version: 6.0 or higher
   - Modules: streams support
   - Test database: 1 (or as configured)

### Environment Variables

```bash
# Database Configuration
AUDIT_DB_URL=postgresql://localhost:5432/audit_test
DATABASE_URL=postgresql://localhost:5432/audit_test  # Alternative

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=1

# Load Testing (optional)
LOAD_TEST_DB_URL=postgresql://localhost:5432/audit_load_test

# Chaos Testing (optional)
CHAOS_TEST_DB_URL=postgresql://localhost:5432/audit_chaos_test
```

### Database Setup

```sql
-- Create test databases
CREATE DATABASE audit_test;
CREATE DATABASE audit_load_test;  -- For load testing
CREATE DATABASE audit_chaos_test; -- For chaos testing

-- Connect to test database and run migrations
\c audit_test;
-- Run your migration scripts here
```

## Running Tests

### Quick Start

```bash
# Install dependencies
pnpm install

# Run all tests
pnpm test

# Run with coverage
pnpm test:coverage
```

### Individual Test Suites

```bash
# Unit tests only
pnpm test:unit

# Integration tests
pnpm test:integration

# End-to-end tests
pnpm test:e2e

# External dependencies tests
pnpm test:external-deps

# Load tests (requires adequate resources)
pnpm test:load

# Chaos engineering tests
pnpm test:chaos

# CI/CD pipeline tests
pnpm test:ci
```

### Watch Mode

```bash
# Run tests in watch mode for development
pnpm test:watch
```

## Test Categories

### 1. Unit Tests

**Purpose**: Test individual functions and classes in isolation.

**Location**: `src/**/*.test.ts`

**Examples**:

- Cryptographic functions
- Event validation
- Retry logic
- Configuration management

**Run**: `pnpm test:unit`

### 2. Integration Tests

**Purpose**: Test component interactions and basic workflows.

**Location**: `src/__tests__/integration.test.ts`

**Examples**:

- Audit service with database
- Queue processing with Redis
- Monitoring with alerting

**Run**: `pnpm test:integration`

### 3. End-to-End Tests

**Purpose**: Test complete audit event lifecycle from creation to storage and retrieval.

**Location**: `src/__tests__/e2e-integration.test.ts`

**Test Scenarios**:

- Complete audit event processing with cryptographic integrity
- FHIR audit events with proper categorization
- Authentication events with security monitoring
- GDPR compliance (data export, pseudonymization)
- Compliance reporting with integrity verification
- Real-time monitoring and alerting
- Error recovery and resilience

**Run**: `pnpm test:e2e`

**Timeout**: 120 seconds

### 4. External Dependencies Tests

**Purpose**: Test integration with Redis and PostgreSQL under various conditions.

**Location**: `src/__tests__/external-dependencies-integration.test.ts`

**Test Scenarios**:

- Database connection pooling
- Transaction rollbacks
- Large dataset queries
- Redis queue operations
- Memory pressure handling
- Connection failover
- Circuit breaker protection
- Dead letter queue handling

**Run**: `pnpm test:external-deps`

**Timeout**: 60 seconds

### 5. Load Tests

**Purpose**: Test system performance under high-volume conditions.

**Location**: `src/__tests__/load-testing.test.ts`

**Test Scenarios**:

- 1000 events per second sustained load
- Burst traffic patterns (500 events in bursts)
- Mixed event types under load (2000 events)
- Memory usage stability during sustained load
- Database performance with high write volume

**Run**: `pnpm test:load`

**Timeout**: 300 seconds (5 minutes)

**Requirements**:

- Minimum 2GB RAM
- Minimum 2 CPU cores
- Dedicated test database recommended

### 6. Chaos Engineering Tests

**Purpose**: Test system resilience under failure conditions.

**Location**: `src/__tests__/chaos-engineering.test.ts`

**Test Scenarios**:

- Intermittent database connection failures
- Database deadlocks and lock timeouts
- Connection pool exhaustion
- Redis connection drops and reconnections
- Redis memory pressure and evictions
- High network latency
- Network timeouts
- CPU pressure
- Cascading failures with circuit breaker protection
- System self-healing after multiple failure types

**Run**: `pnpm test:chaos`

**Timeout**: 180 seconds (3 minutes)

### 7. CI/CD Tests

**Purpose**: Automated testing for continuous integration pipelines.

**Location**: `src/__tests__/ci-test-suite.test.ts`

**Test Scenarios**:

- Environment validation
- Database schema validation
- Health check endpoints
- Core functionality smoke tests
- Performance and reliability tests
- Data integrity and security tests
- Test data cleanup

**Run**: `pnpm test:ci`

**Timeout**: 90 seconds

## Performance Benchmarks

### Expected Performance Metrics

| Test Type         | Metric         | Target | Acceptable |
| ----------------- | -------------- | ------ | ---------- |
| Unit Tests        | Execution Time | < 5s   | < 10s      |
| Integration Tests | Execution Time | < 30s  | < 60s      |
| E2E Tests         | Execution Time | < 120s | < 180s     |
| Load Tests        | Events/Second  | > 100  | > 50       |
| Load Tests        | Success Rate   | > 95%  | > 90%      |
| Chaos Tests       | Recovery Time  | < 30s  | < 60s      |
| Chaos Tests       | Success Rate   | > 80%  | > 70%      |

### Memory Usage Guidelines

| Test Type         | Expected Memory | Maximum |
| ----------------- | --------------- | ------- |
| Unit Tests        | < 100MB         | 200MB   |
| Integration Tests | < 200MB         | 400MB   |
| Load Tests        | < 500MB         | 1GB     |
| Chaos Tests       | < 300MB         | 600MB   |

## Troubleshooting

### Common Issues

#### Database Connection Errors

```bash
Error: Cannot connect to test database
```

**Solutions**:

1. Verify PostgreSQL is running
2. Check database URL configuration
3. Ensure test database exists
4. Verify user permissions

#### Redis Connection Errors

```bash
Error: Redis connection timeout
```

**Solutions**:

1. Verify Redis server is running
2. Check Redis host/port configuration
3. Verify Redis is accepting connections
4. Check firewall settings

#### Test Timeouts

```bash
Error: Test timeout exceeded
```

**Solutions**:

1. Increase test timeout in configuration
2. Check system resources (CPU, memory)
3. Verify database performance
4. Check for deadlocks or blocking operations

#### Memory Issues During Load Tests

```bash
Error: JavaScript heap out of memory
```

**Solutions**:

1. Increase Node.js memory limit: `--max-old-space-size=4096`
2. Run load tests on dedicated environment
3. Reduce concurrent operations
4. Check for memory leaks

### Debug Mode

Enable debug logging for troubleshooting:

```bash
# Enable debug logs
DEBUG=audit:* pnpm test

# Enable verbose vitest output
pnpm test --reporter=verbose

# Run single test file for debugging
pnpm vitest run src/__tests__/e2e-integration.test.ts --reporter=verbose
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Audit System Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: audit_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: pnpm install

      - name: Run database migrations
        run: pnpm audit-db:migrate
        env:
          AUDIT_DB_URL: postgresql://postgres:postgres@localhost:5432/audit_test

      - name: Run CI test suite
        run: pnpm test:ci
        env:
          AUDIT_DB_URL: postgresql://postgres:postgres@localhost:5432/audit_test
          REDIS_HOST: localhost
          REDIS_PORT: 6379
          REDIS_DB: 1

      - name: Upload test results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: test-results
          path: test-results/
```

### Docker Compose for Testing

```yaml
version: '3.8'

services:
  postgres-test:
    image: postgres:14
    environment:
      POSTGRES_PASSWORD: testpass
      POSTGRES_DB: audit_test
    ports:
      - '5433:5432'
    volumes:
      - postgres_test_data:/var/lib/postgresql/data

  redis-test:
    image: redis:7
    ports:
      - '6380:6379'
    command: redis-server --appendonly yes
    volumes:
      - redis_test_data:/data

volumes:
  postgres_test_data:
  redis_test_data:
```

## Test Data Management

### Cleanup Strategy

Tests automatically clean up their data using the following strategy:

1. **Before Tests**: Clean up any existing test data
2. **After Tests**: Clean up all test data created during the run
3. **Test Isolation**: Each test uses unique identifiers to avoid conflicts

### Test Data Patterns

```typescript
// Use consistent prefixes for test data
const testUserId = 'ci-test-user-001'
const testAction = 'ci.smoke.test'
const testResourceId = 'ci-test-resource-001'

// Clean up in afterAll hooks
afterAll(async () => {
	await db.execute(sql`DELETE FROM audit_log WHERE principal_id LIKE 'ci-test-%'`)
	await db.execute(sql`DELETE FROM audit_log WHERE action LIKE 'ci.%'`)
})
```

## Coverage Requirements

### Minimum Coverage Thresholds

- **Branches**: 80%
- **Functions**: 85%
- **Lines**: 85%
- **Statements**: 85%

### Coverage Exclusions

- Test files (`**/*.test.ts`)
- Example files (`src/examples/**`)
- Type definitions (`src/types.ts`)
- Entry points (`src/index.ts`)

### Generating Coverage Reports

```bash
# Generate coverage report
pnpm test:coverage

# View HTML coverage report
open coverage/index.html
```

## Best Practices

### Writing Tests

1. **Use descriptive test names** that explain what is being tested
2. **Follow AAA pattern** (Arrange, Act, Assert)
3. **Test both success and failure scenarios**
4. **Use proper cleanup** in beforeAll/afterAll hooks
5. **Mock external dependencies** appropriately
6. **Use realistic test data** that reflects production scenarios

### Performance Testing

1. **Start with small loads** and gradually increase
2. **Monitor system resources** during tests
3. **Use dedicated test environments** for load testing
4. **Set realistic expectations** based on hardware
5. **Test failure scenarios** as well as success scenarios

### Chaos Engineering

1. **Start with simple failures** before complex scenarios
2. **Ensure tests are repeatable** and deterministic
3. **Document expected behavior** under failure conditions
4. **Test recovery mechanisms** thoroughly
5. **Monitor system health** during and after tests

## Reporting and Metrics

### Test Results Format

Tests generate results in multiple formats:

- **Console Output**: Real-time test execution feedback
- **JSON Reports**: Machine-readable test results
- **HTML Reports**: Human-readable test results with coverage
- **JUnit XML**: CI/CD pipeline integration

### Key Metrics Tracked

- **Test Execution Time**: Per test and per suite
- **Success/Failure Rates**: Overall and per test type
- **Performance Metrics**: Events per second, latency, throughput
- **Resource Usage**: Memory, CPU, database connections
- **Error Rates**: By error type and component
- **Recovery Times**: Time to recover from failures

### Monitoring Integration

Tests can integrate with monitoring systems to track:

- **Test Execution Trends**: Success rates over time
- **Performance Degradation**: Alerts when performance drops
- **Flaky Test Detection**: Tests that fail intermittently
- **Resource Usage Trends**: Memory and CPU usage patterns

## Conclusion

This comprehensive testing suite ensures the audit system meets all requirements for:

- **Reliability**: System works correctly under normal and adverse conditions
- **Performance**: System handles expected load with acceptable response times
- **Resilience**: System recovers gracefully from failures
- **Compliance**: System meets HIPAA and GDPR requirements
- **Security**: System maintains data integrity and prevents tampering
- **Maintainability**: Tests provide confidence for code changes and deployments

Regular execution of these tests in CI/CD pipelines ensures continuous validation of system quality and reliability.
