---
title: Audit service
description: Audit service is the core audit logging functionality.
---

# Audit Package (`@repo/audit`)

The `@repo/audit` package provides the core audit logging functionality for the SMEDREC platform. It handles the generation, validation, and queuing of audit events with built-in security and compliance features.

## Purpose

The primary goals of this package are:

- **Security**: Cryptographic integrity verification with SHA-256 hashing and HMAC signatures
- **Compliance**: Built-in HIPAA and GDPR compliance validation and data handling
- **Reliability**: Guaranteed delivery with circuit breaker patterns and dead letter queues
- **Performance**: Efficient queuing with BullMQ and Redis for high-throughput scenarios
- **Healthcare Focus**: Specialized support for FHIR resources and PHI data handling

For a higher-level interface with additional features, consider using the [Audit Client Library (`@smedrec/audit-client`)](/audit-client/overview/) which provides a comprehensive SDK for interacting with the Smart Logs system.

## Installation

To use this package in another app or package within the monorepo, add it as a dependency:

```bash
# Navigate to the directory of your app/package
# cd apps/my-app or cd packages/my-package

pnpm add '@repo/audit@workspace:*'
```

This command ensures that you are using the version of `@repo/audit` managed within the current workspace.

## Core Concepts

- **Audit Event (`AuditLogEvent`)**: A data structure representing a single auditable action. It typically includes information about who performed the action (actor), what action was performed (action), what entity was affected (target), the outcome, and any relevant contextual details.
- **Audit Service Client**: The main component provided by this package. It's responsible for connecting to the message queue (e.g., Redis) and sending `AuditLogEvent`s.

## Usage

The specific API for sending an audit event will be defined within the package's source code (`packages/audit/src/index.ts` or similar). Generally, the process involves:

1.  **Initialization**: Setting up the audit service client, usually by providing connection details for the message queue (e.g., Redis URL) and the queue name. This might be handled globally or per instance.
2.  **Event Creation**: Constructing an `AuditLogEvent` object with all the necessary information.
3.  **Sending the Event**: Calling a method on the audit service client to dispatch the event to the queue.

### Example (Conceptual)

The exact implementation details (like function names and parameters) can be found by inspecting the package's source code. However, a conceptual example might look like this:

```typescript
// Presuming an AuditClient is exported from '@repo/audit'
// and has been initialized (e.g., during application startup)
import { auditClient, AuditLogEvent } from '@repo/audit' // Actual exports may vary

async function recordUserLogin(userId: string, ipAddress: string, success: boolean) {
	const event: AuditLogEvent = {
		actor: { type: 'USER', id: userId },
		action: 'USER_LOGIN',
		target: { type: 'SYSTEM', id: 'AuthenticationService' },
		outcome: success ? 'SUCCESS' : 'FAILURE',
		timestamp: new Date(),
		details: {
			ipAddress,
			userAgent: 'some-user-agent', // Example detail
		},
	}

	try {
		await auditClient.sendEvent(event)
		console.log('Audit event sent successfully.')
	} catch (error) {
		console.error('Failed to send audit event:', error)
		// Implement appropriate error handling (e.g., retry, log to a fallback)
	}
}

// Example usage
recordUserLogin('user-123', '192.168.1.100', true)
```

**Note**: The above is a _conceptual_ example. Refer to the actual exports and API documentation within the `@repo/audit` package for precise usage instructions. The `packages/audit/README.md` or source files like `packages/audit/src/index.ts` and `packages/audit/src/context.ts` would be the authoritative sources.

## Configuration

The `@repo/audit` package typically requires configuration for:

- **Redis URL**: The connection string for the Redis instance used by BullMQ.
- **Audit Queue Name**: The name of the queue to which events will be sent (this must match the queue name the `audit-worker` is listening to).

This configuration is often provided via environment variables or a configuration object when initializing the audit client.

## Best Practices

- Audit significant events that are relevant for security, compliance, or operational insight.
- Avoid logging overly verbose or sensitive data directly in audit logs unless necessary and properly secured. Use the `details` field judiciously.
- Ensure that the actor, action, and target are clearly identifiable.
- Handle potential errors during event submission gracefully (e.g., network issues when sending to Redis).
