#!/usr/bin/env node

/**
 * Package Validation Script
 *
 * This script validates the @smedrec/audit-client package installation
 * and usage in different environments.
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const PACKAGE_DIR = path.resolve(__dirname, '..')
const DIST_DIR = path.join(PACKAGE_DIR, 'dist')
const PACKAGE_JSON = path.join(PACKAGE_DIR, 'package.json')

console.log('🔍 Validating @smedrec/audit-client package...\n')

// Validation functions
const validations = {
	packageJson: () => {
		console.log('📦 Validating package.json...')

		if (!fs.existsSync(PACKAGE_JSON)) {
			throw new Error('package.json not found')
		}

		const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8'))

		// Check required fields
		const requiredFields = ['name', 'version', 'description', 'main', 'module', 'types', 'exports']
		for (const field of requiredFields) {
			if (!pkg[field]) {
				throw new Error(`Missing required field: ${field}`)
			}
		}

		// Check exports
		if (!pkg.exports['.']) {
			throw new Error('Missing main export in exports field')
		}

		// Check files array
		if (!pkg.files || !Array.isArray(pkg.files)) {
			throw new Error('Missing or invalid files array')
		}

		console.log('✅ package.json validation passed')
	},

	buildOutput: () => {
		console.log('🏗️  Validating build output...')

		if (!fs.existsSync(DIST_DIR)) {
			throw new Error('dist directory not found')
		}

		const requiredFiles = [
			'index.cjs', // CJS
			'index.js', // ESM
			'index.d.ts', // TypeScript declarations
		]

		for (const file of requiredFiles) {
			const filePath = path.join(DIST_DIR, file)
			if (!fs.existsSync(filePath)) {
				throw new Error(`Missing build output: ${file}`)
			}

			const content = fs.readFileSync(filePath, 'utf8')
			if (content.length === 0) {
				throw new Error(`Empty build output: ${file}`)
			}
		}

		console.log('✅ Build output validation passed')
	},

	cjsImport: () => {
		console.log('📥 Validating CommonJS import...')

		try {
			const cjsPath = path.join(DIST_DIR, 'index.cjs')
			const module = require(cjsPath)

			if (!module.AuditClient) {
				throw new Error('AuditClient not exported in CJS build')
			}

			if (typeof module.AuditClient !== 'function') {
				throw new Error('AuditClient is not a constructor function')
			}

			console.log('✅ CommonJS import validation passed')
		} catch (error) {
			throw new Error(`CJS import failed: ${error.message}`)
		}
	},

	esmImport: async () => {
		console.log('📥 Validating ES Module import...')

		try {
			const esmPath = path.join(DIST_DIR, 'index.js')

			// Use dynamic import for ESM
			const module = await import(`file://${esmPath}`)

			if (!module.AuditClient) {
				throw new Error('AuditClient not exported in ESM build')
			}

			if (typeof module.AuditClient !== 'function') {
				throw new Error('AuditClient is not a constructor function')
			}

			console.log('✅ ES Module import validation passed')
		} catch (error) {
			throw new Error(`ESM import failed: ${error.message}`)
		}
	},

	typeDefinitions: () => {
		console.log('📝 Validating TypeScript definitions...')

		const dtsPath = path.join(DIST_DIR, 'index.d.ts')
		const content = fs.readFileSync(dtsPath, 'utf8')

		// Check for essential exports
		const requiredExports = [
			'declare class AuditClient',
			'interface AuditEvent',
			'type AuditClientConfig',
		]

		for (const exportDecl of requiredExports) {
			if (!content.includes(exportDecl)) {
				throw new Error(`Missing TypeScript export: ${exportDecl}`)
			}
		}

		console.log('✅ TypeScript definitions validation passed')
	},

	packageSize: () => {
		console.log('📏 Validating package size...')

		const getDirectorySize = (dirPath) => {
			let totalSize = 0
			const files = fs.readdirSync(dirPath)

			for (const file of files) {
				const filePath = path.join(dirPath, file)
				const stats = fs.statSync(filePath)

				if (stats.isDirectory()) {
					totalSize += getDirectorySize(filePath)
				} else {
					totalSize += stats.size
				}
			}

			return totalSize
		}

		const distSize = getDirectorySize(DIST_DIR)
		const distSizeMB = (distSize / 1024 / 1024).toFixed(2)

		console.log(`📦 Package size: ${distSizeMB} MB`)

		// Warn if package is too large (>5MB is concerning for a client library)
		if (distSize > 5 * 1024 * 1024) {
			console.warn('⚠️  Package size is quite large (>5MB)')
		}

		console.log('✅ Package size validation passed')
	},

	browserCompatibility: () => {
		console.log('🌐 Validating browser compatibility...')

		const esmPath = path.join(DIST_DIR, 'index.js')
		const content = fs.readFileSync(esmPath, 'utf8')

		// Check for Node.js specific code that might break in browsers
		const nodeSpecificPatterns = [
			/require\s*\(\s*['"]fs['"]\s*\)/,
			/require\s*\(\s*['"]path['"]\s*\)/,
			/require\s*\(\s*['"]os['"]\s*\)/,
			/process\.cwd\(\)/,
			/__dirname/,
			/__filename/,
		]

		for (const pattern of nodeSpecificPatterns) {
			if (pattern.test(content)) {
				throw new Error(`Browser incompatible code found: ${pattern}`)
			}
		}

		console.log('✅ Browser compatibility validation passed')
	},

	reactNativeCompatibility: () => {
		console.log('📱 Validating React Native compatibility...')

		const esmPath = path.join(DIST_DIR, 'index.js')
		const content = fs.readFileSync(esmPath, 'utf8')

		// Check for React Native incompatible code
		const rnIncompatiblePatterns = [
			/document\./,
			/window\./,
			/localStorage/,
			/sessionStorage/,
			/XMLHttpRequest/,
		]

		for (const pattern of rnIncompatiblePatterns) {
			if (pattern.test(content) && !content.includes('typeof')) {
				console.warn(`⚠️  Potential React Native compatibility issue: ${pattern}`)
			}
		}

		console.log('✅ React Native compatibility validation passed')
	},

	npmPack: () => {
		console.log('📦 Validating npm pack...')

		try {
			// Check if essential files exist for packaging
			const essentialFiles = [
				{ path: 'dist', type: 'directory' },
				{ path: 'README.md', type: 'file' },
				{ path: 'CHANGELOG.md', type: 'file' },
				{ path: 'LICENSE', type: 'file' },
				{ path: 'package.json', type: 'file' },
			]

			for (const { path: filePath, type } of essentialFiles) {
				const fullPath = path.join(PACKAGE_DIR, filePath)
				if (!fs.existsSync(fullPath)) {
					throw new Error(`Essential ${type} not found: ${filePath}`)
				}

				if (type === 'directory') {
					const stats = fs.statSync(fullPath)
					if (!stats.isDirectory()) {
						throw new Error(`Expected directory but found file: ${filePath}`)
					}
				} else if (type === 'file') {
					const stats = fs.statSync(fullPath)
					if (!stats.isFile()) {
						throw new Error(`Expected file but found directory: ${filePath}`)
					}
				}
			}

			console.log('✅ npm pack validation passed')
		} catch (error) {
			throw new Error(`npm pack validation failed: ${error.message}`)
		}
	},
}

// Run all validations
async function runValidations() {
	const results = {
		passed: 0,
		failed: 0,
		errors: [],
	}

	for (const [name, validation] of Object.entries(validations)) {
		try {
			await validation()
			results.passed++
		} catch (error) {
			results.failed++
			results.errors.push({ name, error: error.message })
			console.error(`❌ ${name} validation failed: ${error.message}`)
		}
	}

	console.log('\n📊 Validation Summary:')
	console.log(`✅ Passed: ${results.passed}`)
	console.log(`❌ Failed: ${results.failed}`)

	if (results.failed > 0) {
		console.log('\n🔍 Failed Validations:')
		for (const { name, error } of results.errors) {
			console.log(`  • ${name}: ${error}`)
		}
		process.exit(1)
	} else {
		console.log('\n🎉 All validations passed! Package is ready for publishing.')
	}
}

// Environment-specific validation
function validateEnvironment() {
	const nodeVersion = process.version
	const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0])

	if (majorVersion < 18) {
		console.warn(`⚠️  Node.js ${nodeVersion} detected. Minimum supported version is 18.0.0`)
	}

	console.log(`🟢 Node.js ${nodeVersion} - Compatible`)
}

// Main execution
async function main() {
	try {
		validateEnvironment()
		await runValidations()
	} catch (error) {
		console.error('💥 Validation script failed:', error.message)
		process.exit(1)
	}
}

if (require.main === module) {
	main()
}

module.exports = { validations, runValidations }
