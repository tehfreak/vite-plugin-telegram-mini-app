// @vitest-environment happy-dom
import { beforeEach, expect, test, vi } from 'vitest'
import { THEMES } from '../theme.js'
import type { Payload } from '../types.js'

const PAYLOAD: Payload = {
	initData: 'user=%7B%22id%22%3A1%7D&auth_date=1700000000&hash=abc',
	initDataUnsafe: { user: { id: 1 } },
	current: { id: 1, first_name: 'Ann' },
	theme: 'light',
	themes: THEMES,
	platform: 'tdesktop',
	version: '7.0',
	startParam: '',
	overrides: {},
	browser: false,
	panel: true,
	eruda: false,
	endpoint: '/__tma/state',
	usersEndpoint: '/__tma/users',
}

const IN_TELEGRAM = '#tgWebAppVersion=8.0&tgWebAppPlatform=android&tgWebAppThemeParams=%7B%7D'

const holder = window as unknown as { Telegram?: { WebApp?: { initData?: string }; Login?: unknown } }

async function install(payload: Payload = PAYLOAD) {
	vi.resetModules()
	document.getElementById('tma-panel')?.remove()
	const module = await import('./index.js')
	module.install(payload)
	return document.getElementById('tma-panel')?.shadowRoot ?? null
}

const badge = (shadow: ShadowRoot | null) => shadow?.querySelector<HTMLElement>('[data-tma-panel]') ?? null

beforeEach(() => {
	delete holder.Telegram
	location.hash = ''
	sessionStorage.clear()
	localStorage.clear()
})

test('installs no mock inside real telegram, a live user must not be faked', async () => {
	location.hash = IN_TELEGRAM

	await install()

	expect(holder.Telegram).toBeUndefined()
})

test('shows the inspector inside real telegram, not the switcher', async () => {
	location.hash = IN_TELEGRAM

	expect(badge(await install())?.title).toBe('TMA — inspector')
})

test('shows the switcher in a browser, named after the current identity', async () => {
	expect(badge(await install())?.title).toBe('tma · Ann')
})

test('declares window.Telegram.WebApp in a browser, the way telegram-web-app.js does', async () => {
	await install()

	expect(holder.Telegram?.WebApp?.initData).toBe(PAYLOAD.initData)
})

test('keeps what someone else had already put on window.Telegram', async () => {
	const login = { auth: () => {} }
	holder.Telegram = { Login: login }

	await install()

	expect(holder.Telegram?.Login).toBe(login)
	expect(holder.Telegram?.WebApp).toBeDefined()
})

test('installs nothing in browser mode, but keeps the panel to switch back', async () => {
	const shadow = await install({ ...PAYLOAD, browser: true })

	expect(holder.Telegram).toBeUndefined()
	expect(badge(shadow)?.title).toBe('tma · as from a browser')
})

test('leaves no panel behind when it is switched off', async () => {
	expect(badge(await install({ ...PAYLOAD, panel: false }))).toBeNull()
	expect(holder.Telegram?.WebApp).toBeDefined()
})

test('leaves no panel inside telegram either when it is switched off', async () => {
	location.hash = IN_TELEGRAM

	expect(badge(await install({ ...PAYLOAD, panel: false }))).toBeNull()
})

test('offers the console button only when eruda is on', async () => {
	const buttons = (shadow: ShadowRoot | null) => [...(shadow?.querySelectorAll('button') ?? [])].map((button) => button.textContent)

	expect(buttons(await install())).not.toContain('Open console (eruda)')
	expect(buttons(await install({ ...PAYLOAD, eruda: true }))).toContain('Open console (eruda)')
})
