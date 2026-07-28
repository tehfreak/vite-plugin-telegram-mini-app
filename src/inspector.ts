import { mountInspector as mount } from './client/inspector.js'
import { erudaOpener } from './client/eruda.js'

export type InspectorOptions = {
	/**
	 * Console button: `true` pulls eruda from a CDN, a function takes it from the app’s dependencies
	 * (`() => import('eruda')`); omitted means no button at all.
	 */
	eruda?: boolean | (() => Promise<unknown>)
}

/**
 * Inspector panel for real Telegram: shows `initData`, launch params, theme, viewport and safe
 * area. It fakes nothing and needs no dev server, so it is fine in production too.
 *
 * Who gets to see it is up to the app: the plugin performs no checks of its own.
 *
 * ```ts
 * if (user.role === 'manager') {
 * 	const { mountInspector } = await import('vite-plugin-telegram-mini-app/inspector')
 * 	mountInspector({ eruda: () => import('eruda') })
 * }
 * ```
 */
export function mountInspector(options: InspectorOptions = {}) {
	mount(erudaOpener(options.eruda))
}
