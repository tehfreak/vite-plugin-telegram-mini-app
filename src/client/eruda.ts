type ErudaLike = { init(): void; show(): void }
type Loader = () => Promise<unknown>

const CDN = 'https://cdn.jsdelivr.net/npm/eruda'

const usable = (value: unknown): value is ErudaLike => typeof (value as ErudaLike | undefined)?.init === 'function' && typeof (value as ErudaLike | undefined)?.show === 'function'

const fromGlobal = () => (window as unknown as { eruda?: unknown }).eruda

function fromCdn(url: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const script = document.createElement('script')
		script.src = url
		script.addEventListener('load', () => resolve())
		script.addEventListener('error', () => reject(new Error(`failed to load eruda from ${url}`)))
		document.head.append(script)
	})
}

export function erudaOpener(eruda?: boolean | Loader): (() => void) | undefined {
	if (!eruda) return undefined
	const loader = typeof eruda === 'function' ? eruda : undefined
	return () => void openEruda(loader).catch((error: unknown) => console.error('[tma] eruda:', error))
}

let instance: ErudaLike | null = null

/** The instance is kept: after an ESM import `window.eruda` is not the object the module returned. */
export async function openEruda(loader?: Loader, url = CDN) {
	if (!instance) {
		let candidate: unknown

		if (loader) {
			const module = (await loader()) as { default?: unknown }
			candidate = usable(module.default) ? module.default : module
		} else {
			await fromCdn(url)
			candidate = fromGlobal()
		}

		if (!usable(candidate)) throw new Error('eruda not found, or does not look like eruda')
		instance = candidate
		instance.init()
	}

	instance.show()
}
