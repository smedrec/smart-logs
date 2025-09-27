import { AuditEvent, QueryAuditEventsParams } from '@smedrec/audit-client'
import React, { useCallback, useMemo, useState } from 'react'

import { useAuditEvents, useAuditEventsStream } from '../hooks/useAudit'

interface AuditEventsListProps {
	showRealTime?: boolean
	initialFilters?: Partial<QueryAuditEventsParams>
}

export const AuditEventsList = React.memo(function AuditEventsList({
	showRealTime = false,
	initialFilters = {},
}: AuditEventsListProps) {
	const [filters, setFilters] = useState<QueryAuditEventsParams>({
		pagination: { limit: 20, offset: 0 },
		sort: { field: 'timestamp', direction: 'desc' },
		...initialFilters,
	})

	const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null)
	const [showFilters, setShowFilters] = useState(false)

	// Static events from API
	const { events, pagination, loading, error, refetch } = useAuditEvents(filters)

	// Real-time streaming events
	const {
		events: streamEvents,
		isStreaming,
		error: streamError,
		startStream,
		stopStream,
		clearEvents: clearStreamEvents,
	} = useAuditEventsStream(filters.filter)

	// Combined events list
	const allEvents = useMemo(() => {
		if (showRealTime && streamEvents.length > 0) {
			// Merge and deduplicate events
			const eventMap = new Map<string, AuditEvent>()

			// Add stream events first (most recent)
			streamEvents.forEach((event) => eventMap.set(event.id, event))

			// Add API events
			events.forEach((event) => {
				if (!eventMap.has(event.id)) {
					eventMap.set(event.id, event)
				}
			})

			return Array.from(eventMap.values()).sort(
				(a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
			)
		}

		return events
	}, [events, streamEvents, showRealTime])

	const handleFilterChange = useCallback((newFilters: Partial<QueryAuditEventsParams>) => {
		setFilters((prev) => ({
			...prev,
			...newFilters,
			pagination: { ...prev.pagination, offset: 0 }, // Reset to first page
		}))
	}, [])

	const handlePageChange = useCallback((page: number) => {
		setFilters((prev) => ({
			...prev,
			pagination: {
				...prev.pagination,
				offset: page * (prev.pagination?.limit || 20),
			},
		}))
	}, [])

	const toggleRealTime = useCallback(() => {
		if (isStreaming) {
			stopStream()
		} else {
			startStream()
		}
	}, [isStreaming, startStream, stopStream])

	const formatTimestamp = (timestamp: string) => {
		return new Date(timestamp).toLocaleString()
	}

	const getStatusColor = (status: string) => {
		switch (status) {
			case 'success':
				return '#28a745'
			case 'failure':
				return '#dc3545'
			case 'attempt':
				return '#ffc107'
			default:
				return '#6c757d'
		}
	}

	const getClassificationColor = (classification: string) => {
		switch (classification) {
			case 'PHI':
				return '#dc3545'
			case 'CONFIDENTIAL':
				return '#fd7e14'
			case 'INTERNAL':
				return '#ffc107'
			case 'PUBLIC':
				return '#28a745'
			default:
				return '#6c757d'
		}
	}

	if (loading && allEvents.length === 0) {
		return (
			<div className="loading-container">
				<div className="loading-spinner" />
				<p>Loading audit events...</p>
			</div>
		)
	}

	return (
		<div className="audit-events-list">
			<div className="list-header">
				<h2>Audit Events</h2>

				<div className="header-actions">
					{showRealTime && (
						<button
							onClick={toggleRealTime}
							className={`stream-toggle ${isStreaming ? 'active' : ''}`}
						>
							{isStreaming ? '⏸️ Stop Stream' : '▶️ Start Stream'}
						</button>
					)}

					<button onClick={() => setShowFilters(!showFilters)} className="filter-toggle">
						🔍 Filters
					</button>

					<button onClick={refetch} className="refresh-button">
						🔄 Refresh
					</button>
				</div>
			</div>

			{(error || streamError) && (
				<div className="error-message" role="alert">
					<strong>Error:</strong> {error?.message || streamError}
				</div>
			)}

			{showFilters && (
				<FilterPanel
					filters={filters}
					onFiltersChange={handleFilterChange}
					onClose={() => setShowFilters(false)}
				/>
			)}

			{isStreaming && (
				<div className="streaming-indicator">
					<span className="streaming-dot" />
					Live streaming active ({streamEvents.length} new events)
					<button onClick={clearStreamEvents} className="clear-stream">
						Clear
					</button>
				</div>
			)}

			<div className="events-container">
				{allEvents.length === 0 ? (
					<div className="empty-state">
						<p>No audit events found</p>
						{Object.keys(filters.filter || {}).length > 0 && (
							<button onClick={() => handleFilterChange({ filter: {} })}>Clear Filters</button>
						)}
					</div>
				) : (
					<div className="events-grid">
						{allEvents.map((event) => (
							<EventCard
								key={event.id}
								event={event}
								onClick={() => setSelectedEvent(event)}
								isSelected={selectedEvent?.id === event.id}
							/>
						))}
					</div>
				)}
			</div>

			{pagination && pagination.total > (pagination.limit || 20) && (
				<Pagination
					current={Math.floor((pagination.offset || 0) / (pagination.limit || 20))}
					total={Math.ceil(pagination.total / (pagination.limit || 20))}
					onPageChange={handlePageChange}
				/>
			)}

			{selectedEvent && (
				<EventDetailsModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
			)}

			<style jsx>{`
				.audit-events-list {
					padding: 20px;
					max-width: 1200px;
					margin: 0 auto;
				}

				.list-header {
					display: flex;
					justify-content: space-between;
					align-items: center;
					margin-bottom: 20px;
				}

				.header-actions {
					display: flex;
					gap: 10px;
				}

				.stream-toggle {
					background-color: #28a745;
					color: white;
					border: none;
					padding: 8px 16px;
					border-radius: 4px;
					cursor: pointer;
				}

				.stream-toggle.active {
					background-color: #dc3545;
				}

				.filter-toggle,
				.refresh-button {
					background-color: #007bff;
					color: white;
					border: none;
					padding: 8px 16px;
					border-radius: 4px;
					cursor: pointer;
				}

				.streaming-indicator {
					background-color: #d4edda;
					color: #155724;
					padding: 10px;
					border-radius: 4px;
					margin-bottom: 20px;
					display: flex;
					align-items: center;
					gap: 10px;
				}

				.streaming-dot {
					width: 8px;
					height: 8px;
					background-color: #28a745;
					border-radius: 50%;
					animation: pulse 1s infinite;
				}

				@keyframes pulse {
					0% {
						opacity: 1;
					}
					50% {
						opacity: 0.5;
					}
					100% {
						opacity: 1;
					}
				}

				.clear-stream {
					background-color: #6c757d;
					color: white;
					border: none;
					padding: 4px 8px;
					border-radius: 4px;
					cursor: pointer;
					font-size: 12px;
				}

				.events-grid {
					display: grid;
					gap: 16px;
					grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
				}

				.empty-state {
					text-align: center;
					padding: 40px;
					color: #6c757d;
				}

				.loading-container {
					display: flex;
					flex-direction: column;
					align-items: center;
					padding: 40px;
				}

				.loading-spinner {
					width: 40px;
					height: 40px;
					border: 4px solid #f3f3f3;
					border-top: 4px solid #007bff;
					border-radius: 50%;
					animation: spin 1s linear infinite;
					margin-bottom: 16px;
				}

				@keyframes spin {
					0% {
						transform: rotate(0deg);
					}
					100% {
						transform: rotate(360deg);
					}
				}

				.error-message {
					background-color: #f8d7da;
					color: #721c24;
					padding: 12px;
					border-radius: 4px;
					margin-bottom: 20px;
					border: 1px solid #f5c6cb;
				}
			`}</style>
		</div>
	)
})

