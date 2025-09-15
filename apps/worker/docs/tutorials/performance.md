# Performance Tuning Tutorial

This tutorial covers comprehensive performance optimization strategies for the Smart Logs Audit Worker, including high-throughput scenarios, resource optimization, scaling strategies, and load testing.

## Table of Contents

1. [Performance Architecture Overview](#performance-architecture-overview)
2. [Benchmarking and Profiling](#benchmarking-and-profiling)
3. [High-Throughput Configuration](#high-throughput-configuration)
4. [Database Performance Optimization](#database-performance-optimization)
5. [Redis and Queue Optimization](#redis-and-queue-optimization)
6. [Memory Management](#memory-management)
7. [CPU and Threading Optimization](#cpu-and-threading-optimization)
8. [Network and I/O Optimization](#network-and-io-optimization)
9. [Load Testing Strategies](#load-testing-strategies)
10. [Scaling Strategies](#scaling-strategies)

## Performance Architecture Overview

The audit worker is designed for high-performance event processing with multiple optimization layers:

### Performance Stack

```typescript
interface PerformanceStack {
  eventProcessor: {
    batchProcessing: boolean;
    concurrencyControl: number;
    circuitBreaker: CircuitBreakerConfig;
  };
  dataLayer: {
    connectionPooling: PoolConfig;
    queryOptimization: boolean;
    partitioning: PartitionConfig;
  };
  cacheLayer: {
    redis: RedisConfig;
    inmemory: CacheConfig;
  };
  monitoring: {
    realTimeMetrics: boolean;
    profiling: ProfilingConfig;
  };
}
```

### Performance Goals

| Metric | Target | High Performance |
|--------|---------|------------------|
| Event Processing | 1,000 events/sec | 10,000 events/sec |
| Latency (P95) | < 100ms | < 50ms |
| Memory Usage | < 512MB | < 1GB |
| CPU Usage | < 50% | < 75% |
| Error Rate | < 0.1% | < 0.01% |

## Benchmarking and Profiling

### Built-in Performance Monitoring

Enable comprehensive performance tracking:

```json
{
  "monitoring": {
    "performance": {
      "enabled": true,
      "profiling": {
        "enabled": true,
        "cpu": true,
        "memory": true,
        "io": true,
        "gc": true
      },
      "benchmarking": {
        "enabled": true,
        "interval": "15m",
        "scenarios": [
          "baseline_load",
          "peak_load", 
          "error_conditions",
          "memory_pressure",
          "high_concurrency"
        ]
      },
      "realTimeMetrics": {
        "enabled": true,
        "granularity": "1s",
        "retention": "1h"
      }
    }
  }
}
```

### Performance Profiling Endpoints

```bash
# CPU profiling (30 seconds)
curl "http://worker:3001/observability/profiling/cpu?duration=30s" > cpu-profile.json

# Memory heap analysis
curl "http://worker:3001/observability/profiling/memory" > memory-profile.json

# Performance bottlenecks
curl "http://worker:3001/observability/bottlenecks?timeframe=1h" > bottlenecks.json

# Real-time performance dashboard
curl "http://worker:3001/observability/performance-dashboard"
```

### Baseline Performance Benchmarking

```typescript
// Built-in benchmarking scenarios
interface BenchmarkScenario {
  name: string;
  duration: string;
  eventsPerSecond: number;
  concurrency: number;
  errorRate: number;
}

const benchmarkScenarios: BenchmarkScenario[] = [
  {
    name: "baseline",
    duration: "5m",
    eventsPerSecond: 100,
    concurrency: 5,
    errorRate: 0
  },
  {
    name: "peak_load",
    duration: "10m", 
    eventsPerSecond: 5000,
    concurrency: 50,
    errorRate: 0.001
  },
  {
    name: "stress_test",
    duration: "30m",
    eventsPerSecond: 10000,
    concurrency: 100,
    errorRate: 0.01
  }
];
```

### Performance Metrics Collection

Key metrics to monitor:

```typescript
interface PerformanceMetrics {
  throughput: {
    eventsPerSecond: number;
    peakThroughput: number;
    sustainedThroughput: number;
  };
  latency: {
    p50: number;
    p95: number;
    p99: number;
    max: number;
  };
  resources: {
    cpuUsage: number;
    memoryUsage: number;
    memoryAllocated: number;
    gcPressure: number;
  };
  errors: {
    errorRate: number;
    timeoutRate: number;
    circuitBreakerTrips: number;
  };
  queue: {
    depth: number;
    waitTime: number;
    processingTime: number;
  };
}
```

## High-Throughput Configuration

### Event Processing Optimization

Configure for maximum throughput:

```json
{
  "reliableProcessor": {
    "concurrency": 100,
    "maxStalledCount": 1,
    "batchProcessing": {
      "enabled": true,
      "batchSize": 500,
      "maxBatchWaitMs": 1000,
      "parallelBatches": 20,
      "batchCompressionEnabled": true
    },
    "queueOptimization": {
      "prefetch": 1000,
      "removeOnComplete": 100,
      "removeOnFail": 50,
      "jobDataCompression": true
    },
    "retryConfig": {
      "maxRetries": 2,
      "baseDelay": 500,
      "maxDelay": 5000,
      "backoffStrategy": "exponential",
      "jitter": true
    },
    "circuitBreakerConfig": {
      "failureThreshold": 5,
      "recoveryTimeout": 30000,
      "monitoringPeriod": 10000,
      "minimumThroughput": 100
    }
  }
}
```

### Memory-Optimized Processing

Minimize memory footprint during high throughput:

```json
{
  "reliableProcessor": {
    "memoryOptimization": {
      "enabled": true,
      "maxJobsInMemory": 1000,
      "jobDataSizeLimit": "1MB",
      "streamProcessing": true,
      "lazyEvaluation": true,
      "objectPooling": true
    },
    "garbageCollection": {
      "strategy": "aggressive",
      "gcHints": true,
      "memoryPressureThreshold": 0.8
    }
  }
}
```

### CPU-Optimized Processing

Maximize CPU utilization:

```json
{
  "reliableProcessor": {
    "cpuOptimization": {
      "enabled": true,
      "workerThreads": "auto", // CPU cores * 2
      "taskDistribution": "round-robin",
      "cpuAffinity": false,
      "vectorization": true
    },
    "algorithmOptimization": {
      "hashingStrategy": "xxhash",
      "compressionAlgorithm": "lz4",
      "serializationFormat": "msgpack"
    }
  }
}
```

## Database Performance Optimization

### Connection Pool Tuning

Optimize database connections for high throughput:

```json
{
  "enhancedClient": {
    "maxConnections": 200,
    "minConnections": 50,
    "acquireTimeoutMillis": 5000,
    "idleTimeoutMillis": 30000,
    "connectionLifetimeMaxMs": 1800000,
    "validation": {
      "enabled": true,
      "query": "SELECT 1",
      "interval": 30000
    },
    "poolOptimization": {
      "fair": false,
      "fifo": true,
      "priorityQueuing": true
    }
  }
}
```

### Query Performance Optimization

```json
{
  "enhancedClient": {
    "queryOptimization": {
      "enabled": true,
      "preparedStatements": true,
      "statementCaching": {
        "enabled": true,
        "maxSize": 1000,
        "ttl": 3600000
      },
      "batchOperations": {
        "enabled": true,
        "maxBatchSize": 1000,
        "batchTimeout": 5000
      }
    },
    "indexOptimization": {
      "automaticIndexCreation": true,
      "indexAnalysis": true,
      "indexRecommendations": true
    }
  }
}
```

### Database Partitioning for Performance

```json
{
  "enhancedClient": {
    "partitioning": {
      "enabled": true,
      "strategy": "hash", // or "range" or "list"
      "partitionKey": "timestamp",
      "partitionCount": 12,
      "compressionEnabled": true,
      "compressionAfterDays": 7,
      "parallelOperations": {
        "enabled": true,
        "maxParallelPartitions": 4,
        "partitionAwareQueries": true
      },
      "maintenance": {
        "automaticMaintenance": true,
        "maintenanceWindow": "02:00-04:00",
        "statisticsUpdate": true,
        "indexRebuild": true
      }
    }
  }
}
```

### Read Replica Optimization

```json
{
  "enhancedClient": {
    "readReplicas": [
      "replica-1.db.internal:5432",
      "replica-2.db.internal:5432",
      "replica-3.db.internal:5432"
    ],
    "readReplicaConfig": {
      "loadBalancing": "weighted",
      "weights": [40, 30, 30],
      "healthCheck": {
        "enabled": true,
        "interval": 5000,
        "timeout": 2000,
        "failureThreshold": 3
      },
      "lagTolerance": 1000,
      "automaticFailover": true,
      "queryRouting": {
        "readQueries": "replica",
        "writeQueries": "primary",
        "consistencyLevel": "eventual"
      }
    }
  }
}
```

## Redis and Queue Optimization

### Redis Performance Configuration

```json
{
  "redis": {
    "host": "redis-cluster.internal",
    "port": 6379,
    "connectionOptimization": {
      "maxRetriesPerRequest": 2,
      "retryDelayOnFailover": 50,
      "connectTimeout": 2000,
      "commandTimeout": 1000,
      "lazyConnect": true,
      "keepAlive": 30000
    },
    "pipelining": {
      "enabled": true,
      "batchSize": 100,
      "flushInterval": 10
    },
    "cluster": {
      "enabled": true,
      "enableReadyCheck": false,
      "maxRetriesPerRequest": 2,
      "slotsRefreshTimeout": 2000,
      "slotsRefreshInterval": 5000
    },
    "memoryOptimization": {
      "keyCompression": true,
      "valueCompression": true,
      "compressionThreshold": 1024,
      "serialization": "msgpack"
    }
  }
}
```

### Queue Performance Tuning

```json
{
  "reliableProcessor": {
    "queueName": "audit-events",
    "queueOptimization": {
      "defaultJobOptions": {
        "removeOnComplete": 100,
        "removeOnFail": 50,
        "jobId": "auto-generated"
      },
      "advanced": {
        "maxStalledCount": 1,
        "stalledInterval": 30000,
        "delayedDebounce": 1000
      }
    },
    "priorityQueues": {
      "enabled": true,
      "queues": [
        {
          "name": "audit-events-critical",
          "priority": 1,
          "concurrency": 50
        },
        {
          "name": "audit-events-high", 
          "priority": 5,
          "concurrency": 30
        },
        {
          "name": "audit-events-normal",
          "priority": 10,
          "concurrency": 20
        }
      ]
    }
  }
}
```

### Queue Monitoring and Auto-scaling

```json
{
  "reliableProcessor": {
    "autoScaling": {
      "enabled": true,
      "strategy": "queue-depth",
      "thresholds": {
        "scaleUp": 1000,
        "scaleDown": 100,
        "maxConcurrency": 200,
        "minConcurrency": 10
      },
      "scaling": {
        "scaleUpBy": 10,
        "scaleDownBy": 5,
        "cooldownPeriod": 60000
      }
    },
    "adaptiveProcessing": {
      "enabled": true,
      "algorithms": ["queue-depth", "processing-time", "error-rate"],
      "adjustmentInterval": 30000
    }
  }
}
```

## Memory Management

### Heap Optimization

Configure Node.js heap and garbage collection:

```bash
# Environment variables for Node.js optimization
export NODE_OPTIONS="--max-old-space-size=4096 --max-new-space-size=2048"
export NODE_OPTIONS="$NODE_OPTIONS --optimize-for-size"
export NODE_OPTIONS="$NODE_OPTIONS --gc-interval=100"

# V8 GC tuning
export NODE_OPTIONS="$NODE_OPTIONS --expose-gc"
export NODE_OPTIONS="$NODE_OPTIONS --trace-gc"
```

### Application Memory Management

```json
{
  "memoryManagement": {
    "enabled": true,
    "heapMonitoring": {
      "enabled": true,
      "threshold": 0.85,
      "gcForcing": true,
      "memoryLeakDetection": true
    },
    "objectPooling": {
      "enabled": true,
      "poolSizes": {
        "events": 10000,
        "connections": 100,
        "buffers": 1000
      }
    },
    "caching": {
      "inMemoryCache": {
        "enabled": true,
        "maxSize": "256MB",
        "ttl": 300000,
        "algorithm": "lru"
      },
      "compressionCache": {
        "enabled": true,
        "compressionRatio": 0.7,
        "algorithm": "gzip"
      }
    }
  }
}
```

### Memory Leak Detection

```typescript
// Built-in memory leak detection
interface MemoryLeakDetector {
  enabled: boolean;
  checkInterval: number;
  heapGrowthThreshold: number;
  leakThreshold: number;
  automaticGC: boolean;
  reporting: {
    enabled: boolean;
    alertThreshold: number;
  };
}

// Configuration
{
  "memoryManagement": {
    "leakDetection": {
      "enabled": true,
      "checkInterval": 60000,
      "heapGrowthThreshold": 0.1,
      "leakThreshold": 0.05,
      "automaticGC": true,
      "reporting": {
        "enabled": true,
        "alertThreshold": 0.03
      }
    }
  }
}
```

## CPU and Threading Optimization

### Worker Thread Configuration

```json
{
  "threading": {
    "enabled": true,
    "workerThreads": {
      "count": "auto", // CPU cores * 2
      "maxWorkers": 32,
      "minWorkers": 4,
      "idleTimeout": 60000
    },
    "taskDistribution": {
      "strategy": "round-robin", // "least-loaded", "random"
      "loadBalancing": true,
      "affinityEnabled": false
    },
    "threadPoolOptimization": {
      "queueSize": 1000,
      "preallocation": true,
      "dynamicAdjustment": true
    }
  }
}
```

### Event Loop Optimization

```json
{
  "eventLoop": {
    "monitoring": {
      "enabled": true,
      "lagThreshold": 10,
      "blockingDetection": true
    },
    "optimization": {
      "setImmediateThrottling": true,
      "processNextTickDepth": 1000,
      "timerCoalescing": true
    }
  }
}
```

### CPU-Intensive Task Optimization

```typescript
// CPU optimization strategies
interface CPUOptimization {
  vectorization: boolean;
  simdOperations: boolean;
  parallelProcessing: boolean;
  algorithmOptimization: {
    hashingStrategy: 'xxhash' | 'sha256' | 'md5';
    compressionAlgorithm: 'lz4' | 'gzip' | 'zstd';
    serializationFormat: 'json' | 'msgpack' | 'protobuf';
  };
}

// Configuration
{
  "cpuOptimization": {
    "vectorization": true,
    "simdOperations": true,
    "parallelProcessing": true,
    "algorithmOptimization": {
      "hashingStrategy": "xxhash",
      "compressionAlgorithm": "lz4", 
      "serializationFormat": "msgpack"
    }
  }
}
```

## Network and I/O Optimization

### Network Configuration

```json
{
  "network": {
    "tcpOptimization": {
      "tcpNoDelay": true,
      "keepAlive": true,
      "keepAliveInitialDelay": 0
    },
    "httpOptimization": {
      "keepAliveTimeout": 65000,
      "headersTimeout": 66000,
      "maxConnections": 10000,
      "maxRequestsPerSocket": 1000
    },
    "compression": {
      "enabled": true,
      "algorithm": "gzip",
      "level": 6,
      "threshold": 1024
    }
  }
}
```

### I/O Optimization

```json
{
  "ioOptimization": {
    "fileSystem": {
      "bufferSize": 65536,
      "readAhead": true,
      "writeBuffering": true,
      "fsync": false
    },
    "logging": {
      "asyncLogging": true,
      "bufferSize": 1048576,
      "flushInterval": 5000,
      "compression": true
    }
  }
}
```

## Load Testing Strategies

### Built-in Load Testing

The worker includes comprehensive load testing capabilities:

```bash
# Start load test
curl -X POST "http://worker:3001/testing/load-test" \
  -H "Content-Type: application/json" \
  -d '{
    "scenario": "high_throughput",
    "duration": "10m",
    "eventsPerSecond": 5000,
    "rampUp": "2m",
    "rampDown": "1m"
  }'

# Monitor load test progress
curl "http://worker:3001/testing/load-test/status"

# Get load test results
curl "http://worker:3001/testing/load-test/results"
```

### Load Test Scenarios

```typescript
interface LoadTestScenario {
  name: string;
  description: string;
  duration: string;
  targetTPS: number;
  rampUp: string;
  rampDown: string;
  errorThreshold: number;
  latencyThreshold: number;
}

const loadTestScenarios: LoadTestScenario[] = [
  {
    name: "baseline",
    description: "Baseline performance test",
    duration: "5m",
    targetTPS: 1000,
    rampUp: "1m",
    rampDown: "30s",
    errorThreshold: 0.01,
    latencyThreshold: 100
  },
  {
    name: "peak_load",
    description: "Peak load simulation",
    duration: "15m",
    targetTPS: 10000,
    rampUp: "5m",
    rampDown: "2m", 
    errorThreshold: 0.05,
    latencyThreshold: 500
  },
  {
    name: "endurance",
    description: "Long-running endurance test",
    duration: "2h",
    targetTPS: 2000,
    rampUp: "10m",
    rampDown: "10m",
    errorThreshold: 0.01,
    latencyThreshold: 200
  },
  {
    name: "spike",
    description: "Sudden traffic spike test",
    duration: "30m",
    targetTPS: 50000,
    rampUp: "30s",
    rampDown: "5m",
    errorThreshold: 0.1,
    latencyThreshold: 1000
  }
];
```

### External Load Testing Tools

#### Artillery Configuration

```yaml
# artillery-config.yml
config:
  target: 'http://worker:3001'
  phases:
    - duration: 300  # 5 minutes ramp up
      arrivalRate: 1
      rampTo: 100
    - duration: 600  # 10 minutes sustained
      arrivalRate: 100
    - duration: 300  # 5 minutes ramp down
      arrivalRate: 100
      rampTo: 1
  defaults:
    headers:
      Content-Type: 'application/json'

scenarios:
  - name: "Event Processing Test"
    weight: 80
    flow:
      - post:
          url: "/events"
          json:
            timestamp: "2024-01-15T10:30:00.000Z"
            principalId: "{{ $randomString() }}"
            action: "test.action"
            status: "success"
            
  - name: "Health Check Test"
    weight: 20
    flow:
      - get:
          url: "/healthz"
```

Run Artillery test:

```bash
# Install Artillery
npm install -g artillery

# Run load test
artillery run artillery-config.yml

# Generate report
artillery run artillery-config.yml --output results.json
artillery report results.json
```

#### K6 Load Testing

```javascript
// k6-load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '5m', target: 100 },   // Ramp up
    { duration: '10m', target: 1000 }, // Peak load
    { duration: '5m', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
    http_req_failed: ['rate<0.01'],   // Error rate under 1%
  },
};

export default function() {
  const payload = JSON.stringify({
    timestamp: new Date().toISOString(),
    principalId: `user_${Math.random().toString(36).substr(2, 9)}`,
    action: 'test.load_test',
    status: 'success',
    correlationId: `corr_${Math.random().toString(36).substr(2, 9)}`
  });

  const params = {
    headers: { 'Content-Type': 'application/json' },
  };

  const response = http.post('http://worker:3001/events', payload, params);
  
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);
}
```

Run K6 test:

```bash
# Install K6
# Download from https://k6.io/docs/getting-started/installation/

# Run load test
k6 run k6-load-test.js

# Run with custom configuration
k6 run --vus 500 --duration 30m k6-load-test.js
```

## Scaling Strategies

### Horizontal Scaling

#### Kubernetes Auto-scaling

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: audit-worker
spec:
  replicas: 3
  selector:
    matchLabels:
      app: audit-worker
  template:
    metadata:
      labels:
        app: audit-worker
    spec:
      containers:
      - name: worker
        image: audit-worker:latest
        resources:
          requests:
            cpu: 500m
            memory: 512Mi
          limits:
            cpu: 2000m
            memory: 2Gi
        env:
        - name: CONFIG_PATH
          value: "s3://config-bucket/worker/config.json"

---
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
  maxReplicas: 100
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
  - type: Pods
    pods:
      metric:
        name: queue_depth
      target:
        type: AverageValue
        averageValue: "1000"

---
apiVersion: autoscaling/v2
kind: VerticalPodAutoscaler
metadata:
  name: audit-worker-vpa
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: audit-worker
  updatePolicy:
    updateMode: "Auto"
  resourcePolicy:
    containerPolicies:
    - containerName: worker
      maxAllowed:
        cpu: 4000m
        memory: 8Gi
      minAllowed:
        cpu: 100m
        memory: 128Mi
```

### Vertical Scaling

#### Resource Optimization by Load

```json
{
  "scaling": {
    "verticalScaling": {
      "enabled": true,
      "strategies": {
        "cpu": {
          "scaleUpThreshold": 0.8,
          "scaleDownThreshold": 0.3,
          "maxCores": 8,
          "minCores": 1
        },
        "memory": {
          "scaleUpThreshold": 0.85,
          "scaleDownThreshold": 0.4,
          "maxMemory": "8GB",
          "minMemory": "512MB"
        }
      },
      "adaptiveConfiguration": {
        "enabled": true,
        "adjustmentInterval": "5m",
        "algorithms": ["load-based", "predictive", "reactive"]
      }
    }
  }
}
```

### Database Scaling

#### Read Replica Scaling

```json
{
  "enhancedClient": {
    "scaling": {
      "readReplicas": {
        "autoScaling": {
          "enabled": true,
          "minReplicas": 2,
          "maxReplicas": 10,
          "scaleUpThreshold": 0.8,
          "scaleDownThreshold": 0.3
        },
        "loadDistribution": {
          "strategy": "least-connections",
          "healthCheckInterval": 5000,
          "circuitBreaker": true
        }
      }
    }
  }
}
```

### Performance Monitoring During Scaling

```typescript
// Scaling performance metrics
interface ScalingMetrics {
  horizontalScaling: {
    currentReplicas: number;
    targetReplicas: number;
    scaleEvents: ScaleEvent[];
    scalingLatency: number;
  };
  verticalScaling: {
    currentResources: ResourceAllocation;
    targetResources: ResourceAllocation;
    scalingHistory: ResourceChange[];
  };
  performance: {
    throughputPerReplica: number;
    latencyDistribution: LatencyMetrics;
    resourceUtilization: ResourceMetrics;
  };
}
```

### Cost-Performance Optimization

```json
{
  "costOptimization": {
    "enabled": true,
    "strategies": {
      "spotInstances": {
        "enabled": true,
        "maxSpotPercentage": 0.7,
        "fallbackStrategy": "on-demand"
      },
      "scheduledScaling": {
        "enabled": true,
        "schedule": [
          {
            "time": "09:00",
            "replicas": 10,
            "timezone": "UTC"
          },
          {
            "time": "18:00", 
            "replicas": 3,
            "timezone": "UTC"
          }
        ]
      },
      "performanceBasedScaling": {
        "enabled": true,
        "costPerformanceRatio": 0.8,
        "targetCostPerEvent": 0.001
      }
    }
  }
}
```

---

## Performance Optimization Checklist

### Configuration Optimization
- [ ] Enable batch processing with optimal batch sizes
- [ ] Configure appropriate concurrency levels
- [ ] Optimize database connection pool settings
- [ ] Enable Redis pipelining and clustering
- [ ] Configure memory management and GC optimization

### Database Optimization
- [ ] Implement partitioning for large datasets
- [ ] Configure read replicas for read-heavy workloads
- [ ] Optimize indexes and query performance
- [ ] Enable connection pooling with proper sizing
- [ ] Monitor slow queries and optimize them

### Infrastructure Optimization
- [ ] Set up horizontal pod autoscaling
- [ ] Configure vertical pod autoscaling
- [ ] Implement proper resource limits and requests
- [ ] Use appropriate instance types for workload
- [ ] Configure load balancing and traffic distribution

### Monitoring and Testing
- [ ] Set up comprehensive performance monitoring
- [ ] Implement regular load testing
- [ ] Monitor key performance indicators (KPIs)
- [ ] Set up alerting for performance degradation
- [ ] Regular performance reviews and optimization

---

## Next Steps

- **[Configuration Tutorial](configuration.md)** - Advanced configuration options
- **[Monitoring Tutorial](monitoring.md)** - Comprehensive monitoring setup  
- **[Troubleshooting Guide](../troubleshooting.md)** - Performance issue resolution

For performance templates and benchmarking tools, see the `performance-templates/` directory in the repository.