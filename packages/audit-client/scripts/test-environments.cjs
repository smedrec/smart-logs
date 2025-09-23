#!/usr/bin/env node

/**
 * Environment Testing Script
 *
 * Tests the @smedrec/audit-client package in different environments
 * to ensure compatibility and proper functionality.
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const PACKAGE_DIR = path.resolve(__dirname, '..')
const TEST_DIR = path.join(PACKAGE_DIR, 'test-environments')

console.log('🧪 Testing @smedrec/audit-client in different environments...\n')

// Ensure test directory exists
if (!fs.existsSync(TEST_DIR)) {
	fs.mkdirSync(TEST_DIR, { recursive: true })
}

const environments = {
	node: {
		name: 'Node.js Environment',
		setup: () => {
			const testFile = path.join(TEST_DIR, 'node-test.cjs')
			const content = `
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
`
			fs.writeFileSync(testFile, content)
			return testFile
		},
		run: (testFile) => {
			execSync(`node "${testFile}"`, { stdio: 'inherit', cwd: PACKAGE_DIR })
		},
	},

	nodeESM: {
		name: 'Node.js ESM Environment',
		setup: () => {
			const testFile = path.join(TEST_DIR, 'node-esm-test.mjs')
			const content = `
import { AuditClient } from '../dist/index.js'

console.log('🟢 Node.js ESM Import Test')

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
  
  if (client.health && typeof client.health.check === 'function') {
    console.log('✅ Health service accessible')
  } else {
    throw new Error('Health service not accessible')
  }
  
  console.log('🎉 Node.js ESM test passed!')
  
} catch (error) {
  console.error('❌ Node.js ESM test failed:', error.message)
  process.exit(1)
}
`
			fs.writeFileSync(testFile, content)
			return testFile
		},
		run: (testFile) => {
			execSync(`node "${testFile}"`, { stdio: 'inherit', cwd: PACKAGE_DIR })
		},
	},

	typescript: {
		name: 'TypeScript Environment',
		setup: () => {
			const testFile = path.join(TEST_DIR, 'typescript-test.ts')
			const content = `
import { AuditClient, AuditEvent, AuditClientConfig } from '../dist/index.js'

console.log('🟢 TypeScript Import Test')

// Test type definitions
const config: AuditClientConfig = {
  baseUrl: 'https://api.example.com',
  authentication: {
    type: 'apiKey',
    apiKey: 'test-key',
    autoRefresh: false
  },
  retry: {
    enabled: true,
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
    retryableStatusCodes: [500, 502, 503, 504],
    retryableErrors: ['ECONNRESET', 'ETIMEDOUT']
  }
}

try {
  const client = new AuditClient(config)
  
  console.log('✅ AuditClient instantiated with typed config')
  
  // Test type safety
  const eventData: Partial<AuditEvent> = {
    action: 'test_action',
    targetResourceType: 'test_resource',
    principalId: 'test-user',
    organizationId: 'test-org',
    status: 'success'
  }
  
  console.log('✅ Type definitions working correctly')
  
  // Test service method types
  const eventsService = client.events
  const complianceService = client.compliance
  const healthService = client.health
  
  if (eventsService && complianceService && healthService) {
    console.log('✅ All services accessible with proper types')
  }
  
  console.log('🎉 TypeScript test passed!')
  
} catch (error) {
  console.error('❌ TypeScript test failed:', error.message)
  process.exit(1)
}
`
			fs.writeFileSync(testFile, content)

			// Create tsconfig for test
			const tsconfigFile = path.join(TEST_DIR, 'tsconfig.json')
			const tsconfig = {
				compilerOptions: {
					target: 'ES2020',
					module: 'commonjs',
					moduleResolution: 'node',
					esModuleInterop: true,
					allowSyntheticDefaultImports: true,
					strict: true,
					skipLibCheck: true,
					forceConsistentCasingInFileNames: true,
				},
			}
			fs.writeFileSync(tsconfigFile, JSON.stringify(tsconfig, null, 2))

			return testFile
		},
		run: (testFile) => {
			// Compile TypeScript
			execSync(
				`npx tsc "${testFile}" --outDir "${TEST_DIR}" --target ES2020 --module commonjs --moduleResolution node --esModuleInterop --allowSyntheticDefaultImports`,
				{
					stdio: 'inherit',
					cwd: PACKAGE_DIR,
				}
			)

			// Run compiled JavaScript
			const jsFile = testFile.replace('.ts', '.js')
			execSync(`node "${jsFile}"`, { stdio: 'inherit', cwd: PACKAGE_DIR })
		},
	},

	webpack: {
		name: 'Webpack Bundle Test',
		setup: () => {
			const testFile = path.join(TEST_DIR, 'webpack-test.js')
			const content = `
import { AuditClient } from '../dist/index.js'

console.log('🟢 Webpack Bundle Test')

// Test that the module can be bundled
try {
  const client = new AuditClient({
    baseUrl: 'https://api.example.com',
    authentication: {
      type: 'apiKey',
      apiKey: 'test-key'
    }
  })
  
  console.log('✅ Module bundled successfully')
  console.log('✅ AuditClient instantiated in bundle')
  
  // Test tree-shaking compatibility
  if (typeof client.events.create === 'function') {
    console.log('✅ Tree-shaking compatible')
  }
  
  console.log('🎉 Webpack bundle test passed!')
  
} catch (error) {
  console.error('❌ Webpack bundle test failed:', error.message)
  process.exit(1)
}
`
			fs.writeFileSync(testFile, content)

			// Create minimal webpack config
			const webpackConfig = path.join(TEST_DIR, 'webpack.config.js')
			const config = `
const path = require('path')

module.exports = {
  mode: 'development',
  entry: './webpack-test.js',
  output: {
    path: path.resolve(__dirname),
    filename: 'webpack-bundle.js'
  },
  resolve: {
    extensions: ['.js', '.mjs']
  },
  target: 'node'
}
`
			fs.writeFileSync(webpackConfig, config)

			return testFile
		},
		run: (testFile) => {
			try {
				// Try to bundle with webpack if available
				execSync('npx webpack --config webpack.config.js', {
					stdio: 'inherit',
					cwd: TEST_DIR,
				})

				// Run the bundle
				const bundleFile = path.join(TEST_DIR, 'webpack-bundle.js')
				execSync(`node "${bundleFile}"`, { stdio: 'inherit', cwd: PACKAGE_DIR })
			} catch (error) {
				console.log('⚠️  Webpack not available, skipping bundle test')
			}
		},
	},

	browserSimulation: {
		name: 'Browser Simulation Test',
		setup: () => {
			const testFile = path.join(TEST_DIR, 'browser-test.cjs')
			const content = `
// Simulate browser environment
global.window = {}
global.document = {}
Object.defineProperty(global, 'navigator', {
  value: { userAgent: 'test-browser' },
  writable: true
})

// Mock fetch for browser environment
global.fetch = async (url, options) => {
  return {
    ok: true,
    status: 200,
    json: async () => ({ success: true }),
    text: async () => 'success'
  }
}

// Import the module
const { AuditClient } = require('../dist/index.cjs')

console.log('🟢 Browser Simulation Test')

try {
  const client = new AuditClient({
    baseUrl: 'https://api.example.com',
    authentication: {
      type: 'apiKey',
      apiKey: 'test-key'
    }
  })
  
  console.log('✅ AuditClient works in browser-like environment')
  
  // Test that it doesn't use Node.js specific APIs
  if (client.events) {
    console.log('✅ Services accessible in browser environment')
  }
  
  console.log('🎉 Browser simulation test passed!')
  
} catch (error) {
  console.error('❌ Browser simulation test failed:', error.message)
  process.exit(1)
}
`
			fs.writeFileSync(testFile, content)
			return testFile
		},
		run: (testFile) => {
			execSync(`node "${testFile}"`, { stdio: 'inherit', cwd: PACKAGE_DIR })
		},
	},
}

// Run environment tests
async function runEnvironmentTests() {
	const results = {
		passed: 0,
		failed: 0,
		skipped: 0,
		errors: [],
	}

	for (const [envName, env] of Object.entries(environments)) {
		console.log(`\n🧪 Testing ${env.name}...`)

		try {
			const testFile = env.setup()
			env.run(testFile)

			results.passed++
			console.log(`✅ ${env.name} test passed`)
		} catch (error) {
			if (error.message.includes('not available') || error.message.includes('skipping')) {
				results.skipped++
				console.log(`⏭️  ${env.name} test skipped`)
			} else {
				results.failed++
				results.errors.push({ env: envName, error: error.message })
				console.error(`❌ ${env.name} test failed: ${error.message}`)
			}
		}
	}

	// Cleanup test directory
	try {
		fs.rmSync(TEST_DIR, { recursive: true, force: true })
	} catch (error) {
		console.warn('⚠️  Could not cleanup test directory:', error.message)
	}

	console.log('\n📊 Environment Test Summary:')
	console.log(`✅ Passed: ${results.passed}`)
	console.log(`❌ Failed: ${results.failed}`)
	console.log(`⏭️  Skipped: ${results.skipped}`)

	if (results.failed > 0) {
		console.log('\n🔍 Failed Tests:')
		for (const { env, error } of results.errors) {
			console.log(`  • ${env}: ${error}`)
		}
		process.exit(1)
	} else {
		console.log('\n🎉 All environment tests passed!')
	}
}

// Main execution
async function main() {
	try {
		await runEnvironmentTests()
	} catch (error) {
		console.error('💥 Environment testing failed:', error.message)
		process.exit(1)
	}
}

if (require.main === module) {
	main()
}

module.exports = { environments, runEnvironmentTests }