// Event Card Component
interface EventCardProps {
	event: AuditEvent
	onClick: () => void
	isSelected: boolean
}

const EventCard = React.memo(function EventCard({ event, onClick, isSelected }: EventCardProps) {
	return (
		<div
			className={`event-card ${isSelected ? 'selected' : ''}`}
			onClick={onClick}
			role="button"
			tabIndex={0}
			onKeyDown={(e) => e.key === 'Enter' && onClick()}
		>
			<div className="event-header">
				<span className="event-action">{event.action}</span>
				<span className="event-status" style={{ backgroundColor: getStatusColor(event.status) }}>
					{event.status}
				</span>
			</div>

			<div className="event-details">
				<div className="event-resource">
					{event.targetResourceType}
					{event.targetResourceId && ` (${event.targetResourceId})`}
				</div>

				<div className="event-meta">
					<span className="event-timestamp">{formatTimestamp(event.timestamp)}</span>
					<span
						className="event-classification"
						style={{ backgroundColor: getClassificationColor(event.dataClassification) }}
					>
						{event.dataClassification}
					</span>
				</div>
			</div>

			<style jsx>{`
				.event-card {
					border: 1px solid #ddd;
					border-radius: 8px;
					padding: 16px;
					cursor: pointer;
					transition: all 0.2s ease;
					background-color: white;
				}

				.event-card:hover {
					border-color: #007bff;
					box-shadow: 0 2px 8px rgba(0, 123, 255, 0.15);
				}

				.event-card.selected {
					border-color: #007bff;
					box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
				}

				.event-header {
					display: flex;
					justify-content: space-between;
					align-items: center;
					margin-bottom: 12px;
				}

				.event-action {
					font-weight: bold;
					font-size: 16px;
				}

				.event-status {
					color: white;
					padding: 4px 8px;
					border-radius: 12px;
					font-size: 12px;
					font-weight: bold;
					text-transform: uppercase;
				}

				.event-resource {
					color: #6c757d;
					margin-bottom: 8px;
				}

				.event-meta {
					display: flex;
					justify-content: space-between;
					align-items: center;
					font-size: 12px;
				}

				.event-timestamp {
					color: #6c757d;
				}

				.event-classification {
					color: white;
					padding: 2px 6px;
					border-radius: 8px;
					font-weight: bold;
				}
			`}</style>
		</div>
	)
})

