/**
 * Destination Manager - Handles destination CRUD operations and validation
 * Requirements 1.1, 1.2, 1.3, 1.4, 3.4, 3.5: Destination management with validation and health monitoring
 */

import { StructuredLogger } from '@repo/logs'

import { ConnectionTester } from './validation/connection-tester.js'
import { DestinationValidator } from './validation/destination-validator.js'

import type { DeliveryDatabaseClient } from './database-client.js'
import type {
	ConnectionTestResult,
	CreateDeliveryDestinationInput,
	DeliveryDestination,
	DeliveryDestinationListOptions,
	DeliveryDestinationListResponse,
	DestinationConfig,
	DestinationHealth,
	DestinationType,
	UpdateDeliveryDestinationInput,
	ValidationResult,
} from './types.js'

/**
 * Interface for destination management operations
 */
export interface IDestinationManager {
	// CRUD operations
	createDestination(input: CreateDeliveryDestinationInput): Promise<DeliveryDestination>
	updateDestination(id: string, input: UpdateDeliveryDestinationInput): Promise<DeliveryDestination>
	deleteDestination(id: string): Promise<void>
	getDestination(id: string): Promise<DeliveryDestination | null>
	listDestinations(
		options: DeliveryDestinationListOptions
	): Promise<DeliveryDestinationListResponse>

	// Validation and testing
	validateDestination(destination: DeliveryDestination): Promise<ValidationResult>
	testConnection(destination: DeliveryDestination): Promise<ConnectionTestResult>

	// Health monitoring
	getDestinationHealth(destinationId: string): Promise<DestinationHealth | null>
	updateDestinationHealth(destinationId: string, health: Partial<DestinationHealth>): Promise<void>

	// Safety operations
	disableDestination(id: string, reason: string, disabledBy?: string): Promise<void>
	enableDestination(id: string): Promise<void>
}

/**
 * Destination Manager implementation
 */
export class DestinationManager implements IDestinationManager {
	private readonly logger: StructuredLogger
	private readonly validator: DestinationValidator
	private readonly connectionTester: ConnectionTester

	constructor(private readonly dbClient: DeliveryDatabaseClient) {
		this.logger = new StructuredLogger({
			service: '@repo/audit - DestinationManager',
			environment: process.env.NODE_ENV || 'development',
			console: {
				name: 'console',
				enabled: true,
				format: 'pretty',
				colorize: true,
				level: 'info',
			},
		})

		this.validator = new DestinationValidator()
		this.connectionTester = new ConnectionTester()
	}

	/**
	 * Create a new delivery destination with validation
	 * Requirements 1.1, 1.2: Destination creation with configuration validation
	 */
	async createDestination(input: CreateDeliveryDestinationInput): Promise<DeliveryDestination> {
		this.logger.info('Creating new delivery destination', {
			organizationId: input.organizationId,
			type: input.type,
			label: input.label,
		})

		try {
			// Validate the destination configuration
			const validationResult = await this.validator.validateDestinationConfig(
				input.type,
				input.config
			)

			if (!validationResult.isValid) {
				const error = new Error(
					`Destination validation failed: ${validationResult.errors.join(', ')}`
				)
				this.logger.error('Destination validation failed', {
					organizationId: input.organizationId,
					type: input.type,
					errors: validationResult.errors.join(', '),
				})
				throw error
			}

			// Create the destination in the database
			const destination = await this.dbClient.destinations.create(input)

			// Test the connection if the destination is not disabled
			if (!destination.disabled) {
				try {
					const connectionResult = await this.connectionTester.testConnection(destination)
					if (!connectionResult.success) {
						this.logger.warn('Connection test failed for new destination', {
							destinationId: destination.id,
							error: connectionResult.error,
						})
						// Don't fail creation, but log the warning
					}
				} catch (error) {
					this.logger.warn('Connection test error for new destination', {
						destinationId: destination.id,
						error: error instanceof Error ? error.message : 'Unknown error',
					})
				}
			}

			this.logger.info('Successfully created delivery destination', {
				destinationId: destination.id,
				organizationId: destination.organizationId,
				type: destination.type,
			})

			return destination
		} catch (error) {
			this.logger.error('Failed to create delivery destination', {
				organizationId: input.organizationId,
				type: input.type,
				error: error instanceof Error ? error.message : 'Unknown error',
			})
			throw error
		}
	}

