# @repo/audit

The `@repo/audit` package provides a comprehensive audit logging solution designed specifically for healthcare applications. It ensures compliance with HIPAA and GDPR regulations while offering cryptographically secure, tamper-resistant audit trails.

## Features

- 🔒 **Security First**: Cryptographic hashing and signatures for tamper detection
- 🏥 **Healthcare Ready**: FHIR-specific audit events and PHI handling
- 📋 **Compliance Built-in**: HIPAA and GDPR compliance validation
- 🚀 **High Performance**: Batching, rate limiting, and guaranteed delivery

## Documentation

For detailed documentation, please refer to the [Audit Logging Documentation](./docs/README.md).

## How to Contribute

Contributions are welcome! Please follow these general guidelines:

1.  **Bug Reports**: Submit an issue detailing the bug, including steps to reproduce.
2.  **Feature Requests**: Submit an issue describing the proposed feature and its use case.
3.  **Pull Requests**:
    - Fork the repository and create a new branch for your feature or fix.
    - Ensure your code adheres to the project's linting and formatting standards.
    - Write unit tests for any new functionality or bug fixes.
    - Ensure all tests pass (`pnpm test` within the package, or `pnpm turbo test` from root).
    - Update documentation (like this README) if your changes affect usage or features.
    - Submit a pull request with a clear description of your changes.

Refer to the main project's contribution guidelines if available at the root of the monorepo.

## License

This package is licensed under the **MIT License**. See the [LICENSE](../../LICENSE) file in the root of the repository for more details.