// Filter Panel Component
interface FilterPanelProps {
	filters: QueryAuditEventsParams
	onFiltersChange: (filters: Partial<QueryAuditEventsParams>) => void
	onClose: () => void
}

function FilterPanel({ filters, onFiltersChange, onClose }: FilterPanelProps) {
	const [localFilters, setLocalFilters] = useState(filters.filter || {})

	const applyFilters = () => {
		onFiltersChange({ filter: localFilters })
		onClose()
	}

	const clearFilters = () => {
		setLocalFilters({})
		onFiltersChange({ filter: {} })
		onClose()
	}

	return (
		<div className="filter-panel">
			<div className="filter-header">
				<h3>Filter Events</h3>
				<button onClick={onClose} className="close-button">
					×
				</button>
			</div>

			<div className="filter-content">
				<div className="filter-group">
					<label>Actions</label>
					<input
						type="text"
						placeholder="e.g., user.login, data.access"
						value={localFilters.actions?.join(', ') || ''}
						onChange={(e) =>
							setLocalFilters((prev) => ({
								...prev,
								actions: e.target.value
									? e.target.value.split(',').map((s) => s.trim())
									: undefined,
							}))
						}
					/>
				</div>

				<div className="filter-group">
					<label>Status</label>
					<select
						value={localFilters.statuses?.[0] || ''}
						onChange={(e) =>
							setLocalFilters((prev) => ({
								...prev,
								statuses: e.target.value ? [e.target.value as any] : undefined,
							}))
						}
					>
						<option value="">All</option>
						<option value="success">Success</option>
						<option value="failure">Failure</option>
						<option value="attempt">Attempt</option>
					</select>
				</div>

				<div className="filter-group">
					<label>Data Classification</label>
					<select
						value={localFilters.dataClassifications?.[0] || ''}
						onChange={(e) =>
							setLocalFilters((prev) => ({
								...prev,
								dataClassifications: e.target.value ? [e.target.value as any] : undefined,
							}))
						}
					>
						<option value="">All</option>
						<option value="PUBLIC">Public</option>
						<option value="INTERNAL">Internal</option>
						<option value="CONFIDENTIAL">Confidential</option>
						<option value="PHI">PHI</option>
					</select>
				</div>

				<div className="filter-actions">
					<button onClick={applyFilters} className="apply-button">
						Apply Filters
					</button>
					<button onClick={clearFilters} className="clear-button">
						Clear All
					</button>
				</div>
			</div>

			<style jsx>{`
				.filter-panel {
					background-color: #f8f9fa;
					border: 1px solid #ddd;
					border-radius: 8px;
					margin-bottom: 20px;
					overflow: hidden;
				}

				.filter-header {
					display: flex;
					justify-content: space-between;
					align-items: center;
					padding: 16px;
					background-color: #e9ecef;
					border-bottom: 1px solid #ddd;
				}

				.close-button {
					background: none;
					border: none;
					font-size: 24px;
					cursor: pointer;
					color: #6c757d;
				}

				.filter-content {
					padding: 16px;
				}

				.filter-group {
					margin-bottom: 16px;
				}

				.filter-group label {
					display: block;
					margin-bottom: 4px;
					font-weight: bold;
				}

				.filter-group input,
				.filter-group select {
					width: 100%;
					padding: 8px;
					border: 1px solid #ddd;
					border-radius: 4px;
				}

				.filter-actions {
					display: flex;
					gap: 10px;
				}

				.apply-button {
					background-color: #007bff;
					color: white;
					border: none;
					padding: 8px 16px;
					border-radius: 4px;
					cursor: pointer;
				}

				.clear-button {
					background-color: #6c757d;
					color: white;
					border: none;
					padding: 8px 16px;
					border-radius: 4px;
					cursor: pointer;
				}
			`}</style>
		</div>
	)
}

