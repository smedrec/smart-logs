import { AuditClientError } from '@smedrec/audit-client'
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'

import { useAuditContext } from './audit-provider'

import type {
	ComplianceService,
	CreateScheduledReportInput,
	ExecutionHistoryParams,
	ListScheduledReportsParams,
	PaginatedExecutions,
	PaginatedScheduledReports,
	ReportExecution,
	ScheduledReport,
	ScheduledReportsService,
	UpdateScheduledReportInput,
} from '@smedrec/audit-client'

// Connection status monitoring
interface ConnectionStatus {
	isConnected: boolean
	lastChecked: Date
	retryCount: number
	error?: string
}

// Service wrapper interfaces for UI-specific needs
interface ComplianceAuditContextValue {
	// Connection status
	connectionStatus: ConnectionStatus

	// Service instances
	scheduledReports: ScheduledReportsService | null
	compliance: ComplianceService | null

	// Connection management
	checkConnection: () => Promise<boolean>
	reconnect: () => Promise<void>

	// Enhanced service methods with UI-specific error handling
	createScheduledReport: (input: CreateScheduledReportInput) => Promise<ScheduledReport>
	updateScheduledReport: (id: string, input: UpdateScheduledReportInput) => Promise<ScheduledReport>
	deleteScheduledReport: (id: string) => Promise<void>
	getScheduledReport: (id: string) => Promise<ScheduledReport>
	listScheduledReports: (params?: ListScheduledReportsParams) => Promise<PaginatedScheduledReports>
	executeScheduledReport: (id: string) => Promise<ReportExecution>
	getExecutionHistory: (
		reportId: string,
		params?: ExecutionHistoryParams
	) => Promise<PaginatedExecutions>

	// Error state
	lastError: string | null
	clearError: () => void
}

const ComplianceAuditContext = createContext<ComplianceAuditContextValue | undefined>(undefined)

interface ComplianceAuditProviderProps {
	children: React.ReactNode
	connectionCheckInterval?: number // milliseconds
	maxRetryAttempts?: number
}

