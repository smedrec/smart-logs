# Troubleshooting Guide

This comprehensive guide covers common issues, debugging techniques, log analysis, performance problems, and recovery procedures for the Smart Logs Audit Worker.

## Table of Contents

1. [Quick Diagnostic Tools](#quick-diagnostic-tools)
2. [Configuration Issues](#configuration-issues)
3. [Database Connection Problems](#database-connection-problems)
4. [Redis and Queue Issues](#redis-and-queue-issues)
5. [Performance Problems](#performance-problems)
6. [Memory Issues](#memory-issues)
7. [Network and Connectivity](#network-and-connectivity)
8. [Security and Compliance Issues](#security-and-compliance-issues)
9. [Monitoring and Observability](#monitoring-and-observability)
10. [Recovery Procedures](#recovery-procedures)

## Quick Diagnostic Tools

### Built-in Health Checks

The worker provides comprehensive health checking endpoints:

```bash
# Overall system health
curl http://worker:3001/healthz

# Component-specific health checks
curl http://worker:3001/health/database
curl http://worker:3001/health/redis
curl http://worker:3001/health/queue
curl http://worker:3001/health/circuit-breaker
curl http://worker:3001/health/configuration

# Detailed health information
curl http://worker:3001/health/detailed
```

Expected healthy response:
```json
{
  "status": "OK",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600,
  "version": "2.1.0",
  "components": {
    "database": {
      "status": "OK",
      "connections": 45,
      "responseTime": 12
    },
    "redis": {
      "status": "OK",
      "connected": true,
      "responseTime": 3
    },
    "queue": {
      "status": "OK",
      "depth": 150,
      "processing": true
    }
  }
}
```

### System Information

```bash
# System metrics and resource usage
curl http://worker:3001/observability/system-info

# Performance dashboard
curl http://worker:3001/observability/dashboard

# Configuration status
curl http://worker:3001/observability/configuration-status
```

### Log Analysis Tools

```bash
# Application logs (JSON format)
docker logs audit-worker | jq '.'

# Filter by log level
docker logs audit-worker | jq 'select(.level == "error")'

# Filter by component
docker logs audit-worker | jq 'select(.component == "database")'

# Recent errors
docker logs --since 1h audit-worker | jq 'select(.level == "error")'
```

## Configuration Issues

### Problem: Configuration Loading Fails

**Symptoms:**
- Worker fails to start
- "Configuration loading failed" errors
- S3 access denied errors

**Common Causes & Solutions:**

#### 1. S3 Access Issues

```bash
# Check AWS credentials
aws sts get-caller-identity

# Verify S3 bucket access
aws s3 ls s3://your-config-bucket/

# Test configuration file access
aws s3 cp s3://your-config-bucket/worker/config.json /tmp/test-config.json
```

**Solution:**
```bash
# Verify IAM permissions
aws iam get-user-policy --user-name audit-worker-user --policy-name S3ConfigAccess

# Required S3 permissions:
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:GetObjectVersion"
      ],
      "Resource": "arn:aws:s3:::your-config-bucket/worker/*"
    }
  ]
}
```

#### 2. Invalid JSON Configuration

```bash
# Validate JSON syntax
aws s3 cp s3://your-config-bucket/worker/config.json - | jq .

# Common JSON errors:
# - Missing commas
# - Trailing commas
# - Unescaped quotes
# - Invalid Unicode characters
```

**Solution:**
```bash
# Use a JSON validator
cat config.json | jq .

# Fix common issues:
# Remove trailing commas
sed -i 's/,\s*}/}/g' config.json
sed -i 's/,\s*]/]/g' config.json

# Validate and prettify
jq . config.json > config-fixed.json
```

#### 3. Environment Variable Substitution

**Problem:** Variables like `${DB_PASSWORD}` not being substituted

```bash
# Check if environment variables are set
echo $DB_PASSWORD
echo $REDIS_PASSWORD

# Verify in container
docker exec audit-worker env | grep -E "(DB_|REDIS_)"
```

**Solution:**
```bash
# Ensure environment variables are exported
export DB_PASSWORD="your-secure-password"
export REDIS_PASSWORD="redis-password"

# For Docker/Kubernetes, ensure variables are passed
docker run -e DB_PASSWORD="$DB_PASSWORD" audit-worker

# Kubernetes secret example
kubectl create secret generic audit-worker-secrets \
  --from-literal=db-password="$DB_PASSWORD" \
  --from-literal=redis-password="$REDIS_PASSWORD"
```

### Problem: Configuration Hot Reload Not Working

**Symptoms:**
- Configuration changes not picked up
- "Configuration reload failed" logs
- Old configuration still in use

**Debugging Steps:**

```bash
# Check configuration watch status
curl http://worker:3001/observability/configuration-status

# Verify S3 object modification time
aws s3api head-object --bucket your-config-bucket --key worker/config.json

# Check worker logs for reload events
docker logs audit-worker | grep -i "configuration"
```

**Solution:**
```json
{
  "configurationManager": {
    "watchEnabled": true,
    "watchInterval": 30000,
    "reloadTimeout": 60000,
    "validationEnabled": true
  }
}
```

## Database Connection Problems

### Problem: Connection Pool Exhaustion

**Symptoms:**
- "Unable to acquire connection" errors
- High database connection count
- Slow database responses

**Debugging:**

```bash
# Check connection pool status
curl http://worker:3001/health/database | jq '.connectionPool'

# Database connection monitoring
psql -h db-host -U audit_user -d audit_db -c "
  SELECT count(*) as active_connections, 
         state 
  FROM pg_stat_activity 
  WHERE datname = 'audit_db' 
  GROUP BY state;
"
```

**Solutions:**

1. **Increase Pool Size:**
```json
{
  "enhancedClient": {
    "maxConnections": 100,
    "acquireTimeoutMillis": 30000,
    "idleTimeoutMillis": 60000
  }
}
```

2. **Connection Leak Detection:**
```bash
# Enable connection monitoring
{
  "enhancedClient": {
    "monitoring": {
      "enabled": true,
      "connectionLeakDetection": true,
      "leakThreshold": 300000
    }
  }
}
```

### Problem: Database Query Timeouts

**Symptoms:**
- "Query timeout" errors
- Slow query warnings
- Database performance degradation

**Debugging:**

```bash
# Check slow queries
psql -h db-host -U audit_user -d audit_db -c "
  SELECT query, calls, total_time, mean_time 
  FROM pg_stat_statements 
  WHERE mean_time > 1000 
  ORDER BY mean_time DESC 
  LIMIT 10;
"

# Check database locks
psql -h db-host -U audit_user -d audit_db -c "
  SELECT blocked_locks.pid AS blocked_pid,
         blocking_locks.pid AS blocking_pid,
         blocked_activity.query AS blocked_query
  FROM pg_catalog.pg_locks blocked_locks
  JOIN pg_catalog.pg_stat_activity blocked_activity 
    ON blocked_activity.pid = blocked_locks.pid
  JOIN pg_catalog.pg_locks blocking_locks 
    ON blocking_locks.locktype = blocked_locks.locktype
  WHERE NOT blocked_locks.granted;
"
```

**Solutions:**

1. **Query Optimization:**
```sql
-- Add missing indexes
CREATE INDEX CONCURRENTLY idx_audit_logs_timestamp 
  ON audit_logs (timestamp);
CREATE INDEX CONCURRENTLY idx_audit_logs_principal_id 
  ON audit_logs (principal_id);

-- Update table statistics
ANALYZE audit_logs;
```

2. **Configuration Tuning:**
```json
{
  "enhancedClient": {
    "queryTimeout": 30000,
    "statementTimeout": 60000,
    "monitoring": {
      "slowQueryThreshold": 1000,
      "queryLogging": true
    }
  }
}
```

### Problem: Database Connection Refused

**Symptoms:**
- "Connection refused" errors
- "Host unreachable" messages
- Database health check failures

**Debugging:**

```bash
# Test direct connection
psql -h db-host -p 5432 -U audit_user -d audit_db -c "SELECT 1"

# Check network connectivity
telnet db-host 5432
nc -zv db-host 5432

# Verify DNS resolution
nslookup db-host
dig db-host

# Check PostgreSQL status
sudo systemctl status postgresql
# or
docker ps | grep postgres
```

**Solutions:**

1. **Network Configuration:**
```bash
# Check PostgreSQL configuration
# /etc/postgresql/14/main/postgresql.conf
listen_addresses = '*'
port = 5432

# /etc/postgresql/14/main/pg_hba.conf
host audit_db audit_user 0.0.0.0/0 md5
```

2. **Firewall Rules:**
```bash
# Allow PostgreSQL port
sudo ufw allow 5432/tcp
# or for specific host
sudo ufw allow from worker-host to any port 5432
```

## Redis and Queue Issues

### Problem: Redis Connection Failures

**Symptoms:**
- "Redis connection failed" errors
- Queue processing stops
- Event backlog accumulation

**Debugging:**

```bash
# Test Redis connectivity
redis-cli -h redis-host -p 6379 ping

# Check Redis status
redis-cli -h redis-host -p 6379 INFO server

# Monitor Redis connections
redis-cli -h redis-host -p 6379 CLIENT LIST

# Check Redis memory usage
redis-cli -h redis-host -p 6379 INFO memory
```

**Solutions:**

1. **Connection Configuration:**
```json
{
  "redis": {
    "host": "redis-host",
    "port": 6379,
    "password": "${REDIS_PASSWORD}",
    "connectTimeout": 10000,
    "commandTimeout": 5000,
    "retryDelayOnFailover": 100,
    "maxRetriesPerRequest": 3
  }
}
```

2. **Redis Cluster Issues:**
```bash
# Check cluster status
redis-cli -h redis-host -p 6379 CLUSTER INFO
redis-cli -h redis-host -p 6379 CLUSTER NODES

# Fix cluster configuration
{
  "redis": {
    "cluster": {
      "enabled": true,
      "enableReadyCheck": true,
      "slotsRefreshTimeout": 10000,
      "slotsRefreshInterval": 5000
    }
  }
}
```

### Problem: Queue Processing Stalled

**Symptoms:**
- Events not being processed
- Queue depth continuously growing
- Worker appears idle

**Debugging:**

```bash
# Check queue status
curl http://worker:3001/health/queue

# Monitor queue depth
redis-cli -h redis-host -p 6379 LLEN audit-events

# Check for stalled jobs
redis-cli -h redis-host -p 6379 ZRANGE "bull:audit-events:stalled" 0 -1

# Monitor worker activity
curl http://worker:3001/observability/metrics | grep queue
```

**Solutions:**

1. **Restart Stalled Workers:**
```bash
# Clean stalled jobs
curl -X POST http://worker:3001/admin/queue/clean-stalled

# Or via Redis CLI
redis-cli -h redis-host -p 6379 DEL "bull:audit-events:stalled"
```

2. **Adjust Queue Configuration:**
```json
{
  "reliableProcessor": {
    "maxStalledCount": 1,
    "stalledInterval": 30000,
    "concurrency": 20
  }
}
```

### Problem: Dead Letter Queue Overflow

**Symptoms:**
- High number of failed jobs
- Dead letter queue growing
- Processing errors not being handled

**Debugging:**

```bash
# Check dead letter queue
redis-cli -h redis-host -p 6379 LLEN audit-events-failed

# Examine failed job details
curl http://worker:3001/admin/queue/failed-jobs

# Check error patterns
docker logs audit-worker | grep -E "(failed|error)" | tail -50
```

**Solutions:**

1. **Process Failed Jobs:**
```bash
# Retry failed jobs
curl -X POST http://worker:3001/admin/queue/retry-failed

# Clear permanently failed jobs
curl -X POST http://worker:3001/admin/queue/clear-failed
```

2. **Improve Error Handling:**
```json
{
  "reliableProcessor": {
    "retryConfig": {
      "maxRetries": 5,
      "baseDelay": 2000,
      "backoffStrategy": "exponential"
    },
    "deadLetterConfig": {
      "alertThreshold": 100,
      "retentionDays": 30
    }
  }
}
```

## Performance Problems

### Problem: High Processing Latency

**Symptoms:**
- Slow event processing
- High response times
- Growing queue backlog

**Debugging:**

```bash
# Check processing metrics
curl http://worker:3001/observability/metrics | grep -E "(latency|duration)"

# Monitor system resources
top -p $(pgrep -f audit-worker)
htop

# Check database performance
curl http://worker:3001/health/database | jq '.queryMetrics'
```

**Performance Analysis:**

```bash
# Generate performance report
curl "http://worker:3001/observability/performance-report?timeframe=1h" > perf-report.json

# Identify bottlenecks
curl http://worker:3001/observability/bottlenecks | jq '.bottlenecks[] | select(.severity > 0.7)'

# CPU profiling
curl "http://worker:3001/observability/profiling/cpu?duration=30s" > cpu-profile.json
```

**Solutions:**

1. **Optimize Configuration:**
```json
{
  "reliableProcessor": {
    "concurrency": 50,
    "batchProcessing": {
      "enabled": true,
      "batchSize": 500,
      "maxBatchWaitMs": 1000
    }
  },
  "enhancedClient": {
    "maxConnections": 100
  }
}
```

2. **Database Optimization:**
```sql
-- Add performance indexes
CREATE INDEX CONCURRENTLY idx_audit_logs_performance 
  ON audit_logs (timestamp, principal_id) 
  WHERE status = 'success';

-- Partition large tables
CREATE TABLE audit_logs_2024_01 PARTITION OF audit_logs 
  FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

### Problem: High CPU Usage

**Symptoms:**
- CPU usage consistently > 80%
- System responsiveness degraded
- Thermal throttling

**Debugging:**

```bash
# CPU usage breakdown
top -H -p $(pgrep -f audit-worker)

# CPU profiling
curl "http://worker:3001/observability/profiling/cpu?duration=60s" > cpu-profile.json

# Event loop lag monitoring
curl http://worker:3001/observability/event-loop-lag
```

**Solutions:**

1. **Optimize CPU-Intensive Operations:**
```json
{
  "cpuOptimization": {
    "hashingStrategy": "xxhash",
    "compressionAlgorithm": "lz4",
    "serializationFormat": "msgpack"
  }
}
```

2. **Scale Horizontally:**
```bash
# Kubernetes horizontal scaling
kubectl scale deployment audit-worker --replicas=5

# Or configure auto-scaling
kubectl apply -f - <<EOF
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: audit-worker-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: audit-worker
  minReplicas: 3
  maxReplicas: 20
  targetCPUUtilizationPercentage: 70
EOF
```

## Memory Issues

### Problem: Memory Leaks

**Symptoms:**
- Steadily increasing memory usage
- Out of memory errors
- Performance degradation over time

**Debugging:**

```bash
# Memory usage monitoring
curl http://worker:3001/observability/profiling/memory

# Heap analysis
curl "http://worker:3001/observability/heap-snapshot" > heap-snapshot.heapsnapshot

# Check for memory leaks
docker stats audit-worker

# Node.js specific debugging
export NODE_OPTIONS="--inspect=0.0.0.0:9229"
# Then use Chrome DevTools or clinic.js
```

**Solutions:**

1. **Memory Leak Detection:**
```json
{
  "memoryManagement": {
    "leakDetection": {
      "enabled": true,
      "checkInterval": 60000,
      "heapGrowthThreshold": 0.1
    },
    "automaticGC": {
      "enabled": true,
      "threshold": 0.85
    }
  }
}
```

2. **Optimize Memory Usage:**
```bash
# Node.js memory optimization
export NODE_OPTIONS="--max-old-space-size=2048 --optimize-for-size"

# Enable garbage collection logging
export NODE_OPTIONS="$NODE_OPTIONS --trace-gc"
```

### Problem: Out of Memory Errors

**Symptoms:**
- "JavaScript heap out of memory" errors
- Worker process crashes
- Container restarts

**Immediate Actions:**

```bash
# Increase memory limits
docker run --memory=4g audit-worker

# Kubernetes memory limits
kubectl patch deployment audit-worker -p '{"spec":{"template":{"spec":{"containers":[{"name":"worker","resources":{"limits":{"memory":"4Gi"}}}]}}}}'
```

**Long-term Solutions:**

1. **Memory Configuration:**
```json
{
  "memoryManagement": {
    "heapSize": "2048MB",
    "objectPooling": {
      "enabled": true,
      "poolSizes": {
        "events": 10000,
        "connections": 100
      }
    }
  }
}
```

2. **Batch Processing:**
```json
{
  "reliableProcessor": {
    "batchProcessing": {
      "enabled": true,
      "batchSize": 100,
      "memoryAware": true
    }
  }
}
```

## Network and Connectivity

### Problem: Intermittent Network Failures

**Symptoms:**
- Sporadic connection timeouts
- "Network unreachable" errors
- Inconsistent service availability

**Debugging:**

```bash
# Network connectivity tests
ping db-host
traceroute db-host
mtr --report db-host

# DNS resolution issues
nslookup db-host
dig +trace db-host

# Check network interfaces
ip addr show
netstat -i
```

**Solutions:**

1. **Retry Configuration:**
```json
{
  "network": {
    "retryPolicy": {
      "maxRetries": 3,
      "baseDelay": 1000,
      "maxDelay": 10000,
      "backoffStrategy": "exponential"
    },
    "timeouts": {
      "connection": 10000,
      "request": 30000
    }
  }
}
```

2. **Health Check Configuration:**
```json
{
  "monitoring": {
    "healthChecks": {
      "enabled": true,
      "interval": 30000,
      "timeout": 10000,
      "retries": 3
    }
  }
}
```

### Problem: SSL/TLS Certificate Issues

**Symptoms:**
- "Certificate verification failed" errors
- SSL handshake failures
- Connection refused with HTTPS endpoints

**Debugging:**

```bash
# Test SSL connection
openssl s_client -connect db-host:5432 -servername db-host

# Check certificate validity
echo | openssl s_client -connect db-host:5432 2>/dev/null | openssl x509 -noout -dates

# Verify certificate chain
curl -v https://api-host:443
```

**Solutions:**

1. **Certificate Configuration:**
```json
{
  "enhancedClient": {
    "ssl": {
      "rejectUnauthorized": true,
      "ca": "/path/to/ca-cert.pem",
      "cert": "/path/to/client-cert.pem",
      "key": "/path/to/client-key.pem"
    }
  }
}
```

2. **Development/Testing:**
```json
{
  "enhancedClient": {
    "ssl": {
      "rejectUnauthorized": false
    }
  }
}
```

## Security and Compliance Issues

### Problem: Encryption Key Rotation Failures

**Symptoms:**
- "Key rotation failed" errors
- Data encryption/decryption failures
- Compliance alerts triggered

**Debugging:**

```bash
# Check encryption status
curl http://worker:3001/observability/encryption-status

# Verify key rotation configuration
curl http://worker:3001/observability/key-rotation-status

# Check encryption key availability
# (Never log actual keys, only verify they exist)
```

**Solutions:**

1. **Manual Key Rotation:**
```bash
# Trigger manual key rotation
curl -X POST http://worker:3001/admin/security/rotate-keys \
  -H "Content-Type: application/json" \
  -d '{"force": false}'
```

2. **Key Rotation Configuration:**
```json
{
  "security": {
    "keyRotation": {
      "enabled": true,
      "rotationIntervalDays": 30,
      "gracePeriodDays": 7,
      "automaticRotation": true
    }
  }
}
```

### Problem: Audit Trail Integrity Violations

**Symptoms:**
- "Audit trail tampering detected" alerts
- Hash verification failures
- Compliance violations reported

**Debugging:**

```bash
# Check audit trail integrity
curl http://worker:3001/audit/integrity-check

# Verify recent audit entries
curl "http://worker:3001/audit/verify?since=1h"

# Check for corruption patterns
curl http://worker:3001/audit/corruption-analysis
```

**Recovery Procedures:**

1. **Integrity Verification:**
```bash
# Full integrity check
curl -X POST http://worker:3001/admin/audit/full-integrity-check

# Rebuild integrity hashes
curl -X POST http://worker:3001/admin/audit/rebuild-integrity \
  -H "Content-Type: application/json" \
  -d '{"timeframe": "24h", "verify": true}'
```

2. **Backup Restoration:**
```bash
# Restore from backup if corruption detected
# This is environment-specific, but typically:
kubectl create job audit-restore --from=cronjob/audit-backup
```

## Monitoring and Observability

### Problem: Metrics Not Available

**Symptoms:**
- Empty Grafana dashboards
- Missing Prometheus metrics
- Health endpoints returning errors

**Debugging:**

```bash
# Check metrics endpoint
curl http://worker:3001/metrics
curl http://worker:3001/observability/metrics/enhanced

# Verify Prometheus scraping
curl http://prometheus:9090/api/v1/targets | jq '.data.activeTargets[] | select(.labels.job == "audit-worker")'

# Check service discovery
kubectl get endpoints audit-worker
```

**Solutions:**

1. **Enable Metrics:**
```json
{
  "monitoring": {
    "enabled": true,
    "prometheus": {
      "enabled": true,
      "path": "/metrics"
    },
    "detailedMetrics": true
  }
}
```

2. **Prometheus Configuration:**
```yaml
- job_name: 'audit-worker'
  static_configs:
    - targets: ['worker:3001']
  metrics_path: '/metrics'
  scrape_interval: 30s
```

### Problem: High Cardinality Metrics

**Symptoms:**
- Prometheus high memory usage
- Slow metric queries
- "Too many time series" warnings

**Solutions:**

1. **Reduce Metric Cardinality:**
```json
{
  "monitoring": {
    "metricFiltering": {
      "enabled": true,
      "excludePatterns": [".*_bucket", ".*_sum", ".*_count"],
      "maxCardinality": 10000
    }
  }
}
```

2. **Metric Aggregation:**
```json
{
  "monitoring": {
    "aggregation": {
      "enabled": true,
      "interval": 60000,
      "retention": "24h"
    }
  }
}
```

## Recovery Procedures

### Emergency Shutdown

```bash
# Graceful shutdown
curl -X POST http://worker:3001/admin/shutdown

# Force shutdown (use with caution)
docker stop audit-worker
kubectl delete pod -l app=audit-worker --grace-period=0 --force
```

### Data Recovery

#### Database Recovery

```bash
# Point-in-time recovery
pg_restore --host=db-host --username=audit_user --dbname=audit_db \
  --clean --if-exists backup-file.sql

# Verify data integrity after recovery
psql -h db-host -U audit_user -d audit_db -c "
  SELECT COUNT(*) FROM audit_logs 
  WHERE timestamp > NOW() - INTERVAL '24 hours';
"
```

#### Queue Recovery

```bash
# Clear corrupted queue state
redis-cli -h redis-host -p 6379 DEL "bull:audit-events:*"

# Restart queue processing
curl -X POST http://worker:3001/admin/queue/restart
```

### Configuration Recovery

```bash
# Restore from backup
aws s3 cp s3://backup-bucket/config-backup-$(date +%Y%m%d).json \
          s3://config-bucket/worker/config.json

# Validate configuration
curl http://worker:3001/admin/config/validate

# Trigger configuration reload
curl -X POST http://worker:3001/admin/config/reload
```

### Service Recovery Checklist

1. **Immediate Assessment**
   - [ ] Check service health endpoints
   - [ ] Verify database connectivity
   - [ ] Confirm Redis/queue status
   - [ ] Review recent logs

2. **Resource Verification**
   - [ ] Check CPU and memory usage
   - [ ] Verify disk space availability
   - [ ] Confirm network connectivity
   - [ ] Validate SSL certificates

3. **Data Integrity**
   - [ ] Run audit trail integrity check
   - [ ] Verify recent event processing
   - [ ] Check for data corruption
   - [ ] Confirm backup availability

4. **Recovery Actions**
   - [ ] Restore from backup if needed
   - [ ] Clear corrupted state
   - [ ] Restart failed components
   - [ ] Validate full system operation

5. **Post-Recovery**
   - [ ] Update monitoring alerts
   - [ ] Document incident details
   - [ ] Review and improve procedures
   - [ ] Test disaster recovery plan

---

## Support and Resources

### Emergency Contacts

- **Production Issues**: [ops-team@company.com](mailto:ops-team@company.com)
- **Security Incidents**: [security@company.com](mailto:security@company.com)
- **Compliance Issues**: [compliance@company.com](mailto:compliance@company.com)

### Useful Commands Reference

```bash
# Health checks
curl http://worker:3001/healthz
curl http://worker:3001/health/detailed

# Performance monitoring  
curl http://worker:3001/observability/dashboard
curl http://worker:3001/observability/metrics

# Administrative actions
curl -X POST http://worker:3001/admin/config/reload
curl -X POST http://worker:3001/admin/queue/clean-stalled

# Debugging
docker logs audit-worker | tail -100
kubectl logs -f deployment/audit-worker
kubectl describe pod -l app=audit-worker
```

### Log Analysis Patterns

```bash
# Common error patterns
grep -E "(ERROR|FATAL|failed|timeout|refused)" /var/log/audit-worker.log

# Performance issues
grep -E "(slow|latency|timeout|queue depth)" /var/log/audit-worker.log

# Security events
grep -E "(unauthorized|forbidden|authentication|encryption)" /var/log/audit-worker.log

# Configuration issues
grep -E "(configuration|config|reload|validation)" /var/log/audit-worker.log
```

For additional troubleshooting resources, see:
- **[Configuration Tutorial](tutorials/configuration.md)** - Configuration best practices
- **[Performance Guide](tutorials/performance.md)** - Performance optimization
- **[Monitoring Setup](tutorials/monitoring.md)** - Comprehensive monitoring