# Manual Execution and Real-time Monitoring Components

This directory contains the implementation of manual execution and real-time monitoring components for the compliance reports UI, as specified in task 6 of the implementation plan.

## Components Implemented

### 1. ManualExecutionDialog (`manual-execution-dialog.tsx`)

A comprehensive modal dialog for triggering manual report execution with the following features:

- **Report Information Display**: Shows report details including type, format, next scheduled execution, and last execution status
- **Execution Parameters Configuration**:
  - Priority selection (low, normal, high)
  - Timeout configuration (1 minute to 1 hour)
  - Retry attempts (0-5 retries)
  - Custom date range override
  - Additional filters in JSON format
  - Execution notes
- **Real-time Validation**: Connection status warnings and error handling
- **Progress Feedback**: Loading states and execution confirmation
- **Integration**: Uses audit client for actual report execution

**Requirements Addressed**: 6.1, 6.2, 6.3

### 2. ExecutionProgressTracker (`execution-progress-tracker.tsx`)

A real-time progress tracking component that monitors report execution with:

- **Status Visualization**: Color-coded status indicators with appropriate icons
- **Progress Monitoring**:
  - Real-time progress bar with percentage completion
  - Current step indication (Initializing, Collecting, Processing, etc.)
  - Estimated time remaining
  - Records processed counter
  - Throughput metrics (records/second)
- **Execution Control**: Cancel execution functionality with confirmation
- **Detailed Information**: Execution ID, trigger type, start time, duration
- **Error Handling**: Comprehensive error display with retry options
- **Success Actions**: Download buttons for completed reports
- **Auto-polling**: Automatic status updates every 2 seconds

**Requirements Addressed**: 6.2, 6.4

### 3. NotificationCenter (`notification-center.tsx`)

A comprehensive notification system for execution alerts and system notifications:

- **Notification Types**: Success, error, warning, and info notifications with appropriate styling
- **Real-time Notifications**: Immediate alerts for execution failures and completions
- **Notification Management**:
  - Mark individual notifications as read/unread
  - Mark all notifications as read
  - Delete individual notifications
  - Clear all notifications
  - Filter to show only unread notifications
- **Interactive Actions**: Configurable action buttons (Download, Retry, View Details, etc.)
- **Settings**: Sound alert toggle and notification preferences
- **Visual Indicators**: Unread count badge and notification bell icon
- **Responsive Design**: Scrollable notification list with proper spacing
- **Accessibility**: Proper ARIA labels and keyboard navigation

**Requirements Addressed**: 11.1, 11.2, 11.4

### 4. useNotifications Hook

A custom React hook for managing notifications across components:

- **Notification Creation**: Helper functions for different notification types
- **Type Safety**: Strongly typed notification interfaces
- **Integration Ready**: Designed for global state management integration

### 5. ManualExecutionDemo (`manual-execution-demo.tsx`)

A demonstration component showcasing all manual execution features:

- **Complete Workflow**: Shows the full manual execution process
- **Component Integration**: Demonstrates how all components work together
- **Mock Data**: Uses realistic mock data for testing and demonstration
- **Interactive UI**: Fully functional demo with all features enabled

## Key Features

### Type Safety

- Full TypeScript implementation with strict typing
- Integration with audit client types
- Comprehensive interface definitions

### Error Handling

- Connection status monitoring
- Comprehensive error display
- Retry mechanisms and recovery options
- User-friendly error messages

### Real-time Updates

- Automatic polling for execution status
- Live progress updates
- Real-time notification delivery
- Responsive UI updates

### Accessibility

- Proper ARIA labels and semantic markup
- Keyboard navigation support
- Screen reader compatibility
- High contrast support

### Responsive Design

- Mobile-friendly layouts
- Adaptive component sizing
- Touch-friendly interactions
- Flexible grid layouts

## Integration Points

### Audit Client Integration

- Uses `useAuditContext` for API communication
- Integrates with scheduled reports service
- Handles authentication and connection status

### UI Component Library

- Built with shadcn-ui components
- Consistent styling with Tailwind CSS
- Reusable component patterns

### State Management

- Local component state for UI interactions
- Integration ready for global state management
- Proper state synchronization

## Usage Example

```tsx
import {
	ExecutionProgressTracker,
	ManualExecutionDialog,
	NotificationCenter,
	useNotifications,
} from '@/components/compliance/manual'

function CompliancePage() {
	const [dialogOpen, setDialogOpen] = useState(false)
	const [executionId, setExecutionId] = useState<string | null>(null)
	const { addSuccessNotification } = useNotifications()

	const handleExecutionStart = (id: string) => {
		setExecutionId(id)
		addSuccessNotification('Execution Started', 'Report execution has begun')
	}

	return (
		<div>
			<NotificationCenter />

			<ManualExecutionDialog
				open={dialogOpen}
				onOpenChange={setDialogOpen}
				report={selectedReport}
				onExecutionStart={handleExecutionStart}
			/>

			{executionId && (
				<ExecutionProgressTracker
					executionId={executionId}
					onExecutionComplete={() => console.log('Done!')}
				/>
			)}
		</div>
	)
}
```

## Testing

All components include:

- TypeScript type checking
- Error boundary compatibility
- Mock data for testing
- Comprehensive prop validation

## Future Enhancements

- WebSocket integration for real-time updates
- Push notification support
- Advanced filtering and search
- Notification persistence
- Bulk execution operations
- Advanced progress visualization
