# Compliance Reports Developer Guide

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Component Structure](#component-structure)
3. [API Integration](#api-integration)
4. [State Management](#state-management)
5. [Adding New Features](#adding-new-features)
6. [Testing Guidelines](#testing-guidelines)
7. [Performance Optimization](#performance-optimization)
8. [Troubleshooting](#troubleshooting)

## Architecture Overview

The compliance reports UI follows a component-driven architecture using React 18, TypeScript, and shadcn-ui components.

### Technology Stack

- **React 18**: UI framework with hooks and concurrent features
- **TypeScript**: Type-safe development
- **TanStack Router**: File-based routing with type safety
- **TanStack Query**: Data fetching and caching
- **shadcn-ui**: Accessible component library
- **Tailwind CSS**: Utility-first styling
- **Vitest**: Unit and integration testing
- **Playwright**: End-to-end testing

### Directory Structure

```
apps/app/src/
├── components/
│   └── compliance/
│       ├── dashboard/          # Dashboard components
│       ├── forms/              # Form components
│       ├── reports/            # Report management
│       ├── execution/          # Execution history
│       ├── manual/             # Manual execution
│       ├── delivery/           # Delivery destinations
│       ├── templates/          # Report templates
│       ├── navigation/         # Navigation components
│       ├── error/              # Error handling
│       └── __tests__/          # Test files
├── contexts/
│   ├── compliance-audit-provider.tsx  # Main provider
│   └── ComplianceUrlStateProvider.tsx # URL state management
├── hooks/
│   ├── use-data-sync.ts        # Data synchronization
│   └── useComplianceUrlState.ts # URL state hooks
├── lib/
│   ├── performance-monitor.ts   # Performance tracking
│   └── compliance-error-handler.ts # Error handling
└── routes/
    └── _authenticated/
        └── compliance/          # Compliance routes
```

## Component Structure

### Provider Hierarchy

```typescript
<ThemeProvider>
  <AuthProvider>
    <AuditProvider>
      <ComplianceAuditProvider>
        {/* Compliance routes */}
      </ComplianceAuditProvider>
    </AuditProvider>
  </AuthProvider>
</ThemeProvider>
```

### ComplianceAuditProvider

The main provider for compliance features:

```typescript
import { useComplianceAudit } from '@/contexts/compliance-audit-provider'

function MyComponent() {
	const {
		// Connection status
		connectionStatus,

		// Service methods
		createScheduledReport,
		updateScheduledReport,
		deleteScheduledReport,
		listScheduledReports,
		executeScheduledReport,
		getExecutionHistory,

		// Error handling
		lastError,
		clearError,
	} = useComplianceAudit()

	// Use the methods...
}
```

### Component Patterns

#### Dashboard Components

```typescript
// Example: DashboardStats component
import { useComplianceAudit } from '@/contexts/compliance-audit-provider'
import { useQuery } from '@tanstack/react-query'

export function DashboardStats() {
  const { listScheduledReports } = useComplianceAudit()

  const { data, isLoading, error } = useQuery({
    queryKey: ['scheduled-reports', 'stats'],
    queryFn: () => listScheduledReports({ limit: 100 }),
  })

  if (isLoading) return <Skeleton />
  if (error) return <ErrorAlert error={error} />

  return (
    <Card>
      {/* Render stats */}
    </Card>
  )
}
```

#### Form Components

```typescript
// Example: ReportConfigurationForm
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const reportSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  reportType: z.enum(['HIPAA', 'GDPR', 'CUSTOM']),
  // ... other fields
})

export function ReportConfigurationForm({ mode, onSubmit }) {
  const form = useForm({
    resolver: zodResolver(reportSchema),
    defaultValues: mode === 'create' ? {} : initialData,
  })

  return (
    <Form {...form}>
      {/* Form fields */}
    </Form>
  )
}
```

## API Integration

### Using the Audit Client

The compliance UI integrates with the audit system through the `@smedrec/audit-client` package.

#### Creating a Scheduled Report

```typescript
import { useComplianceAudit } from '@/contexts/compliance-audit-provider'

function CreateReportButton() {
  const { createScheduledReport } = useComplianceAudit()

  const handleCreate = async () => {
    try {
      const report = await createScheduledReport({
        name: 'My Report',
        reportType: 'HIPAA',
        organizationId: 'org-123',
        enabled: true,
        schedule: {
          frequency: 'daily',
          time: '09:00',
          timezone: 'UTC',
        },
        criteria: {},
        destinations: [],
      })

      console.log('Report created:', report)
    } catch (error) {
      console.error('Failed to create report:', error)
    }
  }

  return <Button onClick={handleCreate}>Create Report</Button>
}
```

#### Listing Scheduled Reports

```typescript
import { useQuery } from '@tanstack/react-query'

function ReportsList() {
  const { listScheduledReports } = useComplianceAudit()

  const { data, isLoading } = useQuery({
    queryKey: ['scheduled-reports'],
    queryFn: () => listScheduledReports({
      page: 1,
      limit: 20,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    }),
  })

  return (
    <div>
      {data?.data.map(report => (
        <ReportCard key={report.id} report={report} />
      ))}
    </div>
  )
}
```

### Performance Monitoring

API calls are automatically tracked for performance:

```typescript
import { performanceMonitor } from '@/lib/performance-monitor'

// Performance is automatically tracked in ComplianceAuditProvider
// You can also manually track custom operations:

const startTime = performance.now()
try {
	const result = await someOperation()
	performanceMonitor.measureApiCall('/custom-endpoint', 'POST', startTime, 200)
} catch (error) {
	performanceMonitor.measureApiCall('/custom-endpoint', 'POST', startTime, undefined, error.message)
}
```

## State Management

### URL State Management

Use URL state for filters, pagination, and other shareable state:

```typescript
import { useScheduledReportsUrlState } from '@/hooks/useComplianceUrlState'

function ReportsPage() {
  const { state, setParam, resetFilters } = useScheduledReportsUrlState()

  // Access state
  const { page, limit, search, filters } = state

  // Update state
  const handleSearch = (value: string) => {
    setParam('search', value)
  }

  const handlePageChange = (newPage: number) => {
    setParam('page', newPage)
  }

  return (
    <div>
      <SearchInput value={search} onChange={handleSearch} />
      {/* ... */}
    </div>
  )
}
```

### Local Component State

Use React hooks for local component state:

```typescript
function MyComponent() {
	const [isOpen, setIsOpen] = useState(false)
	const [selectedItems, setSelectedItems] = useState<string[]>([])

	// Use state...
}
```

### Server State with TanStack Query

Use TanStack Query for server state management:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

function ReportManager() {
  const queryClient = useQueryClient()
  const { createScheduledReport } = useComplianceAudit()

  // Query
  const { data } = useQuery({
    queryKey: ['reports'],
    queryFn: listScheduledReports,
  })

  // Mutation
  const createMutation = useMutation({
    mutationFn: createScheduledReport,
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['reports'] })
    },
  })

  return (
    <Button onClick={() => createMutation.mutate(reportData)}>
      Create Report
    </Button>
  )
}
```

## Adding New Features

### Adding a New Component

1. Create the component file:

```typescript
// apps/app/src/components/compliance/my-feature/my-component.tsx
import React from 'react'

interface MyComponentProps {
  // Props
}

export function MyComponent({ }: MyComponentProps) {
  return (
    <div>
      {/* Component content */}
    </div>
  )
}
```

2. Create tests:

```typescript
// apps/app/src/components/compliance/my-feature/__tests__/my-component.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MyComponent } from '../my-component'

describe('MyComponent', () => {
  it('should render', () => {
    render(<MyComponent />)
    expect(screen.getByText('...')).toBeInTheDocument()
  })
})
```

3. Export from index:

```typescript
// apps/app/src/components/compliance/my-feature/index.ts
export { MyComponent } from './my-component'
```

### Adding a New Route

1. Create route file:

```typescript
// apps/app/src/routes/_authenticated/compliance/my-feature.tsx
import { createFileRoute } from '@tanstack/react-router'
import { lazy } from 'react'

const MyFeature = lazy(() => import('@/components/compliance/my-feature'))

export const Route = createFileRoute('/_authenticated/compliance/my-feature')({
	component: MyFeature,
})
```

2. Add navigation link:

```typescript
// Update sidebar navigation
{
  title: 'My Feature',
  url: '/compliance/my-feature',
  icon: MyIcon,
}
```

### Adding a New API Method

1. Add method to ComplianceAuditProvider:

```typescript
// apps/app/src/contexts/compliance-audit-provider.tsx

const myNewMethod = useCallback(
	async (params: MyParams): Promise<MyResult> => {
		if (!client) {
			throw new Error('Client not available')
		}

		const startTime = performance.now()
		try {
			const result = await client.myService.myMethod(params)
			performanceMonitor.measureApiCall('/my-endpoint', 'POST', startTime, 200)
			setLastError(null)
			return result
		} catch (error) {
			const errorMessage = error instanceof AuditClientError ? error.message : 'Operation failed'
			performanceMonitor.measureApiCall('/my-endpoint', 'POST', startTime, undefined, errorMessage)
			setLastError(errorMessage)
			throw error
		}
	},
	[client]
)

// Add to context value
const contextValue = {
	// ... existing methods
	myNewMethod,
}
```

2. Use in components:

```typescript
function MyComponent() {
	const { myNewMethod } = useComplianceAudit()

	const handleAction = async () => {
		const result = await myNewMethod({
			/* params */
		})
		// Handle result
	}
}
```

## Testing Guidelines

### Unit Tests

Write unit tests for individual components:

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

describe('MyComponent', () => {
  it('should handle user interaction', async () => {
    const user = userEvent.setup()
    const onAction = vi.fn()

    render(<MyComponent onAction={onAction} />)

    await user.click(screen.getByRole('button'))

    expect(onAction).toHaveBeenCalled()
  })
})
```

### Integration Tests

Test component interactions:

```typescript
describe('Report Creation Flow', () => {
  it('should complete full flow', async () => {
    const user = userEvent.setup()

    render(<ReportConfigurationForm mode="create" onSubmit={vi.fn()} />)

    // Fill form
    await user.type(screen.getByLabelText('Name'), 'Test Report')
    await user.click(screen.getByText('HIPAA'))

    // Submit
    await user.click(screen.getByText('Create Report'))

    // Verify
    await waitFor(() => {
      expect(screen.getByText('Success')).toBeInTheDocument()
    })
  })
})
```

### E2E Tests

Test complete user journeys:

```typescript
import { expect, test } from '@playwright/test'

test('should create and execute report', async ({ page }) => {
	await page.goto('/compliance')

	// Create report
	await page.click('text=Create Report')
	await page.fill('input[name="name"]', 'E2E Test Report')
	await page.click('button:has-text("Create Report")')

	// Execute report
	await page.click('text=Execute Now')
	await page.click('button:has-text("Confirm")')

	// Verify execution
	await expect(page.locator('text=Running')).toBeVisible()
})
```

## Performance Optimization

### Code Splitting

Routes are automatically code-split using lazy loading:

```typescript
import { lazy } from 'react'

const MyComponent = lazy(() => import('./my-component'))
```

### Memoization

Use React.memo for expensive components:

```typescript
export const MyComponent = React.memo(function MyComponent({ data }) {
  // Expensive rendering
  return <div>{/* ... */}</div>
})
```

Use useMemo for expensive computations:

```typescript
const sortedData = useMemo(() => {
	return data.sort((a, b) => a.name.localeCompare(b.name))
}, [data])
```

### Virtual Scrolling

For large lists, use virtual scrolling:

```typescript
import { useVirtualizer } from '@tanstack/react-virtual'

function LargeList({ items }) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50,
  })

  return (
    <div ref={parentRef} style={{ height: '400px', overflow: 'auto' }}>
      <div style={{ height: `${virtualizer.getTotalSize()}px` }}>
        {virtualizer.getVirtualItems().map(virtualItem => (
          <div key={virtualItem.key} style={{ height: `${virtualItem.size}px` }}>
            {items[virtualItem.index]}
          </div>
        ))}
      </div>
    </div>
  )
}
```

## Troubleshooting

### Common Issues

#### Provider Not Found Error

**Error**: `useComplianceAudit must be used within a ComplianceAuditProvider`

**Solution**: Ensure the component is rendered within the compliance routes that are wrapped by the provider.

#### Type Errors

**Error**: Type mismatch with audit client types

**Solution**: Ensure `@smedrec/audit-client` is up to date and types are properly imported.

#### Performance Issues

**Problem**: Slow rendering or API calls

**Solutions**:

1. Check performance monitor logs
2. Use React DevTools Profiler
3. Implement memoization
4. Add virtual scrolling for large lists
5. Optimize API queries

### Debugging

Enable debug logging:

```typescript
// In development
if (process.env.NODE_ENV === 'development') {
	console.log('Debug info:', data)
}
```

Use React DevTools:

- Install React DevTools browser extension
- Inspect component props and state
- Profile component rendering

Use Performance Monitor:

```typescript
import { performanceMonitor } from '@/lib/performance-monitor'

// Get performance summary
const summary = performanceMonitor.getSummary()
console.log('Performance Summary:', summary)
```

## Best Practices

### Component Design

1. **Keep components focused**: Each component should have a single responsibility
2. **Use TypeScript**: Always type props and state
3. **Handle loading and error states**: Provide good UX for all states
4. **Make components accessible**: Follow WCAG 2.1 AA guidelines
5. **Write tests**: Aim for 70%+ coverage

### Code Organization

1. **Group related files**: Keep components, tests, and styles together
2. **Use barrel exports**: Export from index files for cleaner imports
3. **Follow naming conventions**: Use PascalCase for components, camelCase for functions
4. **Document complex logic**: Add JSDoc comments for complex functions
5. **Keep files small**: Split large files into smaller, focused modules

### Performance

1. **Lazy load routes**: Use React.lazy for route components
2. **Memoize expensive operations**: Use useMemo and useCallback
3. **Optimize re-renders**: Use React.memo for pure components
4. **Monitor performance**: Use the performance monitor
5. **Profile regularly**: Use React DevTools Profiler

## Resources

- [React Documentation](https://react.dev/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [TanStack Router](https://tanstack.com/router)
- [TanStack Query](https://tanstack.com/query)
- [shadcn-ui](https://ui.shadcn.com/)
- [Vitest](https://vitest.dev/)
- [Playwright](https://playwright.dev/)

## Contributing

When contributing to the compliance features:

1. Follow the existing code style
2. Write tests for new features
3. Update documentation
4. Ensure accessibility compliance
5. Run linting and type checking
6. Test on multiple browsers

## Support

For questions or issues:

- Check this documentation
- Review existing code examples
- Ask in the team chat
- Create an issue in the repository
