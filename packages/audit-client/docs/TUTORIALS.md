# Tutorials

These tutorials provide step-by-step guides for implementing common patterns and achieving specific goals with the Smart Logs Audit Client.

---

## Tutorial 1: Creating a Complete Audit Trail for a Resource

This tutorial walks you through tracking the entire lifecycle of a resource (e.g., a document or a user account) from creation to deletion.

### Step 1: Define Your Actions

First, identify the key actions related to your resource. For a document, these might be:

-   `document.create`
-   `document.read`
-   `document.update`
-   `document.share`
-   `document.delete`

### Step 2: Instrument Your Code

Wrap your application's business logic with `client.events.create()` calls.

**Creating a Document**

```typescript
async function createDocument(user, documentData) {
  // Your logic to save the document to the database
  const newDocument = await db.documents.create(documentData);

  await client.events.create({
    action: 'document.create',
    principalId: user.id,
    organizationId: user.organizationId,
    status: 'success',
    targetResourceType: 'Document',
    targetResourceId: newDocument.id,
    details: { title: newDocument.title },
  });

  return newDocument;
}
```

**Updating a Document**

When updating, you can include the changes in the `details` payload.

```typescript
async function updateDocument(user, docId, updates) {
  const oldDocument = await db.documents.find(docId);
  const updatedDocument = await db.documents.update(docId, updates);

  await client.events.create({
    action: 'document.update',
    principalId: user.id,
    organizationId: user.organizationId,
    status: 'success',
    targetResourceType: 'Document',
    targetResourceId: docId,
    details: {
      from: { title: oldDocument.title },
      to: { title: updatedDocument.title },
    },
  });

  return updatedDocument;
}
```

### Step 3: Query the Audit Trail

To see the full history of a document, query all events where the `targetResourceId` matches the document's ID.

```typescript
async function getDocumentHistory(documentId) {
  const results = await client.events.query({
    filter: {
      targetResourceId: documentId,
    },
    sort: {
      field: 'timestamp',
      direction: 'asc',
    },
  });

  console.log(`History for document ${documentId}:`);
  results.events.forEach(event => {
    console.log(`- ${event.timestamp}: ${event.action} by ${event.principalId} (${event.status})`);
  });

  return results.events;
}
```

---

## Tutorial 2: Building a Custom Monitoring Dashboard

This tutorial shows how to use the `MetricsService` and `HealthService` to build a simple monitoring dashboard for your application.

### Step 1: Set Up a Server Endpoint

Create an API endpoint in your backend application (e.g., using Express.js) that will provide data to your frontend dashboard.

```typescript
// In your Express app
import { AuditClient } from '@smart-logs/audit-client';

const client = new AuditClient({ /* ... */ });

app.get('/api/dashboard-stats', async (req, res) => {
  try {
    const [health, systemMetrics, auditMetrics] = await Promise.all([
      client.health.check(),
      client.metrics.getSystemMetrics(),
      client.metrics.getAuditMetrics({ period: '24h' }),
    ]);

    res.json({
      health,
      systemMetrics,
      auditMetrics,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});
```

### Step 2: Create the Frontend Dashboard

On your frontend (e.g., using React), fetch the data from your new endpoint and display it.

```jsx
// Example React component
import React, { useState, useEffect } from 'react';

function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard-stats')
      .then(res => res.json())
      .then(data => {
        setStats(data);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h1>Monitoring Dashboard</h1>
      <h2>Health Status: {stats.health.status}</h2>
      
      <h3>System Metrics</h3>
      <p>CPU Usage: {stats.systemMetrics.cpu.usage}%</p>
      <p>Memory Usage: {stats.systemMetrics.memory.used} / {stats.systemMetrics.memory.total}</p>

      <h3>Last 24h Audit Metrics</h3>
      <p>Total Events: {stats.auditMetrics.totalEvents}</p>
      <p>Failed Events: {stats.auditMetrics.eventsByStatus.failure || 0}</p>
    </div>
  );
}
```

### Step 3: Add Real-Time Health Updates

For a more advanced dashboard, you can subscribe to real-time health updates via WebSockets.

```typescript
// On the server, set up a WebSocket connection
const healthSubscription = client.health.subscribe({
  transport: 'websocket',
});

healthSubscription.on('message', (healthUpdate) => {
  // Push the update to all connected dashboard clients
  webSocketServer.clients.forEach(client => {
    client.send(JSON.stringify({ type: 'health', data: healthUpdate }));
  });
});

healthSubscription.connect();
```

Your frontend can then listen for these WebSocket messages and update the UI in real-time without needing to poll the server.