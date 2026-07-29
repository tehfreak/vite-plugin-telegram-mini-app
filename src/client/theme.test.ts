import { beforeEach, expect, test, vi } from 'vitest'
import { THEMES } from '../theme.js'
import type { Payload, ThemeSetting } from '../types.js'

const properties = new Map<string, string>()
const watchers = new Set<() => void>()
const media = { matches: false, addEventListener: (_type: string, handler: () => void) => void watchers.add(handler) }

Object.assign(globalThis, {
	window: { matchMedia: () => media },
	document: { documentElement: { style: { setProperty: (name: string, value: string) => properties.set(name, value) } } },
})

async function theme(setting: ThemeSetting = 'auto') {
	vi.resetModules()
	watchers.clear()
	const module = await import('./theme.js')
	module.initTheme({ theme: setting, themes: THEMES } as Payload)
	return module
}

const systemTurnsDark = () => {
	media.matches = true
	for (const watcher of watchers) watcher()
}

beforeEach(() => {
	media.matches = false
})

test('publishes the palette as the CSS variables telegram-web-app.js defines', async () => {
	const { applyThemeVariables } = await theme()

	applyThemeVariables({ name: 'dark', params: THEMES.dark })

	expect(properties.get('--tg-theme-bg-color')).toBe(THEMES.dark.bg_color)
	expect(properties.get('--tg-theme-secondary-bg-color')).toBe(THEMES.dark.secondary_bg_color)
	expect(properties.get('--tg-theme-section-separator-color')).toBe(THEMES.dark.section_separator_color)
	expect([...properties.keys()].every((name) => name.startsWith('--tg-theme-') && !name.includes('_'))).toBe(true)
})

test('holds the setting the plugin was configured with', async () => {
	const { currentSetting, currentTheme } = await theme('dark')

	expect(currentSetting()).toBe('dark')
	expect(currentTheme()).toEqual({ name: 'dark', params: THEMES.dark })
})

test('follows the browser under auto, since the server cannot see a media query', async () => {
	const { currentTheme } = await theme('auto')
	expect(currentTheme().name).toBe('light')

	media.matches = true

	expect(currentTheme()).toEqual({ name: 'dark', params: THEMES.dark })
})

test('ignores the browser once a theme is pinned', async () => {
	const { currentTheme } = await theme('light')

	media.matches = true

	expect(currentTheme().name).toBe('light')
})

test('tells the listeners when the system theme changes under auto', async () => {
	const { onTheme } = await theme('auto')
	const listener = vi.fn()
	onTheme(listener)

	systemTurnsDark()

	expect(listener).toHaveBeenCalledWith({ name: 'dark', params: THEMES.dark })
})

test('stays quiet when the system changes but the panel pinned a theme', async () => {
	const { onTheme } = await theme('light')
	const listener = vi.fn()
	onTheme(listener)

	systemTurnsDark()

	expect(listener).not.toHaveBeenCalled()
})

test('tells the listeners when the panel switches the theme', async () => {
	const { onTheme, setTheme, currentSetting } = await theme('light')
	const listener = vi.fn()
	onTheme(listener)

	setTheme('dark')

	expect(currentSetting()).toBe('dark')
	expect(listener).toHaveBeenCalledWith({ name: 'dark', params: THEMES.dark })
})

test('tells every listener, not only the one that came last', async () => {
	const { onTheme, setTheme } = await theme('light')
	const first = vi.fn()
	const second = vi.fn()
	onTheme(first)
	onTheme(second)

	setTheme('dark')

	expect(first).toHaveBeenCalledOnce()
	expect(second).toHaveBeenCalledOnce()
})
