import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { IncomingMessage } from 'node:http'
import { normalizePath, type Plugin, type ViteDevServer } from 'vite'
import { ENDPOINT, USERS_ENDPOINT, bootScript as buildBootScript, bootTag as buildBootTag, buildPayload, inject, injectable, searchRoster } from './serve.js'
import { patchState, readState, writeState } from './state.js'
import type { Options, Overrides, TelegramUser } from './types.js'

export type { Mode, Options, Payload, TelegramUser, ThemeName } from './types.js'

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
	const settings = {
		botToken: options.botToken ?? process.env.TELEGRAM_BOT_TOKEN ?? '',
		theme: options.theme ?? 'auto',
		platform: options.platform ?? 'tdesktop',
		version: options.version ?? '7.0',
		startParam: options.startParam ?? '',
		panel: options.panel ?? true,
		eruda: options.eruda ?? true,
	}

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

		if (settings.eruda) erudaInstalled = await resolvable('eruda')

		server.config.logger.info(`[tma] mode: ${sdkModule ? `sdk (${sdkModule})` : 'webapp'}${settings.eruda ? `, console: ${erudaInstalled ? 'eruda from the project' : 'eruda from CDN'}` : ''}`)
	}

	async function roster(): Promise<TelegramUser[]> {
		const users = options.users
		return typeof users === 'function' ? await users() : (users ?? [])
	}

	async function bootScript(): Promise<string> {
		if (detection) await detection
		return buildBootScript(buildPayload(settings, readState(stateFile)), clientUrl, sdkModule, erudaInstalled)
	}

	async function bootTag(): Promise<string> {
		return buildBootTag(await bootScript())
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
			if (!settings.botToken) config.logger.warn('[tma] no TELEGRAM_BOT_TOKEN — initData will be empty and the app sees an anonymous visitor')
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
							write(injectable(html) ? Buffer.from(inject(html, await bootTag())) : body)
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
					res.setHeader('content-type', 'application/json')
					res.end(JSON.stringify(searchRoster(await roster(), query)))
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
