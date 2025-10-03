import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { AlertCircle, AlertTriangle, CheckCircle, Info, X } from 'lucide-react'
import React from 'react'

import type { UIError } from '@/lib/compliance-error-handler'

// Validation error types specific to alert management
export interface AlertValidationError {
	field: string
	message: string
	code?: string
	severity?: 'error' | 'warning' | 'info'
}

export interface AlertValidationSummary {
	isValid: boolean
	errors: AlertValidationError[]
	warnings: AlertValidationError[]
	fieldErrors: Record<string, AlertValidationError[]>
	totalErrors: number
	totalWarnings: number
}

interface AlertValidationFeedbackProps {
	/**
	 * Validation summary containing all validation results
	 */
	validation?: AlertValidationSummary
	/**
	 * Individual validation errors to display
	 */
	errors?: AlertValidationError[]
	/**
	 * Field name for field-specific validation
	 */
	field?: string
	/**
	 * Whether to show real-time validation indicators
	 */
	realTime?: boolean
	/**
	 * Whether to show validation summary
	 */
	showSummary?: boolean
	/**
	 * Whether to show field-level errors inline
	 */
	showInline?: boolean
	/**
	 * Custom CSS classes
	 */
	className?: string
	/**
	 * Callback when validation errors are dismissed
	 */
	onDismiss?: (field?: string) => void
	/**
	 * Whether to show success state when valid
	 */
	showSuccess?: boolean
}

/**
 * AlertValidationFeedback component for form validation feedback in alert action forms
 *
 * Features:
 * - Form validation feedback for alert action forms
 * - Real-time validation indicators
 * - Validation summary and error aggregation
 * - Field-level and form-level error display
 * - Accessibility compliant with proper ARIA labels
 * - Integration with existing form components
 *
 * @example
 * ```tsx
 * <AlertValidationFeedback
 *   validation={validationSummary}
 *   showSummary={true}
 *   realTime={true}
 * />
 * ```
 */
export function AlertValidationFeedback({
	validation,
	errors = [],
	field,
	realTime = false,
	showSummary = false,
	showInline = true,
	className,
	onDismiss,
	showSuccess = false,
}: AlertValidationFeedbackProps) {
	// Determine which errors to show
	const displayErrors = React.useMemo(() => {
		if (validation) {
			if (field) {
				return validation.fieldErrors[field] || []
			}
			return validation.errors
		}
		return errors
	}, [validation, errors, field])

	const displayWarnings = React.useMemo(() => {
		if (validation && !field) {
			return validation.warnings
		}
		return []
	}, [validation, field])

	// Show success state if valid and no errors
	const isValid = validation?.isValid ?? displayErrors.length === 0
	const hasWarnings = displayWarnings.length > 0

	if (isValid && !hasWarnings && !showSuccess) {
		return null
	}

	return (
		<div className={cn('space-y-2', className)}>
			{/* Validation Summary */}
			{showSummary && validation && !field && (
				<AlertValidationSummary
					validation={validation}
					onDismiss={onDismiss}
					showSuccess={showSuccess}
				/>
			)}

			{/* Field-level Errors */}
			{showInline && displayErrors.length > 0 && (
				<div className="space-y-1">
					{displayErrors.map((error, index) => (
						<AlertFieldValidationError
							key={`${error.field}-${index}`}
							error={error}
							realTime={realTime}
							onDismiss={onDismiss}
						/>
					))}
				</div>
			)}

			{/* Field-level Warnings */}
			{showInline && displayWarnings.length > 0 && (
				<div className="space-y-1">
					{displayWarnings.map((warning, index) => (
						<AlertFieldValidationError
							key={`warning-${index}`}
							error={warning}
							realTime={realTime}
							onDismiss={onDismiss}
						/>
					))}
				</div>
			)}

			{/* Success State */}
			{isValid && showSuccess && !hasWarnings && (
				<div className="flex items-center gap-2 text-sm text-green-600">
					<CheckCircle className="h-4 w-4" />
					<span>All fields are valid</span>
				</div>
			)}
		</div>
	)
}

// Validation summary component
interface AlertValidationSummaryProps {
	validation: AlertValidationSummary
	onDismiss?: () => void
	showSuccess?: boolean
}

