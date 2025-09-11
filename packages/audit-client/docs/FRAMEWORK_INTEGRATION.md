# Framework Integration

This guide provides examples of how to integrate the `@smedrec/audit-client` with popular web frameworks.

---

## Express.js

Integrating the audit client into an Express.js application is straightforward. You can initialize it once and make it available to your routes and middleware.

### 1. Centralized Client Initialization

Create a dedicated file to initialize and export the client. This ensures a single instance is used throughout your application.

**`src/audit-client.ts`**

```typescript
import { AuditClient } from '@smedrec/audit-client'

export const auditClient = new AuditClient({
	baseUrl: process.env.AUDIT_API_URL || 'https://api.smartlogs.com',
	authentication: {
		type: 'apiKey',
		apiKey: process.env.AUDIT_API_KEY,
	},
	logging: {
		level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
	},
})

// Gracefully shut down the client on app exit
process.on('SIGINT', async () => {
	await auditClient.destroy()
	process.exit(0)
})
```

### 2. Auditing in Middleware

Create middleware to automatically log all incoming requests.

**`src/middleware/audit-logger.ts`**

```typescript
import { auditClient } from '../audit-client'

export function auditRequest(req, res, next) {
	const { method, path, ip, user } = req

	// Fire-and-forget the audit event
	auditClient.events
		.create({
			action: 'api.request',
			principalId: user ? user.id : 'anonymous',
			organizationId: user ? user.organizationId : 'unknown',
			status: 'attempt',
			sessionContext: {
				ipAddress: ip,
				userAgent: req.get('User-Agent'),
			},
			details: {
				method,
				path,
				params: req.params,
				query: req.query,
			},
		})
		.catch((error) => {
			console.error('Failed to log audit request:', error)
		})

	next()
}
```

### 3. Auditing in Route Handlers

For more specific events, call the client directly within your route handlers.

**`src/routes/users.ts`**

```typescript
import { auditClient } from '../audit-client'

router.post('/users', async (req, res) => {
	// ... user creation logic ...
	const newUser = await createUser(req.body)

	await auditClient.events.create({
		action: 'user.create',
		principalId: req.user.id,
		organizationId: req.user.organizationId,
		status: 'success',
		targetResourceId: newUser.id,
		targetResourceType: 'User',
	})

	res.status(201).json(newUser)
})
```

---

## Next.js

In Next.js, you can initialize the client in a shared module to be used across API Routes, Server Components, and Route Handlers.

### 1. Singleton Client Instance

Create a singleton instance of the client to avoid creating new connections on every request, which is crucial in a serverless environment.

**`lib/audit-client.ts`**

```typescript
import { AuditClient } from '@smedrec/audit-client'

// Use a global variable to preserve the client across hot reloads in development
declare global {
	var auditClient: AuditClient | undefined
}

const client =
	globalThis.auditClient ||
	new AuditClient({
		baseUrl: process.env.AUDIT_API_URL!,
		authentication: {
			type: 'apiKey',
			apiKey: process.env.AUDIT_API_KEY!,
		},
	})

if (process.env.NODE_ENV !== 'production') {
	globalThis.auditClient = client
}

export const auditClient = client
```

### 2. Auditing in API Routes

Use the client within your API routes to audit server-side actions.

**`pages/api/documents/create.ts`**

```typescript
import { auditClient } from '@/lib/audit-client'
import { getSession } from 'next-auth/react'

export default async function handler(req, res) {
	const session = await getSession({ req })

	if (!session) {
		return res.status(401).end()
	}

	// ... logic to create a document ...
	const newDocument = await createDocument(req.body)

	await auditClient.events.create(
		{
			action: 'document.create',
			principalId: session.user.id,
			organizationId: session.user.organizationId,
			status: 'success',
			targetResourceId: newDocument.id,
		},
		{ generateHash: true, generateSignature: true }
	)

	res.status(201).json(newDocument)
}
```

### 3. Auditing in Server Actions

With the App Router, you can use the client directly in Server Actions.

**`app/actions.ts`**

```typescript
'use server'

import { auditClient } from '@/lib/audit-client'
import { auth } from '@/lib/auth' // Your auth implementation

export async function deleteDocument(documentId: string) {
	const session = await auth()

	if (!session) {
		throw new Error('Unauthorized')
	}

	// ... logic to delete the document ...

	await auditClient.events.create(
		{
			action: 'document.delete',
			principalId: session.user.id,
			organizationId: session.user.organizationId,
			status: 'success',
			targetResourceId: documentId,
		},
		{ durabilityGuarantees: true }
	)
}
```
