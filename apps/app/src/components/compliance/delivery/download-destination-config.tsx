import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, X } from 'lucide-react'
import * as React from 'react'

interface DownloadConfig {
	baseUrl?: string
	expiryHours: number
	maxAccess?: number
	allowedIpRanges?: string[]
}

interface DownloadDestinationConfigProps {
	value: DownloadConfig
	onChange: (config: DownloadConfig) => void
	errors?: Record<string, string>
}

export function DownloadDestinationConfig({
	value,
	onChange,
	errors = {},
}: DownloadDestinationConfigProps) {
	const [newIpRange, setNewIpRange] = React.useState('')

	const updateConfig = (updates: Partial<DownloadConfig>) => {
		onChange({ ...value, ...updates })
	}

	const addIpRange = () => {
		if (newIpRange) {
			const ipRanges = value.allowedIpRanges || []
			onChange({
				...value,
				allowedIpRanges: [...ipRanges, newIpRange],
			})
			setNewIpRange('')
		}
	}

	const removeIpRange = (index: number) => {
		const ipRanges = value.allowedIpRanges || []
		onChange({
			...value,
			allowedIpRanges: ipRanges.filter((_, i) => i !== index),
		})
	}

	return (
		<div className="space-y-6">
			{/* Base URL */}
			<div className="space-y-2">
				<Label htmlFor="download-base-url">Base URL (Optional)</Label>
				<Input
					id="download-base-url"
					type="url"
					placeholder="https://reports.example.com"
					value={value.baseUrl || ''}
					onChange={(e) => updateConfig({ baseUrl: e.target.value })}
				/>
				{errors.baseUrl && <p className="text-sm text-destructive">{errors.baseUrl}</p>}
				<p className="text-sm text-muted-foreground">
					Custom domain for download links. Leave empty to use default system URL
				</p>
			</div>

			{/* Expiry Hours */}
			<div className="space-y-2">
				<Label htmlFor="download-expiry">Link Expiry (hours)</Label>
				<Input
					id="download-expiry"
					type="number"
					min="1"
					max="8760"
					value={value.expiryHours}
					onChange={(e) => updateConfig({ expiryHours: parseInt(e.target.value) || 24 })}
				/>
				{errors.expiryHours && <p className="text-sm text-destructive">{errors.expiryHours}</p>}
				<p className="text-sm text-muted-foreground">
					How long download links remain valid (1-8760 hours / 1 year)
				</p>
			</div>

			{/* Max Access Count */}
			<div className="space-y-2">
				<Label htmlFor="download-max-access">Maximum Access Count (Optional)</Label>
				<Input
					id="download-max-access"
					type="number"
					min="1"
					max="1000"
					placeholder="Unlimited"
					value={value.maxAccess || ''}
					onChange={(e) =>
						updateConfig({ maxAccess: e.target.value ? parseInt(e.target.value) : undefined })
					}
				/>
				{errors.maxAccess && <p className="text-sm text-destructive">{errors.maxAccess}</p>}
				<p className="text-sm text-muted-foreground">
					Limit how many times a link can be accessed. Leave empty for unlimited
				</p>
			</div>

			{/* IP Restrictions */}
			<div className="space-y-2">
				<Label>Allowed IP Ranges (Optional)</Label>
				<div className="flex gap-2">
					<Input
						placeholder="192.168.1.0/24 or 10.0.0.1"
						value={newIpRange}
						onChange={(e) => setNewIpRange(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === 'Enter') {
								e.preventDefault()
								addIpRange()
							}
						}}
					/>
					<Button type="button" onClick={addIpRange} size="icon" variant="outline">
						<Plus className="h-4 w-4" />
					</Button>
				</div>

				{value.allowedIpRanges && value.allowedIpRanges.length > 0 && (
					<div className="space-y-2 rounded-lg border p-3">
						{value.allowedIpRanges.map((ipRange, index) => (
							<div key={index} className="flex items-center justify-between gap-2">
								<span className="font-mono text-sm">{ipRange}</span>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									className="h-6 w-6 p-0"
									onClick={() => removeIpRange(index)}
								>
									<X className="h-3 w-3" />
								</Button>
							</div>
						))}
					</div>
				)}

				<p className="text-sm text-muted-foreground">
					Restrict downloads to specific IP addresses or CIDR ranges. Leave empty to allow all IPs
				</p>
			</div>

			{/* Security Notice */}
			<div className="rounded-lg border border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20 p-4">
				<h4 className="font-medium text-yellow-700 dark:text-yellow-400 mb-2">
					Security Considerations
				</h4>
				<ul className="text-sm text-yellow-700 dark:text-yellow-400 space-y-1 list-disc list-inside">
					<li>Download links are secured with unique tokens</li>
					<li>Links expire automatically after the specified time</li>
					<li>Access is logged for audit purposes</li>
					<li>Consider using IP restrictions for sensitive reports</li>
				</ul>
			</div>
		</div>
	)
}
