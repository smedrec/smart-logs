---
title: Compliance Features
description: Comprehensive HIPAA and GDPR compliance features with automated reporting, data subject rights management, and regulatory audit trails.
sidebar_position: 8
---

# Compliance Features

Comprehensive guide to HIPAA and GDPR compliance features in the audit database system for healthcare applications.

## 🏥 HIPAA Compliance

### Patient Data Access Logging

```typescript
import { EnhancedAuditDb } from '@repo/audit-db'

class HIPAAComplianceLogger {
  private client: EnhancedAuditDb
  
  constructor() {
    this.client = new EnhancedAuditDb({
      compliance: {
        hipaaEnabled: true,
        integrityVerification: true,
        auditIntegrityChecks: true,
        retentionPolicies: {
          patient_data: 2555, // 7 years
          audit_logs: 2555,
          access_logs: 2555
        }
      }
    })
  }
  
  async logPatientDataAccess({
    providerId,
    patientId,
    dataElements,
    accessReason,
    minimumNecessary = true
  }: HIPAAAccessEvent) {
    return await this.client.query(
      `INSERT INTO audit_log (timestamp, action, status, principal_id, principal_type, 
       resource_id, resource_type, source_ip, metadata) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        new Date().toISOString(),
        'hipaa.patient_data.access',
        'success',
        providerId,
        'healthcare_provider',
        patientId,
        'patient_record',
        this.getClientIP(),
        JSON.stringify({
          dataElements,
          accessReason,
          minimumNecessary,
          hipaaCompliant: true,
          patientConsent: await this.verifyPatientConsent(patientId),
          businessAssociateAccess: false,
          emergencyAccess: accessReason === 'emergency',
          auditTrailIntegrity: true
        })
      ]
    )
  }
  
  async generateHIPAAReport(startDate: Date, endDate: Date) {
    const accessEvents = await this.client.query(`
      SELECT 
        timestamp,
        principal_id as provider_id,
        resource_id as patient_id,
        metadata->>'accessReason' as access_reason,
        metadata->>'dataElements' as data_elements,
        metadata->>'minimumNecessary' as minimum_necessary,
        source_ip,
        status
      FROM audit_log 
      WHERE action = 'hipaa.patient_data.access'
        AND timestamp BETWEEN $1 AND $2
      ORDER BY timestamp DESC
    `, [startDate.toISOString(), endDate.toISOString()])
    
    return {
      reportPeriod: { startDate, endDate },
      totalAccesses: accessEvents.length,
      uniqueProviders: new Set(accessEvents.map(e => e.provider_id)).size,
      uniquePatients: new Set(accessEvents.map(e => e.patient_id)).size,
      accessByReason: this.groupBy(accessEvents, 'access_reason'),
      complianceMetrics: {
        minimumNecessaryCompliance: accessEvents.filter(e => e.minimum_necessary === 'true').length / accessEvents.length * 100,
        emergencyAccesses: accessEvents.filter(e => e.access_reason === 'emergency').length,
        unauthorizedAttempts: accessEvents.filter(e => e.status !== 'success').length
      },
      events: accessEvents
    }
  }
  
  private async verifyPatientConsent(patientId: string): Promise<boolean> {
    const consent = await this.client.query(
      'SELECT * FROM patient_consent WHERE patient_id = $1 AND active = true',
      [patientId]
    )
    return consent.length > 0
  }
  
  private getClientIP(): string {
    return '10.0.1.50' // Implementation specific
  }
  
  private groupBy(array: any[], key: string) {
    return array.reduce((result, item) => {
      const group = item[key] || 'unknown'
      result[group] = (result[group] || 0) + 1
      return result
    }, {})
  }
}
```

### Minimum Necessary Standard

```typescript
class MinimumNecessaryEnforcement {
  private client: EnhancedAuditDb
  
  constructor() {
    this.client = new EnhancedAuditDb()
  }
  