function AlertValidationSummary({
	validation,
	onDismiss,
	showSuccess = false,
}: AlertValidationSummaryProps) {
	const { isValid, totalErrors, totalWarnings } = validation

	if (isValid && !showSuccess) {
		return null
	}

	const getVariant = () => {
		if (totalErrors > 0) return 'destructive'
		if (totalWarnings > 0) return 'default'
		return 'default'
	}

	const getIcon = () => {
		if (totalErrors > 0) return <AlertCircle className="h-4 w-4" />
		if (totalWarnings > 0) return <AlertTriangle className="h-4 w-4" />
		return <CheckCircle className="h-4 w-4" />
	}

	const getMessage = () => {
		if (totalErrors > 0 && totalWarnings > 0) {
			return `Found ${totalErrors} error${totalErrors > 1 ? 's' : ''} and ${totalWarnings} warning${totalWarnings > 1 ? 's' : ''}`
		}
		if (totalErrors > 0) {
			return `Found ${totalErrors} validation error${totalErrors > 1 ? 's' : ''}`
		}
		if (totalWarnings > 0) {
			return `Found ${totalWarnings} warning${totalWarnings > 1 ? 's' : ''}`
		}
		return 'All fields are valid'
	}

	return (
		<Alert variant={getVariant()} className="relative">
			{getIcon()}
			<div className="flex-1">
				<AlertDescription className="flex items-center justify-between">
					<span>{getMessage()}</span>
					{onDismiss && (
						<Button
							variant="ghost"
							size="sm"
							onClick={onDismiss}
							className="h-6 w-6 p-0 hover:bg-transparent"
						>
							<X className="h-4 w-4" />
							<span className="sr-only">Dismiss</span>
						</Button>
					)}
				</AlertDescription>
			</div>
		</Alert>
	)
}

// Individual field validation error component
interface AlertFieldValidationErrorProps {
	error: AlertValidationError
	realTime?: boolean
	onDismiss?: (field?: string) => void
}

function AlertFieldValidationError({
	error,
	realTime = false,
	onDismiss,
}: AlertFieldValidationErrorProps) {
	const severity = error.severity || 'error'

	const getIcon = () => {
		switch (severity) {
			case 'error':
				return <AlertCircle className="h-3 w-3" />
			case 'warning':
				return <AlertTriangle className="h-3 w-3" />
			case 'info':
				return <Info className="h-3 w-3" />
			default:
				return <AlertCircle className="h-3 w-3" />
		}
	}

	const getColorClasses = () => {
		switch (severity) {
			case 'error':
				return 'text-destructive'
			case 'warning':
				return 'text-yellow-600'
			case 'info':
				return 'text-blue-600'
			default:
				return 'text-destructive'
		}
	}

	return (
		<div
			className={cn(
				'flex items-start gap-2 text-xs',
				getColorClasses(),
				realTime && 'animate-in slide-in-from-left-2 duration-200'
			)}
		>
			{getIcon()}
			<div className="flex-1">
				<span>{error.message}</span>
				{error.code && (
					<Badge variant="outline" className="ml-2 text-xs">
						{error.code}
					</Badge>
				)}
			</div>
			{onDismiss && (
				<Button
					variant="ghost"
					size="sm"
					onClick={() => onDismiss(error.field)}
					className="h-4 w-4 p-0 hover:bg-transparent"
				>
					<X className="h-2 w-2" />
					<span className="sr-only">Dismiss error for {error.field}</span>
				</Button>
			)}
		</div>
	)
}

// Specialized validation components for alert forms

interface AlertActionValidationProps {
	action: 'acknowledge' | 'resolve' | 'dismiss'
	errors: AlertValidationError[]
	onDismiss?: () => void
}

/**
 * Validation feedback specifically for alert action forms
 */
export function AlertActionValidation({ action, errors, onDismiss }: AlertActionValidationProps) {
	const actionLabels = {
		acknowledge: 'Acknowledge Alert',
		resolve: 'Resolve Alert',
		dismiss: 'Dismiss Alert',
	}

	if (errors.length === 0) {
		return null
	}

	return (
		<Alert variant="destructive">
			<AlertCircle className="h-4 w-4" />
			<div className="flex-1">
				<AlertDescription>
					<div className="space-y-2">
						<div className="flex items-center justify-between">
							<span className="font-medium">Cannot {actionLabels[action].toLowerCase()}</span>
							{onDismiss && (
								<Button
									variant="ghost"
									size="sm"
									onClick={onDismiss}
									className="h-6 w-6 p-0 hover:bg-transparent"
								>
									<X className="h-4 w-4" />
								</Button>
							)}
						</div>
						<div className="space-y-1">
							{errors.map((error, index) => (
								<div key={index} className="text-sm">
									• {error.message}
								</div>
							))}
						</div>
					</div>
				</AlertDescription>
			</div>
		</Alert>
	)
}

