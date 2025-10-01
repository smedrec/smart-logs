import { useCallback, useState } from 'react'

import {
	getUserFriendlyMessage,
	globalErrorRecoveryManager,
	logError,
	transformError,
	withRetry,
} from '../lib/compliance-error-handler'

import type { RetryConfig, UIError } from '../lib/compliance-error-handler'

// Hook for handling errors in components
export function useErrorHandler() {
	const [error, setError] = useState<UIError | null>(null)
	const [isRetrying, setIsRetrying] = useState(false)

	const handleError = useCallback((error: unknown, context?: string) => {
		const uiError = transformError(error)
		setError(uiError)
		logError(uiError, context)
	}, [])

	const clearError = useCallback(() => {
		setError(null)
	}, [])

	const retryWithRecovery = useCallback(
		async (operation: () => Promise<void>, context?: string) => {
			if (!error) return

			setIsRetrying(true)

			try {
				// Attempt error recovery first
				const recovered = await globalErrorRecoveryManager.attemptRecovery(error)

				if (recovered) {
					// If recovery succeeded, try the operation again
					await operation()
					setError(null)
				} else {
					// If no recovery possible, just retry the operation
					await operation()
					setError(null)
				}
			} catch (retryError) {
				handleError(retryError, `Retry: ${context}`)
			} finally {
				setIsRetrying(false)
			}
		},
		[error, handleError]
	)

	return {
		error,
		isRetrying,
		handleError,
		clearError,
		retryWithRecovery,
		userFriendlyMessage: error ? getUserFriendlyMessage(error) : null,
	}
}

// Hook for API operations with automatic error handling and retry
export function useApiOperation<T extends any[], R>(
	operation: (...args: T) => Promise<R>,
	options: {
		context?: string
		retryConfig?: Partial<RetryConfig>
		onSuccess?: (result: R) => void
		onError?: (error: UIError) => void
	} = {}
) {
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<UIError | null>(null)
	const [data, setData] = useState<R | null>(null)

	const execute = useCallback(
		async (...args: T): Promise<R | null> => {
			setIsLoading(true)
			setError(null)

			try {
				const result = await withRetry(
					() => operation(...args),
					options.context,
					options.retryConfig
				)

				setData(result)
				options.onSuccess?.(result)
				return result
			} catch (err) {
				const uiError = transformError(err)
				setError(uiError)
				logError(uiError, options.context)
				options.onError?.(uiError)
				return null
			} finally {
				setIsLoading(false)
			}
		},
		[operation, options]
	)

	const retry = useCallback(() => {
		if (error && error.retryable) {
			// This would need the original arguments, which is a limitation
			// In practice, you'd store the last arguments or make this more specific
			console.warn('Retry called but original arguments not available')
		}
	}, [error])

	const clearError = useCallback(() => {
		setError(null)
	}, [])

	return {
		execute,
		retry,
		clearError,
		isLoading,
		error,
		data,
		userFriendlyMessage: error ? getUserFriendlyMessage(error) : null,
	}
}

// Hook specifically for compliance operations
export function useComplianceOperation<T extends any[], R>(
	operation: (...args: T) => Promise<R>,
	context: string
) {
	return useApiOperation(operation, {
		context: `Compliance: ${context}`,
		retryConfig: {
			maxAttempts: 2, // Fewer retries for user-initiated actions
			initialDelayMs: 500,
			maxDelayMs: 5000,
		},
	})
}

// Hook for handling form submission errors
export function useFormErrorHandler() {
	const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
	const [generalError, setGeneralError] = useState<string | null>(null)

	const handleFormError = useCallback((error: unknown, context?: string) => {
		const uiError = transformError(error)
		logError(uiError, context)

		if (uiError.field) {
			// Field-specific error
			setFieldErrors((prev) => ({
				...prev,
				[uiError.field!]: getUserFriendlyMessage(uiError),
			}))
		} else {
			// General form error
			setGeneralError(getUserFriendlyMessage(uiError))
		}
	}, [])

	const clearFieldError = useCallback((field: string) => {
		setFieldErrors((prev) => {
			const { [field]: _, ...rest } = prev
			return rest
		})
	}, [])

	const clearAllErrors = useCallback(() => {
		setFieldErrors({})
		setGeneralError(null)
	}, [])

	return {
		fieldErrors,
		generalError,
		handleFormError,
		clearFieldError,
		clearAllErrors,
		hasErrors: Object.keys(fieldErrors).length > 0 || generalError !== null,
	}
}