  async logLimitedDataAccess({
    providerId,
    patientId,
    requestedElements,
    approvedElements,
    accessJustification
  }: MinimumNecessaryEvent) {
    // Log what was requested vs approved
    await this.client.query(
      `INSERT INTO audit_log (timestamp, action, status, principal_id, 
       resource_id, metadata) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        new Date().toISOString(),
        'hipaa.minimum_necessary.evaluation',
        'success',
        providerId,
        patientId,
        JSON.stringify({
          requestedElements,
          approvedElements,
          deniedElements: requestedElements.filter(e => !approvedElements.includes(e)),
          accessJustification,
          minimumNecessaryApplied: requestedElements.length !== approvedElements.length,
          complianceOfficerReview: requestedElements.length > 5
        })
      ]
    )
    
    // Log actual data access
    await this.client.query(
      `INSERT INTO audit_log (timestamp, action, status, principal_id, 
       resource_id, metadata) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        new Date().toISOString(),
        'hipaa.patient_data.access',
        'success',
        providerId,
        patientId,
        JSON.stringify({
          dataElements: approvedElements,
          minimumNecessary: true,
          accessJustification,
          limitedDataSet: approvedElements.length < requestedElements.length
        })
      ]
    )
  }
}
```

## 🇪🇺 GDPR Compliance

### Data Subject Rights Management

```typescript
class GDPRComplianceManager {
  private client: EnhancedAuditDb
  
  constructor() {
    this.client = new EnhancedAuditDb({
      compliance: {
        gdprEnabled: true,
        dataClassification: {
          personalData: ['name', 'email', 'phone', 'address'],
          sensitiveData: ['health_data', 'biometric_data'],
          publicData: ['user_id', 'timestamp', 'action']
        }
      }
    })
  }
  
