import { describe, expect, it } from 'vitest'

import { BaseResource } from '../core/base-resource'
import { AuditClient } from '../core/client'
import { ConfigManager } from '../core/config'

describe('Project Structure', () => {
	it('should export main classes', () => {
		expect(AuditClient).toBeDefined()
		expect(ConfigManager).toBeDefined()
		expect(BaseResource).toBeDefined()
	})

	it('should create AuditClient instance', () => {
		const client = new AuditClient({
			baseUrl: 'https://test.com',
			apiVersion: 'v1',
			timeout: 5000,
			authentication: {
				type: 'apiKey',
				autoRefresh: true,
				apiKey: 'test-key',
			},
		})
		expect(client).toBeInstanceOf(AuditClient)
	})

	it('should create ConfigManager instance', () => {
		const config = new ConfigManager({
			baseUrl: 'https://test.com',
			authentication: {
				type: 'apiKey',
				autoRefresh: true,
				apiKey: 'test-key',
			},
		})
		expect(config).toBeInstanceOf(ConfigManager)
	})
})
