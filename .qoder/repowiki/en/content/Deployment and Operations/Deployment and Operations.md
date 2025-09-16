# Deployment and Operations

<cite>
**Referenced Files in This Document**   
- [Dockerfile](file://apps/server/Dockerfile)
- [docker-compose.yml](file://apps/server/docker-compose.yml)
- [docker-compose.prod.yml](file://apps/server/docker-compose.prod.yml)
- [k8s/deployment.yaml](file://apps/server/k8s/deployment.yaml)
- [k8s/service.yaml](file://apps/server/k8s/service.yaml)
- [k8s/ingress.yaml](file://apps/server/k8s/ingress.yaml)
- [k8s/hpa.yaml](file://apps/server/k8s/hpa.yaml)
- [k8s/configmap.yaml](file://apps/server/k8s/configmap.yaml)
- [k8s/secret.yaml](file://apps/server/k8s/secret.yaml)
- [docker/nginx.conf](file://apps/server/docker/nginx.conf)
- [docker/redis.conf](file://apps/server/docker/redis.conf)
- [docker/redis.prod.conf](file://apps/server/docker/redis.prod.conf)
- [scripts/docker-build.sh](file://apps/server/scripts/docker-build.sh)
- [scripts/k8s-deploy.sh](file://apps/server/scripts/k8s-deploy.sh)
- [README.Docker.md](file://apps/server/README.Docker.md)
- [src/index.ts](file://apps/server/src/index.ts)
- [docker/infisical/docker-compose.prod.yml](file://docker/infisical/docker-compose.prod.yml) - *Added in recent commit*
- [docker/inngest/docker-compose.yml](file://docker/inngest/docker-compose.yml) - *Added in recent commit*
- [docker/openobserve/docker-compose.yml](file://docker/openobserve/docker-compose.yml) - *Added in recent commit*
- [docker/pgvector/docker-compose.yml](file://docker/pgvector/docker-compose.yml) - *Added in recent commit*
</cite>

## Update Summary
**Changes Made**   
- Added new section on Infrastructure Services with Docker Compose configurations
- Updated Local Deployment section to include new infrastructure services
- Enhanced Table of Contents to reflect new content
- Added references to new Docker Compose files for infrastructure services
- Updated Section sources to include newly added infrastructure service files

## Table of Contents
1. [Introduction](#introduction)
2. [Deployment Topology](#deployment-topology)
3. [Server Architecture](#server-architecture)
4. [Container Configuration](#container-configuration)
5. [Local Deployment with Docker Compose](#local-deployment-with-docker-compose)
6. [Infrastructure Services](#infrastructure-services)
7. [Production Deployment with Kubernetes](#production-deployment-with-kubernetes)
8. [Infrastructure Requirements](#infrastructure-requirements)
9. [Scalability and Auto-Scaling](#scalability-and-auto-scaling)
10. [Monitoring and Logging](#monitoring-and-logging)
11. [Backup and Disaster Recovery](#backup-and-disaster-recovery)
12. [Sample Deployment Scenarios](#sample-deployment-scenarios)

## Introduction

This document provides comprehensive deployment and operations guidance for the SMEDREC Audit Server, a containerized application designed for secure audit logging and compliance monitoring. The system is built using a modern microservices architecture with Docker containers orchestrated by Kubernetes for production environments. The deployment strategy includes both local development setups using Docker Compose and production-grade deployments using Kubernetes manifests.

The architecture incorporates NGINX as a reverse proxy and ingress controller, Redis for caching and queuing, and PostgreSQL for persistent data storage. The deployment configuration emphasizes security, scalability, and reliability with features such as rolling updates, health checks, and horizontal pod autoscaling. This documentation covers the complete deployment lifecycle from container build processes to production operations, including monitoring, logging, and disaster recovery procedures.

## Deployment Topology

The SMEDREC Audit Server deployment follows a multi-tier architecture with clear separation of concerns between components. In production environments, Kubernetes orchestrates the containerized services, while local development environments use Docker Compose for simplified setup.

```mermaid
graph TB
subgraph "External Access"
Client[Client Applications]
DNS[DNS]
end
subgraph "Edge Layer"
NGINX[Nginx Reverse Proxy<br/>SSL Termination<br/>Rate Limiting]
Ingress[Nginx Ingress Controller]
end
subgraph "Application Layer"
Server[Node.js Application<br/>Audit Server<br/>API Endpoints]
end
subgraph "Data Layer"
Redis[(Redis Cache<br/>Session Storage<br/>Message Queue)]
Postgres[(PostgreSQL Database<br/>Audit Logs<br/>User Data)]
end
Client --> DNS
DNS --> NGINX
DNS --> Ingress
NGINX --> Server
Ingress --> Server
Server --> Redis
Server --> Postgres
style Server fill:#4CAF50,stroke:#388E3C
style Redis fill:#2196F3,stroke:#1976D2
style Postgres fill:#F44336,stroke:#D32F2F
style NGINX fill:#9C27B0,stroke:#7B1FA2
style Ingress fill:#FF9800,stroke:#F57C00
```

**Diagram sources**
- [k8s/deployment.yaml](file://apps/server/k8s/deployment.yaml)
- [k8s/service.yaml](file://apps/server/k8s/service.yaml)
- [k8s/ingress.yaml](file://apps/server/k8s/ingress.yaml)
- [docker-compose.prod.yml](file://apps/server/docker-compose.prod.yml)

**Section sources**
- [k8s/deployment.yaml](file://apps/server/k8s/deployment.yaml)
- [docker-compose.prod.yml](file://apps/server/docker-compose.prod.yml)

## Server Architecture

The server architecture is designed with security, performance, and maintainability as primary concerns. The core components include an NGINX ingress for external traffic routing, Redis for caching and queuing, and PostgreSQL for persistent data storage.

### NGINX Ingress Configuration

The NGINX ingress controller serves as the entry point for all external traffic, providing SSL termination, rate limiting, and security headers. The configuration includes:

- **SSL/TLS termination** with automatic certificate management via cert-manager
- **Rate limiting** to prevent abuse (100 requests per minute per client)
- **Security headers** including HSTS, CSP, X-Frame-Options, and XSS protection
- **Load balancing** with upstream hash-by client IP for session affinity
- **Path-based routing** for different API endpoints (/api, /trpc, /graphql, /auth)

```mermaid
graph TD
A[Client Request] --> B{Ingress Controller}
B --> C[/health]
B --> D[/ready]
B --> E[/api/*]
B --> F[/trpc/*]
B --> G[/graphql]
B --> H[/auth/*]
B --> I[/]
C --> J[Audit Server]
D --> J
E --> J
F --> J
G --> J
H --> J
I --> J
style B fill:#FF9800,stroke:#F57C00
style J fill:#4CAF50,stroke:#388E3C
```

**Diagram sources**
- [k8s/ingress.yaml](file://apps/server/k8s/ingress.yaml)
- [docker/nginx.conf](file://apps/server/docker/nginx.conf)

### Redis Caching Strategy

Redis is used for multiple purposes in the architecture:

- **Caching**: Frequently accessed data is cached to reduce database load
- **Session storage**: User sessions are stored in Redis for stateless application servers
- **Message queuing**: Background jobs and event processing are queued in Redis
- **Rate limiting**: Client request rates are tracked in Redis

The Redis configuration includes persistence settings and security hardening:

```mermaid
classDiagram
class RedisConfiguration {
+maxmemory 512mb
+maxmemory-policy allkeys-lru
+save 900 1
+save 300 10
+save 60 10000
+requirepass [hidden]
+bind 0.0.0.0
+protected-mode yes
}
class CacheStrategy {
+TTL : 300 seconds
+Cache-Aside pattern
+Write-through for critical data
+Cache invalidation on update
}
class UseCases {
+Session storage
+API response caching
+Rate limiting counters
+Background job queue
}
RedisConfiguration --> CacheStrategy : "implements"
CacheStrategy --> UseCases : "supports"
```

**Diagram sources**
- [docker/redis.conf](file://apps/server/docker/redis.conf)
- [docker/redis.prod.conf](file://apps/server/docker/redis.prod.conf)
- [docker-compose.yml](file://apps/server/docker-compose.yml)

### PostgreSQL Database Architecture

The PostgreSQL database stores audit logs, user data, and application metadata. The architecture includes:

- **Partitioning**: Audit logs are partitioned by time for improved query performance
- **Indexing**: Strategic indexes on frequently queried fields
- **Connection pooling**: Efficient connection management
- **Backup and recovery**: Regular automated backups

The database schema is managed through Drizzle ORM with migration scripts for version control.

**Section sources**
- [k8s/deployment.yaml](file://apps/server/k8s/deployment.yaml)
- [docker/nginx.conf](file://apps/server/docker/nginx.conf)
- [docker/redis.conf](file://apps/server/docker/redis.conf)

## Container Configuration

The container configuration follows security best practices and optimization principles for both development and production environments.

### Docker Build Process

The Docker build process uses a multi-stage approach to create optimized production images:

```mermaid
graph TD
A[Base Stage] --> |node:22-alpine| B[Dependencies Stage]
B --> |pnpm install| C[Builder Stage]
C --> |build application| D[Runner Stage]
D --> |minimal image| E[Production Image]
subgraph "Base Stage"
A1[Install security updates]
A2[Add non-root user]
A3[Set up pnpm]
end
subgraph "Dependencies Stage"
B1[Copy package files]
B2[Install dependencies]
B3[Use cache mount]
end
subgraph "Builder Stage"
C1[Copy source code]
C2[Build application]
C3[Build workspace packages]
end
subgraph "Runner Stage"
D1[Copy built artifacts]
D2[Set non-root user]
D3[Copy production dependencies]
D4[Set health check]
D5[Set entrypoint]
end
A --> A1
A --> A2
A --> A3
B --> B1
B --> B2
B --> B3
C --> C1
C --> C2
C --> C3
D --> D1
D --> D2
D --> D3
D --> D4
D --> D5
```

**Diagram sources**
- [Dockerfile](file://apps/server/Dockerfile)
- [scripts/docker-build.sh](file://apps/server/scripts/docker-build.sh)

### Container Security Configuration

The production containers implement multiple security measures:

- **Non-root user**: Application runs as user with UID 1001
- **Read-only filesystem**: Root filesystem is mounted as read-only
- **Privilege dropping**: All capabilities are dropped
- **Seccomp profile**: Runtime default seccomp profile applied
- **No new privileges**: Prevents privilege escalation

The security context is configured in the Kubernetes deployment:

```yaml
securityContext:
  runAsNonRoot: true
  runAsUser: 1001
  runAsGroup: 1001
  fsGroup: 1001
  seccompProfile:
    type: RuntimeDefault
```

**Section sources**
- [Dockerfile](file://apps/server/Dockerfile)
- [k8s/deployment.yaml](file://apps/server/k8s/deployment.yaml)

## Local Deployment with Docker Compose

Local deployment is facilitated through Docker Compose configurations for both development and production-like environments.

### Development Environment

The development environment is configured in `docker-compose.yml` and includes:

- **Hot reloading**: Source code is mounted as a volume for live updates
- **Development tools**: Debugging utilities and development dependencies
- **Permissive CORS**: Allows connections from localhost development servers
- **Health checks**: Container health monitoring

```bash
# Start development environment
docker-compose up -d

# View logs
docker-compose logs -f audit-server

# Stop environment
docker-compose down
```

The development configuration mounts source code volumes for hot reloading:

```yaml
volumes:
  - ../../apps/server/src:/app/apps/server/src:ro
  - ../../packages:/app/packages:ro
```

### Production Simulation Environment

The production simulation environment is configured in `docker-compose.prod.yml` and includes:

- **Nginx reverse proxy**: With SSL termination and security headers
- **Resource limits**: CPU and memory constraints
- **Read-only filesystem**: Enhanced security
- **External secrets**: Environment variables loaded from external sources

```bash
# Start production simulation
docker-compose -f docker-compose.prod.yml up -d

# Scale the application
docker-compose -f docker-compose.prod.yml up -d --scale audit-server=3
```

The production configuration uses resource limits and security hardening:

```yaml
deploy:
  replicas: 2
  resources:
    limits:
      cpus: '1.0'
      memory: 1G
    reservations:
      cpus: '0.5'
      memory: 512M
  restart_policy:
    condition: on-failure
    delay: 5s
    max_attempts: 3
    window: 120s
```

**Section sources**
- [docker-compose.yml](file://apps/server/docker-compose.yml)
- [docker-compose.prod.yml](file://apps/server/docker-compose.prod.yml)
- [README.Docker.md](file://apps/server/README.Docker.md)

## Infrastructure Services

New infrastructure services have been added to support the audit logging system. These services are configured using dedicated Docker Compose files and provide essential functionality for secrets management, event processing, observability, and vector database capabilities.

### Infisical Secrets Management

Infisical provides secure secrets management for the application. The production configuration is defined in `docker/infisical/docker-compose.prod.yml`:

```yaml
services:
  backend:
    container_name: infisical-backend
    restart: always
    image: infisical/infisical:latest-postgres
    pull_policy: always
    env_file: .env
    environment:
      - NODE_ENV=production

networks:
  default:
    external: true
    name: nginx-proxy-manager_default
```

**Section sources**
- [docker/infisical/docker-compose.prod.yml](file://docker/infisical/docker-compose.prod.yml)

### Inngest Event Processing

Inngest handles event-driven workflows and background processing. The configuration is defined in `docker/inngest/docker-compose.yml`:

```yaml
services:
  inngest:
    image: inngest/inngest
    command: 'inngest start -u http://192.168.1.114:3000/api/inngest'
    container_name: inngest
    restart: always
    ports:
      - '8288:8288'
      - '8289:8289'
    environment:
      - INNGEST_EVENT_KEY=${INNGEST_EVENT_KEY}
      - INNGEST_SIGNING_KEY=${INNGEST_SIGNING_KEY}
      - INNGEST_POSTGRES_URI=${INNGEST_POSTGRES_URI}
      - INNGEST_REDIS_URI=${INNGEST_REDIS_URI}

networks:
  default:
    external: true
    name: nginx-proxy-manager_default
```

**Section sources**
- [docker/inngest/docker-compose.yml](file://docker/inngest/docker-compose.yml)

### OpenObserve Logging and Observability

OpenObserve provides centralized logging and observability capabilities. The configuration is defined in `docker/openobserve/docker-compose.yml`:

```yaml
services:
  openobserve:
    image: public.ecr.aws/zinclabs/openobserve:latest
    container_name: openobserve
    restart: always
    ports:
      - "5080:5080"
    environment:
      - ZO_DATA_DIR=/data
      - ZO_ROOT_USER_EMAIL=${OPENOBSERVE_ROOT_USER_EMAIL}
      - ZO_ROOT_USER_PASSWORD=${OPENOBSERVE_ROOT_USER_PASSWORD}
    volumes:
      - openobserve_data:/data

volumes:
  openobserve_data:
    driver: local
```

**Section sources**
- [docker/openobserve/docker-compose.yml](file://docker/openobserve/docker-compose.yml)

### PGVector Database Extension

PGVector provides vector database capabilities for advanced analytics. The configuration is defined in `docker/pgvector/docker-compose.yml`:

```yaml
services:
  postgres:
    image: pgvector/pgvector:pg17
    container_name: pgvector
    restart: always
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    ports:
      - '25432:5432'
    volumes:
      - pgvector:/var/lib/postgresql/data
    command: postgres -c shared_preload_libraries='pg_stat_statements' -c wal_level=logical
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U ${POSTGRES_USER} -d ${AUDIT_DB}']
      interval: 10s
      timeout: 5s
      retries: 5
  electric:
    image: docker.io/electricsql/electric:latest
    container_name: electric
    restart: always
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${AUDIT_DB}?sslmode=disable
      ELECTRIC_INSECURE: true
    depends_on:
      postgres:
        condition: service_healthy

networks:
  default:
    external: true
    name: nginx-proxy-manager_default

volumes:
  pgvector:
    driver: local
```

**Section sources**
- [docker/pgvector/docker-compose.yml](file://docker/pgvector/docker-compose.yml)

## Production Deployment with Kubernetes

Production deployment uses Kubernetes manifests to define the desired state of the application and its dependencies.

### Kubernetes Manifests Overview

The Kubernetes deployment consists of multiple manifests:

- **namespace.yaml**: Defines the `smedrec-audit` namespace
- **configmap.yaml**: Stores non-sensitive configuration
- **secret.yaml**: Stores sensitive credentials
- **serviceaccount.yaml**: Defines service account for the application
- **deployment.yaml**: Defines the application deployment
- **service.yaml**: Exposes the application within the cluster
- **ingress.yaml**: Routes external traffic to the application
- **hpa.yaml**: Enables horizontal pod autoscaling

### Deployment Configuration

The deployment configuration specifies three replicas with rolling update strategy:

```yaml
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
```

This ensures zero-downtime deployments with at most one additional pod during updates and no unavailable pods.

### Service Configuration

The service configuration exposes the application within the cluster:

```yaml
spec:
  type: ClusterIP
  ports:
    - name: http
      port: 80
      targetPort: http
  selector:
    app.kubernetes.io/name: audit-server
```

A headless service is also defined for direct pod access when needed.

### Ingress Configuration

The ingress configuration routes external traffic to the application with security features:

```yaml
spec:
  tls:
    - hosts:
        - api.smedrec.com
      secretName: audit-server-tls
  rules:
    - host: api.smedrec.com
      http:
        paths:
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: audit-server
                port:
                  number: 80
```

The ingress includes annotations for NGINX controller features like rate limiting, CORS, and security headers.

### Horizontal Pod Autoscaler

The HPA automatically scales the deployment based on CPU and memory utilization:

```yaml
spec:
  minReplicas: 3
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
```

The autoscaler maintains 3-10 replicas based on resource usage.

**Section sources**
- [k8s/deployment.yaml](file://apps/server/k8s/deployment.yaml)
- [k8s/service.yaml](file://apps/server/k8s/service.yaml)
- [k8s/ingress.yaml](file://apps/server/k8s/ingress.yaml)
- [k8s/hpa.yaml](file://apps/server/k8s/hpa.yaml)
- [k8s/configmap.yaml](file://apps/server/k8s/configmap.yaml)
- [k8s/secret.yaml](file://apps/server/k8s/secret.yaml)

## Infrastructure Requirements

The infrastructure requirements vary between development and production environments.

### Resource Allocation

#### Development Environment
- **CPU**: 2 cores minimum
- **Memory**: 4GB minimum
- **Storage**: 10GB minimum
- **Network**: Internet access for dependency installation

#### Production Environment
- **CPU**: 4+ cores (per node)
- **Memory**: 8+ GB (per node)
- **Storage**: SSD with 50GB+ (for database and logs)
- **Network**: High bandwidth with low latency

### Kubernetes Cluster Requirements

For production Kubernetes deployment:

- **Minimum nodes**: 3 (for high availability)
- **Control plane**: 3 nodes (for etcd quorum)
- **Worker nodes**: 3+ nodes (for application pods)
- **Storage**: Persistent volumes for database and Redis
- **Networking**: CNI plugin (e.g., Calico, Flannel)
- **Ingress**: NGINX ingress controller installed
- **Monitoring**: Prometheus and Grafana for observability
- **Secrets management**: cert-manager for TLS certificates

### Networking Configuration

The networking configuration includes:

- **Internal network**: For communication between pods
- **External load balancer**: For ingress traffic
- **DNS**: Domain names configured for API endpoints
- **Firewall rules**: Ports 80 (HTTP) and 443 (HTTPS) open
- **Security groups**: Restrict access to trusted sources

**Section sources**
- [k8s/deployment.yaml](file://apps/server/k8s/deployment.yaml)
- [docker-compose.prod.yml](file://apps/server/docker-compose.prod.yml)

## Scalability and Auto-Scaling

The system is designed for horizontal scalability to handle varying loads.

### Horizontal Pod Autoscaling

The Horizontal Pod Autoscaler (HPA) automatically adjusts the number of pod replicas based on observed metrics:

```mermaid
graph TD
A[Metric Server] --> |CPU/Memory usage| B[HPA Controller]
B --> |scale up/down| C[Deployment]
C --> D[Pods]
subgraph "Scaling Logic"
B1{Current CPU > 70%?}
B2{Current Memory > 80%?}
B3[Scale Up]
B4[Scale Down]
end
B --> B1
B --> B2
B1 --> |Yes| B3
B1 --> |No| B5[No Change]
B2 --> |Yes| B3
B2 --> |No| B5
B3 --> C
B4 --> C
```

The HPA scaling behavior is configured with stabilization windows:

```yaml
behavior:
  scaleDown:
    stabilizationWindowSeconds: 300
    policies:
      - type: Percent
        value: 10
        periodSeconds: 60
  scaleUp:
    stabilizationWindowSeconds: 60
    policies:
      - type: Percent
        value: 50
        periodSeconds: 60
```

This prevents rapid scaling fluctuations (thrashing).

### Rolling Updates

Rolling updates ensure zero-downtime deployments:

```mermaid
sequenceDiagram
participant K8s as Kubernetes
participant OldPods as Old Pods (v1.0)
participant NewPods as New Pods (v1.1)
K8s->>K8s : Start rolling update
K8s->>NewPods : Create 1 new pod
NewPods->>K8s : Ready
K8s->>OldPods : Terminate 1 old pod
K8s->>NewPods : Create 1 new pod
NewPods->>K8s : Ready
K8s->>OldPods : Terminate 1 old pod
K8s->>NewPods : Create 1 new pod
NewPods->>K8s : Ready
K8s->>OldPods : Terminate 1 old pod
K8s->>K8s : Update complete
```

The deployment strategy ensures service continuity during updates.

**Section sources**
- [k8s/deployment.yaml](file://apps/server/k8s/deployment.yaml)
- [k8s/hpa.yaml](file://apps/server/k8s/hpa.yaml)

## Monitoring and Logging

Comprehensive monitoring and logging are essential for operational visibility.

### Health Checks

The application implements multiple health check endpoints:

- **/health**: Liveness probe - indicates if the application is running
- **/ready**: Readiness probe - indicates if the application can accept traffic
- **/metrics**: Prometheus metrics endpoint

The Kubernetes probes are configured with appropriate thresholds:

```yaml
livenessProbe:
  httpGet:
    path: /health
    port: http
  initialDelaySeconds: 30
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /ready
    port: http
  initialDelaySeconds: 10
  periodSeconds: 5
  timeoutSeconds: 3
  failureThreshold: 3
```

### Logging Strategy

The logging strategy includes:

- **Structured logging**: JSON format for easy parsing
- **Log levels**: Configurable log verbosity
- **Log rotation**: Prevents disk space exhaustion
- **Centralized collection**: Logs forwarded to monitoring system

The Docker Compose configuration includes log rotation:

```yaml
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

### Monitoring Setup

The monitoring setup includes:

- **Prometheus**: Metrics collection and storage
- **Grafana**: Visualization and dashboards
- **Alertmanager**: Alert routing and notification
- **Application metrics**: Custom metrics exposed at `/metrics`

The application exposes metrics for:
- HTTP request rates and latencies
- Error rates
- Database query performance
- Cache hit ratios
- Queue lengths

**Section sources**
- [k8s/deployment.yaml](file://apps/server/k8s/deployment.yaml)
- [docker-compose.yml](file://apps/server/docker-compose.yml)
- [src/index.ts](file://apps/server/src/index.ts)

## Backup and Disaster Recovery

Robust backup and disaster recovery procedures ensure data integrity and business continuity.

### Backup Procedures

Regular backups are performed for critical data:

- **Database backups**: Daily full backups with transaction log shipping
- **Configuration backups**: Version-controlled Kubernetes manifests
- **Secrets backup**: Encrypted backup of sensitive credentials

Database backup script:

```bash
# Backup database
docker-compose exec postgres pg_dump -U audit_user audit_db > backup.sql

# Compress and encrypt backup
gzip backup.sql
gpg --encrypt --recipient admin@smedrec.com backup.sql.gz
```

### Disaster Recovery Plan

The disaster recovery plan includes:

1. **Immediate response**: Isolate affected systems and assess damage
2. **Data restoration**: Restore from most recent backup
3. **System recovery**: Rebuild infrastructure from manifests
4. **Validation**: Verify data integrity and system functionality
5. **Post-mortem**: Analyze root cause and improve procedures

Recovery time objectives (RTO) and recovery point objectives (RPO):
- **RTO**: 2 hours for critical systems
- **RPO**: 15 minutes for database (transaction logs)

### High Availability Configuration

The system is configured for high availability:

- **Multi-replica deployments**: At least 3 replicas for critical services
- **Multi-zone deployment**: Spread across availability zones
- **Automated failover**: Kubernetes automatically reschedules failed pods
- **Redundant networking**: Multiple network paths

**Section sources**
- [k8s/deployment.yaml](file://apps/server/k8s/deployment.yaml)
- [docker-compose.prod.yml](file://apps/server/docker-compose.prod.yml)

## Sample Deployment Scenarios

This section provides practical deployment scenarios for common operational tasks.

### Initial Production Deployment

```bash
# Build production image
./scripts/docker-build.sh build-prod -t v1.0.0

# Push image to registry
./scripts/docker-build.sh push -t v1.0.0 -r registry.smedrec.com

# Deploy to Kubernetes
./scripts/k8s-deploy.sh deploy -n smedrec-audit

# Verify deployment
./scripts/k8s-deploy.sh status -n smedrec-audit
```

### Zero-Downtime Update

```bash
# Build and push new version
./scripts/docker-build.sh build-prod -t v1.1.0
./scripts/docker-build.sh push -t v1.1.0 -r registry.smedrec.com

# Update deployment
./scripts/k8s-deploy.sh update -n smedrec-audit

# Monitor rollout
kubectl rollout status deployment/audit-server -n smedrec-audit
```

### Scaling for Increased Load

```bash
# Check current metrics
kubectl top pods -n smedrec-audit

# Scale deployment manually
./scripts/k8s-deploy.sh scale -r 6 -n smedrec-audit

# Or wait for HPA to scale automatically based on CPU/Memory
```

### Emergency Rollback

```bash
# Rollback to previous version
./scripts/k8s-deploy.sh rollback -n smedrec-audit

# Verify rollback
./scripts/k8s-deploy.sh status -n smedrec-audit
kubectl logs deployment/audit-server -n smedrec-audit --tail=100
```

### Local Development Setup

```bash
# Start development environment
docker-compose up -d

# Access application
curl http://localhost:3000/health

# View logs
docker-compose logs -f audit-server

# Make code changes (auto-reloads)
# Test changes
curl http://localhost:3000/api/endpoint
```

**Section sources**
- [scripts/docker-build.sh](file://apps/server/scripts/docker-build.sh)
- [scripts/k8s-deploy.sh](file://apps/server/scripts/k8s-deploy.sh)
- [README.Docker.md](file://apps/server/README.Docker.md)