// @vitest-environment happy-dom
import { beforeEach, expect, test, vi } from 'vitest'
import { copyButton, initDataRows, jsonBlock, parseJson, snapshot, tabStrip, table } from './readout.js'

const KEY = 'tma-test-tab'
const TITLES = ['identity', 'environment', 'data']

const tabs = (strip: HTMLElement) => [...strip.children] as HTMLElement[]

const cells = (rendered: HTMLElement) => [...rendered.children].map((line) => [...line.children].map((cell) => cell.textContent))

beforeEach(() => sessionStorage.clear())

test('remembers the active tab, because switching identity reloads the page', () => {
	tabs(tabStrip(KEY, TITLES, () => {}).strip)[2]!.click()

	const reopened = tabStrip(KEY, TITLES, () => {})

	expect(reopened.active).toBe(2)
	expect(tabs(reopened.strip)[2]!.dataset.active).toBe('true')
	expect(tabs(reopened.strip)[0]!.dataset.active).toBe('false')
})

test('opens on the first tab when nothing was stored yet', () => {
	expect(tabStrip(KEY, TITLES, () => {}).active).toBe(0)
})

test('hands the picked index to the caller', () => {
	const onSelect = vi.fn()

	tabs(tabStrip(KEY, TITLES, onSelect).strip)[1]!.click()

	expect(onSelect).toHaveBeenCalledWith(1)
})

test('the table lays every row out as key and value', () => {
	expect(
		cells(
			table([
				['platform', 'ios'],
				['version', '8.0'],
			]),
		),
	).toEqual([
		['platform', 'ios'],
		['version', '8.0'],
	])
})

test('the table tells an absent value from an empty one, that is the whole point of reading it', () => {
	expect(
		cells(
			table([
				['missing', undefined],
				['nulled', null],
				['empty', ''],
			]),
		),
	).toEqual([
		['missing', '—'],
		['nulled', '—'],
		['empty', '""'],
	])
})

test('the table spells objects and numbers out instead of printing object Object', () => {
	expect(
		cells(
			table([
				['inset', { top: 0, bottom: 34 }],
				['height', 812],
				['expanded', false],
			]),
		),
	).toEqual([
		['inset', JSON.stringify({ top: 0, bottom: 34 }, null, 2)],
		['height', '812'],
		['expanded', 'false'],
	])
})

test('the table says so when there is nothing to show', () => {
	expect(table([]).textContent).toBe('—')
})

test('parseJson answers null instead of throwing on anything unparseable', () => {
	expect(parseJson('{"id":1}')).toEqual({ id: 1 })
	expect(parseJson('{"id":')).toBeNull()
	expect(parseJson('')).toBeNull()
	expect(parseJson(null)).toBeNull()
	expect(parseJson(undefined)).toBeNull()
})

test('initDataRows lifts the user out and leaves the rest in place', () => {
	const raw = new URLSearchParams({ user: JSON.stringify({ id: 1, first_name: 'Ann' }), query_id: 'dev', hash: 'abc' }).toString()

	const { user, init } = initDataRows(raw)

	expect(user).toEqual([
		['id', 1],
		['first_name', 'Ann'],
	])
	expect(init).toEqual([
		['query_id', 'dev'],
		['hash', 'abc'],
	])
})

test('initDataRows says how old auth_date is, since a stale one is what a backend rejects', () => {
	const hour = Math.floor(Date.now() / 1000) - 3600
	const raw = new URLSearchParams({ auth_date: String(hour) }).toString()

	expect(initDataRows(raw).init).toEqual([['auth_date', `${hour} (60 min ago)`]])
})

test('initDataRows leaves an unreadable auth_date alone rather than printing NaN', () => {
	expect(initDataRows('auth_date=soon').init).toEqual([['auth_date', 'soon']])
})

test('initDataRows copes with the empty initData an anonymous launch carries', () => {
	expect(initDataRows('')).toEqual({ user: [], init: [] })
})

test('the copy button puts the text on the clipboard and says so', () => {
	const writeText = vi.fn()
	Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
	const button = copyButton('user=%7B%22id%22%3A1%7D')

	button.click()

	expect(writeText).toHaveBeenCalledWith('user=%7B%22id%22%3A1%7D')
	expect(button.textContent).toBe('Copied')
})

test('the copy button admits when there was nothing to copy', () => {
	Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn() }, configurable: true })
	const button = copyButton('', 'Copy initData')

	button.click()

	expect(button.textContent).toBe('Nothing to copy')
})

test('the copy button goes back to its own title, so it can be pressed again', () => {
	vi.useFakeTimers()
	Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn() }, configurable: true })
	const button = copyButton('x', 'Copy JSON')

	button.click()
	vi.advanceTimersByTime(1500)

	expect(button.textContent).toBe('Copy JSON')
	vi.useRealTimers()
})

test('the json block prints indented and scrolls on its own', () => {
	const block = jsonBlock({ initData: '', user: { id: 1 } })

	expect(block.textContent).toBe(JSON.stringify({ initData: '', user: { id: 1 } }, null, 2))
	expect(block.className).toBe('scroll')
})

test('snapshot marks methods instead of dropping them, so the dump shows the whole surface', () => {
	expect(snapshot({ ready: () => {}, initData: 'x', isExpanded: true })).toEqual({ ready: 'ƒ()', initData: 'x', isExpanded: true })
})

test('snapshot keeps primitives and null as they are', () => {
	expect(snapshot(null)).toBeNull()
	expect(snapshot(0)).toBe(0)
	expect(snapshot('')).toBe('')
})

test('snapshot walks into arrays', () => {
	expect(snapshot([1, () => {}, { a: 2 }])).toEqual([1, 'ƒ()', { a: 2 }])
})

test('snapshot stops at the fourth level, so a self referencing WebApp cannot hang the panel', () => {
	const looping: Record<string, unknown> = { name: 'root' }
	looping.self = looping

	expect(snapshot(looping)).toEqual({ name: 'root', self: { name: 'root', self: { name: 'root', self: { name: 'root', self: '…' } } } })
})

test('snapshot survives a property that throws when read', () => {
	const hostile = {
		get boom() {
			throw new Error('nope')
		},
		fine: 1,
	}

	expect(snapshot(hostile)).toEqual({ boom: '⚠ unreadable', fine: 1 })
})

test('ignores a stored index that no longer points at a tab', () => {
	sessionStorage.setItem(KEY, '7')
	expect(tabStrip(KEY, TITLES, () => {}).active).toBe(0)

	sessionStorage.setItem(KEY, 'nonsense')
	expect(tabStrip(KEY, TITLES, () => {}).active).toBe(0)
})
