export type Environment = 'telegram' | 'browser'

type WebAppLike = {
	initData?: string
	initDataUnsafe?: Record<string, unknown>
	platform?: string
	version?: string
	colorScheme?: string
	themeParams?: Record<string, string>
	viewportHeight?: number
	viewportStableHeight?: number
	isExpanded?: boolean
	safeAreaInset?: Record<string, number>
	contentSafeAreaInset?: Record<string, number>
	onEvent?: (event: string, handler: () => void) => void
}

export const webApp = (): WebAppLike | undefined => (window as unknown as { Telegram?: { WebApp?: WebAppLike } }).Telegram?.WebApp

export function launchParams(): URLSearchParams {
	return new URLSearchParams(location.hash.replace(/^#/, ''))
}

export function detectEnvironment(): Environment {
	if (webApp()?.initData) return 'telegram'
	for (const key of launchParams().keys()) if (key.startsWith('tgWebApp')) return 'telegram'
	return 'browser'
}
