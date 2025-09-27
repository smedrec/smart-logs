import {
	AuditClient,
	AuditClientConfig,
	AuditClientError,
	CreateAuditEventInput,
} from '@smedrec/audit-client'
import { app, dialog, ipcMain, shell } from 'electron'
import log from 'electron-log'
import Store from 'electron-store'
import { autoUpdater } from 'electron-updater'

export class ElectronAuditService {
	private client: AuditClient | null = null
	private store: Store
	private isInitialized = false
	private eventQueue: CreateAuditEventInput[] = []

	constructor() {
		this.store = new Store({
			name: 'audit-config',
			encryptionKey: 'your-encryption-key', // In production, use a secure key
		})

		this.setupIPC()
		this.setupSystemEventListeners()
	}

	async initialize(): Promise<void> {
		try {
			const config = this.getAuditConfig()
			this.client = new AuditClient(config)

			// Test connection
			await this.client.health.check()

			this.isInitialized = true

			// Process queued events
			await this.processEventQueue()

			// Log application start
			await this.logSystemEvent('app.start', {
				version: app.getVersion(),
				platform: process.platform,
				arch: process.arch,
				electronVersion: process.versions.electron,
				nodeVersion: process.versions.node,
			})

			log.info('Audit service initialized successfully')
		} catch (error) {
			log.error('Failed to initialize audit service:', error)
			this.isInitialized = false
		}
	}

	private getAuditConfig(): AuditClientConfig {
		const isDev = !app.isPackaged

		return {
			baseUrl: this.store.get(
				'auditApiUrl',
				isDev ? 'http://localhost:3001' : 'https://api.example.com'
			) as string,
			apiVersion: 'v1',
			timeout: 30000,
			authentication: {
				type: 'apiKey',
				apiKey: this.store.get('auditApiKey') as string,
				autoRefresh: true,
			},
			retry: {
				enabled: true,
				maxAttempts: 3,
				initialDelayMs: 1000,
				maxDelayMs: 10000,
				backoffMultiplier: 2,
				retryableStatusCodes: [408, 429, 500, 502, 503, 504],
				retryableErrors: ['NETWORK_ERROR', 'TIMEOUT_ERROR'],
			},
			cache: {
				enabled: true,
				defaultTtlMs: 300000,
				maxSize: 100,
				storage: 'memory',
				keyPrefix: 'audit-cache-electron',
				compressionEnabled: true,
			},
			batching: {
				enabled: true,
				maxBatchSize: 25,
				batchTimeoutMs: 3000,
				batchableEndpoints: ['/audit/events'],
			},
			performance: {
				enableCompression: true,
				enableStreaming: false,
				maxConcurrentRequests: 5,
				requestDeduplication: true,
				responseTransformation: true,
			},
			logging: {
				enabled: isDev,
				level: 'info',
				includeRequestBody: false,
				includeResponseBody: false,
				maskSensitiveData: true,
			},
			errorHandling: {
				throwOnError: false,
				includeStackTrace: isDev,
				errorTransformation: true,
			},
			environment: isDev ? 'development' : 'production',
			customHeaders: {
				'X-App-Type': 'electron',
				'X-App-Version': app.getVersion(),
				'X-Platform': process.platform,
			},
		}
	}

	private setupIPC(): void {
		// Handle audit events from renderer process
		ipcMain.handle('audit:log-event', async (event, eventData: CreateAuditEventInput) => {
			return this.logEvent(eventData)
		})

		// Handle bulk audit events
		ipcMain.handle('audit:bulk-log-events', async (event, events: CreateAuditEventInput[]) => {
			return this.bulkLogEvents(events)
		})

		// Handle audit queries
		ipcMain.handle('audit:query-events', async (event, params) => {
			if (!this.client) throw new Error('Audit client not initialized')
			return this.client.events.query(params)
		})

		// Handle system health check
		ipcMain.handle('audit:health-check', async () => {
			if (!this.client) throw new Error('Audit client not initialized')
			return this.client.health.detailed()
		})

		// Handle configuration updates
		ipcMain.handle('audit:update-config', async (event, config) => {
			this.store.set(config)
			await this.initialize() // Reinitialize with new config
		})

		// Handle connection status
		ipcMain.handle('audit:get-status', () => ({
			isInitialized: this.isInitialized,
			queuedEvents: this.eventQueue.length,
		}))
	}

