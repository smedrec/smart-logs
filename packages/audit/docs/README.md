# @repo/audit Package Documentation

A comprehensive audit logging system designed specifically for healthcare applications, ensuring compliance with HIPAA and GDPR regulations while providing cryptographically secure, tamper-resistant audit trails.

## 🏥 Healthcare-First Design

This audit system is purpose-built for healthcare environments, offering:

- **Regulatory Compliance**: Built-in HIPAA and GDPR validation and reporting
- **FHIR Integration**: Native support for FHIR resource audit events
- **PHI Protection**: Secure handling of Protected Health Information
- **Tamper Detection**: Cryptographic hashing and digital signatures
- **Guaranteed Delivery**: Reliable event processing with circuit breakers and retries

## 📚 Documentation Structure

### Getting Started

- [Getting Started Overview](./getting-started/) - Complete getting started guide
- [Installation Guide](./getting-started/installation.md) - Setup and installation instructions
- [Configuration](./getting-started/configuration.md) - Basic configuration options
- [First Audit Event](./getting-started/first-audit-event.md) - Quick start tutorial

### Tutorials

- [Tutorials Overview](./tutorials/) - Complete tutorials guide
- [Basic Implementation](./tutorials/basic-implementation.md) - Standard audit setup
- [Healthcare Compliance](./tutorials/healthcare-compliance.md) - HIPAA/GDPR configuration
- [FHIR Integration](./tutorials/fhir-integration.md) - FHIR resource audit events
- [Security Configuration](./tutorials/security-configuration.md) - Cryptographic setup
- [Monitoring & Observability](./tutorials/monitoring-setup.md) - Monitoring and observability configuration
- [Advanced Implementation](./tutorials/advanced-patterns.md) - Complex use cases

### API Reference

- [API Reference Overview](./api-reference/) - Complete API documentation
- [Core Audit Class](./api-reference/audit-class.md) - Main Audit class documentation
- [Event Types](./api-reference/event-types.md) - Event interfaces and structures
- [Configuration](./api-reference/configuration.md) - Configuration options
- [Cryptography](./api-reference/cryptography.md) - Security functions
- [Monitoring](./api-reference/monitoring.md) - Monitoring APIs
- [Compliance](./api-reference/compliance.md) - Compliance APIs
- [Utilities](./api-reference/utilities.md) - Utility functions

### Implementation Guides

- [Implementation Guides Overview](./guides/) - Complete implementation guides
- [Security Best Practices](./guides/security-best-practices.md) - Security guidelines
- [Performance Optimization](./guides/performance-optimization.md) - Performance tuning
- [Performance Optimization](./guides/performance-optimization.md) - Performance tuning
- [Error Handling](./guides/error-handling.md) - Error management
- [Testing Strategies](./guides/testing-strategies.md) - Testing approaches
- [Deployment Patterns](./guides/deployment-patterns.md) - Production deployment
- [Migration Guide](./guides/migration-guide.md) - Version migration

### Examples

- [Examples Overview](./examples/) - Complete examples guide
- [Healthcare Scenarios](./examples/healthcare-scenarios.md) - Medical use cases and implementations
- [FHIR Workflows](./examples/fhir-workflows.md) - FHIR implementations with healthcare-specific patterns
- [Authentication Flows](./examples/authentication-flows.md) - Auth audit patterns and security integration
- [Batch Processing](./examples/batch-processing.md) - High-volume scenarios and performance optimization
- [Integration Patterns](./examples/integration-patterns.md) - Healthcare system integrations and enterprise patterns

### Troubleshooting & Support

- [Troubleshooting Guide](./troubleshooting/) - Comprehensive troubleshooting and solutions

### FAQ

- [Frequently Asked Questions](./faq/) - Common questions and answers

### Future Development

- [Future Enhancements](./future-enhancements/) - Development roadmap and contribution guide
- TODO: [Roadmap](./future-enhancements/roadmap.md) - Development roadmap
- TODO: [Unimplemented Features](./future-enhancements/unimplemented-features.md) - Missing features
- TODO: [Contribution Guide](./future-enhancements/contribution-guide.md) - Contribution guidelines

## 🚀 Quick Start

```typescript
import { Audit, AuditConfig } from '@repo/audit'

// Healthcare-compliant configuration
const config: AuditConfig = {
	version: '1.0',
	environment: 'production',
	compliance: {
		hipaa: { enabled: true, retentionYears: 6 },
		gdpr: { enabled: true, retentionDays: 365 },
	},
	security: {
		crypto: { algorithm: 'SHA-256' },
		enableEncryption: true,
	},
}

const auditService = new Audit(config, db)

// Log FHIR patient access
await auditService.logFHIR({
	principalId: 'practitioner-123',
	action: 'fhir.patient.read',
	resourceType: 'Patient',
	resourceId: 'patient-456',
	status: 'success',
	sessionContext: {
		sessionId: 'sess-789',
		ipAddress: '10.0.1.100',
		userAgent: 'EMR-System/2.1',
	},
})
```

## 🔒 Security Features

- **Cryptographic Integrity**: SHA-256 hashing for tamper detection
- **Digital Signatures**: HMAC-SHA256 signatures for authenticity
- **Immutable Logs**: Cryptographically protected audit trails
- **PHI Handling**: Secure processing of Protected Health Information
- **Key Management**: Integration with Infisical KMS

## 📋 Compliance Features

- **HIPAA Validation**: Required field validation and 6-year retention
- **GDPR Support**: Data subject rights and legal basis tracking
- **Automated Reporting**: Compliance reports with integrity verification
- **Data Lifecycle**: Automated retention and archival policies
- **Audit Trails**: Complete event lifecycle tracking

## 🎯 Healthcare Use Cases

- **Patient Data Access**: FHIR resource access logging
- **Authentication Events**: Login/logout and access control
- **Treatment Documentation**: Medical record modifications
- **Prescription Management**: Medication order tracking
- **Administrative Actions**: User management and system changes
- **Security Incidents**: Breach detection and reporting

## 📊 Monitoring & Observability

- **Real-time Metrics**: Processing latency and queue depth
- **Health Checks**: Database, Redis, and queue monitoring
- **Alert Management**: Severity-based alert system
- **Performance Analytics**: Bottleneck detection and optimization
- **Compliance Dashboards**: Regulatory status monitoring

## 🏗️ Architecture

The audit system follows a modular architecture with:

- **Event Processing**: Reliable message queuing with BullMQ + Redis
- **Data Persistence**: PostgreSQL with Drizzle ORM
- **Security Layer**: Cryptographic services for integrity
- **Compliance Engine**: HIPAA/GDPR validation and reporting
- **Monitoring System**: Real-time observability and alerting

## 📞 Support

For questions, issues, or contributions:

1. Check the [FAQ](./faq/) for common questions
2. Review [Troubleshooting](./troubleshooting/) for known issues
3. Submit issues via the project repository
4. Follow the [Future Enhancements](./future-enhancements/) guide for contributions

## 📄 License

This package is licensed under the MIT License. See the main project LICENSE file for details.
