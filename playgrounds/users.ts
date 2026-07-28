import type { TelegramUser } from 'vite-plugin-telegram-mini-app'

const NAMES = ['Alice', 'Bob', 'Carol', 'Dave', 'Erin', 'Frank', 'Grace', 'Heidi', 'Ivan', 'Judy']
const SURNAMES = ['Adams', 'Brooks', 'Clarke', 'Dawson', 'Ellis', 'Fisher', 'Grant', 'Hughes']

/**
 * `TMA_MOCK_USERS=500` grows the roster to a given size — that is how the panel gets checked for
 * usability when `users` comes from a real database.
 */
function generate(count: number): TelegramUser[] {
	return Array.from({ length: count }, (_, index) => ({
		id: 2000 + index,
		first_name: NAMES[index % NAMES.length]!,
		last_name: SURNAMES[index % SURNAMES.length]!,
		username: `example_telegram_user${index}`,
	}))
}

const extra = Number(process.env.TMA_MOCK_USERS ?? 0)

export const USERS: TelegramUser[] = [
	{ id: 1001, first_name: 'Alice', last_name: 'Adams', username: 'example_telegram_alice' },
	{ id: 1002, first_name: 'Bob', username: 'example_telegram_bob' },
	{ id: 1003, first_name: 'Carol', last_name: 'Clarke', username: 'example_telegram_carol' },
	...(extra > 0 ? generate(extra) : []),
]
