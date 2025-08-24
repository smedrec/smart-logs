/**
 * GraphQL Server Setup with GraphQL Yoga
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */

import { makeExecutableSchema } from '@graphql-tools/schema'
import { createYoga } from 'graphql-yoga'

import { logger } from '@repo/hono-helpers/dist/helpers/logger'

import { resolvers } from './resolvers/index'
import { typeDefs } from './schema'

import type { Context } from 'hono'
import type { GraphQLContext } from './types'

/**
 * Create GraphQL schema
 */
const schema = makeExecutableSchema({
	typeDefs,
	resolvers,
})

/**
 * Create GraphQL Yoga server instance
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */
export const createGraphQLServer = () => {
	return createYoga<Context>({
		schema,

		// Context creation function
		context: async ({ request, ...rest }): Promise<GraphQLContext> => {
			// Extract Hono context from the request
			const honoContext = (rest as any).context || (request as any).context

			if (!honoContext) {
				throw new Error('Hono context not available in GraphQL context')
			}

			const session = honoContext.get('session')
			const services = honoContext.get('services')

			// Create GraphQL context from Hono context
			const graphqlContext: GraphQLContext = {
				services,
				session,
				requestId: honoContext.get('requestId'),
				isAuthenticated: !!session,
				isApiKeyAuth: honoContext.get('isApiKeyAuth') || false,
			}

			return graphqlContext
		},

		// GraphQL endpoint configuration
		graphqlEndpoint: '/graphql',

		// Enable GraphQL Playground in development
		graphiql: process.env.NODE_ENV !== 'production',

		// CORS configuration (handled by Hono middleware)
		cors: false,

		// Health check endpoint
		healthCheckEndpoint: '/graphql/health',

		// Logging configuration
		logging: {
			debug(...args) {
				logger.debug(...args)
			},
			info(...args) {
				logger.info(...args)
			},
			warn(...args) {
				logger.warn(...args)
			},
			error(...args) {
				logger.error(...args)
			},
		},

		// Error masking for production
		maskedErrors:
			process.env.NODE_ENV === 'production'
				? {
						maskError(error, message, isDev) {
							// In production, mask internal errors but keep GraphQL errors
							if (error.extensions?.code) {
								return error
							}

							// Log the original error for debugging
							console.error('GraphQL Error:', error)

							// Return a generic error message
							return new Error('Internal server error')
						},
					}
				: false,

		// Subscription configuration for real-time features
		subscriptions: {
			// Enable subscriptions
			enabled: true,

			// WebSocket configuration
			ws: {
				// Connection initialization
				onConnect: async (ctx) => {
					// Validate authentication for WebSocket connections
					const token = ctx.connectionParams?.authorization || ctx.connectionParams?.Authorization
					const apiKey = ctx.connectionParams?.['x-api-key'] || ctx.connectionParams?.['X-API-Key']

					// Try to authenticate with session token or API key
					if (!token && !apiKey) {
						throw new Error('Authentication required for subscriptions')
					}

					// TODO: Implement proper token/API key validation
					// This would involve validating the token against Better Auth
					// and creating a proper session context
					// For now, we'll return a basic context
					return {
						authenticated: true,
						token,
					}
				},

				// Connection cleanup
				onDisconnect: (ctx) => {
					console.log('GraphQL WebSocket disconnected')
				},
			},
		},

		// Plugin configuration
		plugins: [
			// Add custom plugins here if needed
		],

		// Batch requests configuration
		batching: {
			limit: 10, // Maximum number of operations in a batch
		},

		// Introspection (disable in production for security)
		introspection: process.env.NODE_ENV !== 'production',

		// Query depth limiting for security
		validationRules: [
			// Add custom validation rules here if needed
		],
	})
}

/**
 * GraphQL server instance
 */
export const graphqlServer = createGraphQLServer()

/**
 * Helper function to handle GraphQL requests in Hono
 */
export const handleGraphQLRequest = async (c: Context) => {
	// Add Hono context to the request for GraphQL context creation
	const request = c.req.raw
	;(request as any).context = c

	// Handle the GraphQL request
	return graphqlServer.handle(request, {
		context: c,
	})
}
