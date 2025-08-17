# Server Configuration System

This directory contains the enhanced server configuration system with comprehensive validation, environment-specific overrides, and multiple configuration sources.

## Features

- **Environment-specific configuration**: Support for development, staging, production, and test environments
- **Multiple configuration sources**: JSON files, environment variables, and defaults with proper precedence
- **Comprehensive validation**: Type-safe configuration validation with detailed error messages
- **Security**: Automatic sanitization of sensitive values in logs and debug output
- **CLI tools**: Command-line utilities for configuration management and validation
- **Hot reloading**: Configuration can be reloaded without restarting the server (development only)

## Configuration Sources (Priority Order)

1. **Environment Variables** (highest priority)
2. **Environment-specific config files** (e.g., `config/production.json`)
3. **Base config file** (`config/base.json`)
4. **Default values** (lowest priority)

## Configuration Files

### Base Configuration

- `config/base.json` - Base configuration shared across all environments
- `config/development.json` - Development environment overrides
- `config/production.json` - Production environment overrides
- `config/staging.json` - Staging environment overrides
- `config/test.json` - Test environment overrides

### Environment Variables

All configuration values can be overridden using environment variables:

#### Server Configuration

- `NODE_ENV` - Environment (development|staging|production|test)
- `PORT` - Server port (default: 3000)
- `HOST` - Server host (default: 0.0.0.0)

#### Database Configuration

- `DATABASE_URL` - PostgreSQL connection string
- `DB_POOL_SIZE` - Connection pool size (default: 10)
- `DB_CONNECTION_TIMEOUT` - Connection timeout in ms (default: 30000)
- `DB_IDLE_TIMEOUT` - Idle timeout in ms (default: 600000)
- `DB_SSL` - Enable SSL for database (default: false)

#### Redis Configuration

- `REDIS_URL` - Redis connection string
- `REDIS_MAX_RETRIES` - Max retries per request (default: 3)
- `REDIS_RETRY_DELAY` - Retry delay on failover (default: 100)

#### Authentication Configuration

- `BETTER_AUTH_SECRET` - Session secret (min 32 characters)
- `BETTER_AUTH_URL` - Better Auth URL
- `BETTER_AUTH_REDIS_URL` - Redis URL for Better Auth
- `SESSION_MAX_AGE` - Session max age in seconds (default: 86400)

#### Security Configuration

- `ENCRYPTION_KEY` - Encryption key (min 32 characters)
- `API_KEY_HEADER` - API key header name (default: x-api-key)
- `ENABLE_API_KEY_AUTH` - Enable API key authentication (default: false)

#### CORS Configuration

- `CORS_ORIGIN` - CORS origin (comma-separated for multiple)
- `CORS_CREDENTIALS` - Enable CORS credentials (default: true)

#### Rate Limiting Configuration

- `RATE_LIMIT_WINDOW_MS` - Rate limit window in ms (default: 60000)
- `RATE_LIMIT_MAX_REQUESTS` - Max requests per window (default: 100)

#### Monitoring Configuration

- `LOG_LEVEL` - Log level (debug|info|warn|error)
- `ENABLE_METRICS` - Enable metrics collection (default: true)
- `METRICS_PATH` - Metrics endpoint path (default: /metrics)
- `HEALTH_CHECK_PATH` - Health check endpoint path (default: /health)

#### Performance Configuration

- `ENABLE_COMPRESSION` - Enable response compression (default: true)
- `COMPRESSION_LEVEL` - Compression level 1-9 (default: 6)
- `ENABLE_CACHING` - Enable caching (default: true)
- `CACHE_MAX_AGE` - Cache max age in seconds (default: 300)

#### API Configuration

- `ENABLE_TRPC` - Enable TRPC API (default: true)
- `ENABLE_REST` - Enable REST API (default: true)
- `ENABLE_GRAPHQL` - Enable GraphQL API (default: true)
- `ENABLE_OPENAPI` - Enable OpenAPI documentation (default: true)

#### External Services Configuration

