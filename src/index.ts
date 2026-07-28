import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { IncomingMessage } from 'node:http'
import { normalizePath, type Plugin, type ViteDevServer } from 'vite'
import { signInitData, toUnsafe } from './sign.js'
import { patchState, readState, writeState } from './state.js'
import { THEMES } from './theme.js'
import type { Options, Overrides, Payload, RosterPage, TelegramUser } from './types.js'

export type { Mode, Options, Payload, TelegramUser, ThemeName } from './types.js'

const ENDPOINT = '/__tma/state'
const USERS_ENDPOINT = '/__tma/users'
const EXPIRED_OFFSET_SECONDS = 25 * 60 * 60
const ROSTER_LIMIT = 20
// Vite extracts inline modules into html-proxy, so a marker inside the script text disappears
// from the HTML and the middleware injects a second copy. A meta tag survives that.
const MARKER_ATTR = 'name="tma-mock"'
const MARKER_TAG = `<meta ${MARKER_ATTR} content="1">`
// mockTelegramEnv keeps state in its own module instance, so the app and the plugin must import
// the same package. @tma.js/* is the current generation, @telegram-apps/* the previous one.
const SDK_MODULES = ['@tma.js/sdk', '@tma.js/bridge', '@telegram-apps/sdk', '@telegram-apps/bridge']
const packageDir = dirname(fileURLToPath(import.meta.url))
const clientUrl = `/@fs/${normalizePath(join(packageDir, 'client/index.js'))}`

/** Vite resolves the bare specifier that reaches the browser, so Node's resolver may disagree. */
function createResolver(server: ViteDevServer): (id: string) => Promise<boolean> {
	const container = server.environments?.client?.pluginContainer ?? server.pluginContainer
	const importer = join(server.config.root, 'index.html')

	return async (id) => {
		try {
			return Boolean(await container.resolveId(id, importer))
		} catch {
			return false
		}
	}
}

