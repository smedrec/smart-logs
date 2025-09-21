# Cryptography API Reference

Complete API documentation for the cryptographic services in the `@repo/audit` package. This reference provides detailed information about tamper detection, data integrity verification, digital signatures, and KMS integration.

## 📋 Overview

The cryptographic system provides tamper detection, data integrity verification, digital signatures, and KMS integration for secure audit event processing. All cryptographic operations are designed to ensure audit trail integrity and authenticity.

## 🔒 Core Interfaces

### CryptographicService Interface

The main interface for cryptographic operations on audit events.

```typescript
interface CryptographicService {
  /** Generate SHA-256 hash for audit event integrity */
  generateHash(event: AuditLogEvent): string
  
  /** Verify audit event integrity using hash comparison */
  verifyHash(event: AuditLogEvent, expectedHash: string): boolean
  
  /** Generate cryptographic signature for audit event */
  generateEventSignature(
    event: AuditLogEvent, 
    signingAlgorithm?: SigningAlgorithm
  ): Promise<EventSignatureResponse>
  
  /** Verify cryptographic signature of audit event */
  verifyEventSignature(
    event: AuditLogEvent, 
    signature: string, 
    signingAlgorithm?: SigningAlgorithm
  ): Promise<boolean>
}
```

### EventSignatureResponse Interface

Response structure for event signature generation.

```typescript
interface EventSignatureResponse {
  /** The cryptographic signature of the event */
  signature: string
  
  /** The algorithm used to generate the signature */
  algorithm: SigningAlgorithm
}
```

### CryptoConfig Interface

Configuration for cryptographic operations.

```typescript
interface CryptoConfig {
  /** Hash algorithm for integrity verification */
  hashAlgorithm: 'SHA-256'
  
  /** Signature algorithm for authentication */
  signatureAlgorithm: 'HMAC-SHA256'
  
  /** Secret key for HMAC operations (base64 encoded) */
  secretKey?: string
}
```

## 🛡️ CryptoService Class

The main cryptographic service class implementing tamper detection and digital signatures.

```typescript
class CryptoService implements CryptographicService {
  constructor(config: SecurityConfig)
  
  /** Generate SHA-256 hash for audit event integrity verification */
  generateHash(event: AuditLogEvent): string
  
  /** Verify audit event integrity by comparing hashes */
  verifyHash(event: AuditLogEvent, expectedHash: string): boolean
  
  /** Generate cryptographic signature for audit event authentication */
  generateEventSignature(
    event: AuditLogEvent, 
    signingAlgorithm?: SigningAlgorithm
  ): Promise<EventSignatureResponse>
  
  /** Verify cryptographic signature of audit event */
  verifyEventSignature(
    event: AuditLogEvent, 
    signature: string, 
    signingAlgorithm?: SigningAlgorithm
  ): Promise<boolean>
  
  /** Get current cryptographic configuration (sanitized) */
  getConfig(): CryptoConfig
}
```

### Hash Generation System

#### generateHash(event: AuditLogEvent): string

Generates a SHA-256 hash of critical audit event fields for integrity verification.

**Algorithm Details:**
1. **Critical Field Extraction**: Extracts essential fields in deterministic order
2. **Deterministic String Creation**: Creates consistent string representation
3. **SHA-256 Hashing**: Generates hex-encoded hash for backward compatibility

**Critical Fields Used:**
- `timestamp` - Event occurrence time
- `action` - Action performed  
- `status` - Action outcome status
- `principalId` - Acting principal identifier
- `organizationId` - Organization context
- `targetResourceType` - Target resource type
- `targetResourceId` - Target resource identifier
- `outcomeDescription` - Detailed outcome

```typescript
// Example usage
const crypto = new CryptoService(securityConfig)
const hash = crypto.generateHash(auditEvent)
console.log('Event hash:', hash) // "a1b2c3d4e5f6..."
```

#### verifyHash(event: AuditLogEvent, expectedHash: string): boolean

Verifies audit event integrity by comparing computed hash with expected value.

