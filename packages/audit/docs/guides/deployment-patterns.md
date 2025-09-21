# Deployment Patterns Implementation Guide

Production deployment strategies for healthcare audit systems with emphasis on high availability, security, and regulatory compliance.

## Overview and Principles

Healthcare audit systems require robust deployment patterns that ensure continuous availability, data integrity, and regulatory compliance. This guide provides comprehensive deployment strategies for production environments.

### Healthcare Deployment Context

Healthcare environments require:
- **24/7 Availability**: Critical patient care systems cannot tolerate downtime
- **Data Sovereignty**: PHI must remain in compliant jurisdictions
- **Audit Continuity**: Regulatory audit trails must be preserved during deployments
- **Security Hardening**: Production deployments must meet healthcare security standards
- **Disaster Recovery**: Business continuity for patient care operations

## Container-Based Deployment Patterns

### 1. Docker Compose Production Pattern

**Purpose**: Simple, reliable deployment for small to medium healthcare organizations

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  audit-server:
    image: smedrec/audit-server:${VERSION}
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
        reservations:
          cpus: '1.0'
          memory: 1G
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
    environment:
      NODE_ENV: production
      DATABASE_URL: ${DATABASE_URL}
      REDIS_URL: ${REDIS_URL}
      HIPAA_COMPLIANCE_MODE: "true"
      AUDIT_ENCRYPTION_ENABLED: "true"
    networks:
      - audit-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: audit_prod
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_INITDB_ARGS: "--auth-host=scram-sha-256"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    command: |
      postgres
      -c ssl=on
      -c log_statement=all
      -c shared_preload_libraries=pg_stat_statements
    deploy:
      resources:
        limits:
          cpus: '4.0'
          memory: 4G
    networks:
      - audit-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER} -d audit_prod"]
      interval: 30s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    command: |
      redis-server
      --requirepass ${REDIS_PASSWORD}
      --appendonly yes
      --appendfsync everysec
    volumes:
      - redis_data:/data
    networks:
      - audit-network
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 30s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
  redis_data:

networks:
  audit-network:
    driver: bridge
```

### 2. Blue-Green Deployment Pattern

**Purpose**: Zero-downtime deployments with instant rollback capability

```bash
#!/bin/bash
# blue-green-deploy.sh

NEW_VERSION=${1:-latest}
HEALTH_CHECK_URL="http://localhost:3000/health"

log_info() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [INFO] $1"
}

# Determine current active environment
get_active_environment() {
    if docker-compose -f docker-compose.blue.yml ps | grep -q "Up"; then
        echo "blue"
    elif docker-compose -f docker-compose.green.yml ps | grep -q "Up"; then
        echo "green"
    else
        echo "none"
    fi
}

# Deploy to inactive environment
deploy_to_inactive() {
    local active_env=$1
    local target_env
    
    if [[ "$active_env" == "blue" ]]; then
        target_env="green"
        target_compose="docker-compose.green.yml"
    else
        target_env="blue"
        target_compose="docker-compose.blue.yml"
    fi
    
    log_info "Deploying version $NEW_VERSION to $target_env environment"
    
    # Set version and deploy
    export VERSION="$NEW_VERSION"
    docker-compose -f "$target_compose" up -d
    
    # Wait for health check
    log_info "Waiting for $target_env environment to be healthy..."
    for i in {1..30}; do
        if curl -f "$HEALTH_CHECK_URL" > /dev/null 2>&1; then
            log_info "$target_env environment is healthy"
            return 0
        fi
        sleep 10
    done
    
    log_info "$target_env environment failed to become healthy"
    return 1
}

# Switch traffic to new environment
switch_traffic() {
    local new_active=$1
    
    log_info "Switching traffic to $new_active environment"
    
    # Update load balancer configuration
    # Implementation depends on your load balancer
    
    # Verify traffic switch
    sleep 5
    if curl -f "http://localhost/health" > /dev/null 2>&1; then
        log_info "Traffic successfully switched to $new_active"
        return 0
    else
        log_info "Failed to switch traffic to $new_active"
        return 1
    fi
}

