import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { cva } from 'class-variance-authority'
import {
	AlertCircle,
	AlertTriangle,
	CheckCircle,
	ChevronDown,
	ChevronRight,
	Info,
	X,
	XCircle,
} from 'lucide-react'
import React from 'react'

import type { VariantProps } from 'class-variance-authority'
import type { ValidationError } from '../types/ui-types'

const validationVariants = cva('text-sm', {
	variants: {
		variant: {
			error: 'text-destructive',
			warning: 'text-yellow-600 dark:text-yellow-400',
			success: 'text-green-600 dark:text-green-400',
			info: 'text-blue-600 dark:text-blue-400',
		},
	},
	defaultVariants: {
		variant: 'error',
	},
})

interface ValidationResult {
	isValid: boolean
	errors: ValidationError[]
	warnings: ValidationError[]
	fieldErrors: Record<string, ValidationError[]>
}

interface ValidationFeedbackProps extends VariantProps<typeof validationVariants> {
	error?: string | ValidationError
	errors?: ValidationError[]
	className?: string
	showIcon?: boolean
	inline?: boolean
	dismissible?: boolean
	onDismiss?: () => void
}

interface ValidationSummaryProps {
	result: ValidationResult
	className?: string
	collapsible?: boolean
	showFieldCount?: boolean
	onFieldClick?: (field: string) => void
}

interface FieldValidationProps {
	field: string
	errors?: ValidationError[]
	touched?: boolean
	className?: string
	showLabel?: boolean
}

/**
 * Get appropriate icon for validation variant
 */
const getValidationIcon = (variant: ValidationFeedbackProps['variant'], severity?: string) => {
	const iconVariant = severity || variant
	switch (iconVariant) {
		case 'error':
			return XCircle
		case 'warning':
			return AlertTriangle
		case 'success':
			return CheckCircle
		case 'info':
			return Info
		default:
			return AlertCircle
	}
}

/**
 * Individual validation feedback component for form fields
 *
 * Features:
 * - Field-level error display
 * - Multiple severity levels (error, warning, info)
 * - Inline and block display modes
 * - Dismissible feedback
 * - Icon indicators
 *
 * Requirements: 8.3, 8.4
 */
export const ValidationFeedback: React.FC<ValidationFeedbackProps> = ({
	error,
	errors = [],
	variant = 'error',
	className,
	showIcon = true,
	inline = false,
	dismissible = false,
	onDismiss,
}) => {
	const validationErrors = React.useMemo(() => {
		if (error) {
			if (typeof error === 'string') {
				return [{ field: '', message: error, severity: variant as any }]
			}
			return [error]
		}
		return errors
	}, [error, errors, variant])

	if (validationErrors.length === 0) {
		return null
	}

	const Icon = getValidationIcon(variant, validationErrors[0]?.severity)

	if (inline) {
		return (
			<div className={cn('flex items-start gap-2', className)}>
				{showIcon && <Icon className="h-4 w-4 mt-0.5 flex-shrink-0" />}
				<div className="flex-1 space-y-1">
					{validationErrors.map((err, index) => (
						<div
							key={index}
							className={cn(validationVariants({ variant: (err.severity as any) || variant }))}
						>
							{err.message}
						</div>
					))}
				</div>
				{dismissible && onDismiss && (
					<Button
						variant="ghost"
						size="sm"
						onClick={onDismiss}
						className="h-4 w-4 p-0 hover:bg-transparent"
					>
						<X className="h-3 w-3" />
					</Button>
				)}
			</div>
		)
	}

	return (
		<div className={cn('space-y-2', className)}>
			{validationErrors.map((err, index) => (
				<Alert
					key={index}
					variant={err.severity === 'error' ? 'destructive' : 'default'}
					className="py-2"
				>
					{showIcon && <Icon className="h-4 w-4" />}
					<AlertDescription className="flex items-start justify-between">
						<div className="space-y-1">
							<div
								className={cn(validationVariants({ variant: (err.severity as any) || variant }))}
							>
								{err.message}
							</div>
							{err.suggestions && err.suggestions.length > 0 && (
								<div className="text-xs text-muted-foreground space-y-1">
									<div>Suggestions:</div>
									<ul className="list-disc list-inside space-y-0.5 ml-2">
										{err.suggestions.map((suggestion: string, i: number) => (
											<li key={i}>{suggestion}</li>
										))}
									</ul>
								</div>
							)}
						</div>
						{dismissible && onDismiss && (
							<Button
								variant="ghost"
								size="sm"
								onClick={onDismiss}
								className="h-4 w-4 p-0 hover:bg-transparent ml-2"
							>
								<X className="h-3 w-3" />
							</Button>
						)}
					</AlertDescription>
				</Alert>
			))}
		</div>
	)
}

