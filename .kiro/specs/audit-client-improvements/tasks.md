# Implementation Plan

## Phase 1: Critical Fixes (Week 1)

- [x] 1. Fix memory leaks in event subscriptions
  - Add cleanup method to EventSubscriptionImpl that clears all event handlers
  - Update EventsService to track active subscriptions
  - Implement destroy method for complete cleanup
  - Create memory leak detection test with --detectLeaks flag
  - Verify memory usage remains stable after 1000+ subscription cycles
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 2. Implement cache size limits with LRU eviction
  - Add evictLRU method to CacheManager for removing oldest entries
  - Enforce size limit in set method before adding new entries
  - Implement hard limit enforcement for emergency eviction (>120% of maxSize)
  - Add monitoring and alerts for high cache utilization (>90%)
  - Create tests verifying size limits are enforced
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 3. Add circuit breaker persistence
  - Create CircuitBreakerPersistence interface with save/load/clear methods
  - Implement MemoryCircuitBreakerPersistence for testing
  - Implement LocalStorageCircuitBreakerPersistence for browser
  - Update RetryManager to accept persistence implementation
  - Add loadPersistedState method that restores states <1 hour old
  - Persist state on every circuit breaker change
  - Create tests verifying persistence works across restarts
  - _Requirements: 1.5, 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8_

## Phase 2: High Priority Improvements (Weeks 2-4)

- [x] 4. Extract HttpClient from BaseResource
- [x] 4.1 Create HttpClient class
  - Create src/core/http-client.ts file
  - Implement request method with HttpRequestOptions interface
  - Add buildHeaders method for auth, correlation IDs, and custom headers
  - Add buildBody method for JSON, FormData, and Blob serialization
  - Add parseResponse method supporting json, text, blob, and stream
  - Add createHttpError method with detailed error context
  - Add getUserAgent method for client identification
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 4.2 Refactor BaseResource to use HttpClient
  - Inject HttpClient into BaseResource constructor
  - Update request method to delegate HTTP operations to HttpClient
  - Simplify BaseResource to focus on orchestration (caching, retry, interceptors)
  - Remove HTTP-specific code from BaseResource
  - Ensure BaseResource file is <600 lines after refactoring
  - _Requirements: 2.2, 2.3, 2.5_

- [x] 4.3 Add tests for HttpClient
  - Test successful GET/POST/PUT/DELETE requests
  - Test auth header inclusion
  - Test custom header handling
  - Test body serialization for different types
  - Test response parsing for different content types
  - Test HttpError creation on failures
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 4.4 Update services to use refactored BaseResource
  - Verify all services work with new BaseResource
  - Ensure no breaking changes to service APIs
  - Update service tests if needed
  - _Requirements: 2.2, 2.3_

- [x] 5. Implement comprehensive test coverage
- [x] 5.1 Set up coverage infrastructure
  - Configure vitest.config.ts with coverage thresholds (80% lines, 80% functions, 75% branches)
  - Add test setup file with global mocks (fetch, localStorage, sessionStorage)
  - Configure coverage reporters (text, json, html, lcov)
  - Add coverage scripts to package.json
  - _Requirements: 3.1, 3.2, 3.3, 3.7_

- [x] 5.2 Add infrastructure tests
  - Add comprehensive AuthManager tests (token refresh, concurrent requests, cookie handling)
  - Add CacheManager edge case tests (size limits, concurrent operations, eviction)
  - Add RetryManager tests (exponential backoff, circuit breaker, persistence)
  - Add BatchManager tests
  - Add ErrorHandler tests
  - Target 90%+ coverage for infrastructure
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 5.3 Add service tests
  - Add comprehensive EventsService tests (create, query, subscribe, error handling)
  - Add ComplianceService tests
  - Add MetricsService tests
  - Add HealthService tests
  - Test cache behavior and retry logic
  - Target 85%+ coverage for services
  - _Requirements: 3.1, 3.2, 3.3, 3.5_

- [x] 5.4 Add integration tests
  - Create integration test suite for complete request lifecycles
  - Test client initialization and destruction
  - Test end-to-end audit event flow
  - Test error scenarios and recovery
  - _Requirements: 3.5_

- [x] 5.5 Add memory leak detection tests
  - Create tests for event subscription cleanup
  - Create tests for cache cleanup
  - Create tests for retry manager cleanup
  - Run tests with --detectLeaks flag
  - _Requirements: 3.6_