// Pagination Component
interface PaginationProps {
	current: number
	total: number
	onPageChange: (page: number) => void
}

function Pagination({ current, total, onPageChange }: PaginationProps) {
	const pages = Array.from({ length: total }, (_, i) => i)
	const visiblePages = pages.slice(Math.max(0, current - 2), Math.min(total, current + 3))

	return (
		<div className="pagination">
			<button
				onClick={() => onPageChange(current - 1)}
				disabled={current === 0}
				className="page-button"
			>
				Previous
			</button>

			{visiblePages.map((page) => (
				<button
					key={page}
					onClick={() => onPageChange(page)}
					className={`page-button ${page === current ? 'active' : ''}`}
				>
					{page + 1}
				</button>
			))}

			<button
				onClick={() => onPageChange(current + 1)}
				disabled={current === total - 1}
				className="page-button"
			>
				Next
			</button>

			<style jsx>{`
				.pagination {
					display: flex;
					justify-content: center;
					gap: 8px;
					margin-top: 20px;
				}

				.page-button {
					padding: 8px 12px;
					border: 1px solid #ddd;
					background-color: white;
					cursor: pointer;
					border-radius: 4px;
				}

				.page-button:hover:not(:disabled) {
					background-color: #f8f9fa;
				}

				.page-button.active {
					background-color: #007bff;
					color: white;
					border-color: #007bff;
				}

				.page-button:disabled {
					opacity: 0.5;
					cursor: not-allowed;
				}
			`}</style>
		</div>
	)
}

// Event Details Modal
interface EventDetailsModalProps {
	event: AuditEvent
	onClose: () => void
}

