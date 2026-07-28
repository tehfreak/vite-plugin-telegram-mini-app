// @vitest-environment happy-dom
import { expect, test, vi } from 'vitest'

async function viewport() {
	vi.resetModules()
	return import('./viewport.js')
}

test('starts expanded, the way a mini app opens on the desktop', async () => {
	const { isExpanded, height, stableHeight } = await viewport()

	expect(isExpanded()).toBe(true)
	expect(stableHeight()).toBe(window.innerHeight)
	expect(height()).toBe(window.innerHeight)
})

test('collapsing shrinks the stable height too, not just the current one', async () => {
	const { setExpanded, height, stableHeight } = await viewport()
	const full = stableHeight()

	setExpanded(false)

	expect(stableHeight()).toBeLessThan(full)
	expect(height()).toBe(stableHeight())
})

test('the keyboard shrinks the current height below the collapsed stable one', async () => {
	const { setExpanded, setKeyboard, height, stableHeight } = await viewport()

	setExpanded(false)
	setKeyboard(true)

	expect(height()).toBeLessThan(stableHeight())
})

test('expanding gives the full height back', async () => {
	const { setExpanded, isExpanded, stableHeight } = await viewport()

	setExpanded(false)
	setExpanded(true)

	expect(isExpanded()).toBe(true)
	expect(stableHeight()).toBe(window.innerHeight)
})

test('tells the listeners, so the app hears about the resize', async () => {
	const { setExpanded, onViewport } = await viewport()
	const listener = vi.fn()
	onViewport(listener)

	setExpanded(false)

	expect(listener).toHaveBeenCalled()
})
