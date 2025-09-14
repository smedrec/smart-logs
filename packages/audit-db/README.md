# @repo/auditdb

The `@repo/audit-db` package provides a powerful, feature-rich audit database client with advanced performance optimization, Redis-based distributed caching, compliance management, and cryptographic integrity verification.

## Installation

To add `@repo/auditdb` as a dependency in another package (e.g., an application or another shared package):

```sh
# Navigate to the target package directory
cd apps/your-app # or packages/your-package

# Add @repo/auditdb using pnpm
pnpm add '@repo/audit-db@workspace:*'
```

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

## Usage

- Read the docs for detailed usage instructions and API references. [Documentation](./docs/README.md)

## 🤝 Contributing

This package is part of the smart-logs monorepo. For contribution guidelines, please refer to the main [CONTRIBUTING.md](../../../CONTRIBUTING.md) file.

## 📄 License

This project is part of the smart-logs audit system and follows the same licensing terms.
