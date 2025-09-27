# Node.js Integration Example

This example demonstrates how to integrate the `@smedrec/audit-client` library with Node.js applications using Express.js, Fastify, and other server frameworks.

## Features Demonstrated

- ✅ Express.js middleware integration
- ✅ Fastify plugin integration
- ✅ TypeScript support with strict typing
- ✅ Environment-based configuration
- ✅ Error handling and logging
- ✅ Request/response audit logging
- ✅ Background job audit logging
- ✅ Database operation auditing
- ✅ API endpoint protection
- ✅ Performance monitoring

## Setup

```bash
npm install
npm run dev
```

## Key Files

- `src/express/` - Express.js integration examples
- `src/fastify/` - Fastify integration examples
- `src/middleware/` - Audit middleware implementations
- `src/services/` - Service layer with audit integration
- `src/config/` - Configuration management
- `src/utils/` - Utility functions and helpers

## Usage Patterns

### Express.js Integration

```typescript
import express from 'express'

import { auditMiddleware } from './middleware/audit'

const app = express()
app.use(auditMiddleware)

app.get('/api/users', (req, res) => {
	// Automatically audited
})
```

### Service Layer Integration

```typescript
import { AuditService } from './services/audit'

class UserService {
	constructor(private auditService: AuditService) {}

	async createUser(userData: any) {
		const user = await this.userRepository.create(userData)

		await this.auditService.logEvent({
			action: 'user.create',
			targetResourceType: 'user',
			targetResourceId: user.id,
			// ... other fields
		})

		return user
	}
}
```

## Best Practices

1. **Middleware**: Use middleware for automatic request auditing
2. **Service Layer**: Integrate audit logging in service methods
3. **Error Handling**: Audit both success and failure scenarios
4. **Performance**: Use batching for high-throughput scenarios
5. **Configuration**: Use environment-specific configurations
