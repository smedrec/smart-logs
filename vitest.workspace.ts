import { defineWorkspace } from 'vitest/config'
import { glob } from 'zx'

const projects = await glob([
	// All vitest projects
	'{apps,packages}/*/vitest.config{,.node}.ts',
])

export default defineWorkspace(projects)
