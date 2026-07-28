export type TelegramUser = {
	id: string | number
	first_name: string
	last_name?: string
	username?: string
	language_code?: string
	is_premium?: boolean
	photo_url?: string
}

export type ThemeName = 'light' | 'dark'

/** `auto` follows the browser's prefers-color-scheme, the way an app would follow the client theme. */
export type ThemeSetting = ThemeName | 'auto'

/**
 * `webapp` declares window.Telegram.WebApp, the way telegram-web-app.js does.
 * `sdk` hands the environment to mockTelegramEnv from @tma.js, feeding it a signed initData.
 * `auto` picks sdk when one of those packages resolves from the project root.
 */
export type Mode = 'auto' | 'webapp' | 'sdk'

export type Options = {
	botToken?: string
	users?: TelegramUser[] | (() => TelegramUser[] | Promise<TelegramUser[]>)
	mode?: Mode
	/** Package to take mockTelegramEnv from. Detected automatically: @tma.js/*, then @telegram-apps/*. */
	sdkModule?: string
	theme?: ThemeSetting
	platform?: string
	version?: string
	panel?: boolean
	/** The "Open console" button in the panel. eruda itself loads lazily, on click. */
	eruda?: boolean
	stateFile?: string
}

/** Edits made from the panel. They live next to the identity and survive a reload. */
export type Overrides = {
	theme?: ThemeSetting
	platform?: string
	version?: string
	/** Sign with a day-old `auth_date` so the backend has to reject such initData. The hash stays valid, only the age is off. */
	expired?: boolean
	/**
	 * Do not install the mock at all. The app sees a plain browser, where Telegram hands over
	 * nothing: `isTMA()` is false and `retrieveLaunchParams()` throws. The panel stays.
	 */
	browser?: boolean
}

export type Payload = {
	initData: string
	initDataUnsafe: Record<string, unknown>
	// No roster here: it can be large and come from a database, and the payload is inlined into every HTML.
	current: TelegramUser | null
	// Both palettes go to the client, because a server cannot see a media query.
	theme: ThemeSetting
	themes: Record<ThemeName, Record<string, string>>
	platform: string
	version: string
	overrides: Overrides
	browser: boolean
	panel: boolean
	eruda: boolean
	endpoint: string
	usersEndpoint: string
}

export type RosterPage = { users: TelegramUser[]; total: number }
