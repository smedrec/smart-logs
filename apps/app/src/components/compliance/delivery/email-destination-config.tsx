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
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Plus, X } from 'lucide-react'
import * as React from 'react'

interface EmailConfig {
	service: string
	smtpConfig?: {
		host: string
		port: number
		secure: boolean
		auth: {
			user: string
			pass: string
		}
	}
	apiKey?: string
	from: string
	subject: string
	bodyTemplate?: string
	attachmentName?: string
	recipients?: string[]
}

interface EmailDestinationConfigProps {
	value: EmailConfig
	onChange: (config: EmailConfig) => void
	errors?: Record<string, string>
}

export function EmailDestinationConfig({
	value,
	onChange,
	errors = {},
}: EmailDestinationConfigProps) {
	const [newRecipient, setNewRecipient] = React.useState('')

	const updateConfig = (updates: Partial<EmailConfig>) => {
		onChange({ ...value, ...updates })
	}

	const updateSmtpConfig = (updates: Partial<NonNullable<EmailConfig['smtpConfig']>>) => {
		onChange({
			...value,
			smtpConfig: {
				...value.smtpConfig!,
				...updates,
			},
		})
	}

	const updateSmtpAuth = (updates: Partial<NonNullable<EmailConfig['smtpConfig']>['auth']>) => {
		onChange({
			...value,
			smtpConfig: {
				...value.smtpConfig!,
				auth: {
					...value.smtpConfig!.auth,
					...updates,
				},
			},
		})
	}

	const addRecipient = () => {
		if (newRecipient && newRecipient.includes('@')) {
			const recipients = value.recipients || []
			onChange({
				...value,
				recipients: [...recipients, newRecipient],
			})
			setNewRecipient('')
		}
	}

	const removeRecipient = (index: number) => {
		const recipients = value.recipients || []
		onChange({
			...value,
			recipients: recipients.filter((_, i) => i !== index),
		})
	}

	const isSmtp = value.service === 'smtp'
	const isApi = value.service === 'api'

	return (
		<div className="space-y-6">
			{/* Service Type */}
			<div className="space-y-2">
				<Label htmlFor="email-service">Email Service</Label>
				<Select value={value.service} onValueChange={(val) => updateConfig({ service: val })}>
					<SelectTrigger id="email-service">
						<SelectValue placeholder="Select email service" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="smtp">SMTP Server</SelectItem>
						<SelectItem value="api">Email API (SendGrid, Mailgun, etc.)</SelectItem>
					</SelectContent>
				</Select>
				{errors.service && <p className="text-sm text-destructive">{errors.service}</p>}
			</div>

			{/* SMTP Configuration */}
			{isSmtp && (
				<div className="space-y-4 rounded-lg border p-4">
					<h4 className="font-medium">SMTP Configuration</h4>

					<div className="grid gap-4 sm:grid-cols-2">
						<div className="space-y-2">
							<Label htmlFor="smtp-host">SMTP Host</Label>
							<Input
								id="smtp-host"
								placeholder="smtp.example.com"
								value={value.smtpConfig?.host || ''}
								onChange={(e) => updateSmtpConfig({ host: e.target.value })}
							/>
							{errors['smtpConfig.host'] && (
								<p className="text-sm text-destructive">{errors['smtpConfig.host']}</p>
							)}
						</div>

						<div className="space-y-2">
							<Label htmlFor="smtp-port">Port</Label>
							<Input
								id="smtp-port"
								type="number"
								placeholder="587"
								value={value.smtpConfig?.port || ''}
								onChange={(e) => updateSmtpConfig({ port: parseInt(e.target.value) || 587 })}
							/>
							{errors['smtpConfig.port'] && (
								<p className="text-sm text-destructive">{errors['smtpConfig.port']}</p>
							)}
						</div>
					</div>

					<div className="flex items-center space-x-2">
						<Switch
							id="smtp-secure"
							checked={value.smtpConfig?.secure || false}
							onCheckedChange={(checked) => updateSmtpConfig({ secure: checked })}
						/>
						<Label htmlFor="smtp-secure">Use TLS/SSL</Label>
					</div>

					<div className="grid gap-4 sm:grid-cols-2">
						<div className="space-y-2">
							<Label htmlFor="smtp-user">Username</Label>
							<Input
								id="smtp-user"
								placeholder="user@example.com"
								value={value.smtpConfig?.auth?.user || ''}
								onChange={(e) => updateSmtpAuth({ user: e.target.value })}
							/>
							{errors['smtpConfig.auth.user'] && (
								<p className="text-sm text-destructive">{errors['smtpConfig.auth.user']}</p>
							)}
						</div>

						<div className="space-y-2">
							<Label htmlFor="smtp-pass">Password</Label>
							<Input
								id="smtp-pass"
								type="password"
								placeholder="••••••••"
								value={value.smtpConfig?.auth?.pass || ''}
								onChange={(e) => updateSmtpAuth({ pass: e.target.value })}
							/>
							{errors['smtpConfig.auth.pass'] && (
								<p className="text-sm text-destructive">{errors['smtpConfig.auth.pass']}</p>
							)}
						</div>
					</div>
				</div>
			)}

			{/* API Configuration */}
			{isApi && (
				<div className="space-y-2">
					<Label htmlFor="api-key">API Key</Label>
					<Input
						id="api-key"
						type="password"
						placeholder="Enter your email service API key"
						value={value.apiKey || ''}
						onChange={(e) => updateConfig({ apiKey: e.target.value })}
					/>
					{errors.apiKey && <p className="text-sm text-destructive">{errors.apiKey}</p>}
				</div>
			)}

			{/* From Address */}
			<div className="space-y-2">
				<Label htmlFor="from-address">From Address</Label>
				<Input
					id="from-address"
					type="email"
					placeholder="noreply@example.com"
					value={value.from}
					onChange={(e) => updateConfig({ from: e.target.value })}
				/>
				{errors.from && <p className="text-sm text-destructive">{errors.from}</p>}
			</div>

			{/* Subject */}
			<div className="space-y-2">
				<Label htmlFor="subject">Email Subject</Label>
				<Input
					id="subject"
					placeholder="Compliance Report - {{reportName}}"
					value={value.subject}
					onChange={(e) => updateConfig({ subject: e.target.value })}
				/>
				<p className="text-sm text-muted-foreground">
					Use {'{{reportName}}'}, {'{{date}}'}, {'{{organizationName}}'} as placeholders
				</p>
				{errors.subject && <p className="text-sm text-destructive">{errors.subject}</p>}
			</div>

			{/* Body Template */}
			<div className="space-y-2">
				<Label htmlFor="body-template">Email Body Template (Optional)</Label>
				<Textarea
					id="body-template"
					placeholder="Your compliance report is attached..."
					value={value.bodyTemplate || ''}
					onChange={(e) => updateConfig({ bodyTemplate: e.target.value })}
					rows={4}
				/>
				<p className="text-sm text-muted-foreground">
					Leave empty for default template. Supports same placeholders as subject.
				</p>
			</div>

			{/* Attachment Name */}
			<div className="space-y-2">
				<Label htmlFor="attachment-name">Attachment Filename (Optional)</Label>
				<Input
					id="attachment-name"
					placeholder="report-{{date}}.pdf"
					value={value.attachmentName || ''}
					onChange={(e) => updateConfig({ attachmentName: e.target.value })}
				/>
				<p className="text-sm text-muted-foreground">
					Default: report-{'{{reportType}}'}-{'{{date}}'}.pdf
				</p>
			</div>

			{/* Recipients */}
			<div className="space-y-2">
				<Label>Default Recipients (Optional)</Label>
				<div className="flex gap-2">
					<Input
						placeholder="recipient@example.com"
						value={newRecipient}
						onChange={(e) => setNewRecipient(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === 'Enter') {
								e.preventDefault()
								addRecipient()
							}
						}}
					/>
					<Button type="button" onClick={addRecipient} size="icon" variant="outline">
						<Plus className="h-4 w-4" />
					</Button>
				</div>
				{value.recipients && value.recipients.length > 0 && (
					<div className="flex flex-wrap gap-2 mt-2">
						{value.recipients.map((recipient, index) => (
							<div
								key={index}
								className="flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-sm"
							>
								<span>{recipient}</span>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									className="h-4 w-4 p-0"
									onClick={() => removeRecipient(index)}
								>
									<X className="h-3 w-3" />
								</Button>
							</div>
						))}
					</div>
				)}
				<p className="text-sm text-muted-foreground">
					These recipients will be used by default unless overridden in report configuration
				</p>
			</div>
		</div>
	)
}
