import type { Payload } from '../types.js'
import { type ButtonParams, createBackButton, createMainButton } from './chrome.js'
import { detectEnvironment } from './environment.js'
import { mountInspector } from './inspector.js'
import { erudaOpener } from './eruda.js'
import { mountSwitcher } from './switcher.js'
import { currentTheme, initTheme, onTheme } from './theme.js'
import { height, keyboardShown, onViewport } from './viewport.js'

type EmitEvent = (event: string, payload?: unknown) => void

// @telegram-apps/bridge passes a tuple [name, params], @tma.js/bridge an object { name, params }.
type MockEvent = [string, unknown] | { name: string; params: unknown }
type MockTelegramEnv = (options: { launchParams?: unknown; onEvent?: (event: MockEvent, next: () => void) => void; resetPostMessage?: boolean }) => void

const normalize = (event: MockEvent): [string, unknown] => (Array.isArray(event) ? event : [event.name, event.params])

const NO_INSETS = { top: 0, bottom: 0, left: 0, right: 0 }

export function installSdk(payload: Payload, deps: { mockTelegramEnv: MockTelegramEnv; emitEvent: EmitEvent; loadEruda?: () => Promise<unknown> }) {
	const eruda = erudaOpener(payload.eruda && (deps.loadEruda ?? true))

	if (detectEnvironment() === 'telegram') {
		if (payload.panel) mountInspector(eruda)
		return
	}

	initTheme(payload)

	if (payload.browser) {
		if (payload.panel) mountSwitcher(payload, eruda)
		return
	}

	const { emitEvent, mockTelegramEnv } = deps
	let theme = currentTheme()
	const back = createBackButton(() => emitEvent('back_button_pressed'))
	const main = createMainButton(() => emitEvent('main_button_pressed'), theme.params)

	const viewport = () => ({ height: height(), width: window.innerWidth, is_expanded: true, is_state_stable: !keyboardShown() })

	onTheme((next) => {
		theme = next
		main.repaint(next.params)
		emitEvent('theme_changed', { theme_params: next.params })
	})

	onViewport(() => emitEvent('viewport_changed', viewport()))

	const onEvent = (event: MockEvent, next: () => void) => {
		const [method, params] = normalize(event)

		switch (method) {
			case 'web_app_request_theme':
				return emitEvent('theme_changed', { theme_params: theme.params })
			case 'web_app_request_viewport':
				return emitEvent('viewport_changed', viewport())
			case 'web_app_request_safe_area':
				return emitEvent('safe_area_changed', NO_INSETS)
			case 'web_app_request_content_safe_area':
				return emitEvent('content_safe_area_changed', NO_INSETS)
			case 'web_app_setup_back_button':
				back.setParams(params as { is_visible?: boolean })
				return
			case 'web_app_setup_main_button':
				main.setParams(params as ButtonParams)
				return
			case 'web_app_open_link':
				window.open(String((params as { url?: string }).url), '_blank', 'noopener')
				return
			case 'web_app_open_tg_link':
				window.open(`https://t.me${String((params as { path_full?: string }).path_full ?? '')}`, '_blank', 'noopener')
				return
			case 'web_app_close':
				window.close()
				return
			case 'web_app_ready':
			case 'web_app_expand':
				return
			default:
				next()
		}
	}

	try {
		mockTelegramEnv({
			launchParams: {
				// The SDK asks for the raw format here; anything parsed breaks initData.
				tgWebAppData: payload.initData || undefined,
				tgWebAppThemeParams: theme.params,
				tgWebAppVersion: '8.0',
				tgWebAppPlatform: payload.platform,
			},
			onEvent,
		})
	} catch (error) {
		console.error('[tma] mockTelegramEnv rejected the launch params:', error)
	}

	if (payload.panel) mountSwitcher(payload, eruda)
}
