import { ICON } from './icon.js'
const BASE_CSS = `
	:host { all: initial }
	* { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif }
	button { font: inherit; cursor: pointer; border: none }
	.pane { pointer-events: auto }
`

const HOST_ID = 'tma-panel'

let root: ShadowRoot | null = null

// Looked up in the document: the plugin and the app load different copies of this module.
export function overlay(): ShadowRoot {
	if (root) return root

	const existing = document.getElementById(HOST_ID)
	if (existing?.shadowRoot) {
		root = existing.shadowRoot
		return root
	}

	const host = document.createElement('div')
	host.id = HOST_ID
	host.style.cssText = 'position:fixed;inset:0;z-index:2147483000;pointer-events:none'

	root = host.attachShadow({ mode: 'open' })
	const style = document.createElement('style')
	style.textContent = BASE_CSS
	root.append(style)

	whenReady(() => document.body.append(host))

	return root
}

export function whenReady(fn: () => void) {
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true })
	else fn()
}

export function element<K extends keyof HTMLElementTagNameMap>(tag: K, css: string, text?: string): HTMLElementTagNameMap[K] {
	const node = document.createElement(tag)
	node.style.cssText = css
	if (text !== undefined) node.textContent = text
	return node
}

export type Panel = {
	badge: HTMLButtonElement
	panel: HTMLDivElement
	onOpen(handler: () => void): void
	paint(params: Record<string, string>): void
}

const BADGE_SIZE = 40
const POSITION_KEY = 'tma-panel-position'
const DRAG_THRESHOLD = 4

type Position = { x: number; y: number }

function readPosition(): Position | null {
	try {
		const raw = localStorage.getItem(POSITION_KEY)
		const parsed = raw ? (JSON.parse(raw) as Partial<Position>) : null
		return typeof parsed?.x === 'number' && typeof parsed?.y === 'number' ? { x: parsed.x, y: parsed.y } : null
	} catch {
		return null
	}
}

export function createPanel(options: { eruda?: () => void } = {}): Panel | null {
	const shadow = overlay()
	if (shadow.querySelector('[data-tma-panel]')) {
		console.warn('[tma] panel already mounted — skipping the second call')
		return null
	}

	const badge = element(
		'button',
		`position:fixed;display:flex;align-items:center;justify-content:center;width:${BADGE_SIZE}px;height:${BADGE_SIZE}px;padding:0;border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,.25);opacity:.92;touch-action:none;cursor:grab`,
	)
	const shell = element('div', 'position:fixed;display:none;flex-direction:column;padding:8px;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.35)')
	const panel = element('div', 'overflow:auto;flex:1;min-height:0')
	const footer = element('div', 'display:flex;flex-direction:column;gap:4px;padding-top:8px;margin-top:8px;border-top:1px solid rgba(127,127,127,.25)')
	const hide = element('button', 'display:block;width:100%;padding:6px;border-radius:8px;font-size:11px;opacity:.7', 'Hide button until reload')

	hide.addEventListener('click', () => {
		shell.style.display = 'none'
		badge.style.display = 'none'
	})

	if (options.eruda) {
		const consoleButton = element('button', 'display:block;width:100%;padding:6px;border-radius:8px;font-size:11px;opacity:.7', 'Open console (eruda)')
		consoleButton.addEventListener('click', () => {
			shell.style.display = 'none'
			options.eruda?.()
		})
		footer.append(consoleButton)
	}

	footer.append(hide)
	shell.append(panel, footer)
	badge.className = 'pane'
	shell.className = 'pane'
	badge.dataset.tmaPanel = '1'
	badge.innerHTML = ICON
	badge.style.background = '#ffffff'
	badge.style.color = '#000000'

	const openHandlers = new Set<() => void>()
	let position = readPosition() ?? { x: window.innerWidth - BADGE_SIZE - 12, y: 12 }

	function place() {
		position = {
			x: Math.min(Math.max(position.x, 4), Math.max(4, window.innerWidth - BADGE_SIZE - 4)),
			y: Math.min(Math.max(position.y, 4), Math.max(4, window.innerHeight - BADGE_SIZE - 4)),
		}
		badge.style.left = `${position.x}px`
		badge.style.top = `${position.y}px`

		const width = Math.min(300, window.innerWidth - 16)
		const below = window.innerHeight - (position.y + BADGE_SIZE) > 220
		shell.style.width = `${width}px`
		shell.style.left = `${Math.min(Math.max(position.x + BADGE_SIZE - width, 8), Math.max(8, window.innerWidth - width - 8))}px`
		shell.style.top = below ? `${position.y + BADGE_SIZE + 8}px` : 'auto'
		shell.style.bottom = below ? 'auto' : `${window.innerHeight - position.y + 8}px`
		shell.style.maxHeight = `${(below ? window.innerHeight - position.y - BADGE_SIZE - 20 : position.y - 20) || 200}px`
	}

	const toggle = () => {
		const opening = shell.style.display === 'none'
		shell.style.display = opening ? 'flex' : 'none'
		place()
		if (opening) for (const handler of openHandlers) handler()
	}

	let dragging = false
	let moved = false
	let start: Position = { x: 0, y: 0 }
	let origin: Position = { x: 0, y: 0 }

	// Pointer capture is an optimisation: a refusal must not break dragging or clicking.
	const capture = (method: 'setPointerCapture' | 'releasePointerCapture', pointerId: number) => {
		try {
			badge[method](pointerId)
		} catch {}
	}

	badge.addEventListener('pointerdown', (event) => {
		dragging = true
		moved = false
		start = { x: event.clientX, y: event.clientY }
		origin = { ...position }
		capture('setPointerCapture', event.pointerId)
		badge.style.cursor = 'grabbing'
	})

	badge.addEventListener('pointermove', (event) => {
		if (!dragging) return
		const dx = event.clientX - start.x
		const dy = event.clientY - start.y
		if (Math.abs(dx) + Math.abs(dy) > DRAG_THRESHOLD) moved = true
		position = { x: origin.x + dx, y: origin.y + dy }
		place()
	})

	badge.addEventListener('pointerup', (event) => {
		if (!dragging) return
		dragging = false
		capture('releasePointerCapture', event.pointerId)
		badge.style.cursor = 'grab'
		if (moved) localStorage.setItem(POSITION_KEY, JSON.stringify(position))
		else toggle()
	})

	window.addEventListener('resize', place)
	whenReady(place)
	place()

	shadow.append(badge, shell)

	return {
		badge,
		panel,
		onOpen: (handler) => void openHandlers.add(handler),
		paint(params) {
			const bg = params.section_bg_color ?? '#ffffff'
			const text = params.text_color ?? '#000000'
			const active = params.secondary_bg_color ?? '#f4f4f5'

			badge.style.background = bg
			badge.style.color = text
			shell.style.background = bg
			shell.style.color = text

			for (const node of shell.querySelectorAll('button, input')) {
				const styled = node as HTMLElement
				styled.style.color = text
				if (styled.tagName === 'BUTTON') styled.style.background = styled.dataset.active === 'true' ? active : 'transparent'
			}
		},
	}
}
