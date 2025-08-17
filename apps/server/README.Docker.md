# SMEDREC Audit Server - Docker Deployment Guide

This guide covers the Docker containerization setup for the SMEDREC Audit Server with production optimizations, security best practices, and deployment configurations.

## 🐳 Docker Files Overview

### Production Dockerfile (`Dockerfile`)

- **Multi-stage build** for optimized image size
- **Security hardening** with non-root user
- **Health checks** and readiness probes
- **Signal handling** for graceful shutdowns
- **Alpine Linux** base for minimal attack surface

### Development Dockerfile (`Dockerfile.dev`)

- **Hot reloading** support for development
- **Development tools** included
- **Volume mounting** for source code changes
- **Debug-friendly** configuration

## 🚀 Quick Start

### Development Environment

```bash
# Start development environment with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f audit-server

# Stop environment
docker-compose down
```

### Production Environment

```bash
# Build production image
docker build -f Dockerfile -t smedrec/audit-server:latest ../..

# Start production environment
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f audit-server
```

## 🏗️ Build Process

### Multi-Stage Build Stages

1. **Base Stage**: Node.js runtime with security updates
2. **Dependencies Stage**: Install workspace dependencies
3. **Builder Stage**: Build application and workspace packages
4. **Runner Stage**: Production runtime with minimal footprint

### Build Commands

```bash
# Development build
docker build -f Dockerfile.dev -t smedrec/audit-server:dev ../..

# Production build
docker build -f Dockerfile -t smedrec/audit-server:latest ../..

# Build with specific tag
docker build -f Dockerfile -t smedrec/audit-server:v1.0.0 ../..
```

## 🔧 Configuration

### Environment Variables

| Variable       | Description                  | Default      | Required |
| -------------- | ---------------------------- | ------------ | -------- |
| `NODE_ENV`     | Environment mode             | `production` | Yes      |
| `PORT`         | Server port                  | `3000`       | No       |
| `HOST`         | Server host                  | `0.0.0.0`    | No       |
| `DATABASE_URL` | PostgreSQL connection string | -            | Yes      |
| `REDIS_URL`    | Redis connection string      | -            | Yes      |
| `AUTH_SECRET`  | Authentication secret key    | -            | Yes      |
| `CORS_ORIGIN`  | Allowed CORS origins         | -            | Yes      |
| `LOG_LEVEL`    | Logging level                | `info`       | No       |

### Docker Compose Configuration

#### Development (`docker-compose.yml`)

- **PostgreSQL 16** with audit database
- **Redis 7** for caching and queues
- **Volume mounting** for hot reloading
- **Development-friendly** settings

#### Production (`docker-compose.prod.yml`)

- **Load balancing** with multiple replicas
- **Resource limits** and reservations
- **Nginx reverse proxy** with SSL
- **Security hardening** configurations

## 🔒 Security Features

### Container Security

- **Non-root user** (UID 1001)
- **Read-only root filesystem**
- **No new privileges** flag
- **Minimal base image** (Alpine Linux)
- **Security updates** applied

### Network Security

- **TLS/SSL termination** at Nginx
- **Rate limiting** per IP address
- **CORS configuration** for allowed origins
- **Security headers** (HSTS, CSP, etc.)

### Runtime Security

- **Resource limits** to prevent DoS
- **Health checks** for monitoring
- **Graceful shutdown** handling
- **Signal handling** for clean exits

## 📊 Health Checks

### Container Health Check

```bash
# Health check endpoint
curl -f http://localhost:3000/health

# Readiness check endpoint
curl -f http://localhost:3000/ready
```

### Health Check Configuration

- **Interval**: 30 seconds
- **Timeout**: 10 seconds
- **Start Period**: 40 seconds
- **Retries**: 3 attempts

## 🎯 Production Deployment

### Docker Swarm

```bash
# Initialize swarm
docker swarm init

# Deploy stack
docker stack deploy -c docker-compose.prod.yml smedrec-audit

# Scale service
docker service scale smedrec-audit_audit-server=5

# View services
docker service ls
```

### Kubernetes Deployment

```bash
# Apply Kubernetes manifests
kubectl apply -f k8s/

# Check deployment status
kubectl get pods -n smedrec-audit

# View logs
kubectl logs -f deployment/audit-server -n smedrec-audit

# Scale deployment
kubectl scale deployment audit-server --replicas=5 -n smedrec-audit
```

## 🔍 Monitoring and Logging

### Container Logs

```bash
# View real-time logs
docker-compose logs -f audit-server

# View logs with timestamps
docker-compose logs -t audit-server

# View last 100 lines
docker-compose logs --tail=100 audit-server
```

### Health Monitoring

```bash
# Check container health
docker inspect --format='{{.State.Health.Status}}' <container_id>

# View health check logs
docker inspect --format='{{range .State.Health.Log}}{{.Output}}{{end}}' <container_id>
```

### Performance Monitoring

- **Prometheus metrics** exposed at `/metrics`
- **Health checks** at `/health` and `/ready`
- **Resource usage** monitoring via Docker stats

## 🛠️ Troubleshooting

### Common Issues

#### Container Won't Start

```bash
# Check container logs
docker logs <container_id>

# Check resource usage
docker stats <container_id>

# Inspect container configuration
docker inspect <container_id>
```

#### Database Connection Issues

```bash
# Test database connectivity
docker-compose exec audit-server curl -f http://localhost:3000/health

# Check database logs
docker-compose logs postgres

# Test database connection manually
docker-compose exec postgres psql -U audit_user -d audit_db -c "SELECT 1;"
```

#### Performance Issues

```bash
# Monitor resource usage
docker stats

# Check application metrics
curl http://localhost:3000/metrics

# View detailed logs
docker-compose logs -f --tail=1000 audit-server
```

### Debug Mode

```bash
# Run container in debug mode
docker run -it --rm \
  -p 3000:3000 \
  -e NODE_ENV=development \
  -e DEBUG=* \
  smedrec/audit-server:dev \
  /bin/sh
```

## 📋 Maintenance

### Image Updates

```bash
# Pull latest base images
docker-compose pull

# Rebuild with no cache
docker-compose build --no-cache

# Update production deployment
docker-compose -f docker-compose.prod.yml up -d --force-recreate
```

### Database Maintenance

```bash
# Run database migrations
docker-compose exec audit-server npm run db:migrate

# Backup database
docker-compose exec postgres pg_dump -U audit_user audit_db > backup.sql

# Restore database
docker-compose exec -T postgres psql -U audit_user audit_db < backup.sql
```

### Log Rotation

```bash
# Configure log rotation in docker-compose.yml
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

## 🔐 Security Checklist

- [ ] Use non-root user in containers
- [ ] Enable read-only root filesystem
- [ ] Set resource limits and reservations
- [ ] Use secrets for sensitive data
- [ ] Enable TLS/SSL in production
- [ ] Configure proper CORS origins
- [ ] Set up rate limiting
- [ ] Enable security headers
- [ ] Use strong authentication secrets
- [ ] Regularly update base images
- [ ] Scan images for vulnerabilities
- [ ] Monitor container logs
- [ ] Set up proper backup procedures

## 📚 Additional Resources

- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Docker Security](https://docs.docker.com/engine/security/)
- [Kubernetes Security](https://kubernetes.io/docs/concepts/security/)
- [OWASP Container Security](https://owasp.org/www-project-container-security/)
