import 'dotenv/config'

import { serve } from '@hono/node-server'
import { trpcServer } from '@hono/trpc-server'
import * as Sentry from '@sentry/node'
import { cors } from 'hono/cors'
import { serve as inngestServe } from 'inngest/hono'

import { ConfigurationManager } from '@repo/audit'

import { handleGraphQLRequest } from './lib/graphql/index.js'
import { newApp } from './lib/hono/index.js'
import { init } from './lib/hono/init.js'
import { nodeEnv } from './lib/hono/node-env.js'
import { functions } from './lib/inngest/index.js'
import { requireAuthOrApiKey } from './lib/middleware/auth.js'
import { createComprehensiveErrorHandling } from './lib/middleware/error-handling.js'
import {
	errorRateMonitoring,
	performanceMonitoring,
	requestMetrics,
} from './lib/middleware/monitoring.js'
import {
	compressionMiddleware,
	concurrencyLimitMiddleware,
	memoryMonitoringMiddleware,
	performanceHeadersMiddleware,
	performanceMiddleware,
	requestSizeLimitMiddleware,
	responseCachingMiddleware,
	timeoutMiddleware,
} from './lib/middleware/performance.js'
import { appRouter } from './routers/index.js'
import { createRestAPI } from './routes/rest-api.js'

Sentry.init({
	dsn: 'https://af6b20a8261b4d4981f0283f26d7795c@bugsink.smedrec.qzz.io/1',

	// Alternatively, use `process.env.npm_package_version` for a dynamic release version
	// if your build tool supports it.
	release: 'smart-logs@0.1.0',

	integrations: [],
	tracesSampleRate: 0,
})

// Configuration manager
let configManager: ConfigurationManager | undefined = undefined
export { configManager }

// Global server instance for graceful shutdown
let server: ReturnType<typeof serve> | null = null
let isShuttingDown = false

