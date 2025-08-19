# GraphQL and Audit Package Compatibility Fixes

## Overview

Fixed compatibility issues between the GraphQL implementation in `apps/server/src/lib/graphql` and the audit package in `packages/audit`, ensuring type consistency and proper data mapping.

## Key Changes Made

### 1. Type System Alignment

#### Updated GraphQL Types (`apps/server/src/lib/graphql/types.ts`)

- **Imported audit package types**: Added imports for `AuditLogEvent`, `AuditEventStatus`, `DataClassification`, and `SessionContext` from `@repo/audit`
- **Enhanced AuditEvent interface**:
  - Changed status type from hardcoded union to `AuditEventStatus`
  - Changed dataClassification type to `DataClassification`
  - Added additional fields from audit package: `ttl`, `eventVersion`, `hashAlgorithm`, `signature`, `processingLatency`, `queueDepth`
- **Updated SessionContext**: Made it extend the audit package's `SessionContext` interface
- **Fixed filter and input types**: Updated `AuditEventFilter`, `CreateAuditEventInput`, and preset configuration types to use audit package enums

#### Updated GraphQL Schema (`apps/server/src/lib/graphql/schema.ts`)

- **Fixed enum values**: Changed `AuditEventStatus` enum values from uppercase (`ATTEMPT`, `SUCCESS`, `FAILURE`) to lowercase (`attempt`, `success`, `failure`) to match audit package
- **Added new fields**: Extended `AuditEvent` type with additional fields from audit package: `ttl`, `eventVersion`, `hashAlgorithm`, `signature`, `processingLatency`, `queueDepth`

### 2. Resolver Implementation Fixes

#### Audit Events Resolver (`apps/server/src/lib/graphql/resolvers/audit-events.ts`)

- **Added type imports**: Imported `AuditEventStatus` and `DataClassification` from audit package
- **Enhanced data conversion**: Updated `convertDbEventToGraphQL` function to:
  - Use proper type casting for status and dataClassification
  - Map additional fields from audit package
  - Handle database details field structure correctly
- **Fixed sessionContext access**: Changed from `dbEvent.sessionContext` to `dbEvent.details?.sessionContext` to match database schema
- **Improved event creation**: Updated audit event creation to use `AuditLogEvent` interface with proper field mapping
- **Fixed status filtering**: Removed unnecessary lowercase conversion since enum values are now lowercase

#### API Routes Fix (`apps/server/src/routes/audit-api.ts`)

- **Fixed sessionContext access**: Changed from `event.sessionContext` to `event.details?.sessionContext` to match database schema structure

### 3. Database Schema Compatibility

The fixes account for the database schema structure where:

- Core audit fields are stored as direct columns
- Additional properties (like `sessionContext`) are stored in the `details` JSONB field
- Status values are stored as lowercase strings matching the audit package enum values

## Benefits

1. **Type Safety**: Full type compatibility between GraphQL and audit package types
2. **Data Integrity**: Proper mapping of all audit event fields including new ones from the audit package
3. **Consistency**: Unified enum values and field structures across the system
4. **Extensibility**: Support for additional audit package features like processing latency and queue depth
5. **Build Success**: Resolved all TypeScript compilation errors related to GraphQL/audit compatibility

## Testing

- ✅ Build passes successfully with `pnpm build`
- ✅ TypeScript compilation succeeds for GraphQL modules
- ✅ All audit event fields properly mapped between database, GraphQL, and audit package

## Files Modified

1. `apps/server/src/lib/graphql/types.ts` - Type definitions alignment
2. `apps/server/src/lib/graphql/schema.ts` - Schema enum and field updates
3. `apps/server/src/lib/graphql/resolvers/audit-events.ts` - Resolver implementation fixes
4. `apps/server/src/routes/audit-api.ts` - API route data access fix

The GraphQL implementation is now fully compatible with the audit package types and database schema.