	/**
	 * Update an existing delivery destination with partial updates
	 * Requirements 1.1, 1.2, 1.4: Destination update operations with validation
	 */
	async updateDestination(
		id: string,
		input: UpdateDeliveryDestinationInput
	): Promise<DeliveryDestination> {
		this.logger.info('Updating delivery destination', { destinationId: id })

		try {
			// Get the existing destination
			const existingDestination = await this.dbClient.destinations.findById(id)
			if (!existingDestination) {
				throw new Error(`Destination with id ${id} not found`)
			}

			// If config is being updated, validate it
			if (input.config) {
				const validationResult = await this.validator.validateDestinationConfig(
					existingDestination.type,
					input.config
				)

				if (!validationResult.isValid) {
					const error = new Error(
						`Destination validation failed: ${validationResult.errors.join(', ')}`
					)
					this.logger.error('Destination update validation failed', {
						destinationId: id,
						errors: validationResult.errors.join(', '),
					})
					throw error
				}
			}

			// Update the destination
			const updatedDestination = await this.dbClient.destinations.update(id, input)

			// Test connection if config was updated and destination is not disabled
			if (input.config && !updatedDestination.disabled) {
				try {
					const connectionResult = await this.connectionTester.testConnection(updatedDestination)
					if (!connectionResult.success) {
						this.logger.warn('Connection test failed for updated destination', {
							destinationId: id,
							error: connectionResult.error,
						})
					}
				} catch (error) {
					this.logger.warn('Connection test error for updated destination', {
						destinationId: id,
						error: error instanceof Error ? error.message : 'Unknown error',
					})
				}
			}

			this.logger.info('Successfully updated delivery destination', {
				destinationId: id,
				organizationId: updatedDestination.organizationId,
			})

			return updatedDestination
		} catch (error) {
			this.logger.error('Failed to update delivery destination', {
				destinationId: id,
				error: error instanceof Error ? error.message : 'Unknown error',
			})
			throw error
		}
	}

	/**
	 * Delete a delivery destination with safety checks
	 * Requirements 1.1, 1.4: Destination deletion with safety checks
	 */
	async deleteDestination(id: string): Promise<void> {
		this.logger.info('Deleting delivery destination', { destinationId: id })

		try {
			// Check if destination exists
			const destination = await this.dbClient.destinations.findById(id)
			if (!destination) {
				throw new Error(`Destination with id ${id} not found`)
			}

			// Safety check: Verify no active deliveries are pending for this destination
			// This would be implemented when delivery queue is available
			// For now, we'll just log a warning
			this.logger.warn('Deleting destination - ensure no active deliveries are pending', {
				destinationId: id,
				organizationId: destination.organizationId,
			})

			// Delete the destination
			await this.dbClient.destinations.delete(id)

			this.logger.info('Successfully deleted delivery destination', {
				destinationId: id,
				organizationId: destination.organizationId,
			})
		} catch (error) {
			this.logger.error('Failed to delete delivery destination', {
				destinationId: id,
				error: error instanceof Error ? error.message : 'Unknown error',
			})
			throw error
		}
	}

	/**
	 * Get a delivery destination by ID
	 * Requirements 1.1: Basic destination retrieval
	 */
	async getDestination(id: string): Promise<DeliveryDestination | null> {
		try {
			return await this.dbClient.destinations.findById(id)
		} catch (error) {
			this.logger.error('Failed to get delivery destination', {
				destinationId: id,
				error: error instanceof Error ? error.message : 'Unknown error',
			})
			throw error
		}
	}

