import { backButton, init, mainButton, retrieveLaunchParams, retrieveRawInitData, viewport } from '@telegram-apps/sdk'

const out = document.querySelector('#out')!

try {
	init()

	const launchParams = retrieveLaunchParams()
	const raw = retrieveRawInitData()

	out.textContent = JSON.stringify(
		{
			user: launchParams.tgWebAppData?.user ?? null,
			platform: launchParams.tgWebAppPlatform,
			version: launchParams.tgWebAppVersion,
			hash: launchParams.tgWebAppData?.hash ?? null,
			rawLength: raw?.length ?? 0,
		},
		null,
		2,
	)

	if (viewport.mount.isAvailable()) await viewport.mount()
	if (backButton.mount.isAvailable()) backButton.mount()
	if (mainButton.mount.isAvailable()) mainButton.mount()

	document.querySelector('#back')!.addEventListener('click', () => {
		backButton.show()
		backButton.onClick(() => {
			backButton.hide()
			alert('backButton clicked')
		})
	})

	document.querySelector('#main')!.addEventListener('click', () => {
		mainButton.setParams({ text: 'PAY', isVisible: true, isEnabled: true })
		mainButton.onClick(() => alert('mainButton clicked'))
	})
} catch (error) {
	out.textContent = `SDK failed to start:\n${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}`
}