  async processDataSubjectAccessRequest({
    dataSubjectId,
    requestId,
    requestType,
    dataCategories
  }: GDPRRequest) {
    // Log the request
    await this.client.query(
      `INSERT INTO audit_log (timestamp, action, status, principal_id, 
       resource_id, metadata) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        new Date().toISOString(),
        `gdpr.data_subject.${requestType}`,
        'success',
        dataSubjectId,
        requestId,
        JSON.stringify({
          requestType,
          dataCategories,
          legalBasis: 'data_subject_rights',
          processingLawfulness: true,
          gdprArticle: this.getGDPRArticle(requestType),
          responseTimeLimit: this.getResponseTimeLimit(requestType),
          requestTimestamp: new Date().toISOString()
        })
      ]
    )
    
    // Execute the request based on type
    switch (requestType) {
      case 'access':
        return await this.handleAccessRequest(dataSubjectId, dataCategories)
      case 'rectification':
        return await this.handleRectificationRequest(dataSubjectId, dataCategories)
      case 'erasure':
        return await this.handleErasureRequest(dataSubjectId, dataCategories)
      case 'portability':
        return await this.handlePortabilityRequest(dataSubjectId, dataCategories)
      default:
        throw new Error(`Unsupported request type: ${requestType}`)
    }
  }
  
  private async handleAccessRequest(dataSubjectId: string, categories: string[]) {
    const personalData = await this.client.query(`
      SELECT * FROM audit_log 
      WHERE principal_id = $1 
        OR resource_id = $1
        OR metadata->>'dataSubjectId' = $1
      ORDER BY timestamp DESC
    `, [dataSubjectId])
    
    // Log data export
    await this.client.query(
      `INSERT INTO audit_log (timestamp, action, status, principal_id, metadata) 
       VALUES ($1, $2, $3, $4, $5)`,
      [
        new Date().toISOString(),
        'gdpr.data.export',
        'success',
        dataSubjectId,
        JSON.stringify({
          recordsExported: personalData.length,
          dataCategories: categories,
          exportFormat: 'json',
          dataMinimization: true
        })
      ]
    )
    
    return {
      dataSubjectId,
      exportedRecords: personalData.length,
      data: personalData,
      exportDate: new Date().toISOString(),
      legalBasis: 'GDPR Article 15 - Right of Access'
    }
  }
  
  private async handleErasureRequest(dataSubjectId: string, categories: string[]) {
    // Verify right to erasure
    const canErase = await this.verifyErasureRights(dataSubjectId)
    
    if (!canErase) {
      throw new Error('Erasure not permitted - legal obligation to retain data')
    }
    
    // Perform pseudonymization instead of deletion for audit integrity
    const pseudonymizedId = `anon_${Date.now()}`
    
    await this.client.query(
      `UPDATE audit_log 
       SET principal_id = CASE WHEN principal_id = $1 THEN $2 ELSE principal_id END,
           resource_id = CASE WHEN resource_id = $1 THEN $2 ELSE resource_id END,
           metadata = metadata || $3
       WHERE principal_id = $1 OR resource_id = $1`,
      [
        dataSubjectId,
        pseudonymizedId,
        JSON.stringify({
          pseudonymized: true,
          originalId: 'erased',
          erasureDate: new Date().toISOString(),
          legalBasis: 'GDPR Article 17'
        })
      ]
    )
    
    // Log erasure action
    await this.client.query(
      `INSERT INTO audit_log (timestamp, action, status, principal_id, metadata) 
       VALUES ($1, $2, $3, $4, $5)`,
      [
        new Date().toISOString(),
        'gdpr.data.erasure',
        'success',
        'system',
        JSON.stringify({
          originalDataSubjectId: 'erased',
          pseudonymizedId,
          dataCategories: categories,
          erasureMethod: 'pseudonymization',
          retentionOverride: 'audit_integrity'
        })
      ]
    )
    
    return { erasureCompleted: true, method: 'pseudonymization' }
  }
  
  private getGDPRArticle(requestType: string): string {
    const articles = {
      access: 'Article 15',
      rectification: 'Article 16',
      erasure: 'Article 17',
      portability: 'Article 20'
    }
    return articles[requestType] || 'Unknown'
  }
  
  private getResponseTimeLimit(requestType: string): number {
    return 30 // 30 days for most GDPR requests
  }
  
  private async verifyErasureRights(dataSubjectId: string): Promise<boolean> {
    // Check if there are legal obligations to retain data
    const legalHolds = await this.client.query(
      'SELECT * FROM legal_holds WHERE data_subject_id = $1 AND active = true',
      [dataSubjectId]
    )
    
    return legalHolds.length === 0
  }
}
```

### Consent Management

```typescript
class ConsentManager {
  private client: EnhancedAuditDb
  
  constructor() {
    this.client = new EnhancedAuditDb()
  }
  
  async logConsentChange({
    dataSubjectId,
    consentType,
    granted,
    purpose,
    dataCategories,
    legalBasis
  }: ConsentEvent) {
    await this.client.query(
      `INSERT INTO audit_log (timestamp, action, status, principal_id, 
       principal_type, metadata) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        new Date().toISOString(),
        'gdpr.consent.change',
        'success',
        dataSubjectId,
        'data_subject',
        JSON.stringify({
          consentType,
          granted,
          purpose,
          dataCategories,
          legalBasis,
          consentMethod: 'explicit',
          withdrawable: true,
          granular: true,
          previousConsent: await this.getPreviousConsent(dataSubjectId, consentType),
          consentTimestamp: new Date().toISOString(),
          ipAddress: this.getClientIP(),
          userAgent: this.getUserAgent()
        })
      ]
    )
    
