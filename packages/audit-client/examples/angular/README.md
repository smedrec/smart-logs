# Angular Integration Example

This example demonstrates how to integrate the `@smedrec/audit-client` library with Angular applications using services, dependency injection, RxJS, and TypeScript.

## Features Demonstrated

- ✅ Angular service integration with dependency injection
- ✅ RxJS observables for reactive data handling
- ✅ TypeScript support with strict typing
- ✅ Error handling with global error interceptor
- ✅ Loading states and reactive forms
- ✅ Real-time audit event streaming with WebSockets
- ✅ Form validation with Angular Reactive Forms
- ✅ Testing with Jasmine and Karma

## Setup

```bash
npm install
ng serve
```

## Key Files

- `src/app/services/audit.service.ts` - Main audit service
- `src/app/services/audit-config.service.ts` - Configuration service
- `src/app/components/audit-event-form/` - Form component
- `src/app/components/audit-events-list/` - List component
- `src/app/interceptors/audit-error.interceptor.ts` - Error handling
- `src/app/guards/audit-connection.guard.ts` - Route guard for connection
- `src/app/pipes/audit-status.pipe.ts` - Custom pipes

## Usage Patterns

### Service Injection

```typescript
import { AuditService } from './services/audit.service'

@Component({...})
export class MyComponent {
  constructor(private auditService: AuditService) {}

  ngOnInit() {
    this.auditService.events$.subscribe(events => {
      // Handle events
    })
  }
}
```

### Reactive Forms

```typescript
import { FormBuilder, Validators } from '@angular/forms'

export class AuditEventFormComponent {
	auditForm = this.fb.group({
		action: ['', Validators.required],
		resourceType: ['', Validators.required],
		// ... other fields
	})
}
```

## Best Practices

1. **Services**: Use Angular services for audit operations
2. **RxJS**: Leverage observables for reactive data flow
3. **Error Handling**: Implement global error interceptors
4. **Guards**: Protect routes with connection guards
5. **Testing**: Use Angular testing utilities and mocks
