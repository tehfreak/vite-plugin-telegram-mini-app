import { element } from './dom.js'

export type Rows = [string, unknown][]

const format = (value: unknown) => {
	if (value === undefined || value === null) return '—'
	return typeof value === 'string' ? value || '""' : (JSON.stringify(value, null, 2) ?? String(value))
}

export const heading = (text: string) => element('div', 'margin:10px 4px 4px;font-size:10px;letter-spacing:.06em;text-transform:uppercase;opacity:.6', text)

export function table(rows: Rows): HTMLElement {
	if (rows.length === 0) return element('div', 'padding:4px;font-size:11px;opacity:.6', '—')

	const wrap = element('div', 'font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:11px')
	for (const [key, value] of rows) {
		const line = element('div', 'display:flex;gap:8px;padding:3px 4px;border-top:1px solid rgba(127,127,127,.25)')
		line.append(element('div', 'flex:0 0 40%;opacity:.6;word-break:break-all', key), element('div', 'flex:1;word-break:break-all', format(value)))
		wrap.append(line)
	}
	return wrap
}

export function parseJson(raw: string | null | undefined): Record<string, unknown> | null {
	if (!raw) return null
	try {
		return JSON.parse(raw) as Record<string, unknown>
	} catch {
		return null
	}
}

export function initDataRows(raw: string): { user: Rows; init: Rows } {
	const params = new URLSearchParams(raw)
	const user = parseJson(params.get('user'))
	const authDate = Number(params.get('auth_date'))
	const init: Rows = []

	for (const [key, value] of params) {
		if (key === 'user') continue
		init.push([key, key === 'auth_date' && authDate ? `${value} (${((Date.now() / 1000 - authDate) / 60).toFixed(0)} min ago)` : value])
	}

	return { user: user ? Object.entries(user) : [], init }
}

/** The active tab is remembered because switching identity reloads the page. */
export function tabStrip(key: string, titles: string[], onSelect: (index: number) => void): { strip: HTMLElement; active: number } {
	const stored = Number(sessionStorage.getItem(key) ?? 0)
	const active = Number.isInteger(stored) && stored >= 0 && stored < titles.length ? stored : 0
	const strip = element('div', 'display:flex;gap:4px;margin-bottom:6px')

	titles.forEach((title, index) => {
		const tab = element('button', 'flex:1;padding:5px 4px;border-radius:8px;font-size:10px;letter-spacing:.04em;text-transform:uppercase', title)
		tab.dataset.active = String(index === active)
		tab.addEventListener('click', () => {
			sessionStorage.setItem(key, String(index))
			onSelect(index)
		})
		strip.append(tab)
	})

	return { strip, active }
}

export function copyButton(text: string, title = 'Copy initData'): HTMLButtonElement {
	const button = element('button', 'display:block;width:100%;margin-top:6px;padding:8px;border-radius:8px;font-size:12px', title)
	button.addEventListener('click', () => {
		void navigator.clipboard?.writeText(text)
		button.textContent = text ? 'Copied' : 'Nothing to copy'
		setTimeout(() => (button.textContent = title), 1500)
	})
	return button
}

export function snapshot(value: unknown, depth = 0): unknown {
	if (typeof value === 'function') return 'ƒ()'
	if (value === null || typeof value !== 'object') return value
	if (depth > 3) return '…'
	if (Array.isArray(value)) return value.map((item) => snapshot(item, depth + 1))

	const result: Record<string, unknown> = {}
	for (const key of Object.keys(value as object)) {
		try {
			result[key] = snapshot((value as Record<string, unknown>)[key], depth + 1)
		} catch {
			result[key] = '⚠ unreadable'
		}
	}
	return result
}

export function jsonBlock(value: unknown): HTMLElement {
	const block = element(
		'pre',
		'margin:0;padding:8px;border-radius:8px;background:rgba(127,127,127,.12);font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:11px;line-height:1.5;white-space:pre;overflow-x:auto;max-width:100%',
	)
	block.textContent = JSON.stringify(value, null, 2)
	return block
}
