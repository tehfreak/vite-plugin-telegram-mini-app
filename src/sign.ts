import { createHmac } from 'node:crypto'
import type { TelegramUser } from './types.js'

export function signInitData(user: TelegramUser, botToken: string, authDate = Math.floor(Date.now() / 1000)): string {
	const params = new URLSearchParams()
	params.set('user', JSON.stringify({ ...user, id: Number(user.id) }))
	params.set('auth_date', String(authDate))
	params.set('query_id', 'dev')
	params.set('signature', 'tma-mock')

	const dataCheckString = [...params]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([key, value]) => `${key}=${value}`)
		.join('\n')

	const secret = createHmac('sha256', 'WebAppData').update(botToken).digest()
	params.set('hash', createHmac('sha256', secret).update(dataCheckString).digest('hex'))

	return params.toString()
}

export function toUnsafe(initData: string): Record<string, unknown> {
	const result: Record<string, unknown> = {}

	for (const [key, value] of new URLSearchParams(initData)) {
		if (key === 'user') {
			try {
				result[key] = JSON.parse(value)
			} catch {
				result[key] = value
			}
		} else if (key === 'auth_date') {
			result[key] = Number(value)
		} else {
			result[key] = value
		}
	}

	return result
}
