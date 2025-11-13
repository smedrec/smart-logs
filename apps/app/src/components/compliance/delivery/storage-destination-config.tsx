import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import * as React from 'react'

interface StorageConfig {
	provider: 'local' | 's3' | 'azure' | 'gcp'
	config: Record<string, any>
	path: string
	retention: {
		days: number
		autoCleanup: boolean
	}
}

interface StorageDestinationConfigProps {
	value: StorageConfig
	onChange: (config: StorageConfig) => void
	errors?: Record<string, string>
}

export function StorageDestinationConfig({
	value,
	onChange,
	errors = {},
}: StorageDestinationConfigProps) {
	const updateConfig = (updates: Partial<StorageConfig>) => {
		onChange({ ...value, ...updates })
	}

	const updateProviderConfig = (key: string, val: any) => {
		onChange({
			...value,
			config: {
				...value.config,
				[key]: val,
			},
		})
	}

	const updateRetention = (updates: Partial<StorageConfig['retention']>) => {
		onChange({
			...value,
			retention: {
				...value.retention,
				...updates,
			},
		})
	}

	return (
		<div className="space-y-6">
			{/* Storage Provider */}
			<div className="space-y-2">
				<Label htmlFor="storage-provider">Storage Provider</Label>
				<Select
					value={value.provider}
					onValueChange={(val) =>
						updateConfig({ provider: val as StorageConfig['provider'], config: {} })
					}
				>
					<SelectTrigger id="storage-provider">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="local">Local Filesystem</SelectItem>
						<SelectItem value="s3">Amazon S3</SelectItem>
						<SelectItem value="azure">Azure Blob Storage</SelectItem>
						<SelectItem value="gcp">Google Cloud Storage</SelectItem>
					</SelectContent>
				</Select>
				{errors.provider && <p className="text-sm text-destructive">{errors.provider}</p>}
			</div>

			{/* Local Storage Configuration */}
			{value.provider === 'local' && (
				<div className="space-y-4 rounded-lg border p-4">
					<h4 className="font-medium">Local Storage Configuration</h4>
					<div className="space-y-2">
						<Label htmlFor="local-base-path">Base Directory Path</Label>
						<Input
							id="local-base-path"
							placeholder="/var/compliance/reports"
							value={value.config.basePath || ''}
							onChange={(e) => updateProviderConfig('basePath', e.target.value)}
						/>
						<p className="text-sm text-muted-foreground">
							Absolute path where reports will be stored
						</p>
					</div>
				</div>
			)}

			{/* S3 Configuration */}
			{value.provider === 's3' && (
				<div className="space-y-4 rounded-lg border p-4">
					<h4 className="font-medium">Amazon S3 Configuration</h4>

					<div className="space-y-2">
						<Label htmlFor="s3-bucket">Bucket Name</Label>
						<Input
							id="s3-bucket"
							placeholder="my-compliance-reports"
							value={value.config.bucket || ''}
							onChange={(e) => updateProviderConfig('bucket', e.target.value)}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="s3-region">Region</Label>
						<Input
							id="s3-region"
							placeholder="us-east-1"
							value={value.config.region || ''}
							onChange={(e) => updateProviderConfig('region', e.target.value)}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="s3-access-key">Access Key ID</Label>
						<Input
							id="s3-access-key"
							placeholder="AKIAIOSFODNN7EXAMPLE"
							value={value.config.accessKeyId || ''}
							onChange={(e) => updateProviderConfig('accessKeyId', e.target.value)}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="s3-secret-key">Secret Access Key</Label>
						<Input
							id="s3-secret-key"
							type="password"
							placeholder="••••••••"
							value={value.config.secretAccessKey || ''}
							onChange={(e) => updateProviderConfig('secretAccessKey', e.target.value)}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="s3-endpoint">Custom Endpoint (Optional)</Label>
						<Input
							id="s3-endpoint"
							placeholder="https://s3.example.com"
							value={value.config.endpoint || ''}
							onChange={(e) => updateProviderConfig('endpoint', e.target.value)}
						/>
						<p className="text-sm text-muted-foreground">For S3-compatible services like MinIO</p>
					</div>
				</div>
			)}

			{/* Azure Configuration */}
			{value.provider === 'azure' && (
				<div className="space-y-4 rounded-lg border p-4">
					<h4 className="font-medium">Azure Blob Storage Configuration</h4>

					<div className="space-y-2">
						<Label htmlFor="azure-account">Storage Account Name</Label>
						<Input
							id="azure-account"
							placeholder="mycomplianceaccount"
							value={value.config.accountName || ''}
							onChange={(e) => updateProviderConfig('accountName', e.target.value)}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="azure-key">Account Key</Label>
						<Input
							id="azure-key"
							type="password"
							placeholder="••••••••"
							value={value.config.accountKey || ''}
							onChange={(e) => updateProviderConfig('accountKey', e.target.value)}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="azure-container">Container Name</Label>
						<Input
							id="azure-container"
							placeholder="compliance-reports"
							value={value.config.containerName || ''}
							onChange={(e) => updateProviderConfig('containerName', e.target.value)}
						/>
					</div>
				</div>
			)}

			{/* GCP Configuration */}
			{value.provider === 'gcp' && (
				<div className="space-y-4 rounded-lg border p-4">
					<h4 className="font-medium">Google Cloud Storage Configuration</h4>

					<div className="space-y-2">
						<Label htmlFor="gcp-bucket">Bucket Name</Label>
						<Input
							id="gcp-bucket"
							placeholder="my-compliance-reports"
							value={value.config.bucketName || ''}
							onChange={(e) => updateProviderConfig('bucketName', e.target.value)}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="gcp-project">Project ID</Label>
						<Input
							id="gcp-project"
							placeholder="my-project-123456"
							value={value.config.projectId || ''}
							onChange={(e) => updateProviderConfig('projectId', e.target.value)}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="gcp-credentials">Service Account Key (JSON)</Label>
						<Textarea
							id="gcp-credentials"
							placeholder='{"type": "service_account", ...}'
							value={value.config.credentials || ''}
							onChange={(e) => updateProviderConfig('credentials', e.target.value)}
							rows={6}
							className="font-mono text-sm"
						/>
						<p className="text-sm text-muted-foreground">
							Paste the entire service account JSON key
						</p>
					</div>
				</div>
			)}

			{/* Storage Path */}
			<div className="space-y-2">
				<Label htmlFor="storage-path">Storage Path</Label>
				<Input
					id="storage-path"
					placeholder="compliance/reports/{{organizationId}}/{{year}}/{{month}}"
					value={value.path}
					onChange={(e) => updateConfig({ path: e.target.value })}
				/>
				{errors.path && <p className="text-sm text-destructive">{errors.path}</p>}
				<p className="text-sm text-muted-foreground">
					Path template. Use {'{{organizationId}}'}, {'{{year}}'}, {'{{month}}'}, {'{{day}}'} as
					placeholders
				</p>
			</div>

			{/* Retention Policy */}
			<div className="space-y-4 rounded-lg border p-4">
				<h4 className="font-medium">Retention Policy</h4>

				<div className="space-y-2">
					<Label htmlFor="retention-days">Retention Period (days)</Label>
					<Input
						id="retention-days"
						type="number"
						min="1"
						max="3650"
						value={value.retention.days}
						onChange={(e) => updateRetention({ days: parseInt(e.target.value) || 365 })}
					/>
					{errors['retention.days'] && (
						<p className="text-sm text-destructive">{errors['retention.days']}</p>
					)}
					<p className="text-sm text-muted-foreground">
						How long to keep reports before deletion (1-3650 days)
					</p>
				</div>

				<div className="flex items-center space-x-2">
					<Switch
						id="auto-cleanup"
						checked={value.retention.autoCleanup}
						onCheckedChange={(checked) => updateRetention({ autoCleanup: checked })}
					/>
					<Label htmlFor="auto-cleanup">Enable automatic cleanup</Label>
				</div>
				<p className="text-sm text-muted-foreground">
					Automatically delete reports older than the retention period
				</p>
			</div>
		</div>
	)
}