- `SMTP_HOST` - SMTP server host
- `SMTP_PORT` - SMTP server port
- `SMTP_SECURE` - Use secure SMTP connection
- `SMTP_USER` - SMTP username
- `SMTP_PASS` - SMTP password
- `SMTP_FROM` - SMTP from address
- `WEBHOOK_URL` - Webhook URL for notifications
- `WEBHOOK_TOKEN` - Webhook authentication token
- `STORAGE_PATH` - Local storage path for files

## CLI Usage

The configuration system includes a CLI tool for management and validation:

### Validate Configuration

```bash
# Validate current environment configuration
pnpm run config:validate

# Validate specific environment
pnpm run config validate --env production
```

### Show Configuration

```bash
# Show current configuration
pnpm run config:show

# Show configuration for specific environment
pnpm run config show --env production

# Save configuration to file
pnpm run config show --output config.json
pnpm run config show --output config.yaml --format yaml
```

### Generate Configuration Template

```bash
# Generate configuration template for environment
pnpm run config generate --env production --output config/prod.json
```

### Help

```bash
pnpm run config help
```

## Usage in Code

### Basic Usage

```typescript
import { configManager } from './lib/config'

// Initialize configuration (call once at startup)
await configManager.initialize()

// Get complete configuration
const config = configManager.getConfig()

// Get specific configuration sections
const serverConfig = configManager.getServerConfig()
const dbConfig = configManager.getDatabaseConfig()
const redisConfig = configManager.getRedisConfig()
```

### Environment Checks

```typescript
import { configManager } from './lib/config'

if (configManager.isProduction()) {
	// Production-specific logic
}

if (configManager.isDevelopment()) {
	// Development-specific logic
}

const environment = configManager.getEnvironment()
```

### Configuration Validation

```typescript
import { ConfigValidator } from './lib/config'

const config = configManager.getConfig()
const result = ConfigValidator.validate(config)

if (!result.isValid) {
	console.error('Configuration errors:', result.errors)
	process.exit(1)
}

if (result.warnings.length > 0) {
	console.warn('Configuration warnings:', result.warnings)
}
```

### Hot Reloading (Development Only)

```typescript
import { configManager } from './lib/config'

// Reload configuration
await configManager.reload()
```

## Configuration Schema

The configuration follows a strict schema with the following sections:

- **server**: Server settings (port, host, environment)
- **cors**: CORS configuration
- **rateLimit**: Rate limiting settings
- **database**: PostgreSQL database configuration
- **redis**: Redis configuration
- **auth**: Authentication settings
- **monitoring**: Monitoring and observability settings
- **security**: Security configuration
- **performance**: Performance optimization settings
- **api**: API endpoint configuration
- **externalServices**: External service integrations (SMTP, webhooks, storage)

## Security Considerations

- Sensitive values (secrets, passwords, keys) are automatically redacted in logs and debug output
- Configuration validation ensures required security settings are present
- Production-specific validation enforces stricter security requirements
- Environment variables take precedence over config files for sensitive values

## Best Practices

1. **Use environment variables for sensitive data** (secrets, passwords, connection strings)
2. **Keep base configuration minimal** and use environment-specific overrides
3. **Validate configuration in CI/CD pipelines** using `pnpm run config:validate`
4. **Use different databases/Redis instances** for different environments
5. **Enable SSL in production** for database connections
6. **Set appropriate CORS origins** for production (avoid wildcards)
7. **Use strong encryption keys and session secrets** (minimum 32 characters)

## Troubleshooting

### Configuration Validation Errors

Run `pnpm run config:validate` to see detailed validation errors and warnings.

### Environment Variable Issues

- Ensure boolean values are set to `"true"` or `"false"` (strings)
- Number values should be valid numbers
- URLs should include the protocol (http://, https://, postgresql://, redis://)

### Missing Configuration

- Check that required environment variables are set
- Verify configuration files exist and are valid JSON
- Use `pnpm run config:show` to see the final merged configuration

### Development vs Production

- Development allows more lenient validation
- Production requires stricter security settings
- Use `pnpm run config validate --env production` to test production configuration
