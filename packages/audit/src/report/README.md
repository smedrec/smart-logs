# Compliance Reporting Services

This directory contains comprehensive compliance reporting functionality for the audit system, providing both legacy and enhanced services that are compatible with the audit-client type definitions.

## Services

### EnhancedComplianceService

The `EnhancedComplianceService` is the new, fully-featured compliance service that implements all audit-client compatible interfaces. It provides:

- **HIPAA Compliance Reports**: Comprehensive audit trail reports with safeguard analysis
- **GDPR Compliance Reports**: Data processing activity reports with legal basis tracking
- **Custom Reports**: Flexible reporting with custom templates and aggregations
- **GDPR Data Export**: Data subject data export functionality
- **Pseudonymization**: Privacy protection through data pseudonymization

### ComplianceReportingService (Legacy)

The original compliance reporting service with basic functionality. Still available for backward compatibility.

## Key Features

### HIPAA Compliance

- Administrative, Physical, and Technical safeguard analysis
- PHI access tracking and violation detection
- Risk assessment and suspicious pattern detection
- Compliance scoring and recommendations

### GDPR Compliance

- Processing activity tracking
- Legal basis documentation
- Data subject rights management
- Cross-border transfer monitoring
- Breach detection and reporting

### Custom Reporting

- Template-based report generation
- Flexible filtering and aggregation
- Multiple export formats (JSON, CSV, XML, PDF)
- Scheduled report generation

### Data Export & Privacy

- GDPR Article 20 data portability compliance
- Secure data export with encryption
- Pseudonymization for privacy protection
- Configurable retention and delivery

## Usage Examples

### Basic HIPAA Report

```typescript
import { EnhancedComplianceService } from '@repo/audit/report'

import type { ReportCriteria } from '@repo/audit-client/types/compliance'

const service = new EnhancedComplianceService(dbClient, audit)

const criteria: ReportCriteria = {
	dateRange: {
		startDate: '2024-01-01T00:00:00Z',
		endDate: '2024-01-31T23:59:59Z',
	},
	organizationIds: ['org-123'],
	dataClassifications: ['PHI'],
	verifiedOnly: true,
}

const report = await service.generateHIPAAReport(criteria)
console.log(`Compliance Score: ${report.summary.complianceScore}%`)
```

### GDPR Data Export

```typescript
const exportParams = {
	dataSubjectId: 'user-456',
	dataSubjectType: 'user',
	includePersonalData: true,
	format: 'json',
	deliveryMethod: 'download',
	encryption: {
		enabled: true,
		algorithm: 'AES-256-GCM',
	},
}

const exportResult = await service.exportGDPRData(exportParams)
```

### Custom Report with Template

```typescript
const customParams = {
	criteria: {
		dateRange: { startDate: '2024-01-01', endDate: '2024-01-31' },
		actions: ['auth.login.success', 'auth.login.failure'],
	},
	template: {
		id: 'auth-template-123',
		name: 'Authentication Report',
		fields: [
			{ name: 'timestamp', type: 'date', required: true },
			{ name: 'principalId', type: 'string', required: true },
			{ name: 'status', type: 'string', required: true },
		],
		aggregations: [{ field: 'status', operation: 'count', groupBy: 'principalId' }],
	},
}

const report = await service.generateCustomReport(customParams)
```

## Type Compatibility

The `EnhancedComplianceService` is fully compatible with the audit-client type definitions:

- Uses Zod schemas for validation
- Implements all audit-client interfaces
- Provides type-safe report generation
- Supports all compliance frameworks

## Configuration

The service requires:

1. **Database Client**: `EnhancedAuditDatabaseClient` instance
2. **Audit Service**: `Audit` instance with integrity verification enabled
3. **Environment Variables**: Database connection and encryption keys

## Error Handling

All methods include comprehensive error handling:

- Database connection errors
- Validation errors for invalid criteria
- Processing errors with detailed messages
- Timeout handling for large reports

## Performance Considerations

- Uses database query optimization
- Implements result caching where appropriate
- Supports pagination for large datasets
- Provides progress tracking for long-running operations

## Security Features

- Cryptographic integrity verification
- Secure data export with encryption
- Access control validation
- Audit trail for all report generation

## Compliance Standards

The service supports multiple compliance frameworks:

- **HIPAA**: Healthcare data protection
- **GDPR**: European data protection regulation
- **SOX**: Sarbanes-Oxley financial compliance
- **PCI DSS**: Payment card industry standards
- **ISO 27001**: Information security management
- **Custom**: Organization-specific requirements

## Integration

The service integrates with:

- Audit logging system
- Database monitoring
- File storage services
- Email delivery systems
- Encryption key management
- Scheduled job systems

For complete examples, see `examples/compliance-example.ts`.
