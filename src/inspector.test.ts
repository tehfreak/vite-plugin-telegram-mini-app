import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const MOCK_ONLY = ['switcher', 'webapp', 'sdk', 'chrome', 'theme', 'viewport', 'haptic']

function graph(entry: string, seen = new Set<string>()): Set<string> {
	if (seen.has(entry)) return seen
	seen.add(entry)

	const source = readFileSync(entry, 'utf8')
	for (const match of source.matchAll(/from ['"](\.[^'"]+)['"]/g)) {
		const relative = match[1]!
		graph(resolve(dirname(entry), relative), seen)
	}

	return seen
}

describe('inspector entry point', () => {
	const dist = join(import.meta.dirname, '..', 'dist')

	it('does not drag in mock code', () => {
		const files = [...graph(join(dist, 'inspector.js'))].map((file) => file.replaceAll('\\', '/'))
		const leaked = MOCK_ONLY.filter((name) => files.some((file) => file.endsWith(`/client/${name}.js`)))
		expect(leaked).toEqual([])
	})

	it('still includes the panel itself and the environment reader', () => {
		const files = [...graph(join(dist, 'inspector.js'))].map((file) => file.replaceAll('\\', '/'))
		expect(files.some((file) => file.endsWith('/client/inspector.js'))).toBe(true)
		expect(files.some((file) => file.endsWith('/client/environment.js'))).toBe(true)
	})
})
