# Alerts GraphQL Resolver Compatibility

## Overview

This document describes the compatibility changes made to the alerts GraphQL resolver to work with the monitor service from the audit package.

## Changes Made

### 1. Type Imports

- Added imports for `Alert as MonitorAlert` and `AlertQueryFilters` from `@repo/audit`
- These provide the correct types from the monitor service

### 2. Type Mapping Functions

- `mapAlertType()`: Maps monitor alert types to GraphQL alert types
  - Maps `METRICS` → `SYSTEM` (since GraphQL doesn't have METRICS type)
  - Direct mapping for other types
- `mapGraphQLTypeToMonitor()`: Maps GraphQL alert types to monitor alert types

### 3. Query Resolver Changes

- Uses `AlertQueryFilters` interface for filtering
- Maps GraphQL filter parameters to monitor service filter format
- Calls `monitor.alert.getAlerts(queryFilters)` instead of expecting a result object
- Converts monitor alerts to GraphQL format using type mapping

### 4. Mutation Resolver Changes

- `acknowledgeAlert`:
  - Calls `monitor.alert.acknowledgeAlert(id, userId)`
  - Uses `monitor.alert.getAlertById(id, organizationId)` to get updated alert
- `resolveAlert`:
  - Calls `monitor.alert.resolveAlert(id, userId, resolutionData)`
  - Uses `AlertResolution` interface for resolution data
  - Gets updated alert using `getAlertById`

### 5. Field Mapping

- `createdAt` ← `timestamp`
- `resolution` field is handled separately (not in monitor service)
- All other fields map directly

## Monitor Service Interface Used

### Methods

- `getAlerts(filters: AlertQueryFilters): Promise<Alert[]>`
- `acknowledgeAlert(id: string, userId: string): Promise<{success: boolean}>`
- `resolveAlert(id: string, userId: string, resolution?: AlertResolution): Promise<{success: boolean}>`
- `getAlertById(id: string, organizationId: string): Promise<Alert | null>`

### Types

- `Alert` from monitoring-types.ts
- `AlertQueryFilters` from database-alert-handler.ts
- `AlertResolution` from database-alert-handler.ts

## Compatibility Notes

- The GraphQL `AlertType` enum is a subset of the monitor service `AlertType`
- `METRICS` type from monitor service is mapped to `SYSTEM` in GraphQL
- The `resolution` field is handled at the GraphQL layer since it's not part of the monitor service
- Pagination is simplified - total count is based on returned results length
