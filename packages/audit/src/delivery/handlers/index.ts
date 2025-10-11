/**
 * Delivery handlers and security components
 * Requirements 4.1, 4.2, 4.3, 4.4, 4.5: Webhook delivery system exports
 * Requirements 1.1, 10.3, 2.1, 2.5: Email delivery system exports
 */

export { WebhookHandler } from './webhook-handler.js'
export { WebhookSecurityManager, WebhookSecurityTestUtils } from './webhook-security.js'
export { WebhookSecretManager, createWebhookSecretManager } from './webhook-secret-manager.js'
export { EmailHandler } from './email-handler.js'
export {
	EmailProviderFactory,
	EmailRateLimiter,
	SendGridProvider,
	ResendProvider,
	SESProvider,
	SMTPProvider,
} from './email-providers.js'
export { EmailTemplateEngine } from './email-template-engine.js'

export type {
	WebhookSecurityHeaders,
	SignatureVerificationResult,
	WebhookSecret,
} from './webhook-security.js'

export type {
	WebhookSecret as WebhookSecretType,
	SecretRotationConfig,
	BYOSConfig,
	SecretValidationResult,
} from './webhook-secret-manager.js'

export type {
	EmailProvider as EmailProviderType,
	EmailProviderFeature,
	RateLimitConfig,
} from './email-providers.js'

export type {
	EmailTemplateContext,
	EmailAttachment,
	TemplateOptions,
	EmailSizeLimits,
} from './email-template-engine.js'

export {
	StorageHandler,
	createStorageHandler,
	createStorageHandlerWithProviders,
	StorageError,
	StorageAuthenticationError,
	StorageNotFoundError,
	StorageNetworkError,
	StorageQuotaExceededError,
} from './storage-handler.js'

export type {
	IStorageProvider,
	StorageProvider,
	StorageConfig,
	StorageUploadResult,
	StorageDownloadResult,
	StorageListResult,
	StorageObjectInfo,
	LocalStorageConfig,
	S3StorageConfig,
	AzureStorageConfig,
	GCPStorageConfig,
} from './storage-handler.js'

export {
	S3StorageProvider,
	createS3StorageProvider,
	AzureStorageProvider,
	createAzureStorageProvider,
	GCPStorageProvider,
	createGCPStorageProvider,
	LocalStorageProvider,
	createLocalStorageProvider,
	createStorageProvider,
	getAvailableProviders,
	StorageProviderRegistry,
	defaultStorageProviderRegistry,
} from './storage-providers/index.js'
