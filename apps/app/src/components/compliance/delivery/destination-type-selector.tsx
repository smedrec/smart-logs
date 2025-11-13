import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { cn } from '@/lib/utils'
import { Cloud, Database, Download, Mail, Server, Webhook } from 'lucide-react'
import * as React from 'react'

import type { DeliveryDestinationType } from '@smedrec/audit-client'

interface DestinationTypeOption {
	value: DeliveryDestinationType
	label: string
	description: string
	icon: React.ComponentType<{ className?: string }>
}

const destinationTypes: DestinationTypeOption[] = [
	{
		value: 'email',
		label: 'Email',
		description: 'Send reports via email using SMTP or email service APIs',
		icon: Mail,
	},
	{
		value: 'webhook',
		label: 'Webhook',
		description: 'POST reports to a webhook URL with custom headers and retry logic',
		icon: Webhook,
	},
	{
		value: 'storage',
		label: 'Cloud Storage',
		description: 'Store reports in S3, Azure Blob, GCP Storage, or local filesystem',
		icon: Database,
	},
	{
		value: 'sftp',
		label: 'SFTP',
		description: 'Transfer reports to an SFTP server with SSH authentication',
		icon: Server,
	},
	{
		value: 'download',
		label: 'Download Link',
		description: 'Generate secure download links with expiry and access controls',
		icon: Download,
	},
]

interface DestinationTypeSelectorProps {
	value?: DeliveryDestinationType
	onChange: (type: DeliveryDestinationType) => void
	disabled?: boolean
	className?: string
}

export function DestinationTypeSelector({
	value,
	onChange,
	disabled = false,
	className,
}: DestinationTypeSelectorProps) {
	return (
		<div className={cn('space-y-4', className)}>
			<div>
				<h3 className="text-lg font-medium">Select Destination Type</h3>
				<p className="text-sm text-muted-foreground">
					Choose how you want to deliver compliance reports
				</p>
			</div>

			<RadioGroup
				value={value}
				onValueChange={(val) => onChange(val as DeliveryDestinationType)}
				disabled={disabled}
				className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
			>
				{destinationTypes.map((type) => {
					const Icon = type.icon
					const isSelected = value === type.value

					return (
						<div key={type.value} className="relative">
							<RadioGroupItem
								value={type.value}
								id={`type-${type.value}`}
								className="peer sr-only"
								aria-describedby={`type-${type.value}-description`}
							/>
							<Label
								htmlFor={`type-${type.value}`}
								className={cn(
									'flex cursor-pointer flex-col items-start gap-3 rounded-lg border-2 p-4 transition-all hover:bg-accent',
									isSelected
										? 'border-primary bg-accent'
										: 'border-muted peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2',
									disabled && 'cursor-not-allowed opacity-50'
								)}
							>
								<div className="flex w-full items-center gap-3">
									<div
										className={cn(
											'flex h-10 w-10 items-center justify-center rounded-lg',
											isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'
										)}
									>
										<Icon className="h-5 w-5" />
									</div>
									<div className="flex-1">
										<div className="font-semibold">{type.label}</div>
									</div>
								</div>
								<p id={`type-${type.value}-description`} className="text-sm text-muted-foreground">
									{type.description}
								</p>
							</Label>
						</div>
					)
				})}
			</RadioGroup>
		</div>
	)
}
