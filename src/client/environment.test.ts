// @vitest-environment happy-dom
import { beforeEach, expect, test } from 'vitest'
import { detectEnvironment, launchParams, webApp } from './environment.js'

const holder = window as unknown as { Telegram?: { WebApp?: { initData?: string } } }

beforeEach(() => {
	delete holder.Telegram
	location.hash = ''
})

test('calls it telegram when the client handed over an initData', () => {
	holder.Telegram = { WebApp: { initData: 'user=%7B%22id%22%3A1%7D' } }

	expect(detectEnvironment()).toBe('telegram')
})

test('calls it telegram when only the address hash carries the launch data', () => {
	location.hash = '#tgWebAppData=user%3D%257B%2522id%2522%253A1%257D&tgWebAppVersion=8.0'

	expect(detectEnvironment()).toBe('telegram')
})

test('calls it telegram on a keyboard button launch, where initData is empty by design', () => {
	location.hash = '#tgWebAppVersion=8.0&tgWebAppPlatform=android&tgWebAppThemeParams=%7B%7D'

	expect(detectEnvironment()).toBe('telegram')
})

test('calls it telegram when the client sent nothing but the platform', () => {
	location.hash = '#tgWebAppPlatform=ios'

	expect(detectEnvironment()).toBe('telegram')
})

test('calls it a browser when nothing handed anything over', () => {
	expect(detectEnvironment()).toBe('browser')
})

test('does not mistake a hash router for telegram', () => {
	location.hash = '#/settings?tab=profile'

	expect(detectEnvironment()).toBe('browser')
})

test('calls it a browser when telegram-web-app.js is loaded but empty, as on a plain page', () => {
	holder.Telegram = { WebApp: { initData: '' } }

	expect(detectEnvironment()).toBe('browser')
})

test('reads the launch params out of the hash, without the leading hash sign', () => {
	location.hash = '#tgWebAppPlatform=ios&tgWebAppVersion=8.0'

	expect(launchParams().get('tgWebAppPlatform')).toBe('ios')
	expect(launchParams().get('tgWebAppVersion')).toBe('8.0')
})

test('hands back the client object itself, so the panel reads the live one', () => {
	const app = { initData: 'x' }
	holder.Telegram = { WebApp: app }

	expect(webApp()).toBe(app)
})
