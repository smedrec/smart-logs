# @repo/audit-db Documentation

Welcome to the comprehensive documentation for the `@repo/audit-db` package - a powerful, feature-rich audit database client with advanced performance optimization, Redis-based distributed caching, compliance management, and cryptographic integrity verification.

## 📚 Documentation Sections

### [Getting Started](./getting-started/index.md)
Essential information to get up and running quickly with the audit database package.

- [Installation Guide](./getting-started/installation.md) - Package installation and dependencies
- [Quick Start Tutorial](./getting-started/quick-start.md) - Basic usage examples
- [Configuration Guide](./getting-started/configuration.md) - Environment and client configuration

### [Tutorials](./tutorials/)
Step-by-step guides for implementing specific features and use cases.

- [Basic Usage](./tutorials/basic-usage.md) - Core database operations
- [Performance Optimization](./tutorials/performance-optimization.md) - Leveraging advanced performance features
- [Redis Caching](./tutorials/redis-caching.md) - Implementing distributed caching strategies
- [Partitioning Setup](./tutorials/partitioning-setup.md) - Database partitioning for large datasets
- [Compliance Configuration](./tutorials/compliance-configuration.md) - GDPR/HIPAA compliance setup
- [Migration Management](./tutorials/migration-management.md) - Database schema migration workflows

### [API Reference](./api-reference/)
Detailed technical documentation for all classes, methods, and interfaces.

- [Core Classes](./api-reference/core-classes.md) - AuditDb, AuditDbWithConfig, EnhancedAuditDb
- [Enhanced Client](./api-reference/enhanced-client.md) - EnhancedAuditDatabaseClient features
- [Caching System](./api-reference/caching-system.md) - Query cache and Redis cache APIs
- [Performance Monitoring](./api-reference/performance-monitoring.md) - Monitoring and optimization APIs
- [Partitioning API](./api-reference/partitioning-api.md) - Partition management interfaces
- [Schema Types](./api-reference/schema-types.md) - Database schema and type definitions

### [Practical Guides](./guides/)
Best practices, troubleshooting, and advanced configuration guidance.

- [Troubleshooting](./guides/troubleshooting.md) - Common issues and solutions
- [Best Practices](./guides/best-practices.md) - Performance and security recommendations
- [Environment Setup](./guides/environment-setup.md) - Development and production configurations
- [Monitoring & Alerts](./guides/monitoring-alerts.md) - Health monitoring and alerting setup
- [Security & Compliance](./guides/security-compliance.md) - Security best practices and compliance

### [Code Examples](./examples/)
Practical code examples for common use cases and integration patterns.

- [Basic Operations](./examples/basic-operations.md) - CRUD operations and queries
- [Advanced Queries](./examples/advanced-queries.md) - Complex queries and joins
- [Performance Tuning](./examples/performance-tuning.md) - Optimization examples
- [Cache Strategies](./examples/cache-strategies.md) - Caching implementation patterns
- [Compliance Reporting](./examples/compliance-reporting.md) - GDPR/HIPAA reporting examples
- [Integration Patterns](./examples/integration-patterns.md) - Multi-service integration

### [CLI Reference](./cli-reference/)
Command-line tools documentation for database management and optimization.

- [audit-db CLI](./cli-reference/audit-db-cli.md) - Core database management commands
- [Performance CLI](./cli-reference/performance-cli.md) - Performance optimization tools
- [Migration Commands](./cli-reference/migration-commands.md) - Schema migration utilities

### Additional Resources

- [FAQ](./faq.md) - Frequently asked questions
- [Future Enhancements](./future-enhancements.md) - Planned features and roadmap

## 🚀 Quick Navigation

### New Users
1. Start with [Installation](./getting-started/installation.md)
2. Follow the [Quick Start](./getting-started/quick-start.md) tutorial
3. Review [Basic Usage](./tutorials/basic-usage.md) examples

### Performance Optimization
1. [Performance Optimization Tutorial](./tutorials/performance-optimization.md)
2. [Redis Caching Guide](./tutorials/redis-caching.md)
3. [Partitioning Setup](./tutorials/partitioning-setup.md)

### Compliance & Security
1. [Compliance Configuration](./tutorials/compliance-configuration.md)
2. [Security & Compliance Guide](./guides/security-compliance.md)
3. [Compliance Reporting Examples](./examples/compliance-reporting.md)

### Advanced Features
1. [Enhanced Client API](./api-reference/enhanced-client.md)
2. [Performance Monitoring](./api-reference/performance-monitoring.md)
3. [Integration Patterns](./examples/integration-patterns.md)

## 🔧 Package Features

### Core Database Functionality
- **Multiple Client Types**: Basic, configured, and enhanced database clients
- **Drizzle ORM Integration**: Type-safe database operations with PostgreSQL
- **Transaction Support**: Comprehensive transaction management
- **Schema Management**: Automated migrations and schema validation

### Performance Optimization
- **Enhanced Connection Pooling**: Advanced connection management with monitoring
- **Query Performance Monitoring**: Slow query detection and optimization recommendations
- **Database Partitioning**: Time-based range partitioning for large audit datasets
- **Index Optimization**: Automated index analysis and optimization

### Distributed Caching
- **Redis-Based Caching**: Distributed query caching across multiple instances
- **L1/L2 Cache Strategy**: Local memory + Redis hybrid caching
- **Cache Invalidation**: Intelligent TTL-based and manual cache invalidation
- **Performance Analytics**: Cache hit rates and performance metrics

### Compliance & Security
- **GDPR/HIPAA Compliance**: Built-in compliance features and reporting
- **Cryptographic Integrity**: SHA-256 hashing and HMAC verification
- **Data Retention**: Automated data archival and retention policies
- **Audit Trails**: Comprehensive audit logging and integrity verification

### Monitoring & Observability
- **Health Monitoring**: Real-time database and cache health status
- **Performance Metrics**: Comprehensive performance tracking and analysis
- **Alerting**: Configurable alerts for performance and compliance issues
- **CLI Tools**: Command-line utilities for monitoring and optimization

## 📋 System Requirements

- Node.js 18+ (compatible with the monorepo setup)
- PostgreSQL 12+ (for database storage)
- Redis 6+ (for distributed caching)
- pnpm 10+ (package manager)

## 🤝 Contributing

This package is part of the smart-logs monorepo. For contribution guidelines, please refer to the main [CONTRIBUTING.md](../../../CONTRIBUTING.md) file.

## 📄 License

This project is part of the smart-logs audit system and follows the same licensing terms.