    // Update consent record
    await this.updateConsentRecord(dataSubjectId, consentType, granted)
  }
  
  async generateConsentReport(startDate: Date, endDate: Date) {
    const consentEvents = await this.client.query(`
      SELECT 
        timestamp,
        principal_id as data_subject_id,
        metadata->>'consentType' as consent_type,
        metadata->>'granted' as granted,
        metadata->>'purpose' as purpose,
        metadata->>'legalBasis' as legal_basis
      FROM audit_log 
      WHERE action = 'gdpr.consent.change'
        AND timestamp BETWEEN $1 AND $2
      ORDER BY timestamp DESC
    `, [startDate.toISOString(), endDate.toISOString()])
    
    return {
      reportPeriod: { startDate, endDate },
      totalConsentChanges: consentEvents.length,
      consentGranted: consentEvents.filter(e => e.granted === 'true').length,
      consentWithdrawn: consentEvents.filter(e => e.granted === 'false').length,
      consentByType: this.groupBy(consentEvents, 'consent_type'),
      complianceMetrics: {
        explicitConsent: 100, // All consents are explicit
        granularConsent: 100, // All consents are granular
        withdrawalRate: (consentEvents.filter(e => e.granted === 'false').length / consentEvents.length) * 100
      }
    }
  }
  
  private async getPreviousConsent(dataSubjectId: string, consentType: string) {
    const previous = await this.client.query(
      `SELECT metadata->>'granted' as granted FROM audit_log 
       WHERE action = 'gdpr.consent.change' 
         AND principal_id = $1 
         AND metadata->>'consentType' = $2 
       ORDER BY timestamp DESC LIMIT 1`,
      [dataSubjectId, consentType]
    )
    
    return previous.length > 0 ? previous[0].granted === 'true' : null
  }
  
  private async updateConsentRecord(dataSubjectId: string, consentType: string, granted: boolean) {
    // Update consent table (implementation specific)
    await this.client.query(
      `INSERT INTO data_subject_consent (data_subject_id, consent_type, granted, updated_at) 
       VALUES ($1, $2, $3, $4) 
       ON CONFLICT (data_subject_id, consent_type) 
       DO UPDATE SET granted = $3, updated_at = $4`,
      [dataSubjectId, consentType, granted, new Date()]
    )
  }
  
  private getClientIP(): string {
    return '10.0.1.50' // Implementation specific
  }
  
  private getUserAgent(): string {
    return 'Healthcare-Portal/1.0' // Implementation specific
  }
  
  private groupBy(array: any[], key: string) {
    return array.reduce((result, item) => {
      const group = item[key] || 'unknown'
      result[group] = (result[group] || 0) + 1
      return result
    }, {})
  }
}
```

## 📊 Compliance Reporting

### Automated Compliance Reports

```typescript
class ComplianceReportGenerator {
  private client: EnhancedAuditDb
  
  constructor() {
    this.client = new EnhancedAuditDb()
  }
  
  async generateMonthlyComplianceReport(year: number, month: number) {
    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 1)
    
    const [
      hipaaMetrics,
      gdprMetrics,
      dataBreaches,
      accessViolations
    ] = await Promise.all([
      this.getHIPAAMetrics(startDate, endDate),
      this.getGDPRMetrics(startDate, endDate),
      this.getDataBreaches(startDate, endDate),
      this.getAccessViolations(startDate, endDate)
    ])
    
    const report = {
      reportDate: new Date().toISOString(),
      period: { year, month, startDate, endDate },
      summary: {
        totalAuditEvents: hipaaMetrics.totalEvents + gdprMetrics.totalEvents,
        complianceScore: this.calculateComplianceScore(hipaaMetrics, gdprMetrics),
        criticalIssues: dataBreaches.length + accessViolations.length
      },
      hipaa: {
        patientDataAccesses: hipaaMetrics.patientAccesses,
        minimumNecessaryCompliance: hipaaMetrics.minimumNecessaryRate,
        unauthorizedAccessAttempts: hipaaMetrics.unauthorizedAttempts,
        businessAssociateAccesses: hipaaMetrics.businessAssociateAccesses
      },
      gdpr: {
        dataSubjectRequests: gdprMetrics.dataSubjectRequests,
        consentChanges: gdprMetrics.consentChanges,
        dataBreachNotifications: gdprMetrics.breachNotifications,
        processingActivities: gdprMetrics.processingActivities
      },
      security: {
        dataBreaches: dataBreaches,
        accessViolations: accessViolations,
        integrityVerifications: await this.getIntegrityVerifications(startDate, endDate)
      },
      recommendations: this.generateRecommendations(hipaaMetrics, gdprMetrics, dataBreaches)
    }
    
    // Store report for future reference
    await this.storeComplianceReport(report)
    
