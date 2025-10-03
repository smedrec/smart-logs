# AlertDashboard Component

## Overview

The `AlertDashboard` is the main container component for the alert management system. It provides a comprehensive interface for viewing, filtering, and managing alerts with multiple view modes and responsive design.

## Location

```
src/components/alerts/core/AlertDashboard.tsx
```

## Props Interface

```typescript
export interface AlertDashboardProps {
	/** Initial filters to apply to the dashboard */
	initialFilters?: AlertFilters
	/** Initial view mode for the dashboard */
	view?: 'list' | 'board' | 'statistics'
	/** Callback when view changes */
	onViewChange?: (view: 'list' | 'board' | 'statistics') => void
	/** Additional CSS classes */
	className?: string
	/** Children components to render in the dashboard */
	children?: React.ReactNode
}
```

## Features

### View Modes

The dashboard supports three distinct view modes:

1. **List View** - Traditional table-style alert listing
2. **Board View** - Kanban-style board organized by alert status
3. **Statistics View** - Charts and metrics dashboard

### Responsive Design

- **Mobile-first approach** with adaptive layouts
- **Touch-friendly interactions** for mobile devices
- **Flexible grid system** that adjusts to screen size
- **Collapsible navigation** on smaller screens

### Accessibility

- **Keyboard navigation** with custom shortcuts
- **Screen reader support** with proper ARIA labels
- **Skip links** for efficient navigation
- **Focus management** for modal interactions

### Real-time Updates

- **Live data integration** using TanStack Query
- **WebSocket support** for real-time alert updates
- **Optimistic updates** for immediate UI feedback
- **Connection status indicators**

## Usage Examples

### Basic Usage

```typescript
import { AlertDashboard } from '@/components/alerts/core/AlertDashboard'

export function AlertsPage() {
  return (
    <AlertDashboard
      view="list"
      onViewChange={(view) => console.log('View changed to:', view)}
    />
  )
}
```

### With Initial Filters

```typescript
import { AlertDashboard } from '@/components/alerts/core/AlertDashboard'
import type { AlertFilters } from '@/components/alerts/types/filter-types'

export function CriticalAlertsPage() {
  const criticalFilters: AlertFilters = {
    severity: ['critical', 'high'],
    status: ['active'],
  }

  return (
    <AlertDashboard
      initialFilters={criticalFilters}
      view="board"
    />
  )
}
```

### Custom Layout

```typescript
import { AlertDashboard } from '@/components/alerts/core/AlertDashboard'

export function CustomAlertDashboard() {
  return (
    <AlertDashboard className="min-h-screen bg-gray-50">
      {/* Custom content can be added here */}
      <div className="mt-6 p-4 bg-white rounded-lg shadow">
        <h3>Custom Alert Metrics</h3>
        {/* Custom metrics components */}
      </div>
    </AlertDashboard>
  )
}
```

## Keyboard Shortcuts

The dashboard includes comprehensive keyboard shortcuts:

| Shortcut | Action                       |
| -------- | ---------------------------- |
| `Ctrl+R` | Refresh alerts               |
| `Ctrl+F` | Focus search/filters         |
| `1`      | Switch to list view          |
| `2`      | Switch to board view         |
| `3`      | Switch to statistics view    |
| `?`      | Show keyboard shortcuts help |
| `Escape` | Close modals/dialogs         |

## State Management

### Local State

```typescript
const [currentView, setCurrentView] = useState<'list' | 'board' | 'statistics'>(view)
const [isRefreshing, setIsRefreshing] = useState(false)
const [showShortcuts, setShowShortcuts] = useState(false)
```

### External State

- **Audit Context** - Authentication and API client
- **Live Queries** - Real-time alert data
- **Statistics** - Alert metrics and summaries

## Responsive Behavior

### Layout Breakpoints

```typescript
// Mobile (< 768px)
- Single column layout
- Stacked header elements
- Compact action buttons
- Touch-optimized targets

// Tablet (768px - 1024px)
- Two column grid
- Wrapped header layout
- Medium-sized buttons
- Hybrid touch/mouse interactions

// Desktop (> 1024px)
- Multi-column grid
- Inline header layout
- Full-sized buttons
- Mouse-optimized interactions
```

### Touch Interactions

```typescript
const { getTouchTargetSize, getAlertButtonTouchClasses } = useAlertTouchFriendly()

// Touch target sizing
getTouchTargetSize('md') // Returns appropriate size classes
getAlertButtonTouchClasses() // Returns touch-optimized button classes
```

## Integration Points

### Audit Context Integration

```typescript
const { client, isConnected } = useAuditContext()
const activeOrganizationId = authStateCollection.get('auth')?.session.activeOrganizationId
```

### Data Integration

