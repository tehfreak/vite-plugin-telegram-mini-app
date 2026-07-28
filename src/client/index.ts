import type { Payload } from '../types.js'
import { detectEnvironment } from './environment.js'
import { erudaOpener } from './eruda.js'
import { mountInspector } from './inspector.js'
import { mountSwitcher } from './switcher.js'
import { initTheme } from './theme.js'
import { createWebApp } from './webapp.js'

type TelegramGlobal = { WebApp?: unknown }

export type Deps = { loadEruda?: () => Promise<unknown> }

export function install(payload: Payload, deps: Deps = {}) {
	const eruda = erudaOpener(payload.eruda && (deps.loadEruda ?? true))

	if (detectEnvironment() === 'telegram') {
		if (payload.panel) mountInspector(eruda)
		return
	}

	initTheme(payload)

	if (!payload.browser) {
		const holder = window as unknown as { Telegram?: TelegramGlobal }
		holder.Telegram = { ...holder.Telegram, WebApp: createWebApp(payload) }
	}

	if (payload.panel) mountSwitcher(payload, eruda)
}

export { installSdk } from './sdk.js'