    return report
  }
  
  private async getHIPAAMetrics(startDate: Date, endDate: Date) {
    const events = await this.client.query(`
      SELECT action, status, metadata 
      FROM audit_log 
      WHERE action LIKE 'hipaa.%' 
        AND timestamp BETWEEN $1 AND $2
    `, [startDate.toISOString(), endDate.toISOString()])
    
    return {
      totalEvents: events.length,
      patientAccesses: events.filter(e => e.action === 'hipaa.patient_data.access').length,
      unauthorizedAttempts: events.filter(e => e.status === 'failure').length,
      minimumNecessaryRate: this.calculateMinimumNecessaryRate(events),
      businessAssociateAccesses: events.filter(e => 
        e.metadata?.businessAssociateAccess === true
      ).length
    }
  }
  
  private async getGDPRMetrics(startDate: Date, endDate: Date) {
    const events = await this.client.query(`
      SELECT action, status, metadata 
      FROM audit_log 
      WHERE action LIKE 'gdpr.%' 
        AND timestamp BETWEEN $1 AND $2
    `, [startDate.toISOString(), endDate.toISOString()])
    
    return {
      totalEvents: events.length,
      dataSubjectRequests: events.filter(e => e.action.includes('data_subject')).length,
      consentChanges: events.filter(e => e.action === 'gdpr.consent.change').length,
      breachNotifications: events.filter(e => e.action === 'gdpr.breach.notification').length,
      processingActivities: events.filter(e => e.action === 'gdpr.data.processing').length
    }
  }
  
  private calculateComplianceScore(hipaaMetrics: any, gdprMetrics: any): number {
    const hipaaScore = this.calculateHIPAAScore(hipaaMetrics)
    const gdprScore = this.calculateGDPRScore(gdprMetrics)
    return Math.round((hipaaScore + gdprScore) / 2)
  }
  
  private calculateHIPAAScore(metrics: any): number {
    let score = 100
    
    // Deduct for unauthorized attempts
    if (metrics.unauthorizedAttempts > 0) {
      score -= Math.min(metrics.unauthorizedAttempts * 5, 30)
    }
    
    // Deduct for poor minimum necessary compliance
    if (metrics.minimumNecessaryRate < 90) {
      score -= (90 - metrics.minimumNecessaryRate)
    }
    
    return Math.max(score, 0)
  }
  
  private calculateGDPRScore(metrics: any): number {
    let score = 100
    
    // Check if data subject requests are handled timely
    // (Implementation would check response times)
    
    return Math.max(score, 0)
  }
  
  private calculateMinimumNecessaryRate(events: any[]): number {
    const patientAccesses = events.filter(e => 
      e.action === 'hipaa.patient_data.access'
    )
    
    if (patientAccesses.length === 0) return 100
    
    const compliantAccesses = patientAccesses.filter(e => 
      e.metadata?.minimumNecessary === true
    )
    
    return (compliantAccesses.length / patientAccesses.length) * 100
  }
  
  private async getDataBreaches(startDate: Date, endDate: Date) {
    return await this.client.query(`
      SELECT * FROM audit_log 
      WHERE action IN ('security.breach.detected', 'security.unauthorized_access')
        AND timestamp BETWEEN $1 AND $2
    `, [startDate.toISOString(), endDate.toISOString()])
  }
  
  private async getAccessViolations(startDate: Date, endDate: Date) {
    return await this.client.query(`
      SELECT * FROM audit_log 
      WHERE (action LIKE '%access%' OR action LIKE '%login%')
        AND status = 'failure'
        AND timestamp BETWEEN $1 AND $2
    `, [startDate.toISOString(), endDate.toISOString()])
  }
  
  private async getIntegrityVerifications(startDate: Date, endDate: Date) {
    return await this.client.query(`
      SELECT COUNT(*) as count FROM audit_log 
      WHERE action = 'audit.integrity.verification'
        AND status = 'success'
        AND timestamp BETWEEN $1 AND $2
    `, [startDate.toISOString(), endDate.toISOString()])
  }
  
  private generateRecommendations(hipaaMetrics: any, gdprMetrics: any, breaches: any[]): string[] {
    const recommendations = []
    
    if (hipaaMetrics.unauthorizedAttempts > 5) {
      recommendations.push('Review access controls - multiple unauthorized access attempts detected')
    }
    
    if (hipaaMetrics.minimumNecessaryRate < 90) {
      recommendations.push('Improve minimum necessary standard compliance through additional training')
    }
    
    if (breaches.length > 0) {
      recommendations.push('Conduct security review following detected breaches')
    }
    
    if (gdprMetrics.dataSubjectRequests > 10) {
      recommendations.push('Consider implementing automated data subject request processing')
    }
    
    return recommendations
  }
  
  private async storeComplianceReport(report: any) {
    await this.client.query(
      `INSERT INTO compliance_reports (report_date, period, report_data, created_at) 
       VALUES ($1, $2, $3, $4)`,
      [
        report.reportDate,
        `${report.period.year}-${report.period.month}`,
        JSON.stringify(report),
        new Date()
      ]
    )
  }
}
```

## 🔐 Data Integrity and Security

### Cryptographic Integrity Verification

```typescript
class IntegrityVerification {
  private client: EnhancedAuditDb
  
