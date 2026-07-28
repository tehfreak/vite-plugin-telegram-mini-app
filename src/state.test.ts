import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, expect, test } from 'vitest'
import { type State, patchState, readState, writeState } from './state.js'

const current: State = { user: { id: 1, first_name: 'Ann' }, overrides: { theme: 'dark', platform: 'ios' } }

const dir = mkdtempSync(join(tmpdir(), 'tma-state-'))
let counter = 0
const file = () => join(dir, `nested-${counter++}`, 'state.json')

afterAll(() => rmSync(dir, { recursive: true, force: true }))

test('resets the overrides on an explicit null, which merging alone cannot do', () => {
	expect(patchState(current, { overrides: null }).overrides).toEqual({})
})

test('merges the overrides key by key, leaving the untouched ones alone', () => {
	expect(patchState(current, { overrides: { platform: 'android' } }).overrides).toEqual({ theme: 'dark', platform: 'android' })
})

test('keeps the identity when the patch says nothing about it', () => {
	expect(patchState(current, { overrides: { expired: true } }).user).toEqual(current.user)
})

test('tells an omitted user from an explicit null', () => {
	expect(patchState(current, {}).user).toEqual(current.user)
	expect(patchState(current, { user: null }).user).toBeNull()
})

test('reads back what it wrote, creating the cache directory on the way', () => {
	const path = file()

	writeState(path, current)

	expect(readState(path)).toEqual(current)
})

test('starts empty when nothing was ever selected', () => {
	expect(readState(file())).toEqual({ user: null, overrides: {} })
})

test('starts empty on a damaged file, rather than taking the dev server down', () => {
	const path = file()
	writeState(path, current)
	writeFileSync(path, '{"user": {"id": 1')

	expect(readState(path)).toEqual({ user: null, overrides: {} })
})

test('fills in the halves an older file is missing', () => {
	const path = file()
	writeState(path, current)
	writeFileSync(path, JSON.stringify({ user: { id: 2, first_name: 'Bob' } }))

	expect(readState(path)).toEqual({ user: { id: 2, first_name: 'Bob' }, overrides: {} })
})
