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

async function launchParams(payload: Payload): Promise<LaunchParams> {
	vi.resetModules()
	document.getElementById('tma-panel')?.remove()
	const { installSdk } = await import('./sdk.js')
	let captured: LaunchParams = {}
	installSdk(payload, { mockTelegramEnv: (options) => void (captured = options.launchParams as LaunchParams), emitEvent: () => {} })
	return captured
}

beforeEach(() => {
	location.hash = ''
})

test('hands the start param to the sdk, where retrieveLaunchParams finds it', async () => {
	expect((await launchParams({ ...PAYLOAD, startParam: 'ref-42' })).tgWebAppStartParam).toBe('ref-42')
})

test('leaves the launch param out when there is no deep link, rather than passing an empty string', async () => {
	expect((await launchParams(PAYLOAD)).tgWebAppStartParam).toBeUndefined()
})