	private setupSystemEventListeners(): void {
		// App lifecycle events
		app.on('ready', () => {
			this.logSystemEvent('app.ready')
		})

		app.on('window-all-closed', () => {
			this.logSystemEvent('app.window_all_closed')
		})

		app.on('before-quit', () => {
			this.logSystemEvent('app.before_quit')
		})

		app.on('activate', () => {
			this.logSystemEvent('app.activate')
		})

		// Security events
		app.on('web-contents-created', (event, contents) => {
			contents.on('new-window', (event, navigationUrl) => {
				this.logSecurityEvent('web_contents.new_window', {
					url: navigationUrl,
					userAgent: contents.getUserAgent(),
				})
			})

			contents.on('will-navigate', (event, navigationUrl) => {
				this.logSecurityEvent('web_contents.will_navigate', {
					url: navigationUrl,
					currentUrl: contents.getURL(),
				})
			})
		})

		// Auto-updater events
		autoUpdater.on('checking-for-update', () => {
			this.logSystemEvent('updater.checking_for_update')
		})

		autoUpdater.on('update-available', (info) => {
			this.logSystemEvent('updater.update_available', {
				version: info.version,
				releaseDate: info.releaseDate,
			})
		})

		autoUpdater.on('update-downloaded', (info) => {
			this.logSystemEvent('updater.update_downloaded', {
				version: info.version,
				downloadedFile: info.downloadedFile,
			})
		})

		autoUpdater.on('error', (error) => {
			this.logSystemEvent('updater.error', {
				error: error.message,
			})
		})

		// Dialog events
		const originalShowMessageBox = dialog.showMessageBox
		dialog.showMessageBox = async (...args) => {
			const result = await originalShowMessageBox.apply(dialog, args)

			this.logUserInteraction('dialog.message_box', {
				type: args[0]?.type || args[1]?.type,
				title: args[0]?.title || args[1]?.title,
				message: args[0]?.message || args[1]?.message,
				response: result.response,
			})

			return result
		}

		// Shell events
		const originalOpenExternal = shell.openExternal
		shell.openExternal = async (url, options?) => {
			const result = await originalOpenExternal(url, options)

			this.logSecurityEvent('shell.open_external', {
				url,
				options,
			})

			return result
		}
	}

	async logEvent(eventData: CreateAuditEventInput): Promise<void> {
		if (!this.isInitialized || !this.client) {
			// Queue event for later processing
			this.eventQueue.push(eventData)
			return
		}

		try {
			await this.client.events.create(eventData)
		} catch (error) {
			log.error('Failed to log audit event:', error)

			// Queue for retry
			this.eventQueue.push(eventData)
		}
	}

	async bulkLogEvents(events: CreateAuditEventInput[]): Promise<void> {
		if (!this.isInitialized || !this.client) {
			this.eventQueue.push(...events)
			return
		}

		try {
			await this.client.events.bulkCreate(events)
		} catch (error) {
			log.error('Failed to bulk log audit events:', error)
			this.eventQueue.push(...events)
		}
	}

	async logSystemEvent(action: string, details?: Record<string, any>): Promise<void> {
		await this.logEvent({
			action: `system.${action}`,
			targetResourceType: 'desktop_app',
			targetResourceId: app.getName(),
			principalId: 'system',
			organizationId: 'desktop-org',
			status: 'success',
			dataClassification: 'INTERNAL',
			details: {
				appName: app.getName(),
				appVersion: app.getVersion(),
				platform: process.platform,
				...details,
			},
		})
	}

	async logUserInteraction(action: string, details?: Record<string, any>): Promise<void> {
		await this.logEvent({
			action: `user.${action}`,
			targetResourceType: 'desktop_app',
			targetResourceId: app.getName(),
			principalId: 'desktop-user',
			organizationId: 'desktop-org',
			status: 'success',
			dataClassification: 'INTERNAL',
			details,
		})
	}

	async logSecurityEvent(action: string, details?: Record<string, any>): Promise<void> {
		await this.logEvent({
			action: `security.${action}`,
			targetResourceType: 'desktop_app',
			targetResourceId: app.getName(),
			principalId: 'desktop-user',
			organizationId: 'desktop-org',
			status: 'attempt',
			dataClassification: 'CONFIDENTIAL',
			details,
		})
	}

	async logFileOperation(
		action: string,
		filePath: string,
		details?: Record<string, any>
	): Promise<void> {
		await this.logEvent({
			action: `file.${action}`,
			targetResourceType: 'file',
			targetResourceId: filePath,
			principalId: 'desktop-user',
			organizationId: 'desktop-org',
			status: 'success',
			dataClassification: 'INTERNAL',
			details: {
				filePath,
				...details,
			},
		})
	}

	private async processEventQueue(): Promise<void> {
		if (this.eventQueue.length === 0) return

		log.info(`Processing ${this.eventQueue.length} queued audit events`)

		const events = [...this.eventQueue]
		this.eventQueue = []

		try {
			await this.bulkLogEvents(events)
		} catch (error) {
			log.error('Failed to process event queue:', error)
			// Re-queue failed events
			this.eventQueue.unshift(...events)
		}
	}

	async cleanup(): Promise<void> {
		if (this.eventQueue.length > 0) {
			await this.processEventQueue()
		}

		await this.logSystemEvent('app.cleanup')

		// Give time for final events to be sent
		await new Promise((resolve) => setTimeout(resolve, 1000))
	}
}
