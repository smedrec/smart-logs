
const { AuditClient } = require('../dist/index.cjs')

console.log('🟢 Node.js CJS Import Test')

// Test basic instantiation
try {
  const client = new AuditClient({
    baseUrl: 'https://api.example.com',
    authentication: {
      type: 'apiKey',
      apiKey: 'test-key'
    }
  })
  
  console.log('✅ AuditClient instantiated successfully')
  console.log('✅ Configuration accepted')
  
  // Test service access
  if (client.events && typeof client.events.create === 'function') {
    console.log('✅ Events service accessible')
  } else {
    throw new Error('Events service not accessible')
  }
  
  if (client.compliance && typeof client.compliance.generateHipaaReport === 'function') {
    console.log('✅ Compliance service accessible')
  } else {
    throw new Error('Compliance service not accessible')
  }
  
  console.log('🎉 Node.js CJS test passed!')
  
} catch (error) {
  console.error('❌ Node.js CJS test failed:', error.message)
  process.exit(1)
}