```typescript
// Example usage
const isIntact = crypto.verifyHash(auditEvent, storedHash)
if (!isIntact) {
  console.error('Event integrity compromised - possible tampering detected')
  // Handle tamper detection
}
```

### Digital Signature System

#### generateEventSignature(event, signingAlgorithm?): Promise<EventSignatureResponse>

Generates cryptographic signatures for audit event authentication.

**Supported Signature Algorithms:**
- `HMAC-SHA256` - HMAC with SHA-256 (default, local signing)
- `RSASSA_PSS_SHA_256` - RSA-PSS with SHA-256 (KMS signing)
- `RSASSA_PSS_SHA_384` - RSA-PSS with SHA-384 (KMS signing)
- `RSASSA_PSS_SHA_512` - RSA-PSS with SHA-512 (KMS signing)
- `RSASSA_PKCS1_V1_5_SHA_256` - RSA PKCS#1 v1.5 with SHA-256 (KMS signing)
- `RSASSA_PKCS1_V1_5_SHA_384` - RSA PKCS#1 v1.5 with SHA-384 (KMS signing)
- `RSASSA_PKCS1_V1_5_SHA_512` - RSA PKCS#1 v1.5 with SHA-512 (KMS signing)

**Signing Process:**
1. Generate SHA-256 hash of audit event
2. Sign hash using configured algorithm (KMS or local HMAC)
3. Return signature with algorithm information

```typescript
// Example usage with KMS
const signatureResponse = await crypto.generateEventSignature(
  auditEvent, 
  'RSASSA_PSS_SHA_256'
)
console.log('Signature:', signatureResponse.signature)
console.log('Algorithm:', signatureResponse.algorithm)

// Example usage with local HMAC
const hmacSignature = await crypto.generateEventSignature(auditEvent)
console.log('HMAC signature:', hmacSignature.signature)
```

#### verifyEventSignature(event, signature, signingAlgorithm?): Promise<boolean>

Verifies cryptographic signature authenticity for audit events.

```typescript
// Example usage
const isAuthentic = await crypto.verifyEventSignature(
  auditEvent, 
  storedSignature, 
  'RSASSA_PSS_SHA_256'
)

if (!isAuthentic) {
  console.error('Signature verification failed - possible forgery detected')
  // Handle authentication failure
}
```

## 🔑 KMS Integration

### Infisical KMS Support

The cryptographic service integrates with Infisical KMS for centralized key management and enhanced security.

```typescript
interface InfisicalKMSConfig {
  /** Enable KMS integration */
  enabled: boolean
  
  /** Infisical base URL */
  baseUrl: string
  
  /** KMS encryption key */
  encryptionKey: string
  
  /** KMS signing key */
  signingKey: string
  
  /** Access token for KMS authentication */
  accessToken: string
}
```

### KMS vs Local Signing

**KMS Signing (Recommended for Production):**
- Centralized key management
- Hardware security module (HSM) support
- Stronger cryptographic algorithms (RSA, ECDSA)
- Key rotation capabilities
- Audit logging of key usage

**Local HMAC Signing (Development/Fallback):**
- Faster performance (no network calls)
- Simple configuration
- Fallback option when KMS unavailable
- HMAC-SHA256 algorithm

```typescript
// KMS configuration
const kmsConfig: SecurityConfig = {
  kms: {
    enabled: true,
    baseUrl: 'https://kms.example.com',
    encryptionKey: 'your-encryption-key',
    signingKey: 'your-signing-key',
    accessToken: 'your-access-token'
  },
  encryptionKey: 'fallback-hmac-key' // Used when KMS unavailable
}

const crypto = new CryptoService(kmsConfig)
```

## 🔐 Security Features

### Tamper Detection

The cryptographic service provides multiple layers of tamper detection:

1. **Hash Verification**: SHA-256 hashes detect any modification to critical fields
2. **Signature Verification**: Digital signatures ensure authenticity and non-repudiation
3. **Critical Field Selection**: Only essential fields included in cryptographic operations
4. **Deterministic Processing**: Consistent hashing regardless of object property order

