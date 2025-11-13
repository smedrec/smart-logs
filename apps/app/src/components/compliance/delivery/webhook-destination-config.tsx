import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import { Plus, X } from 'lucide-react'
import * as React from 'react'

interface WebhookConfig {
	url: string
	method: 'POST' | 'PUT'
	headers: Record<string, string>
	timeout: number
	retryConfig: {
		maxRetries: number
		backoffMultiplier: number
		maxBackoffDelay: number
	}
}

interface WebhookDestinationConfigProps {
	value: WebhookConfig
	onChange: (config: WebhookConfig) => void
	errors?: Record<string, string>
}

export function WebhookDestinationConfig({
	value,
	onChange,
	errors = {},
}: WebhookDestinationConfigProps) {
	const [newHeaderKey, setNewHeaderKey] = React.useState('')
	const [newHeaderValue, setNewHeaderValue] = React.useState('')

	const updateConfig = (updates: Partial<WebhookConfig>) => {
		onChange({ ...value, ...updates })
	}

	const updateRetryConfig = (updates: Partial<WebhookConfig['retryConfig']>) => {
		onChange({
			...value,
			retryConfig: {
				...value.retryConfig,
				...updates,
			},
		})
	}

	const addHeader = () => {
		if (newHeaderKey && newHeaderValue) {
			onChange({
				...value,
				headers: {
					...value.headers,
					[newHeaderKey]: newHeaderValue,
				},
			})
			setNewHeaderKey('')
			setNewHeaderValue('')
		}
	}

	const removeHeader = (key: string) => {
		const { [key]: _, ...rest } = value.headers
		onChange({
			...value,
			headers: rest,
		})
	}

	return (
		<div className="space-y-6">
			{/* Webhook URL */}
			<div className="space-y-2">
				<Label htmlFor="webhook-url">Webhook URL</Label>
				<Input
					id="webhook-url"
					type="url"
					placeholder="https://api.example.com/webhooks/compliance"
					value={value.url}
					onChange={(e) => updateConfig({ url: e.target.value })}
				/>
				{errors.url && <p className="text-sm text-destructive">{errors.url}</p>}
				<p className="text-sm text-muted-foreground">
					The endpoint where compliance reports will be sent
				</p>
			</div>

			{/* HTTP Method */}
			<div className="space-y-2">
				<Label htmlFor="webhook-method">HTTP Method</Label>
				<Select
					value={value.method}
					onValueChange={(val) => updateConfig({ method: val as 'POST' | 'PUT' })}
				>
					<SelectTrigger id="webhook-method">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="POST">POST</SelectItem>
						<SelectItem value="PUT">PUT</SelectItem>
					</SelectContent>
				</Select>
				{errors.method && <p className="text-sm text-destructive">{errors.method}</p>}
			</div>

			{/* Custom Headers */}
			<div className="space-y-2">
				<Label>Custom Headers</Label>
				<div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
					<Input
						placeholder="Header name"
						value={newHeaderKey}
						onChange={(e) => setNewHeaderKey(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === 'Enter') {
								e.preventDefault()
								addHeader()
							}
						}}
					/>
					<Input
						placeholder="Header value"
						value={newHeaderValue}
						onChange={(e) => setNewHeaderValue(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === 'Enter') {
								e.preventDefault()
								addHeader()
							}
						}}
					/>
					<Button type="button" onClick={addHeader} size="icon" variant="outline">
						<Plus className="h-4 w-4" />
					</Button>
				</div>

				{Object.keys(value.headers).length > 0 && (
					<div className="space-y-2 rounded-lg border p-3">
						{Object.entries(value.headers).map(([key, val]) => (
							<div key={key} className="flex items-center justify-between gap-2">
								<div className="flex-1 grid grid-cols-2 gap-2 text-sm">
									<span className="font-mono font-medium">{key}:</span>
									<span className="font-mono text-muted-foreground truncate">{val}</span>
								</div>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									className="h-6 w-6 p-0"
									onClick={() => removeHeader(key)}
								>
									<X className="h-3 w-3" />
								</Button>
							</div>
						))}
					</div>
				)}
				<p className="text-sm text-muted-foreground">
					Add custom headers like Authorization, Content-Type, etc.
				</p>
			</div>

			{/* Timeout */}
			<div className="space-y-2">
				<Label htmlFor="webhook-timeout">Request Timeout (ms)</Label>
				<Input
					id="webhook-timeout"
					type="number"
					min="1000"
					max="300000"
					step="1000"
					value={value.timeout}
					onChange={(e) => updateConfig({ timeout: parseInt(e.target.value) || 30000 })}
				/>
				{errors.timeout && <p className="text-sm text-destructive">{errors.timeout}</p>}
				<p className="text-sm text-muted-foreground">
					Maximum time to wait for webhook response (1-300 seconds)
				</p>
			</div>

			{/* Retry Configuration */}
			<div className="space-y-4 rounded-lg border p-4">
				<h4 className="font-medium">Retry Configuration</h4>

				<div className="space-y-2">
					<Label htmlFor="max-retries">Maximum Retries</Label>
					<Input
						id="max-retries"
						type="number"
						min="0"
						max="10"
						value={value.retryConfig.maxRetries}
						onChange={(e) => updateRetryConfig({ maxRetries: parseInt(e.target.value) || 0 })}
					/>
					{errors['retryConfig.maxRetries'] && (
						<p className="text-sm text-destructive">{errors['retryConfig.maxRetries']}</p>
					)}
					<p className="text-sm text-muted-foreground">
						Number of retry attempts on failure (0-10)
					</p>
				</div>

				<div className="space-y-2">
					<Label htmlFor="backoff-multiplier">Backoff Multiplier</Label>
					<Input
						id="backoff-multiplier"
						type="number"
						min="1"
						max="10"
						step="0.5"
						value={value.retryConfig.backoffMultiplier}
						onChange={(e) =>
							updateRetryConfig({ backoffMultiplier: parseFloat(e.target.value) || 2 })
						}
					/>
					{errors['retryConfig.backoffMultiplier'] && (
						<p className="text-sm text-destructive">{errors['retryConfig.backoffMultiplier']}</p>
					)}
					<p className="text-sm text-muted-foreground">Exponential backoff multiplier (1-10)</p>
				</div>

				<div className="space-y-2">
					<Label htmlFor="max-backoff">Maximum Backoff Delay (ms)</Label>
					<Input
						id="max-backoff"
						type="number"
						min="1000"
						max="3600000"
						step="1000"
						value={value.retryConfig.maxBackoffDelay}
						onChange={(e) =>
							updateRetryConfig({ maxBackoffDelay: parseInt(e.target.value) || 60000 })
						}
					/>
					{errors['retryConfig.maxBackoffDelay'] && (
						<p className="text-sm text-destructive">{errors['retryConfig.maxBackoffDelay']}</p>
					)}
					<p className="text-sm text-muted-foreground">
						Maximum delay between retries (1-3600 seconds)
					</p>
				</div>
			</div>
		</div>
	)
}