export function ComplianceAuditProvider({
	children,
	connectionCheckInterval = 30000, // 30 seconds
	maxRetryAttempts = 3,
}: ComplianceAuditProviderProps) {
	const { client, isConnected, error: auditError, reconnect: auditReconnect } = useAuditContext()

	const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
		isConnected: false,
		lastChecked: new Date(),
		retryCount: 0,
	})

	const [lastError, setLastError] = useState<string | null>(null)

	// Initialize services when client is available
	const scheduledReports = client?.scheduledReports || null
	const compliance = client?.compliance || null

	// Connection status monitoring
	const checkConnection = useCallback(async (): Promise<boolean> => {
		if (!client) {
			setConnectionStatus((prev) => ({
				...prev,
				isConnected: false,
				lastChecked: new Date(),
				error: 'Audit client not initialized',
			}))
			return false
		}

		try {
			// Use health check to verify connection
			await client.health.check()

			setConnectionStatus((prev) => ({
				...prev,
				isConnected: true,
				lastChecked: new Date(),
				retryCount: 0,
				error: undefined,
			}))

			setLastError(null)
			return true
		} catch (error) {
			const errorMessage =
				error instanceof AuditClientError ? error.message : 'Connection check failed'

			setConnectionStatus((prev) => ({
				...prev,
				isConnected: false,
				lastChecked: new Date(),
				error: errorMessage,
			}))

			setLastError(errorMessage)
			return false
		}
	}, [client])

	// Reconnect with retry logic
	const reconnect = useCallback(async (): Promise<void> => {
		if (connectionStatus.retryCount >= maxRetryAttempts) {
			setLastError(`Max retry attempts (${maxRetryAttempts}) exceeded`)
			return
		}

		setConnectionStatus((prev) => ({
			...prev,
			retryCount: prev.retryCount + 1,
		}))

		try {
			await auditReconnect()
			await checkConnection()
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Reconnection failed'
			setLastError(errorMessage)
		}
	}, [auditReconnect, checkConnection, connectionStatus.retryCount, maxRetryAttempts])

	// Enhanced service methods with error handling
	const createScheduledReport = useCallback(
		async (input: CreateScheduledReportInput): Promise<ScheduledReport> => {
			if (!scheduledReports) {
				throw new Error('Scheduled reports service not available')
			}

			try {
				const result = await scheduledReports.create(input)
				setLastError(null)
				return result
			} catch (error) {
				const errorMessage =
					error instanceof AuditClientError ? error.message : 'Failed to create scheduled report'
				setLastError(errorMessage)
				throw error
			}
		},
		[scheduledReports]
	)

	const updateScheduledReport = useCallback(
		async (id: string, input: UpdateScheduledReportInput): Promise<ScheduledReport> => {
			if (!scheduledReports) {
				throw new Error('Scheduled reports service not available')
			}

			try {
				const result = await scheduledReports.update(id, input)
				setLastError(null)
				return result
			} catch (error) {
				const errorMessage =
					error instanceof AuditClientError ? error.message : 'Failed to update scheduled report'
				setLastError(errorMessage)
				throw error
			}
		},
		[scheduledReports]
	)

	const deleteScheduledReport = useCallback(
		async (id: string): Promise<void> => {
			if (!scheduledReports) {
				throw new Error('Scheduled reports service not available')
			}

			try {
				await scheduledReports.delete(id)
				setLastError(null)
			} catch (error) {
				const errorMessage =
					error instanceof AuditClientError ? error.message : 'Failed to delete scheduled report'
				setLastError(errorMessage)
				throw error
			}
		},
		[scheduledReports]
	)

	const getScheduledReport = useCallback(
		async (id: string): Promise<ScheduledReport> => {
			if (!scheduledReports) {
				throw new Error('Scheduled reports service not available')
			}

			try {
				const result = await scheduledReports.get(id)
				setLastError(null)
				return result
			} catch (error) {
				const errorMessage =
					error instanceof AuditClientError ? error.message : 'Failed to get scheduled report'
				setLastError(errorMessage)
				throw error
			}
		},
		[scheduledReports]
	)

	const listScheduledReports = useCallback(
		async (params?: ListScheduledReportsParams): Promise<PaginatedScheduledReports> => {
			if (!scheduledReports) {
				throw new Error('Scheduled reports service not available')
			}

			try {
				const result = await scheduledReports.list(params)
				setLastError(null)
				return result
			} catch (error) {
				const errorMessage =
					error instanceof AuditClientError ? error.message : 'Failed to list scheduled reports'
				setLastError(errorMessage)
				throw error
			}
		},
		[scheduledReports]
	)

	const executeScheduledReport = useCallback(
		async (id: string): Promise<ReportExecution> => {
			if (!scheduledReports) {
				throw new Error('Scheduled reports service not available')
			}

			try {
				const result = await scheduledReports.execute(id)
				setLastError(null)
				return result
			} catch (error) {
				const errorMessage =
					error instanceof AuditClientError ? error.message : 'Failed to execute scheduled report'
				setLastError(errorMessage)
				throw error
			}
		},
		[scheduledReports]
	)

	const getExecutionHistory = useCallback(
		async (reportId: string, params?: ExecutionHistoryParams): Promise<PaginatedExecutions> => {
			if (!scheduledReports) {
				throw new Error('Scheduled reports service not available')
			}

			try {
				const result = await scheduledReports.getExecutionHistory(reportId, params)
				setLastError(null)
				return result
			} catch (error) {
				const errorMessage =
					error instanceof AuditClientError ? error.message : 'Failed to get execution history'
				setLastError(errorMessage)
				throw error
			}
		},
		[scheduledReports]
	)

	const clearError = useCallback(() => {
		setLastError(null)
	}, [])

	// Update connection status based on audit context
	useEffect(() => {
		setConnectionStatus((prev) => ({
			...prev,
			isConnected: isConnected && !auditError,
			error: auditError || undefined,
		}))

		if (auditError) {
			setLastError(auditError)
		}
	}, [isConnected, auditError])

	// Periodic connection monitoring
	useEffect(() => {
		if (!connectionCheckInterval) return

		const interval = setInterval(() => {
			if (connectionStatus.isConnected) {
				checkConnection()
			}
		}, connectionCheckInterval)

		return () => clearInterval(interval)
	}, [checkConnection, connectionCheckInterval, connectionStatus.isConnected])

	// Initial connection check
	useEffect(() => {
		if (client && isConnected) {
			checkConnection()
		}
	}, [client, isConnected, checkConnection])

	const contextValue: ComplianceAuditContextValue = {
		connectionStatus,
		scheduledReports,
		compliance,
		checkConnection,
		reconnect,
		createScheduledReport,
		updateScheduledReport,
		deleteScheduledReport,
		getScheduledReport,
		listScheduledReports,
		executeScheduledReport,
		getExecutionHistory,
		lastError,
		clearError,
	}

	return (
		<ComplianceAuditContext.Provider value={contextValue}>
			{children}
		</ComplianceAuditContext.Provider>
	)
}

export function useComplianceAudit(): ComplianceAuditContextValue {
	const context = useContext(ComplianceAuditContext)
	if (context === undefined) {
		throw new Error('useComplianceAudit must be used within a ComplianceAuditProvider')
	}
	return context
}

// Hook for connection status monitoring
export function useConnectionStatus() {
	const { connectionStatus, checkConnection, reconnect } = useComplianceAudit()
	return { connectionStatus, checkConnection, reconnect }
}

// Hook for service availability
export function useComplianceServices() {
	const { scheduledReports, compliance, connectionStatus } = useComplianceAudit()

	return {
		scheduledReports,
		compliance,
		isAvailable: connectionStatus.isConnected && scheduledReports !== null && compliance !== null,
	}
}
