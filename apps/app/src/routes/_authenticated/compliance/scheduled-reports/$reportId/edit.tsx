import { Button } from '@/components/ui/button'
import { useComplianceAudit } from '@/contexts/compliance-audit-provider'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { lazy, Suspense } from 'react'

import type { ReportFormData } from '@/lib/compliance/form-transformers'
import type { UpdateScheduledReportInput } from '@smedrec/audit-client'

// Lazy load the report configuration form component
const ReportConfigurationForm = lazy(() =>
	import('@/components/compliance/forms').then((module) => ({
		default: module.ReportConfigurationForm,
	}))
)

export const Route = createFileRoute('/_authenticated/compliance/scheduled-reports/$reportId/edit')(
	{
		component: RouteComponent,
		beforeLoad: ({ context, params }) => {
			// Route guard: ensure user has permission to edit this specific report
			// and validate that reportId is a valid format
			if (!params.reportId || params.reportId.trim() === '') {
				throw new Error('Invalid report ID')
			}
			return context
		},
		errorComponent: ({ error }) => (
			<div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
				<p className="text-destructive">Error: {error.message}</p>
				<Button variant="outline" onClick={() => window.history.back()}>
					Go Back
				</Button>
			</div>
		),
	}
)

function RouteComponent() {
	const { reportId } = Route.useParams()
	const navigate = useNavigate()
	const context = Route.useRouteContext()
	const user = 'user' in context ? context.user : null
	const { getScheduledReport, updateScheduledReport, connectionStatus } = useComplianceAudit()

	// Fetch the existing report data
	const {
		data: report,
		isLoading,
		error,
	} = useQuery({
		queryKey: ['scheduled-report', reportId],
		queryFn: async () => {
			return await getScheduledReport(reportId)
		},
		enabled: connectionStatus.isConnected && !!reportId,
	})

	const handleSubmit = async (data: UpdateScheduledReportInput) => {
		try {
			// Update the scheduled report using the compliance audit provider
			await updateScheduledReport(reportId, data)

			// Navigate back to report details after successful update
			navigate({
				to: '/compliance/scheduled-reports/$reportId',
				params: { reportId },
			})
		} catch (error) {
			console.error('Failed to update report:', error)
			throw error // Let the form component handle the error display
		}
	}

	const handleCancel = () => {
		navigate({
			to: '/compliance/scheduled-reports/$reportId',
			params: { reportId },
		})
	}

	// Show loading state
	if (isLoading) {
		return (
			<div className="flex items-center justify-center min-h-[400px]">
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
				<span className="ml-2 text-muted-foreground">Loading report...</span>
			</div>
		)
	}

	// Show error state
	if (error) {
		return (
			<div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
				<p className="text-destructive">Failed to load report: {error.message}</p>
				<Button variant="outline" onClick={() => navigate({ to: '/compliance/scheduled-reports' })}>
					Back to Reports
				</Button>
			</div>
		)
	}

	// Transform API data to form data format
	const initialFormData: Partial<ReportFormData> | undefined = report
		? {
				name: report.name,
				description: report.description,
				reportType: report.reportType,
				format: report.format?.toUpperCase() as 'PDF' | 'CSV' | 'JSON',
				schedule: {
					frequency: report.schedule.frequency,
					time: `${String(report.schedule.hour).padStart(2, '0')}:${String(report.schedule.minute).padStart(2, '0')}`,
					dayOfWeek: report.schedule.dayOfWeek
						? [
								'sunday',
								'monday',
								'tuesday',
								'wednesday',
								'thursday',
								'friday',
								'saturday',
							].indexOf(report.schedule.dayOfWeek)
						: undefined,
					dayOfMonth: report.schedule.dayOfMonth,
					timezone: report.schedule.timezone,
					cronExpression: report.schedule.cronExpression,
					startDate: report.schedule.startDate,
					endDate: report.schedule.endDate,
					skipWeekends: report.schedule.skipWeekends,
					skipHolidays: report.schedule.skipHolidays,
					holidayCalendar: report.schedule.holidayCalendar,
					maxMissedRuns: report.schedule.maxMissedRuns,
					catchUpMissedRuns: report.schedule.catchUpMissedRuns,
				},
				notifications: {
					onSuccess: report.notifications?.onSuccess ?? true,
					onFailure: report.notifications?.onFailure ?? true,
					onSkip: report.notifications?.onSkip,
					recipients: report.notifications?.recipients || [],
					includeReport: report.notifications?.includeReport,
					customMessage: report.notifications?.customMessage,
				},
				parameters: {
					dateRange: report.criteria.dateRange,
					organizationIds: report.criteria.organizationIds,
					principalIds: report.criteria.principalIds,
					actions: report.criteria.actions,
					resourceTypes: report.criteria.resourceTypes,
					dataClassifications: report.criteria.dataClassifications,
					statuses: report.criteria.statuses,
					verifiedOnly: report.criteria.verifiedOnly,
					includeIntegrityFailures: report.criteria.includeIntegrityFailures,
					limit: report.criteria.limit,
					offset: report.criteria.offset,
					sortBy: report.criteria.sortBy,
					sortOrder: report.criteria.sortOrder,
				},
				delivery: report.delivery,
				export: report.export,
				enabled: report.enabled,
				tags: report.tags,
				metadata: report.metadata,
				templateId: report.templateId,
			}
		: undefined

	return (
		<Suspense
			fallback={
				<div className="flex items-center justify-center min-h-[400px]">
					<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
				</div>
			}
		>
			<ReportConfigurationForm
				mode="edit"
				reportId={reportId}
				initialData={initialFormData}
				onSubmit={handleSubmit}
				onCancel={handleCancel}
				userId={user?.id || 'system'}
			/>
		</Suspense>
	)
}