export function tma(options: Options = {}): Plugin {
	const botToken = options.botToken ?? process.env.TELEGRAM_BOT_TOKEN ?? ''
	const theme = options.theme ?? 'auto'
	const platform = options.platform ?? 'tdesktop'
	const version = options.version ?? '7.0'
	const startParam = options.startParam ?? ''
	const panel = options.panel ?? true
	const eruda = options.eruda ?? true

	let stateFile = ''
	let sdkModule: string | null = null
	let erudaInstalled = false
	let detection: Promise<void> | null = null

	async function detect(server: ViteDevServer) {
		const resolvable = createResolver(server)
		const mode = options.mode ?? 'auto'

		if (mode !== 'webapp') {
			if (options.sdkModule) sdkModule = options.sdkModule
			else {
				for (const id of SDK_MODULES) {
					if (await resolvable(id)) {
						sdkModule = id
						break
					}
				}
			}
			if (mode === 'sdk' && !sdkModule) server.config.logger.error('[tma] mode: "sdk", but neither @tma.js/* nor @telegram-apps/* resolves from the project root')
		}

		if (eruda) erudaInstalled = await resolvable('eruda')

		server.config.logger.info(`[tma] mode: ${sdkModule ? `sdk (${sdkModule})` : 'webapp'}${eruda ? `, console: ${erudaInstalled ? 'eruda from the project' : 'eruda from CDN'}` : ''}`)
	}

	async function roster(): Promise<TelegramUser[]> {
		const users = options.users
		return typeof users === 'function' ? await users() : (users ?? [])
	}

	async function payload(): Promise<Payload> {
		const { user, overrides } = readState(stateFile)
		const authDate = overrides.expired ? Math.floor(Date.now() / 1000) - EXPIRED_OFFSET_SECONDS : undefined
		const start = overrides.startParam ?? startParam
		const initData = user && botToken ? signInitData(user, botToken, authDate, start) : ''

		return {
			initData,
			initDataUnsafe: initData ? toUnsafe(initData) : {},
			current: user,
			theme: overrides.theme ?? theme,
			themes: THEMES,
			platform: overrides.platform ?? platform,
			version: overrides.version ?? version,
			startParam: start,
			overrides,
			browser: overrides.browser === true,
			panel,
			eruda,
			endpoint: ENDPOINT,
			usersEndpoint: USERS_ENDPOINT,
		}
	}

	function matches(user: TelegramUser, query: string): boolean {
		if (!query) return true
		const haystack = [user.first_name, user.last_name, user.username, String(user.id)].filter(Boolean).join(' ').toLowerCase()
		return haystack.includes(query.toLowerCase())
	}

	async function bootScript(): Promise<string> {
		if (detection) await detection
		const data = JSON.stringify(await payload())
		const deps = erudaInstalled ? `{ loadEruda: () => import('eruda') }` : '{}'

		if (!sdkModule) return `import { install } from ${JSON.stringify(clientUrl)}\ninstall(${data}, ${deps})`

		return [`import { mockTelegramEnv, emitEvent } from ${JSON.stringify(sdkModule)}`, `import { installSdk } from ${JSON.stringify(clientUrl)}`, `installSdk(${data}, { mockTelegramEnv, emitEvent, ...${deps} })`].join('\n')
	}

	async function bootTag(): Promise<string> {
		return `${MARKER_TAG}<script type="module">${await bootScript()}</script>`
	}

	return {
		name: 'vite-plugin-telegram-mini-app',
		apply: 'serve',
		// Without 'pre', framework plugins register middleware first and answer before we wrap res.
		enforce: 'pre',

		configResolved(config) {
			// Returning fs.allow from `config` would replace the list Vite computes from the workspace root.
			config.server.fs.allow.push(packageDir)

			stateFile = options.stateFile ? resolve(config.root, options.stateFile) : join(config.cacheDir, 'tma-mock-identity.json')
			if (!botToken) config.logger.warn('[tma] no TELEGRAM_BOT_TOKEN — initData will be empty and the app sees an anonymous visitor')
		},

		configureServer(server) {
			detection = detect(server)

			server.middlewares.use((req, res, next) => {
				if (req.method !== 'GET' || !String(req.headers.accept ?? '').includes('text/html')) return next()

				const chunks: Buffer[] = []
				const write = res.write.bind(res)
				const end = res.end.bind(res)
				const writeHead = res.writeHead.bind(res)

				res.writeHead = ((status: number, ...rest: unknown[]) => {
					// Injection changes the length, and headers passed to writeHead never reach getHeader.
					res.removeHeader('content-length')
					for (const value of rest) if (value && typeof value === 'object') delete (value as Record<string, unknown>)['content-length']
					return writeHead(status, ...(rest as []))
				}) as typeof res.writeHead

				res.write = ((chunk: unknown) => {
					if (chunk) chunks.push(Buffer.from(chunk as Buffer))
					return true
				}) as typeof res.write

				res.end = ((chunk: unknown) => {
					if (chunk && typeof chunk !== 'function') chunks.push(Buffer.from(chunk as Buffer))

					void (async () => {
						const body = Buffer.concat(chunks)
						try {
							const html = body.toString('utf8')
							const injectable = html.includes('</head>') && !html.includes(MARKER_ATTR)
							write(injectable ? Buffer.from(html.replace('</head>', `${await bootTag()}</head>`)) : body)
						} catch (error) {
							server.config.logger.error(`[tma] failed to inject into the HTML: ${String(error)}`)
							write(body)
						}
						end()
					})()

					return res
				}) as typeof res.end

				next()
			})

			server.middlewares.use(USERS_ENDPOINT, async (req, res) => {
				try {
					const query = new URL(req.url ?? '/', 'http://localhost').searchParams.get('q') ?? ''
					const found = (await roster()).filter((user) => matches(user, query))
					res.setHeader('content-type', 'application/json')
					res.end(JSON.stringify({ users: found.slice(0, ROSTER_LIMIT), total: found.length } satisfies RosterPage))
				} catch (error) {
					res.statusCode = 500
					res.end(String(error))
				}
			})

			server.middlewares.use(ENDPOINT, async (req, res) => {
				if (req.method !== 'POST') {
					res.statusCode = 405
					res.end()
					return
				}

				try {
					const body = await readBody(req)
					const patch = JSON.parse(body || '{}') as { user?: TelegramUser | null; overrides?: Overrides | null }
					writeState(stateFile, patchState(readState(stateFile), patch))
					res.statusCode = 204
					res.end()
				} catch (error) {
					res.statusCode = 400
					res.end(String(error))
				}
			})
		},

		transformIndexHtml: {
			// 'pre' so Vite core still rewrites the bare import inside the injected inline module.
			order: 'pre',
			async handler() {
				return [
					{ tag: 'meta', attrs: { name: 'tma-mock', content: '1' }, injectTo: 'head' as const },
					{ tag: 'script', attrs: { type: 'module' }, children: await bootScript(), injectTo: 'head' as const },
				]
			},
		},
	}
}

async function readBody(req: IncomingMessage): Promise<string> {
	const chunks: Buffer[] = []
	for await (const chunk of req) chunks.push(chunk as Buffer)
	return Buffer.concat(chunks).toString('utf8')
}

export default tma
