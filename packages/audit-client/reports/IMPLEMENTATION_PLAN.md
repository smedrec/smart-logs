# Implementation Plan for Priority Improvements

## @smedrec/audit-client Package

**Created:** November 14, 2025  
**Timeline:** 6-8 weeks  
**Team Size:** 2-3 developers

---

## Table of Contents

1. [Overview](#overview)
2. [Phase 1: Critical Fixes (Week 1)](#phase-1-critical-fixes-week-1)
3. [Phase 2: High Priority Improvements (Weeks 2-4)](#phase-2-high-priority-improvements-weeks-2-4)
4. [Phase 3: Testing & Documentation (Weeks 5-6)](#phase-3-testing--documentation-weeks-5-6)
5. [Phase 4: Performance & Polish (Weeks 7-8)](#phase-4-performance--polish-weeks-7-8)
6. [Success Metrics](#success-metrics)
7. [Risk Mitigation](#risk-mitigation)

---

## Overview

This plan addresses the priority improvements identified in the code quality analysis, organized into 4 phases over 6-8 weeks. Each phase includes specific tasks, acceptance criteria, and estimated effort.

### Priority Summary

**Critical Issues (Must Fix):**

- Memory leaks in event subscriptions
- Unbounded cache growth
- Circuit breaker state persistence

**High Priority (Should Fix):**

- Refactor BaseResource (extract HTTP client)
- Implement comprehensive test coverage
- Add performance monitoring
- Implement lazy loading for plugins

**Success Criteria:**

- All critical issues resolved
- Test coverage > 80%
- Bundle size < 200KB (gzipped)
- No memory leaks detected
- Performance budgets enforced

---

## Phase 1: Critical Fixes (Week 1)

**Goal:** Fix all critical issues that could cause production problems

**Team:** 2 developers  
**Duration:** 5 days  
**Risk Level:** Low (fixes are well-defined)

### Task 1.1: Fix Memory Leaks in Event Subscriptions

**Priority:** 🔴 Critical  
**Effort:** 4 hours  
**Assignee:** Developer 1  
**Files:** `src/services/events.ts`

**Implementation Steps:**

1. **Add cleanup method to EventSubscriptionImpl**

   ```typescript
   // Location: src/services/events.ts

   disconnect(): void {
     // Clean up managed connection
     if (this.managedConnection) {
       this.managedConnection.disconnect()
       this.managedConnection = null
     }

     // NEW: Clear all event handlers
     this.eventHandlers.forEach(handlers => handlers.clear())
     this.eventHandlers.clear()

     this.isConnected = false
     this.emit('disconnect')
   }

   // NEW: Add destroy method for complete cleanup
   destroy(): void {
     this.disconnect()
     this.streamingManager = null as any
   }
   ```

2. **Update EventsService to track subscriptions**

   ```typescript
   private activeSubscriptions: Set<EventSubscription> = new Set()

   async subscribe(params: SubscriptionParams): Promise<EventSubscription> {
     const subscription = new EventSubscriptionImpl(...)
     this.activeSubscriptions.add(subscription)
     return subscription
   }

   async destroy(): Promise<void> {
     // Clean up all subscriptions
     this.activeSubscriptions.forEach(sub => {
       if (sub.isConnected) {
         sub.disconnect()
       }
     })
     this.activeSubscriptions.clear()
   }
   ```

3. **Add memory leak detection test**

   ```typescript
   // src/__tests__/services/events.memory.test.ts
   describe('EventsService - Memory Leaks', () => {
   	it('should not leak memory when creating/destroying subscriptions', async () => {
   		const initialMemory = process.memoryUsage().heapUsed

   		// Create and destroy 100 subscriptions
   		for (let i = 0; i < 100; i++) {
   			const sub = await service.subscribe({ filter: {} })
   			await sub.connect()
   			sub.disconnect()
   		}

   		// Force garbage collection
   		if (global.gc) global.gc()

   		const finalMemory = process.memoryUsage().heapUsed
   		const memoryIncrease = finalMemory - initialMemory

   		// Memory increase should be minimal (< 1MB)
   		expect(memoryIncrease).toBeLessThan(1024 * 1024)
   	})
   })
   ```

**Acceptance Criteria:**

- [ ] All event handlers properly cleaned up on disconnect
- [ ] No memory leaks detected in tests
- [ ] Memory usage stable after 1000+ subscription cycles
- [ ] Tests pass with `--detectLeaks` flag

**Testing:**

```bash
pnpm test src/__tests__/services/events.memory.test.ts --detectLeaks
```

---

### Task 1.2: Implement Cache Size Limits

**Priority:** 🔴 Critical  
**Effort:** 6 hours  
**Assignee:** Developer 2  
**Files:** `src/infrastructure/cache.ts`

**Implementation Steps:**

1. **Add LRU eviction method**

   ```typescript
   // Location: src/infrastructure/cache.ts

   private async evictLRU(count: number = 1): Promise<number> {
     const keys = await this.storage.keys()
     const entries: Array<{ key: string; lastAccessed: number }> = []

     // Collect all entries with access times
     for (const key of keys) {
       try {
         const value = await this.storage.get(key)
         if (value) {
           const entry = JSON.parse(value)
           entries.push({
             key,
             lastAccessed: entry.lastAccessed || entry.createdAt
           })
         }
       } catch {
         // Remove invalid entries
         await this.storage.delete(key)
       }
     }

     // Sort by lastAccessed (oldest first)
     entries.sort((a, b) => a.lastAccessed - b.lastAccessed)

     // Evict oldest entries
     let evicted = 0
     for (let i = 0; i < count && i < entries.length; i++) {
       await this.storage.delete(entries[i].key)
       evicted++
     }

     this.stats.evictions += evicted
     return evicted
   }
   ```

2. **Enforce size limit in set method**

   ```typescript
   async set<T>(key: string, value: T, ttlMs?: number, tags?: string[]): Promise<void> {
     if (!this.config.enabled) return

     const prefixedKey = this.prefixKey(key)
     const currentSize = await this.storage.size()

     // NEW: Check if we need to evict
     const isUpdate = await this.storage.get(prefixedKey) !== null
     if (!isUpdate && currentSize >= this.config.maxSize) {
       // Evict at least 10% of cache or 1 item, whichever is larger
       const evictCount = Math.max(1, Math.floor(this.config.maxSize * 0.1))
       await this.evictLRU(evictCount)
     }

     // ... rest of set logic
   }
   ```

3. **Add hard limit enforcement**

   ```typescript
   private async enforceHardLimit(): Promise<void> {
     const currentSize = await this.storage.size()

     if (currentSize > this.config.maxSize * 1.2) {
       // Emergency eviction if 20% over limit
       const toEvict = currentSize - this.config.maxSize
       await this.evictLRU(toEvict)

       this.logger?.warn('Cache hard limit exceeded, emergency eviction performed', {
         evicted: toEvict,
         maxSize: this.config.maxSize
       })
     }
   }
   ```

4. **Add monitoring and alerts**

   ```typescript
   getStats(): CacheStats {
     const stats = { ...this.stats }

     // Add utilization percentage
     stats.utilization = (stats.size / this.config.maxSize) * 100

     // Warn if utilization is high
     if (stats.utilization > 90) {
       this.logger?.warn('Cache utilization high', {
         utilization: stats.utilization,
         size: stats.size,
         maxSize: this.config.maxSize
       })
     }

     return stats
   }
   ```

**Acceptance Criteria:**

- [ ] Cache never exceeds maxSize by more than 10%
- [ ] LRU eviction works correctly
- [ ] Performance impact < 5ms per eviction
- [ ] Tests verify size limits enforced
- [ ] Monitoring alerts when utilization > 90%

**Testing:**

```typescript
describe('CacheManager - Size Limits', () => {
	it('should enforce maxSize limit', async () => {
		const cache = new CacheManager({
			enabled: true,
			maxSize: 10,
			storage: 'memory',
		})

		// Fill cache beyond limit
		for (let i = 0; i < 20; i++) {
			await cache.set(`key${i}`, `value${i}`)
		}

		const stats = cache.getStats()
		expect(stats.size).toBeLessThanOrEqual(10)
		expect(stats.evictions).toBeGreaterThan(0)
	})
})
```

---

### Task 1.3: Add Circuit Breaker Persistence

**Priority:** 🔴 Critical  
**Effort:** 8 hours  
**Assignee:** Developer 1  
**Files:** `src/infrastructure/retry.ts`

**Implementation Steps:**

1. **Create persistence interface**

   ```typescript
   // Location: src/infrastructure/retry.ts

   export interface CircuitBreakerPersistence {
   	save(key: string, stats: CircuitBreakerStats): Promise<void>
   	load(key: string): Promise<CircuitBreakerStats | null>
   	loadAll(): Promise<Map<string, CircuitBreakerStats>>
   	clear(key: string): Promise<void>
   	clearAll(): Promise<void>
   }
   ```

2. **Implement memory-based persistence (default)**

   ```typescript
   export class MemoryCircuitBreakerPersistence implements CircuitBreakerPersistence {
   	private storage = new Map<string, CircuitBreakerStats>()

   	async save(key: string, stats: CircuitBreakerStats): Promise<void> {
   		this.storage.set(key, { ...stats })
   	}

   	async load(key: string): Promise<CircuitBreakerStats | null> {
   		return this.storage.get(key) || null
   	}

   	async loadAll(): Promise<Map<string, CircuitBreakerStats>> {
   		return new Map(this.storage)
   	}

   	async clear(key: string): Promise<void> {
   		this.storage.delete(key)
   	}

   	async clearAll(): Promise<void> {
   		this.storage.clear()
   	}
   }
   ```

3. **Implement localStorage persistence (browser)**

   ```typescript
   export class LocalStorageCircuitBreakerPersistence implements CircuitBreakerPersistence {
   	private prefix = 'circuit-breaker:'

   	async save(key: string, stats: CircuitBreakerStats): Promise<void> {
   		try {
   			localStorage.setItem(this.prefix + key, JSON.stringify(stats))
   		} catch (error) {
   			console.warn('Failed to persist circuit breaker state', error)
   		}
   	}

   	async load(key: string): Promise<CircuitBreakerStats | null> {
   		try {
   			const data = localStorage.getItem(this.prefix + key)
   			return data ? JSON.parse(data) : null
   		} catch {
   			return null
   		}
   	}

   	// ... implement other methods
   }
   ```

4. **Update RetryManager to use persistence**

   ```typescript
   export class RetryManager {
   	private persistence: CircuitBreakerPersistence

   	constructor(
   		config: RetryConfig,
   		circuitBreakerConfig?: Partial<CircuitBreakerConfig>,
   		persistence?: CircuitBreakerPersistence
   	) {
   		this.config = config
   		this.circuitBreakerConfig = {
   			/* ... */
   		}
   		this.persistence = persistence || new MemoryCircuitBreakerPersistence()

   		// Load persisted state
   		this.loadPersistedState()
   	}

   	private async loadPersistedState(): Promise<void> {
   		try {
   			const persisted = await this.persistence.loadAll()

   			// Restore circuit breaker states
   			for (const [key, stats] of persisted) {
   				// Only restore if still relevant (not too old)
   				if (this.isStateRelevant(stats)) {
   					this.circuitBreakers.set(key, stats)
   				}
   			}
   		} catch (error) {
   			this.logger?.warn('Failed to load persisted circuit breaker state', { error })
   		}
   	}

   	private isStateRelevant(stats: CircuitBreakerStats): boolean {
   		// Only restore states from last hour
   		const oneHourAgo = Date.now() - 3600000
   		return (stats.lastFailureTime || 0) > oneHourAgo
   	}

   	private async recordFailure(key: string): Promise<void> {
   		// ... existing logic

   		// Persist state
   		try {
   			await this.persistence.save(key, stats)
   		} catch (error) {
   			this.logger?.warn('Failed to persist circuit breaker state', { error })
   		}
   	}
   }
   ```

**Acceptance Criteria:**

- [ ] Circuit breaker state persists across restarts
- [ ] Old states (>1 hour) are not restored
- [ ] Persistence failures don't break functionality
- [ ] Tests verify persistence works
- [ ] Documentation updated

**Testing:**

```typescript
describe('RetryManager - Persistence', () => {
	it('should persist and restore circuit breaker state', async () => {
		const persistence = new MemoryCircuitBreakerPersistence()
		const manager1 = new RetryManager(config, {}, persistence)

		// Trigger circuit breaker
		for (let i = 0; i < 5; i++) {
			try {
				await manager1.execute(() => Promise.reject(new Error('fail')), {
					endpoint: '/test',
					requestId: 'test',
				})
			} catch {}
		}

		// Create new manager with same persistence
		const manager2 = new RetryManager(config, {}, persistence)

		// Circuit breaker should still be open
		const stats = manager2.getCircuitBreakerStats('/test:GET')
		expect(stats?.state).toBe(CircuitBreakerState.OPEN)
	})
})
```

---

### Phase 1 Deliverables

**Code Changes:**

- [ ] Memory leak fixes in EventSubscriptionImpl
- [ ] Cache size limit enforcement
- [ ] Circuit breaker persistence implementation
- [ ] Unit tests for all fixes
- [ ] Memory leak detection tests

**Documentation:**

- [ ] Update CHANGELOG.md with fixes
- [ ] Add migration notes if needed
- [ ] Update API documentation

**Validation:**

- [ ] All tests pass
- [ ] No memory leaks detected
- [ ] Cache size limits enforced
- [ ] Circuit breaker persists correctly

---

## Phase 2: High Priority Improvements (Weeks 2-4)

**Goal:** Improve architecture, testability, and performance

**Team:** 2-3 developers  
**Duration:** 3 weeks  
**Risk Level:** Medium (requires refactoring)

### Task 2.1: Refactor BaseResource - Extract HTTP Client

**Priority:** 🟠 High  
**Effort:** 3 days  
**Assignee:** Developer 1 + Developer 2  
**Files:** `src/core/base-resource.ts`, `src/core/http-client.ts` (new)

**Implementation Steps:**

**Day 1: Create HttpClient class**

1. **Create new HttpClient**

   ```typescript
   // Location: src/core/http-client.ts

   export class HttpClient {
   	constructor(
   		private config: AuditClientConfig,
   		private authManager: AuthManager,
   		private logger: Logger
   	) {}

   	async request<T>(url: string, options: HttpRequestOptions): Promise<HttpResponse<T>> {
   		const headers = await this.buildHeaders(options.headers, options.requestId)
   		const body = this.buildBody(options.body)

   		const fetchOptions: RequestInit = {
   			method: options.method || 'GET',
   			headers,
   			body,
   			signal: options.signal,
   			credentials: 'include',
   		}

   		const response = await fetch(url, fetchOptions)

   		if (!response.ok) {
   			throw await this.createHttpError(response, options.requestId)
   		}

   		return {
   			status: response.status,
   			statusText: response.statusText,
   			headers: this.parseHeaders(response.headers),
   			data: await this.parseResponse<T>(response, options.responseType),
   		}
   	}

   	private async buildHeaders(
   		customHeaders?: Record<string, string>,
   		requestId?: string
   	): Promise<Headers> {
   		const headers = new Headers()

   		// Default headers
   		headers.set('Accept', 'application/json')
   		headers.set('Content-Type', 'application/json')
   		headers.set('User-Agent', this.getUserAgent())

   		if (requestId) {
   			headers.set('X-Request-ID', requestId)
   		}

   		// Auth headers
   		const authHeaders = await this.authManager.getAuthHeaders()
   		Object.entries(authHeaders).forEach(([key, value]) => {
   			headers.set(key, value)
   		})

   		// Custom headers
   		if (customHeaders) {
   			Object.entries(customHeaders).forEach(([key, value]) => {
   				headers.set(key, value)
   			})
   		}

   		return headers
   	}

   	private buildBody(body?: any): string | FormData | Blob | null {
   		if (!body) return null
   		if (body instanceof FormData || body instanceof Blob) return body
   		if (typeof body === 'string') return body
   		return JSON.stringify(body)
   	}

   	private async parseResponse<T>(response: Response, responseType?: string): Promise<T> {
   		switch (responseType) {
   			case 'blob':
   				return response.blob() as Promise<T>
   			case 'text':
   				return response.text() as Promise<T>
   			case 'stream':
   				return response.body as unknown as T
   			case 'json':
   			default:
   				const text = await response.text()
   				return text ? JSON.parse(text) : ({} as T)
   		}
   	}

   	private async createHttpError(response: Response, requestId?: string): Promise<HttpError> {
   		let body: any
   		try {
   			body = await response.clone().json()
   		} catch {
   			body = await response.clone().text()
   		}

   		return new HttpError(
   			response.status,
   			response.statusText,
   			`HTTP ${response.status}: ${response.statusText}`,
   			requestId,
   			body
   		)
   	}

   	private getUserAgent(): string {
   		const version = '1.0.0'
   		const platform = typeof window !== 'undefined' ? 'browser' : 'node'
   		return `audit-client/${version} (${platform})`
   	}

   	private parseHeaders(headers: Headers): Record<string, string> {
   		const result: Record<string, string> = {}
   		headers.forEach((value, key) => {
   			result[key] = value
   		})
   		return result
   	}
   }
   ```

**Day 2: Refactor BaseResource**

2. **Simplify BaseResource to use HttpClient**

   ```typescript
   // Location: src/core/base-resource.ts

   export abstract class BaseResource {
   	protected config: AuditClientConfig
   	protected httpClient: HttpClient
   	protected cacheManager: CacheManager
   	protected retryManager: RetryManager
   	protected batchManager: BatchManager
   	protected errorHandler: ErrorHandler
   	protected logger: Logger
   	protected interceptorManager: InterceptorManager
   	protected performanceManager: PerformanceManager

   	constructor(config: AuditClientConfig, logger?: Logger) {
   		this.config = config
   		this.logger = logger || LoggerFactory.create(config.logging)
   		this.initializeManagers()
   	}

   	private initializeManagers(): void {
   		this.authManager = new AuthManager(this.config.authentication)
   		this.httpClient = new HttpClient(this.config, this.authManager, this.logger)
   		this.cacheManager = new CacheManager(this.config.cache)
   		this.retryManager = new RetryManager(this.config.retry)
   		// ... other managers
   	}

   	protected async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
   		const requestId = this.generateRequestId()
   		const startTime = Date.now()

   		// Performance tracking
   		this.performanceManager
   			.getMetricsCollector()
   			.startRequest(requestId, endpoint, options.method || 'GET')

   		// Interceptor context
   		const context: InterceptorContext = {
   			requestId,
   			endpoint,
   			method: options.method || 'GET',
   			timestamp: startTime,
   			metadata: options.metadata,
   		}

   		try {
   			// Apply request interceptors
   			const processedOptions = await this.applyRequestInterceptors(options, context)

   			// Check cache
   			if (!processedOptions.skipCache && this.shouldUseCache(endpoint, processedOptions)) {
   				const cached = await this.cacheManager.get<T>(
   					this.generateCacheKey(endpoint, processedOptions)
   				)
   				if (cached) {
   					this.performanceManager.getMetricsCollector().completeRequest(requestId, {
   						status: 200,
   						cached: true,
   					})
   					return cached
   				}
   			}

   			// Execute request with retry
   			const url = this.buildUrl(endpoint, processedOptions.query)
   			const response = await this.executeWithRetry<T>(url, processedOptions, requestId)

   			// Apply response interceptors
   			const processedResponse = await this.applyResponseInterceptors(
   				response,
   				processedOptions,
   				context
   			)

   			// Cache response
   			if (
   				!processedOptions.skipCache &&
   				this.shouldCache(endpoint, processedOptions, processedResponse)
   			) {
   				await this.cacheManager.set(
   					this.generateCacheKey(endpoint, processedOptions),
   					processedResponse,
   					processedOptions.cacheTtl
   				)
   			}

   			this.performanceManager.getMetricsCollector().completeRequest(requestId, {
   				status: 200,
   				cached: false,
   			})

   			return processedResponse
   		} catch (error) {
   			this.performanceManager.getMetricsCollector().completeRequest(requestId, {
   				error: error instanceof Error ? error.message : 'Unknown error',
   			})

   			const processedError = await this.errorHandler.handleError(error, {
   				endpoint,
   				requestId,
   				duration: Date.now() - startTime,
   			})

   			if (this.config.errorHandling.throwOnError) {
   				throw processedError
   			}

   			return processedError as unknown as T
   		}
   	}

   	private async executeWithRetry<T>(
   		url: string,
   		options: RequestOptions,
   		requestId: string
   	): Promise<T> {
   		if (options.skipRetry) {
   			const response = await this.httpClient.request<T>(url, {
   				...options,
   				requestId,
   			})
   			return response.data
   		}

   		return this.retryManager.execute(
   			async () => {
   				const response = await this.httpClient.request<T>(url, {
   					...options,
   					requestId,
   				})
   				return response.data
   			},
   			{
   				endpoint: url,
   				requestId,
   				method: options.method || 'GET',
   			}
   		)
   	}

   	private buildUrl(endpoint: string, query?: Record<string, any>): string {
   		const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
   		const baseUrl = this.config.baseUrl.endsWith('/')
   			? this.config.baseUrl.slice(0, -1)
   			: this.config.baseUrl
   		const versionPath = this.config.apiVersion ? `/api/${this.config.apiVersion}` : '/api/v1'

   		let url = `${baseUrl}${versionPath}${normalizedEndpoint}`

   		if (query && Object.keys(query).length > 0) {
   			const searchParams = new URLSearchParams()
   			Object.entries(query).forEach(([key, value]) => {
   				if (value !== undefined && value !== null) {
   					if (Array.isArray(value)) {
   						value.forEach((item) => searchParams.append(key, String(item)))
   					} else {
   						searchParams.append(key, String(value))
   					}
   				}
   			})

   			const queryString = searchParams.toString()
   			if (queryString) {
   				url += `?${queryString}`
   			}
   		}

   		return url
   	}

   	// ... other helper methods (simplified)
   }
   ```

**Day 3: Testing and Migration**

3. **Add tests for HttpClient**

   ```typescript
   // src/__tests__/core/http-client.test.ts

   describe('HttpClient', () => {
   	let httpClient: HttpClient
   	let mockAuthManager: jest.Mocked<AuthManager>
   	let mockLogger: jest.Mocked<Logger>

   	beforeEach(() => {
   		mockAuthManager = {
   			getAuthHeaders: jest.fn().mockResolvedValue({
   				Authorization: 'Bearer test-token',
   			}),
   		} as any

   		mockLogger = {
   			debug: jest.fn(),
   			info: jest.fn(),
   			warn: jest.fn(),
   			error: jest.fn(),
   		} as any

   		httpClient = new HttpClient(
   			{ baseUrl: 'https://api.test.com' } as any,
   			mockAuthManager,
   			mockLogger
   		)
   	})

   	it('should make successful GET request', async () => {
   		global.fetch = jest.fn().mockResolvedValue({
   			ok: true,
   			status: 200,
   			statusText: 'OK',
   			headers: new Headers(),
   			json: async () => ({ data: 'test' }),
   		})

   		const response = await httpClient.request('https://api.test.com/test', {
   			method: 'GET',
   		})

   		expect(response.status).toBe(200)
   		expect(response.data).toEqual({ data: 'test' })
   	})

   	it('should include auth headers', async () => {
   		global.fetch = jest.fn().mockResolvedValue({
   			ok: true,
   			status: 200,
   			headers: new Headers(),
   			json: async () => ({}),
   		})

   		await httpClient.request('https://api.test.com/test', {
   			method: 'GET',
   		})

   		expect(mockAuthManager.getAuthHeaders).toHaveBeenCalled()
   		const fetchCall = (global.fetch as jest.Mock).mock.calls[0]
   		const headers = fetchCall[1].headers as Headers
   		expect(headers.get('Authorization')).toBe('Bearer test-token')
   	})

   	it('should throw HttpError on failure', async () => {
   		global.fetch = jest.fn().mockResolvedValue({
   			ok: false,
   			status: 404,
   			statusText: 'Not Found',
   			headers: new Headers(),
   			clone: () => ({
   				json: async () => ({ error: 'Not found' }),
   			}),
   		})

   		await expect(
   			httpClient.request('https://api.test.com/test', { method: 'GET' })
   		).rejects.toThrow(HttpError)
   	})
   })
   ```

4. **Update all services to use new structure**
   - No changes needed - BaseResource interface remains the same
   - Internal implementation changed but API is compatible

**Acceptance Criteria:**

- [ ] HttpClient class created and tested
- [ ] BaseResource refactored to use HttpClient
- [ ] All existing tests still pass
- [ ] Code coverage maintained or improved
- [ ] BaseResource reduced from 1166 to <600 lines
- [ ] HttpClient is <400 lines
- [ ] Documentation updated

---

### Task 2.2: Implement Comprehensive Test Coverage

**Priority:** 🟠 High  
**Effort:** 1 week  
**Assignee:** Developer 3 (dedicated QA/Testing focus)  
**Files:** Multiple test files

**Implementation Steps:**

**Day 1-2: Set up coverage infrastructure**

1. **Configure coverage tracking**

   ```typescript
   // vitest.config.ts
   import { defineConfig } from 'vitest/config'

   export default defineConfig({
   	test: {
   		globals: true,
   		environment: 'node',
   		coverage: {
   			provider: 'v8',
   			reporter: ['text', 'json', 'html', 'lcov'],
   			exclude: [
   				'node_modules/',
   				'dist/',
   				'**/*.test.ts',
   				'**/*.spec.ts',
   				'**/examples/**',
   				'**/types/**',
   				'**/*.d.ts',
   			],
   			thresholds: {
   				lines: 80,
   				functions: 80,
   				branches: 75,
   				statements: 80,
   			},
   			all: true,
   			clean: true,
   		},
   		setupFiles: ['./src/__tests__/setup.ts'],
   	},
   })
   ```

2. **Add test setup file**

   ```typescript
   // src/__tests__/setup.ts
   import { afterAll, afterEach, beforeAll } from 'vitest'

   // Mock fetch globally
   global.fetch = jest.fn()

   // Mock localStorage
   const localStorageMock = {
   	getItem: jest.fn(),
   	setItem: jest.fn(),
   	removeItem: jest.fn(),
   	clear: jest.fn(),
   	length: 0,
   	key: jest.fn(),
   }
   global.localStorage = localStorageMock as any

   // Mock sessionStorage
   global.sessionStorage = localStorageMock as any

   // Reset mocks after each test
   afterEach(() => {
   	jest.clearAllMocks()
   })

   // Cleanup after all tests
   afterAll(() => {
   	jest.restoreAllMocks()
   })
   ```

**Day 3-4: Add missing unit tests**

3. **Infrastructure tests (target: 90% coverage)**

   ```typescript
   // src/__tests__/infrastructure/auth.comprehensive.test.ts

   describe('AuthManager - Comprehensive Tests', () => {
   	describe('Token Refresh', () => {
   		it('should refresh expired token automatically', async () => {
   			const authManager = new AuthManager({
   				type: 'bearer',
   				bearerToken: 'expired-token',
   				autoRefresh: true,
   				refreshEndpoint: 'https://api.test.com/refresh',
   			})

   			// Mock expired token
   			authManager.setTokenCache('expired-token', 'bearer', -1)

   			// Mock refresh endpoint
   			global.fetch = jest.fn().mockResolvedValue({
   				ok: true,
   				json: async () => ({
   					token: 'new-token',
   					expiresIn: 3600,
   				}),
   			})

   			const headers = await authManager.getAuthHeaders()

   			expect(headers.Authorization).toBe('Bearer new-token')
   			expect(global.fetch).toHaveBeenCalledWith(
   				'https://api.test.com/refresh',
   				expect.objectContaining({
   					method: 'POST',
   				})
   			)
   		})

   		it('should deduplicate concurrent refresh requests', async () => {
   			const authManager = new AuthManager({
   				type: 'bearer',
   				bearerToken: 'expired-token',
   				autoRefresh: true,
   				refreshEndpoint: 'https://api.test.com/refresh',
   			})

   			authManager.setTokenCache('expired-token', 'bearer', -1)

   			global.fetch = jest.fn().mockImplementation(
   				() =>
   					new Promise((resolve) =>
   						setTimeout(
   							() =>
   								resolve({
   									ok: true,
   									json: async () => ({ token: 'new-token', expiresIn: 3600 }),
   								}),
   							100
   						)
   					)
   			)

   			// Make 5 concurrent requests
   			const promises = Array(5)
   				.fill(null)
   				.map(() => authManager.getAuthHeaders())

   			await Promise.all(promises)

   			// Should only call refresh once
   			expect(global.fetch).toHaveBeenCalledTimes(1)
   		})
   	})

   	describe('Cookie Authentication', () => {
   		it('should handle browser cookies', async () => {
   			// Mock document.cookie
   			Object.defineProperty(document, 'cookie', {
   				writable: true,
   				value: 'session=abc123; user=john',
   			})

   			const authManager = new AuthManager({
   				type: 'cookie',
   				includeBrowserCookies: true,
   			})

   			const headers = await authManager.getAuthHeaders()

   			expect(headers.Cookie).toContain('session=abc123')
   			expect(headers.Cookie).toContain('user=john')
   		})
   	})

   	describe('Error Handling', () => {
   		it('should throw on missing credentials', async () => {
   			const authManager = new AuthManager({
   				type: 'apiKey',
   				// Missing apiKey
   			})

   			await expect(authManager.getAuthHeaders()).rejects.toThrow(AuthenticationError)
   		})
   	})
   })
   ```

4. **Service tests (target: 85% coverage)**

   ```typescript
   // src/__tests__/services/events.comprehensive.test.ts

   describe('EventsService - Comprehensive Tests', () => {
   	let service: EventsService
   	let mockConfig: AuditClientConfig
   	let mockLogger: Logger

   	beforeEach(() => {
   		mockConfig = createMockConfig()
   		mockLogger = createMockLogger()
   		service = new EventsService(mockConfig, mockLogger)
   	})

   	describe('create', () => {
   		it('should create audit event successfully', async () => {
   			const input: CreateAuditEventInput = {
   				action: 'user.login',
   				actor: { id: 'user-123', type: 'user' },
   				resource: { id: 'app-1', type: 'application' },
   			}

   			mockFetch({
   				status: 201,
   				data: { id: 'event-1', ...input },
   			})

   			const result = await service.create(input)

   			expect(result.id).toBe('event-1')
   			expect(result.action).toBe('user.login')
   		})

   		it('should validate input before sending', async () => {
   			const invalidInput = {
   				action: '', // Invalid: empty action
   				actor: { id: 'user-123', type: 'user' },
   				resource: { id: 'app-1', type: 'application' },
   			}

   			await expect(service.create(invalidInput as any)).rejects.toThrow(ValidationError)
   		})

   		it('should handle network errors', async () => {
   			const input: CreateAuditEventInput = {
   				action: 'user.login',
   				actor: { id: 'user-123', type: 'user' },
   				resource: { id: 'app-1', type: 'application' },
   			}

   			global.fetch = jest.fn().mockRejectedValue(new Error('Network error'))

   			await expect(service.create(input)).rejects.toThrow(NetworkError)
   		})

   		it('should retry on transient failures', async () => {
   			const input: CreateAuditEventInput = {
   				action: 'user.login',
   				actor: { id: 'user-123', type: 'user' },
   				resource: { id: 'app-1', type: 'application' },
   			}

   			let attempts = 0
   			global.fetch = jest.fn().mockImplementation(() => {
   				attempts++
   				if (attempts < 3) {
   					return Promise.resolve({
   						ok: false,
   						status: 503,
   						statusText: 'Service Unavailable',
   					})
   				}
   				return Promise.resolve({
   					ok: true,
   					status: 201,
   					json: async () => ({ id: 'event-1', ...input }),
   				})
   			})

   			const result = await service.create(input)

   			expect(result.id).toBe('event-1')
   			expect(attempts).toBe(3)
   		})
   	})

   	describe('query', () => {
   		it('should query with filters', async () => {
   			const params: QueryAuditEventsParams = {
   				action: 'user.login',
   				limit: 10,
   				offset: 0,
   			}

   			mockFetch({
   				status: 200,
   				data: {
   					data: [{ id: 'event-1', action: 'user.login' }],
   					total: 1,
   					limit: 10,
   					offset: 0,
   				},
   			})

   			const result = await service.query(params)

   			expect(result.data).toHaveLength(1)
   			expect(result.total).toBe(1)
   		})

   		it('should cache query results', async () => {
   			const params: QueryAuditEventsParams = {
   				action: 'user.login',
   				limit: 10,
   			}

   			mockFetch({
   				status: 200,
   				data: {
   					data: [{ id: 'event-1', action: 'user.login' }],
   					total: 1,
   					limit: 10,
   					offset: 0,
   				},
   			})

   			// First call
   			await service.query(params)

   			// Second call should use cache
   			await service.query(params)

   			// Fetch should only be called once
   			expect(global.fetch).toHaveBeenCalledTimes(1)
   		})
   	})

   	describe('subscribe', () => {
   		it('should create subscription', async () => {
   			const params: SubscriptionParams = {
   				filter: { action: 'user.login' },
   			}

   			const subscription = await service.subscribe(params)

   			expect(subscription).toBeDefined()
   			expect(subscription.id).toBeDefined()
   			expect(subscription.isConnected).toBe(false)
   		})

   		it('should handle subscription errors', async () => {
   			const params: SubscriptionParams = {
   				filter: { action: 'user.login' },
   			}

   			const subscription = await service.subscribe(params)

   			const errorHandler = jest.fn()
   			subscription.on('error', errorHandler)

   			// Simulate connection error
   			await subscription.connect().catch(() => {})

   			expect(errorHandler).toHaveBeenCalled()
   		})
   	})
   })
   ```

**Day 5: Add integration tests**

5. **Integration tests**

   ```typescript
   // src/__tests__/integration/client-lifecycle.test.ts

   describe('AuditClient - Integration Tests', () => {
   	let client: AuditClient
   	let mockServer: MockServer

   	beforeAll(async () => {
   		mockServer = await createMockServer({
   			port: 3001,
   			routes: {
   				'POST /api/v1/audit/events': (req, res) => {
   					res.status(201).json({
   						id: 'event-1',
   						...req.body,
   					})
   				},
   				'GET /api/v1/audit/events': (req, res) => {
   					res.status(200).json({
   						data: [],
   						total: 0,
   						limit: 10,
   						offset: 0,
   					})
   				},
   			},
   		})
   	})

   	afterAll(async () => {
   		await mockServer.close()
   		await client.destroy()
   	})

   	beforeEach(() => {
   		client = new AuditClient({
   			baseUrl: `http://localhost:3001`,
   			authentication: {
   				type: 'apiKey',
   				apiKey: 'test-key',
   			},
   		})
   	})

   	it('should complete full audit event lifecycle', async () => {
   		// Create event
   		const event = await client.events.create({
   			action: 'user.login',
   			actor: { id: 'user-123', type: 'user' },
   			resource: { id: 'app-1', type: 'application' },
   		})

   		expect(event.id).toBe('event-1')

   		// Query events
   		const results = await client.events.query({
   			action: 'user.login',
   			limit: 10,
   		})

   		expect(results).toBeDefined()

   		// Check health
   		const health = await client.health.check()
   		expect(health.status).toBeDefined()
   	})

   	it('should handle errors gracefully', async () => {
   		mockServer.setRoute('POST /api/v1/audit/events', (req, res) => {
   			res.status(500).json({ error: 'Internal server error' })
   		})

   		await expect(
   			client.events.create({
   				action: 'user.login',
   				actor: { id: 'user-123', type: 'user' },
   				resource: { id: 'app-1', type: 'application' },
   			})
   		).rejects.toThrow(HttpError)
   	})
   })
   ```

**Acceptance Criteria:**

- [ ] Overall test coverage > 80%
- [ ] Infrastructure coverage > 90%
- [ ] Services coverage > 85%
- [ ] Core coverage > 85%
- [ ] All edge cases covered
- [ ] Integration tests pass
- [ ] Coverage report generated
- [ ] CI/CD enforces coverage thresholds

**Scripts to add:**

```json
{
	"scripts": {
		"test": "vitest run",
		"test:watch": "vitest",
		"test:coverage": "vitest run --coverage",
		"test:coverage:ui": "vitest run --coverage --ui",
		"test:integration": "vitest run src/__tests__/integration",
		"test:unit": "vitest run src/__tests__ --exclude src/__tests__/integration"
	}
}
```

---

### Task 2.3: Add Performance Monitoring

**Priority:** 🟠 High  
**Effort:** 4 days  
**Assignee:** Developer 2  
**Files:** `src/infrastructure/performance-monitor.ts` (new), CI/CD configs

**Implementation Steps:**

**Day 1: Create performance monitoring infrastructure**

1. **Create PerformanceMonitor class**

   ```typescript
   // src/infrastructure/performance-monitor.ts

   export interface PerformanceBudget {
   	maxBundleSize: number // bytes (gzipped)
   	maxInitTime: number // ms
   	maxRequestTime: number // ms (p95)
   	maxMemoryUsage: number // bytes
   	maxCacheSize: number // entries
   }

   export interface PerformanceMetrics {
   	bundleSize: number
   	initTime: number
   	avgRequestTime: number
   	p95RequestTime: number
   	p99RequestTime: number
   	memoryUsage: number
   	cacheHitRate: number
   	errorRate: number
   }

   export interface BudgetViolation {
   	metric: string
   	actual: number
   	budget: number
   	severity: 'warning' | 'error'
   }

   export class PerformanceMonitor {
   	private metrics: Map<string, number[]> = new Map()
   	private budget: PerformanceBudget
   	private startTime: number = Date.now()

   	constructor(budget: PerformanceBudget) {
   		this.budget = budget
   	}

   	recordMetric(name: string, value: number): void {
   		if (!this.metrics.has(name)) {
   			this.metrics.set(name, [])
   		}
   		this.metrics.get(name)!.push(value)

   		// Keep only last 1000 measurements
   		const values = this.metrics.get(name)!
   		if (values.length > 1000) {
   			values.shift()
   		}
   	}

   	getMetrics(): PerformanceMetrics {
   		return {
   			bundleSize: this.getBundleSize(),
   			initTime: Date.now() - this.startTime,
   			avgRequestTime: this.getAverageMetric('requestTime'),
   			p95RequestTime: this.getPercentile('requestTime', 95),
   			p99RequestTime: this.getPercentile('requestTime', 99),
   			memoryUsage: this.getCurrentMemoryUsage(),
   			cacheHitRate: this.getCacheHitRate(),
   			errorRate: this.getErrorRate(),
   		}
   	}

   	checkBudget(): BudgetViolation[] {
   		const violations: BudgetViolation[] = []
   		const metrics = this.getMetrics()

   		// Check bundle size
   		if (metrics.bundleSize > this.budget.maxBundleSize) {
   			violations.push({
   				metric: 'bundleSize',
   				actual: metrics.bundleSize,
   				budget: this.budget.maxBundleSize,
   				severity: metrics.bundleSize > this.budget.maxBundleSize * 1.2 ? 'error' : 'warning',
   			})
   		}

   		// Check init time
   		if (metrics.initTime > this.budget.maxInitTime) {
   			violations.push({
   				metric: 'initTime',
   				actual: metrics.initTime,
   				budget: this.budget.maxInitTime,
   				severity: 'warning',
   			})
   		}

   		// Check p95 request time
   		if (metrics.p95RequestTime > this.budget.maxRequestTime) {
   			violations.push({
   				metric: 'p95RequestTime',
   				actual: metrics.p95RequestTime,
   				budget: this.budget.maxRequestTime,
   				severity:
   					metrics.p95RequestTime > this.budget.maxRequestTime * 1.5 ? 'error' : 'warning',
   			})
   		}

   		// Check memory usage
   		if (metrics.memoryUsage > this.budget.maxMemoryUsage) {
   			violations.push({
   				metric: 'memoryUsage',
   				actual: metrics.memoryUsage,
   				budget: this.budget.maxMemoryUsage,
   				severity: 'warning',
   			})
   		}

   		return violations
   	}

   	getReport(): PerformanceReport {
   		const metrics = this.getMetrics()
   		const violations = this.checkBudget()

   		return {
   			timestamp: new Date().toISOString(),
   			metrics,
   			violations,
   			passed: violations.filter((v) => v.severity === 'error').length === 0,
   			summary: this.generateSummary(metrics, violations),
   		}
   	}

   	private getAverageMetric(name: string): number {
   		const values = this.metrics.get(name) || []
   		if (values.length === 0) return 0
   		return values.reduce((a, b) => a + b, 0) / values.length
   	}

   	private getPercentile(name: string, percentile: number): number {
   		const values = [...(this.metrics.get(name) || [])].sort((a, b) => a - b)
   		if (values.length === 0) return 0

   		const index = Math.ceil((percentile / 100) * values.length) - 1
   		return values[index] || 0
   	}

   	private getBundleSize(): number {
   		// This would be set externally from build process
   		return this.metrics.get('bundleSize')?.[0] || 0
   	}

   	private getCurrentMemoryUsage(): number {
   		if (typeof process !== 'undefined' && process.memoryUsage) {
   			return process.memoryUsage().heapUsed
   		}
   		return 0
   	}

   	private getCacheHitRate(): number {
   		const hits = this.metrics.get('cacheHits')?.[0] || 0
   		const misses = this.metrics.get('cacheMisses')?.[0] || 0
   		const total = hits + misses
   		return total > 0 ? hits / total : 0
   	}

   	private getErrorRate(): number {
   		const errors = this.metrics.get('errors')?.[0] || 0
   		const total = this.metrics.get('requests')?.[0] || 0
   		return total > 0 ? errors / total : 0
   	}

   	private generateSummary(metrics: PerformanceMetrics, violations: BudgetViolation[]): string {
   		if (violations.length === 0) {
   			return '✅ All performance budgets met'
   		}

   		const errorCount = violations.filter((v) => v.severity === 'error').length
   		const warningCount = violations.filter((v) => v.severity === 'warning').length

   		return `⚠️ ${errorCount} errors, ${warningCount} warnings`
   	}

   	reset(): void {
   		this.metrics.clear()
   		this.startTime = Date.now()
   	}
   }
   ```

**Day 2: Integrate with existing code**

2. **Add to AuditClient**

   ```typescript
   // src/core/client.ts

   export class AuditClient {
   	private performanceMonitor: PerformanceMonitor

   	constructor(config: PartialAuditClientConfig) {
   		// ... existing code

   		// Initialize performance monitor
   		this.performanceMonitor = new PerformanceMonitor({
   			maxBundleSize: 200 * 1024, // 200KB gzipped
   			maxInitTime: 100, // 100ms
   			maxRequestTime: 1000, // 1s p95
   			maxMemoryUsage: 50 * 1024 * 1024, // 50MB
   			maxCacheSize: 1000,
   		})

   		// Record init time
   		this.performanceMonitor.recordMetric('initTime', Date.now() - startTime)
   	}

   	public getPerformanceReport(): PerformanceReport {
   		return this.performanceMonitor.getReport()
   	}

   	public checkPerformanceBudget(): BudgetViolation[] {
   		return this.performanceMonitor.checkBudget()
   	}
   }
   ```

3. **Add to BaseResource**

   ```typescript
   // src/core/base-resource.ts

   protected async request<T>(
     endpoint: string,
     options: RequestOptions = {}
   ): Promise<T> {
     const startTime = Date.now()

     try {
       const result = await this.executeRequest(endpoint, options)

       // Record request time
       const duration = Date.now() - startTime
       this.performanceManager.recordMetric('requestTime', duration)
       this.performanceManager.recordMetric('requests', 1)

       return result
     } catch (error) {
       // Record error
       this.performanceManager.recordMetric('errors', 1)
       throw error
     }
   }
   ```

**Day 3: Add CI/CD integration**

4. **Create performance test script**

   ```typescript
   // scripts/check-performance.ts

   import { readFileSync, statSync } from 'fs'
   import { gzipSync } from 'zlib'

   import { PerformanceMonitor } from '../src/infrastructure/performance-monitor'

   interface PerformanceCheckResult {
   	passed: boolean
   	violations: BudgetViolation[]
   	metrics: PerformanceMetrics
   }

   async function checkPerformance(): Promise<PerformanceCheckResult> {
   	const monitor = new PerformanceMonitor({
   		maxBundleSize: 200 * 1024, // 200KB
   		maxInitTime: 100,
   		maxRequestTime: 1000,
   		maxMemoryUsage: 50 * 1024 * 1024,
   		maxCacheSize: 1000,
   	})

   	// Check bundle size
   	const files = ['dist/index.js', 'dist/index.cjs']

   	for (const file of files) {
   		try {
   			const content = readFileSync(file)
   			const gzipped = gzipSync(content)
   			monitor.recordMetric('bundleSize', gzipped.length)

   			console.log(`📦 ${file}: ${gzipped.length} bytes (gzipped)`)
   		} catch (error) {
   			console.error(`❌ Failed to check ${file}:`, error)
   		}
   	}

   	// Get report
   	const report = monitor.getReport()

   	// Print results
   	console.log('\n📊 Performance Report:')
   	console.log('─'.repeat(50))
   	console.log(`Bundle Size: ${report.metrics.bundleSize} bytes`)
   	console.log(`Memory Usage: ${(report.metrics.memoryUsage / 1024 / 1024).toFixed(2)} MB`)

   	if (report.violations.length > 0) {
   		console.log('\n⚠️  Budget Violations:')
   		report.violations.forEach((v) => {
   			const icon = v.severity === 'error' ? '❌' : '⚠️'
   			console.log(`${icon} ${v.metric}: ${v.actual} > ${v.budget}`)
   		})
   	} else {
   		console.log('\n✅ All performance budgets met!')
   	}

   	return {
   		passed: report.passed,
   		violations: report.violations,
   		metrics: report.metrics,
   	}
   }

   // Run check
   checkPerformance()
   	.then((result) => {
   		if (!result.passed) {
   			console.error('\n❌ Performance check failed!')
   			process.exit(1)
   		}
   		console.log('\n✅ Performance check passed!')
   		process.exit(0)
   	})
   	.catch((error) => {
   		console.error('❌ Performance check error:', error)
   		process.exit(1)
   	})
   ```

5. **Add to CI/CD pipeline**

   ```yaml
   # .github/workflows/performance.yml
   name: Performance Check

   on:
     pull_request:
       branches: [main, develop]
     push:
       branches: [main]

   jobs:
     performance:
       runs-on: ubuntu-latest

       steps:
         - uses: actions/checkout@v3

         - name: Setup Node.js
           uses: actions/setup-node@v3
           with:
             node-version: '18'
             cache: 'pnpm'

         - name: Install pnpm
           uses: pnpm/action-setup@v2
           with:
             version: 8

         - name: Install dependencies
           run: pnpm install --frozen-lockfile

         - name: Build
           run: pnpm build

         - name: Check performance
           run: pnpm run check:performance

         - name: Upload performance report
           if: always()
           uses: actions/upload-artifact@v3
           with:
             name: performance-report
             path: performance-report.json

         - name: Comment PR with results
           if: github.event_name == 'pull_request'
           uses: actions/github-script@v6
           with:
             script: |
               const fs = require('fs')
               const report = JSON.parse(fs.readFileSync('performance-report.json', 'utf8'))

               const comment = `
               ## 📊 Performance Report

               **Bundle Size:** ${(report.metrics.bundleSize / 1024).toFixed(2)} KB (gzipped)
               **Status:** ${report.passed ? '✅ Passed' : '❌ Failed'}

               ${report.violations.length > 0 ? `
               ### ⚠️ Budget Violations
               ${report.violations.map(v => `- ${v.metric}: ${v.actual} > ${v.budget}`).join('\n')}
               ` : ''}
               `

               github.rest.issues.createComment({
                 issue_number: context.issue.number,
                 owner: context.repo.owner,
                 repo: context.repo.repo,
                 body: comment
               })
   ```

**Day 4: Add performance benchmarks**

6. **Create benchmark tests**

   ```typescript
   // src/__tests__/benchmarks/performance.bench.ts

   import { AuditClient } from '@/core/client'
   import { bench, describe } from 'vitest'

   describe('Performance Benchmarks', () => {
   	bench('client initialization', () => {
   		const client = new AuditClient({
   			baseUrl: 'https://api.test.com',
   			authentication: { type: 'apiKey', apiKey: 'test' },
   		})
   		client.destroy()
   	})

   	bench('cache operations', async () => {
   		const cache = new CacheManager({ enabled: true })

   		await cache.set('key1', 'value1')
   		await cache.get('key1')
   		await cache.delete('key1')
   	})

   	bench('request with cache hit', async () => {
   		const client = new AuditClient({
   			baseUrl: 'https://api.test.com',
   			authentication: { type: 'apiKey', apiKey: 'test' },
   			cache: { enabled: true },
   		})

   		// Prime cache
   		await client.events.query({ limit: 10 })

   		// Benchmark cached request
   		await client.events.query({ limit: 10 })

   		await client.destroy()
   	})
   })
   ```

**Acceptance Criteria:**

- [ ] PerformanceMonitor class implemented
- [ ] Integrated with AuditClient and BaseResource
- [ ] CI/CD pipeline checks performance
- [ ] Performance budgets enforced
- [ ] Benchmark tests added
- [ ] Performance report generated on PRs
- [ ] Documentation updated

**Scripts to add:**

```json
{
	"scripts": {
		"check:performance": "tsx scripts/check-performance.ts",
		"bench": "vitest bench",
		"bench:watch": "vitest bench --watch"
	}
}
```

---

### Task 2.4: Implement Lazy Loading for Plugins

**Priority:** 🟠 High  
**Effort:** 3 days  
**Assignee:** Developer 1  
**Files:** `src/core/client.ts`, `src/infrastructure/plugins/`

**Implementation Steps:**

**Day 1: Refactor plugin loading**

1. **Create plugin loader**

   ```typescript
   // src/infrastructure/plugins/plugin-loader.ts

   export interface PluginModule {
   	default: Plugin
   }

   export class PluginLoader {
   	private loadedPlugins: Map<string, Plugin> = new Map()
   	private loadingPromises: Map<string, Promise<Plugin>> = new Map()

   	async loadBuiltInPlugin(name: string): Promise<Plugin | null> {
   		// Check if already loaded
   		if (this.loadedPlugins.has(name)) {
   			return this.loadedPlugins.get(name)!
   		}

   		// Check if currently loading
   		if (this.loadingPromises.has(name)) {
   			return this.loadingPromises.get(name)!
   		}

   		// Start loading
   		const loadPromise = this.loadPlugin(name)
   		this.loadingPromises.set(name, loadPromise)

   		try {
   			const plugin = await loadPromise
   			this.loadedPlugins.set(name, plugin)
   			return plugin
   		} finally {
   			this.loadingPromises.delete(name)
   		}
   	}

   	private async loadPlugin(name: string): Promise<Plugin> {
   		switch (name) {
   			case 'request-logging':
   				const { RequestLoggingPlugin } = await import(
   					/* webpackChunkName: "plugin-request-logging" */
   					'./built-in/middleware/request-logging'
   				)
   				return new RequestLoggingPlugin()

   			case 'correlation-id':
   				const { CorrelationIdPlugin } = await import(
   					/* webpackChunkName: "plugin-correlation-id" */
   					'./built-in/middleware/correlation-id'
   				)
   				return new CorrelationIdPlugin()

   			case 'rate-limiting':
   				const { RateLimitingPlugin } = await import(
   					/* webpackChunkName: "plugin-rate-limiting" */
   					'./built-in/middleware/rate-limiting'
   				)
   				return new RateLimitingPlugin()

   			case 'redis-storage':
   				const { RedisStoragePlugin } = await import(
   					/* webpackChunkName: "plugin-redis-storage" */
   					'./built-in/storage/redis-storage'
   				)
   				return new RedisStoragePlugin()

   			case 'indexeddb-storage':
   				const { IndexedDBStoragePlugin } = await import(
   					/* webpackChunkName: "plugin-indexeddb-storage" */
   					'./built-in/storage/indexeddb-storage'
   				)
   				return new IndexedDBStoragePlugin()

   			case 'jwt-auth':
   				const { JWTAuthPlugin } = await import(
   					/* webpackChunkName: "plugin-jwt-auth" */
   					'./built-in/auth/jwt-auth'
   				)
   				return new JWTAuthPlugin()

   			case 'oauth2-auth':
   				const { OAuth2AuthPlugin } = await import(
   					/* webpackChunkName: "plugin-oauth2-auth" */
   					'./built-in/auth/oauth2-auth'
   				)
   				return new OAuth2AuthPlugin()

   			default:
   				throw new Error(`Unknown built-in plugin: ${name}`)
   		}
   	}

   	getLoadedPlugins(): Plugin[] {
   		return Array.from(this.loadedPlugins.values())
   	}

   	isLoaded(name: string): boolean {
   		return this.loadedPlugins.has(name)
   	}

   	clear(): void {
   		this.loadedPlugins.clear()
   		this.loadingPromises.clear()
   	}
   }
   ```

2. **Update AuditClient to use lazy loading**

   ```typescript
   // src/core/client.ts

   export class AuditClient {
   	private pluginLoader: PluginLoader
   	private _pluginManager?: PluginManager

   	constructor(config: PartialAuditClientConfig) {
   		// ... existing code

   		this.pluginLoader = new PluginLoader()

   		// Don't initialize plugins immediately
   		// They will be loaded on-demand
   	}

   	// Lazy getter for plugin manager
   	public get plugins(): PluginManager {
   		if (!this._pluginManager) {
   			this._pluginManager = new PluginManager(this.getLogger())
   			this._pluginManager.setClientConfig(this.config)
   		}
   		return this._pluginManager
   	}

   	// Load plugins on-demand
   	public async loadPlugin(name: string): Promise<void> {
   		const plugin = await this.pluginLoader.loadBuiltInPlugin(name)
   		if (plugin) {
   			await this.plugins.getRegistry().register(plugin, {})
   			this.getLogger().debug(`Plugin loaded: ${name}`)
   		}
   	}

   	// Load multiple plugins
   	public async loadPlugins(names: string[]): Promise<void> {
   		await Promise.all(names.map((name) => this.loadPlugin(name)))
   	}

   	// Auto-load plugins based on config (called manually or on first use)
   	public async initializePlugins(): Promise<void> {
   		if (!this.config.plugins.enabled || !this.config.plugins.autoLoad) {
   			return
   		}

   		const pluginsToLoad: string[] = []

   		// Collect middleware plugins
   		if (this.config.plugins.middleware.enabled) {
   			pluginsToLoad.push(...this.config.plugins.middleware.plugins)
   		}

   		// Collect storage plugins
   		if (this.config.plugins.storage.enabled) {
   			pluginsToLoad.push(...Object.keys(this.config.plugins.storage.plugins))
   		}

   		// Collect auth plugins
   		if (this.config.plugins.auth.enabled) {
   			pluginsToLoad.push(...Object.keys(this.config.plugins.auth.plugins))
   		}

   		// Load all plugins
   		await this.loadPlugins(pluginsToLoad)

   		this.getLogger().info('Plugins initialized', {
   			count: pluginsToLoad.length,
   			plugins: pluginsToLoad,
   		})
   	}
   }
   ```

**Day 2: Split plugin files**

3. **Reorganize plugin structure**

   ```
   src/infrastructure/plugins/
   ├── built-in/
   │   ├── middleware/
   │   │   ├── request-logging.ts
   │   │   ├── correlation-id.ts
   │   │   └── rate-limiting.ts
   │   ├── storage/
   │   │   ├── redis-storage.ts
   │   │   └── indexeddb-storage.ts
   │   └── auth/
   │       ├── jwt-auth.ts
   │       ├── oauth2-auth.ts
   │       └── custom-header-auth.ts
   ├── plugin-loader.ts
   ├── plugin-registry.ts
   └── index.ts
   ```

4. **Update exports to support tree-shaking**

   ```typescript
   // src/infrastructure/plugins/index.ts

   // Core plugin system (always included)
   export { PluginManager } from './plugin-manager'
   export { PluginRegistry } from './plugin-registry'
   export { PluginLoader } from './plugin-loader'
   export * from './types'
   export * from './errors'

   // Built-in plugins are NOT exported here
   // They are loaded dynamically via PluginLoader

   // For backwards compatibility, provide a factory that uses dynamic imports
   export const BuiltInPluginFactory = {
   	async createRequestLoggingPlugin() {
   		const { RequestLoggingPlugin } = await import('./built-in/middleware/request-logging')
   		return new RequestLoggingPlugin()
   	},

   	async createCorrelationIdPlugin() {
   		const { CorrelationIdPlugin } = await import('./built-in/middleware/correlation-id')
   		return new CorrelationIdPlugin()
   	},

   	// ... other factory methods
   }
   ```

**Day 3: Testing and optimization**

5. **Add tests for lazy loading**

   ```typescript
   // src/__tests__/infrastructure/plugin-loader.test.ts

   describe('PluginLoader', () => {
   	let loader: PluginLoader

   	beforeEach(() => {
   		loader = new PluginLoader()
   	})

   	it('should load plugin on demand', async () => {
   		expect(loader.isLoaded('request-logging')).toBe(false)

   		const plugin = await loader.loadBuiltInPlugin('request-logging')

   		expect(plugin).toBeDefined()
   		expect(loader.isLoaded('request-logging')).toBe(true)
   	})

   	it('should cache loaded plugins', async () => {
   		const plugin1 = await loader.loadBuiltInPlugin('request-logging')
   		const plugin2 = await loader.loadBuiltInPlugin('request-logging')

   		// Should return same instance
   		expect(plugin1).toBe(plugin2)
   	})

   	it('should handle concurrent loads', async () => {
   		const promises = Array(5)
   			.fill(null)
   			.map(() => loader.loadBuiltInPlugin('request-logging'))

   		const plugins = await Promise.all(promises)

   		// All should be the same instance
   		expect(new Set(plugins).size).toBe(1)
   	})

   	it('should throw on unknown plugin', async () => {
   		await expect(loader.loadBuiltInPlugin('unknown-plugin')).rejects.toThrow(
   			'Unknown built-in plugin'
   		)
   	})
   })
   ```

6. **Measure bundle size improvement**

   ```typescript
   // scripts/measure-bundle-impact.ts

   import { readFileSync, statSync } from 'fs'
   import { gzipSync } from 'zlib'

   function measureBundleSize(file: string): number {
   	const content = readFileSync(file)
   	return gzipSync(content).length
   }

   console.log('📦 Bundle Size Analysis:')
   console.log('─'.repeat(50))

   const mainBundle = measureBundleSize('dist/index.js')
   console.log(`Main bundle: ${(mainBundle / 1024).toFixed(2)} KB`)

   // Check if chunks were created
   const chunks = [
   	'dist/plugin-request-logging.js',
   	'dist/plugin-correlation-id.js',
   	'dist/plugin-rate-limiting.js',
   ]

   let totalChunkSize = 0
   chunks.forEach((chunk) => {
   	try {
   		const size = measureBundleSize(chunk)
   		totalChunkSize += size
   		console.log(`${chunk}: ${(size / 1024).toFixed(2)} KB`)
   	} catch {
   		// Chunk doesn't exist
   	}
   })

   console.log('─'.repeat(50))
   console.log(`Total (main + chunks): ${((mainBundle + totalChunkSize) / 1024).toFixed(2)} KB`)
   console.log(`Savings: ${(totalChunkSize / 1024).toFixed(2)} KB (lazy loaded)`)
   ```

**Acceptance Criteria:**

- [ ] PluginLoader implemented
- [ ] Plugins load on-demand
- [ ] Main bundle size reduced by 30-40%
- [ ] Plugin chunks created correctly
- [ ] Tests verify lazy loading works
- [ ] Backwards compatibility maintained
- [ ] Documentation updated

**Expected Results:**

- Main bundle: ~120-140 KB (down from ~200 KB)
- Plugin chunks: ~60-80 KB total (loaded on demand)
- Initial load time: ~30-40% faster

---

### Phase 2 Deliverables

**Code Changes:**

- [ ] HttpClient extracted from BaseResource
- [ ] BaseResource refactored and simplified
- [ ] Test coverage > 80%
- [ ] PerformanceMonitor implemented
- [ ] CI/CD performance checks added
- [ ] Lazy loading for plugins implemented
- [ ] Bundle size reduced by 30-40%

**Documentation:**

- [ ] Architecture documentation updated
- [ ] Performance monitoring guide
- [ ] Plugin loading guide
- [ ] Migration guide for breaking changes

**Validation:**

- [ ] All tests pass
- [ ] Coverage thresholds met
- [ ] Performance budgets enforced
- [ ] Bundle size targets met
- [ ] No regressions in functionality

---

## Phase 3: Testing & Documentation (Weeks 5-6)

**Goal:** Ensure quality and provide comprehensive documentation

**Team:** 2-3 developers  
**Duration:** 2 weeks  
**Risk Level:** Low

### Task 3.1: Expand Test Coverage to Edge Cases

**Priority:** 🟡 Medium  
**Effort:** 1 week  
**Assignee:** Developer 3

**Focus Areas:**

1. **Error Scenarios**
   - Network failures
   - Timeout handling
   - Malformed responses
   - Rate limiting
   - Circuit breaker scenarios

2. **Concurrency**
   - Parallel requests
   - Race conditions
   - Cache contention
   - Token refresh conflicts

3. **Edge Cases**
   - Empty responses
   - Large payloads
   - Special characters
   - Boundary values
   - Invalid configurations

4. **Browser Compatibility**
   - localStorage unavailable
   - Cookies disabled
   - Fetch API polyfills
   - WebSocket fallbacks

**Deliverables:**

- [ ] 50+ additional test cases
- [ ] Edge case documentation
- [ ] Test coverage report
- [ ] Known limitations documented

---

### Task 3.2: Create Comprehensive Documentation

**Priority:** 🟡 Medium  
**Effort:** 1 week  
**Assignee:** Developer 2 + Technical Writer

**Documentation Tasks:**

1. **API Reference (TypeDoc)**

   ```bash
   pnpm add -D typedoc typedoc-plugin-markdown
   pnpm run docs:generate
   ```

2. **Architecture Diagrams**
   - System architecture
   - Request flow
   - Plugin system
   - Error handling flow
   - Cache strategy

3. **Guides**
   - Getting Started (updated)
   - Migration Guide (v0.x to v1.0)
   - Performance Optimization
   - Security Best Practices
   - Troubleshooting Guide

4. **Examples**
   - Common use cases
   - Framework integrations
   - Custom plugins
   - Error handling patterns
   - Performance tuning

**Deliverables:**

- [ ] Generated API documentation
- [ ] 5+ architecture diagrams
- [ ] Updated guides
- [ ] 10+ code examples
- [ ] Video tutorials (optional)

---

## Phase 4: Performance & Polish (Weeks 7-8)

**Goal:** Optimize performance and polish the package

**Team:** 2 developers  
**Duration:** 2 weeks  
**Risk Level:** Low

### Task 4.1: Performance Optimizations

**Priority:** 🟢 Low  
**Effort:** 1 week  
**Assignee:** Developer 1

**Optimization Tasks:**

1. **Request Batching**
   - Implement request batching for bulk operations
   - Add batch window configuration
   - Test batch performance

2. **Connection Pooling**
   - Implement HTTP connection pooling
   - Configure pool size limits
   - Monitor pool utilization

3. **Compression**
   - Add request/response compression
   - Configure compression thresholds
   - Measure compression impact

4. **Memory Optimization**
   - Profile memory usage
   - Fix memory leaks
   - Optimize data structures

**Deliverables:**

- [ ] Request batching implemented
- [ ] Connection pooling added
- [ ] Compression enabled
- [ ] Memory usage optimized
- [ ] Performance benchmarks updated

---

### Task 4.2: Final Polish

**Priority:** 🟢 Low  
**Effort:** 1 week  
**Assignee:** Developer 2

**Polish Tasks:**

1. **Code Quality**
   - Run linter and fix issues
   - Format all code
   - Remove dead code
   - Update comments

2. **Error Messages**
   - Improve error messages
   - Add actionable suggestions
   - Standardize error format

3. **Logging**
   - Improve log messages
   - Add structured logging
   - Configure log levels

4. **Developer Experience**
   - Add helpful warnings
   - Improve TypeScript types
   - Add JSDoc examples
   - Create CLI tool (optional)

**Deliverables:**

- [ ] Code quality score > 9/10
- [ ] All linter issues fixed
- [ ] Error messages improved
- [ ] Logging enhanced
- [ ] Developer experience improved

---

## Success Metrics

### Code Quality Metrics

| Metric                | Current  | Target     | Status |
| --------------------- | -------- | ---------- | ------ |
| Test Coverage         | Unknown  | >80%       | 🎯     |
| Bundle Size (gzipped) | ~200KB   | <140KB     | 🎯     |
| Lines per File        | ~400 avg | <500 avg   | ✅     |
| Cyclomatic Complexity | Medium   | Low-Medium | ✅     |
| Code Duplication      | ~5%      | <3%        | 🎯     |
| TypeScript Strict     | ✅       | ✅         | ✅     |

### Performance Metrics

| Metric             | Current | Target  | Status |
| ------------------ | ------- | ------- | ------ |
| Init Time          | ~50ms   | <100ms  | ✅     |
| Request Time (p95) | Unknown | <1000ms | 🎯     |
| Memory Usage       | ~5-10MB | <50MB   | ✅     |
| Cache Hit Rate     | Unknown | >70%    | 🎯     |
| Error Rate         | Unknown | <1%     | 🎯     |

### Quality Metrics

| Metric                 | Current | Target | Status |
| ---------------------- | ------- | ------ | ------ |
| Critical Issues        | 3       | 0      | 🎯     |
| High Priority Issues   | 4       | 0      | 🎯     |
| Medium Priority Issues | 8       | <5     | 🎯     |
| Documentation Coverage | ~70%    | >90%   | 🎯     |
| API Stability          | Beta    | Stable | 🎯     |

---

## Risk Mitigation

### Technical Risks

**Risk 1: Breaking Changes**

- **Probability:** Medium
- **Impact:** High
- **Mitigation:**
  - Maintain backwards compatibility where possible
  - Provide migration guide
  - Use deprecation warnings
  - Version bump to 2.0 if needed

**Risk 2: Performance Regression**

- **Probability:** Low
- **Impact:** Medium
- **Mitigation:**
  - Continuous performance monitoring
  - Benchmark tests in CI/CD
  - Performance budgets enforced
  - Rollback plan ready

**Risk 3: Test Coverage Gaps**

- **Probability:** Medium
- **Impact:** Medium
- **Mitigation:**
  - Code review focus on tests
  - Coverage thresholds enforced
  - Manual testing for edge cases
  - Beta testing period

### Schedule Risks

**Risk 1: Scope Creep**

- **Probability:** Medium
- **Impact:** Medium
- **Mitigation:**
  - Strict scope definition
  - Change control process
  - Regular progress reviews
  - Defer non-critical items

**Risk 2: Resource Availability**

- **Probability:** Low
- **Impact:** High
- **Mitigation:**
  - Cross-training team members
  - Documentation of work
  - Flexible task assignment
  - Buffer time in schedule

---

## Timeline Summary

```
Week 1: Critical Fixes
├── Memory leaks (4h)
├── Cache limits (6h)
└── Circuit breaker persistence (8h)

Weeks 2-4: High Priority Improvements
├── Week 2: BaseResource refactoring (3d)
├── Week 3: Test coverage (5d)
└── Week 4: Performance monitoring (4d) + Lazy loading (3d)

Weeks 5-6: Testing & Documentation
├── Week 5: Edge case testing (5d)
└── Week 6: Documentation (5d)

Weeks 7-8: Performance & Polish
├── Week 7: Performance optimizations (5d)
└── Week 8: Final polish (5d)
```

---

## Rollout Plan

### Phase 1: Internal Testing (Week 7)

- Deploy to staging environment
- Internal team testing
- Performance validation
- Bug fixes

### Phase 2: Beta Release (Week 8)

- Release v1.1.0-beta.1
- Selected external testers
- Gather feedback
- Address critical issues

### Phase 3: Release Candidate (Week 9)

- Release v1.1.0-rc.1
- Wider beta testing
- Final bug fixes
- Documentation review

### Phase 4: Production Release (Week 10)

- Release v1.1.0
- Announcement
- Migration support
- Monitor for issues

---

## Post-Implementation

### Monitoring

1. **Performance Monitoring**
   - Track bundle size trends
   - Monitor request times
   - Watch memory usage
   - Alert on budget violations

2. **Error Tracking**
   - Monitor error rates
   - Track error types
   - Identify patterns
   - Fix critical issues

3. **Usage Analytics**
   - Track feature adoption
   - Monitor API usage
   - Identify bottlenecks
   - Plan improvements

### Maintenance

1. **Regular Updates**
   - Security patches
   - Dependency updates
   - Bug fixes
   - Performance improvements

2. **Community Support**
   - Issue triage
   - PR reviews
   - Documentation updates
   - Example updates

3. **Continuous Improvement**
   - Quarterly reviews
   - Performance audits
   - Security audits
   - Feature planning

---

## Conclusion

This implementation plan provides a structured approach to addressing the priority improvements identified in the code quality analysis. By following this plan over 6-8 weeks, the `@smedrec/audit-client` package will achieve:

✅ Zero critical issues  
✅ >80% test coverage  
✅ 30-40% smaller bundle size  
✅ Comprehensive documentation  
✅ Production-ready quality

The phased approach allows for incremental progress, continuous validation, and risk mitigation. Each phase builds on the previous one, ensuring a solid foundation before moving forward.

**Next Steps:**

1. Review and approve this plan
2. Assign team members
3. Set up project tracking
4. Begin Phase 1 implementation
5. Schedule weekly progress reviews

---

**Document Version:** 1.0  
**Last Updated:** November 14, 2025  
**Status:** Ready for Review
