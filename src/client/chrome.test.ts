// @vitest-environment happy-dom
import { expect, test, vi } from 'vitest'

const DARK = { button_color: '#5288c1', button_text_color: '#ffffff' }

async function chrome() {
	vi.resetModules()
	document.getElementById('tma-panel')?.remove()
	return import('./chrome.js')
}

const shadow = () => document.getElementById('tma-panel')!.shadowRoot!

const node = (title?: string) => [...shadow().querySelectorAll<HTMLElement>('button')].find((button) => button.title === (title ?? ''))!

const shown = (element: HTMLElement) => element.style.display !== 'none'

const back = async (onPress = () => {}) => {
	const { createBackButton } = await chrome()
	return { button: createBackButton(onPress), node: node('BackButton') }
}

const main = async (onPress = () => {}, params: Record<string, string> = DARK) => {
	const { createMainButton } = await chrome()
	return { button: createMainButton(onPress, params), node: node() }
}

test('the back button starts hidden and answers show and hide', async () => {
	const { button, node } = await back()
	expect(shown(node)).toBe(false)

	button.show()
	expect(shown(node)).toBe(true)

	button.hide()
	expect(shown(node)).toBe(false)
})

test('the back button reports the press to the app', async () => {
	const onPress = vi.fn()
	const { node } = await back(onPress)

	node.click()

	expect(onPress).toHaveBeenCalledOnce()
})

test('setParams without is_visible leaves the back button where it was', async () => {
	const { button, node } = await back()
	button.show()

	button.setParams({})

	expect(shown(node)).toBe(true)
	expect(button.isVisible).toBe(true)
})

test('the main button opens with the label and the colours of the current palette', async () => {
	const { node } = await main()

	expect(node.textContent).toBe('CONTINUE')
	expect(node.style.background).toBe(DARK.button_color)
	expect(node.style.color).toBe(DARK.button_text_color)
	expect(shown(node)).toBe(false)
})

test('the main button falls back to the telegram blue when the palette carries no button colours', async () => {
	const { node } = await main(() => {}, {})

	expect(node.style.background).toBe('#3390ec')
	expect(node.style.color).toBe('#ffffff')
})

test('the main button stays silent while it is disabled', async () => {
	const onPress = vi.fn()
	const { button, node } = await main(onPress)

	button.disable()
	node.click()
	expect(onPress).not.toHaveBeenCalled()

	button.enable()
	node.click()
	expect(onPress).toHaveBeenCalledOnce()
})

test('a disabled main button is dimmed, so the state is visible and not only internal', async () => {
	const { button, node } = await main()

	button.disable()
	expect(Number(node.style.opacity)).toBe(0.5)

	button.enable()
	expect(Number(node.style.opacity)).toBe(1)
})

test('progress marks the label and takes the press away', async () => {
	const onPress = vi.fn()
	const { button, node } = await main(onPress)
	button.setText('Pay')

	button.showProgress()

	expect(node.textContent).toBe('Pay …')
	node.click()
	expect(onPress).not.toHaveBeenCalled()
})

test('progress can be shown without disabling, the way the client allows', async () => {
	const onPress = vi.fn()
	const { button, node } = await main(onPress)

	button.showProgress(true)
	node.click()

	expect(button.isActive).toBe(true)
	expect(onPress).toHaveBeenCalledOnce()
})

test('hiding the progress gives the label and the press back', async () => {
	const { button, node } = await main()
	button.setText('Pay')

	button.showProgress()
	button.hideProgress()

	expect(node.textContent).toBe('Pay')
	expect(button.isActive).toBe(true)
})

test('the main button follows the theme while the app has not chosen its own colour', async () => {
	const { button, node } = await main()

	button.repaint({ button_color: '#111111', button_text_color: '#eeeeee' })

	expect(node.style.background).toBe('#111111')
	expect(node.style.color).toBe('#eeeeee')
})

test('a colour the app set survives a theme change, the client does not overrule it either', async () => {
	const { button, node } = await main()
	button.setParams({ color: '#ff0000' })

	button.repaint({ button_color: '#111111' })

	expect(node.style.background).toBe('#ff0000')
	expect(button.color).toBe('#ff0000')
})

test('chains, since telegram-web-app.js is written as setText().show()', async () => {
	const { button, node } = await main()

	button.setText('Pay').show()

	expect(node.textContent).toBe('Pay')
	expect(shown(node)).toBe(true)
})