/**
 * Field-specific validation feedback component
 */
export const FieldValidation: React.FC<FieldValidationProps> = ({
	field,
	errors = [],
	touched = false,
	className,
	showLabel = false,
}) => {
	// Only show errors if field has been touched or has errors
	const shouldShow = touched || errors.length > 0

	if (!shouldShow || errors.length === 0) {
		return null
	}

	return (
		<div className={cn('mt-1', className)}>
			{showLabel && errors.length > 0 && (
				<div className="text-xs font-medium text-muted-foreground mb-1">{field} validation:</div>
			)}
			<ValidationFeedback errors={errors} inline showIcon className="text-xs" />
		</div>
	)
}

/**
 * Validation summary component for forms
 *
 * Features:
 * - Aggregated validation results
 * - Collapsible error groups
 * - Field navigation
 * - Error/warning counts
 * - Severity-based grouping
 */
export const ValidationSummary: React.FC<ValidationSummaryProps> = ({
	result,
	className,
	collapsible = true,
	showFieldCount = true,
	onFieldClick,
}) => {
	const [isExpanded, setIsExpanded] = React.useState(!collapsible || !result.isValid)

	const totalErrors = result.errors.length
	const totalWarnings = result.warnings.length
	const affectedFields = Object.keys(result.fieldErrors).length

	if (totalErrors === 0 && totalWarnings === 0) {
		return (
			<Alert className={cn('border-green-200 bg-green-50 dark:bg-green-950/20', className)}>
				<CheckCircle className="h-4 w-4 text-green-600" />
				<AlertDescription className="text-green-700 dark:text-green-400">
					All validation checks passed successfully.
				</AlertDescription>
			</Alert>
		)
	}

	const handleFieldClick = (field: string) => {
		if (onFieldClick) {
			onFieldClick(field)
		}
	}

	return (
		<Card className={cn('border-destructive/50', className)}>
			<CardHeader className="pb-3">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<XCircle className="h-5 w-5 text-destructive" />
						<CardTitle className="text-base">Validation Issues</CardTitle>
						<div className="flex gap-2">
							{totalErrors > 0 && (
								<Badge variant="destructive" className="text-xs">
									{totalErrors} error{totalErrors !== 1 ? 's' : ''}
								</Badge>
							)}
							{totalWarnings > 0 && (
								<Badge
									variant="secondary"
									className="text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
								>
									{totalWarnings} warning{totalWarnings !== 1 ? 's' : ''}
								</Badge>
							)}
						</div>
					</div>
					{collapsible && (
						<Button
							variant="ghost"
							size="sm"
							onClick={() => setIsExpanded(!isExpanded)}
							className="h-6 w-6 p-0"
						>
							{isExpanded ? (
								<ChevronDown className="h-4 w-4" />
							) : (
								<ChevronRight className="h-4 w-4" />
							)}
						</Button>
					)}
				</div>
				{showFieldCount && affectedFields > 0 && (
					<CardDescription>
						{affectedFields} field{affectedFields !== 1 ? 's' : ''} require
						{affectedFields === 1 ? 's' : ''} attention
					</CardDescription>
				)}
			</CardHeader>

			{isExpanded && (
				<CardContent className="pt-0 space-y-4">
					{/* Field-specific errors */}
					{Object.entries(result.fieldErrors).map(([field, fieldErrors]) => (
						<div key={field} className="space-y-2">
							<div className="flex items-center gap-2">
								<Button
									variant="ghost"
									size="sm"
									onClick={() => handleFieldClick(field)}
									className="h-auto p-0 font-medium text-sm hover:underline"
								>
									{field}
								</Button>
								<Badge variant="outline" className="text-xs">
									{fieldErrors.length} issue{fieldErrors.length !== 1 ? 's' : ''}
								</Badge>
							</div>
							<div className="ml-4 space-y-1">
								{fieldErrors.map((error, index) => (
									<div key={index} className="flex items-start gap-2">
										{getValidationIcon((error.severity as any) || 'error')({
											className: 'h-3 w-3 mt-0.5 flex-shrink-0',
										})}
										<div className="text-sm">
											<div
												className={cn(
													validationVariants({ variant: (error.severity as any) || 'error' })
												)}
											>
												{error.message}
											</div>
											{error.suggestions && error.suggestions.length > 0 && (
												<div className="text-xs text-muted-foreground mt-1">
													<div>Try:</div>
													<ul className="list-disc list-inside ml-2">
														{error.suggestions.map((suggestion, i) => (
															<li key={i}>{suggestion}</li>
														))}
													</ul>
												</div>
											)}
										</div>
									</div>
								))}
							</div>
						</div>
					))}

					{/* General errors not tied to specific fields */}
					{result.errors.filter((e) => !e.field).length > 0 && (
						<div className="space-y-2">
							<div className="font-medium text-sm">General Issues</div>
							<div className="space-y-1">
								{result.errors
									.filter((e) => !e.field)
									.map((error, index) => (
										<ValidationFeedback key={index} error={error} inline showIcon />
									))}
							</div>
						</div>
					)}
				</CardContent>
			)}
		</Card>
	)
}