- [x] 6. Implement performance monitoring
- [x] 6.1 Create PerformanceMonitor class
  - Create src/infrastructure/performance-monitor.ts
  - Implement recordMetric method for tracking metrics
  - Implement getMetrics method returning PerformanceMetrics
  - Implement checkBudget method for budget violations
  - Implement getReport method for performance reports
  - Add percentile calculation (p95, p99)
  - Add cache hit rate and error rate calculation
  - _Requirements: 4.1, 4.2, 4.4, 4.6_

- [x] 6.2 Integrate PerformanceMonitor with AuditClient
  - Add PerformanceMonitor to AuditClient constructor
  - Record initialization time
  - Expose getPerformanceReport method
  - Expose checkPerformanceBudget method
  - _Requirements: 4.4_

- [x] 6.3 Add performance tracking to BaseResource
  - Record request times for all requests
  - Record cache hits and misses
  - Record errors
  - Track memory usage
  - _Requirements: 4.1, 4.2_

- [x] 6.4 Add CI/CD performance checks
  - Create scripts/check-performance.ts for bundle size checking
  - Add performance check workflow to GitHub Actions
  - Configure performance budgets (200KB bundle, 100ms init, 1000ms p95 request)
  - Add PR comments with performance comparison
  - _Requirements: 4.2, 4.3, 4.5_

- [x] 6.5 Add performance benchmarks
  - Create benchmark tests for client initialization
  - Create benchmark tests for cache operations
  - Create benchmark tests for request performance
  - Add benchmark script to package.json
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7_

- [x] 7. Implement lazy loading for plugins
- [x] 7.1 Create PluginLoader class
  - Create src/infrastructure/plugins/plugin-loader.ts
  - Implement loadBuiltInPlugin method with dynamic imports
  - Add deduplication for concurrent plugin loads
  - Add caching for loaded plugins
  - Use webpack magic comments for chunk names
  - _Requirements: 5.1, 5.2, 5.7_

- [x] 7.2 Update AuditClient for lazy loading
  - Add PluginLoader to AuditClient
  - Make plugins getter lazy (initialize on first access)
  - Add loadPlugin method for loading individual plugins
  - Add loadPlugins method for loading multiple plugins
  - Add initializePlugins method for auto-loading configured plugins
  - _Requirements: 5.3, 5.4, 5.5, 5.6_

- [x] 7.3 Reorganize plugin structure
  - Split plugins into separate files under built-in/ directory
  - Update exports to support tree-shaking
  - Remove plugin code from main bundle
  - Create separate chunks for each plugin
  - _Requirements: 5.3, 5.7_

- [x] 7.4 Add tests for lazy loading
  - Test plugin loads on demand
  - Test plugin caching
  - Test concurrent load deduplication
  - Test unknown plugin error handling
  - Measure bundle size reduction (target 30%+)
  - _Requirements: 5.1, 5.2, 5.7_

## Phase 3: Testing & Documentation (Weeks 5-6)

- [x] 8. Expand test coverage to edge cases
  - Add error scenario tests (network failures, timeouts, malformed responses)
  - Add concurrency tests (parallel requests, race conditions, cache contention)
  - Add edge case tests (empty responses, large payloads, special characters)
  - Add browser compatibility tests (localStorage unavailable, cookies disabled)
  - Document known limitations
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 9. Enhance error messages
- [x] 9.1 Improve HttpError messages
  - Add getUserMessage method with user-friendly descriptions
  - Add getActionableAdvice method with suggestions
  - Add getRetryAfter method for human-readable retry duration
  - Add getResourceType method for identifying resource in 404 errors
  - Add getValidationMessage method for 400 errors
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

- [x] 9.2 Add tests for error messages
  - Test error messages for all HTTP status codes
  - Test validation error formatting
  - Test retry-after parsing
  - Test sensitive data masking
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

- [x] 10. Implement input sanitization
- [x] 10.1 Create InputSanitizer utility
  - Create src/utils/sanitization.ts
  - Implement sanitizeString method (remove HTML tags, JS protocols, event handlers)
  - Implement sanitizeObject method (recursive sanitization)
  - Implement sanitizeUrl method (validate protocols)
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.6, 7.7_

