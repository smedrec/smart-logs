import { ErrorBoundary } from '@/components/compliance/error/error-boundary'
import { ComplianceAuditProvider } from '@/contexts/compliance-audit-provider'
import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/compliance')({
	component: ComplianceLayout,
	errorComponent: ComplianceErrorComponent,
})

function ComplianceLayout() {
	return (
		<ErrorBoundary
			showErrorDetails={process.env.NODE_ENV === 'development'}
			onError={(error, errorInfo, errorId) => {
				// Log error to monitoring service in production
				console.error('Compliance route error:', {
					error,
					errorInfo,
					errorId,
					timestamp: new Date().toISOString(),
				})

				// In production, send to error tracking service (e.g., Sentry)
				if (process.env.NODE_ENV === 'production') {
					// Example: Sentry.captureException(error, { extra: { errorInfo, errorId } })
				}
			}}
		>
			<ComplianceAuditProvider>
				<Outlet />
			</ComplianceAuditProvider>
		</ErrorBoundary>
	)
}

function ComplianceErrorComponent({ error }: { error: Error }) {
	return (
		<ErrorBoundary
			showErrorDetails={process.env.NODE_ENV === 'development'}
			onError={(err, errorInfo, errorId) => {
				console.error('Compliance route-level error:', {
					error: err,
					errorInfo,
					errorId,
				})
			}}
		>
			<div className="min-h-screen flex items-center justify-center p-4">
				<div className="text-center">
					<h1 className="text-2xl font-bold text-destructive mb-4">Compliance System Error</h1>
					<p className="text-muted-foreground mb-4">
						{error.message || 'An unexpected error occurred in the compliance system'}
					</p>
					<button
						onClick={() => window.location.reload()}
						className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
					>
						Reload Page
					</button>
				</div>
			</div>
		</ErrorBoundary>
	)
}
