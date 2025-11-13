import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CheckCircle2, Loader2, TestTube } from 'lucide-react'
import * as React from 'react'

import { DestinationTypeSelector } from './destination-type-selector'
import { DownloadDestinationConfig } from './download-destination-config'
import { EmailDestinationConfig } from './email-destination-config'
import { SftpDestinationConfig } from './sftp-destination-config'
import { StorageDestinationConfig } from './storage-destination-config'
import { TestDestinationDialog } from './test-destination-dialog'
import { ValidationFeedback } from './validation-feedback'
import { WebhookDestinationConfig } from './webhook-destination-config'

import type {
	ConnectionTestResult,
	CreateDeliveryDestination,
	DeliveryDestinationConfig,
	DeliveryDestinationType,
	ValidationResult,
} from '@smedrec/audit-client'

interface DeliveryDestinationFormProps {
	initialData?: Partial<CreateDeliveryDestination>
	onSubmit: (data: CreateDeliveryDestination) => Promise<void>
	onCancel?: () => void
	loading?: boolean
	organizationId: string
	destinationId?: string // For testing existing destinations
	onValidate?: (destinationId: string) => Promise<ValidationResult>
	onTestConnection?: (destinationId: string) => Promise<ConnectionTestResult>
}

export function DeliveryDestinationForm({
	initialData,
	onSubmit,
	onCancel,
	loading = false,
	organizationId,
	destinationId,
	onValidate,
	onTestConnection,
}: DeliveryDestinationFormProps) {
	const [formData, setFormData] = React.useState<Partial<CreateDeliveryDestination>>({
		organizationId,
		label: '',
		type: undefined,
		description: '',
		config: {},
		...initialData,
	})

	const [errors, setErrors] = React.useState<Record<string, string>>({})
	const [currentStep, setCurrentStep] = React.useState<'type' | 'details' | 'config'>(
		initialData?.type ? 'config' : 'type'
	)
	const [validation, setValidation] = React.useState<ValidationResult | null>(null)
	const [validating, setValidating] = React.useState(false)
	const [testDialogOpen, setTestDialogOpen] = React.useState(false)

	const updateFormData = (updates: Partial<CreateDeliveryDestination>) => {
		setFormData((prev) => ({ ...prev, ...updates }))
		// Clear related errors
		Object.keys(updates).forEach((key) => {
			setErrors((prev) => {
				const { [key]: _, ...rest } = prev
				return rest
			})
		})
	}

	const updateConfig = (config: DeliveryDestinationConfig) => {
		updateFormData({ config })
	}

	const validateForm = (): boolean => {
		const newErrors: Record<string, string> = {}

		if (!formData.label?.trim()) {
			newErrors.label = 'Label is required'
		}

		if (!formData.type) {
			newErrors.type = 'Destination type is required'
		}

		// Type-specific validation
		if (formData.type === 'email' && formData.config?.email) {
			const emailConfig = formData.config.email
			if (!emailConfig.service) {
				newErrors['config.email.service'] = 'Email service is required'
			}
			if (!emailConfig.from) {
				newErrors['config.email.from'] = 'From address is required'
			}
			if (!emailConfig.subject) {
				newErrors['config.email.subject'] = 'Subject is required'
			}
			if (emailConfig.service === 'smtp') {
				if (!emailConfig.smtpConfig?.host) {
					newErrors['config.email.smtpConfig.host'] = 'SMTP host is required'
				}
				if (!emailConfig.smtpConfig?.auth?.user) {
					newErrors['config.email.smtpConfig.auth.user'] = 'SMTP username is required'
				}
			}
			if (emailConfig.service === 'api' && !emailConfig.apiKey) {
				newErrors['config.email.apiKey'] = 'API key is required'
			}
		}

		if (formData.type === 'webhook' && formData.config?.webhook) {
			const webhookConfig = formData.config.webhook
			if (!webhookConfig.url) {
				newErrors['config.webhook.url'] = 'Webhook URL is required'
			}
		}

		if (formData.type === 'storage' && formData.config?.storage) {
			const storageConfig = formData.config.storage
			if (!storageConfig.path) {
				newErrors['config.storage.path'] = 'Storage path is required'
			}
		}

		if (formData.type === 'sftp' && formData.config?.sftp) {
			const sftpConfig = formData.config.sftp
			if (!sftpConfig.host) {
				newErrors['config.sftp.host'] = 'SFTP host is required'
			}
			if (!sftpConfig.path) {
				newErrors['config.sftp.path'] = 'Remote path is required'
			}
		}

		if (formData.type === 'download' && formData.config?.download) {
			const downloadConfig = formData.config.download
			if (!downloadConfig.expiryHours || downloadConfig.expiryHours < 1) {
				newErrors['config.download.expiryHours'] = 'Valid expiry time is required'
			}
		}

		setErrors(newErrors)
		return Object.keys(newErrors).length === 0
	}

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()

		if (!validateForm()) {
			return
		}

		try {
			await onSubmit(formData as CreateDeliveryDestination)
		} catch (err) {
			// Error handling is done by parent component
			console.error('Form submission error:', err)
		}
	}

	const handleValidate = async () => {
		if (!destinationId || !onValidate) {
			return
		}

		setValidating(true)
		setValidation(null)

		try {
			const result = await onValidate(destinationId)
			setValidation(result)
		} catch (err) {
			setValidation({
				isValid: false,
				errors: [err instanceof Error ? err.message : 'Validation failed'],
			})
		} finally {
			setValidating(false)
		}
	}

	const handleTestConnection = async (destId: string): Promise<ConnectionTestResult> => {
		if (!onTestConnection) {
			throw new Error('Test connection handler not provided')
		}
		return await onTestConnection(destId)
	}

	const handleOpenTestDialog = () => {
		if (destinationId) {
			setTestDialogOpen(true)
		}
	}

	const handleTypeSelect = (type: DeliveryDestinationType) => {
		// Initialize default config for the selected type
		const defaultConfigs: Record<DeliveryDestinationType, DeliveryDestinationConfig> = {
			email: {
				email: {
					service: 'smtp',
					from: '',
					subject: 'Compliance Report - {{reportName}}',
					smtpConfig: {
						host: '',
						port: 587,
						secure: true,
						auth: { user: '', pass: '' },
					},
				},
			},
			webhook: {
				webhook: {
					url: '',
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					timeout: 30000,
					retryConfig: {
						maxRetries: 3,
						backoffMultiplier: 2,
						maxBackoffDelay: 60000,
					},
				},
			},
			storage: {
				storage: {
					provider: 'local',
					config: {},
					path: 'compliance/reports/{{organizationId}}/{{year}}/{{month}}',
					retention: {
						days: 365,
						autoCleanup: false,
					},
				},
			},
			sftp: {
				sftp: {
					host: '',
					port: 22,
					path: '/uploads/compliance',
				},
			},
			download: {
				download: {
					expiryHours: 24,
				},
			},
		}

		updateFormData({
			type,
			config: defaultConfigs[type],
		})
		setCurrentStep('details')
	}

	const renderConfigForm = () => {
		if (!formData.type || !formData.config) return null

		const configErrors = Object.entries(errors)
			.filter(([key]) => key.startsWith('config.'))
			.reduce(
				(acc, [key, value]) => {
					const configKey = key.replace(`config.${formData.type}.`, '')
					acc[configKey] = value
					return acc
				},
				{} as Record<string, string>
			)

		switch (formData.type) {
			case 'email':
				return (
					<EmailDestinationConfig
						value={formData.config.email!}
						onChange={(email) => updateConfig({ ...formData.config, email })}
						errors={configErrors}
					/>
				)
			case 'webhook':
				return (
					<WebhookDestinationConfig
						value={formData.config.webhook!}
						onChange={(webhook) => updateConfig({ ...formData.config, webhook })}
						errors={configErrors}
					/>
				)
			case 'storage':
				return (
					<StorageDestinationConfig
						value={formData.config.storage!}
						onChange={(storage) => updateConfig({ ...formData.config, storage })}
						errors={configErrors}
					/>
				)
			case 'sftp':
				return (
					<SftpDestinationConfig
						value={formData.config.sftp!}
						onChange={(sftp) => updateConfig({ ...formData.config, sftp })}
						errors={configErrors}
					/>
				)
			case 'download':
				return (
					<DownloadDestinationConfig
						value={formData.config.download!}
						onChange={(download) => updateConfig({ ...formData.config, download })}
						errors={configErrors}
					/>
				)
			default:
				return null
		}
	}

	return (
		<form onSubmit={handleSubmit} className="space-y-8">
			{/* Step 1: Type Selection */}
			{currentStep === 'type' && (
				<DestinationTypeSelector
					value={formData.type}
					onChange={handleTypeSelect}
					disabled={loading}
				/>
			)}

			{/* Step 2: Basic Details */}
			{currentStep === 'details' && (
				<div className="space-y-6">
					<div>
						<h3 className="text-lg font-medium">Destination Details</h3>
						<p className="text-sm text-muted-foreground">
							Provide basic information about this delivery destination
						</p>
					</div>

					<div className="space-y-2">
						<Label htmlFor="label">
							Label <span className="text-destructive">*</span>
						</Label>
						<Input
							id="label"
							placeholder="Production Email Delivery"
							value={formData.label}
							onChange={(e) => updateFormData({ label: e.target.value })}
							disabled={loading}
						/>
						{errors.label && <p className="text-sm text-destructive">{errors.label}</p>}
					</div>

					<div className="space-y-2">
						<Label htmlFor="description">Description</Label>
						<Textarea
							id="description"
							placeholder="Describe the purpose of this destination..."
							value={formData.description}
							onChange={(e) => updateFormData({ description: e.target.value })}
							disabled={loading}
							rows={3}
						/>
					</div>

					<div className="flex gap-2">
						<Button
							type="button"
							variant="outline"
							onClick={() => setCurrentStep('type')}
							disabled={loading}
						>
							Back
						</Button>
						<Button
							type="button"
							onClick={() => setCurrentStep('config')}
							disabled={loading || !formData.label?.trim()}
						>
							Next: Configuration
						</Button>
					</div>
				</div>
			)}

			{/* Step 3: Configuration */}
			{currentStep === 'config' && (
				<div className="space-y-6">
					<div>
						<h3 className="text-lg font-medium">Configuration</h3>
						<p className="text-sm text-muted-foreground">
							Configure the delivery settings for {formData.type}
						</p>
					</div>

					{renderConfigForm()}

					{/* Validation Results */}
					{validation && (
						<div className="pt-4 border-t">
							<ValidationFeedback validation={validation} />
						</div>
					)}

					{/* Action Buttons */}
					<div className="flex gap-2 pt-4 border-t">
						<Button
							type="button"
							variant="outline"
							onClick={() => setCurrentStep('details')}
							disabled={loading || validating}
						>
							Back
						</Button>

						{/* Validate Button (for existing destinations) */}
						{destinationId && onValidate && (
							<Button
								type="button"
								variant="outline"
								onClick={handleValidate}
								disabled={loading || validating}
							>
								{validating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
								{!validating && validation?.isValid && (
									<CheckCircle2 className="mr-2 h-4 w-4 text-green-600" />
								)}
								Validate Configuration
							</Button>
						)}

						{/* Test Connection Button (for existing destinations) */}
						{destinationId && onTestConnection && (
							<Button
								type="button"
								variant="outline"
								onClick={handleOpenTestDialog}
								disabled={loading || validating}
							>
								<TestTube className="mr-2 h-4 w-4" />
								Test Connection
							</Button>
						)}

						<Button type="submit" disabled={loading || validating}>
							{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
							{initialData ? 'Update Destination' : 'Create Destination'}
						</Button>

						{onCancel && (
							<Button
								type="button"
								variant="ghost"
								onClick={onCancel}
								disabled={loading || validating}
							>
								Cancel
							</Button>
						)}
					</div>
				</div>
			)}

			{/* Test Connection Dialog */}
			{destinationId && formData.label && (
				<TestDestinationDialog
					open={testDialogOpen}
					onOpenChange={setTestDialogOpen}
					destinationId={destinationId}
					destinationLabel={formData.label}
					onTest={handleTestConnection}
				/>
			)}
		</form>
	)
}