function EventDetailsModal({ event, onClose }: EventDetailsModalProps) {
	return (
		<div className="modal-overlay" onClick={onClose}>
			<div className="modal-content" onClick={(e) => e.stopPropagation()}>
				<div className="modal-header">
					<h3>Event Details</h3>
					<button onClick={onClose} className="close-button">
						×
					</button>
				</div>

				<div className="modal-body">
					<div className="detail-group">
						<label>ID:</label>
						<span>{event.id}</span>
					</div>

					<div className="detail-group">
						<label>Action:</label>
						<span>{event.action}</span>
					</div>

					<div className="detail-group">
						<label>Resource:</label>
						<span>
							{event.targetResourceType} {event.targetResourceId && `(${event.targetResourceId})`}
						</span>
					</div>

					<div className="detail-group">
						<label>Principal:</label>
						<span>{event.principalId}</span>
					</div>

					<div className="detail-group">
						<label>Organization:</label>
						<span>{event.organizationId}</span>
					</div>

					<div className="detail-group">
						<label>Status:</label>
						<span
							className="status-badge"
							style={{ backgroundColor: getStatusColor(event.status) }}
						>
							{event.status}
						</span>
					</div>

					<div className="detail-group">
						<label>Classification:</label>
						<span
							className="classification-badge"
							style={{ backgroundColor: getClassificationColor(event.dataClassification) }}
						>
							{event.dataClassification}
						</span>
					</div>

					<div className="detail-group">
						<label>Timestamp:</label>
						<span>{formatTimestamp(event.timestamp)}</span>
					</div>

					{event.outcomeDescription && (
						<div className="detail-group">
							<label>Outcome:</label>
							<span>{event.outcomeDescription}</span>
						</div>
					)}

					{event.details && (
						<div className="detail-group">
							<label>Details:</label>
							<pre className="details-json">{JSON.stringify(event.details, null, 2)}</pre>
						</div>
					)}
				</div>

				<style jsx>{`
					.modal-overlay {
						position: fixed;
						top: 0;
						left: 0;
						right: 0;
						bottom: 0;
						background-color: rgba(0, 0, 0, 0.5);
						display: flex;
						align-items: center;
						justify-content: center;
						z-index: 1000;
					}

					.modal-content {
						background-color: white;
						border-radius: 8px;
						max-width: 600px;
						max-height: 80vh;
						overflow-y: auto;
						width: 90%;
					}

					.modal-header {
						display: flex;
						justify-content: space-between;
						align-items: center;
						padding: 20px;
						border-bottom: 1px solid #ddd;
					}

					.close-button {
						background: none;
						border: none;
						font-size: 24px;
						cursor: pointer;
						color: #6c757d;
					}

					.modal-body {
						padding: 20px;
					}

					.detail-group {
						display: flex;
						margin-bottom: 12px;
						align-items: flex-start;
					}

					.detail-group label {
						font-weight: bold;
						min-width: 120px;
						margin-right: 12px;
					}

					.status-badge,
					.classification-badge {
						color: white;
						padding: 2px 8px;
						border-radius: 12px;
						font-size: 12px;
						font-weight: bold;
					}

					.details-json {
						background-color: #f8f9fa;
						padding: 12px;
						border-radius: 4px;
						font-size: 12px;
						overflow-x: auto;
						max-width: 100%;
					}
				`}</style>
			</div>
		</div>
	)
}

// Helper functions (moved outside components to avoid re-creation)
function getStatusColor(status: string) {
	switch (status) {
		case 'success':
			return '#28a745'
		case 'failure':
			return '#dc3545'
		case 'attempt':
			return '#ffc107'
		default:
			return '#6c757d'
	}
}

function getClassificationColor(classification: string) {
	switch (classification) {
		case 'PHI':
			return '#dc3545'
		case 'CONFIDENTIAL':
			return '#fd7e14'
		case 'INTERNAL':
			return '#ffc107'
		case 'PUBLIC':
			return '#28a745'
		default:
			return '#6c757d'
	}
}

function formatTimestamp(timestamp: string) {
	return new Date(timestamp).toLocaleString()
}
