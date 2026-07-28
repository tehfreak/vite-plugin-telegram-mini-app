// @vitest-environment happy-dom
import { beforeEach, expect, test, vi } from 'vitest'
import { tabStrip } from './readout.js'

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

test('ignores a stored index that no longer points at a tab', () => {
	sessionStorage.setItem(KEY, '7')
	expect(tabStrip(KEY, TITLES, () => {}).active).toBe(0)

	sessionStorage.setItem(KEY, 'nonsense')
	expect(tabStrip(KEY, TITLES, () => {}).active).toBe(0)
})
