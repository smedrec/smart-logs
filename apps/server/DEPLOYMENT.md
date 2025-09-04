# SMEDREC Audit Server - Production Deployment Guide

This document provides comprehensive instructions for deploying the SMEDREC Audit Server to production environments using Docker Compose and Kubernetes.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Configuration](#environment-configuration)
3. [Docker Compose Deployment](#docker-compose-deployment)
4. [Kubernetes Deployment](#kubernetes-deployment)
5. [Monitoring and Alerting](#monitoring-and-alerting)
6. [Backup and Recovery](#backup-and-recovery)
7. [CI/CD Pipeline](#cicd-pipeline)
8. [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements

- **CPU**: Minimum 4 cores, Recommended 8+ cores
- **Memory**: Minimum 8GB RAM, Recommended 16GB+ RAM
- **Storage**: Minimum 100GB SSD, Recommended 500GB+ SSD
- **Network**: Stable internet connection with sufficient bandwidth

### Software Requirements

- Docker 24.0+ and Docker Compose 2.0+
- Kubernetes 1.28+ (for K8s deployment)
- kubectl configured with cluster access
- Node.js 20+ (for local development)
- PostgreSQL 16+ (external database)
- Redis 7+ (external cache)

### Security Requirements

- SSL/TLS certificates for HTTPS
- Firewall configured to allow only necessary ports
- Secrets management system (Kubernetes Secrets, HashiCorp Vault, etc.)
- Regular security updates and patches

## Environment Configuration

### 1. Environment Variables

Copy the production environment template:

```bash
cp apps/server/.env.production apps/server/.env
```

Update the following critical variables:

```bash
# Database Configuration
DATABASE_URL=postgresql://audit_user:STRONG_PASSWORD@postgres:5432/audit_db
POSTGRES_PASSWORD=STRONG_DATABASE_PASSWORD

# Redis Configuration
REDIS_URL=redis://:STRONG_REDIS_PASSWORD@redis:6379
REDIS_PASSWORD=STRONG_REDIS_PASSWORD

# Authentication
BETTER_AUTH_SECRET=VERY_LONG_RANDOM_STRING_FOR_AUTH_SECURITY
JWT_SECRET=STRONG_JWT_SECRET_KEY
ENCRYPTION_KEY=32_CHARACTER_ENCRYPTION_KEY_HERE

# Storage
S3_ACCESS_KEY_ID=YOUR_S3_ACCESS_KEY
S3_SECRET_ACCESS_KEY=YOUR_S3_SECRET_KEY
S3_BUCKET=your-audit-storage-bucket

# Monitoring
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
GRAFANA_ADMIN_PASSWORD=STRONG_GRAFANA_PASSWORD

# Alerts
SMTP_PASSWORD=YOUR_SMTP_PASSWORD
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
PAGERDUTY_ROUTING_KEY=YOUR_PAGERDUTY_KEY
```

### 2. SSL/TLS Certificates

Place your SSL certificates in the appropriate directory:

```bash
mkdir -p apps/server/ssl
cp your-cert.pem apps/server/ssl/cert.pem
cp your-key.pem apps/server/ssl/key.pem
```

## Docker Compose Deployment

### 1. Production Deployment

Deploy using the production Docker Compose configuration:

```bash
cd apps/server

# Create required directories
mkdir -p data/{postgres,redis,prometheus,grafana} backups/{postgres,redis}

# Deploy the stack
docker-compose -f docker-compose.prod.yml up -d

# Check service status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f audit-server
```

### 2. Scaling Services

Scale the audit server for high availability:

```bash
docker-compose -f docker-compose.prod.yml up -d --scale audit-server=3
```

### 3. Health Checks

Verify all services are healthy:

```bash
# Check health endpoints
curl -f https://api.smedrec.com/health
curl -f https://api.smedrec.com/ready

# Check monitoring
curl -f http://localhost:9090/-/healthy  # Prometheus
curl -f http://localhost:3001/api/health # Grafana
```

## Kubernetes Deployment

### 1. Cluster Preparation

Ensure your Kubernetes cluster is ready:

```bash
# Check cluster connectivity
kubectl cluster-info

# Create namespace
kubectl create namespace smedrec-audit

# Apply RBAC configurations
kubectl apply -f apps/server/k8s/serviceaccount.yaml
```

### 2. Secrets Management

Create required secrets:

```bash
# Database secrets
kubectl create secret generic postgres-secrets \
  --from-literal=username=audit_user \
  --from-literal=password=STRONG_DATABASE_PASSWORD \
  --from-literal=database=audit_db \
  -n smedrec-audit

# Redis secrets
kubectl create secret generic redis-secrets \
  --from-literal=password=STRONG_REDIS_PASSWORD \
  -n smedrec-audit

# Application secrets
kubectl create secret generic audit-server-secrets \
  --from-literal=BETTER_AUTH_SECRET=VERY_LONG_RANDOM_STRING \
  --from-literal=JWT_SECRET=STRONG_JWT_SECRET \
  --from-literal=ENCRYPTION_KEY=32_CHARACTER_KEY \
  --from-literal=S3_ACCESS_KEY_ID=YOUR_ACCESS_KEY \
  --from-literal=S3_SECRET_ACCESS_KEY=YOUR_SECRET_KEY \
  --from-literal=SENTRY_DSN=YOUR_SENTRY_DSN \
  -n smedrec-audit

# Monitoring secrets
kubectl create secret generic grafana-secrets \
  --from-literal=admin-password=STRONG_GRAFANA_PASSWORD \
  -n smedrec-audit
```

### 3. Deploy Application

Use the deployment script:

```bash
# Deploy to production
./apps/server/scripts/k8s-deploy.sh --environment production --tag latest

# Deploy specific version
./apps/server/scripts/k8s-deploy.sh --environment production --tag v1.2.3

# Dry run deployment
./apps/server/scripts/k8s-deploy.sh --dry-run --environment production
```

Or deploy manually:

```bash
# Apply all manifests
kubectl apply -f apps/server/k8s/ -n smedrec-audit

# Check deployment status
kubectl rollout status deployment/audit-server -n smedrec-audit

# Verify pods
kubectl get pods -n smedrec-audit -l app.kubernetes.io/name=audit-server
```

### 4. Ingress Configuration

Configure ingress for external access:

```bash
# Apply ingress configuration
kubectl apply -f apps/server/k8s/ingress.yaml

# Check ingress status
kubectl get ingress -n smedrec-audit
```

## Monitoring and Alerting

### 1. Prometheus Configuration

Prometheus is automatically deployed with the stack and configured to scrape:

- Audit server application metrics
- PostgreSQL metrics
- Redis metrics
- System metrics (Node Exporter)
- Kubernetes metrics

Access Prometheus at: `http://localhost:9090` (Docker) or `https://monitoring.smedrec.com/prometheus` (K8s)

### 2. Grafana Dashboards

Grafana is pre-configured with dashboards for:

- **Audit Server Overview**: Application performance and health
- **Database Metrics**: PostgreSQL performance and connections
- **System Metrics**: CPU, memory, disk usage
- **Alert Status**: Current alerts and their status

Access Grafana at: `http://localhost:3001` (Docker) or `https://monitoring.smedrec.com/grafana` (K8s)

Default credentials: `admin` / `[GRAFANA_ADMIN_PASSWORD]`

### 3. Alerting Rules

Alerting is configured for:

- **Critical Alerts**: Service down, high error rate, database issues
- **Warning Alerts**: High resource usage, slow response times
- **Info Alerts**: Deployment notifications, backup status

Alerts are sent via:

- Email notifications
- Slack integration
- PagerDuty (for critical alerts)

## Backup and Recovery

### 1. Automated Backups

Backups are automatically performed daily at 2 AM UTC:

- **PostgreSQL**: Full database dump with compression
- **Redis**: RDB snapshot with compression
- **Retention**: 30 days local, configurable S3 retention

### 2. Manual Backup

Trigger manual backup:

```bash
# Docker Compose
docker-compose -f docker-compose.prod.yml exec backup /backup.sh

# Kubernetes
kubectl create job --from=cronjob/backup-job manual-backup-$(date +%s) -n smedrec-audit
```

### 3. Restore Procedures

#### PostgreSQL Restore

```bash
# Stop application
docker-compose -f docker-compose.prod.yml stop audit-server

# Restore database
gunzip -c /backup/postgres_audit_db_TIMESTAMP.sql.gz | \
  docker-compose -f docker-compose.prod.yml exec -T postgres \
  psql -U audit_user -d audit_db

# Start application
docker-compose -f docker-compose.prod.yml start audit-server
```

#### Redis Restore

```bash
# Stop Redis
docker-compose -f docker-compose.prod.yml stop redis

# Copy backup file
gunzip -c /backup/redis_TIMESTAMP.rdb.gz > /data/redis/dump.rdb

# Start Redis
docker-compose -f docker-compose.prod.yml start redis
```

## CI/CD Pipeline

### 1. GitHub Actions Workflow

The CI/CD pipeline is configured in `.github/workflows/deploy-production.yml` and includes:

1. **Security Scanning**: Trivy vulnerability scanner
2. **Testing**: Unit tests, integration tests, type checking
3. **Building**: Multi-platform Docker image build
4. **Staging Deployment**: Automatic deployment to staging
5. **Production Deployment**: Manual approval required
6. **Verification**: Health checks and smoke tests
7. **Notifications**: Slack notifications and GitHub releases

### 2. Manual Deployment

Trigger manual deployment:

```bash
# Via GitHub Actions
# Go to Actions tab → Deploy to Production → Run workflow

# Via kubectl (if CI/CD is not available)
kubectl set image deployment/audit-server \
  audit-server=ghcr.io/smedrec/audit-server:v1.2.3 \
  -n smedrec-audit
```

### 3. Rollback Procedures

Rollback to previous version:

```bash
# Using deployment script
./apps/server/scripts/k8s-deploy.sh --rollback --environment production

# Using kubectl
kubectl rollout undo deployment/audit-server -n smedrec-audit

# Check rollback status
kubectl rollout status deployment/audit-server -n smedrec-audit
```

## Troubleshooting

### 1. Common Issues

#### Service Won't Start

```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs audit-server

# Check configuration
docker-compose -f docker-compose.prod.yml config

# Verify environment variables
docker-compose -f docker-compose.prod.yml exec audit-server env | grep -E "(DATABASE|REDIS|AUTH)"
```

#### Database Connection Issues

```bash
# Test database connectivity
docker-compose -f docker-compose.prod.yml exec audit-server \
  node -e "console.log(process.env.DATABASE_URL)"

# Check PostgreSQL logs
docker-compose -f docker-compose.prod.yml logs postgres

# Test connection manually
docker-compose -f docker-compose.prod.yml exec postgres \
  psql -U audit_user -d audit_db -c "SELECT 1;"
```

#### High Memory Usage

```bash
# Check memory usage
docker stats

# Analyze heap dump (if available)
docker-compose -f docker-compose.prod.yml exec audit-server \
  node --inspect --heap-prof src/index.js
```

### 2. Performance Tuning

#### Database Optimization

```sql
-- Check slow queries
SELECT query, mean_time, calls
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

-- Analyze table statistics
ANALYZE;

-- Check index usage
SELECT schemaname, tablename, attname, n_distinct, correlation
FROM pg_stats
WHERE schemaname = 'audit';
```

#### Redis Optimization

```bash
# Check Redis memory usage
docker-compose -f docker-compose.prod.yml exec redis redis-cli info memory

# Monitor slow queries
docker-compose -f docker-compose.prod.yml exec redis redis-cli slowlog get 10
```

### 3. Monitoring and Debugging

#### Application Metrics

Access metrics at: `https://api.smedrec.com/metrics`

Key metrics to monitor:

- `http_requests_total`: Request count by status code
- `http_request_duration_seconds`: Response time distribution
- `audit_events_processed_total`: Audit events processed
- `database_connections_active`: Active database connections

#### Log Analysis

```bash
# View application logs
docker-compose -f docker-compose.prod.yml logs -f audit-server

# Search for errors
docker-compose -f docker-compose.prod.yml logs audit-server | grep ERROR

# Filter by request ID
docker-compose -f docker-compose.prod.yml logs audit-server | grep "req-123456"
```

### 4. Emergency Procedures

#### Service Recovery

```bash
# Restart all services
docker-compose -f docker-compose.prod.yml restart

# Restart specific service
docker-compose -f docker-compose.prod.yml restart audit-server

# Force recreate containers
docker-compose -f docker-compose.prod.yml up -d --force-recreate
```

#### Data Recovery

```bash
# Restore from latest backup
./apps/server/scripts/backup.sh restore latest

# Restore from specific backup
./apps/server/scripts/backup.sh restore postgres_audit_db_20240101_020000.sql.gz
```

## Support and Maintenance

### 1. Regular Maintenance Tasks

- **Weekly**: Review monitoring dashboards and alerts
- **Monthly**: Update dependencies and security patches
- **Quarterly**: Performance review and capacity planning
- **Annually**: Security audit and disaster recovery testing

### 2. Scaling Considerations

- **Horizontal Scaling**: Increase replica count for audit-server
- **Database Scaling**: Consider read replicas for high read workloads
- **Cache Scaling**: Redis Cluster for high cache workloads
- **Storage Scaling**: Monitor disk usage and plan for growth

### 3. Security Updates

- Monitor security advisories for all dependencies
- Apply security patches promptly
- Regular vulnerability scanning with Trivy
- Keep base images updated

For additional support, contact the development team or refer to the project documentation.
