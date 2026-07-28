// @vitest-environment happy-dom
import { beforeEach, expect, test, vi } from 'vitest'
import { THEMES } from '../theme.js'
import type { Payload } from '../types.js'

const PAYLOAD: Payload = {
	initData: 'user=%7B%22id%22%3A1%7D',
	initDataUnsafe: { user: { id: 1 } },
	current: { id: 1, first_name: 'Ann' },
	theme: 'light',
	themes: THEMES,
	platform: 'tdesktop',
	version: '7.0',
	startParam: '',
	overrides: {},
	browser: false,
	panel: false,
	eruda: false,
	endpoint: '/__tma/state',
	usersEndpoint: '/__tma/users',
}

type LaunchParams = { tgWebAppStartParam?: string; tgWebAppData?: string }
type Viewport = { height: number; is_expanded: boolean; is_state_stable: boolean }
type Env = { launchParams: LaunchParams; send(method: string, params?: unknown): void; emitted: ReturnType<typeof vi.fn>; unhandled: ReturnType<typeof vi.fn> }

async function install(payload: Payload): Promise<Env> {
	vi.resetModules()
	document.getElementById('tma-panel')?.remove()
	const { installSdk } = await import('./sdk.js')

	let launchParams: LaunchParams = {}
	let onEvent: (event: [string, unknown], next: () => void) => void = () => {}
	const emitted = vi.fn()

	installSdk(payload, {
		mockTelegramEnv: (options) => {
			launchParams = options.launchParams as LaunchParams
			onEvent = options.onEvent as typeof onEvent
		},
		emitEvent: emitted,
	})

	const unhandled = vi.fn()
	return { launchParams, emitted, unhandled, send: (method, params) => onEvent([method, params], unhandled) }
}

const launchParams = async (payload: Payload) => (await install(payload)).launchParams

beforeEach(() => {
	location.hash = ''
})

test('hands the start param to the sdk, where retrieveLaunchParams finds it', async () => {
	expect((await launchParams({ ...PAYLOAD, startParam: 'ref-42' })).tgWebAppStartParam).toBe('ref-42')
})

test('leaves the launch param out when there is no deep link, rather than passing an empty string', async () => {
	expect((await launchParams(PAYLOAD)).tgWebAppStartParam).toBeUndefined()
})

test('prints the haptics the sdk asks for, instead of leaving them to the default handler', async () => {
	const env = await install(PAYLOAD)
	const info = vi.spyOn(console, 'info').mockImplementation(() => {})

	env.send('web_app_trigger_haptic_feedback', { type: 'impact', impact_style: 'medium' })
	env.send('web_app_trigger_haptic_feedback', { type: 'notification', notification_type: 'error' })
	env.send('web_app_trigger_haptic_feedback', { type: 'selection_change' })

	expect(info.mock.calls.flat()).toEqual(['[tma] haptic → impact: medium', '[tma] haptic → notification: error', '[tma] haptic → selection'])
	expect(env.unhandled).not.toHaveBeenCalled()
	info.mockRestore()
})

test('answers web_app_request_viewport with the current expanded state', async () => {
	const env = await install(PAYLOAD)

	env.send('web_app_request_viewport')

	const [event, params] = env.emitted.mock.calls.at(-1) as [string, Viewport]
	expect(event).toBe('viewport_changed')
	expect(params.is_expanded).toBe(true)
})

test('expands on web_app_expand and reports the new height', async () => {
	const env = await install(PAYLOAD)
	const { setExpanded } = await import('./viewport.js')
	setExpanded(false)
	env.send('web_app_request_viewport')
	const collapsed = (env.emitted.mock.calls.at(-1) as [string, Viewport])[1]

	env.send('web_app_expand')

	const [event, params] = env.emitted.mock.calls.at(-1) as [string, Viewport]
	expect(event).toBe('viewport_changed')
	expect(params.is_expanded).toBe(true)
	expect(params.height).toBeGreaterThan(collapsed.height)
})
