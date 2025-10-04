import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import {
	AlertTriangle,
	ArrowLeft,
	Calendar,
	Check,
	CheckCircle,
	Clock,
	Copy,
	ExternalLink,
	Eye,
	FileText,
	History,
	Settings,
	Tag,
	User,
	X,
	XCircle,
} from 'lucide-react'
import React, { useState } from 'react'

import type { AlertSeverity, AlertStatus } from '@/components/alerts/types'
import type { Alert } from '@/lib/collections'

export interface AlertDetailsProps {
	/** Alert data to display */
	alert: Alert
	/** Callback when back button is clicked */
	onBack?: () => void
	/** Callback when alert action is triggered */
	onAlertAction?: (alertId: string, action: 'acknowledge' | 'resolve' | 'dismiss') => void
	/** Whether to show the back button */
	showBackButton?: boolean
	/** Additional CSS classes */
	className?: string
	/** Loading state for actions */
	actionLoading?: boolean
}

interface AlertHistoryEntry {
	id: string
	action: string
	user: string
	timestamp: Date
	notes?: string
}

/**
 * Detailed alert view component with full metadata display and action history
 * Provides comprehensive information about an alert with navigation and actions
 */
export function AlertDetails({
	alert,
	onBack,
	onAlertAction,
	showBackButton = true,
	className,
	actionLoading = false,
}: AlertDetailsProps) {
	const [showMetadata, setShowMetadata] = useState(false)
	const [copiedField, setCopiedField] = useState<string | null>(null)

	// Mock history data - in real implementation, this would come from props or API
	// Not implemented
	/*const alertHistory: AlertHistoryEntry[] = [
		{
			id: '1',
			action: 'Created',
			user: 'System',
			timestamp: alert.timestamp,
		},
		...(alert.acknowledgedBy
			? [
					{
						id: '2',
						action: 'Acknowledged',
						user: alert.acknowledgedBy,
						timestamp: alert.acknowledgedAt!,
					},
				]
			: []),
		...(alert.resolvedBy
			? [
					{
						id: '3',
						action: 'Resolved',
						user: alert.resolvedBy,
						timestamp: alert.resolvedAt!,
						notes: alert.resolutionNotes,
					},
				]
			: []),
	]*/
	const alertHistory: AlertHistoryEntry[] = []

	const getSeverityColor = (severity: AlertSeverity) => {
		switch (severity) {
			case 'CRITICAL':
				return 'text-destructive border-destructive bg-destructive/10'
			case 'HIGH':
				return 'text-orange-600 border-orange-500 bg-orange-50 dark:bg-orange-950/20'
			case 'MEDIUM':
				return 'text-yellow-600 border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20'
			case 'LOW':
				return 'text-blue-600 border-blue-500 bg-blue-50 dark:bg-blue-950/20'
			case 'INFO':
				return 'text-gray-600 border-gray-500 bg-gray-50 dark:bg-gray-950/20'
			default:
				return 'text-gray-600 border-gray-300'
		}
	}

	const getSeverityIcon = (severity: AlertSeverity) => {
		const iconClass = 'h-5 w-5'
		switch (severity) {
			case 'CRITICAL':
				return <AlertTriangle className={cn(iconClass, 'text-destructive')} />
			case 'HIGH':
				return <AlertTriangle className={cn(iconClass, 'text-orange-500')} />
			case 'MEDIUM':
				return <Clock className={cn(iconClass, 'text-yellow-500')} />
			case 'LOW':
				return <Clock className={cn(iconClass, 'text-blue-500')} />
			case 'INFO':
				return <Clock className={cn(iconClass, 'text-gray-500')} />
			default:
				return <Clock className={iconClass} />
		}
	}

	const getStatusIcon = (status: AlertStatus) => {
		const iconClass = 'h-4 w-4'
		switch (status) {
			case 'active':
				return <AlertTriangle className={cn(iconClass, 'text-destructive')} />
			case 'acknowledged':
				return <Clock className={cn(iconClass, 'text-yellow-500')} />
			case 'resolved':
				return <CheckCircle className={cn(iconClass, 'text-green-500')} />
			case 'dismissed':
				return <XCircle className={cn(iconClass, 'text-gray-500')} />
			default:
				return <Clock className={iconClass} />
		}
	}

	const formatTimestamp = (timestamp: Date) => {
		return new Intl.DateTimeFormat('en-US', {
			weekday: 'long',
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			timeZoneName: 'short',
		}).format(new Date(timestamp))
	}

	const formatRelativeTime = (timestamp: Date) => {
		const now = new Date()
		const alertTime = new Date(timestamp)
		const diffInMinutes = Math.floor((now.getTime() - alertTime.getTime()) / (1000 * 60))

		if (diffInMinutes < 1) return 'Just now'
		if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''} ago`
		if (diffInMinutes < 1440)
			return `${Math.floor(diffInMinutes / 60)} hour${Math.floor(diffInMinutes / 60) !== 1 ? 's' : ''} ago`
		return `${Math.floor(diffInMinutes / 1440)} day${Math.floor(diffInMinutes / 1440) !== 1 ? 's' : ''} ago`
	}

	const handleAction = (action: 'acknowledge' | 'resolve' | 'dismiss') => {
		onAlertAction?.(alert.id, action)
	}

	const copyToClipboard = async (text: string, field: string) => {
		try {
			await navigator.clipboard.writeText(text)
			setCopiedField(field)
			setTimeout(() => setCopiedField(null), 2000)
		} catch (err) {
			console.error('Failed to copy text: ', err)
		}
	}

	const getActionButtons = () => {
		const buttons = []

		if (alert.status === 'active') {
			buttons.push(
				<Button
					key="acknowledge"
					variant="outline"
					onClick={() => handleAction('acknowledge')}
					disabled={actionLoading}
					className="flex items-center space-x-2"
				>
					<Check className="h-4 w-4" />
					<span>Acknowledge</span>
				</Button>
			)
		}

		if (alert.status === 'active' || alert.status === 'acknowledged') {
			buttons.push(
				<Button
					key="resolve"
					onClick={() => handleAction('resolve')}
					disabled={actionLoading}
					className="flex items-center space-x-2"
				>
					<CheckCircle className="h-4 w-4" />
					<span>Resolve</span>
				</Button>
			)
		}

		buttons.push(
			<Button
				key="dismiss"
				variant="destructive"
				onClick={() => handleAction('dismiss')}
				disabled={actionLoading}
				className="flex items-center space-x-2"
			>
				<X className="h-4 w-4" />
				<span>Dismiss</span>
			</Button>
		)

		return buttons
	}

	return (
		<div className={cn('space-y-6', className)}>
			{/* Header */}
			<div className="flex items-center justify-between">
				<div className="flex items-center space-x-4">
					{showBackButton && onBack && (
						<Button variant="ghost" size="sm" onClick={onBack}>
							<ArrowLeft className="h-4 w-4 mr-2" />
							Back to List
						</Button>
					)}
					<div className="flex items-center space-x-2">
						{getSeverityIcon(alert.severity as AlertSeverity)}
						<h1 className="text-2xl font-semibold">Alert Details</h1>
					</div>
				</div>

				<div className="flex items-center space-x-2">{getActionButtons()}</div>
			</div>

			<div className="grid gap-6 lg:grid-cols-3">
				{/* Main Content */}
				<div className="lg:col-span-2 space-y-6">
					{/* Alert Overview */}
					<Card className={cn('border-l-4', getSeverityColor(alert.severity as AlertSeverity))}>
						<CardHeader>
							<div className="flex items-start justify-between">
								<div className="space-y-2">
									<div className="flex items-center space-x-2">
										<Badge
											variant="outline"
											className={getSeverityColor(alert.severity as AlertSeverity)}
										>
											{alert.severity.toUpperCase()}
										</Badge>
										<Badge variant="secondary">{alert.type.toUpperCase()}</Badge>
										<div className="flex items-center space-x-1">
											{getStatusIcon(alert.status as AlertStatus)}
											<span className="text-sm text-muted-foreground capitalize">
												{alert.status}
											</span>
										</div>
									</div>
									<CardTitle className="text-xl">{alert.title}</CardTitle>
								</div>

								<Button
									variant="ghost"
									size="sm"
									onClick={() => copyToClipboard(alert.id, 'id')}
									className="flex items-center space-x-1"
								>
									<Copy className="h-3 w-3" />
									<span className="text-xs">{copiedField === 'id' ? 'Copied!' : 'Copy ID'}</span>
								</Button>
							</div>
						</CardHeader>
						<CardContent>
							<p className="text-muted-foreground leading-relaxed">{alert.description}</p>
						</CardContent>
					</Card>

					{/* Alert History */}
					{alertHistory.length > 0 && (
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center space-x-2">
									<History className="h-4 w-4" />
									<span>Alert History</span>
								</CardTitle>
							</CardHeader>
							<CardContent>
								<ScrollArea className="h-64">
									<div className="space-y-4">
										{alertHistory.map((entry, index) => (
											<div key={entry.id} className="flex items-start space-x-3">
												<div className="flex-shrink-0 w-2 h-2 rounded-full bg-primary mt-2" />
												<div className="flex-1 min-w-0">
													<div className="flex items-center justify-between">
														<p className="text-sm font-medium">
															{entry.action} by {entry.user}
														</p>
														<p className="text-xs text-muted-foreground">
															{formatRelativeTime(entry.timestamp)}
														</p>
													</div>
													<p className="text-xs text-muted-foreground">
														{formatTimestamp(entry.timestamp)}
													</p>
													{entry.notes && (
														<p className="text-sm text-muted-foreground mt-1">
															<strong>Notes:</strong> {entry.notes}
														</p>
													)}
												</div>
											</div>
										))}
									</div>
								</ScrollArea>
							</CardContent>
						</Card>
					)}

					{/* Metadata */}
					{Object.keys(
						typeof alert.metadata === 'string' ? JSON.parse(alert.metadata) : alert.metadata
					).length > 0 && (
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center justify-between">
									<div className="flex items-center space-x-2">
										<Settings className="h-4 w-4" />
										<span>Metadata</span>
									</div>
									<Button variant="ghost" size="sm" onClick={() => setShowMetadata(!showMetadata)}>
										{showMetadata ? 'Hide' : 'Show'} Details
									</Button>
								</CardTitle>
							</CardHeader>
							{showMetadata && (
								<CardContent>
									<div className="space-y-3">
										{Object.entries(
											typeof alert.metadata === 'string'
												? JSON.parse(alert.metadata)
												: alert.metadata
										).map(([key, value]) => (
											<div
												key={key}
												className="flex items-center justify-between py-2 border-b last:border-b-0"
											>
												<span className="text-sm font-medium">{key}</span>
												<div className="flex items-center space-x-2">
													<span className="text-sm text-muted-foreground font-mono">
														{typeof value === 'object' ? JSON.stringify(value) : String(value)}
													</span>
													<Button
														variant="ghost"
														size="sm"
														onClick={() => copyToClipboard(String(value), key)}
														className="h-6 w-6 p-0"
													>
														<Copy className="h-3 w-3" />
													</Button>
												</div>
											</div>
										))}
									</div>
								</CardContent>
							)}
						</Card>
					)}
				</div>

				{/* Sidebar */}
				<div className="space-y-6">
					{/* Alert Information */}
					<Card>
						<CardHeader>
							<CardTitle className="text-base">Alert Information</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="space-y-3">
								<div className="flex items-center space-x-2">
									<Calendar className="h-4 w-4 text-muted-foreground" />
									<div>
										<p className="text-sm font-medium">Created</p>
										<p className="text-xs text-muted-foreground">{alert.created_at}</p>
										<p className="text-xs text-muted-foreground">{alert.created_at}</p>
									</div>
								</div>

								<Separator />

								<div className="flex items-center space-x-2">
									<FileText className="h-4 w-4 text-muted-foreground" />
									<div>
										<p className="text-sm font-medium">Source</p>
										<p className="text-xs text-muted-foreground">{alert.source}</p>
									</div>
								</div>

								<Separator />

								<div className="flex items-center space-x-2">
									<Tag className="h-4 w-4 text-muted-foreground" />
									<div>
										<p className="text-sm font-medium">Alert ID</p>
										<p className="text-xs text-muted-foreground font-mono">{alert.id}</p>
									</div>
								</div>

								{alert.acknowledged_by && (
									<>
										<Separator />
										<div className="flex items-center space-x-2">
											<User className="h-4 w-4 text-muted-foreground" />
											<div>
												<p className="text-sm font-medium">Acknowledged By</p>
												<p className="text-xs text-muted-foreground">{alert.acknowledged_by}</p>
												<p className="text-xs text-muted-foreground">{alert.acknowledged_at}</p>
											</div>
										</div>
									</>
								)}

								{alert.resolved_by && (
									<>
										<Separator />
										<div className="flex items-center space-x-2">
											<CheckCircle className="h-4 w-4 text-muted-foreground" />
											<div>
												<p className="text-sm font-medium">Resolved By</p>
												<p className="text-xs text-muted-foreground">{alert.resolved_by}</p>
												<p className="text-xs text-muted-foreground">{alert.resolved_at}</p>
											</div>
										</div>
									</>
								)}
							</div>
						</CardContent>
					</Card>

					{/* Tags */}
					{alert.tags && alert.tags.length > 0 && (
						<Card>
							<CardHeader>
								<CardTitle className="text-base">Tags</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="flex flex-wrap gap-2">
									{alert.tags.map((tag) => (
										<Badge key={tag} variant="outline" className="text-xs">
											{tag}
										</Badge>
									))}
								</div>
							</CardContent>
						</Card>
					)}

					{/* Quick Actions */}
					<Card>
						<CardHeader>
							<CardTitle className="text-base">Quick Actions</CardTitle>
						</CardHeader>
						<CardContent className="space-y-2">
							<Button variant="outline" size="sm" className="w-full justify-start">
								<Eye className="h-4 w-4 mr-2" />
								View Related Alerts
							</Button>
							<Button variant="outline" size="sm" className="w-full justify-start">
								<ExternalLink className="h-4 w-4 mr-2" />
								Open in Source System
							</Button>
							<Button variant="outline" size="sm" className="w-full justify-start">
								<FileText className="h-4 w-4 mr-2" />
								Export Alert Data
							</Button>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	)
}

export default AlertDetails