- [x] 10.2 Integrate sanitization in services
  - Add sanitization to EventsService.create
  - Add sanitization to ComplianceService methods
  - Add sanitization to MetricsService methods
  - Sanitize before validation
  - _Requirements: 7.5_

- [x] 10.3 Add tests for sanitization
  - Test HTML tag removal
  - Test JavaScript protocol removal
  - Test event handler removal
  - Test URL validation
  - Test recursive object sanitization
  - Test legitimate special character preservation
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

- [x] 11. Add request timeout handling
- [x] 11.1 Implement timeout in BaseResource
  - Add timeout option to RequestOptions
  - Use AbortController for timeout enforcement
  - Create TimeoutError with duration and context
  - Clean up AbortController after completion
  - Integrate with retry logic
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

- [x] 11.2 Add tests for timeout handling
  - Test timeout enforcement
  - Test TimeoutError creation
  - Test AbortController cleanup
  - Test timeout with retry logic
  - Test default timeout configuration
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

- [x] 12. Implement detailed request/response logging
- [x] 12.1 Create DetailedLoggingInterceptor
  - Create src/infrastructure/interceptors/built-in/logging-interceptor.ts
  - Implement request interceptor logging method, endpoint, timing
  - Implement response interceptor logging status, duration
  - Add optional header logging with sensitive data masking
  - Add optional body logging with sensitive data masking
  - Mask sensitive headers (authorization, x-api-key, cookie)
  - Mask sensitive fields (password, token, apiKey, secret)
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_

- [x] 12.2 Add tests for logging interceptor
  - Test request logging
  - Test response logging
  - Test header masking
  - Test body masking
  - Test timing tracking
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_

- [x] 13. Extract common logging patterns
- [x] 13.1 Create LoggingHelper utility
  - Create src/utils/logging-helper.ts
  - Implement logRequest static method
  - Implement createRequestLogger factory method
  - Implement determineLogLevel method
  - Implement setCorrelationIds method
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.7_

- [x] 13.2 Update services to use LoggingHelper
  - Replace duplicated logging code in EventsService
  - Replace duplicated logging code in ComplianceService
  - Replace duplicated logging code in MetricsService
  - Replace duplicated logging code in HealthService
  - _Requirements: 10.6_

- [x] 13.3 Add tests for LoggingHelper
  - Test log level determination
  - Test correlation ID setting
  - Test logging disabled behavior
  - Test factory method
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_

- [x] 14. Create comprehensive documentation
- [x] 14.1 Generate API documentation
  - Install typedoc and typedoc-plugin-markdown
  - Configure typedoc.json with categories and exclusions
  - Generate API documentation from TypeScript source
  - Add docs:generate script to package.json
  - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7_

- [x] 14.2 Add architecture diagrams
  - Create system architecture diagram (Mermaid)
  - Create request flow diagram (Mermaid)
  - Create error handling flow diagram (Mermaid)
  - Create plugin system diagram (Mermaid)
  - Create cache strategy diagram (Mermaid)
  - Add diagrams to docs/ARCHITECTURE.md
  - _Requirements: Design section_

- [x] 14.3 Update guides and examples
  - Update GETTING_STARTED.md with new features
  - Create MIGRATION_GUIDE.md for v0.x to v1.0
  - Update PERFORMANCE_OPTIMIZATION.md with new monitoring
  - Update TROUBLESHOOTING_AND_FAQ.md
  - Add examples for new features (performance monitoring, lazy loading)
  - _Requirements: Design section_

## Phase 4: Performance & Polish (Weeks 7-8)

- [ ] 15. Improve console output formatting
- [ ] 15.1 Enhance ConsoleLogger
  - Add color coding for log levels (debug: cyan, info: green, warn: yellow, error: red)
  - Add ISO timestamps to all log messages
  - Format metadata objects with proper indentation
  - Handle metadata serialization errors gracefully
  - Reset color codes after each message
  - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7_

- [ ] 15.2 Add tests for ConsoleLogger
  - Test color coding
  - Test timestamp formatting
  - Test metadata formatting
  - Test error handling
  - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7_

- [ ] 16. Add configuration validation
- [ ] 16.1 Create ConfigValidator utility
  - Create src/core/config-validator.ts
  - Implement validate method returning validation result
  - Add baseUrl validation (required, valid URL)
  - Add authentication validation (type-specific requirements)
  - Add retry configuration validation (value ranges)
  - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7_

