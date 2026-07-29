// @vitest-environment happy-dom
import { expect, test, vi } from 'vitest'
import type { Payload } from '../types.js'
import { THEMES } from '../theme.js'

const PAYLOAD: Payload = {
	initData: 'user=%7B%22id%22%3A1%7D',
	initDataUnsafe: { user: { id: 1 } },
	current: { id: 1, first_name: 'Ann' },
	theme: 'light',
	themes: THEMES,
	platform: 'tdesktop',
	version: '7.0',
	startParam: '',
	overrides: {},
	browser: false,
	panel: false,
	eruda: false,
	endpoint: '/__tma/state',
	usersEndpoint: '/__tma/users',
}

async function createApp(payload: Payload = PAYLOAD) {
	vi.resetModules()
	document.getElementById('tma-panel')?.remove()
	const { initTheme } = await import('./theme.js')
	const { createWebApp } = await import('./webapp.js')
	initTheme(payload)
	return { app: createWebApp(payload), viewport: await import('./viewport.js') }
}

const supports = async (version: string, want: string) => (await createApp({ ...PAYLOAD, version })).app.isVersionAtLeast(want)

test('reads the viewport through getters, so a value taken before the app is ready is never stale', async () => {
	const { app, viewport } = await createApp()
	const before = app.viewportHeight

	viewport.setKeyboard(true)

	expect(app.viewportHeight).toBeLessThan(before)
	expect(app.viewportHeight).toBe(viewport.height())
})

test('exposes the heights as accessors rather than copied numbers', async () => {
	const { app } = await createApp()

	expect(typeof Object.getOwnPropertyDescriptor(app, 'viewportHeight')?.get).toBe('function')
	expect(typeof Object.getOwnPropertyDescriptor(app, 'viewportStableHeight')?.get).toBe('function')
})

test('gates features on the version the panel is set to', async () => {
	expect(await supports('7.0', '6.0')).toBe(true)
	expect(await supports('7.0', '7.0')).toBe(true)
	expect(await supports('7.0', '7.1')).toBe(false)
	expect(await supports('7.0', '8.0')).toBe(false)
})

test('compares the minor as a number, not as text, so 7.10 is newer than 7.9', async () => {
	expect(await supports('7.10', '7.9')).toBe(true)
	expect(await supports('7.9', '7.10')).toBe(false)
})

test('treats a missing minor as zero, the way a client reporting plain 8 would', async () => {
	expect(await supports('8', '8.0')).toBe(true)
	expect(await supports('8', '8.1')).toBe(false)
})

test('prints every haptic call, since a browser has nothing to vibrate', async () => {
	const { app } = await createApp()
	const info = vi.spyOn(console, 'info').mockImplementation(() => {})

	app.HapticFeedback.impactOccurred('heavy')
	app.HapticFeedback.notificationOccurred('success')
	app.HapticFeedback.selectionChanged()

	expect(info.mock.calls.flat()).toEqual(['[tma] haptic → impact: heavy', '[tma] haptic → notification: success', '[tma] haptic → selection'])
	info.mockRestore()
})

test('returns the haptic object, so a chained call does not hit undefined', async () => {
	const { app } = await createApp()
	vi.spyOn(console, 'info').mockImplementation(() => {})

	expect(app.HapticFeedback.impactOccurred('light')).toBe(app.HapticFeedback)
	expect(app.HapticFeedback.selectionChanged()).toBe(app.HapticFeedback)
	vi.restoreAllMocks()
})

test('declares both safe area insets, an app reading top must not hit undefined', async () => {
	const { app } = await createApp()

	expect(app.safeAreaInset).toEqual({ top: 0, bottom: 0, left: 0, right: 0 })
	expect(app.contentSafeAreaInset).toEqual({ top: 0, bottom: 0, left: 0, right: 0 })
})

test('hands out its own inset objects, so an app writing into one cannot spoil the other', async () => {
	const { app } = await createApp()

	app.safeAreaInset.top = 44

	expect(app.contentSafeAreaInset.top).toBe(0)
	expect((await createApp()).app.safeAreaInset.top).toBe(0)
})

test('reports isExpanded live, not as it was when the mock was built', async () => {
	const { app, viewport } = await createApp()
	expect(app.isExpanded).toBe(true)

	viewport.setExpanded(false)

	expect(app.isExpanded).toBe(false)
})

test('expand() actually expands, so an app that asks for room gets it', async () => {
	const { app, viewport } = await createApp()
	viewport.setExpanded(false)
	const collapsed = app.viewportHeight

	app.expand()

	expect(app.isExpanded).toBe(true)
	expect(app.viewportHeight).toBeGreaterThan(collapsed)
})

test('fires viewportChanged when the app expands, the way the client does', async () => {
	const { app, viewport } = await createApp()
	viewport.setExpanded(false)
	const changed = vi.fn()
	app.onEvent('viewportChanged', changed)

	app.expand()

	expect(changed).toHaveBeenCalledWith({ isStateStable: true })
})

test('keeps the stable height apart from the one the keyboard shrinks', async () => {
	const { app, viewport } = await createApp()

	viewport.setKeyboard(true)

	expect(app.viewportHeight).toBeLessThan(app.viewportStableHeight)
	expect(app.viewportStableHeight).toBe(window.innerHeight)
})