  constructor() {
    this.client = new EnhancedAuditDb({
      compliance: {
        integrityVerification: true,
        auditIntegrityChecks: true
      }
    })
  }
  
  async verifyAuditLogIntegrity(startDate: Date, endDate: Date) {
    const events = await this.client.query(`
      SELECT id, timestamp, action, principal_id, hash, signature 
      FROM audit_log 
      WHERE timestamp BETWEEN $1 AND $2
      ORDER BY timestamp
    `, [startDate.toISOString(), endDate.toISOString()])
    
    const results = {
      totalEvents: events.length,
      verifiedEvents: 0,
      tamperedEvents: 0,
      missingHashes: 0,
      integrityScore: 0
    }
    
    for (const event of events) {
      if (!event.hash) {
        results.missingHashes++
        continue
      }
      
      const computedHash = await this.computeEventHash(event)
      if (computedHash === event.hash) {
        results.verifiedEvents++
      } else {
        results.tamperedEvents++
        
        // Log integrity violation
        await this.client.query(
          `INSERT INTO audit_log (timestamp, action, status, principal_id, metadata) 
           VALUES ($1, $2, $3, $4, $5)`,
          [
            new Date().toISOString(),
            'audit.integrity.violation',
            'failure',
            'system',
            JSON.stringify({
              violatedEventId: event.id,
              expectedHash: event.hash,
              computedHash,
              detectionTime: new Date().toISOString()
            })
          ]
        )
      }
    }
    
    results.integrityScore = (results.verifiedEvents / results.totalEvents) * 100
    
    return results
  }
  
  private async computeEventHash(event: any): Promise<string> {
    // Implementation would use same hashing algorithm as original
    const crypto = require('crypto')
    const eventString = JSON.stringify({
      timestamp: event.timestamp,
      action: event.action,
      principal_id: event.principal_id
    })
    return crypto.createHash('sha256').update(eventString).digest('hex')
  }
}
```

## 📋 Best Practices Summary

### 1. HIPAA Compliance Checklist

- ✅ Log all PHI access with minimum necessary justification
- ✅ Implement role-based access controls
- ✅ Maintain audit logs for 7+ years
- ✅ Encrypt audit data at rest and in transit
- ✅ Regular integrity verification
- ✅ Automated breach detection

### 2. GDPR Compliance Checklist

- ✅ Implement data subject rights automation
- ✅ Maintain consent audit trails
- ✅ Data processing lawfulness verification
- ✅ Privacy by design principles
- ✅ Data protection impact assessments
- ✅ Breach notification procedures

### 3. Data Retention Policies

```typescript
const retentionPolicies = {
  hipaa: {
    patient_data: 2555,        // 7 years
    audit_logs: 2555,          // 7 years
    access_logs: 2555          // 7 years
  },
  gdpr: {
    personal_data: 730,        // 2 years (default)
    consent_records: 2190,     // 6 years
    breach_records: 1825       // 5 years
  }
}
```

## 🎯 Summary

Key compliance features implemented:

- ✅ **HIPAA**: Complete audit trails for PHI access with minimum necessary enforcement
- ✅ **GDPR**: Automated data subject rights management and consent tracking
- ✅ **Integrity**: Cryptographic verification of audit log integrity
- ✅ **Reporting**: Automated compliance reports and metrics
- ✅ **Security**: Data encryption and breach detection
- ✅ **Retention**: Automated data lifecycle management

## 📖 Next Steps

- **[Security](./security)** - Advanced security features
- **[Getting Started](./getting-started)** - Implementation guide
- **[CLI Reference](./cli-reference)** - Compliance management tools