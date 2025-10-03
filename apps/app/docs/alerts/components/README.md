# Alert Components Documentation

This directory contains detailed documentation for all alert system components, organized by category.

## Component Categories

### Core Components

- **[AlertDashboard](./core/AlertDashboard.md)** - Main dashboard container
- **[AlertList](./core/AlertList.md)** - Alert listing component
- **[AlertCard](./core/AlertCard.md)** - Individual alert display
- **[AlertDetails](./core/AlertDetails.md)** - Detailed alert view

### Form Components

- **[AlertFilters](./forms/AlertFilters.md)** - Filtering controls
- **[AlertActions](./forms/AlertActions.md)** - Action buttons and dialogs
- **[BulkActions](./forms/BulkActions.md)** - Bulk operation controls
- **[AlertSettings](./forms/AlertSettings.md)** - Settings interface

### Notification Components

- **[NotificationBell](./notifications/NotificationBell.md)** - Header notification
- **[NotificationPanel](./notifications/NotificationPanel.md)** - Notification dropdown
- **[NotificationItem](./notifications/NotificationItem.md)** - Individual notification

### Data Components

- **[AlertDataTable](./data/AlertDataTable.md)** - Advanced data table
- **[AlertColumns](./data/AlertColumns.md)** - Table column definitions
- **[AlertPagination](./data/AlertPagination.md)** - Pagination controls
- **[AlertStatistics](./data/AlertStatistics.md)** - Statistics dashboard

### UI Components

- **[AlertBadge](./ui/AlertBadge.md)** - Status and severity badges
- **[AlertIcon](./ui/AlertIcon.md)** - Alert type icons
- **[AlertSkeleton](./ui/AlertSkeleton.md)** - Loading skeletons
- **[AlertEmptyState](./ui/AlertEmptyState.md)** - Empty state display

### Error Handling Components

- **[AlertErrorBoundary](./error/AlertErrorBoundary.md)** - Error boundary
- **[AlertErrorAlert](./error/AlertErrorAlert.md)** - Error alerts
- **[AlertLoadingStates](./error/AlertLoadingStates.md)** - Loading states

## Component Architecture Patterns

### Container/Presentation Pattern

Most components follow the container/presentation pattern:

```typescript
// Container Component (Smart)
export function AlertDashboard() {
  const { data: alerts, isLoading } = useAlertQueries()
  const [filters, setFilters] = useState<AlertFilters>({})

  return (
    <AlertDashboardPresentation
      alerts={alerts}
      filters={filters}
      onFiltersChange={setFilters}
      loading={isLoading}
    />
  )
}

// Presentation Component (Dumb)
interface AlertDashboardPresentationProps {
  alerts: Alert[]
  filters: AlertFilters
  onFiltersChange: (filters: AlertFilters) => void
  loading: boolean
}

export function AlertDashboardPresentation(props: AlertDashboardPresentationProps) {
  // Pure UI rendering logic
}
```

### Compound Component Pattern

Complex components use compound patterns for flexibility:

```typescript
export function AlertActions({ children }: { children: React.ReactNode }) {
  return <div className="alert-actions">{children}</div>
}

AlertActions.Acknowledge = AlertAcknowledgeButton
AlertActions.Resolve = AlertResolveButton
AlertActions.Dismiss = AlertDismissButton

// Usage
<AlertActions>
  <AlertActions.Acknowledge />
  <AlertActions.Resolve />
</AlertActions>
```

### Render Props Pattern

Some components use render props for maximum flexibility:

```typescript
interface AlertListProps {
  alerts: Alert[]
  renderAlert?: (alert: Alert) => React.ReactNode
  renderEmpty?: () => React.ReactNode
}

export function AlertList({ alerts, renderAlert, renderEmpty }: AlertListProps) {
  if (alerts.length === 0) {
    return renderEmpty ? renderEmpty() : <AlertEmptyState />
  }

  return (
    <div className="alert-list">
      {alerts.map(alert =>
        renderAlert ? renderAlert(alert) : <AlertCard key={alert.id} alert={alert} />
      )}
    </div>
  )
}
```

## Common Props Patterns

### Standard Component Props

Most components accept these standard props:

```typescript
interface BaseComponentProps {
	className?: string
	children?: React.ReactNode
	'data-testid'?: string
}

interface InteractiveComponentProps extends BaseComponentProps {
	disabled?: boolean
	loading?: boolean
	onClick?: () => void
}

interface FormComponentProps extends InteractiveComponentProps {
	error?: string
	required?: boolean
	'aria-label'?: string
	'aria-describedby'?: string
}
```

