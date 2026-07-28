// @vitest-environment happy-dom
import { beforeEach, expect, test, vi } from 'vitest'
import { snapshot, tabStrip } from './readout.js'

const KEY = 'tma-test-tab'
const TITLES = ['identity', 'environment', 'data']

const tabs = (strip: HTMLElement) => [...strip.children] as HTMLElement[]

beforeEach(() => sessionStorage.clear())

test('remembers the active tab, because switching identity reloads the page', () => {
	tabs(tabStrip(KEY, TITLES, () => {}).strip)[2]!.click()

	const reopened = tabStrip(KEY, TITLES, () => {})

	expect(reopened.active).toBe(2)
	expect(tabs(reopened.strip)[2]!.dataset.active).toBe('true')
	expect(tabs(reopened.strip)[0]!.dataset.active).toBe('false')
})

test('opens on the first tab when nothing was stored yet', () => {
	expect(tabStrip(KEY, TITLES, () => {}).active).toBe(0)
})

test('hands the picked index to the caller', () => {
	const onSelect = vi.fn()

	tabs(tabStrip(KEY, TITLES, onSelect).strip)[1]!.click()

	expect(onSelect).toHaveBeenCalledWith(1)
})

test('snapshot marks methods instead of dropping them, so the dump shows the whole surface', () => {
	expect(snapshot({ ready: () => {}, initData: 'x', isExpanded: true })).toEqual({ ready: 'ƒ()', initData: 'x', isExpanded: true })
})

test('snapshot keeps primitives and null as they are', () => {
	expect(snapshot(null)).toBeNull()
	expect(snapshot(0)).toBe(0)
	expect(snapshot('')).toBe('')
})

test('snapshot walks into arrays', () => {
	expect(snapshot([1, () => {}, { a: 2 }])).toEqual([1, 'ƒ()', { a: 2 }])
})

test('snapshot stops at the fourth level, so a self referencing WebApp cannot hang the panel', () => {
	const looping: Record<string, unknown> = { name: 'root' }
	looping.self = looping

	expect(snapshot(looping)).toEqual({ name: 'root', self: { name: 'root', self: { name: 'root', self: { name: 'root', self: '…' } } } })
})

test('snapshot survives a property that throws when read', () => {
	const hostile = {
		get boom() {
			throw new Error('nope')
		},
		fine: 1,
	}

	expect(snapshot(hostile)).toEqual({ boom: '⚠ unreadable', fine: 1 })
})

test('ignores a stored index that no longer points at a tab', () => {
	sessionStorage.setItem(KEY, '7')
	expect(tabStrip(KEY, TITLES, () => {}).active).toBe(0)

	sessionStorage.setItem(KEY, 'nonsense')
	expect(tabStrip(KEY, TITLES, () => {}).active).toBe(0)
})
