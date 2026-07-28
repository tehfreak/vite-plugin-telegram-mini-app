type Dict = Record<string, unknown>

const app = (window as unknown as { Telegram?: { WebApp?: Dict } }).Telegram?.WebApp
const out = document.querySelector('#out')!

const isColor = (value: unknown) => typeof value === 'string' && /^#[\da-f]{3,8}$/i.test(value)

// No commentary in place of values: the panel shows exactly what the app will see.
function format(value: unknown): string {
	if (typeof value === 'string') return value === '' ? '""' : value
	return JSON.stringify(value, null, 2) ?? String(value)
}

function node<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string): HTMLElementTagNameMap[K] {
	const element = document.createElement(tag)
	if (text !== undefined) element.textContent = text
	return element
}

function rows(entries: [string, unknown][]): HTMLTableElement {
	const table = node('table')

	for (const [key, value] of entries) {
		const row = table.insertRow()
		row.insertCell().textContent = key

		const cell = row.insertCell()
		cell.className = 'value'
		if (isColor(value)) {
			const swatch = node('span')
			swatch.className = 'swatch'
			swatch.style.background = String(value)
			cell.append(swatch)
		}
		cell.append(format(value))
	}

	return table
}

function methodList(entries: [string, unknown][]) {
	const list = node('div')
	list.className = 'methods'
	list.textContent = entries.map(([key]) => `${key}()`).join('   ')
	return list
}

function section(target: HTMLElement, title: string, body: Node) {
	target.append(node('h2', title), body)
}

// Nothing here is listed by hand — the shape comes off the live object, so the table cannot
// drift from what the mock actually declares.
function split(target: Dict) {
	const entries = Object.entries(target)
	return {
		values: entries.filter(([, value]) => typeof value !== 'function' && (value === null || typeof value !== 'object')),
		objects: entries.filter(([, value]) => value !== null && typeof value === 'object') as [string, Dict][],
		methods: entries.filter(([, value]) => typeof value === 'function'),
	}
}

function build(): HTMLElement {
	const target = node('div')

	if (!app) {
		section(target, 'Mock not installed', node('p', 'window.Telegram.WebApp is missing — the plugin did not run.'))
		return target
	}

	const top = split(app)
	section(target, 'Properties', rows(top.values))

	for (const [key, value] of top.objects) {
		const nested = split(value)
		const body = node('div')
		if (nested.values.length) body.append(rows(nested.values))
		if (nested.objects.length) body.append(rows(nested.objects as [string, unknown][]))
		if (nested.methods.length) body.append(methodList(nested.methods))
		if (!body.childNodes.length) body.append(rows([[key, {}]]))
		section(target, key, body)
	}

	section(target, `WebApp methods (${top.methods.length})`, methodList(top.methods))

	// For comparison: what the mock reports against what the browser actually measures.
	section(
		target,
		'Browser (not part of the mock)',
		rows([
			['window.innerHeight', window.innerHeight],
			['window.innerWidth', window.innerWidth],
			['visualViewport.height', window.visualViewport?.height ?? null],
			['visualViewport.width', window.visualViewport?.width ?? null],
			['visualViewport.scale', window.visualViewport?.scale ?? null],
			['documentElement.clientHeight', document.documentElement.clientHeight],
			['devicePixelRatio', window.devicePixelRatio],
		]),
	)

	return target
}

let previous = ''

// Replacing the whole tree on every viewportChanged broke scrolling: the document height jumped
// and the browser clamped the position back to the top. So the DOM is touched only on real change.
function render() {
	const next = build()
	if (next.innerHTML === previous) return

	previous = next.innerHTML
	const position = window.scrollY
	out.replaceChildren(...next.childNodes)
	window.scrollTo({ top: position })
}

const button = (id: string, handler: () => void) =>
	document.querySelector(`#${id}`)!.addEventListener('click', () => {
		handler()
		render()
	})

button('refresh', () => {})

button('back', () => {
	const back = app!.BackButton as { show(): void; hide(): void; onClick(cb: () => void): void }
	back.show()
	back.onClick(() => {
		back.hide()
		render()
	})
})

button('main', () => {
	const main = app!.MainButton as { setParams(params: Dict): void; onClick(cb: () => void): void }
	main.setParams({ text: 'PAY', is_visible: true })
	main.onClick(() => alert('MainButton clicked'))
})

button('progress', () => (app!.MainButton as { showProgress(leaveActive?: boolean): void }).showProgress())

button('cloud', () => {
	const storage = app!.CloudStorage as { setItem(key: string, value: string, cb?: () => void): void; getItem(key: string, cb: (error: null, value: string) => void): void }
	storage.setItem('probe', new Date().toISOString(), () => storage.getItem('probe', (_error, value) => alert(`CloudStorage.getItem("probe") → ${value}`)))
})

button('confirm', () => (app!.showConfirm as (message: string, cb: (ok: boolean) => void) => void)('Confirm?', (ok) => alert(`showConfirm → ${ok}`)))

if (app) {
	const onEvent = app.onEvent as (event: string, cb: () => void) => void
	;(app.ready as () => void)()
	onEvent('viewportChanged', render)
	onEvent('themeChanged', render)
}

render()
