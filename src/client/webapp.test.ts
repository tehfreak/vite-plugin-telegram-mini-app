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
	overrides: {},
	browser: false,
	panel: false,
	eruda: false,
	endpoint: '/__tma/state',
	usersEndpoint: '/__tma/users',
}

async function createApp() {
	vi.resetModules()
	document.getElementById('tma-panel')?.remove()
	const { initTheme } = await import('./theme.js')
	const { createWebApp } = await import('./webapp.js')
	initTheme(PAYLOAD)
	return { app: createWebApp(PAYLOAD), viewport: await import('./viewport.js') }
}

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

test('keeps the stable height apart from the one the keyboard shrinks', async () => {
	const { app, viewport } = await createApp()

	viewport.setKeyboard(true)

	expect(app.viewportHeight).toBeLessThan(app.viewportStableHeight)
	expect(app.viewportStableHeight).toBe(window.innerHeight)
})
