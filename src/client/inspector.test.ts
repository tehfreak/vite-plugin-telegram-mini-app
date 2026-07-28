// @vitest-environment happy-dom
import { beforeEach, expect, test, vi } from 'vitest'

const DARK = { section_bg_color: '#17212b', text_color: '#f5f5f5', secondary_bg_color: '#232e3c' }
const LIGHT = { section_bg_color: '#ffffff', text_color: '#000000', secondary_bg_color: '#f4f4f5' }

const HOST = 'tma-panel'

type WebApp = { initData?: string; themeParams?: Record<string, string>; onEvent?: (event: string, handler: () => void) => void }

const holder = window as unknown as { Telegram?: { WebApp?: WebApp } }

function hash(params: Record<string, string>) {
	location.hash = `#${new URLSearchParams({ tgWebAppData: 'user=%7B%22id%22%3A1%7D&auth_date=1700000000&hash=abc', ...params })}`
}

async function mount(): Promise<HTMLElement> {
	vi.resetModules()
	document.getElementById(HOST)?.remove()
	const { mountInspector } = await import('./inspector.js')
	mountInspector()
	return document.getElementById(HOST)!.shadowRoot!.querySelector<HTMLElement>('[data-tma-panel]')!
}

const press = (badge: HTMLElement) => {
	for (const type of ['pointerdown', 'pointerup']) {
		badge.dispatchEvent(Object.assign(new Event(type), { clientX: 0, clientY: 0, pointerId: 1 }))
	}
}

beforeEach(() => {
	delete holder.Telegram
	sessionStorage.clear()
	localStorage.clear()
	location.hash = ''
})

test('paints the badge before the first open, off the launch params', async () => {
	hash({ tgWebAppThemeParams: JSON.stringify(DARK) })

	const badge = await mount()

	expect(badge.style.background).toBe(DARK.section_bg_color)
	expect(badge.style.color).toBe(DARK.text_color)
})

test('paints the badge before the first open, off window.Telegram.WebApp', async () => {
	holder.Telegram = { WebApp: { initData: 'user=%7B%22id%22%3A1%7D', themeParams: DARK } }

	const badge = await mount()

	expect(badge.style.background).toBe(DARK.section_bg_color)
})

test('prefers the palette the client published over the one in the address hash', async () => {
	hash({ tgWebAppThemeParams: JSON.stringify(LIGHT) })
	holder.Telegram = { WebApp: { themeParams: DARK } }

	const badge = await mount()

	expect(badge.style.background).toBe(DARK.section_bg_color)
})

test('stays white when the client published no palette at all', async () => {
	hash({})

	const badge = await mount()

	expect(badge.style.background).toBe('#ffffff')
	expect(badge.style.color).toBe('#000000')
})

test('repaints on themeChanged, without waiting for the panel to be opened', async () => {
	const app: WebApp = { themeParams: { ...LIGHT } }
	const handlers = new Map<string, () => void>()
	app.onEvent = (event, handler) => void handlers.set(event, handler)
	holder.Telegram = { WebApp: app }

	const badge = await mount()
	expect(badge.style.background).toBe(LIGHT.section_bg_color)

	app.themeParams = DARK
	handlers.get('themeChanged')!()

	expect(badge.style.background).toBe(DARK.section_bg_color)
	expect(badge.style.color).toBe(DARK.text_color)
})

test('survives a client that publishes no onEvent', async () => {
	holder.Telegram = { WebApp: { themeParams: DARK } }

	await expect(mount()).resolves.toBeTruthy()
})

test('paints the panel contents too, once it is opened', async () => {
	hash({ tgWebAppThemeParams: JSON.stringify(DARK) })
	const badge = await mount()
	const shell = badge.nextElementSibling as HTMLElement
	expect(shell.style.display).toBe('none')

	press(badge)

	expect(shell.style.display).toBe('flex')
	expect(shell.style.background).toBe(DARK.section_bg_color)

	const tabs = [...shell.querySelectorAll<HTMLElement>('button')].filter((button) => button.dataset.active !== undefined)
	expect(tabs.length).toBeGreaterThan(0)
	expect(tabs.find((tab) => tab.dataset.active === 'true')!.style.background).toBe(DARK.secondary_bg_color)
	expect(tabs.find((tab) => tab.dataset.active === 'false')!.style.background).toBe('transparent')
})