- [ ] 16.2 Integrate validation in ConfigManager
  - Call ConfigValidator.validate in ConfigManager constructor
  - Throw descriptive errors for invalid configuration
  - Log validation warnings for non-critical issues
  - _Requirements: 15.1, 15.2, 15.3, 15.4_

- [ ] 16.3 Add tests for configuration validation
  - Test baseUrl validation
  - Test authentication validation for each type
  - Test retry configuration validation
  - Test validation error messages
  - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7_

- [ ] 17. Implement repository pattern for services
- [ ] 17.1 Create repository interfaces
  - Create src/repositories/events-repository.ts with interface
  - Define methods: create, findById, query, delete
  - Create HttpEventsRepository implementation
  - _Requirements: 16.1, 16.2, 16.5, 16.7_

- [ ] 17.2 Refactor EventsService to use repository
  - Update EventsService constructor to accept repository
  - Delegate data access to repository
  - Focus service on business logic and validation
  - _Requirements: 16.3, 16.4, 16.6_

- [ ] 17.3 Add tests for repository pattern
  - Test repository interface implementation
  - Test service with mocked repository
  - Test error handling (404 returns null)
  - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7_

- [ ] 18. Add deprecation warnings
- [ ] 18.1 Create deprecation decorator
  - Create src/utils/deprecation.ts
  - Implement deprecated decorator with message, since, removeIn parameters
  - Log warning on first call to deprecated method
  - Preserve original method functionality
  - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6_

- [ ] 18.2 Mark deprecated methods
  - Add @deprecated decorator to EventsService.list (use query instead)
  - Add @deprecated decorator to ComplianceService.generateReport (use createReport instead)
  - Update JSDoc comments with deprecation notices
  - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.7_

- [ ] 18.3 Add tests for deprecation warnings
  - Test warning is logged on first call
  - Test method functionality is preserved
  - Test warning includes all information
  - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 18.7_

- [ ] 19. Add bundle size tracking
- [ ] 19.1 Create bundle size check script
  - Create scripts/check-bundle-size.ts
  - Measure gzipped size of all output bundles
  - Compare against configured limits
  - Provide actionable feedback on failures
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7_

- [ ] 19.2 Add bundle size tracking to CI/CD
  - Add bundle size check to GitHub Actions workflow
  - Track bundle size trends across commits
  - Fail builds that exceed limits
  - Comment on PRs with bundle size comparison
  - _Requirements: 12.1, 12.2, 12.3, 12.6_

- [ ] 20. Add request batching optimization
- [ ] 20.1 Create BatchOptimizer class
  - Create src/infrastructure/batch-optimizer.ts
  - Implement addRequest method with batch window
  - Implement executeBatch method for batch execution
  - Configure batch window and maximum batch size
  - Resolve individual promises with results
  - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 19.7_

- [ ] 20.2 Add tests for request batching
  - Test batch window execution
  - Test maximum batch size enforcement
  - Test promise resolution
  - Test error handling
  - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 19.7_

- [ ] 21. Implement ETag-based caching
- [ ] 21.1 Create ETagCache class
  - Create src/infrastructure/etag-cache.ts
  - Implement get method returning etag and data
  - Implement set method storing etag and data
  - Implement clear method for cache invalidation
  - _Requirements: 20.1, 20.5_

- [ ] 21.2 Integrate ETag caching in BaseResource
  - Check ETag cache before requests
  - Add If-None-Match header with cached ETag
  - Handle 304 Not Modified responses
  - Cache ETag from response headers
  - _Requirements: 20.2, 20.3, 20.4, 20.6, 20.7_

- [ ] 21.3 Add tests for ETag caching
  - Test ETag storage and retrieval
  - Test If-None-Match header inclusion
  - Test 304 response handling
  - Test ETag caching for GET requests only
  - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5, 20.6, 20.7_

- [ ] 22. Final code quality improvements
  - Run linter and fix all issues
  - Format all code with Prettier
  - Remove dead code and unused imports
  - Update comments and JSDoc
  - Verify all tests pass
  - Verify coverage thresholds met
  - Verify performance budgets met
  - Update CHANGELOG.md
  - _Requirements: All_