# Main deployment process
main() {
    log_info "Starting blue-green deployment for version $NEW_VERSION"
    
    local active_env
    active_env=$(get_active_environment)
    log_info "Current active environment: $active_env"
    
    # Deploy to inactive environment
    if deploy_to_inactive "$active_env"; then
        local new_active
        if [[ "$active_env" == "blue" ]]; then
            new_active="green"
        else
            new_active="blue"
        fi
        
        # Switch traffic
        if switch_traffic "$new_active"; then
            log_info "Deployment completed successfully"
            
            # Clean up old environment
            sleep 30
            if [[ "$active_env" != "none" ]]; then
                log_info "Cleaning up old $active_env environment"
                if [[ "$active_env" == "blue" ]]; then
                    docker-compose -f docker-compose.blue.yml down
                else
                    docker-compose -f docker-compose.green.yml down
                fi
            fi
        else
            log_info "Failed to switch traffic, rolling back"
            exit 1
        fi
    else
        log_info "Deployment failed"
        exit 1
    fi
}

# Execute main function
main "$@"
```

### 3. Kubernetes Production Pattern

**Purpose**: Enterprise-grade deployment with auto-scaling and high availability

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: audit-server
  namespace: smedrec-audit
  labels:
    app: audit-server
    version: v1
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: audit-server
  template:
    metadata:
      labels:
        app: audit-server
        version: v1
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "9090"
    spec:
      serviceAccountName: audit-server
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
        fsGroup: 1001
      containers:
      - name: audit-server
        image: smedrec/audit-server:latest
        imagePullPolicy: Always
        ports:
        - containerPort: 3000
          name: http
        - containerPort: 9090
          name: metrics
        env:
        - name: PORT
          value: "3000"
        - name: NODE_ENV
          value: "production"
        - name: HIPAA_COMPLIANCE_MODE
          value: "true"
        envFrom:
        - secretRef:
            name: audit-secrets
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 30
          timeoutSeconds: 10
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        securityContext:
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
          runAsNonRoot: true
          capabilities:
            drop:
            - ALL
        volumeMounts:
        - name: tmp
          mountPath: /tmp
      volumes:
      - name: tmp
        emptyDir: {}

---
# k8s/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: audit-server
  namespace: smedrec-audit
spec:
  selector:
    app: audit-server
  ports:
  - name: http
    port: 80
    targetPort: 3000
  - name: metrics
    port: 9090
    targetPort: 9090

---
# k8s/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: audit-server-hpa
  namespace: smedrec-audit
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: audit-server
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

---
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: audit-server-ingress
  namespace: smedrec-audit
  annotations:
    kubernetes.io/ingress.class: nginx
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/rate-limit: "100"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  tls:
  - hosts:
    - api.smedrec.com
    secretName: audit-server-tls
  rules:
  - host: api.smedrec.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: audit-server
            port:
              number: 80
```

## Environment Configuration Matrix

### Production Environment Configuration

```yaml
# environments/production.yml
environment:
  name: production
  description: "Live production environment"
  
security:
  encryption: enterprise-grade
  authentication: production-keys
  httpsRequired: true
  tlsVersion: "1.3"
  
database:
  ssl: true
  sslMode: require
  connectionPool: 20
  backupEnabled: true
  replicationEnabled: true
  
monitoring:
  metricsEnabled: true
  logLevel: warn
  alertingEnabled: true
  
compliance:
  hipaaMode: true
  gdprMode: true
  auditLevel: comprehensive
  dataResidency: US
  
deployment:
  strategy: blue-green
  healthChecks: mandatory
  backupBeforeDeploy: true
  rollbackOnFailure: true
  
scaling:
  minReplicas: 3
  maxReplicas: 20
  autoScaling: enabled
  
disaster-recovery:
  backupFrequency: hourly
  rpo: "< 1 hour"
  rto: "< 30 minutes"
```

### Staging Environment Configuration

```yaml
# environments/staging.yml
environment:
  name: staging
  description: "Pre-production staging environment"
  
security:
  encryption: production-grade
  httpsRequired: true
  
database:
  ssl: true
  connectionPool: 10
  
compliance:
  hipaaMode: true
  gdprMode: true
  auditLevel: full
  
deployment:
  strategy: rolling-update
  healthChecks: enabled
  backupBeforeDeploy: true
```

## Health Check and Readiness Strategy

### Comprehensive Health Checks