// Validation utilities for alert forms

/**
 * Validates alert resolution form data
 */
export function validateAlertResolution(data: {
	notes?: string
	requireNotes?: boolean
}): AlertValidationError[] {
	const errors: AlertValidationError[] = []

	if (data.requireNotes && (!data.notes || data.notes.trim().length === 0)) {
		errors.push({
			field: 'notes',
			message: 'Resolution notes are required',
			code: 'REQUIRED_FIELD',
			severity: 'error',
		})
	}

	if (data.notes && data.notes.length > 1000) {
		errors.push({
			field: 'notes',
			message: 'Resolution notes must be less than 1000 characters',
			code: 'MAX_LENGTH',
			severity: 'error',
		})
	}

	return errors
}

/**
 * Validates alert filter form data
 */
export function validateAlertFilters(data: {
	dateRange?: { start?: Date; end?: Date }
	severity?: string[]
	status?: string[]
}): AlertValidationError[] {
	const errors: AlertValidationError[] = []

	// Validate date range
	if (data.dateRange?.start && data.dateRange?.end) {
		if (data.dateRange.start > data.dateRange.end) {
			errors.push({
				field: 'dateRange',
				message: 'Start date must be before end date',
				code: 'INVALID_DATE_RANGE',
				severity: 'error',
			})
		}

		// Warn if date range is too large
		const daysDiff =
			Math.abs(data.dateRange.end.getTime() - data.dateRange.start.getTime()) /
			(1000 * 60 * 60 * 24)
		if (daysDiff > 365) {
			errors.push({
				field: 'dateRange',
				message: 'Date range longer than 1 year may affect performance',
				code: 'LARGE_DATE_RANGE',
				severity: 'warning',
			})
		}
	}

	return errors
}

/**
 * Creates a validation summary from individual errors
 */
export function createValidationSummary(errors: AlertValidationError[]): AlertValidationSummary {
	const errorsByField: Record<string, AlertValidationError[]> = {}
	const actualErrors: AlertValidationError[] = []
	const warnings: AlertValidationError[] = []

	errors.forEach((error) => {
		// Group by field
		if (!errorsByField[error.field]) {
			errorsByField[error.field] = []
		}
		errorsByField[error.field].push(error)

		// Separate errors and warnings
		if (error.severity === 'warning') {
			warnings.push(error)
		} else {
			actualErrors.push(error)
		}
	})

	return {
		isValid: actualErrors.length === 0,
		errors: actualErrors,
		warnings,
		fieldErrors: errorsByField,
		totalErrors: actualErrors.length,
		totalWarnings: warnings.length,
	}
}

// Hook for managing validation state
export function useAlertValidation() {
	const [errors, setErrors] = React.useState<AlertValidationError[]>([])
	const [isValidating, setIsValidating] = React.useState(false)

	const validation = React.useMemo(() => createValidationSummary(errors), [errors])

	const addError = React.useCallback((error: AlertValidationError) => {
		setErrors((prev) => [...prev, error])
	}, [])

	const removeError = React.useCallback((field: string) => {
		setErrors((prev) => prev.filter((error) => error.field !== field))
	}, [])

	const clearErrors = React.useCallback(() => {
		setErrors([])
	}, [])

	const validateField = React.useCallback(
		async (field: string, value: any, validator: (value: any) => AlertValidationError[]) => {
			setIsValidating(true)

			// Remove existing errors for this field
			removeError(field)

			try {
				const fieldErrors = validator(value)
				fieldErrors.forEach(addError)
			} finally {
				setIsValidating(false)
			}
		},
		[addError, removeError]
	)

	return {
		validation,
		errors,
		isValidating,
		addError,
		removeError,
		clearErrors,
		validateField,
	}
}
