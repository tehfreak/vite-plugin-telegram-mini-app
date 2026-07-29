// What matters is that viewportHeight and viewportStableHeight diverge, not the exact ratio.
const KEYBOARD_RATIO = 0.6
const COLLAPSED_RATIO = 0.5

export const NO_INSETS = { top: 0, bottom: 0, left: 0, right: 0 }

export const insets = () => ({ ...NO_INSETS })

let keyboard = false
let expanded = true
const listeners = new Set<() => void>()

const notify = () => {
	for (const listener of listeners) listener()
}

const share = () => (expanded ? 1 : COLLAPSED_RATIO)

export const stableHeight = () => Math.round(window.innerHeight * share())

export const height = () => Math.round((window.visualViewport?.height ?? window.innerHeight) * share() * (keyboard ? KEYBOARD_RATIO : 1))

export const keyboardShown = () => keyboard

export const isExpanded = () => expanded

export function setKeyboard(shown: boolean) {
	keyboard = shown
	notify()
}

export function setExpanded(next: boolean) {
	expanded = next
	notify()
}

export function onViewport(listener: () => void) {
	listeners.add(listener)
	window.addEventListener('resize', listener)
	// Pinch zoom and the keyboard only change the visual viewport; a plain resize does not fire.
	window.visualViewport?.addEventListener('resize', listener)
}
