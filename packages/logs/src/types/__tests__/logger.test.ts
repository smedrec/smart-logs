import { describe, expect, it } from 'vitest'

import { LogLevel, LogLevelUtils } from '../logger.js'

describe('LogLevel and LogLevelUtils', () => {
	describe('LogLevel enum', () => {
		it('should have all required log levels', () => {
			expect(LogLevel.DEBUG).toBe('debug')
			expect(LogLevel.INFO).toBe('info')
			expect(LogLevel.WARN).toBe('warn')
			expect(LogLevel.ERROR).toBe('error')
			expect(LogLevel.FATAL).toBe('fatal')
		})
	})

	describe('LogLevelUtils.compare', () => {
		it('should compare log levels correctly', () => {
			expect(LogLevelUtils.compare(LogLevel.DEBUG, LogLevel.INFO)).toBeLessThan(0)
			expect(LogLevelUtils.compare(LogLevel.INFO, LogLevel.INFO)).toBe(0)
			expect(LogLevelUtils.compare(LogLevel.ERROR, LogLevel.WARN)).toBeGreaterThan(0)
		})

		it('should handle string log levels', () => {
			expect(LogLevelUtils.compare('debug', 'info')).toBeLessThan(0)
			expect(LogLevelUtils.compare('fatal', 'error')).toBeGreaterThan(0)
		})
	})

	describe('LogLevelUtils.meetsMinimum', () => {
		it('should return true when level meets minimum', () => {
			expect(LogLevelUtils.meetsMinimum(LogLevel.ERROR, LogLevel.WARN)).toBe(true)
			expect(LogLevelUtils.meetsMinimum(LogLevel.INFO, LogLevel.INFO)).toBe(true)
		})

		it('should return false when level does not meet minimum', () => {
			expect(LogLevelUtils.meetsMinimum(LogLevel.DEBUG, LogLevel.INFO)).toBe(false)
			expect(LogLevelUtils.meetsMinimum(LogLevel.WARN, LogLevel.ERROR)).toBe(false)
		})
	})

	describe('LogLevelUtils.getLevelsAtOrAbove', () => {
		it('should return correct levels at or above minimum', () => {
			const levels = LogLevelUtils.getLevelsAtOrAbove(LogLevel.WARN)
			expect(levels).toEqual([LogLevel.WARN, LogLevel.ERROR, LogLevel.FATAL])
		})

		it('should return all levels for debug minimum', () => {
			const levels = LogLevelUtils.getLevelsAtOrAbove(LogLevel.DEBUG)
			expect(levels).toEqual([
				LogLevel.DEBUG,
				LogLevel.INFO,
				LogLevel.WARN,
				LogLevel.ERROR,
				LogLevel.FATAL,
			])
		})
	})

	describe('LogLevelUtils.isValidLevel', () => {
		it('should return true for valid log levels', () => {
			expect(LogLevelUtils.isValidLevel('debug')).toBe(true)
			expect(LogLevelUtils.isValidLevel('info')).toBe(true)
			expect(LogLevelUtils.isValidLevel('warn')).toBe(true)
			expect(LogLevelUtils.isValidLevel('error')).toBe(true)
			expect(LogLevelUtils.isValidLevel('fatal')).toBe(true)
		})

		it('should return false for invalid log levels', () => {
			expect(LogLevelUtils.isValidLevel('invalid')).toBe(false)
			expect(LogLevelUtils.isValidLevel('trace')).toBe(false)
			expect(LogLevelUtils.isValidLevel('')).toBe(false)
		})
	})

	describe('LogLevelUtils.parseLevel', () => {
		it('should parse valid log levels', () => {
			expect(LogLevelUtils.parseLevel('debug')).toBe(LogLevel.DEBUG)
			expect(LogLevelUtils.parseLevel('error')).toBe(LogLevel.ERROR)
		})

		it('should throw error for invalid log levels', () => {
			expect(() => LogLevelUtils.parseLevel('invalid')).toThrow('Invalid log level: invalid')
		})
	})
})