### Alert-Specific Props

Alert components typically accept:

```typescript
interface AlertComponentProps {
	alert: Alert
	onAlertSelect?: (alert: Alert) => void
	onAlertAction?: (alert: Alert, action: AlertAction) => void
	showActions?: boolean
	compact?: boolean
}
```

## Styling Conventions

### CSS Classes

Components use consistent CSS class naming:

```typescript
// Component-specific classes
.alert-dashboard { /* Dashboard container */ }
.alert-list { /* List container */ }
.alert-card { /* Individual card */ }

// State classes
.alert-card--loading { /* Loading state */ }
.alert-card--selected { /* Selected state */ }
.alert-card--disabled { /* Disabled state */ }

// Severity classes
.alert-badge--critical { /* Critical severity */ }
.alert-badge--high { /* High severity */ }
.alert-badge--medium { /* Medium severity */ }
.alert-badge--low { /* Low severity */ }
```

### Tailwind CSS Usage

Components use Tailwind CSS classes consistently:

```typescript
// Layout classes
const containerClasses = 'flex flex-col gap-4 p-6'
const gridClasses = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'

// Interactive classes
const buttonClasses = 'px-4 py-2 rounded-md font-medium transition-colors'
const inputClasses = 'w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2'

// State classes
const loadingClasses = 'animate-pulse bg-gray-200'
const errorClasses = 'border-red-500 text-red-600'
```

## Accessibility Guidelines

### ARIA Labels

All interactive components include proper ARIA labels:

```typescript
<button
  aria-label={`Acknowledge alert: ${alert.title}`}
  aria-describedby={`alert-${alert.id}-description`}
>
  Acknowledge
</button>
```

### Keyboard Navigation

Components support keyboard navigation:

```typescript
const handleKeyDown = (event: KeyboardEvent) => {
	switch (event.key) {
		case 'Enter':
		case ' ':
			event.preventDefault()
			onSelect()
			break
		case 'Escape':
			onCancel()
			break
	}
}
```

### Screen Reader Support

Components include screen reader announcements:

```typescript
<div
  role="status"
  aria-live="polite"
  aria-atomic="true"
  className="sr-only"
>
  {`${alerts.length} alerts loaded`}
</div>
```

## Testing Patterns

### Component Testing

Components are tested using React Testing Library:

```typescript
describe('AlertCard', () => {
  const mockAlert = createMockAlert()

  it('renders alert information correctly', () => {
    render(<AlertCard alert={mockAlert} />)

    expect(screen.getByText(mockAlert.title)).toBeInTheDocument()
    expect(screen.getByText(mockAlert.description)).toBeInTheDocument()
  })

  it('calls onSelect when clicked', () => {
    const onSelect = jest.fn()
    render(<AlertCard alert={mockAlert} onSelect={onSelect} />)

    fireEvent.click(screen.getByRole('button'))
    expect(onSelect).toHaveBeenCalledWith(mockAlert)
  })
})
```

### Accessibility Testing

Components include accessibility tests:

```typescript
import { axe, toHaveNoViolations } from 'jest-axe'

expect.extend(toHaveNoViolations)

it('has no accessibility violations', async () => {
  const { container } = render(<AlertCard alert={mockAlert} />)
  const results = await axe(container)
  expect(results).toHaveNoViolations()
})
```

## Performance Considerations

### Memoization

Components use React.memo for performance:

```typescript
export const AlertCard = React.memo<AlertCardProps>(({ alert, onSelect }) => {
  const handleClick = useCallback(() => {
    onSelect?.(alert)
  }, [alert, onSelect])

  return (
    <Card onClick={handleClick}>
      {/* Component content */}
    </Card>
  )
})
```

### Virtual Scrolling

Large lists use virtual scrolling:

```typescript
import { FixedSizeList as List } from 'react-window'

export function AlertList({ alerts }: AlertListProps) {
  const Row = ({ index, style }: { index: number; style: CSSProperties }) => (
    <div style={style}>
      <AlertCard alert={alerts[index]} />
    </div>
  )

  return (
    <List
      height={600}
      itemCount={alerts.length}
      itemSize={120}
    >
      {Row}
    </List>
  )
}
```

This documentation provides a comprehensive guide to understanding and working with the alert system components.
