import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
	AlertCircle,
	CheckCircle2,
	Database,
	Download,
	Mail,
	Plus,
	Server,
	Webhook,
	XCircle,
} from 'lucide-react'
import * as React from 'react'

import type { DeliveryDestination, DeliveryDestinationType } from '@smedrec/audit-client'

interface DestinationSelectorProps {
	destinations: DeliveryDestination[]
	selectedIds: string[]
	onSelectionChange: (selectedIds: string[]) => void
	onCreateNew?: () => void
	loading?: boolean
	showHealthStatus?: boolean
	allowMultiple?: boolean
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

const getHealthStatusIcon = (disabled: boolean) => {
	if (disabled) {
		return <XCircle className="h-4 w-4 text-muted-foreground" />
	}
	return <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
}

export function DestinationSelector({
	destinations,
	selectedIds,
	onSelectionChange,
	onCreateNew,
	loading = false,
	showHealthStatus = true,
	allowMultiple = true,
	className,
}: DestinationSelectorProps) {
	const handleToggle = (destinationId: string) => {
		if (allowMultiple) {
			if (selectedIds.includes(destinationId)) {
				onSelectionChange(selectedIds.filter((id) => id !== destinationId))
			} else {
				onSelectionChange([...selectedIds, destinationId])
			}
		} else {
			onSelectionChange([destinationId])
		}
	}

	const handleSelectAll = () => {
		const enabledDestinations = destinations.filter((d) => !d.disabled)
		onSelectionChange(enabledDestinations.map((d) => d.id))
	}

	const handleClearAll = () => {
		onSelectionChange([])
	}

	const enabledDestinations = destinations.filter((d) => !d.disabled)
	const disabledDestinations = destinations.filter((d) => d.disabled)
	const allEnabledSelected =
		enabledDestinations.length > 0 && enabledDestinations.every((d) => selectedIds.includes(d.id))

	if (loading) {
		return (
			<Card className={className}>
				<CardHeader>
					<Skeleton className="h-6 w-48" />
					<Skeleton className="h-4 w-64" />
				</CardHeader>
				<CardContent className="space-y-3">
					{[...Array(3)].map((_, i) => (
						<div key={i} className="flex items-center gap-3">
							<Skeleton className="h-4 w-4" />
							<Skeleton className="h-10 flex-1" />
						</div>
					))}
				</CardContent>
			</Card>
		)
	}

	return (
		<Card className={className}>
			<CardHeader>
				<div className="flex items-center justify-between">
					<div>
						<CardTitle>Delivery Destinations</CardTitle>
						<CardDescription>
							Select where to deliver the compliance reports
							{allowMultiple && ' (multiple selections allowed)'}
						</CardDescription>
					</div>
					{onCreateNew && (
						<Button variant="outline" size="sm" onClick={onCreateNew}>
							<Plus className="mr-2 h-4 w-4" />
							Create New
						</Button>
					)}
				</div>
			</CardHeader>

			<CardContent className="space-y-4">
				{/* Selection Controls */}
				{allowMultiple && enabledDestinations.length > 0 && (
					<div className="flex items-center justify-between">
						<div className="text-sm text-muted-foreground">
							{selectedIds.length} of {enabledDestinations.length} selected
						</div>
						<div className="flex gap-2">
							<Button
								variant="ghost"
								size="sm"
								onClick={handleSelectAll}
								disabled={allEnabledSelected}
							>
								Select All
							</Button>
							<Button
								variant="ghost"
								size="sm"
								onClick={handleClearAll}
								disabled={selectedIds.length === 0}
							>
								Clear All
							</Button>
						</div>
					</div>
				)}

				{/* Destination List */}
				{destinations.length === 0 ? (
					<div className="text-center py-8">
						<AlertCircle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
						<p className="text-sm text-muted-foreground">No delivery destinations available</p>
						{onCreateNew && (
							<Button variant="outline" size="sm" className="mt-4" onClick={onCreateNew}>
								<Plus className="mr-2 h-4 w-4" />
								Create First Destination
							</Button>
						)}
					</div>
				) : (
					<ScrollArea className="h-[300px] pr-4">
						<div className="space-y-2">
							{/* Enabled Destinations */}
							{enabledDestinations.map((destination) => {
								const Icon = getDestinationIcon(destination.type)
								const isSelected = selectedIds.includes(destination.id)

								return (
									<div
										key={destination.id}
										className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
											isSelected
												? 'border-primary bg-primary/5'
												: 'border-border hover:border-primary/50'
										}`}
										onClick={() => handleToggle(destination.id)}
									>
										<Checkbox
											checked={isSelected}
											onCheckedChange={() => handleToggle(destination.id)}
											className="mt-1"
										/>

										<div className="flex-1 min-w-0">
											<div className="flex items-center gap-2">
												<Icon className="h-4 w-4 text-primary flex-shrink-0" />
												<span className="font-medium truncate">{destination.label}</span>
												<Badge variant="outline" className="capitalize flex-shrink-0">
													{destination.type}
												</Badge>
											</div>

											{destination.description && (
												<p className="text-sm text-muted-foreground mt-1 line-clamp-2">
													{destination.description}
												</p>
											)}

											<div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
												{showHealthStatus && (
													<div className="flex items-center gap-1">
														{getHealthStatusIcon(destination.disabled)}
														<span>{destination.disabled ? 'Disabled' : 'Active'}</span>
													</div>
												)}
												<div>Used: {destination.countUsage.toLocaleString()}</div>
											</div>
										</div>
									</div>
								)
							})}

							{/* Disabled Destinations */}
							{disabledDestinations.length > 0 && (
								<>
									<Separator className="my-4" />
									<div className="text-sm font-medium text-muted-foreground mb-2">
										Disabled Destinations
									</div>
									{disabledDestinations.map((destination) => {
										const Icon = getDestinationIcon(destination.type)

										return (
											<div
												key={destination.id}
												className="flex items-start gap-3 p-3 rounded-lg border border-dashed opacity-50"
											>
												<Checkbox disabled className="mt-1" />

												<div className="flex-1 min-w-0">
													<div className="flex items-center gap-2">
														<Icon className="h-4 w-4 flex-shrink-0" />
														<span className="font-medium truncate">{destination.label}</span>
														<Badge variant="secondary" className="capitalize flex-shrink-0">
															{destination.type}
														</Badge>
													</div>

													{destination.description && (
														<p className="text-sm text-muted-foreground mt-1 line-clamp-2">
															{destination.description}
														</p>
													)}

													<div className="text-xs text-muted-foreground mt-2">
														This destination is disabled and cannot be selected
													</div>
												</div>
											</div>
										)
									})}
								</>
							)}
						</div>
					</ScrollArea>
				)}

				{/* Use Default Option */}
				{enabledDestinations.length > 0 && (
					<>
						<Separator />
						<div className="flex items-center justify-between p-3 rounded-lg border">
							<div className="space-y-0.5">
								<Label className="text-sm font-medium">Use Default Destinations</Label>
								<p className="text-xs text-muted-foreground">
									Automatically use organization's default delivery destinations
								</p>
							</div>
							<Checkbox
								checked={selectedIds.includes('default')}
								onCheckedChange={(checked) => {
									if (checked) {
										onSelectionChange(['default'])
									} else {
										onSelectionChange([])
									}
								}}
							/>
						</div>
					</>
				)}
			</CardContent>
		</Card>
	)
}
