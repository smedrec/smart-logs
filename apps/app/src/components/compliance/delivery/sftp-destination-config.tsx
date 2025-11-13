import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import * as React from 'react'

interface SftpConfig {
	host: string
	port: number
	username?: string
	password?: string
	privateKey?: string
	path: string
	filename?: string
}

interface SftpDestinationConfigProps {
	value: SftpConfig
	onChange: (config: SftpConfig) => void
	errors?: Record<string, string>
}

export function SftpDestinationConfig({
	value,
	onChange,
	errors = {},
}: SftpDestinationConfigProps) {
	const [authMethod, setAuthMethod] = React.useState<'password' | 'key'>(
		value.privateKey ? 'key' : 'password'
	)

	const updateConfig = (updates: Partial<SftpConfig>) => {
		onChange({ ...value, ...updates })
	}

	const handleAuthMethodChange = (method: 'password' | 'key') => {
		setAuthMethod(method)
		if (method === 'password') {
			updateConfig({ privateKey: undefined })
		} else {
			updateConfig({ password: undefined })
		}
	}

	return (
		<div className="space-y-6">
			{/* Host */}
			<div className="space-y-2">
				<Label htmlFor="sftp-host">SFTP Host</Label>
				<Input
					id="sftp-host"
					placeholder="sftp.example.com"
					value={value.host}
					onChange={(e) => updateConfig({ host: e.target.value })}
				/>
				{errors.host && <p className="text-sm text-destructive">{errors.host}</p>}
			</div>

			{/* Port */}
			<div className="space-y-2">
				<Label htmlFor="sftp-port">Port</Label>
				<Input
					id="sftp-port"
					type="number"
					min="1"
					max="65535"
					placeholder="22"
					value={value.port}
					onChange={(e) => updateConfig({ port: parseInt(e.target.value) || 22 })}
				/>
				{errors.port && <p className="text-sm text-destructive">{errors.port}</p>}
				<p className="text-sm text-muted-foreground">Default SFTP port is 22</p>
			</div>

			{/* Username */}
			<div className="space-y-2">
				<Label htmlFor="sftp-username">Username</Label>
				<Input
					id="sftp-username"
					placeholder="ftpuser"
					value={value.username || ''}
					onChange={(e) => updateConfig({ username: e.target.value })}
				/>
				{errors.username && <p className="text-sm text-destructive">{errors.username}</p>}
			</div>

			{/* Authentication Method */}
			<div className="space-y-4 rounded-lg border p-4">
				<h4 className="font-medium">Authentication Method</h4>

				<RadioGroup value={authMethod} onValueChange={handleAuthMethodChange}>
					<div className="flex items-center space-x-2">
						<RadioGroupItem value="password" id="auth-password" />
						<Label htmlFor="auth-password">Password</Label>
					</div>
					<div className="flex items-center space-x-2">
						<RadioGroupItem value="key" id="auth-key" />
						<Label htmlFor="auth-key">Private Key</Label>
					</div>
				</RadioGroup>

				{authMethod === 'password' && (
					<div className="space-y-2">
						<Label htmlFor="sftp-password">Password</Label>
						<Input
							id="sftp-password"
							type="password"
							placeholder="••••••••"
							value={value.password || ''}
							onChange={(e) => updateConfig({ password: e.target.value })}
						/>
						{errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
					</div>
				)}

				{authMethod === 'key' && (
					<div className="space-y-2">
						<Label htmlFor="sftp-private-key">Private Key</Label>
						<Textarea
							id="sftp-private-key"
							placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;...&#10;-----END RSA PRIVATE KEY-----"
							value={value.privateKey || ''}
							onChange={(e) => updateConfig({ privateKey: e.target.value })}
							rows={8}
							className="font-mono text-sm"
						/>
						{errors.privateKey && <p className="text-sm text-destructive">{errors.privateKey}</p>}
						<p className="text-sm text-muted-foreground">
							Paste your SSH private key (RSA, ECDSA, or Ed25519)
						</p>
					</div>
				)}
			</div>

			{/* Remote Path */}
			<div className="space-y-2">
				<Label htmlFor="sftp-path">Remote Path</Label>
				<Input
					id="sftp-path"
					placeholder="/uploads/compliance/{{organizationId}}"
					value={value.path}
					onChange={(e) => updateConfig({ path: e.target.value })}
				/>
				{errors.path && <p className="text-sm text-destructive">{errors.path}</p>}
				<p className="text-sm text-muted-foreground">
					Directory path on the SFTP server. Use {'{{organizationId}}'}, {'{{year}}'}, {'{{month}}'}
					as placeholders
				</p>
			</div>

			{/* Filename Template */}
			<div className="space-y-2">
				<Label htmlFor="sftp-filename">Filename Template (Optional)</Label>
				<Input
					id="sftp-filename"
					placeholder="report-{{reportType}}-{{date}}.pdf"
					value={value.filename || ''}
					onChange={(e) => updateConfig({ filename: e.target.value })}
				/>
				<p className="text-sm text-muted-foreground">
					Default: report-{'{{reportType}}'}-{'{{timestamp}}'}.pdf. Use {'{{reportType}}'},
					{'{{date}}'}, {'{{timestamp}}'} as placeholders
				</p>
			</div>
		</div>
	)
}
