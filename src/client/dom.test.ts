// @vitest-environment happy-dom
import { beforeEach, expect, test, vi } from 'vitest'
import type { Panel } from './dom.js'

const HOST = 'tma-panel'
const POSITION = 'tma-panel-position'

beforeEach(() => localStorage.clear())

async function mount(): Promise<Panel> {
	vi.resetModules()
	document.getElementById(HOST)?.remove()
	const { createPanel } = await import('./dom.js')
	const panel = createPanel()
	if (!panel) throw new Error('the panel refused to mount')
	return panel
}

const shadow = () => document.getElementById(HOST)!.shadowRoot!

const shell = (badge: HTMLElement) => badge.nextElementSibling as HTMLElement

function drag(badge: HTMLElement, [fromX, fromY]: [number, number], [toX, toY]: [number, number]) {
	const send = (type: string, x: number, y: number) => badge.dispatchEvent(Object.assign(new Event(type), { clientX: x, clientY: y, pointerId: 1 }))
	send('pointerdown', fromX, fromY)
	send('pointermove', toX, toY)
	send('pointerup', toX, toY)
}

test('paints the badge and the shell from the palette', async () => {
	const { badge, paint } = await mount()

	paint({ section_bg_color: '#17212b', text_color: '#f5f5f5', secondary_bg_color: '#232e3c' })

	expect(badge.style.background).toBe('#17212b')
	expect(badge.style.color).toBe('#f5f5f5')
	expect(shell(badge).style.background).toBe('#17212b')
	expect(shell(badge).style.color).toBe('#f5f5f5')
})

test('falls back to white on black when the palette is empty', async () => {
	const { badge, paint } = await mount()

	paint({})

	expect(badge.style.background).toBe('#ffffff')
	expect(badge.style.color).toBe('#000000')
})

test('backs the active button with the secondary colour and clears the rest', async () => {
	const { badge, panel, paint } = await mount()
	const active = document.createElement('button')
	const idle = document.createElement('button')
	active.dataset.active = 'true'
	idle.dataset.active = 'false'
	panel.append(active, idle)

	paint({ section_bg_color: '#17212b', text_color: '#f5f5f5', secondary_bg_color: '#232e3c' })

	expect(active.style.background).toBe('#232e3c')
	expect(idle.style.background).toBe('transparent')
	expect(idle.style.color).toBe('#f5f5f5')
	expect(badge.style.background).toBe('#17212b')
})

test('leaves the input background alone and only takes over its colour', async () => {
	const { panel, paint } = await mount()
	const input = document.createElement('input')
	input.style.background = 'transparent'
	panel.append(input)

	paint({ section_bg_color: '#17212b', text_color: '#f5f5f5' })

	expect(input.style.color).toBe('#f5f5f5')
	expect(input.style.background).toBe('transparent')
})

test('repaints every time, so a theme switch reaches the whole panel', async () => {
	const { badge, panel, paint } = await mount()
	const button = document.createElement('button')
	button.dataset.active = 'true'
	panel.append(button)

	paint({ section_bg_color: '#ffffff', text_color: '#000000', secondary_bg_color: '#f4f4f5' })
	paint({ section_bg_color: '#17212b', text_color: '#f5f5f5', secondary_bg_color: '#232e3c' })

	expect(badge.style.background).toBe('#17212b')
	expect(button.style.background).toBe('#232e3c')
	expect(button.style.color).toBe('#f5f5f5')
})

test('still drags when the browser refuses pointer capture', async () => {
	localStorage.setItem(POSITION, JSON.stringify({ x: 100, y: 100 }))
	const { badge } = await mount()
	badge.setPointerCapture = () => {
		throw new Error('refused')
	}

	drag(badge, [0, 0], [60, 40])

	expect(badge.style.left).toBe('160px')
	expect(badge.style.top).toBe('140px')
	expect(JSON.parse(localStorage.getItem(POSITION)!)).toEqual({ x: 160, y: 140 })
})

test('still opens on a tap when the browser refuses pointer capture', async () => {
	const { badge } = await mount()
	badge.setPointerCapture = () => {
		throw new Error('refused')
	}

	drag(badge, [10, 10], [10, 10])

	expect(shell(badge).style.display).toBe('flex')
})

test('takes a drag for a drag and not for a tap, so the panel does not open under the finger', async () => {
	const { badge } = await mount()

	drag(badge, [0, 0], [60, 40])

	expect(shell(badge).style.display).toBe('none')
})

test('the scrolling container carries the class the stylesheet thins', async () => {
	const { panel } = await mount()
	const css = shadow().querySelector('style')!.textContent!

	expect(panel.className).toBe('scroll')
	expect(panel.style.overflow).toBe('auto')
	expect(css).toContain('.scroll { scrollbar-width: thin')
	expect(css).toContain('.scroll::-webkit-scrollbar { width: 4px; height: 4px }')
})

test('refuses to mount a second panel over the first', async () => {
	const { badge } = await mount()
	const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
	const { createPanel } = await import('./dom.js')

	expect(createPanel()).toBeNull()
	expect(warn).toHaveBeenCalled()
	expect(shadow().querySelectorAll('[data-tma-panel]')).toHaveLength(1)
	expect(badge.isConnected).toBe(true)

	warn.mockRestore()
})
