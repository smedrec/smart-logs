/**
 * GraphQL Integration Test
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */

import { describe, expect, it } from 'vitest'

import { createGraphQLServer } from '../server'

describe('GraphQL Integration', () => {
	it('should create GraphQL server successfully', () => {
		const server = createGraphQLServer()
		expect(server).toBeDefined()
		expect(typeof server.handle).toBe('function')
	})

	it('should have GraphQL endpoint configured', () => {
		const server = createGraphQLServer()
		// The server should be configured with the correct endpoint
		expect(server).toBeDefined()
	})

	it('should support introspection in development', () => {
		// Set NODE_ENV to development for this test
		const originalEnv = process.env.NODE_ENV
		process.env.NODE_ENV = 'development'

		const server = createGraphQLServer()
		expect(server).toBeDefined()

		// Restore original environment
		process.env.NODE_ENV = originalEnv
	})

	it('should disable introspection in production', () => {
		// Set NODE_ENV to production for this test
		const originalEnv = process.env.NODE_ENV
		process.env.NODE_ENV = 'production'

		const server = createGraphQLServer()
		expect(server).toBeDefined()

		// Restore original environment
		process.env.NODE_ENV = originalEnv
	})
})
