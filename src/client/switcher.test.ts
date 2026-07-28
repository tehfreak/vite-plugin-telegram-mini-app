// @vitest-environment happy-dom
import { beforeEach, expect, test, vi } from 'vitest'
import { THEMES } from '../theme.js'
import type { Payload } from '../types.js'

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
	panel: true,
	eruda: false,
	endpoint: '/__tma/state',
	usersEndpoint: '/__tma/users',
}

const roster = { users: [{ id: 1, first_name: 'Ann' }], total: 1 }

let fetched: ReturnType<typeof vi.fn>

async function mount(): Promise<HTMLElement> {
	vi.resetModules()
	document.getElementById('tma-panel')?.remove()
	const { initTheme } = await import('./theme.js')
	const { mountSwitcher } = await import('./switcher.js')
	initTheme(PAYLOAD)
	mountSwitcher(PAYLOAD)
	return document.getElementById('tma-panel')!.shadowRoot!.querySelector<HTMLElement>('[data-tma-panel]')!
}

const open = (badge: HTMLElement) => {
	for (const type of ['pointerdown', 'pointerup']) {
		badge.dispatchEvent(Object.assign(new Event(type), { clientX: 0, clientY: 0, pointerId: 1 }))
	}
	return badge.nextElementSibling as HTMLElement
}

beforeEach(() => {
	sessionStorage.clear()
	localStorage.clear()
	fetched = vi.fn(async () => ({ json: async () => roster }))
	vi.stubGlobal('fetch', fetched)
})

test('does not ask the server for the roster until the panel is opened', async () => {
	const badge = await mount()

	expect(fetched).not.toHaveBeenCalled()

	open(badge)

	expect(fetched).toHaveBeenCalledWith(expect.stringContaining(PAYLOAD.usersEndpoint))
})

test('asks for the roster once, not on every open', async () => {
	const badge = await mount()

	const shell = open(badge)
	await vi.waitFor(() => expect(shell.textContent).not.toContain('Loading'))
	open(badge)
	open(badge)

	expect(fetched).toHaveBeenCalledTimes(1)
})
