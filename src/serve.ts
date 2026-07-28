import { signInitData, toUnsafe } from './sign.js'
import type { State } from './state.js'
import { THEMES } from './theme.js'
import type { Payload, RosterPage, TelegramUser, ThemeSetting } from './types.js'

export const ENDPOINT = '/__tma/state'
export const USERS_ENDPOINT = '/__tma/users'
export const ROSTER_LIMIT = 20

const EXPIRED_OFFSET_SECONDS = 25 * 60 * 60

// Vite extracts inline modules into html-proxy, so a marker inside the script text disappears
// from the HTML and the middleware injects a second copy. A meta tag survives that.
export const MARKER_ATTR = 'name="tma-mock"'
export const MARKER_TAG = `<meta ${MARKER_ATTR} content="1">`

export type Settings = {
	botToken: string
	theme: ThemeSetting
	platform: string
	version: string
	startParam: string
	panel: boolean
	eruda: boolean
}

export function buildPayload(settings: Settings, state: State, now = Date.now()): Payload {
	const { user, overrides } = state
	const authDate = Math.floor(now / 1000) - (overrides.expired ? EXPIRED_OFFSET_SECONDS : 0)
	const startParam = overrides.startParam ?? settings.startParam
	const initData = user && settings.botToken ? signInitData(user, settings.botToken, authDate, startParam) : ''

	return {
		initData,
		initDataUnsafe: initData ? toUnsafe(initData) : {},
		current: user,
		theme: overrides.theme ?? settings.theme,
		themes: THEMES,
		platform: overrides.platform ?? settings.platform,
		version: overrides.version ?? settings.version,
		startParam,
		overrides,
		browser: overrides.browser === true,
		panel: settings.panel,
		eruda: settings.eruda,
		endpoint: ENDPOINT,
		usersEndpoint: USERS_ENDPOINT,
	}
}

function matches(user: TelegramUser, query: string): boolean {
	if (!query) return true
	const haystack = [user.first_name, user.last_name, user.username, String(user.id)].filter(Boolean).join(' ').toLowerCase()
	return haystack.includes(query.toLowerCase())
}

export function searchRoster(users: TelegramUser[], query: string): RosterPage {
	const found = users.filter((user) => matches(user, query))
	return { users: found.slice(0, ROSTER_LIMIT), total: found.length }
}

export const injectable = (html: string) => html.includes('</head>') && !html.includes(MARKER_ATTR)

export const inject = (html: string, tag: string) => html.replace('</head>', `${tag}</head>`)

export function bootScript(payload: Payload, clientUrl: string, sdkModule: string | null, erudaInstalled: boolean): string {
	const data = JSON.stringify(payload)
	const deps = erudaInstalled ? `{ loadEruda: () => import('eruda') }` : '{}'

	if (!sdkModule) return `import { install } from ${JSON.stringify(clientUrl)}\ninstall(${data}, ${deps})`

	return [`import { mockTelegramEnv, emitEvent } from ${JSON.stringify(sdkModule)}`, `import { installSdk } from ${JSON.stringify(clientUrl)}`, `installSdk(${data}, { mockTelegramEnv, emitEvent, ...${deps} })`].join('\n')
}

export const bootTag = (script: string) => `${MARKER_TAG}<script type="module">${script}</script>`