	/**
	 * List delivery destinations with filtering and pagination
	 * Requirements 1.1, 1.4: Destination listing with filtering and pagination
	 */
	async listDestinations(
		options: DeliveryDestinationListOptions
	): Promise<DeliveryDestinationListResponse> {
		try {
			this.logger.debug('Listing delivery destinations', { options: JSON.stringify(options) })
			return await this.dbClient.destinations.list(options)
		} catch (error) {
			this.logger.error('Failed to list delivery destinations', {
				error:
					error instanceof Error
						? { name: error.name, message: error.message, stack: error.stack }
						: 'Unknown error',
				options: JSON.stringify(options),
			})
			throw error
		}
	}

	/**
	 * Validate a destination configuration
	 * Requirements 1.2, 1.3, 1.4: Configuration validation
	 */
	async validateDestination(destination: DeliveryDestination): Promise<ValidationResult> {
		try {
			return await this.validator.validateDestinationConfig(destination.type, destination.config)
		} catch (error) {
			this.logger.error('Failed to validate destination', {
				destinationId: destination.id,
				error: error instanceof Error ? error.message : 'Unknown error',
			})
			return {
				isValid: false,
				errors: [`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`],
				warnings: [],
			}
		}
	}

	/**
	 * Test connection to a destination
	 * Requirements 1.2, 1.3, 1.4: Connection testing and validation
	 */
	async testConnection(destination: DeliveryDestination): Promise<ConnectionTestResult> {
		try {
			this.logger.info('Testing connection to destination', {
				destinationId: destination.id,
				type: destination.type,
			})

			const result = await this.connectionTester.testConnection(destination)

			this.logger.info('Connection test completed', {
				destinationId: destination.id,
				success: result.success,
				responseTime: result.responseTime,
			})

			return result
		} catch (error) {
			this.logger.error('Connection test failed', {
				destinationId: destination.id,
				error: error instanceof Error ? error.message : 'Unknown error',
			})

			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error',
			}
		}
	}

	/**
	 * Get destination health status
	 * Requirements 3.4, 3.5: Health monitoring and status tracking
	 */
	async getDestinationHealth(destinationId: string): Promise<DestinationHealth | null> {
		try {
			return await this.dbClient.health.findByDestinationId(destinationId)
		} catch (error) {
			this.logger.error('Failed to get destination health', {
				destinationId,
				error: error instanceof Error ? error.message : 'Unknown error',
			})
			throw error
		}
	}

	/**
	 * Update destination health status
	 * Requirements 3.4, 3.5: Health monitoring and status updates
	 */
	async updateDestinationHealth(
		destinationId: string,
		health: Partial<DestinationHealth>
	): Promise<void> {
		try {
			await this.dbClient.health.upsert(destinationId, health)
			this.logger.debug('Updated destination health', { destinationId, health })
		} catch (error) {
			this.logger.error('Failed to update destination health', {
				destinationId,
				error: error instanceof Error ? error.message : 'Unknown error',
			})
			throw error
		}
	}

	/**
	 * Disable a destination with reason
	 * Requirements 3.4, 3.5: Automatic destination disabling
	 */
	async disableDestination(id: string, reason: string, disabledBy?: string): Promise<void> {
		try {
			await this.dbClient.destinations.setDisabled(id, true, reason, disabledBy)
			this.logger.info('Disabled destination', { destinationId: id, reason, disabledBy })
		} catch (error) {
			this.logger.error('Failed to disable destination', {
				destinationId: id,
				error: error instanceof Error ? error.message : 'Unknown error',
			})
			throw error
		}
	}

	/**
	 * Enable a destination
	 * Requirements 3.4, 3.5: Manual destination re-enabling
	 */
	async enableDestination(id: string): Promise<void> {
		try {
			await this.dbClient.destinations.setDisabled(id, false)
			this.logger.info('Enabled destination', { destinationId: id })
		} catch (error) {
			this.logger.error('Failed to enable destination', {
				destinationId: id,
				error: error instanceof Error ? error.message : 'Unknown error',
			})
			throw error
		}
	}
}

/**
 * Factory function for creating destination manager
 */
export function createDestinationManager(dbClient: DeliveryDatabaseClient): DestinationManager {
	return new DestinationManager(dbClient)
}
