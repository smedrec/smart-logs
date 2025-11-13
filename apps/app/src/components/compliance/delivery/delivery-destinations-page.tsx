import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import { ErrorAlert } from '../error/error-alert'
import { CompliancePage } from '../layout/compliance-page'
import { BulkActionsToolbar } from './bulk-actions-toolbar'
import { DeleteDestinationDialog } from './delete-destination-dialog'
import { DeliveryDestinationsDataTable } from './delivery-destinations-data-table'
import { DeliveryDestinationsFilters } from './delivery-destinations-filters'
import { DuplicateDestinationDialog } from './duplicate-destination-dialog'
import { TestDestinationDialog } from './test-destination-dialog'

import type {
	ConnectionTestResult,
	CreateDeliveryDestination,
	DeliveryDestination,
} from '@smedrec/audit-client'
import type { DeliveryDestinationFilters } from './delivery-destinations-filters'

interface DeliveryDestinationsPageProps {
	onCreateDestination?: () => void
	onEditDestination?: (destinationId: string) => void
	onTestDestination?: (destinationId: string) => void
	onDeleteDestination?: (destinationId: string) => Promise<void>
	onDuplicateDestination?: (data: CreateDeliveryDestination) => Promise<void>
	onEnableDestination?: (destinationId: string) => Promise<void>
	onDisableDestination?: (destinationId: string) => Promise<void>
	onViewDestination?: (destinationId: string) => void
}