async function startServer() {
	// Initialize configuration
	if (!configManager) {
		console.info('🔗 Initializing configuration manager...')
		configManager = new ConfigurationManager(process.env.CONFIG_PATH!, 's3')
		try {
			await configManager.initialize()
		} catch (error) {
			// Exit if initialization fails
			const message =
				error instanceof Error
					? error.message
					: 'Unknown error during configuration manager initialization'
			console.error('🔴 Configuration manager initialization failed:', message)
			throw new Error(message)
		}
	}
	const config = configManager.getConfig()

	const app = newApp(config)

	if (!configManager.isProduction()) {
		app.use('*', nodeEnv())
	}

	// Configure CORS with settings from configuration
	app.use(
		'*',
		cors({
			origin: config.server.cors.origin,
			credentials: config.server.cors.credentials,
			allowMethods: config.server.cors.allowedMethods,
			allowHeaders: config.server.cors.allowedHeaders,
			exposeHeaders: config.server.cors.exposeHeaders,
			maxAge: config.server.cors.maxAge,
		})
	)

	app.use('*', init(configManager))

	// Add comprehensive error handling middleware
	const errorHandlingMiddleware = createComprehensiveErrorHandling({
		enableRecovery: true,
		enableRateLimit: true,
		timeoutMs: config.server.timeout || 30000,
	})
	errorHandlingMiddleware.forEach((middleware) => app.use('*', middleware))

	// Add performance middleware
	app.use('*', performanceHeadersMiddleware())
	app.use('*', performanceMiddleware())
	// FIXME: generate a error when the request is text/html
	//app.use('*', compressionMiddleware())
	app.use('*', timeoutMiddleware(config.server.timeout || 30000))
	app.use('*', memoryMonitoringMiddleware(100)) // 100MB threshold
	app.use('*', requestSizeLimitMiddleware(10)) // 10MB limit
	app.use('*', concurrencyLimitMiddleware(200)) // 200 concurrent requests

	// Add monitoring middleware
	app.use('*', requestMetrics())
	app.use('*', performanceMonitoring({ threshold: 1000, alertOnSlow: true }))
	app.use('*', errorRateMonitoring({ windowSize: 300000, threshold: 0.1 }))

	// Add response caching for GET requests
	app.use('*', responseCachingMiddleware(300)) // 5 minutes cache

	app.on(['POST', 'GET'], '/api/auth/*', (c) => c.get('services').auth.handler(c.req.raw))

	if (config.server.inngest.enabled) {
		app.on(['GET', 'PUT', 'POST'], `${config.server.inngest.inngestPath}`, (c) => {
			const handler = inngestServe({
				client: c.get('services').inngest,
				functions,
			})
			return handler(c)
		})
	}

	// Configure TRPC with path from configuration
	if (config.server.api.enableTrpc) {
		app.use(`${config.server.api.trpcPath}/*`, async (c, next) =>
			trpcServer({
				router: appRouter,
				createContext: () => ({
					services: c.get('services'),
					session: c.get('session'),
					requestId: c.get('requestId'),
					location: c.get('location'),
					userAgent: c.get('userAgent'),
				}),
			})(c, next)
		)
	}

	// Mount REST API routes if enabled
	if (config.server.api.enableRest) {
		const restAPI = createRestAPI()
		app.route(`${config.server.api.restPath}/v1`, restAPI)
	}

	// Mount kubernetes health check API
	const { createKubernetesHealthAPI } = await import('./routes/kubernetes-health-api.js')
	const kubernetesHealthAPI = createKubernetesHealthAPI()
	app.route(``, kubernetesHealthAPI)

	// Mount metrics API if enabled
	if (config.server.monitoring.enableMetrics) {
		const { createMetricsAPI } = await import('./routes/metrics-api.js')
		const metricsAPI = createMetricsAPI()
		app.route('/metrics', metricsAPI)
	}

	// Configure GraphQL endpoint if enabled
	if (config.server.api.enableGraphql) {
		// Apply authentication middleware to GraphQL endpoints
		app.use(`${config.server.api.graphqlPath}/*`, requireAuthOrApiKey)
		app.use(config.server.api.graphqlPath, requireAuthOrApiKey)

		app.all(`${config.server.api.graphqlPath}/*`, async (c) => {
			return handleGraphQLRequest(c)
		})
		app.all(config.server.api.graphqlPath, async (c) => {
			return handleGraphQLRequest(c)
		})
	}

	// Legacy health check endpoint (for backward compatibility)
	app.get(config.server.monitoring.healthCheckPath, (c) => {
		if (isShuttingDown) {
			return c.json({ status: 'shutting_down' }, 503)
		}

		const services = c.get('services')
		const resilienceHealth = services?.resilience?.getAllServiceHealth() || []
		const hasUnhealthyServices = resilienceHealth.some((h) => h.status === 'unhealthy')

		return c.json({
			status: hasUnhealthyServices ? 'degraded' : 'healthy',
			timestamp: new Date().toISOString(),
			environment: config.server.environment,
			version: c.get('version'),
			services: resilienceHealth.reduce(
				(acc, health) => {
					acc[health.name] = {
						status: health.status,
						circuitBreakerState: health.circuitBreakerState,
						errorRate: health.errorRate,
					}
					return acc
				},
				{} as Record<string, any>
			),
		})
	})

	// Configuration endpoint (development only)
	if (configManager.isDevelopment()) {
		app.get('/config', (c) => {
			if (!configManager) {
				return c.json({ error: 'Configuration manager not initialized' }, 500)
			}
			return c.json({
				environment: configManager.getEnvironment(),
				config: JSON.parse(configManager.toJSON()),
			})
		})
	}

	app.get('/session', (c) => {
		return c.json({
			isApiKey: c.get('isApiKeyAuth'),
			session: c.get('session'),
		})
	})

	// Resilience metrics endpoint (development and staging only)
	if (configManager.isDevelopment() || config.server.environment === 'staging') {
		app.get('/resilience', (c) => {
			const services = c.get('services')
			if (!services?.resilience) {
				return c.json({ error: 'Resilience service not available' }, 503)
			}

			return c.json({
				serviceHealth: services.resilience.getAllServiceHealth(),
				circuitBreakerMetrics: services.resilience.getCircuitBreakerMetrics(),
				timestamp: new Date().toISOString(),
			})
		})

		app.post('/resilience/reset/:serviceName', (c) => {
			const serviceName = c.req.param('serviceName')
			const services = c.get('services')

			if (!services?.resilience) {
				return c.json({ error: 'Resilience service not available' }, 503)
			}

			const success = services.resilience.resetCircuitBreaker(serviceName)
			return c.json({
				success,
				message: success
					? `Circuit breaker reset for ${serviceName}`
					: `Circuit breaker not found for ${serviceName}`,
			})
		})

		app.post('/resilience/reset-all', (c) => {
			const services = c.get('services')

			if (!services?.resilience) {
				return c.json({ error: 'Resilience service not available' }, 503)
			}

			services.resilience.resetAllCircuitBreakers()
			return c.json({
				success: true,
				message: 'All circuit breakers reset',
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
				`🔧 Health check: http://${config.server.host}:${config.server.port}${config.server.monitoring.healthCheckPath}`
			)
			console.log(`✅ Readiness check: http://${config.server.host}:${config.server.port}/ready`)

			// API endpoints
			if (config.server.api.enableTrpc) {
				console.log(
					`🔌 TRPC API: http://${config.server.host}:${config.server.port}${config.server.api.trpcPath}`
				)
			}
			if (config.server.api.enableRest) {
				console.log(
					`🌐 REST API: http://${config.server.host}:${config.server.port}${config.server.api.restPath}`
				)
			}
			if (config.server.api.enableGraphql) {
				console.log(
					`🎯 GraphQL API: http://${config.server.host}:${config.server.port}${config.server.api.graphqlPath}`
				)
				if (configManager?.isDevelopment()) {
					console.log(
						`🎮 GraphQL Playground: http://${config.server.host}:${config.server.port}${config.server.api.graphqlPath}`
					)
				}
			}

			if (config.server.inngest.enabled) {
				console.log(
					`🌐 Inngest API: http://${config.server.host}:${config.server.port}${config.server.inngest.inngestPath}`
				)
			}

			if (configManager?.isDevelopment()) {
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
				// TODO: Close database connections and other resources
				/**
				const services = await import('./lib/hono/init.js')
				if (services.cleanup) {
					await services.cleanup()
					console.log('✅ Services cleaned up successfully')
				}
				*/

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
