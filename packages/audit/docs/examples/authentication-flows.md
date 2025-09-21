# Authentication Flows

This document provides comprehensive examples of implementing audit logging for authentication and authorization workflows using the `@repo/audit` package. These examples demonstrate healthcare-specific security patterns, enterprise authentication integration, and regulatory compliance for access control systems.

## 📚 Table of Contents

- [Single Sign-On Integration](#single-sign-on-integration)
- [Multi-Factor Authentication](#multi-factor-authentication) 
- [Session Management](#session-management)
- [Role-Based Access Control](#role-based-access-control)
- [Emergency Access Procedures](#emergency-access-procedures)
- [Security Event Correlation](#security-event-correlation)
- [Healthcare-Specific Auth Patterns](#healthcare-specific-auth-patterns)
- [Performance Optimization](#performance-optimization)
- [Testing Strategies](#testing-strategies)

## 🔑 Single Sign-On Integration

### SAML Authentication Flow

```typescript
import { Audit, AuditConfig } from '@repo/audit'

class SAMLAuthenticationService {
  constructor(private auditService: Audit, private samlProvider: SAMLProvider) {}

  async authenticateWithSAML(samlToken: string, sessionContext: SessionContext) {
    const startTime = Date.now()
    const correlationId = `saml-auth-${Date.now()}`
    
    try {
      // Validate SAML token
      const tokenValidation = await this.samlProvider.validateToken(samlToken)
      
      if (!tokenValidation.isValid) {
        await this.auditService.log({
          principalId: tokenValidation.userId || 'unknown',
          action: 'auth.saml.failed',
          status: 'failure',
          sessionContext,
          correlationId,
          complianceContext: {
            regulation: 'HIPAA',
            dataClassification: 'Authentication',
            failureReason: 'Invalid SAML token'
          },
          details: {
            tokenIssuer: tokenValidation.issuer,
            validationErrors: tokenValidation.errors,
            ipAddress: sessionContext.ipAddress
          },
          processingLatency: Date.now() - startTime
        })
        
        throw new Error('SAML authentication failed')
      }

      // Extract user information and create session
      const userInfo = await this.extractUserInfo(tokenValidation.assertion)
      const authResult = await this.checkHealthcareAuthorization(userInfo)
      const session = await this.createUserSession(userInfo, sessionContext)
      
      // Log successful authentication
      await this.auditService.log({
        principalId: userInfo.userId,
        action: 'auth.saml.success',
        status: 'success',
        sessionContext: { ...sessionContext, sessionId: session.sessionId },
        correlationId,
        complianceContext: {
          regulation: 'HIPAA',
          dataClassification: 'Authentication',
          authenticationMethod: 'SAML SSO',
          strongAuthentication: true
        },
        details: {
          userId: userInfo.userId,
          userRole: userInfo.role,
          organizationId: userInfo.organizationId,
          samlIssuer: tokenValidation.issuer,
          sessionDuration: session.duration,
          accessLevel: authResult.accessLevel,
          licenseNumber: userInfo.licenseNumber
        },
        processingLatency: Date.now() - startTime
      })

      return { user: userInfo, session, accessToken: session.accessToken }
      
    } catch (error) {
      await this.auditService.log({
        principalId: 'unknown',
        action: 'auth.saml.error',
        status: 'failure',
        sessionContext,
        correlationId,
        details: { error: error.message },
        processingLatency: Date.now() - startTime
      })
      throw error
    }
  }
}
```

### OIDC Authentication Flow

```typescript
class OIDCAuthenticationService {
  constructor(private auditService: Audit, private oidcProvider: OIDCProvider) {}

  async authenticateWithOIDC(authorizationCode: string, sessionContext: SessionContext) {
    const correlationId = `oidc-auth-${Date.now()}`
    const startTime = Date.now()
    
    try {
      // Exchange code for tokens and validate
      const tokenResponse = await this.oidcProvider.exchangeCodeForTokens(authorizationCode)
      const idTokenValidation = await this.oidcProvider.validateIdToken(tokenResponse.id_token)
      
      if (!idTokenValidation.isValid) {
        await this.auditService.log({
          principalId: 'unknown',
          action: 'auth.oidc.token_validation_failed',
          status: 'failure',
          sessionContext,
          correlationId,
          details: { validationErrors: idTokenValidation.errors },
          processingLatency: Date.now() - startTime
        })
        throw new Error('ID token validation failed')
      }

      // Get user info and create session
      const userInfo = await this.oidcProvider.getUserInfo(tokenResponse.access_token)
      const session = await this.createOIDCSession(userInfo, tokenResponse)
      
      await this.auditService.log({
        principalId: userInfo.sub,
        action: 'auth.oidc.success',
        status: 'success',
        sessionContext: { ...sessionContext, sessionId: session.sessionId },
        correlationId,
        complianceContext: {
          regulation: 'HIPAA',
          dataClassification: 'Authentication',
          authenticationMethod: 'OIDC',
          strongAuthentication: true
        },
        details: {
          userId: userInfo.sub,
          email: userInfo.email,
          role: userInfo.role,
          organizationId: userInfo.organization_id,
          accessTokenHash: this.hashToken(tokenResponse.access_token),
          tokenScope: tokenResponse.scope,
          npiNumber: userInfo.npi_number
        },
        processingLatency: Date.now() - startTime
      })

      return { user: userInfo, session, tokens: tokenResponse }
    } catch (error) {
      await this.auditService.log({
        principalId: 'unknown',
        action: 'auth.oidc.error',
        status: 'failure',
        sessionContext,
        correlationId,
        details: { error: error.message },
        processingLatency: Date.now() - startTime
      })
      throw error
    }
  }
}
```

## 🔐 Multi-Factor Authentication

### SMS-Based MFA Implementation

```typescript
class MFAService {
  constructor(private auditService: Audit, private smsProvider: SMSProvider) {}

  async initiateSMSChallenge(userId: string, phoneNumber: string, sessionContext: SessionContext) {
    const correlationId = `mfa-sms-${Date.now()}`
    const startTime = Date.now()
    
    try {
      const challengeCode = await this.generateSMSCode()
      const challengeId = await this.storeMFAChallenge(userId, challengeCode, 'SMS')
      
      await this.smsProvider.sendSMS(phoneNumber, `Healthcare login code: ${challengeCode}`)
      
      await this.auditService.log({
        principalId: userId,
        action: 'auth.mfa.sms_challenge_sent',
        status: 'success',
        sessionContext,
        correlationId,
        complianceContext: {
          regulation: 'HIPAA',
          dataClassification: 'Authentication',
          authenticationFactor: 'SMS',
          securityLevel: 'Enhanced'
        },
        details: {
          challengeId,
          phoneNumberMask: this.maskPhoneNumber(phoneNumber),
          expirationTime: Date.now() + (5 * 60 * 1000),
          deliveryMethod: 'SMS'
        },
        processingLatency: Date.now() - startTime
      })

      return { challengeId, expiresAt: Date.now() + (5 * 60 * 1000) }
    } catch (error) {
      await this.auditService.log({
        principalId: userId,
        action: 'auth.mfa.sms_challenge_failed',
        status: 'failure',
        sessionContext,
        correlationId,
        details: { error: error.message },
        processingLatency: Date.now() - startTime
      })
      throw error
    }
  }

  async verifySMSChallenge(userId: string, challengeId: string, providedCode: string, sessionContext: SessionContext) {
    const correlationId = `mfa-verify-${Date.now()}`
    const startTime = Date.now()
    
    try {
      const challenge = await this.getMFAChallenge(challengeId)
      
      if (!challenge || challenge.userId !== userId || challenge.expiresAt < Date.now()) {
        await this.auditService.log({
          principalId: userId,
          action: 'auth.mfa.invalid_challenge',
          status: 'failure',
          sessionContext,
          correlationId,
          complianceContext: {
            regulation: 'HIPAA',
            dataClassification: 'Authentication',
            securityIncident: 'Invalid MFA challenge'
          },
          details: { challengeId, challengeExists: !!challenge },
          processingLatency: Date.now() - startTime
        })
        throw new Error('Invalid or expired MFA challenge')
      }

      const isValidCode = await this.verifyMFACode(challenge.code, providedCode)
      
      if (!isValidCode) {
        await this.incrementFailedAttempts(challengeId)
        await this.auditService.log({
          principalId: userId,
          action: 'auth.mfa.verification_failed',
          status: 'failure',
          sessionContext,
          correlationId,
          details: {
            challengeId,
            failedAttempts: challenge.failedAttempts + 1,
            maxAttempts: 3
          },
          processingLatency: Date.now() - startTime
        })
        throw new Error('Invalid MFA code')
      }

      await this.completeMFAChallenge(challengeId)
      
      await this.auditService.log({
        principalId: userId,
        action: 'auth.mfa.verification_success',
        status: 'success',
        sessionContext,
        correlationId,
        complianceContext: {
          regulation: 'HIPAA',
          dataClassification: 'Authentication',
          authenticationFactor: 'SMS',
          strongAuthentication: true
        },
        details: {
          challengeId,
          challengeDuration: Date.now() - challenge.createdAt,
          attemptNumber: challenge.failedAttempts + 1
        },
        processingLatency: Date.now() - startTime
      })

      return { verified: true, challengeId }
    } catch (error) {
      await this.auditService.log({
        principalId: userId,
        action: 'auth.mfa.verification_error',
        status: 'failure',
        sessionContext,
        correlationId,
        details: { error: error.message, challengeId },
        processingLatency: Date.now() - startTime
      })
      throw error
    }
  }
}
```

## 🗝️ Session Management

### Secure Session Lifecycle Management

```typescript
class SessionManagementService {
  constructor(private auditService: Audit, private sessionStore: SessionStore) {}

  async createSession(userId: string, authMethod: string, sessionContext: SessionContext) {
    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const correlationId = `session-create-${Date.now()}`
    const startTime = Date.now()
    
    try {
      const sessionData = {
        sessionId,
        userId,
        createdAt: new Date(),
        lastActivity: new Date(),
        authenticationMethod: authMethod,
        ipAddress: sessionContext.ipAddress,
        isActive: true,
        accessLevel: await this.determineAccessLevel(userId),
        expiresAt: new Date(Date.now() + (8 * 60 * 60 * 1000)) // 8 hours
      }

      await this.sessionStore.create(sessionData)
      const activeSessions = await this.getActiveUserSessions(userId)
      
      await this.auditService.log({
        principalId: userId,
        action: 'auth.session.created',
        status: 'success',
        sessionContext: { ...sessionContext, sessionId },
        correlationId,
        complianceContext: {
          regulation: 'HIPAA',
          dataClassification: 'Authentication',
          sessionManagement: 'Secure session'
        },
        details: {
          sessionId,
          authenticationMethod: authMethod,
          sessionDuration: 8 * 60 * 60 * 1000,
          accessLevel: sessionData.accessLevel,
          concurrentSessions: activeSessions.length,
          ipAddress: sessionContext.ipAddress
        },
        processingLatency: Date.now() - startTime
      })

      // Alert on too many concurrent sessions
      const maxSessions = await this.getMaxConcurrentSessions(userId)
      if (activeSessions.length > maxSessions) {
        await this.auditService.logCritical({
          principalId: userId,
          action: 'auth.session.concurrent_limit_exceeded',
          status: 'failure',
          sessionContext: { ...sessionContext, sessionId },
          correlationId,
          complianceContext: {
            regulation: 'HIPAA',
            dataClassification: 'Security',
            securityIncident: 'Concurrent session limit exceeded'
          },
          details: {
            currentSessions: activeSessions.length,
            maxAllowed: maxSessions
          }
        }, {
          priority: 1,
          notify: ['security-team'],
          escalate: true
        })
      }

      return sessionData
    } catch (error) {
      await this.auditService.log({
        principalId: userId,
        action: 'auth.session.creation_failed',
        status: 'failure',
        sessionContext,
        correlationId,
        details: { error: error.message },
        processingLatency: Date.now() - startTime
      })
      throw error
    }
  }

  async terminateSession(sessionId: string, reason: string, sessionContext: SessionContext) {
    const correlationId = `session-terminate-${Date.now()}`
    const startTime = Date.now()
    
    try {
      const session = await this.sessionStore.get(sessionId)
      if (!session) throw new Error('Session not found')

      const sessionDuration = Date.now() - new Date(session.createdAt).getTime()
      
      await this.sessionStore.update(sessionId, { 
        ...session, 
        isActive: false, 
        terminatedAt: new Date(),
        terminationReason: reason 
      })
      
      await this.auditService.log({
        principalId: session.userId,
        action: 'auth.session.terminated',
        status: 'success',
        sessionContext: { ...sessionContext, sessionId },
        correlationId,
        complianceContext: {
          regulation: 'HIPAA',
          dataClassification: 'Authentication',
          sessionManagement: 'Secure termination'
        },
        details: {
          sessionId,
          sessionDuration,
          terminationReason: reason,
          authenticationMethod: session.authenticationMethod,
          lastActivity: session.lastActivity
        },
        processingLatency: Date.now() - startTime
      })

      return { terminated: true, sessionDuration }
    } catch (error) {
      await this.auditService.log({
        principalId: 'unknown',
        action: 'auth.session.termination_failed',
        status: 'failure',
        sessionContext: { ...sessionContext, sessionId },
        correlationId,
        details: { error: error.message, sessionId },
        processingLatency: Date.now() - startTime
      })
      throw error
    }
  }
}
```

## 👥 Role-Based Access Control

### Healthcare Role Management

```typescript
class HealthcareRBACService {
  constructor(private auditService: Audit, private roleManager: RoleManager) {}

  async assignRole(userId: string, roleId: string, assignedBy: string, justification: string, sessionContext: SessionContext) {
    const correlationId = `role-assign-${Date.now()}`
    const startTime = Date.now()
    
    try {
      const canAssign = await this.permissionService.canAssignRole(assignedBy, roleId)
      
      if (!canAssign) {
        await this.auditService.log({
          principalId: assignedBy,
          action: 'auth.rbac.role_assignment_denied',
          status: 'failure',
          sessionContext,
          correlationId,
          complianceContext: {
            regulation: 'HIPAA',
            dataClassification: 'Access Control',
            privilegeEscalation: 'Attempted unauthorized role assignment'
          },
          details: {
            targetUserId: userId,
            attemptedRoleId: roleId,
            denialReason: 'Insufficient privileges'
          },
          processingLatency: Date.now() - startTime
        })
        throw new Error('Insufficient privileges to assign role')
      }

      const role = await this.roleManager.getRole(roleId)
      await this.roleManager.assignUserRole(userId, roleId)
      
      await this.auditService.log({
        principalId: assignedBy,
        action: 'auth.rbac.role_assigned',
        status: 'success',
        sessionContext,
        correlationId,
        complianceContext: {
          regulation: 'HIPAA',
          dataClassification: 'Access Control',
          privilegeManagement: 'Role assignment'
        },
        details: {
          targetUserId: userId,
          roleId,
          roleName: role.name,
          rolePermissions: role.permissions.length,
          justification,
          effectiveDate: new Date()
        },
        processingLatency: Date.now() - startTime
      })

      return { assigned: true, role }
    } catch (error) {
      await this.auditService.log({
        principalId: assignedBy,
        action: 'auth.rbac.role_assignment_failed',
        status: 'failure',
        sessionContext,
        correlationId,
        details: { error: error.message, targetUserId: userId, roleId },
        processingLatency: Date.now() - startTime
      })
      throw error
    }
  }
}
```

## 🚨 Emergency Access Procedures

### Break-Glass Emergency Access

```typescript
class EmergencyAccessService {
  constructor(private auditService: Audit, private emergencyManager: EmergencyManager) {}

  async requestEmergencyAccess(userId: string, patientId: string, emergencyReason: string, sessionContext: SessionContext) {
    const correlationId = `emergency-access-${Date.now()}`
    const startTime = Date.now()
    
    try {
      const emergencyRequest = {
        requestId: `emr_${Date.now()}`,
        userId,
        patientId,
        reason: emergencyReason,
        requestedAt: new Date(),
        approvalRequired: await this.requiresApproval(emergencyReason),
        ipAddress: sessionContext.ipAddress
      }

      await this.emergencyManager.createRequest(emergencyRequest)
      
      await this.auditService.logCritical({
        principalId: userId,
        action: 'auth.emergency_access.requested',
        status: 'success',
        sessionContext,
        correlationId,
        complianceContext: {
          regulation: 'HIPAA',
          dataClassification: 'Emergency Access',
          breakGlassAccess: true,
          emergencyJustification: emergencyReason
        },
        details: {
          requestId: emergencyRequest.requestId,
          patientId,
          emergencyReason,
          approvalRequired: emergencyRequest.approvalRequired,
          requestLocation: sessionContext.location,
          automaticApproval: !emergencyRequest.approvalRequired
        }
      }, {
        priority: 1,
        notify: ['security-team', 'compliance-team'],
        escalate: true
      })

      if (!emergencyRequest.approvalRequired) {
        return await this.grantEmergencyAccess(emergencyRequest, sessionContext)
      }

      return { requestId: emergencyRequest.requestId, status: 'pending_approval' }
    } catch (error) {
      await this.auditService.logCritical({
        principalId: userId,
        action: 'auth.emergency_access.request_failed',
        status: 'failure',
        sessionContext,
        correlationId,
        details: { error: error.message, patientId, emergencyReason }
      }, { priority: 1 })
      throw error
    }
  }

  async grantEmergencyAccess(request: EmergencyRequest, sessionContext: SessionContext) {
    const correlationId = `emergency-grant-${Date.now()}`
    const startTime = Date.now()
    
    try {
      const accessGrant = {
        grantId: `grant_${Date.now()}`,
        requestId: request.requestId,
        userId: request.userId,
        patientId: request.patientId,
        grantedAt: new Date(),
        expiresAt: new Date(Date.now() + (4 * 60 * 60 * 1000)), // 4 hours
        accessLevel: 'emergency_full',
        restrictions: await this.getEmergencyRestrictions()
      }

      await this.emergencyManager.grantAccess(accessGrant)
      
      await this.auditService.logCritical({
        principalId: request.userId,
        action: 'auth.emergency_access.granted',
        status: 'success',
        sessionContext,
        correlationId,
        complianceContext: {
          regulation: 'HIPAA',
          dataClassification: 'Emergency Access',
          breakGlassAccess: true,
          accessGranted: true
        },
        details: {
          grantId: accessGrant.grantId,
          requestId: request.requestId,
          patientId: request.patientId,
          accessDuration: 4 * 60 * 60 * 1000,
          accessLevel: accessGrant.accessLevel,
          emergencyReason: request.reason,
          automaticExpiry: true
        }
      }, {
        priority: 1,
        notify: ['security-team', 'medical-director'],
        escalate: true
      })

      return accessGrant
    } catch (error) {
      await this.auditService.logCritical({
        principalId: request.userId,
        action: 'auth.emergency_access.grant_failed',
        status: 'failure',
        sessionContext,
        correlationId,
        details: { error: error.message, requestId: request.requestId }
      }, { priority: 1 })
      throw error
    }
  }
}
```

## 🔍 Security Event Correlation

### Suspicious Activity Detection

```typescript
class SecurityCorrelationService {
  constructor(private auditService: Audit, private threatDetector: ThreatDetector) {}

  async detectSuspiciousActivity(userId: string, sessionContext: SessionContext) {
    const correlationId = `security-analysis-${Date.now()}`
    
    try {
      const recentEvents = await this.auditService.getRecentEvents(userId, 24 * 60 * 60 * 1000) // 24 hours
      const patterns = await this.threatDetector.analyzePatterns(recentEvents)
      
      for (const pattern of patterns.suspiciousPatterns) {
        await this.auditService.logCritical({
          principalId: userId,
          action: 'security.suspicious_activity.detected',
          status: 'failure',
          sessionContext,
          correlationId,
          complianceContext: {
            regulation: 'HIPAA',
            dataClassification: 'Security',
            securityIncident: 'Suspicious behavior pattern'
          },
          details: {
            patternType: pattern.type,
            confidence: pattern.confidence,
            eventCount: pattern.eventCount,
            timeWindow: pattern.timeWindow,
            riskScore: pattern.riskScore,
            indicators: pattern.indicators
          }
        }, {
          priority: 1,
          notify: ['security-team'],
          escalate: pattern.confidence > 0.8
        })
      }

      return patterns
    } catch (error) {
      console.error('Security correlation error:', error)
      return { suspiciousPatterns: [], error: error.message }
    }
  }
}
```

## ⚡ Performance Optimization

### Batch Authentication Event Processing

```typescript
class AuthAuditOptimizer {
  private auditQueue: AuditEvent[] = []
  private readonly BATCH_SIZE = 50

  constructor(private auditService: Audit) {
    setInterval(() => this.flushBatch(), 2000) // Flush every 2 seconds
  }

  async queueAuthEvent(event: AuditEvent) {
    this.auditQueue.push(event)
    if (this.auditQueue.length >= this.BATCH_SIZE) {
      await this.flushBatch()
    }
  }

  private async flushBatch() {
    if (this.auditQueue.length === 0) return
    
    const batch = this.auditQueue.splice(0, this.BATCH_SIZE)
    try {
      await this.auditService.logBatch(batch)
    } catch (error) {
      this.auditQueue.unshift(...batch) // Re-queue on failure
    }
  }
}
```

## 🧪 Testing Strategies

### Authentication Audit Testing

```typescript
describe('Authentication Flow Auditing', () => {
  it('should audit successful SAML authentication', async () => {
    const mockAuditService = createMockAuditService()
    const samlService = new SAMLAuthenticationService(mockAuditService, mockSAMLProvider)
    
    await samlService.authenticateWithSAML('valid-token', mockSessionContext)
    
    expect(mockAuditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'auth.saml.success',
        status: 'success',
        complianceContext: expect.objectContaining({
          regulation: 'HIPAA',
          authenticationMethod: 'SAML SSO'
        })
      })
    )
  })

  it('should audit MFA verification failure', async () => {
    const mockAuditService = createMockAuditService()
    const mfaService = new MFAService(mockAuditService, mockSMSProvider)
    
    await expect(
      mfaService.verifySMSChallenge('user-123', 'challenge-456', 'wrong-code', mockSessionContext)
    ).rejects.toThrow()
    
    expect(mockAuditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'auth.mfa.verification_failed',
        status: 'failure'
      })
    )
  })

  it('should audit emergency access request', async () => {
    const mockAuditService = createMockAuditService()
    const emergencyService = new EmergencyAccessService(mockAuditService, mockEmergencyManager)
    
    await emergencyService.requestEmergencyAccess('doctor-123', 'patient-456', 'Cardiac emergency', mockSessionContext)
    
    expect(mockAuditService.logCritical).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'auth.emergency_access.requested',
        complianceContext: expect.objectContaining({
          breakGlassAccess: true
        })
      }),
      expect.objectContaining({
        priority: 1,
        escalate: true
      })
    )
  })
})
```

This comprehensive authentication flows documentation provides healthcare developers with practical, security-focused examples for implementing audit logging across the full spectrum of authentication and authorization operations, from basic login flows to emergency access procedures and security incident detection.