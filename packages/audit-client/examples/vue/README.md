# Vue 3 Integration Example

This example demonstrates how to integrate the `@smedrec/audit-client` library with Vue 3 applications using the Composition API, TypeScript, and Pinia for state management.

## Features Demonstrated

- ✅ Vue 3 Composition API integration
- ✅ Pinia store for audit state management
- ✅ TypeScript support with proper typing
- ✅ Composables for reusable audit logic
- ✅ Error handling with global error boundary
- ✅ Loading states and reactive data
- ✅ Real-time audit event streaming
- ✅ Form validation with VeeValidate
- ✅ Testing with Vue Test Utils

## Setup

```bash
npm install
npm run dev
```

## Key Files

- `src/stores/audit.ts` - Pinia store for audit state
- `src/composables/useAudit.ts` - Composables for audit operations
- `src/components/AuditEventForm.vue` - Form component
- `src/components/AuditEventsList.vue` - List component with real-time updates
- `src/plugins/audit.ts` - Audit client plugin setup
- `src/__tests__/` - Test suite

## Usage Patterns

### Basic Setup

```vue
<template>
  <div id="app">
    <AuditEventForm @success="handleSuccess" />
    <AuditEventsList />
  </div>
</template>

<script setup lang="ts">
import { useAuditStore } from './stores/audit'

const auditStore = useAuditStore()
</script>
```

### Using Composables

```vue
<script setup lang="ts">
import { useAuditEvents, useCreateAuditEvent } from './composables/useAudit'

const { events, loading, error } = useAuditEvents()
const { createEvent, creating } = useCreateAuditEvent()
</script>
```

## Best Practices

1. **Pinia Store**: Centralize audit state management
2. **Composables**: Create reusable audit logic
3. **Error Handling**: Use global error handlers
4. **Reactivity**: Leverage Vue's reactivity system
5. **Testing**: Test composables and components separately