```typescript
// Comprehensive tamper detection
async function verifyEventIntegrity(
  event: AuditLogEvent, 
  storedHash: string, 
  storedSignature: string
): Promise<boolean> {
  const crypto = new CryptoService(securityConfig)
  
  // Verify hash integrity
  const hashValid = crypto.verifyHash(event, storedHash)
  if (!hashValid) {
    console.error('Hash verification failed - event modified')
    return false
  }
  
  // Verify signature authenticity
  const signatureValid = await crypto.verifyEventSignature(
    event, 
    storedSignature
  )
  if (!signatureValid) {
    console.error('Signature verification failed - event not authentic')
    return false
  }
  
  return true
}
```

### Secure Key Management

**Environment Variable Configuration:**
```bash
# Local HMAC signing
AUDIT_CRYPTO_SECRET=your-base64-encoded-secret

# KMS configuration
KMS_ENABLED=true
KMS_BASE_URL=https://kms.example.com
KMS_ENCRYPTION_KEY=your-encryption-key
KMS_SIGNING_KEY=your-signing-key
KMS_ACCESS_TOKEN=your-access-token
```

**Configuration Validation:**
```typescript
// Validate cryptographic configuration
function validateCryptoConfig(config: SecurityConfig): boolean {
  if (config.kms.enabled) {
    // Validate KMS configuration
    if (!config.kms.baseUrl || !config.kms.encryptionKey) {
      throw new Error('KMS configuration incomplete')
    }
  } else {
    // Validate local configuration
    if (!config.encryptionKey) {
      throw new Error('Encryption key required for local signing')
    }
  }
  return true
}
```

## 🚀 Advanced Features

### Batch Operations

For high-volume audit processing, the service supports batch operations.

```typescript
interface BatchCryptoOperations {
  /** Generate hashes for multiple events */
  generateHashBatch(events: AuditLogEvent[]): string[]
  
  /** Verify hashes for multiple events */
  verifyHashBatch(
    events: AuditLogEvent[], 
    expectedHashes: string[]
  ): boolean[]
  
  /** Generate signatures for multiple events */
  generateSignatureBatch(
    events: AuditLogEvent[], 
    signingAlgorithm?: SigningAlgorithm
  ): Promise<EventSignatureResponse[]>
  
  /** Verify signatures for multiple events */
  verifySignatureBatch(
    events: AuditLogEvent[], 
    signatures: string[], 
    signingAlgorithm?: SigningAlgorithm
  ): Promise<boolean[]>
}
```

### Key Rotation Support

Support for cryptographic key rotation with backward compatibility.

```typescript
interface KeyRotationSupport {
  /** Rotate to new signing key */
  rotateSigningKey(newKey: string): Promise<void>
  
  /** Verify with multiple keys for rotation periods */
  verifyWithKeyHistory(
    event: AuditLogEvent, 
    signature: string, 
    keyHistory: string[]
  ): Promise<boolean>
  
  /** Get key version used for signing */
  getSigningKeyVersion(): string
}
```

## 💡 Usage Examples

### Basic Cryptographic Operations

```typescript
import { CryptoService, SecurityConfig } from '@repo/audit'

// Initialize cryptographic service
const securityConfig: SecurityConfig = {
  kms: { enabled: false },
  encryptionKey: process.env.AUDIT_CRYPTO_SECRET!,
  hashAlgorithm: 'SHA-256'
}

const crypto = new CryptoService(securityConfig)

// Generate hash and signature for audit event
const auditEvent: AuditLogEvent = {
  timestamp: new Date().toISOString(),
  action: 'user.login',
  status: 'success',
  principalId: 'user-123'
}

// Generate integrity hash
const hash = crypto.generateHash(auditEvent)
auditEvent.hash = hash
auditEvent.hashAlgorithm = 'SHA-256'

// Generate authentication signature
const signatureResponse = await crypto.generateEventSignature(auditEvent)
auditEvent.signature = signatureResponse.signature
auditEvent.algorithm = signatureResponse.algorithm

console.log('Secured audit event:', auditEvent)
```

