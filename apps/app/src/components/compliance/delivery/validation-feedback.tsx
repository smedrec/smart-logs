import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Info, XCircle } from 'lucide-react'
import * as React from 'react'

import type { ValidationResult } from '@smedrec/audit-client'

interface ValidationFeedbackProps {
	validation: ValidationResult
	className?: string
}

export function ValidationFeedback({ validation, className }: ValidationFeedbackProps) {
	const [isExpanded, setIsExpanded] = React.useState(false)

	if (validation.isValid) {
		return (
			<Alert className={className}>
				<CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
				<AlertTitle>Configuration Valid</AlertTitle>
				<AlertDescription>
					All configuration settings have been validated successfully.
				</AlertDescription>
			</Alert>
		)
	}

	const errorCount = validation.errors?.length || 0
	const warningCount = validation.warnings?.length || 0

	return (
		<Card className={className}>
			<CardHeader>
				<div className="flex items-start justify-between">
					<div className="space-y-1">
						<CardTitle className="flex items-center gap-2">
							<XCircle className="h-5 w-5 text-destructive" />
							Validation Failed
						</CardTitle>
						<CardDescription>
							Found {errorCount} {errorCount === 1 ? 'error' : 'errors'}
							{warningCount > 0 &&
								` and ${warningCount} ${warningCount === 1 ? 'warning' : 'warnings'}`}
						</CardDescription>
					</div>
					<div className="flex gap-2">
						{errorCount > 0 && (
							<Badge variant="destructive">
								{errorCount} {errorCount === 1 ? 'Error' : 'Errors'}
							</Badge>
						)}
						{warningCount > 0 && (
							<Badge variant="secondary">
								{warningCount} {warningCount === 1 ? 'Warning' : 'Warnings'}
							</Badge>
						)}
					</div>
				</div>
			</CardHeader>

			<CardContent className="space-y-4">
				{/* Errors */}
				{validation.errors && validation.errors.length > 0 && (
					<div className="space-y-2">
						<h4 className="text-sm font-medium flex items-center gap-2">
							<AlertCircle className="h-4 w-4 text-destructive" />
							Errors
						</h4>
						<div className="space-y-2">
							{validation.errors.map((error, index) => (
								<Alert key={index} variant="destructive" className="py-3">
									<AlertDescription className="text-sm">
										{typeof error === 'string' ? error : error.message || 'Unknown error'}
										{typeof error === 'object' && error.field && (
											<span className="block text-xs mt-1 opacity-80">Field: {error.field}</span>
										)}
									</AlertDescription>
								</Alert>
							))}
						</div>
					</div>
				)}

				{/* Warnings */}
				{validation.warnings && validation.warnings.length > 0 && (
					<Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
						<div className="space-y-2">
							<CollapsibleTrigger asChild>
								<Button variant="ghost" size="sm" className="w-full justify-between">
									<span className="flex items-center gap-2">
										<Info className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
										<span className="text-sm font-medium">Warnings</span>
									</span>
									{isExpanded ? (
										<ChevronUp className="h-4 w-4" />
									) : (
										<ChevronDown className="h-4 w-4" />
									)}
								</Button>
							</CollapsibleTrigger>
							<CollapsibleContent className="space-y-2">
								{validation.warnings.map((warning, index) => (
									<Alert
										key={index}
										className="border-yellow-200 dark:border-yellow-900/50 bg-yellow-50 dark:bg-yellow-900/10 py-3"
									>
										<AlertDescription className="text-sm text-yellow-800 dark:text-yellow-300">
											{typeof warning === 'string' ? warning : warning.message || 'Unknown warning'}
											{typeof warning === 'object' && warning.field && (
												<span className="block text-xs mt-1 opacity-80">
													Field: {warning.field}
												</span>
											)}
										</AlertDescription>
									</Alert>
								))}
							</CollapsibleContent>
						</div>
					</Collapsible>
				)}

				{/* Suggestions */}
				{validation.suggestions && validation.suggestions.length > 0 && (
					<div className="bg-muted rounded-md p-4 space-y-2">
						<h4 className="text-sm font-medium">Suggestions</h4>
						<ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
							{validation.suggestions.map((suggestion, index) => (
								<li key={index}>{suggestion}</li>
							))}
						</ul>
					</div>
				)}
			</CardContent>
		</Card>
	)
}

interface InlineValidationErrorProps {
	error?: string
	className?: string
}

export function InlineValidationError({ error, className }: InlineValidationErrorProps) {
	if (!error) return null

	return (
		<div className={`flex items-start gap-2 text-sm text-destructive ${className || ''}`}>
			<AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
			<span>{error}</span>
		</div>
	)
}

interface ValidationSummaryProps {
	validation: ValidationResult
	onDismiss?: () => void
	className?: string
}

export function ValidationSummary({ validation, onDismiss, className }: ValidationSummaryProps) {
	if (validation.isValid) {
		return (
			<Alert className={className}>
				<CheckCircle2 className="h-4 w-4" />
				<AlertTitle>All checks passed</AlertTitle>
				<AlertDescription>The configuration is valid and ready to use.</AlertDescription>
			</Alert>
		)
	}

	const errorCount = validation.errors?.length || 0
	const warningCount = validation.warnings?.length || 0

	return (
		<Alert variant="destructive" className={className}>
			<AlertCircle className="h-4 w-4" />
			<AlertTitle>Validation Issues Found</AlertTitle>
			<AlertDescription>
				<div className="space-y-2">
					<p>
						Please fix {errorCount} {errorCount === 1 ? 'error' : 'errors'}
						{warningCount > 0 &&
							` and review ${warningCount} ${warningCount === 1 ? 'warning' : 'warnings'}`}{' '}
						before proceeding.
					</p>
					{onDismiss && (
						<Button variant="outline" size="sm" onClick={onDismiss}>
							Dismiss
						</Button>
					)}
				</div>
			</AlertDescription>
		</Alert>
	)
}
