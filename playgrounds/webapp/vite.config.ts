import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { tma } from 'vite-plugin-telegram-mini-app'
import { USERS } from '../users.js'

export default defineConfig({
	root: fileURLToPath(new URL('.', import.meta.url)),
	plugins: [
		tma({
			botToken: process.env.TELEGRAM_BOT_TOKEN ?? 'playground-fake-token',
			mode: 'webapp',
			users: USERS,
		}),
	],
})
