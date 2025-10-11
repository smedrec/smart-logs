/**
 * Storage provider factory for creating providers by type
 */
import { createAzureStorageProvider } from './azure-provider.js'
import { createGCPStorageProvider } from './gcp-provider.js'
import { createLocalStorageProvider } from './local-provider.js'
import { createS3StorageProvider } from './s3-provider.js'

import type { IStorageProvider, StorageProvider } from '../storage-handler.js'

/**
 * Storage providers for multi-cloud support
 * Requirements 1.1, 10.2, 10.4: Multi-cloud storage provider exports
 */

export { S3StorageProvider, createS3StorageProvider } from './s3-provider.js'
export { AzureStorageProvider, createAzureStorageProvider } from './azure-provider.js'
export { GCPStorageProvider, createGCPStorageProvider } from './gcp-provider.js'
export { LocalStorageProvider, createLocalStorageProvider } from './local-provider.js'

/**
 * Create a storage provider by type
 * Requirements 1.1, 10.2, 10.4: Storage provider selection and configuration
 */
export function createStorageProvider(provider: StorageProvider): IStorageProvider {
	switch (provider) {
		case 's3':
			return createS3StorageProvider()
		case 'azure':
			return createAzureStorageProvider()
		case 'gcp':
			return createGCPStorageProvider()
		case 'local':
			return createLocalStorageProvider()
		default:
			throw new Error(`Unsupported storage provider: ${provider}`)
	}
}

/**
 * Get all available storage providers
 */
export function getAvailableProviders(): StorageProvider[] {
	return ['s3', 'azure', 'gcp', 'local']
}

/**
 * Storage provider registry for dynamic provider management
 */
export class StorageProviderRegistry {
	private providers = new Map<StorageProvider, () => IStorageProvider>()

	constructor() {
		// Register default providers
		this.register('s3', createS3StorageProvider)
		this.register('azure', createAzureStorageProvider)
		this.register('gcp', createGCPStorageProvider)
		this.register('local', createLocalStorageProvider)
	}

	/**
	 * Register a storage provider factory
	 */
	register(provider: StorageProvider, factory: () => IStorageProvider): void {
		this.providers.set(provider, factory)
	}

	/**
	 * Create a provider instance
	 */
	create(provider: StorageProvider): IStorageProvider {
		const factory = this.providers.get(provider)
		if (!factory) {
			throw new Error(`Storage provider '${provider}' not registered`)
		}
		return factory()
	}

	/**
	 * Check if a provider is registered
	 */
	has(provider: StorageProvider): boolean {
		return this.providers.has(provider)
	}

	/**
	 * Get all registered provider types
	 */
	getRegisteredProviders(): StorageProvider[] {
		return Array.from(this.providers.keys())
	}
}

/**
 * Default storage provider registry instance
 */
export const defaultStorageProviderRegistry = new StorageProviderRegistry()
