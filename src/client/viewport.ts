// What matters is that viewportHeight and viewportStableHeight diverge, not the exact ratio.
const KEYBOARD_RATIO = 0.6

let keyboard = false
const listeners = new Set<() => void>()

const notify = () => {
	for (const listener of listeners) listener()
}

export const stableHeight = () => window.innerHeight

export const height = () => Math.round((window.visualViewport?.height ?? window.innerHeight) * (keyboard ? KEYBOARD_RATIO : 1))

export const keyboardShown = () => keyboard

export function setKeyboard(shown: boolean) {
	keyboard = shown
	notify()
}

export function onViewport(listener: () => void) {
	listeners.add(listener)
	window.addEventListener('resize', listener)
	// Pinch zoom and the keyboard only change the visual viewport; a plain resize does not fire.
	window.visualViewport?.addEventListener('resize', listener)
}