```typescript
// health-check-service.ts
interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded'
  timestamp: string
  checks: {
    database: HealthCheck
    redis: HealthCheck
    audit: HealthCheck
  }
  uptime: number
  version: string
}

class ProductionHealthCheckService {
  async performHealthCheck(): Promise<HealthCheckResult> {
    const [database, redis, audit] = await Promise.allSettled([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkAuditIntegrity()
    ])

    const checks = {
      database: database.status === 'fulfilled' ? database.value : { status: 'unhealthy', error: database.reason?.message },
      redis: redis.status === 'fulfilled' ? redis.value : { status: 'unhealthy', error: redis.reason?.message },
      audit: audit.status === 'fulfilled' ? audit.value : { status: 'unhealthy', error: audit.reason?.message }
    }

    const overallStatus = this.determineOverallStatus(Object.values(checks))

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks,
      uptime: process.uptime(),
      version: process.env.APP_VERSION || 'unknown'
    }
  }

  private async checkDatabase(): Promise<HealthCheck> {
    try {
      const start = Date.now()
      await this.db.raw('SELECT 1')
      const duration = Date.now() - start

      return {
        status: duration < 100 ? 'healthy' : 'degraded',
        responseTime: `${duration}ms`,
        details: 'Database connection successful'
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        details: 'Database connection failed'
      }
    }
  }

  private async checkAuditIntegrity(): Promise<HealthCheck> {
    try {
      // Verify recent audit events integrity
      const recentEvents = await this.auditService.getRecentEvents(5)
      const integrityChecks = await Promise.all(
        recentEvents.map(event => this.auditService.verifyEventIntegrity(event))
      )

      const failedChecks = integrityChecks.filter(check => !check)
      
      if (failedChecks.length === 0) {
        return {
          status: 'healthy',
          details: `${recentEvents.length} recent events verified`
        }
      } else {
        return {
          status: 'unhealthy',
          error: `${failedChecks.length} events failed integrity check`,
          details: 'Audit integrity compromised'
        }
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        details: 'Audit integrity check failed'
      }
    }
  }

  private determineOverallStatus(checks: HealthCheck[]): 'healthy' | 'unhealthy' | 'degraded' {
    if (checks.some(check => check.status === 'unhealthy')) {
      return 'unhealthy'
    }
    if (checks.some(check => check.status === 'degraded')) {
      return 'degraded'
    }
    return 'healthy'
  }
}
```

## Monitoring and Observability

### Kubernetes Deployment Script

```bash
#!/bin/bash
# k8s-deploy.sh

NAMESPACE="smedrec-audit"
APP_NAME="audit-server"
ENVIRONMENT="production"
IMAGE_TAG="latest"

log_info() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [INFO] $1"
}

log_error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [ERROR] $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed"
        exit 1
    fi
    
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi
    
    if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
        log_info "Creating namespace $NAMESPACE"
        kubectl create namespace "$NAMESPACE"
    fi
    
    log_info "Prerequisites check passed"
}

# Deploy application
deploy_application() {
    log_info "Deploying $APP_NAME to $ENVIRONMENT environment..."
    
    local image_name="smedrec/audit-server:$IMAGE_TAG"
    
    # Apply all Kubernetes manifests
    kubectl apply -f k8s/ -n "$NAMESPACE"
    
    # Update deployment image
    kubectl set image deployment/audit-server audit-server="$image_name" -n "$NAMESPACE"
    
    log_info "Deployment manifests applied"
}

# Verify deployment
verify_deployment() {
    log_info "Verifying deployment..."
    
    # Wait for rollout to complete
    if kubectl rollout status deployment/audit-server -n "$NAMESPACE" --timeout=600s; then
        log_info "Deployment rollout completed successfully"
    else
        log_error "Deployment rollout failed"
        return 1
    fi
    
    # Check pod status
    local ready_pods
    ready_pods=$(kubectl get pods -n "$NAMESPACE" -l app=audit-server --field-selector=status.phase=Running -o json | jq '.items | length')
    
    if [[ "$ready_pods" -gt 0 ]]; then
        log_info "Deployment verification passed: $ready_pods pods running"
        return 0
    else
        log_error "Deployment verification failed: no running pods"
        return 1
    fi
}

# Health check
health_check() {
    log_info "Performing health check..."
    
    # Port forward for health check
    kubectl port-forward -n "$NAMESPACE" service/audit-server 8080:80 &
    local port_forward_pid=$!
    
    sleep 5
    
    # Perform health check
    if curl -f -s "http://localhost:8080/health" > /dev/null; then
        log_info "Health check passed"
        kill $port_forward_pid
        return 0
    else
        log_error "Health check failed"
        kill $port_forward_pid
        return 1
    fi
}

# Main execution
main() {
    log_info "Starting Kubernetes deployment process..."
    
    check_prerequisites
    
    if deploy_application; then
        if verify_deployment; then
            if health_check; then
                log_info "Deployment completed successfully!"
            else
                log_error "Health check failed"
                exit 1
            fi
        else
            log_error "Deployment verification failed"
            exit 1
        fi
    else
        log_error "Deployment failed"
        exit 1
    fi
}

# Execute with error handling
set -e
main "$@"
```