export function DeliveryDestinationsPage({
	onCreateDestination,
	onEditDestination,
	onTestDestination,
	onDeleteDestination,
	onDuplicateDestination,
	onEnableDestination,
	onDisableDestination,
	onViewDestination,
}: DeliveryDestinationsPageProps) {
	// Mock data for now - will be replaced with real API calls
	const [destinations, setDestinations] = React.useState<DeliveryDestination[]>([])
	const [loading, setLoading] = React.useState(false)
	const [error, setError] = React.useState<string | undefined>()
	const [filters, setFilters] = React.useState<DeliveryDestinationFilters>({})
	const [selectedDestinations, setSelectedDestinations] = React.useState<string[]>([])
	const [testDialogOpen, setTestDialogOpen] = React.useState(false)
	const [testingDestination, setTestingDestination] = React.useState<{
		id: string
		label: string
	} | null>(null)
	const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
	const [deletingDestination, setDeletingDestination] = React.useState<DeliveryDestination | null>(
		null
	)
	const [duplicateDialogOpen, setDuplicateDialogOpen] = React.useState(false)
	const [duplicatingDestination, setDuplicatingDestination] =
		React.useState<DeliveryDestination | null>(null)
	const [actionLoading, setActionLoading] = React.useState(false)

	// Load destinations
	React.useEffect(() => {
		loadDestinations()
	}, [filters])

	const loadDestinations = async () => {
		setLoading(true)
		setError(undefined)

		try {
			// TODO: Replace with real API call
			// const response = await auditClient.delivery.listDestinations({
			//   type: filters.type,
			//   disabled: filters.status === 'disabled',
			//   limit: 50,
			//   sortBy: 'createdAt',
			//   sortOrder: 'desc',
			// })
			// setDestinations(response.data)

			// Mock data for demonstration
			await new Promise((resolve) => setTimeout(resolve, 500))
			setDestinations([])
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to load delivery destinations')
		} finally {
			setLoading(false)
		}
	}

	// Filter destinations based on search
	const filteredDestinations = React.useMemo(() => {
		let filtered = destinations

		if (filters.search) {
			const searchLower = filters.search.toLowerCase()
			filtered = filtered.filter(
				(dest) =>
					dest.label.toLowerCase().includes(searchLower) ||
					dest.description?.toLowerCase().includes(searchLower)
			)
		}

		if (filters.type) {
			filtered = filtered.filter((dest) => dest.type === filters.type)
		}

		if (filters.status) {
			const isDisabled = filters.status === 'disabled'
			filtered = filtered.filter((dest) => dest.disabled === isDisabled)
		}

		return filtered
	}, [destinations, filters])

	const handleBulkEnable = async () => {
		if (!onEnableDestination || selectedDestinations.length === 0) return

		setActionLoading(true)
		try {
			await Promise.all(selectedDestinations.map((id) => onEnableDestination(id)))
			toast.success(
				`Enabled ${selectedDestinations.length} ${selectedDestinations.length === 1 ? 'destination' : 'destinations'}`
			)
			setSelectedDestinations([])
			await loadDestinations()
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to enable destinations')
		} finally {
			setActionLoading(false)
		}
	}

	const handleBulkDisable = async () => {
		if (!onDisableDestination || selectedDestinations.length === 0) return

		setActionLoading(true)
		try {
			await Promise.all(selectedDestinations.map((id) => onDisableDestination(id)))
			toast.success(
				`Disabled ${selectedDestinations.length} ${selectedDestinations.length === 1 ? 'destination' : 'destinations'}`
			)
			setSelectedDestinations([])
			await loadDestinations()
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to disable destinations')
		} finally {
			setActionLoading(false)
		}
	}

	const handleBulkDelete = async () => {
		if (!onDeleteDestination || selectedDestinations.length === 0) return

		// For bulk delete, we'll use the first selected destination for the confirmation dialog
		const firstDestination = destinations.find((d) => d.id === selectedDestinations[0])
		if (firstDestination) {
			setDeletingDestination(firstDestination)
			setDeleteDialogOpen(true)
		}
	}

	const handleBulkDuplicate = () => {
		if (selectedDestinations.length !== 1) return

		const destination = destinations.find((d) => d.id === selectedDestinations[0])
		if (destination) {
			setDuplicatingDestination(destination)
			setDuplicateDialogOpen(true)
		}
	}

	const handleTestDestination = (destinationId: string) => {
		const destination = destinations.find((d) => d.id === destinationId)
		if (destination) {
			setTestingDestination({ id: destination.id, label: destination.label })
			setTestDialogOpen(true)
		}
		onTestDestination?.(destinationId)
	}

	const handleDeleteDestination = (destinationId: string) => {
		const destination = destinations.find((d) => d.id === destinationId)
		if (destination) {
			setDeletingDestination(destination)
			setDeleteDialogOpen(true)
		}
	}

	const handleDuplicateDestination = (destinationId: string) => {
		const destination = destinations.find((d) => d.id === destinationId)
		if (destination) {
			setDuplicatingDestination(destination)
			setDuplicateDialogOpen(true)
		}
	}

	const handleEnableDestination = async (destinationId: string) => {
		if (!onEnableDestination) return

		setActionLoading(true)
		try {
			await onEnableDestination(destinationId)
			toast.success('Destination enabled successfully')
			await loadDestinations()
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to enable destination')
		} finally {
			setActionLoading(false)
		}
	}

	const handleDisableDestination = async (destinationId: string) => {
		if (!onDisableDestination) return

		setActionLoading(true)
		try {
			await onDisableDestination(destinationId)
			toast.success('Destination disabled successfully')
			await loadDestinations()
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to disable destination')
		} finally {
			setActionLoading(false)
		}
	}

	const handleConfirmDelete = async (destinationId: string) => {
		if (!onDeleteDestination) return

		setActionLoading(true)
		try {
			// If bulk delete, delete all selected destinations
			if (selectedDestinations.length > 1) {
				await Promise.all(selectedDestinations.map((id) => onDeleteDestination(id)))
				toast.success(`Deleted ${selectedDestinations.length} destinations`)
				setSelectedDestinations([])
			} else {
				await onDeleteDestination(destinationId)
				toast.success('Destination deleted successfully')
			}
			await loadDestinations()
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to delete destination')
			throw err
		} finally {
			setActionLoading(false)
		}
	}

	const handleConfirmDuplicate = async (data: CreateDeliveryDestination) => {
		if (!onDuplicateDestination) return

		setActionLoading(true)
		try {
			await onDuplicateDestination(data)
			toast.success('Destination duplicated successfully')
			setSelectedDestinations([])
			await loadDestinations()
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to duplicate destination')
			throw err
		} finally {
			setActionLoading(false)
		}
	}

	const handleTestConnection = async (destinationId: string): Promise<ConnectionTestResult> => {
		// TODO: Replace with real API call
		// return await auditClient.delivery.testConnection(destinationId)

		// Mock implementation for demonstration
		await new Promise((resolve) => setTimeout(resolve, 2000))

		// Simulate random success/failure for testing
		const success = Math.random() > 0.3

		if (success) {
			return {
				success: true,
				responseTime: Math.floor(Math.random() * 500) + 100,
				statusCode: 200,
				details: {
					message: 'Connection established successfully',
					timestamp: new Date().toISOString(),
				},
			}
		} else {
			return {
				success: false,
				responseTime: Math.floor(Math.random() * 1000) + 500,
				statusCode: 500,
				error: 'Failed to connect to destination',
				details: {
					reason: 'Connection timeout',
					timestamp: new Date().toISOString(),
				},
			}
		}
	}

	return (
		<CompliancePage
			title="Delivery Destinations"
			description="Manage delivery destinations for compliance reports"
			actions={
				<Button onClick={onCreateDestination}>
					<Plus className="mr-2 size-4" />
					Create Destination
				</Button>
			}
		>
			<div className="space-y-4">
				{error && (
					<ErrorAlert
						error={{ code: 'LOAD_ERROR', message: error }}
						dismissible
						onDismiss={() => setError(undefined)}
						actions={[
							{
								label: 'Retry',
								onClick: loadDestinations,
							},
						]}
					/>
				)}

				<DeliveryDestinationsFilters filters={filters} onFiltersChange={setFilters} />

				{/* Bulk Actions Toolbar */}
				<BulkActionsToolbar
					selectedCount={selectedDestinations.length}
					onClearSelection={() => setSelectedDestinations([])}
					onEnable={handleBulkEnable}
					onDisable={handleBulkDisable}
					onDuplicate={handleBulkDuplicate}
					onDelete={handleBulkDelete}
					loading={actionLoading}
				/>

				<DeliveryDestinationsDataTable
					data={filteredDestinations}
					loading={loading}
					error={error}
					onSelectionChange={setSelectedDestinations}
					onDestinationEdit={onEditDestination}
					onDestinationTest={handleTestDestination}
					onDestinationDelete={handleDeleteDestination}
					onDestinationDuplicate={handleDuplicateDestination}
					onDestinationEnable={handleEnableDestination}
					onDestinationDisable={handleDisableDestination}
					onDestinationView={onViewDestination}
					onBulkEnable={handleBulkEnable}
					onBulkDisable={handleBulkDisable}
					onBulkDelete={handleBulkDelete}
				/>
			</div>

			{/* Test Destination Dialog */}
			{testingDestination && (
				<TestDestinationDialog
					open={testDialogOpen}
					onOpenChange={setTestDialogOpen}
					destinationId={testingDestination.id}
					destinationLabel={testingDestination.label}
					onTest={handleTestConnection}
				/>
			)}

			{/* Delete Destination Dialog */}
			<DeleteDestinationDialog
				open={deleteDialogOpen}
				onOpenChange={setDeleteDialogOpen}
				destination={deletingDestination}
				onConfirm={handleConfirmDelete}
				loading={actionLoading}
			/>

			{/* Duplicate Destination Dialog */}
			<DuplicateDestinationDialog
				open={duplicateDialogOpen}
				onOpenChange={setDuplicateDialogOpen}
				destination={duplicatingDestination}
				onConfirm={handleConfirmDuplicate}
				loading={actionLoading}
			/>
		</CompliancePage>
	)
}
