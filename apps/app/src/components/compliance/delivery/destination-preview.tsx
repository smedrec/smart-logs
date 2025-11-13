import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
	AlertCircle,
	CheckCircle2,
	Database,
	Download,
	Mail,
	Server,
	Webhook,
	XCircle,
} from 'lucide-react'
import * as React from 'react'

import type { DeliveryDestination, DeliveryDestinationType } from '@smedrec/audit-client'

interface DestinationPreviewProps {
	destinations: DeliveryDestination[]
	className?: string
}

const getDestinationIcon = (type: DeliveryDestinationType) => {
	switch (type) {
		case 'email':
			return Mail
		case 'webhook':
			return Webhook
		case 'storage':
			return Database
		case 'sftp':
			return Server
		case 'download':
			return Download
		default:
			return AlertCircle
	}
}

export function DestinationPreview({ destinations, className }: DestinationPreviewProps) {
	if (destinations.length === 0) {
		return (
			<Card className={className}>
				<CardHeader>
					<CardTitle className="text-sm">Selected Destinations</CardTitle>
					<CardDescription>No destinations selected</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="text-center py-4 text-muted-foreground">
						<AlertCircle className="h-6 w-6 mx-auto mb-2 opacity-50" />
						<p className="text-sm">Select at least one destination to deliver reports</p>
					</div>
				</CardContent>
			</Card>
		)
	}

	return (
		<Card className={className}>
			<CardHeader>
				<CardTitle className="text-sm">Selected Destinations</CardTitle>
				<CardDescription>
					Reports will be delivered to {destinations.length}{' '}
					{destinations.length === 1 ? 'destination' : 'destinations'}
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="space-y-3">
					{destinations.map((destination, index) => {
						const Icon = getDestinationIcon(destination.type)

						return (
							<div key={destination.id}>
								<div className="flex items-start gap-3">
									<div className="flex h-8 w-8 items-center justify-center rounded-full border bg-muted">
										<Icon className="h-4 w-4" />
									</div>

									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-2">
											<span className="font-medium truncate">{destination.label}</span>
											<Badge variant="outline" className="capitalize flex-shrink-0">
												{destination.type}
											</Badge>
											{destination.disabled ? (
												<XCircle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0" />
											) : (
												<CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
											)}
										</div>

										{destination.description && (
											<p className="text-sm text-muted-foreground mt-1 line-clamp-2">
												{destination.description}
											</p>
										)}

										{/* Configuration Preview */}
										<div className="mt-2 text-xs text-muted-foreground space-y-1">
											{destination.type === 'email' && destination.config.email && (
												<>
													<div>From: {destination.config.email.from}</div>
													<div>Subject: {destination.config.email.subject}</div>
												</>
											)}

											{destination.type === 'webhook' && destination.config.webhook && (
												<>
													<div>URL: {destination.config.webhook.url}</div>
													<div>Method: {destination.config.webhook.method}</div>
												</>
											)}

											{destination.type === 'storage' && destination.config.storage && (
												<>
													<div>Provider: {destination.config.storage.provider}</div>
													<div>Path: {destination.config.storage.path}</div>
												</>
											)}

											{destination.type === 'sftp' && destination.config.sftp && (
												<>
													<div>Host: {destination.config.sftp.host}</div>
													<div>Path: {destination.config.sftp.path}</div>
												</>
											)}

											{destination.type === 'download' && destination.config.download && (
												<div>Expiry: {destination.config.download.expiryHours} hours</div>
											)}
										</div>
									</div>
								</div>

								{index < destinations.length - 1 && <Separator className="mt-3" />}
							</div>
						)
					})}
				</div>
			</CardContent>
		</Card>
	)
}
