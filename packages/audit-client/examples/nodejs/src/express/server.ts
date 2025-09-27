import compression from 'compression'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import morgan from 'morgan'

import { config } from '../config/environment'
import { auditMiddleware } from '../middleware/audit'
import { errorHandler } from '../middleware/error-handler'
import { AuditService } from '../services/audit-service'
import { UserService } from '../services/user-service'
import { logger } from '../utils/logger'
import { createAuditRoutes } from './routes/audit'
import { createHealthRoutes } from './routes/health'
import { createUserRoutes } from './routes/users'

async function createApp() {
	const app = express()

	// Initialize audit service
	const auditService = new AuditService(config.audit)
	await auditService.initialize()

	// Initialize other services
	const userService = new UserService(auditService)

	// Security middleware
	app.use(helmet())
	app.use(
		cors({
			origin: config.cors.origins,
			credentials: true,
		})
	)

	// Utility middleware
	app.use(compression())
	app.use(express.json({ limit: '10mb' }))
	app.use(express.urlencoded({ extended: true }))

	// Logging middleware
	app.use(
		morgan('combined', {
			stream: {
				write: (message: string) => logger.info(message.trim()),
			},
		})
	)

	// Audit middleware - logs all requests
	app.use(auditMiddleware(auditService))

	// Routes
	app.use('/api/users', createUserRoutes(userService))
	app.use('/api/audit', createAuditRoutes(auditService))
	app.use('/api/health', createHealthRoutes(auditService))

	// Root endpoint
	app.get('/', (req, res) => {
		res.json({
			name: 'Audit Client Node.js Example',
			version: '1.0.0',
			timestamp: new Date().toISOString(),
		})
	})

	// Error handling middleware
	app.use(errorHandler(auditService))

	return { app, auditService }
}

async function startServer() {
	try {
		const { app, auditService } = await createApp()

		const server = app.listen(config.port, () => {
			logger.info(`Server running on port ${config.port}`)
			logger.info(`Environment: ${config.env}`)
			logger.info(`Audit API URL: ${config.audit.baseUrl}`)
		})

		// Graceful shutdown
		process.on('SIGTERM', async () => {
			logger.info('SIGTERM received, shutting down gracefully')

			server.close(async () => {
				try {
					// Cleanup audit service
					await auditService.cleanup()
					logger.info('Server closed successfully')
					process.exit(0)
				} catch (error) {
					logger.error('Error during cleanup:', error)
					process.exit(1)
				}
			})
		})

		process.on('SIGINT', async () => {
			logger.info('SIGINT received, shutting down gracefully')

			server.close(async () => {
				try {
					await auditService.cleanup()
					logger.info('Server closed successfully')
					process.exit(0)
				} catch (error) {
					logger.error('Error during cleanup:', error)
					process.exit(1)
				}
			})
		})
	} catch (error) {
		logger.error('Failed to start server:', error)
		process.exit(1)
	}
}

// Start server if this file is run directly
if (require.main === module) {
	startServer()
}

export { createApp, startServer }
