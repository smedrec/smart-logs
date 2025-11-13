import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { AlertCircle, CheckCircle2, Loader2, RefreshCw, XCircle } from 'lucide-react'
import * as React from 'react'

import type { ConnectionTestResult } from '@smedrec/audit-client'

interface TestDestinationDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	destinationId: string
	destinationLabel: string
	onTest: (destinationId: string) => Promise<ConnectionTestResult>
}

type TestState = 'idle' | 'testing' | 'success' | 'error'

export function TestDestinationDialog({
	open,
	onOpenChange,
	destinationId,
	destinationLabel,
	onTest,
}: TestDestinationDialogProps) {
	const [testState, setTestState] = React.useState<TestState>('idle')
	const [testResult, setTestResult] = React.useState<ConnectionTestResult | null>(null)
	const [progress, setProgress] = React.useState(0)
	const [error, setError] = React.useState<string | null>(null)

	// Reset state when dialog opens/closes
	React.useEffect(() => {
		if (!open) {
			setTestState('idle')
			setTestResult(null)
			setProgress(0)
			setError(null)
		}
	}, [open])

	// Simulate progress during testing
	React.useEffect(() => {
		if (testState === 'testing') {
			const interval = setInterval(() => {
				setProgress((prev) => {
					if (prev >= 90) return prev
					return prev + 10
				})
			}, 200)

			return () => clearInterval(interval)
		}
	}, [testState])

	const handleTest = async () => {
		setTestState('testing')
		setProgress(0)
		setError(null)
		setTestResult(null)

		try {
			const result = await onTest(destinationId)
			setProgress(100)
			setTestResult(result)

			if (result.success) {
				setTestState('success')
			} else {
				setTestState('error')
			}
		} catch (err) {
			setProgress(100)
			setTestState('error')
			setError(err instanceof Error ? err.message : 'Failed to test connection')
		}
	}

	const handleRetry = () => {
		handleTest()
	}

	const handleClose = () => {
		onOpenChange(false)
	}

	const renderTestStatus = () => {
		switch (testState) {
			case 'idle':
				return (
					<div className="text-center py-8">
						<div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
							<AlertCircle className="h-6 w-6 text-muted-foreground" />
						</div>
						<p className="text-sm text-muted-foreground">
							Click "Start Test" to verify the connection to this destination
						</p>
					</div>
				)

			case 'testing':
				return (
					<div className="space-y-4 py-8">
						<div className="flex items-center justify-center mb-4">
							<Loader2 className="h-8 w-8 animate-spin text-primary" />
						</div>
						<div className="space-y-2">
							<div className="flex items-center justify-between text-sm">
								<span className="text-muted-foreground">Testing connection...</span>
								<span className="font-medium">{progress}%</span>
							</div>
							<Progress value={progress} className="h-2" />
						</div>
						<p className="text-xs text-center text-muted-foreground">This may take a few moments</p>
					</div>
				)

			case 'success':
				return (
					<div className="space-y-4 py-8">
						<div className="flex items-center justify-center mb-4">
							<div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
								<CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
							</div>
						</div>
						<Alert className="border-green-200 dark:border-green-900/50 bg-green-50 dark:bg-green-900/10">
							<CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
							<AlertDescription className="text-green-800 dark:text-green-300">
								Connection test successful! The destination is configured correctly.
							</AlertDescription>
						</Alert>

						{testResult && (
							<div className="space-y-3 pt-4 border-t">
								<h4 className="text-sm font-medium">Test Details</h4>
								<div className="grid grid-cols-2 gap-3 text-sm">
									{testResult.responseTime !== undefined && (
										<div>
											<span className="text-muted-foreground">Response Time:</span>
											<p className="font-medium">{testResult.responseTime}ms</p>
										</div>
									)}
									{testResult.statusCode !== undefined && (
										<div>
											<span className="text-muted-foreground">Status Code:</span>
											<p className="font-medium">{testResult.statusCode}</p>
										</div>
									)}
								</div>

								{testResult.details && Object.keys(testResult.details).length > 0 && (
									<div className="space-y-2">
										<span className="text-sm text-muted-foreground">Additional Details:</span>
										<div className="bg-muted rounded-md p-3 text-xs font-mono space-y-1">
											{Object.entries(testResult.details).map(([key, value]) => (
												<div key={key} className="flex justify-between">
													<span className="text-muted-foreground">{key}:</span>
													<span>{String(value)}</span>
												</div>
											))}
										</div>
									</div>
								)}
							</div>
						)}
					</div>
				)

			case 'error':
				return (
					<div className="space-y-4 py-8">
						<div className="flex items-center justify-center mb-4">
							<div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
								<XCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
							</div>
						</div>
						<Alert variant="destructive">
							<AlertCircle className="h-4 w-4" />
							<AlertDescription>
								{error || testResult?.error || 'Connection test failed'}
							</AlertDescription>
						</Alert>

						{testResult && (
							<div className="space-y-3 pt-4 border-t">
								<h4 className="text-sm font-medium">Error Details</h4>
								<div className="grid grid-cols-2 gap-3 text-sm">
									{testResult.responseTime !== undefined && (
										<div>
											<span className="text-muted-foreground">Response Time:</span>
											<p className="font-medium">{testResult.responseTime}ms</p>
										</div>
									)}
									{testResult.statusCode !== undefined && (
										<div>
											<span className="text-muted-foreground">Status Code:</span>
											<Badge variant="destructive">{testResult.statusCode}</Badge>
										</div>
									)}
								</div>

								{testResult.details && Object.keys(testResult.details).length > 0 && (
									<div className="space-y-2">
										<span className="text-sm text-muted-foreground">Additional Details:</span>
										<div className="bg-muted rounded-md p-3 text-xs font-mono space-y-1">
											{Object.entries(testResult.details).map(([key, value]) => (
												<div key={key} className="flex justify-between">
													<span className="text-muted-foreground">{key}:</span>
													<span>{String(value)}</span>
												</div>
											))}
										</div>
									</div>
								)}
							</div>
						)}

						<div className="bg-muted rounded-md p-4 space-y-2">
							<h4 className="text-sm font-medium">Troubleshooting Tips</h4>
							<ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
								<li>Verify the destination configuration is correct</li>
								<li>Check network connectivity and firewall settings</li>
								<li>Ensure credentials are valid and have proper permissions</li>
								<li>Review the error message for specific issues</li>
							</ul>
						</div>
					</div>
				)
		}
	}

	const renderFooter = () => {
		switch (testState) {
			case 'idle':
				return (
					<DialogFooter>
						<Button variant="outline" onClick={handleClose}>
							Cancel
						</Button>
						<Button onClick={handleTest}>Start Test</Button>
					</DialogFooter>
				)

			case 'testing':
				return (
					<DialogFooter>
						<Button variant="outline" disabled>
							Testing...
						</Button>
					</DialogFooter>
				)

			case 'success':
			case 'error':
				return (
					<DialogFooter>
						<Button variant="outline" onClick={handleClose}>
							Close
						</Button>
						<Button onClick={handleRetry}>
							<RefreshCw className="mr-2 h-4 w-4" />
							Test Again
						</Button>
					</DialogFooter>
				)
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[500px]">
				<DialogHeader>
					<DialogTitle>Test Destination Connection</DialogTitle>
					<DialogDescription>
						Testing connection to <span className="font-medium">{destinationLabel}</span>
					</DialogDescription>
				</DialogHeader>

				{renderTestStatus()}

				{renderFooter()}
			</DialogContent>
		</Dialog>
	)
}
