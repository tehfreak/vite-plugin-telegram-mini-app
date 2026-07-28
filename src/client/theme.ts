import type { Payload, ThemeName, ThemeSetting } from '../types.js'

// Held at module level: an unreferenced MediaQueryList can be collected along with its listener.
const query = window.matchMedia('(prefers-color-scheme: dark)')

export type Theme = { name: ThemeName; params: Record<string, string> }

let setting: ThemeSetting = 'auto'
let palettes: Record<ThemeName, Record<string, string>>
const listeners = new Set<(theme: Theme) => void>()

const notify = () => {
	for (const listener of listeners) listener(currentTheme())
}

export function initTheme(payload: Payload) {
	setting = payload.theme
	palettes = payload.themes
	query.addEventListener('change', () => {
		if (setting === 'auto') notify()
	})
}

export function currentSetting(): ThemeSetting {
	return setting
}

export function currentTheme(): Theme {
	const name: ThemeName = setting === 'auto' ? (query.matches ? 'dark' : 'light') : setting
	return { name, params: palettes[name] }
}

export function setTheme(next: ThemeSetting) {
	setting = next
	notify()
}

export function onTheme(listener: (theme: Theme) => void) {
	listeners.add(listener)
}

export function applyThemeVariables(theme: Theme) {
	for (const [key, value] of Object.entries(theme.params)) {
		document.documentElement.style.setProperty(`--tg-theme-${key.replaceAll('_', '-')}`, value)
	}
}
