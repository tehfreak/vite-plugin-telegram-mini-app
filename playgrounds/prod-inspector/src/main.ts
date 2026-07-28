const out = document.querySelector('#out')!

const LAUNCH = [
	`tgWebAppData=${encodeURIComponent('user=%7B%22id%22%3A777%2C%22first_name%22%3A%22Real%22%2C%22language_code%22%3A%22ru%22%2C%22is_premium%22%3Atrue%7D&auth_date=1785238000&start_param=invite-abc&signature=ed25519&hash=deadbeef')}`,
	'tgWebAppVersion=8.0',
	'tgWebAppPlatform=android',
	'tgWebAppStartParam=invite-abc',
].join('&')

const webApp = (window as unknown as { Telegram?: { WebApp?: { initData?: string; platform?: string } } }).Telegram?.WebApp

out.textContent = JSON.stringify(
	{
		plugin: 'not installed',
		'window.Telegram.WebApp': webApp ? 'present (official script)' : 'absent',
		initData: webApp?.initData || '(empty)',
		platform: webApp?.platform,
	},
	null,
	2,
)

document.querySelector('#mount')!.addEventListener('click', async () => {
	// Exactly what an app would do in production: a dynamic import behind its own condition.
	const { mountInspector } = await import('vite-plugin-telegram-mini-app/inspector')
	mountInspector({ eruda: () => import('eruda') })
})

document.querySelector('#launch')!.addEventListener('click', () => {
	location.hash = LAUNCH
	location.reload()
})
