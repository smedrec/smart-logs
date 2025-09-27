# React Integration Example

This example demonstrates how to integrate the `@smedrec/audit-client` library with React applications using modern patterns including hooks, context providers, and TypeScript.

## Features Demonstrated

- ✅ React Context Provider for audit client
- ✅ Custom hooks for audit operations
- ✅ TypeScript integration
- ✅ Error boundary handling
- ✅ Loading states and error handling
- ✅ Real-time audit event streaming
- ✅ Form validation with audit logging
- ✅ Performance optimization with React.memo
- ✅ Testing with React Testing Library

## Setup

```bash
npm install
npm start
```

## Key Files

- `src/providers/AuditProvider.tsx` - Context provider setup
- `src/hooks/useAudit.ts` - Custom hooks for audit operations
- `src/components/AuditEventForm.tsx` - Form component with audit logging
- `src/components/AuditEventsList.tsx` - List component with real-time updates
- `src/utils/auditConfig.ts` - Audit client configuration
- `src/__tests__/` - Comprehensive test suite

## Usage Patterns

### Basic Setup

```tsx
import { App } from './App'
import { AuditProvider } from './providers/AuditProvider'

function Root() {
	return (
		<AuditProvider>
			<App />
		</AuditProvider>
	)
}
```

### Using Hooks

```tsx
import { useAuditEvents, useCreateAuditEvent } from './hooks/useAudit'

function MyComponent() {
	const { events, loading, error } = useAuditEvents()
	const { createEvent, creating } = useCreateAuditEvent()

	// Component logic here
}
```

## Best Practices

1. **Context Provider**: Use a single context provider at the app root
2. **Error Boundaries**: Wrap audit operations in error boundaries
3. **Loading States**: Always handle loading and error states
4. **Memoization**: Use React.memo for performance optimization
5. **Testing**: Test both success and error scenarios
