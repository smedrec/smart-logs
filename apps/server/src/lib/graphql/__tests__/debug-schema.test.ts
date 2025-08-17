/**
 * Debug Schema Test
 */

import { makeExecutableSchema } from '@graphql-tools/schema'
import { describe, expect, it } from 'vitest'

import { resolvers } from '../resolvers/index'
import { typeDefs } from '../schema'

describe('Debug Schema', () => {
	it('should have typeDefs', () => {
		console.log('typeDefs:', typeof typeDefs, typeDefs ? 'defined' : 'undefined')
		expect(typeDefs).toBeDefined()
		expect(typeof typeDefs).toBe('string')
	})

	it('should have resolvers', () => {
		console.log('resolvers:', typeof resolvers, resolvers ? 'defined' : 'undefined')
		console.log('resolvers keys:', Object.keys(resolvers || {}))
		expect(resolvers).toBeDefined()
		expect(typeof resolvers).toBe('object')
	})

	it('should create schema', () => {
		try {
			const schema = makeExecutableSchema({
				typeDefs,
				resolvers,
			})
			console.log('schema created successfully:', schema ? 'yes' : 'no')
			expect(schema).toBeDefined()
		} catch (error) {
			console.error('Schema creation error:', error)
			throw error
		}
	})
})
