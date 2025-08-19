import 'dotenv/config'

import { serve } from '@hono/node-server'
import { trpcServer } from '@hono/trpc-server'
import { cors } from 'hono/cors'

import { useConsoleLogger } from '@repo/hono-helpers'

import { getAuthInstance } from './lib/auth.js'
import { configManager } from './lib/config/index.js'
import { handleGraphQLRequest } from './lib/graphql/index'
import { newApp } from './lib/hono/'
import { init } from './lib/hono/init'
import { nodeEnv } from './lib/hono/node-env'
import { appRouter } from './routers/index'

// Global server instance for graceful shutdown
let server: ReturnType<typeof serve> | null = null
let isShuttingDown = false

async function startServer() {
	// Initialize configuration
	await configManager.initialize()
	const config = configManager.getConfig()

	const app = newApp()

	if (!configManager.isProduction()) {
		app.use('*', nodeEnv())
	}

	const auth = await getAuthInstance()

	app.use('*', init())
	app.use(useConsoleLogger())

	// Configure CORS with settings from configuration
	app.use(
		'/*',
		cors({
			origin: config.cors.origin,
			allowMethods: config.cors.allowedMethods,
			allowHeaders: config.cors.allowedHeaders,
			credentials: config.cors.credentials,
		})
	)

	app.on(['POST', 'GET'], '/api/auth/*', (c) => auth.handler(c.req.raw))

	// Configure TRPC with path from configuration
	if (config.api.enableTrpc) {
		app.use(`${config.api.trpcPath}/*`, async (c, next) =>
			trpcServer({
				router: appRouter,
				createContext: () => ({
					services: c.get('services'),
					session: c.get('session'),
					requestId: c.get('requestId'),
				}),
			})(c, next)
		)
	}

	// Mount REST API routes if enabled
	if (config.api.enableRest) {
		const { createRestAPI } = await import('./routes/rest-api.js')
		const restAPI = createRestAPI()
		app.route(`${config.api.restPath}/v1`, restAPI)
	}

	// Configure GraphQL endpoint if enabled
	if (config.api.enableGraphql) {
		app.all(`${config.api.graphqlPath}/*`, async (c) => {
			return handleGraphQLRequest(c)
		})
		app.all(config.api.graphqlPath, async (c) => {
			return handleGraphQLRequest(c)
		})
	}

	// Health check endpoint
	app.get(config.monitoring.healthCheckPath, (c) => {
		if (isShuttingDown) {
			return c.json({ status: 'shutting_down' }, 503)
		}
		return c.json({
			status: 'healthy',
			timestamp: new Date().toISOString(),
			environment: config.server.environment,
			version: c.get('version'),
		})
	})

	// Readiness check endpoint for Kubernetes
	app.get('/ready', (c) => {
		if (isShuttingDown) {
			return c.json({ status: 'not_ready', reason: 'shutting_down' }, 503)
		}

		// Check if all services are ready
		const services = c.get('services')
		if (!services) {
			return c.json({ status: 'not_ready', reason: 'services_not_initialized' }, 503)
		}

		return c.json({
			status: 'ready',
			timestamp: new Date().toISOString(),
			environment: config.server.environment,
		})
	})

	// Configuration endpoint (development only)
	if (configManager.isDevelopment()) {
		app.get('/config', (c) => {
			return c.json({
				environment: configManager.getEnvironment(),
				config: JSON.parse(configManager.toJSON()),
			})
		})
	}

	// Start server with Hono's Node.js adapter
	server = serve(
		{
			fetch: app.fetch,
			port: config.server.port,
			hostname: config.server.host,
		},
		() => {
			console.log(`🚀 Server is running on http://${config.server.host}:${config.server.port}`)
			console.log(`📊 Environment: ${config.server.environment}`)
			console.log(
				`🔧 Health check: http://${config.server.host}:${config.server.port}${config.monitoring.healthCheckPath}`
			)
			console.log(`✅ Readiness check: http://${config.server.host}:${config.server.port}/ready`)

			// API endpoints
			if (config.api.enableTrpc) {
				console.log(
					`🔌 TRPC API: http://${config.server.host}:${config.server.port}${config.api.trpcPath}`
				)
			}
			if (config.api.enableRest) {
				console.log(
					`🌐 REST API: http://${config.server.host}:${config.server.port}${config.api.restPath}`
				)
			}
			if (config.api.enableGraphql) {
				console.log(
					`🎯 GraphQL API: http://${config.server.host}:${config.server.port}${config.api.graphqlPath}`
				)
				if (configManager.isDevelopment()) {
					console.log(
						`🎮 GraphQL Playground: http://${config.server.host}:${config.server.port}${config.api.graphqlPath}`
					)
				}
			}

			if (configManager.isDevelopment()) {
				console.log(`⚙️  Configuration: http://${config.server.host}:${config.server.port}/config`)
			}
		}
	)

	return server
}

// Graceful shutdown handler
async function gracefulShutdown(signal: string) {
	console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`)
	isShuttingDown = true

	if (!server) {
		console.log('❌ No server instance found')
		process.exit(1)
	}

	// Set a timeout for forceful shutdown
	const shutdownTimeout = setTimeout(() => {
		console.log('⏰ Shutdown timeout reached. Forcing exit...')
		process.exit(1)
	}, 30000) // 30 seconds timeout

	try {
		// Stop accepting new connections
		server.close(async (err) => {
			if (err) {
				console.error('❌ Error during server shutdown:', err)
				process.exit(1)
			}

			console.log('✅ Server stopped accepting new connections')

			try {
				// Close database connections and other resources
				const services = await import('./lib/hono/init.js')
				if (services.cleanup) {
					await services.cleanup()
					console.log('✅ Services cleaned up successfully')
				}

				// Clear the shutdown timeout
				clearTimeout(shutdownTimeout)

				console.log('✅ Graceful shutdown completed')
				process.exit(0)
			} catch (cleanupError) {
				console.error('❌ Error during cleanup:', cleanupError)
				process.exit(1)
			}
		})
	} catch (error) {
		console.error('❌ Error during graceful shutdown:', error)
		clearTimeout(shutdownTimeout)
		process.exit(1)
	}
}

// Register signal handlers for graceful shutdown
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))

// Handle uncaught exceptions and unhandled rejections
process.on('uncaughtException', (error) => {
	console.error('💥 Uncaught Exception:', error)
	gracefulShutdown('UNCAUGHT_EXCEPTION')
})

process.on('unhandledRejection', (reason, promise) => {
	console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason)
	gracefulShutdown('UNHANDLED_REJECTION')
})

// Start the server
startServer().catch((error) => {
	console.error('Failed to start server:', error)
	process.exit(1)
})
