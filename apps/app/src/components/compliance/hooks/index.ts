// Compliance-specific hooks
export { useReportsFilters, useDebouncedFilters, useFilterPresets } from './use-reports-filters'
export {
	useKeyboardNavigation,
	useFocusManagement,
	COMPLIANCE_SHORTCUTS,
	type KeyboardShortcut,
	type UseKeyboardNavigationOptions,
} from './use-keyboard-navigation'
export {
	useResponsive,
	useResponsiveTable,
	useResponsiveGrid,
	useTouchFriendly,
	type Breakpoint,
	type BreakpointConfig,
} from './use-responsive'

// To be implemented in subsequent tasks:
// - useScheduledReports (./use-scheduled-reports.ts)
// - useReportExecution (./use-report-execution.ts)
// - useReportForm (./use-report-form.ts)