/**
 * Real-time validation indicator component
 */
export const ValidationIndicator: React.FC<{
	isValid?: boolean
	isValidating?: boolean
	hasErrors?: boolean
	hasWarnings?: boolean
	className?: string
}> = ({ isValid, isValidating = false, hasErrors = false, hasWarnings = false, className }) => {
	if (isValidating) {
		return (
			<div className={cn('flex items-center gap-1 text-xs text-muted-foreground', className)}>
				<div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
				Validating...
			</div>
		)
	}

	if (hasErrors) {
		return (
			<div className={cn('flex items-center gap-1 text-xs text-destructive', className)}>
				<XCircle className="h-3 w-3" />
				Has errors
			</div>
		)
	}

	if (hasWarnings) {
		return (
			<div className={cn('flex items-center gap-1 text-xs text-yellow-600', className)}>
				<AlertTriangle className="h-3 w-3" />
				Has warnings
			</div>
		)
	}

	if (isValid) {
		return (
			<div className={cn('flex items-center gap-1 text-xs text-green-600', className)}>
				<CheckCircle className="h-3 w-3" />
				Valid
			</div>
		)
	}

	return null
}

/**
 * Hook for managing form validation state
 */
export const useValidation = <T extends Record<string, any>>(
	initialData: T,
	validationRules?: Record<keyof T, (value: any) => ValidationError[]>
) => {
	const [data, setData] = React.useState<T>(initialData)
	const [errors, setErrors] = React.useState<Record<keyof T, ValidationError[]>>({} as any)
	const [touched, setTouched] = React.useState<Record<keyof T, boolean>>({} as any)
	const [isValidating, setIsValidating] = React.useState(false)

	const validateField = React.useCallback(
		(field: keyof T, value: any) => {
			if (!validationRules?.[field]) return []
			return validationRules[field](value)
		},
		[validationRules]
	)

	const validateAll = React.useCallback(() => {
		if (!validationRules) return { isValid: true, errors: {}, warnings: {} }

		const newErrors: Record<keyof T, ValidationError[]> = {} as any
		let hasErrors = false

		Object.keys(validationRules).forEach((field) => {
			const fieldErrors = validateField(field as keyof T, data[field as keyof T])
			if (fieldErrors.length > 0) {
				newErrors[field as keyof T] = fieldErrors
				hasErrors = true
			}
		})

		setErrors(newErrors)
		return { isValid: !hasErrors, errors: newErrors }
	}, [data, validationRules, validateField])

	const updateField = React.useCallback(
		(field: keyof T, value: any) => {
			setData((prev) => ({ ...prev, [field]: value }))
			setTouched((prev) => ({ ...prev, [field]: true }))

			// Validate field if rules exist
			if (validationRules?.[field]) {
				const fieldErrors = validateField(field, value)
				setErrors((prev) => ({ ...prev, [field]: fieldErrors }))
			}
		},
		[validateField, validationRules]
	)

	const touchField = React.useCallback((field: keyof T) => {
		setTouched((prev) => ({ ...prev, [field]: true }))
	}, [])

	const reset = React.useCallback(() => {
		setData(initialData)
		setErrors({} as any)
		setTouched({} as any)
		setIsValidating(false)
	}, [initialData])

	const getValidationResult = React.useCallback((): ValidationResult => {
		const allErrors: ValidationError[] = []
		const allWarnings: ValidationError[] = []
		const fieldErrors: Record<string, ValidationError[]> = {}

		Object.entries(errors).forEach(([field, fieldErrorList]) => {
			if (fieldErrorList.length > 0) {
				fieldErrors[field] = fieldErrorList
				fieldErrorList.forEach((error) => {
					if (error.severity === 'warning') {
						allWarnings.push(error)
					} else {
						allErrors.push(error)
					}
				})
			}
		})

		return {
			isValid: allErrors.length === 0,
			errors: allErrors,
			warnings: allWarnings,
			fieldErrors,
		}
	}, [errors])

	return {
		data,
		errors,
		touched,
		isValidating,
		updateField,
		touchField,
		validateField,
		validateAll,
		reset,
		getValidationResult,
		setIsValidating,
	}
}

export type {
	ValidationError,
	ValidationResult,
	ValidationFeedbackProps,
	ValidationSummaryProps,
	FieldValidationProps,
}