### KMS Integration Example

```typescript
// KMS-enabled configuration
const kmsConfig: SecurityConfig = {
  kms: {
    enabled: true,
    baseUrl: 'https://infisical.example.com',
    encryptionKey: process.env.KMS_ENCRYPTION_KEY!,
    signingKey: process.env.KMS_SIGNING_KEY!,
    accessToken: process.env.KMS_ACCESS_TOKEN!
  },
  encryptionKey: process.env.FALLBACK_HMAC_KEY!, // Fallback
  hashAlgorithm: 'SHA-256'
}

const kmsCrypto = new CryptoService(kmsConfig)

// Sign with RSA algorithm via KMS
const kmsSignature = await kmsCrypto.generateEventSignature(
  auditEvent,
  'RSASSA_PSS_SHA_256'
)

console.log('KMS signature:', kmsSignature)
```

### Integrity Verification Pipeline

```typescript
// Complete integrity verification pipeline
async function secureAuditPipeline(event: AuditLogEvent): Promise<AuditLogEvent> {
  const crypto = new CryptoService(securityConfig)
  
  // Step 1: Generate integrity hash
  const hash = crypto.generateHash(event)
  event.hash = hash
  event.hashAlgorithm = 'SHA-256'
  
  // Step 2: Generate authentication signature
  const signatureResponse = await crypto.generateEventSignature(event)
  event.signature = signatureResponse.signature
  event.algorithm = signatureResponse.algorithm
  
  // Step 3: Verify integrity before storage
  const hashVerified = crypto.verifyHash(event, hash)
  const signatureVerified = await crypto.verifyEventSignature(
    event, 
    signatureResponse.signature, 
    signatureResponse.algorithm
  )
  
  if (!hashVerified || !signatureVerified) {
    throw new Error('Cryptographic verification failed')
  }
  
  return event
}
```

### Error Handling and Recovery

```typescript
// Robust error handling for cryptographic operations
async function safeCryptographicOperation(
  event: AuditLogEvent
): Promise<EventSignatureResponse> {
  const crypto = new CryptoService(securityConfig)
  
  try {
    // Attempt KMS signing first
    return await crypto.generateEventSignature(event, 'RSASSA_PSS_SHA_256')
  } catch (kmsError) {
    console.warn('KMS signing failed, falling back to HMAC:', kmsError.message)
    
    try {
      // Fallback to local HMAC signing
      return await crypto.generateEventSignature(event)
    } catch (hmacError) {
      console.error('All signing methods failed:', hmacError.message)
      throw new Error('Cryptographic signing unavailable')
    }
  }
}
```

## 🔗 Related APIs

- **[Configuration](./configuration.md)** - Security configuration setup
- **[Audit Class](./audit-class.md)** - Integration with audit service
- **[Event Types](./event-types.md)** - Audit event structures
- **[Monitoring](./monitoring.md)** - Cryptographic performance monitoring

## 📚 Cryptographic Standards

The service follows industry-standard cryptographic practices:

- **SHA-256**: NIST-approved hash algorithm for integrity verification
- **HMAC-SHA256**: RFC 2104 compliant message authentication
- **RSA-PSS**: RFC 8017 probabilistic signature scheme
- **Base64 Encoding**: RFC 4648 compliant encoding for signatures
- **Deterministic Hashing**: Consistent results regardless of object property order

## 🔧 Performance Considerations

- **Hash Generation**: ~0.1ms per event for local operations
- **HMAC Signing**: ~0.2ms per event for local operations  
- **KMS Signing**: ~10-50ms per event depending on network latency
- **Batch Operations**: Recommended for >100 events to amortize overhead
- **Key Caching**: KMS keys cached locally to reduce network calls

For performance optimization strategies, see the [Performance Guide](../guides/performance-optimization.md).