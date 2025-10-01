/**
 * Utility functions and constants for screen reader accessibility
 */

/**
 * Generate descriptive text for complex UI elements
 */
export const generateAriaLabel = {
	/**
	 * Generate ARIA label for report status
	 */
	reportStatus: (status: string, reportName: string) => {
		const statusDescriptions = {
			success: 'completed successfully',
			failed: 'failed with errors',
			running: 'currently running',
			pending: 'pending execution',
			cancelled: 'was cancelled',
		}

		const description = statusDescriptions[status as keyof typeof statusDescriptions] || status
		return `Report ${reportName} ${description}`
	},

	/**
	 * Generate ARIA label for execution progress
	 */
	executionProgress: (percentage: number, reportName: string) => {
		return `Execution progress for ${reportName}: ${percentage}% complete`
	},

	/**
	 * Generate ARIA label for data table actions
	 */
	tableAction: (action: string, itemName: string, itemType: string = 'item') => {
		return `${action} ${itemType} ${itemName}`
	},

	/**
	 * Generate ARIA label for form validation errors
	 */
	validationError: (fieldName: string, errorMessage: string) => {
		return `${fieldName} has an error: ${errorMessage}`
	},

	/**
	 * Generate ARIA label for loading states
	 */
	loadingState: (context: string) => {
		return `Loading ${context}, please wait`
	},

	/**
	 * Generate ARIA label for pagination
	 */
	pagination: (currentPage: number, totalPages: number, totalItems?: number) => {
		const itemsText = totalItems ? ` of ${totalItems} items` : ''
		return `Page ${currentPage} of ${totalPages}${itemsText}`
	},
}

/**
 * Common ARIA descriptions for compliance interface elements
 */
export const ARIA_DESCRIPTIONS = {
	REPORT_TABLE:
		'Table containing scheduled compliance reports with their status, next execution time, and actions',
	EXECUTION_HISTORY: 'Timeline of report execution history showing status, duration, and results',
	DASHBOARD_STATS:
		'Key performance indicators for compliance reporting including success rates and execution counts',
	FORM_VALIDATION: 'Form validation messages and errors',
	SEARCH_RESULTS: 'Search results filtered by your query',
	BULK_ACTIONS: 'Actions that can be performed on multiple selected items',
	FILTER_CONTROLS: 'Controls for filtering and sorting the displayed data',
	PROGRESS_INDICATOR: 'Progress indicator showing completion status of current operation',
} as const

/**
 * Generate ARIA describedby IDs for form fields
 */
export function generateDescribedByIds(
	fieldName: string,
	options: {
		hasError?: boolean
		hasHelp?: boolean
		hasHint?: boolean
	} = {}
) {
	const ids = []

	if (options.hasError) {
		ids.push(`${fieldName}-error`)
	}

	if (options.hasHelp) {
		ids.push(`${fieldName}-help`)
	}

	if (options.hasHint) {
		ids.push(`${fieldName}-hint`)
	}

	return ids.length > 0 ? ids.join(' ') : undefined
}

/**
 * Create ARIA attributes for expandable content
 */
export function createExpandableAttributes(
	isExpanded: boolean,
	contentId: string,
	triggerId?: string
) {
	return {
		'aria-expanded': isExpanded,
		'aria-controls': contentId,
		...(triggerId && { id: triggerId }),
	}
}

/**
 * Create ARIA attributes for modal dialogs
 */
export function createModalAttributes(
	titleId: string,
	descriptionId?: string,
	isModal: boolean = true
) {
	return {
		role: isModal ? 'dialog' : 'alertdialog',
		'aria-modal': isModal,
		'aria-labelledby': titleId,
		...(descriptionId && { 'aria-describedby': descriptionId }),
	}
}

/**
 * Create ARIA attributes for data tables
 */
export function createTableAttributes(
	caption: string,
	sortColumn?: string,
	sortDirection?: 'asc' | 'desc'
) {
	return {
		role: 'table',
		'aria-label': caption,
		...(sortColumn && {
			'aria-sort': sortDirection || 'none',
		}),
	}
}

/**
 * Create ARIA attributes for tab panels
 */
export function createTabAttributes(
	tabId: string,
	panelId: string,
	isSelected: boolean,
	tabIndex: number = -1
) {
	return {
		tab: {
			id: tabId,
			role: 'tab',
			'aria-selected': isSelected,
			'aria-controls': panelId,
			tabIndex: isSelected ? 0 : tabIndex,
		},
		panel: {
			id: panelId,
			role: 'tabpanel',
			'aria-labelledby': tabId,
			tabIndex: 0,
		},
	}
}

/**
 * Format numbers for screen readers
 */
export function formatNumberForScreenReader(
	value: number,
	options: {
		type?: 'percentage' | 'currency' | 'decimal'
		precision?: number
		currency?: string
	} = {}
) {
	const { type = 'decimal', precision = 0, currency = 'USD' } = options

	switch (type) {
		case 'percentage':
			return `${value.toFixed(precision)} percent`
		case 'currency':
			return new Intl.NumberFormat('en-US', {
				style: 'currency',
				currency,
				minimumFractionDigits: precision,
			}).format(value)
		default:
			return value.toLocaleString('en-US', {
				minimumFractionDigits: precision,
				maximumFractionDigits: precision,
			})
	}
}

/**
 * Format dates for screen readers
 */
export function formatDateForScreenReader(
	date: Date | string,
	options: {
		includeTime?: boolean
		relative?: boolean
	} = {}
) {
	const { includeTime = false, relative = false } = options
	const dateObj = typeof date === 'string' ? new Date(date) : date

	if (relative) {
		const now = new Date()
		const diffMs = now.getTime() - dateObj.getTime()
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

		if (diffDays === 0) {
			return includeTime
				? `Today at ${dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
				: 'Today'
		} else if (diffDays === 1) {
			return includeTime
				? `Yesterday at ${dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
				: 'Yesterday'
		} else if (diffDays < 7) {
			return `${diffDays} days ago`
		}
	}

	const dateOptions: Intl.DateTimeFormatOptions = {
		year: 'numeric',
		month: 'long',
		day: 'numeric',
	}

	if (includeTime) {
		dateOptions.hour = 'numeric'
		dateOptions.minute = '2-digit'
	}

	return dateObj.toLocaleDateString('en-US', dateOptions)
}
