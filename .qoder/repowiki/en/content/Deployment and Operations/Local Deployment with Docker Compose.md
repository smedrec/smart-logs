# Local Deployment with Docker Compose

<cite>
**Referenced Files in This Document**   
- [docker-compose.yml](file://apps/server/docker-compose.yml) - *Updated with service dependencies and network configuration*
- [docker-compose.prod.yml](file://apps/server/docker-compose.prod.yml) - *Production configuration with security hardening*
- [docker-build.sh](file://apps/server/scripts/docker-build.sh) - *Script for building and managing Docker images*
- [Dockerfile](file://apps/server/Dockerfile) - *Production Dockerfile*
- [Dockerfile.dev](file://apps/server/Dockerfile.dev) - *Development Dockerfile with hot reloading*
- [README.Docker.md](file://apps/server/README.Docker.md) - *Supplementary Docker documentation*
- [secret.yaml](file://apps/server/k8s/secret.yaml) - *Kubernetes secret management example*
- [manager.ts](file://packages/audit/src/config/manager.ts) - *Configuration manager with sensitive data handling*
- [pgvector/docker-compose.yml](file://docker/pgvector/docker-compose.yml) - *Added read replica configuration*
- [worker/src/index.ts](file://apps/worker/src/index.ts) - *OTLP endpoint configuration for observability*
</cite>

## Update Summary
**Changes Made**   
- Added documentation for PostgreSQL read replica configuration in Docker Compose
- Updated observability section with OTLP endpoint configuration details
- Enhanced troubleshooting section with new scenarios related to read replicas and OTLP connectivity
- Updated service dependency diagrams to reflect new architecture
- Added environment variable references for OTLP configuration

## Table of Contents
1. [Local Deployment with Docker Compose](#local-deployment-with-docker-compose)
2. [Development Environment Setup](#development-environment-setup)
3. [Service Dependencies and Network Configuration](#service-dependencies-and-network-configuration)
4. [Volume Mounting for Development](#volume-mounting-for-development)
5. [Development vs Production Compose Files](#development-vs-production-compose-files)
6. [Docker Image Building with docker-build.sh](#docker-image-building-with-docker-buildsh)
7. [Environment Variable Management and Secret Handling](#environment-variable-management-and-secret-handling)
8. [Common Troubleshooting Scenarios](#common-troubleshooting-scenarios)
9. [Service Scaling, Logging, and Container Commands](#service-scaling-logging-and-container-commands)

## Development Environment Setup

Setting up the local development environment for the SMEDREC Audit Server using Docker Compose involves configuring the `docker-compose.yml` file located in the `apps/server` directory. This file defines the services required for local development, including the audit server application, PostgreSQL database, and Redis cache.

To start the development environment, navigate to the `apps/server` directory and execute the following command:

```bash
docker-compose up -d
```

This command creates and starts all services defined in the compose file in detached mode. The audit server application is configured to run on port 3000, with the PostgreSQL database on port 5432 and Redis on port 6379. The development environment uses the `Dockerfile.dev` for building the audit server image, which includes hot reloading capabilities for efficient development.

After starting the services, you can verify their status using:

```bash
docker-compose ps
```

The audit server service depends on both the PostgreSQL and Redis services being healthy before starting, ensuring that the application has access to its required dependencies. Health checks are configured for all services to monitor their operational status.

**Section sources**
- [docker-compose.yml](file://apps/server/docker-compose.yml#L1-L94)
- [README.Docker.md](file://apps/server/README.Docker.md#L58-L72)

## Service Dependencies and Network Configuration

The Docker Compose configuration establishes clear service dependencies and network connectivity between components. The `depends_on` directive with health condition checks ensures that services start in the correct order and only when their dependencies are fully operational.

```mermaid
graph TD
A[audit-server] --> |depends on| B[postgres]
A --> |depends on| C[redis]
B --> |healthy| A
C --> |healthy| A
```

**Diagram sources**
- [docker-compose.yml](file://apps/server/docker-compose.yml#L15-L25)

All services are connected to a custom bridge network named `audit-network`, which provides DNS-based service discovery and isolated communication between containers. This network configuration allows services to communicate using their service names as hostnames.

The network is defined as:

```yaml
networks:
  audit-network:
    driver: bridge
```

Each service joins this network through the `networks` directive, enabling secure internal communication without exposing ports unnecessarily. The PostgreSQL and Redis services expose their ports to the host machine for development access, while the audit server exposes port 3000 for application access.

Security is enhanced by using the `security_opt` directive with `no-new-privileges:true`, preventing containers from gaining additional privileges beyond those of the host system.

For applications requiring read scaling, the pgvector Docker Compose configuration demonstrates a primary-replica setup:

```mermaid
graph LR
P[Primary Database] --> |WAL Replication| R[Replica Database]
A[Application] --> |Read/Write| P
A --> |Read Only| R
```

**Diagram sources**
- [pgvector/docker-compose.yml](file://docker/pgvector/docker-compose.yml#L1-L75)

**Section sources**
- [docker-compose.yml](file://apps/server/docker-compose.yml#L15-L94)
- [pgvector/docker-compose.yml](file://docker/pgvector/docker-compose.yml#L1-L75)

## Volume Mounting for Development

Volume mounting is a critical feature for local development, enabling hot reloading of code changes without rebuilding containers. The development compose file configures volume mounts that map local source code directories to paths within the container.

The audit server service uses two primary volume mounts:

```yaml
volumes:
  - ../../apps/server/src:/app/apps/server/src:ro
  - ../../packages:/app/packages:ro
```

These mounts provide read-only access to the server source code and shared packages, allowing the development server to detect file changes and automatically reload. This setup significantly improves the development workflow by eliminating the need to rebuild containers for every code change.

Additionally, persistent data storage is configured for the database and Redis services:

```yaml
volumes:
  - postgres_data:/var/lib/postgresql/data
  - redis_data:/data
```

These named volumes ensure that data persists across container restarts. The `postgres_data` volume stores PostgreSQL database files, while `redis_data` maintains Redis data. Both volumes use the local driver for storage on the host machine.

Initialization scripts are mounted to the PostgreSQL container to set up the database schema on first run:

```yaml
- ./init-scripts:/docker-entrypoint-initdb.d:ro
```

This mount allows SQL scripts in the `init-scripts` directory to be automatically executed when the database container starts for the first time, ensuring the database is properly initialized.

**Section sources**
- [docker-compose.yml](file://apps/server/docker-compose.yml#L58-L64)
- [docker-compose.yml](file://apps/server/docker-compose.yml#L78-L84)

## Development vs Production Compose Files

The project maintains separate Docker Compose files for development and production environments, reflecting the different requirements and configurations needed for each deployment scenario.

The development compose file (`docker-compose.yml`) focuses on developer productivity with features like:
- Hot reloading through volume mounts
- Development-specific Dockerfile (`Dockerfile.dev`)
- Exposed ports for local debugging
- Development environment variables with hardcoded values

In contrast, the production compose file (`docker-compose.prod.yml`) emphasizes security, scalability, and reliability:

```mermaid
graph LR
D[Development] --> |Hot Reloading| V[Volume Mounts]
D --> |Simple Setup| S[Single Replica]
D --> |Exposed Services| P[Ports 3000,5432,6379]
P[Production] --> |Security| R[Read-only Filesystem]
P --> |Scalability| M[Multiple Replicas]
P --> |Security| N[Nginx Reverse Proxy]
P --> |External Config| E[Environment Variables]
```

**Diagram sources**
- [docker-compose.yml](file://apps/server/docker-compose.yml#L1-L94)
- [docker-compose.prod.yml](file://apps/server/docker-compose.prod.yml#L1-L140)

Key differences include:

1. **Environment Variables**: Production uses environment variables (`${VARIABLE}`) for sensitive configuration, while development uses hardcoded values.

2. **Security Hardening**: The production configuration includes additional security measures:
   ```yaml
   read_only: true
   tmpfs:
     - /tmp:noexec,nosuid,size=100m
   ```

3. **Service Scaling**: Production supports multiple replicas through Docker Swarm deployment configuration:
   ```yaml
   deploy:
     replicas: 2
   ```

4. **Resource Management**: Production sets CPU and memory limits and reservations to prevent resource exhaustion.

5. **Reverse Proxy**: Production includes an Nginx service for SSL termination, load balancing, and serving static assets.

6. **Configuration Management**: Production relies on external configuration sources rather than hardcoded values, enhancing security and flexibility.

**Section sources**
- [docker-compose.yml](file://apps/server/docker-compose.yml#L1-L94)
- [docker-compose.prod.yml](file://apps/server/docker-compose.prod.yml#L1-L140)

## Docker Image Building with docker-build.sh

The `docker-build.sh` script provides a comprehensive interface for building, testing, and managing Docker images for the audit server application. Located in `apps/server/scripts/`, this bash script simplifies common Docker operations with a consistent command-line interface.

The script supports several key commands:

```bash
# Build development image
./scripts/docker-build.sh build-dev

# Build production image
./scripts/docker-build.sh build-prod

# Build both images
./scripts/docker-build.sh build-all

# Push images to registry
./scripts/docker-build.sh push -t v1.0.0 -r my-registry.com

# Clean local images
./scripts/docker-build.sh clean

# Scan images for vulnerabilities
./scripts/docker-build.sh scan

# Test built images
./scripts/docker-build.sh test
```

The build process leverages Docker's multi-stage build capabilities, with separate stages for base setup, dependency installation, application building, and production runtime. The script uses configurable parameters for image tagging, registry specification, caching, and platform targeting.

Key configuration variables in the script:
- `IMAGE_NAME="smedrec/audit-server"`: Base name for the Docker image
- `DOCKERFILE_PROD="Dockerfile"`: Production Dockerfile
- `DOCKERFILE_DEV="Dockerfile.dev"`: Development Dockerfile
- `BUILD_CONTEXT="../.."`: Root directory for build context

The script implements proper error handling and color-coded output for improved usability. It also includes functionality for vulnerability scanning using either Trivy or Docker's built-in scan feature, and automated testing of built images through health checks.

```mermaid
graph TD
A[User Command] --> B{Command Type}
B --> |build-dev| C[Build Development Image]
B --> |build-prod| D[Build Production Image]
B --> |push| E[Push to Registry]
B --> |clean| F[Remove Local Images]
B --> |scan| G[Scan for Vulnerabilities]
B --> |test| H[Test Images]
C --> I[Use Dockerfile.dev]
D --> J[Use Dockerfile]
E --> K[Authenticate to Registry]
F --> L[Remove Tagged Images]
G --> M[Use Trivy or Docker Scan]
H --> N[Run Container and Check Health]
```

**Diagram sources**
- [docker-build.sh](file://apps/server/scripts/docker-build.sh#L0-L356)

**Section sources**
- [docker-build.sh](file://apps/server/scripts/docker-build.sh#L0-L356)

## Environment Variable Management and Secret Handling

The application employs a comprehensive approach to environment variable management and secret handling, with different strategies for development and production environments.

In development, environment variables are hardcoded in the `docker-compose.yml` file for convenience:

```yaml
environment:
  - NODE_ENV=development
  - DATABASE_URL=postgresql://audit_user:audit_password@postgres:5432/audit_db
  - REDIS_URL=redis://redis:6379
  - AUTH_SECRET=dev-secret-key-change-in-production
```

This approach simplifies setup but is not suitable for production due to security concerns. The development configuration explicitly warns that secrets should be changed in production.

For production, the `docker-compose.prod.yml` file uses environment variable substitution:

```yaml
environment:
  - DATABASE_URL=${DATABASE_URL}
  - REDIS_URL=${REDIS_URL}
  - AUTH_SECRET=${AUTH_SECRET}
```

These values should be provided through a `.env` file or external secret management system. The application's configuration manager in `packages/audit/src/config/manager.ts` handles sensitive data securely, masking credentials when exporting configuration:

```typescript
if (exported.database?.url) {
    exported.database.url = this.maskSensitiveUrl(exported.database.url)
}
if (exported.security?.encryptionKey) {
    exported.security.encryptionKey = '***MASKED***'
}
```

For Kubernetes deployments, secrets are managed through Kubernetes Secret resources:

```yaml
# apps/server/k8s/secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: audit-server-secrets
type: Opaque
data:
  DATABASE_URL: cG9zdGdyZXNxbDovL2F1ZGl0X3VzZXI6YXVkaXRfcGFzc3dvcmRAcG9zdGdyZXM6NTQzMi9hdWRpdF9kYg==
  REDIS_URL: cmVkaXM6Ly9yZWRpczozNjM3OQ==
  AUTH_SECRET: eW91ci1zdHJvbmctYXV0aC1zZWNyZXQta2V5LWhlcmU=
```

The documentation recommends using external secret management systems like HashiCorp Vault or cloud provider secret managers for production deployments to enhance security.

For observability, OTLP endpoints are configured through environment variables:

```yaml
environment:
  - OTLP_ENDPOINT=http://openobserve:5080/api/default/default/_json
  - OTLP_AUTH_HEADER=Authorization: Basic ${OTLP_BASIC_AUTH}
```

**Section sources**
- [docker-compose.yml](file://apps/server/docker-compose.yml#L20-L24)
- [docker-compose.prod.yml](file://apps/server/docker-compose.prod.yml#L18-L24)
- [manager.ts](file://packages/audit/src/config/manager.ts#L331-L384)
- [secret.yaml](file://apps/server/k8s/secret.yaml#L0-L18)
- [worker/src/index.ts](file://apps/worker/src/index.ts#L74-L76)

## Common Troubleshooting Scenarios

Several common issues may arise during local Docker Compose deployment. Understanding these scenarios and their solutions can significantly reduce development downtime.

### Port Conflicts
Port conflicts occur when the required ports (3000, 5432, 6379) are already in use by other processes. To resolve:
1. Check for processes using the ports:
   ```bash
   docker ps | grep -E "(3000|5432|6379)"
   ```
2. Stop conflicting containers or change port mappings in `docker-compose.yml`
3. Use `docker-compose down` to stop all services cleanly

### Database Initialization Issues
If the database fails to initialize:
1. Check the PostgreSQL container logs:
   ```bash
   docker-compose logs postgres
   ```
2. Verify that initialization scripts in `init-scripts/` have proper permissions
3. Ensure the `POSTGRES_INITDB_ARGS` configuration is correct
4. Check volume permissions for `postgres_data`

### Network Connectivity Problems
When services cannot communicate:
1. Verify all services are on the same network:
   ```bash
   docker network inspect smart-logs-audit-network
   ```
2. Test connectivity between containers:
   ```bash
   docker-compose exec audit-server ping postgres
   ```
3. Check firewall settings on the host machine
4. Verify service names in connection strings match compose service names

### Health Check Failures
If health checks fail:
1. Check application logs for startup errors:
   ```bash
   docker-compose logs audit-server
   ```
2. Verify environment variables are correctly set
3. Ensure dependent services are healthy before the application starts
4. Adjust health check timing parameters if the application needs more startup time

### Volume Mounting Issues
When code changes don't reflect in the container:
1. Verify volume mounts are correctly configured in `docker-compose.yml`
2. Check file permissions on the host machine
3. Ensure the development server is configured for hot reloading
4. Restart the container if changes are not detected

### Read Replica Synchronization Issues
When using the pgvector read replica configuration:
1. Check replication status:
   ```bash
   docker-compose exec postgres-replica pg_isready -U ${POSTGRES_USER}
   ```
2. Verify WAL settings in the primary container:
   ```bash
   docker-compose exec pgvector-primary postgres -c wal_level=logical
   ```
3. Check replication user permissions and password consistency

### OTLP Endpoint Connectivity Issues
When observability data fails to export:
1. Verify OTLP endpoint URL:
   ```bash
   docker-compose exec audit-server curl -v ${OTLP_ENDPOINT}
   ```
2. Check authentication headers:
   ```bash
   echo "OTLP_AUTH_HEADER: ${OTLP_AUTH_HEADER}"
   ```
3. Test connectivity to the observability backend:
   ```bash
   docker-compose exec audit-server nc -zv openobserve 5080
   ```

**Section sources**
- [docker-compose.yml](file://apps/server/docker-compose.yml#L26-L35)
- [docker-compose.yml](file://apps/server/docker-compose.yml#L65-L71)
- [docker-compose.yml](file://apps/server/docker-compose.yml#L85-L91)
- [pgvector/docker-compose.yml](file://docker/pgvector/docker-compose.yml#L1-L75)
- [worker/src/index.ts](file://apps/worker/src/index.ts#L74-L76)

## Service Scaling, Logging, and Container Commands

Docker Compose provides powerful capabilities for managing services beyond basic startup and shutdown. These features are essential for effective local development and testing.

### Service Scaling
While the development environment typically runs single instances, you can scale services for testing:
```bash
# Scale audit-server to 2 instances
docker-compose up -d --scale audit-server=2

# Scale back to 1 instance
docker-compose up -d --scale audit-server=1
```

In production, scaling is managed through the `deploy.replicas` directive in `docker-compose.prod.yml`.

### Logging
Comprehensive logging is available through Docker Compose:
```bash
# View logs for all services
docker-compose logs

# Follow logs in real-time
docker-compose logs -f

# View logs for specific service
docker-compose logs -f audit-server

# Show timestamped logs
docker-compose logs -t

# Show last N lines of logs
docker-compose logs --tail=100
```

### Executing Commands in Containers
Running commands within containers is essential for debugging and maintenance:
```bash
# Open shell in audit-server container
docker-compose exec audit-server /bin/sh

# Run database migration
docker-compose exec audit-server npm run db:migrate

# Connect to PostgreSQL database
docker-compose exec postgres psql -U audit_user -d audit_db

# Check container health
docker-compose exec audit-server curl -f http://localhost:3000/health
```

### Service Management
Additional service management commands:
```bash
# Stop services without removing containers
docker-compose stop

# Start stopped services
docker-compose start

# Remove containers and networks
docker-compose down

# Rebuild images and recreate containers
docker-compose up -d --build

# Pull latest base images
docker-compose pull
```

These commands provide complete control over the local deployment environment, enabling efficient development, testing, and troubleshooting workflows.

**Section sources**
- [README.Docker.md](file://apps/server/README.Docker.md#L178-L208)
- [docker-compose.yml](file://apps/server/docker-compose.yml#L1-L94)