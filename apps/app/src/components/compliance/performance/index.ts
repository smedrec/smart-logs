// Virtual Table
export { VirtualTable, useVirtualTable } from './virtual-table'
export type { VirtualTableColumn, VirtualTableProps } from './virtual-table'

// Memoized Components
export {
	MemoizedStatusBadge,
	MemoizedReportTypeBadge,
	MemoizedMetricCard,
	MemoizedProgressCard,
	MemoizedExecutionSummary,
	MemoizedReportSummary,
} from './memoized-components'

// Lazy Components
export {
	LazyTemplateForm,
	LazyTemplateVersionManager,
	LazyTemplateSharingManager,
	LazyExportManager,
	LazyReportConfigurationForm,
	LazyExecutionDetails,
	LazyExecutionTimeline,
	LazyManualExecutionDialog,
	LazyWrapper,
	LazyTemplateFormWrapper,
	LazyTemplateVersionManagerWrapper,
	LazyTemplateSharingManagerWrapper,
	LazyExportManagerWrapper,
	LazyReportConfigurationFormWrapper,
	LazyExecutionDetailsWrapper,
	LazyExecutionTimelineWrapper,
	LazyManualExecutionDialogWrapper,
	IntersectionLazy,
	PerformanceWrapper,
	usePreloadComponents,
} from './lazy-components'

// Performance Hooks
export {
	useDebounce,
	useThrottle,
	useExpensiveCalculation,
	useIntersectionObserver,
	useVirtualScrolling,
	useOptimizedSearch,
	useOptimizedPagination,
	useOptimizedSorting,
	useOptimizedDataTable,
	usePerformanceMonitor,
	useMemoryMonitor,
} from './performance-hooks'
