import { expect, test } from 'vitest'
import { THEMES } from '../theme.js'

const properties = new Map<string, string>()

Object.assign(globalThis, {
	window: { matchMedia: () => ({ matches: false, addEventListener: () => {} }) },
	document: { documentElement: { style: { setProperty: (name: string, value: string) => properties.set(name, value) } } },
})

const { applyThemeVariables } = await import('./theme.js')

test('publishes the palette as the CSS variables telegram-web-app.js defines', () => {
	applyThemeVariables({ name: 'dark', params: THEMES.dark })

	expect(properties.get('--tg-theme-bg-color')).toBe(THEMES.dark.bg_color)
	expect(properties.get('--tg-theme-secondary-bg-color')).toBe(THEMES.dark.secondary_bg_color)
	expect(properties.get('--tg-theme-section-separator-color')).toBe(THEMES.dark.section_separator_color)
	expect([...properties.keys()].every((name) => name.startsWith('--tg-theme-') && !name.includes('_'))).toBe(true)
})