## Secret Management

### Kubernetes Secrets

```yaml
# k8s/secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: audit-secrets
  namespace: smedrec-audit
type: Opaque
stringData:
  DATABASE_URL: "postgresql://audit_user:secure_password@postgres:5432/audit_prod"
  REDIS_URL: "redis://:redis_password@redis:6379"
  AUTH_SECRET: "ultra-secure-jwt-secret-key"
  ENCRYPTION_KEY: "audit-data-encryption-key"

---
# Service account for audit server
apiVersion: v1
kind: ServiceAccount
metadata:
  name: audit-server
  namespace: smedrec-audit

---
# Role for audit server
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  namespace: smedrec-audit
  name: audit-server
rules:
- apiGroups: [""]
  resources: ["pods", "services"]
  verbs: ["get", "list"]

---
# Role binding
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: audit-server
  namespace: smedrec-audit
subjects:
- kind: ServiceAccount
  name: audit-server
  namespace: smedrec-audit
roleRef:
  kind: Role
  name: audit-server
  apiGroup: rbac.authorization.k8s.io
```

## Configuration Examples

### Production Configuration

```typescript
// config/production.ts
export const productionConfig = {
  server: {
    host: '0.0.0.0',
    port: parseInt(process.env.PORT || '3000'),
    keepAliveTimeout: 65000
  },
  
  database: {
    connectionString: process.env.DATABASE_URL,
    pool: {
      min: 10,
      max: 30,
      acquireTimeoutMillis: 60000,
      idleTimeoutMillis: 30000
    },
    ssl: {
      rejectUnauthorized: true,
      ca: process.env.DB_SSL_CA
    }
  },
  
  security: {
    jwtSecret: process.env.AUTH_SECRET,
    encryptionKey: process.env.ENCRYPTION_KEY,
    sessionTimeout: 3600000, // 1 hour
    maxLoginAttempts: 5
  },
  
  compliance: {
    hipaaMode: true,
    gdprMode: true,
    auditRetention: '7 years',
    dataResidency: 'US',
    encryptionAtRest: true
  },
  
  monitoring: {
    metricsPort: 9090,
    healthCheckInterval: 30000,
    logLevel: 'warn',
    enableTracing: true
  }
}
```

## Best Practices Summary

### Implementation Guidelines

1. **Security First**: Always use HTTPS, proper authentication, and encryption
2. **Zero Downtime**: Implement blue-green or rolling deployments
3. **Health Monitoring**: Comprehensive health checks for all components
4. **Resource Management**: Proper CPU/memory limits and requests
5. **Secret Management**: Use proper secret management systems

### Healthcare-Specific Considerations

1. **Compliance Requirements**: HIPAA/GDPR compliance in all environments
2. **Data Residency**: Ensure PHI stays in appropriate jurisdictions
3. **Audit Continuity**: Maintain audit trails during deployments
4. **Emergency Procedures**: Quick rollback capabilities for critical issues
5. **24/7 Operations**: Design for continuous healthcare service delivery

### Operational Excellence

1. **Automated Deployments**: Use CI/CD pipelines for consistent deployments
2. **Infrastructure as Code**: Version control all deployment configurations
3. **Monitoring Integration**: Comprehensive observability and alerting
4. **Backup Procedures**: Regular backups with tested restoration
5. **Documentation**: Clear runbooks and deployment procedures

## Related Resources

- **[Error Handling](./error-handling.md)** - Production error management
- **[Testing Strategies](./testing-strategies.md)** - Pre-deployment validation
- **[Security Best Practices](./security-best-practices.md)** - Security hardening
- **[Migration Guide](./migration-guide.md)** - Version upgrade strategies

This deployment framework ensures robust, secure, and compliant audit system deployment in healthcare environments while providing operational excellence and disaster recovery capabilities.