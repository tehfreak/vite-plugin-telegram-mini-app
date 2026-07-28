import { expect, test } from 'vitest'
import { type State, patchState } from './state.js'

const current: State = { user: { id: 1, first_name: 'Ann' }, overrides: { theme: 'dark', platform: 'ios' } }

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
