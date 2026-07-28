import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { Overrides, TelegramUser } from './types.js'

export type State = { user: TelegramUser | null; overrides: Overrides }

const EMPTY: State = { user: null, overrides: {} }

export function readState(file: string): State {
	try {
		const parsed = JSON.parse(readFileSync(file, 'utf8')) as Partial<State>
		return { user: parsed.user ?? null, overrides: parsed.overrides ?? {} }
	} catch {
		return EMPTY
	}
}

export function writeState(file: string, state: State) {
	mkdirSync(dirname(file), { recursive: true })
	writeFileSync(file, `${JSON.stringify(state, null, '\t')}\n`)
}

export function patchState(current: State, patch: { user?: TelegramUser | null; overrides?: Overrides | null }): State {
	return {
		user: patch.user === undefined ? current.user : patch.user,
		overrides: patch.overrides === null ? {} : { ...current.overrides, ...patch.overrides },
	}
}
