import { expect, test } from 'vitest'
import { type Settings, bootScript, bootTag, buildPayload, inject, injectable, searchRoster } from './serve.js'
import type { State, TelegramUser } from './types.js'

const SETTINGS: Settings = {
	botToken: 'test-bot-token',
	theme: 'auto',
	platform: 'tdesktop',
	version: '7.0',
	startParam: '',
	panel: true,
	eruda: true,
}

const ANN: TelegramUser = { id: 1001, first_name: 'Ann', last_name: 'Lee', username: 'annlee' }

const state = (over: Partial<State> = {}): State => ({ user: ANN, overrides: {}, ...over })

const field = (initData: string, key: string) => new URLSearchParams(initData).get(key)

test('lets an override win over the option, that is what the panel writes', () => {
	const payload = buildPayload(SETTINGS, state({ overrides: { platform: 'ios', version: '8.0', theme: 'dark', startParam: 'ref-42' } }))

	expect(payload.platform).toBe('ios')
	expect(payload.version).toBe('8.0')
	expect(payload.theme).toBe('dark')
	expect(payload.startParam).toBe('ref-42')
})

test('falls back to the option where the panel said nothing', () => {
	const payload = buildPayload({ ...SETTINGS, platform: 'android', startParam: 'from-config' }, state())

	expect(payload.platform).toBe('android')
	expect(payload.startParam).toBe('from-config')
	expect(payload.version).toBe('7.0')
})

test('an emptied start_param beats the option, otherwise the panel could not switch it off', () => {
	const payload = buildPayload({ ...SETTINGS, startParam: 'from-config' }, state({ overrides: { startParam: '' } }))

	expect(payload.startParam).toBe('')
	expect(field(payload.initData, 'start_param')).toBeNull()
})

test('signs nothing without a bot token, so the app sees an anonymous visitor', () => {
	const payload = buildPayload({ ...SETTINGS, botToken: '' }, state())

	expect(payload.initData).toBe('')
	expect(payload.initDataUnsafe).toEqual({})
	expect(payload.current).toEqual(ANN)
})

test('signs nothing for the anonymous identity, the way a keyboard button launch arrives', () => {
	const payload = buildPayload(SETTINGS, state({ user: null }))

	expect(payload.initData).toBe('')
	expect(payload.initDataUnsafe).toEqual({})
	expect(payload.current).toBeNull()
})

test('hands the app the parsed initData next to the raw one', () => {
	const payload = buildPayload(SETTINGS, state())

	expect(payload.initDataUnsafe.user).toMatchObject({ id: 1001, first_name: 'Ann' })
	expect(field(payload.initData, 'hash')).toMatch(/^[a-f0-9]{64}$/)
})

test('dates auth_date a day back when the signature is marked expired', () => {
	const now = 1_700_000_000_000
	const fresh = buildPayload(SETTINGS, state(), now)
	const stale = buildPayload(SETTINGS, state({ overrides: { expired: true } }), now)

	expect(Number(field(fresh.initData, 'auth_date'))).toBe(now / 1000)
	expect(Number(field(fresh.initData, 'auth_date')) - Number(field(stale.initData, 'auth_date'))).toBe(25 * 60 * 60)
})

test('turns browser mode on only for an explicit true', () => {
	expect(buildPayload(SETTINGS, state()).browser).toBe(false)
	expect(buildPayload(SETTINGS, state({ overrides: { browser: false } })).browser).toBe(false)
	expect(buildPayload(SETTINGS, state({ overrides: { browser: true } })).browser).toBe(true)
})

const roster = (count: number) => Array.from({ length: count }, (_, index) => ({ id: index + 1, first_name: `User ${index + 1}` }))

test('returns the whole roster when nothing was typed', () => {
	expect(searchRoster([ANN, { id: 2, first_name: 'Bob' }], '')).toEqual({ users: [ANN, { id: 2, first_name: 'Bob' }], total: 2 })
})

test('searches the name, the surname, the username and the id', () => {
	const found = (query: string) => searchRoster([ANN], query).total

	expect(found('Ann')).toBe(1)
	expect(found('Lee')).toBe(1)
	expect(found('annlee')).toBe(1)
	expect(found('1001')).toBe(1)
	expect(found('nobody')).toBe(0)
})

test('ignores the case, since nobody types a roster exactly', () => {
	expect(searchRoster([ANN], 'ANNLEE').total).toBe(1)
	expect(searchRoster([ANN], 'ann lee').total).toBe(1)
})

test('hands over twenty at most but reports how many there really are', () => {
	const page = searchRoster(roster(57), '')

	expect(page.users).toHaveLength(20)
	expect(page.total).toBe(57)
})

test('refuses to inject twice, the marker of the first pass is enough', () => {
	const injected = inject('<html><head></head><body></body></html>', bootTag('install({})'))

	expect(injectable('<html><head></head></html>')).toBe(true)
	expect(injectable(injected)).toBe(false)
})

test('leaves a document without a head alone', () => {
	expect(injectable('<html><body>no head here</body></html>')).toBe(false)
})

test('puts the boot tag in the head, right before it closes', () => {
	const injected = inject('<html><head><title>App</title></head><body></body></html>', bootTag('install({})'))

	expect(injected).toBe('<html><head><title>App</title><meta name="tma-mock" content="1"><script type="module">install({})</script></head><body></body></html>')
})

const payload = () => buildPayload(SETTINGS, state())

test('boots the plain facade when no sdk was detected', () => {
	const script = bootScript(payload(), '/@fs/client/index.js', null, false)

	expect(script).toContain('import { install } from "/@fs/client/index.js"')
	expect(script).toContain('install({')
	expect(script).not.toContain('mockTelegramEnv')
})

test('boots through the package the project actually has, since mockTelegramEnv keeps its own state', () => {
	const script = bootScript(payload(), '/@fs/client/index.js', '@tma.js/sdk', false)

	expect(script).toContain('import { mockTelegramEnv, emitEvent } from "@tma.js/sdk"')
	expect(script).toContain('installSdk({')
	expect(script).not.toContain('import { install }')
})

test('passes a local eruda loader only when the project has one', () => {
	expect(bootScript(payload(), '/x.js', null, true)).toContain(`{ loadEruda: () => import('eruda') }`)
	expect(bootScript(payload(), '/x.js', null, false)).toContain('install(')
	expect(bootScript(payload(), '/x.js', null, false)).not.toContain('loadEruda')
})

test('embeds the payload as JSON the browser can parse back', () => {
	const script = bootScript(payload(), '/x.js', null, false)
	const embedded = script.slice(script.indexOf('install(') + 'install('.length, script.lastIndexOf(', {}'))

	expect(JSON.parse(embedded)).toMatchObject({ platform: 'tdesktop', version: '7.0', endpoint: '/__tma/state' })
})