```typescript
const { data: statistics } = useAlertStatistics(activeOrganizationId)
const { data: alerts, isLoading } = useLiveQuery((q) =>
	q.from({ alert: alertsCollection }).orderBy(({ alert }) => alert.created_at, 'desc')
)
```

## Component Architecture

### Container Pattern

The AlertDashboard follows the container/presentation pattern:

```typescript
// Container logic (current implementation)
export function AlertDashboard(props: AlertDashboardProps) {
  // State management
  // Event handlers
  // Data fetching

  return <AlertDashboardPresentation {...presentationProps} />
}

// Presentation component (future refactor)
function AlertDashboardPresentation(props: PresentationProps) {
  // Pure UI rendering
}
```

### Composition

The dashboard composes multiple child components:

- **AlertResponsiveContainer** - Layout wrapper
- **AlertSkipLinks** - Accessibility navigation
- **AlertKeyboardShortcutsDialog** - Help dialog
- **AlertStatistics** - Statistics display
- **AlertList** - Alert listing (when implemented)

## Styling

### CSS Classes

```css
/* Main container */
.alert-dashboard {
	@apply flex flex-col;
}

/* Header layouts */
.alert-dashboard-header--stacked {
	@apply flex-col space-y-4;
}

.alert-dashboard-header--wrapped {
	@apply flex-wrap gap-4;
}

.alert-dashboard-header--inline {
	@apply flex-row;
}

/* Action button layouts */
.alert-actions--dropdown {
	@apply justify-end;
}

.alert-actions--compact {
	@apply space-x-1;
}

.alert-actions--full {
	@apply space-x-2;
}
```

### Tailwind Classes

```typescript
// Responsive spacing
const spacing = cn(
	'space-y-4', // Mobile
	'md:space-y-6', // Tablet
	'lg:space-y-8' // Desktop
)

// Button sizing
const buttonSize = isMobile ? 'sm' : 'sm'
const touchTargetSize = getTouchTargetSize('md')
```

## Testing

### Unit Tests

```typescript
describe('AlertDashboard', () => {
  it('renders with default props', () => {
    render(<AlertDashboard />)
    expect(screen.getByText('Alert Management')).toBeInTheDocument()
  })

  it('switches views correctly', () => {
    const onViewChange = jest.fn()
    render(<AlertDashboard onViewChange={onViewChange} />)

    fireEvent.click(screen.getByText('Board'))
    expect(onViewChange).toHaveBeenCalledWith('board')
  })

  it('handles keyboard shortcuts', () => {
    render(<AlertDashboard />)

    fireEvent.keyDown(document, { key: '1', ctrlKey: false })
    expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('List')
  })
})
```

### Accessibility Tests

```typescript
it('has no accessibility violations', async () => {
  const { container } = render(<AlertDashboard />)
  const results = await axe(container)
  expect(results).toHaveNoViolations()
})

it('supports keyboard navigation', () => {
  render(<AlertDashboard />)

  const firstTab = screen.getByRole('tab', { name: /list view/i })
  firstTab.focus()

  fireEvent.keyDown(firstTab, { key: 'ArrowRight' })
  expect(screen.getByRole('tab', { name: /board view/i })).toHaveFocus()
})
```

## Performance Considerations

### Memoization

```typescript
const AlertDashboard = React.memo<AlertDashboardProps>((props) => {
	// Component implementation
})

// Memoized event handlers
const handleViewChange = useCallback(
	(newView: ViewType) => {
		setCurrentView(newView)
		onViewChange?.(newView)
	},
	[onViewChange]
)
```

### Code Splitting

```typescript
// Lazy load heavy components
const AlertStatistics = lazy(() => import('../data/AlertStatistics'))
const AlertSettings = lazy(() => import('../forms/AlertSettings'))

// Usage with Suspense
<Suspense fallback={<AlertSkeleton />}>
  <AlertStatistics />
</Suspense>
```

## Error Handling

### Error Boundaries

The dashboard is wrapped in an error boundary:

```typescript
<AlertErrorBoundary>
  <AlertDashboard />
</AlertErrorBoundary>
```

### Error States

```typescript
if (error) {
  return (
    <AlertErrorAlert
      error={error}
      onRetry={refetch}
      title="Failed to load dashboard"
    />
  )
}
```

## Future Enhancements

### Planned Features

1. **Custom Dashboard Layouts** - User-configurable dashboard layouts
2. **Widget System** - Pluggable dashboard widgets
3. **Advanced Filtering** - Saved filters and filter presets
4. **Export Functionality** - Export alerts and statistics
5. **Notification Preferences** - Customizable notification settings

### Performance Optimizations

1. **Virtual Scrolling** - For large alert lists
2. **Progressive Loading** - Load data as needed
3. **Background Sync** - Sync data in background
4. **Caching Strategies** - Intelligent data caching

This comprehensive documentation provides developers with everything needed to understand, use, and extend the AlertDashboard component.
