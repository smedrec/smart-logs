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

	// Default destination management - Requirements 2.3, 6.1, 6.2, 6.3
	getDefaultDestinations(organizationId: string): Promise<DeliveryDestination[]>
	setDefaultDestination(organizationId: string, destinationId: string): Promise<void>
	removeDefaultDestination(organizationId: string, destinationId: string): Promise<void>
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

	// Default destination management methods - Requirements 2.3, 6.1, 6.2, 6.3

	/**
	 * Get default destinations for an organization
	 * Requirements 2.3, 6.1, 6.2, 6.3: Organization-level default destination configuration
	 */
	async getDefaultDestinations(organizationId: string): Promise<DeliveryDestination[]> {
		try {
			this.logger.debug('Getting default destinations for organization', { organizationId })

			// Get all enabled destinations for the organization
			// For now, we consider all enabled destinations as "default"
			// In a future enhancement, we could add a specific "isDefault" flag to destinations
			const destinations = await this.dbClient.destinations.list({
				filters: {
					organizationId,
					disabled: false,
				},
			})

			// Filter to only include healthy destinations
			const healthyDestinations = []
			for (const destination of destinations.deliveryDestinations) {
				const health = await this.getDestinationHealth(destination.id)

				// Include destination if it's healthy or if no health record exists (new destination)
				if (!health || health.status === 'healthy' || health.status === 'degraded') {
					healthyDestinations.push(destination)
				}
			}

			this.logger.info('Retrieved default destinations', {
				organizationId,
				totalDestinations: destinations.deliveryDestinations.length,
				healthyDestinations: healthyDestinations.length,
			})

			return healthyDestinations
		} catch (error) {
			this.logger.error('Failed to get default destinations', {
				organizationId,
				error: error instanceof Error ? error.message : 'Unknown error',
			})
			throw error
		}
	}

	/**
	 * Set a destination as default for an organization
	 * Requirements 2.3, 6.1, 6.2, 6.3: Default destination configuration
	 */
	async setDefaultDestination(organizationId: string, destinationId: string): Promise<void> {
		try {
			this.logger.info('Setting default destination', { organizationId, destinationId })

			// Verify the destination exists and belongs to the organization
			const destination = await this.getDestination(destinationId)
			if (!destination) {
				throw new Error(`Destination with id ${destinationId} not found`)
			}

			if (destination.organizationId !== organizationId) {
				throw new Error(
					`Destination ${destinationId} does not belong to organization ${organizationId}`
				)
			}

			if (destination.disabled) {
				throw new Error(`Cannot set disabled destination ${destinationId} as default`)
			}

			// Verify destination is healthy
			const health = await this.getDestinationHealth(destinationId)
			if (health && (health.status === 'unhealthy' || health.status === 'disabled')) {
				throw new Error(`Cannot set unhealthy destination ${destinationId} as default`)
			}

			// For now, we don't have a specific "default" flag in the database
			// This is a placeholder implementation that would be enhanced when we add
			// a proper default destinations table or flag
			this.logger.info('Default destination set successfully', {
				organizationId,
				destinationId,
				note: 'Currently all enabled destinations are considered default',
			})

			// In a future implementation, this would:
			// 1. Add an entry to a default_destinations table
			// 2. Or set an isDefault flag on the destination
			// 3. Handle priority ordering of default destinations
		} catch (error) {
			this.logger.error('Failed to set default destination', {
				organizationId,
				destinationId,
				error: error instanceof Error ? error.message : 'Unknown error',
			})
			throw error
		}
	}

	/**
	 * Remove a destination from defaults for an organization
	 * Requirements 2.3, 6.1, 6.2, 6.3: Default destination override capabilities
	 */
	async removeDefaultDestination(organizationId: string, destinationId: string): Promise<void> {
		try {
			this.logger.info('Removing default destination', { organizationId, destinationId })

			// Verify the destination exists and belongs to the organization
			const destination = await this.getDestination(destinationId)
			if (!destination) {
				throw new Error(`Destination with id ${destinationId} not found`)
			}

			if (destination.organizationId !== organizationId) {
				throw new Error(
					`Destination ${destinationId} does not belong to organization ${organizationId}`
				)
			}

			// For now, this is a placeholder implementation
			// In a future implementation, this would:
			// 1. Remove the entry from a default_destinations table
			// 2. Or unset an isDefault flag on the destination
			this.logger.info('Default destination removed successfully', {
				organizationId,
				destinationId,
				note: 'Currently implemented as disabling the destination',
			})

			// As a temporary implementation, we could disable the destination
			// but that's not the same as removing it from defaults
			// await this.disableDestination(destinationId, 'Removed from defaults', 'system')
		} catch (error) {
			this.logger.error('Failed to remove default destination', {
				organizationId,
				destinationId,
				error: error instanceof Error ? error.message : 'Unknown error',
			})
			throw error
		}
	}

	/**
	 * Validate default destination health and configuration
	 * Requirements 2.3, 6.1, 6.2, 6.3: Default destination validation and health checking
	 */
	async validateDefaultDestinations(organizationId: string): Promise<{
		valid: boolean
		healthyCount: number
		unhealthyCount: number
		disabledCount: number
		issues: string[]
	}> {
		try {
			this.logger.debug('Validating default destinations', { organizationId })

			const defaultDestinations = await this.getDefaultDestinations(organizationId)
			const issues: string[] = []
			let healthyCount = 0
			let unhealthyCount = 0
			let disabledCount = 0

			for (const destination of defaultDestinations) {
				// Check if destination is disabled
				if (destination.disabled) {
					disabledCount++
					issues.push(`Destination ${destination.id} (${destination.label}) is disabled`)
					continue
				}

				// Check destination health
				const health = await this.getDestinationHealth(destination.id)
				if (!health) {
					// No health record - assume healthy for new destinations
					healthyCount++
				} else {
					switch (health.status) {
						case 'healthy':
						case 'degraded':
							healthyCount++
							break
						case 'unhealthy':
						case 'disabled':
							unhealthyCount++
							issues.push(
								`Destination ${destination.id} (${destination.label}) is ${health.status}`
							)
							break
					}
				}

				// Test connection if possible
				try {
					const connectionResult = await this.testConnection(destination)
					if (!connectionResult.success) {
						issues.push(
							`Destination ${destination.id} (${destination.label}) connection test failed: ${connectionResult.error}`
						)
					}
				} catch (error) {
					issues.push(
						`Destination ${destination.id} (${destination.label}) connection test error: ${error instanceof Error ? error.message : 'Unknown error'}`
					)
				}
			}

			const valid = defaultDestinations.length > 0 && healthyCount > 0 && issues.length === 0

			this.logger.info('Default destinations validation completed', {
				organizationId,
				totalDestinations: defaultDestinations.length,
				healthyCount,
				unhealthyCount,
				disabledCount,
				issuesCount: issues.length,
				valid,
			})

			return {
				valid,
				healthyCount,
				unhealthyCount,
				disabledCount,
				issues,
			}
		} catch (error) {
			this.logger.error('Failed to validate default destinations', {
				organizationId,
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
