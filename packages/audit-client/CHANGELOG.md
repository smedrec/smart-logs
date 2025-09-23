# Changelog

All notable changes to the @smedrec/audit-client library will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Preparation for v1.0.0 release
- Enhanced CI/CD pipeline with automated testing and publishing
- Comprehensive package validation and compatibility testing
- Release automation workflows

## [1.0.0] - 2025-01-XX (Pending Release)

### Added

#### Core Features

- **Enhanced Audit Client**: Comprehensive TypeScript SDK for Smart Logs Audit API
- **Type Safety**: Full TypeScript support with strict type checking and IntelliSense
- **Modular Architecture**: Core, services, infrastructure, and utilities layers
- **Dual Package Support**: CJS/ESM compatibility with proper exports

#### Authentication & Security

- **Multi-Auth Support**: API key, session token, bearer token, and custom authentication
- **Automatic Token Refresh**: Configurable token refresh mechanisms
- **Secure Headers**: Automatic security header management

#### Performance & Reliability

- **Retry Mechanisms**: Exponential backoff with configurable retry policies
- **Response Caching**: Multi-backend caching (memory, localStorage, sessionStorage, custom)
- **Request Batching**: Intelligent request batching and deduplication
- **Circuit Breaker**: Service resilience patterns

#### Services

- **Events Service**: Complete audit event management (create, query, verify, export)
- **Compliance Service**: HIPAA, GDPR, and custom compliance reporting
- **Scheduled Reports**: Automated report scheduling and execution
- **Audit Presets**: Template-based audit configuration management
- **Metrics Service**: System monitoring and performance metrics
- **Health Service**: Health checks and system status monitoring

#### Developer Experience

- **Comprehensive Logging**: Configurable logging with sensitive data masking
- **Error Handling**: Structured error responses with correlation IDs
- **Request/Response Interceptors**: Middleware support for custom functionality
- **Plugin Architecture**: Extensible plugin system for custom integrations

#### Build & Distribution

- **Advanced Build System**: tsup-based build with source maps and declarations
- **Package Optimization**: Tree-shaking support and minimal bundle size
- **Cross-Platform**: Node.js, browser, React Native, and Electron compatibility
- **CI/CD Pipeline**: Automated testing, validation, and publishing

### Technical Specifications

#### Supported Environments

- **Node.js**: >=18.0.0
- **TypeScript**: >=4.9.0
- **Browsers**: Modern browsers with ES2020 support
- **React Native**: Compatible with Metro bundler
- **Electron**: Main and renderer process support

#### Package Details

- **Bundle Formats**: CJS, ESM with proper exports
- **Type Definitions**: Complete TypeScript declarations
- **Source Maps**: Available for debugging
- **License**: MIT
- **Registry**: npm (public access)

### Breaking Changes

- This is the first stable release, establishing the public API
- Future versions will follow semantic versioning for breaking changes

### Migration Guide

- For users upgrading from pre-1.0 versions, see [MIGRATION.md](./docs/MIGRATION.md)
- New installations should follow the [Getting Started Guide](./README.md)

## [0.1.0] - 2024-XX-XX (Development)

### Added

- Initial development version
- Basic audit client functionality
- TypeScript support
- Basic build configuration

### Note

- This was a development version and should not be used in production
