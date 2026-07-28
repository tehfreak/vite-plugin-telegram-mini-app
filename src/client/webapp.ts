import type { Payload } from '../types.js'
import { createBackButton, createMainButton } from './chrome.js'
import { whenReady } from './dom.js'
import { applyThemeVariables, currentTheme, onTheme } from './theme.js'
import { height, keyboardShown, onViewport, stableHeight } from './viewport.js'

type Handler = (...args: unknown[]) => void

const noop = () => {}
const warn = (method: string) => console.warn(`[tma] ${method}() needs real Telegram — the call was ignored`)

function createCloudStorage() {
	const key = (name: string) => `tma-mock:cloud:${name}`

	const storage = {
		setItem(name: string, value: string, cb?: (error: null, stored: boolean) => void) {
			localStorage.setItem(key(name), value)
			cb?.(null, true)
			return storage
		},
		getItem(name: string, cb?: (error: null, value: string) => void) {
			cb?.(null, localStorage.getItem(key(name)) ?? '')
			return storage
		},
		getItems(names: string[], cb?: (error: null, values: Record<string, string>) => void) {
			cb?.(null, Object.fromEntries(names.map((name) => [name, localStorage.getItem(key(name)) ?? ''])))
			return storage
		},
		removeItem(name: string, cb?: (error: null, removed: boolean) => void) {
			localStorage.removeItem(key(name))
			cb?.(null, true)
			return storage
		},
		removeItems(names: string[], cb?: (error: null, removed: boolean) => void) {
			for (const name of names) localStorage.removeItem(key(name))
			cb?.(null, true)
			return storage
		},
		getKeys(cb?: (error: null, keys: string[]) => void) {
			const prefix = key('')
			cb?.(
				null,
				Object.keys(localStorage)
					.filter((name) => name.startsWith(prefix))
					.map((name) => name.slice(prefix.length)),
			)
			return storage
		},
	}

	return storage
}

export function createWebApp(payload: Payload) {
	const listeners = new Map<string, Set<Handler>>()
	const emit = (event: string, ...args: unknown[]) => {
		for (const handler of listeners.get(event) ?? []) handler(...args)
	}

	function withClicks<T extends object>(event: string, create: (onPress: () => void) => T) {
		const clicks = new Set<() => void>()
		const button = create(() => {
			for (const handler of clicks) handler()
			emit(event)
		})
		return Object.assign(button, {
			onClick(cb: () => void) {
				clicks.add(cb)
				return button
			},
			offClick(cb: () => void) {
				clicks.delete(cb)
				return button
			},
		})
	}

	const theme = currentTheme()

	const webApp = {
		initData: payload.initData,
		initDataUnsafe: payload.initDataUnsafe,
		version: payload.version,
		platform: payload.platform,
		colorScheme: theme.name,
		themeParams: theme.params,
		isExpanded: true,
		get viewportHeight() {
			return height()
		},
		get viewportStableHeight() {
			return stableHeight()
		},
		headerColor: theme.params.header_bg_color ?? '#ffffff',
		backgroundColor: theme.params.bg_color ?? '#ffffff',
		isClosingConfirmationEnabled: false,

		BackButton: withClicks('backButtonClicked', createBackButton),
		MainButton: withClicks('mainButtonClicked', (press) => createMainButton(press, theme.params)),
		HapticFeedback: { impactOccurred: noop, notificationOccurred: noop, selectionChanged: noop },
		CloudStorage: createCloudStorage(),

		ready: noop,
		expand: noop,
		close: () => window.close(),

		isVersionAtLeast(version: string) {
			const parse = (value: string) => value.split('.').map(Number)
			const [major = 0, minor = 0] = parse(payload.version)
			const [wantMajor = 0, wantMinor = 0] = parse(version)
			return major > wantMajor || (major === wantMajor && minor >= wantMinor)
		},

		setHeaderColor(color: string) {
			webApp.headerColor = color
		},
		setBackgroundColor(color: string) {
			webApp.backgroundColor = color
			document.body.style.backgroundColor = color
		},
		enableClosingConfirmation() {
			webApp.isClosingConfirmationEnabled = true
		},
		disableClosingConfirmation() {
			webApp.isClosingConfirmationEnabled = false
		},

		onEvent(event: string, cb: Handler) {
			const set = listeners.get(event) ?? new Set<Handler>()
			set.add(cb)
			listeners.set(event, set)
		},
		offEvent(event: string, cb: Handler) {
			listeners.get(event)?.delete(cb)
		},

		openLink: (url: string) => void window.open(url, '_blank', 'noopener'),
		openTelegramLink: (url: string) => void window.open(url, '_blank', 'noopener'),

		showAlert(message: string, cb?: () => void) {
			window.alert(message)
			cb?.()
		},
		showConfirm(message: string, cb?: (confirmed: boolean) => void) {
			cb?.(window.confirm(message))
		},
		showPopup(params: { title?: string; message: string }, cb?: (buttonId: string) => void) {
			window.alert([params.title, params.message].filter(Boolean).join('\n\n'))
			cb?.('ok')
			emit('popupClosed', { button_id: 'ok' })
		},

		openInvoice(_url: string, cb?: (status: string) => void) {
			warn('openInvoice')
			cb?.('cancelled')
		},
		requestWriteAccess(cb?: (granted: boolean) => void) {
			warn('requestWriteAccess')
			cb?.(false)
		},
		requestContact(cb?: (shared: boolean) => void) {
			warn('requestContact')
			cb?.(false)
		},
		showScanQrPopup(_params: unknown, _cb?: unknown) {
			warn('showScanQrPopup')
		},
		switchInlineQuery(_query: string, _types?: string[]) {
			warn('switchInlineQuery')
		},
		sendData(data: string) {
			console.info('[tma] WebApp.sendData →', data)
		},
	}

	applyThemeVariables(theme)

	onTheme((next) => {
		webApp.colorScheme = next.name
		webApp.themeParams = next.params
		webApp.headerColor = next.params.header_bg_color ?? webApp.headerColor
		webApp.backgroundColor = next.params.bg_color ?? webApp.backgroundColor
		webApp.MainButton.repaint(next.params)
		applyThemeVariables(next)
		emit('themeChanged')
	})

	const viewportChanged = () => emit('viewportChanged', { isStateStable: !keyboardShown() })

	whenReady(viewportChanged)
	onViewport(viewportChanged)

	return webApp
}
