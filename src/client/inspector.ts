import { createPanel, element } from './dom.js'
import { launchParams, webApp } from './environment.js'
import { copyButton, heading, initDataRows, jsonBlock, parseJson, snapshot, table, tabStrip } from './readout.js'

function themeParams(): Record<string, string> {
	return webApp()?.themeParams ?? (parseJson(launchParams().get('tgWebAppThemeParams')) as Record<string, string> | null) ?? {}
}

function rawInitData(): string {
	const stored = sessionStorage.getItem('tapps/launchParams')
	return webApp()?.initData || launchParams().get('tgWebAppData') || (stored ? (new URLSearchParams(stored.replace(/^"|"$/g, '')).get('tgWebAppData') ?? '') : '')
}

export function mountInspector(eruda?: () => void) {
	const shell = createPanel({ eruda })
	if (!shell) return
	const { badge, panel, onOpen, paint } = shell
	badge.title = 'TMA — inspector'

	function build() {
		const app = webApp()
		const raw = rawInitData()
		const { user, init } = initDataRows(raw)
		const hash = launchParams()
		const params = themeParams()

		panel.replaceChildren()

		const { strip, active } = tabStrip('tma-inspector-tab', ['data', 'environment', 'theme'], () => build())
		panel.append(strip)
		panel.append(element('div', 'padding:2px 4px 6px;font-size:11px;opacity:.6', 'Real Telegram. The panel only reads — nothing is faked.'))

		if (active === 0) {
			const dump = {
				initData: raw,
				initDataParsed: Object.fromEntries(new URLSearchParams(raw)),
				user: Object.fromEntries(user),
				launchParams: Object.fromEntries(hash),
				webApp: app ? snapshot(app) : null,
			}

			panel.append(heading('everything the client handed over'))
			panel.append(jsonBlock(dump))
			panel.append(copyButton(JSON.stringify(dump, null, 2), 'Copy JSON'))
			panel.append(copyButton(raw))
			panel.append(heading('initData by field'), table(init))
		} else if (active === 1) {
			panel.append(
				heading('launch'),
				table([
					['platform', app?.platform ?? hash.get('tgWebAppPlatform')],
					['version', app?.version ?? hash.get('tgWebAppVersion')],
					['colorScheme', app?.colorScheme],
					['start_param', hash.get('tgWebAppStartParam')],
					['source', app?.initData ? 'window.Telegram.WebApp' : 'address hash'],
				]),
			)
			panel.append(
				heading('viewport'),
				table([
					['viewportHeight', app?.viewportHeight],
					['viewportStableHeight', app?.viewportStableHeight],
					['isExpanded', app?.isExpanded],
					['window.innerHeight', window.innerHeight],
					['visualViewport.height', window.visualViewport?.height],
					['safeAreaInset', app?.safeAreaInset],
					['contentSafeAreaInset', app?.contentSafeAreaInset],
				]),
			)
		} else {
			panel.append(heading('themeParams'), table(Object.entries(params)))
		}

		paint(params)
	}

	onOpen(build)

	paint(themeParams())
	webApp()?.onEvent?.('themeChanged', () => paint(themeParams()))
}
