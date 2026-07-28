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
	startParam: '',
	overrides: {},
	browser: false,
	panel: true,
	eruda: false,
	endpoint: '/__tma/state',
	usersEndpoint: '/__tma/users',
}

const roster = { users: [{ id: 1, first_name: 'Ann' }], total: 1 }

let fetched: ReturnType<typeof vi.fn>

async function mount(payload: Payload = PAYLOAD): Promise<HTMLElement> {
	vi.resetModules()
	document.getElementById('tma-panel')?.remove()
	const { initTheme } = await import('./theme.js')
	const { mountSwitcher } = await import('./switcher.js')
	initTheme(payload)
	mountSwitcher(payload)
	return document.getElementById('tma-panel')!.shadowRoot!.querySelector<HTMLElement>('[data-tma-panel]')!
}

const open = (badge: HTMLElement) => {
	for (const type of ['pointerdown', 'pointerup']) {
		badge.dispatchEvent(Object.assign(new Event(type), { clientX: 0, clientY: 0, pointerId: 1 }))
	}
	return badge.nextElementSibling as HTMLElement
}

const tab = (shell: HTMLElement, title: string) => [...shell.querySelectorAll('button')].find((button) => button.textContent === title)!

const environment = (shell: HTMLElement) => tab(shell, 'environment').click()

const row = (shell: HTMLElement, title: string) => [...shell.querySelectorAll('button')].find((button) => button.textContent?.includes(title))!

const deepLink = (shell: HTMLElement) => row(shell, 'Deep link')

const collapsed = (shell: HTMLElement) => row(shell, 'Collapsed')

const field = (shell: HTMLElement) => shell.querySelector<HTMLInputElement>('input[placeholder="ref-42"]')

const body = (call: unknown[]) => JSON.parse((call[1] as { body: string }).body) as unknown

const stateCalls = () => fetched.mock.calls.filter((call) => call[0] === PAYLOAD.endpoint)

beforeEach(() => {
	sessionStorage.clear()
	localStorage.clear()
	fetched = vi.fn(async () => ({ json: async () => roster }))
	vi.stubGlobal('fetch', fetched)
	vi.spyOn(location, 'reload').mockImplementation(() => {})
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

test('offers no start_param field until the deep link is switched on', async () => {
	const shell = open(await mount())
	environment(shell)

	expect(field(shell)).toBeNull()

	deepLink(shell).click()

	expect(field(shell)).not.toBeNull()
})

test('starts switched on and filled when the page was signed with a start_param', async () => {
	const shell = open(await mount({ ...PAYLOAD, startParam: 'ref-42' }))
	environment(shell)

	expect(field(shell)!.value).toBe('ref-42')
	expect(deepLink(shell).dataset.active).toBe('true')
})

test('saves the typed start_param as an override and reloads', async () => {
	const shell = open(await mount())
	environment(shell)
	deepLink(shell).click()

	const input = field(shell)!
	input.value = 'ref-42'
	input.dispatchEvent(new Event('change'))

	expect(body(stateCalls().at(-1)!)).toEqual({ overrides: { startParam: 'ref-42' } })
	await vi.waitFor(() => expect(location.reload).toHaveBeenCalled())
})

test('drops the start_param when the deep link is switched off', async () => {
	const shell = open(await mount({ ...PAYLOAD, startParam: 'ref-42' }))
	environment(shell)

	deepLink(shell).click()

	expect(body(stateCalls().at(-1)!)).toEqual({ overrides: { startParam: '' } })
	expect(field(shell)).toBeNull()
})

test('does not touch the server when the deep link is switched off with nothing to drop', async () => {
	const shell = open(await mount())
	environment(shell)

	deepLink(shell).click()
	deepLink(shell).click()

	expect(stateCalls()).toHaveLength(0)
	expect(location.reload).not.toHaveBeenCalled()
})

test('keeps the start_param box across a rebuild, so a half typed link is not dropped', async () => {
	const shell = open(await mount({ ...PAYLOAD, startParam: 'ref-42' }))
	environment(shell)
	const input = field(shell)!

	input.value = 'ref-4'
	environment(shell)

	expect(field(shell)).toBe(input)
	expect(input.value).toBe('ref-4')
})

test('collapses the viewport from the panel, without asking the server', async () => {
	const shell = open(await mount())
	environment(shell)
	const { isExpanded } = await import('./viewport.js')

	collapsed(shell).click()

	expect(isExpanded()).toBe(false)
	expect(collapsed(shell).dataset.active).toBe('true')
	expect(stateCalls()).toHaveLength(0)
})

test('keeps the search box across a rebuild, so the typed text is not dropped', async () => {
	const badge = await mount()
	const shell = open(badge)
	const search = shell.querySelector('input')!
	search.value = 'ann'

	tab(shell, 'identity').click()

	expect(shell.querySelector('input')).toBe(search)
	expect(shell.querySelector('input')!.value).toBe('ann')
})
