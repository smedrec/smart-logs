import { CompliancePage } from '@/components/compliance/layout/compliance-page'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { format } from 'date-fns'
import { ArrowLeft, Edit, TestTube, Trash2 } from 'lucide-react'
import { lazy, useEffect, useState } from 'react'
import { toast } from 'sonner'

import type { DeliveryDestination, DestinationHealth } from '@smedrec/audit-client'

// Lazy load components
const DestinationUsageCard = lazy(() =>
	import('@/components/compliance/delivery').then((module) => ({
		default: module.DestinationUsageCard,
	}))
)

const TestDestinationDialog = lazy(() =>
	import('@/components/compliance/delivery').then((module) => ({
		default: module.TestDestinationDialog,
	}))
)

const DeleteDestinationDialog = lazy(() =>
	import('@/components/compliance/delivery').then((module) => ({
		default: module.DeleteDestinationDialog,
	}))
)

const ErrorAlert = lazy(() =>
	import('@/components/compliance/error').then((module) => ({
		default: module.ErrorAlert,
	}))
)

export const Route = createFileRoute(
	'/_authenticated/compliance/delivery-destinations/$destinationId'
)({
	component: RouteComponent,
})

function RouteComponent() {
	const { destinationId } = Route.useParams()
	const navigate = useNavigate()

	const [destination, setDestination] = useState<DeliveryDestination | null>(null)
	const [health, setHealth] = useState<DestinationHealth | null>(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | undefined>()
	const [testDialogOpen, setTestDialogOpen] = useState(false)
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

	useEffect(() => {
		loadDestination()
		loadHealth()
	}, [destinationId])

	const loadDestination = async () => {
		setLoading(true)
		setError(undefined)

		try {
			// TODO: Replace with real API call
			// const dest = await auditClient.delivery.getDestination(destinationId)
			console.log('Loading destination:', destinationId)

			// Simulate API call
			await new Promise((resolve) => setTimeout(resolve, 500))

			// Mock data - replace with real data
			setDestination(null)
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to load destination')
		} finally {
			setLoading(false)
		}
	}

	const loadHealth = async () => {
		try {
			// TODO: Replace with real API call
			// const healthData = await auditClient.delivery.getDestinationHealth(destinationId)
			// setHealth(healthData)
		} catch (err) {
			console.error('Failed to load health:', err)
		}
	}

	const handleEdit = () => {
		navigate({
			to: '/compliance/delivery-destinations/$destinationId/edit',
			params: { destinationId },
		})
	}

	const handleTest = async (destId: string) => {
		// TODO: Replace with real API call
		// return await auditClient.delivery.testConnection(destId)

		// Mock implementation
		await new Promise((resolve) => setTimeout(resolve, 2000))
		return {
			success: Math.random() > 0.3,
			responseTime: Math.floor(Math.random() * 500) + 100,
			statusCode: 200,
		}
	}

	const handleDelete = async (destId: string) => {
		try {
			// TODO: Replace with real API call
			// await auditClient.delivery.deleteDestination(destId)
			console.log('Deleting destination:', destId)

			await new Promise((resolve) => setTimeout(resolve, 1000))

			toast.success('Destination deleted successfully')
			navigate({ to: '/compliance/delivery-destinations' })
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed to delete destination')
			throw error
		}
	}

	const handleBack = () => {
		navigate({ to: '/compliance/delivery-destinations' })
	}

	if (loading) {
		return (
			<CompliancePage
				title="Destination Details"
				description="View delivery destination information"
				actions={
					<Button variant="outline" onClick={handleBack}>
						<ArrowLeft className="mr-2 h-4 w-4" />
						Back to Destinations
					</Button>
				}
			>
				<div className="space-y-6">
					<Skeleton className="h-48 w-full" />
					<Skeleton className="h-64 w-full" />
				</div>
			</CompliancePage>
		)
	}

	if (error || !destination) {
		return (
			<CompliancePage
				title="Destination Details"
				description="View delivery destination information"
				actions={
					<Button variant="outline" onClick={handleBack}>
						<ArrowLeft className="mr-2 h-4 w-4" />
						Back to Destinations
					</Button>
				}
			>
				<ErrorAlert
					error={{
						code: error ? 'LOAD_ERROR' : 'NOT_FOUND',
						message: error || 'Destination not found',
					}}
					dismissible
					onDismiss={() => setError(undefined)}
					actions={[
						{
							label: error ? 'Retry' : 'Go Back',
							onClick: error ? loadDestination : handleBack,
						},
					]}
				/>
			</CompliancePage>
		)
	}

	return (
		<CompliancePage
			title={destination.label}
			description={destination.description || 'Delivery destination details'}
			actions={
				<div className="flex gap-2">
					<Button variant="outline" onClick={() => setTestDialogOpen(true)}>
						<TestTube className="mr-2 h-4 w-4" />
						Test Connection
					</Button>
					<Button variant="outline" onClick={handleEdit}>
						<Edit className="mr-2 h-4 w-4" />
						Edit
					</Button>
					<Button variant="outline" onClick={() => setDeleteDialogOpen(true)}>
						<Trash2 className="mr-2 h-4 w-4" />
						Delete
					</Button>
					<Button variant="outline" onClick={handleBack}>
						<ArrowLeft className="mr-2 h-4 w-4" />
						Back
					</Button>
				</div>
			}
		>
			<div className="grid gap-6 lg:grid-cols-2">
				{/* Destination Info */}
				<Card>
					<CardHeader>
						<CardTitle>Destination Information</CardTitle>
						<CardDescription>Basic configuration and status</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="grid grid-cols-2 gap-4">
							<div>
								<div className="text-sm text-muted-foreground">Type</div>
								<Badge variant="outline" className="mt-1 capitalize">
									{destination.type}
								</Badge>
							</div>
							<div>
								<div className="text-sm text-muted-foreground">Status</div>
								<Badge variant={destination.disabled ? 'secondary' : 'default'} className="mt-1">
									{destination.disabled ? 'Disabled' : 'Active'}
								</Badge>
							</div>
						</div>

						<Separator />

						<div className="space-y-2 text-sm">
							<div className="flex justify-between">
								<span className="text-muted-foreground">Created:</span>
								<span>{format(new Date(destination.createdAt), 'PPp')}</span>
							</div>
							<div className="flex justify-between">
								<span className="text-muted-foreground">Last Updated:</span>
								<span>{format(new Date(destination.updatedAt), 'PPp')}</span>
							</div>
							{destination.lastUsedAt && (
								<div className="flex justify-between">
									<span className="text-muted-foreground">Last Used:</span>
									<span>{format(new Date(destination.lastUsedAt), 'PPp')}</span>
								</div>
							)}
						</div>

						<Separator />

						<div className="space-y-2">
							<div className="text-sm font-medium">Configuration</div>
							<div className="rounded-md bg-muted p-3 text-xs font-mono space-y-1">
								{Object.entries(destination.config).map(([key, value]) => (
									<div key={key}>
										<span className="text-muted-foreground">{key}:</span>{' '}
										{typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
									</div>
								))}
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Usage & Metrics */}
				<DestinationUsageCard destination={destination} health={health} />
			</div>

			{/* Test Dialog */}
			<TestDestinationDialog
				open={testDialogOpen}
				onOpenChange={setTestDialogOpen}
				destinationId={destinationId}
				destinationLabel={destination.label}
				onTest={handleTest}
			/>

			{/* Delete Dialog */}
			<DeleteDestinationDialog
				open={deleteDialogOpen}
				onOpenChange={setDeleteDialogOpen}
				destination={destination}
				onConfirm={handleDelete}
			/>
		</CompliancePage>
	)
}
