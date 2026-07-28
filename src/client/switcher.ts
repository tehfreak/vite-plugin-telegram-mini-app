import type { Overrides, Payload, RosterPage, TelegramUser, ThemeSetting } from '../types.js'
import { createPanel, element } from './dom.js'
import { copyButton, heading, jsonBlock, snapshot, tabStrip } from './readout.js'
import { currentSetting, currentTheme, onTheme, setTheme } from './theme.js'
import { height as viewportHeight, keyboardShown, setKeyboard, stableHeight as viewportStableHeight } from './viewport.js'

const PLATFORMS = ['tdesktop', 'android', 'ios', 'web']
const VERSIONS = ['6.0', '7.0', '8.0']
const THEME_SETTINGS: ThemeSetting[] = ['light', 'dark', 'auto']

const newcomer = (): TelegramUser => ({ id: 900_000_000 + Math.floor(Math.random() * 1_000_000), first_name: 'Dev Newcomer' })

const label = (user: TelegramUser | null) => (user ? [user.first_name, user.last_name].filter(Boolean).join(' ') : 'anonymous')

async function patch(payload: Payload, body: { user?: TelegramUser | null; overrides?: Overrides | null }, reload = true) {
	await fetch(payload.endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
	if (reload) location.reload()
}

export function mountSwitcher(payload: Payload, eruda?: () => void) {
	// Loaded on first open: the roster can be large and may hit a database.
	let page: RosterPage | null = null
	let query = ''
	let timer = 0

	async function loadRoster() {
		const response = await fetch(`${payload.usersEndpoint}?q=${encodeURIComponent(query)}`)
		page = (await response.json()) as RosterPage
		renderList()
	}

	const shell = createPanel({ eruda })
	if (!shell) return
	const { badge, panel, onOpen, paint: paintPanel } = shell
	badge.title = payload.browser ? 'tma · as from a browser' : `tma · ${label(payload.current)}`
	onOpen(() => {
		if (!page) void loadRoster()
	})

	const row = (title: string, subtitle: string, active: boolean, onPick: () => void) => {
		const button = element('button', `display:block;width:100%;text-align:left;padding:8px;margin-bottom:4px;border-radius:8px;font-size:13px`)
		button.dataset.active = String(active)
		button.append(element('div', 'font-weight:600', title))
		if (subtitle) button.append(element('div', 'font-size:11px;opacity:.6', subtitle))
		button.addEventListener('click', onPick)
		return button
	}

	const chips = (values: string[], current: string, onPick: (value: string) => void) => {
		const strip = element('div', 'display:flex;flex-wrap:wrap;gap:4px;margin-bottom:4px')
		for (const value of values) {
			const chip = element('button', 'padding:4px 10px;border-radius:8px;font-size:12px')
			chip.dataset.active = String(value === current)
			chip.textContent = value
			chip.addEventListener('click', () => onPick(value))
			strip.append(chip)
		}
		return strip
	}

	const toggle = (title: string, subtitle: string, on: boolean, onPick: () => void) => row(`${on ? '● ' : '○ '}${title}`, subtitle, on, onPick)

	// Kept out of build(): recreating the input would drop focus and caret on every keystroke.
	const search = element('input', 'width:100%;margin-bottom:6px;padding:6px 8px;border-radius:8px;border:1px solid currentColor;background:transparent;color:inherit;font-size:12px') as HTMLInputElement
	search.placeholder = 'Search by name, @username or id'
	search.addEventListener('input', () => {
		query = search.value
		clearTimeout(timer)
		timer = window.setTimeout(() => void loadRoster(), 200)
	})

	const list = element('div', '')

	function renderList() {
		list.replaceChildren()

		if (!page) list.append(element('div', 'padding:8px;font-size:12px;opacity:.6', 'Loading…'))
		else if (page.total === 0) list.append(element('div', 'padding:8px;font-size:12px;opacity:.6', query ? 'Nobody found' : 'Roster is empty — pass `users` to the plugin'))

		for (const user of page?.users ?? []) {
			const subtitle = [user.username ? `@${user.username}` : '', `id ${user.id}`].filter(Boolean).join(' · ')
			list.append(row(label(user), subtitle, String(payload.current?.id) === String(user.id), () => void patch(payload, { user })))
		}

		if (page && page.total > page.users.length) list.append(element('div', 'padding:4px 8px 8px;font-size:11px;opacity:.6', `Showing ${page.users.length} of ${page.total} — narrow the search`))

		list.append(row('Unregistered', 'random id, for the onboarding path', false, () => void patch(payload, { user: newcomer() })))
		list.append(row('Anonymous', 'empty initData: keyboard button or inline mode', payload.current === null, () => void patch(payload, { user: null })))

		paint()
	}

	function buildIdentity() {
		panel.append(search, list)
		if (!page) void loadRoster()
		renderList()
	}

	function buildEnvironment() {
		panel.append(heading('mode'))
		panel.append(toggle('As from a browser', 'no mock at all: Telegram handed over nothing', payload.browser, () => patch(payload, { overrides: { browser: !payload.browser } })))

		panel.append(heading('theme'))
		panel.append(
			chips(THEME_SETTINGS, currentSetting(), (value) => {
				setTheme(value as ThemeSetting)
				void patch(payload, { overrides: { theme: value as ThemeSetting } }, false)
				build()
			}),
		)
		panel.append(element('div', 'padding:0 4px 4px;font-size:11px;opacity:.6', 'auto — follow the browser (prefers-color-scheme)'))

		panel.append(heading('viewport'))
		panel.append(
			toggle('Keyboard', 'viewportHeight < stable, isStateStable: false', keyboardShown(), () => {
				setKeyboard(!keyboardShown())
				build()
			}),
		)

		panel.append(heading('signature'))
		panel.append(toggle('Expired', 'auth_date a day old — the backend must reject it', payload.overrides.expired === true, () => patch(payload, { overrides: { expired: !payload.overrides.expired } })))

		panel.append(heading('platform'))
		panel.append(chips(PLATFORMS, payload.platform, (value) => void patch(payload, { overrides: { platform: value } })))

		panel.append(heading('version'))
		panel.append(chips(VERSIONS, payload.version, (value) => void patch(payload, { overrides: { version: value } })))

		if (Object.keys(payload.overrides).length > 0) {
			panel.append(element('div', 'height:1px;margin:8px 0;opacity:.15;background:currentColor'))
			panel.append(row('Reset overrides', Object.keys(payload.overrides).join(', '), false, () => void patch(payload, { overrides: null })))
		}
	}

	function buildData() {
		const live = (window as unknown as { Telegram?: { WebApp?: unknown } }).Telegram?.WebApp

		const observed = {
			initData: payload.browser ? ((live as { initData?: string } | undefined)?.initData ?? '') : payload.initData,
			initDataParsed: Object.fromEntries(new URLSearchParams(payload.browser ? '' : payload.initData)),
			webApp: live ? snapshot(live) : null,
		}

		const plugin = {
			installed: !payload.browser,
			overrides: payload.overrides,
			theme: currentTheme(),
			viewport: { height: viewportHeight(), stableHeight: viewportStableHeight(), isStateStable: !keyboardShown() },
		}

		panel.append(heading('everything the app sees'))
		panel.append(jsonBlock(observed))
		panel.append(copyButton(JSON.stringify(observed, null, 2), 'Copy JSON'))
		panel.append(copyButton(payload.initData))

		panel.append(heading('plugin state'))
		panel.append(jsonBlock(plugin))
	}

	function build() {
		panel.replaceChildren()

		panel.append(element('div', 'padding:2px 4px 6px;font-size:13px;font-weight:600', payload.browser ? 'As from a browser' : label(payload.current)))
		if (payload.browser) panel.append(element('div', 'padding:0 4px 6px;font-size:11px;opacity:.6', 'Mock is off: the app sees a plain browser, as if the link were opened outside Telegram.'))

		const { strip, active } = tabStrip('tma-panel-tab', ['identity', 'environment', 'data'], () => build())
		panel.append(strip)

		if (active === 0) buildIdentity()
		else if (active === 1) buildEnvironment()
		else buildData()

		paint()
	}

	function paint() {
		paintPanel(currentTheme().params)
	}

	onTheme(paint)
	build()
}
