import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { signInitData, toUnsafe } from './sign.js'

const BOT_TOKEN = 'test-bot-token'

function verify(initData: string, botToken = BOT_TOKEN): Record<string, string> | null {
	const params = new URLSearchParams(initData)
	const hash = params.get('hash')
	if (!hash) return null
	params.delete('hash')

	const dataCheckString = [...params]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([key, value]) => `${key}=${value}`)
		.join('\n')

	const secret = createHmac('sha256', 'WebAppData').update(botToken).digest()
	const expected = createHmac('sha256', secret).update(dataCheckString).digest('hex')

	return expected === hash ? Object.fromEntries(params) : null
}

describe('signInitData', () => {
	it('signs so that a real verifier accepts it', () => {
		const verified = verify(signInitData({ id: 100, first_name: 'Ann', username: 'annlee' }, BOT_TOKEN))
		expect(verified).not.toBeNull()
		expect(JSON.parse(verified!.user!)).toMatchObject({ id: 100, first_name: 'Ann', username: 'annlee' })
	})

	it('coerces a string id to a number, as Telegram does', () => {
		const verified = verify(signInitData({ id: '100', first_name: 'Ann' }, BOT_TOKEN))
		expect(JSON.parse(verified!.user!).id).toBe(100)
	})

	it('puts a fresh auth_date in place', () => {
		const verified = verify(signInitData({ id: 1, first_name: 'A' }, BOT_TOKEN))
		expect(Math.abs(Number(verified!.auth_date) - Math.floor(Date.now() / 1000))).toBeLessThan(5)
	})

	it('puts a signature in place — the @tma.js schema requires the field', () => {
		const verified = verify(signInitData({ id: 1, first_name: 'A' }, BOT_TOKEN))
		expect(verified!.signature).toBe('tma-mock')
	})

	it('signs the signature field too — editing it breaks the hash', () => {
		const tampered = signInitData({ id: 1, first_name: 'A' }, BOT_TOKEN).replace('signature=tma-mock', 'signature=other')
		expect(verify(tampered)).toBeNull()
	})

	it('fails verification against a different token', () => {
		expect(verify(signInitData({ id: 1, first_name: 'A' }, BOT_TOKEN), 'other-token')).toBeNull()
	})

	it('breaks when the payload is edited — the signature covers the data', () => {
		const tampered = signInitData({ id: 1, first_name: 'Ann' }, BOT_TOKEN).replace('Ann', 'Eve')
		expect(verify(tampered)).toBeNull()
	})
})

describe('toUnsafe', () => {
	it('parses the string into the object apps actually read', () => {
		const unsafe = toUnsafe(signInitData({ id: 7, first_name: 'Ann', last_name: 'Lee' }, BOT_TOKEN))
		expect(unsafe.user).toMatchObject({ id: 7, first_name: 'Ann', last_name: 'Lee' })
		expect(typeof unsafe.auth_date).toBe('number')
		expect(typeof unsafe.hash).toBe('string')
	})
})
