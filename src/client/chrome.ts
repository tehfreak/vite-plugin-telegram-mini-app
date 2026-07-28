import { element, overlay } from './dom.js'

export type ButtonParams = { text?: string; color?: string; text_color?: string; is_active?: boolean; is_visible?: boolean; is_progress_visible?: boolean }

export function createBackButton(onPress: () => void) {
	const node = element('button', 'position:fixed;top:8px;left:8px;width:32px;height:32px;padding:0;border-radius:9999px;background:#212121;color:#fff;font-size:16px;line-height:1;opacity:.85;display:none', '←')
	node.className = 'pane'
	node.title = 'BackButton'
	node.addEventListener('click', onPress)
	overlay().append(node)

	const button = {
		isVisible: false,
		show() {
			return button.setParams({ is_visible: true })
		},
		hide() {
			return button.setParams({ is_visible: false })
		},
		setParams(params: { is_visible?: boolean }) {
			if (params.is_visible !== undefined) button.isVisible = params.is_visible
			node.style.display = button.isVisible ? 'block' : 'none'
			return button
		},
	}

	return button
}

export function createMainButton(onPress: () => void, themeParams: Record<string, string>) {
	let recolored = false
	const node = element('button', 'position:fixed;left:0;right:0;bottom:0;height:56px;font-size:16px;font-weight:600;display:none', 'CONTINUE')
	node.className = 'pane'
	node.addEventListener('click', () => {
		if (button.isActive) onPress()
	})
	overlay().append(node)

	const paint = () => {
		node.textContent = button.isProgressVisible ? `${button.text} …` : button.text
		node.style.background = button.color
		node.style.color = button.textColor
		node.style.opacity = button.isActive ? '1' : '.5'
		node.style.display = button.isVisible ? 'block' : 'none'
	}

	const button = {
		text: 'CONTINUE',
		color: themeParams.button_color ?? '#3390ec',
		textColor: themeParams.button_text_color ?? '#ffffff',
		isVisible: false,
		isActive: true,
		isProgressVisible: false,
		setText(text: string) {
			return button.setParams({ text })
		},
		show() {
			return button.setParams({ is_visible: true })
		},
		hide() {
			return button.setParams({ is_visible: false })
		},
		enable() {
			return button.setParams({ is_active: true })
		},
		disable() {
			return button.setParams({ is_active: false })
		},
		showProgress(leaveActive?: boolean) {
			return button.setParams({ is_progress_visible: true, is_active: leaveActive === true })
		},
		hideProgress() {
			return button.setParams({ is_progress_visible: false, is_active: true })
		},
		repaint(params: Record<string, string>) {
			if (recolored) return button
			button.color = params.button_color ?? button.color
			button.textColor = params.button_text_color ?? button.textColor
			paint()
			return button
		},
		setParams(params: ButtonParams) {
			if (params.text !== undefined) button.text = params.text
			if (params.color !== undefined) button.color = params.color
			if (params.text_color !== undefined) button.textColor = params.text_color
			if (params.color !== undefined || params.text_color !== undefined) recolored = true
			if (params.is_active !== undefined) button.isActive = params.is_active
			if (params.is_visible !== undefined) button.isVisible = params.is_visible
			if (params.is_progress_visible !== undefined) button.isProgressVisible = params.is_progress_visible
			paint()
			return button
		},
	}

	paint()
	return button
}
