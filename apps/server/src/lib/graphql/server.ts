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
						maskError(error, message, isDev): Error {
							// In production, mask internal errors but keep GraphQL errors
							if (error instanceof Error) {
								return error
							}

							// Log the original error for debugging
							console.error('GraphQL Error:', error)

							// Return a generic error message
							return new Error('Internal server error')
						},
					}
				: false,

		// Plugin configuration
		plugins: [
			// Add custom plugins here if needed
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
	return graphqlServer.handle({
		request,
	})
}
